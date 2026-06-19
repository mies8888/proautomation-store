import { NextRequest, NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/prisma"
import { 
  withErrorHandling,
  validateRequest,
  ForbiddenError,
  NotFoundError,
  AppError
} from '@/lib/errors/handler'
import { SendEmailSchema } from '@/lib/validation/schemas'
import { checkEmailSendingRateLimit, addRateLimitHeaders } from '@/lib/errors/rateLimiter'
import { sendEmailWithStoredCredentials } from '@/services/gmail/sender'

export const POST = withErrorHandling(async (req: NextRequest, props: { params: Promise<{ id: string }> }) => {
  const params = await props.params
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  // Validate request
  const data = await validateRequest(req, SendEmailSchema)

  // Check rate limit
  await checkEmailSendingRateLimit(req, session.user.id)

  // Verify lead exists and user owns it
  const lead = await prisma.lead.findUnique({
    where: { id: data.leadId || params.id }
  })

  if (!lead) {
    throw new NotFoundError('Lead')
  }

  if (lead.ownerUserId !== session.user.id) {
    throw new ForbiddenError('You can only send emails for your own leads')
  }

  // Verify email exists
  const email = await prisma.outreachEmail.findUnique({
    where: { id: data.emailId }
  })

  if (!email) {
    throw new NotFoundError('Email')
  }

  if (email.leadId !== lead.id) {
    throw new ForbiddenError('Email does not belong to this lead')
  }

  // Check if user has Gmail connected
  const gmailAccount = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: 'google'
    }
  })

  if (!gmailAccount) {
    throw new AppError(
      400,
      'Gmail account not connected. Please connect your Gmail account in settings.',
      'GMAIL_NOT_CONNECTED'
    )
  }

  // Send email via Gmail API
  const htmlBody = email.htmlContent || `<p>${email.body.replace(/\n/g, '<br>')}</p>`
  
  try {
    await sendEmailWithStoredCredentials({
      to: email.to,
      subject: email.subject,
      body: email.body,
      htmlBody,
      replyTo: email.replyTo || undefined,
      accountId: gmailAccount.id
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send email via Gmail'
    throw new AppError(500, message, 'GMAIL_SEND_FAILED')
  }

  // Update email status
  const sentEmail = await prisma.outreachEmail.update({
    where: { id: data.emailId },
    data: {
      status: 'SENT',
      sentAt: new Date()
    },
    include: { lead: true }
  })

  // Update lead status to CONTACTED if it was NEW
  if (lead.status === 'NEW') {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'CONTACTED' }
    })
  }

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      leadId: lead.id,
      action: 'EMAIL_SENT',
      metadata: {
        emailId: sentEmail.id,
        subject: sentEmail.subject,
        recipient: email.to,
        viaGmail: true
      }
    }
  })

  const response = NextResponse.json(sentEmail)
  return addRateLimitHeaders(response, {
    allowed: true,
    remaining: 19,
    limit: 20,
    resetAt: Date.now() + 86400000
  })
})
