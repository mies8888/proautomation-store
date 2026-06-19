import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  withErrorHandling,
  ForbiddenError,
  AppError
} from '@/lib/errors/handler'
import { prisma } from '@/lib/db/prisma'
import SequenceScheduler from '@/services/sequencer'
import { sendEmailViaGmail } from '@/services/gmail/sender'
import { emailTemplates } from '@/services/gmail/templates'

/**
 * POST - Execute pending sequence steps for a lead
 * This runs during cron or background job and sends the next email in any active sequences
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const body = await req.json()
  const { leadId, sequenceId, forceExecute } = body

  // Verify user owns the lead
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      outreachEmails: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  if (!lead || lead.ownerUserId !== session.user.id) {
    throw new ForbiddenError('You do not have access to this lead')
  }

  // Get the sequence from activity logs
  const sequence = await prisma.activityLog.findFirst({
    where: {
      userId: session.user.id,
      leadId,
      action: 'SEQUENCE_CREATED',
      ...(sequenceId && { id: sequenceId })
    },
    orderBy: { createdAt: 'desc' }
  })

  if (!sequence) {
    throw new AppError(404, 'No active sequence found for this lead', 'NO_SEQUENCE')
  }

  // Check if a positive reply was received (don't continue sequence)
  const recentReply = await prisma.emailReply.findFirst({
    where: {
      outreachEmail: {
        leadId,
        userId: session.user.id
      }
    },
    orderBy: { repliedAt: 'desc' },
    take: 1
  })

  if (recentReply && !forceExecute) {
    return NextResponse.json({
      success: false,
      message: 'Sequence paused: Lead has replied to an email',
      sequenceId: sequence.id,
      replyId: recentReply.id
    }, { status: 400 })
  }

  // Get Gmail account for sending
  const gmailAccount = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: 'google'
    }
  })

  if (!gmailAccount) {
    throw new AppError(
      400,
      'Gmail account not connected',
      'GMAIL_NOT_CONNECTED'
    )
  }

  const sequenceMetadata = sequence.metadata as any
  const steps = sequenceMetadata?.stepDetails || []

  if (!steps || steps.length === 0) {
    throw new AppError(400, 'Invalid sequence data', 'INVALID_SEQUENCE')
  }

  // Determine which step to execute next
  const currentStepIndex = sequenceMetadata?.currentStep || 0
  if (currentStepIndex >= steps.length) {
    return NextResponse.json({
      success: false,
      message: 'Sequence already completed',
      sequenceId: sequence.id
    }, { status: 400 })
  }

  const currentStep = steps[currentStepIndex]
  const lastEmail = lead.outreachEmails[0]
  
  // Check if enough time has passed since last email
  if (lastEmail && !forceExecute) {
    const daysSinceLastEmail = Math.floor(
      (Date.now() - new Date(lastEmail.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    )
    
    if (daysSinceLastEmail < currentStep.delayDays) {
      return NextResponse.json({
        success: false,
        message: `Waiting ${currentStep.delayDays - daysSinceLastEmail} more days to send next email`,
        sequenceId: sequence.id,
        nextEmailIn: currentStep.delayDays - daysSinceLastEmail
      }, { status: 400 })
    }
  }

  // Get email template
  const templateName = currentStep.template
  const template = (emailTemplates as any)[templateName]

  if (!template) {
    throw new AppError(400, `Template not found: ${templateName}`, 'TEMPLATE_NOT_FOUND')
  }

  // Prepare email variables
  const emailVars = {
    firstName: 'there',
    companyName: lead.companyName || 'your company',
    website: lead.websiteUrl || '',
    service: lead.leadPurpose || 'our services',
    leadScore: lead.leadScore || 0
  }

  // Substitute variables in template
  let emailSubject = template.subject || currentStep.subject
  let emailBody = template.body || currentStep.bodyOverride

  for (const [key, value] of Object.entries(emailVars)) {
    emailSubject = emailSubject.replace(`{{${key}}}`, String(value))
    emailBody = emailBody.replace(`{{${key}}}`, String(value))
  }

  // Send email
  try {
    const result = await sendEmailViaGmail({
      userId: session.user.id,
      to: lead.contactEmail || '',
      subject: emailSubject,
      body: emailBody,
      htmlBody: emailBody,
      refreshToken: gmailAccount.refresh_token || '',
      accessToken: gmailAccount.access_token || undefined
    })

    // Record the sent email
    const sentEmail = await prisma.outreachEmail.create({
      data: {
        leadId,
        userId: session.user.id,
        to: lead.contactEmail || '',
        subject: emailSubject,
        body: emailBody,
        htmlContent: emailBody,
        status: 'SENT',
        sentAt: new Date(),
        gmailMessageId: result.messageId
      }
    })

    // Log sequence step execution
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        leadId,
        action: 'SEQUENCE_STEP_EXECUTED',
        metadata: {
          sequenceId: sequence.id,
          stepNumber: currentStepIndex + 1,
          totalSteps: steps.length,
          template: templateName,
          emailId: sentEmail.id,
          messageId: result.messageId,
          timestamp: new Date().toISOString()
        }
      }
    })

    // Update sequence progress in activity log metadata
    const nextStepIndex = currentStepIndex + 1
    if (nextStepIndex < steps.length) {
      await prisma.activityLog.update({
        where: { id: sequence.id },
        data: {
          metadata: {
            ...sequenceMetadata,
            currentStep: nextStepIndex
          }
        }
      })
    } else {
      // Sequence completed
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          leadId,
          action: 'SEQUENCE_COMPLETED',
          metadata: {
            sequenceId: sequence.id,
            totalStepsSent: steps.length,
            completedAt: new Date().toISOString()
          }
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: `Step ${currentStepIndex + 1} of ${steps.length} executed`,
      sequenceId: sequence.id,
      email: {
        id: sentEmail.id,
        to: sentEmail.to,
        subject: emailSubject,
        status: sentEmail.status,
        messageId: result.messageId
      },
      progress: {
        currentStep: currentStepIndex + 1,
        totalSteps: steps.length,
        completed: nextStepIndex >= steps.length
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send sequence email'

    // Log the failure
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        leadId,
        action: 'SEQUENCE_STEP_FAILED',
        metadata: {
          sequenceId: sequence.id,
          stepNumber: currentStepIndex + 1,
          template: templateName,
          error: message,
          timestamp: new Date().toISOString()
        }
      }
    })

    throw new AppError(500, `Failed to execute sequence step: ${message}`, 'SEQUENCE_EXECUTION_ERROR')
  }
})

/**
 * GET - Get sequence status and next step info
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const { searchParams } = new URL(req.url)
  const leadId = searchParams.get('leadId')
  const sequenceId = searchParams.get('sequenceId')

  if (!leadId) {
    throw new AppError(400, 'leadId is required', 'MISSING_LEAD_ID')
  }

  // Verify user owns the lead
  const lead = await prisma.lead.findUnique({
    where: { id: leadId }
  })

  if (!lead || lead.ownerUserId !== session.user.id) {
    throw new ForbiddenError('You do not have access to this lead')
  }

  // Get active sequences
  const sequences = await prisma.activityLog.findMany({
    where: {
      userId: session.user.id,
      leadId,
      action: 'SEQUENCE_CREATED',
      ...(sequenceId && { id: sequenceId })
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  const sequenceInfos = sequences.map(seq => {
    const metadata = seq.metadata as any
    const steps = metadata?.stepDetails || []
    const currentStep = metadata?.currentStep || 0
    
    return {
      id: seq.id,
      createdAt: seq.createdAt,
      progress: {
        currentStep,
        totalSteps: steps.length,
        completed: currentStep >= steps.length
      },
      nextStep: currentStep < steps.length ? steps[currentStep] : null,
      steps: steps.map((s: any, i: number) => ({
        ...s,
        executed: i < currentStep,
        current: i === currentStep,
        pending: i > currentStep
      }))
    }
  })

  return NextResponse.json({
    sequences: sequenceInfos,
    leadId
  })
})
