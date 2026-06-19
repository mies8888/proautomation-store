import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  withErrorHandling,
  ForbiddenError,
  AppError
} from '@/lib/errors/handler'
import { sendEmailViaGmail } from '@/services/gmail/sender'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const SendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  cc: z.string().email().optional(),
  bcc: z.string().email().optional(),
  leadId: z.string().optional(),
  inReplyTo: z.string().optional()
})

// Retry configuration
const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 5000] // ms - 1s, 2s, 5s
const RETRYABLE_ERRORS = ['GMAIL_RATE_LIMIT', 'GMAIL_TEMPORARY_ERROR', 'NETWORK_ERROR']

async function sendWithRetry(
  params: any,
  retryCount: number = 0
): Promise<any> {
  try {
    return await sendEmailViaGmail(params)
  } catch (error) {
    const errorCode = (error as any)?.code || 'UNKNOWN_ERROR'
    
    if (retryCount < MAX_RETRIES && RETRYABLE_ERRORS.includes(errorCode)) {
      const delay = RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1]
      await new Promise(resolve => setTimeout(resolve, delay))
      return sendWithRetry(params, retryCount + 1)
    }
    throw error
  }
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

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

  const body = await req.json()
  const emailData = SendEmailSchema.parse(body)

  // Track email in database for delivery status
  let outreachEmail = null
  if (emailData.leadId) {
    outreachEmail = await prisma.outreachEmail.create({
      data: {
        leadId: emailData.leadId,
        userId: session.user.id,
        to: emailData.to,
        subject: emailData.subject,
        body: emailData.body,
        htmlContent: emailData.body,
        status: 'DRAFT'
      }
    })
  }

  try {
    const result = await sendWithRetry({
      userId: session.user.id,
      to: emailData.to,
      subject: emailData.subject,
      body: emailData.body,
      htmlBody: emailData.body,
      replyTo: emailData.inReplyTo,
      refreshToken: gmailAccount.refresh_token || '',
      accessToken: gmailAccount.access_token || undefined
    })

    // Update email status to sent
    if (outreachEmail) {
      await prisma.outreachEmail.update({
        where: { id: outreachEmail.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          gmailMessageId: result.messageId
        }
      })
    }

    // Log the email send activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        leadId: emailData.leadId,
        action: 'EMAIL_SENT',
        metadata: {
          to: emailData.to,
          subject: emailData.subject,
          messageId: result.messageId,
          retries: 0,
          deliveryStatus: 'DELIVERED',
          timestamp: new Date().toISOString()
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      data: {
        ...result,
        emailId: outreachEmail?.id,
        status: 'SENT'
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send email'
    const errorCode = (error as any)?.code || 'EMAIL_SEND_ERROR'

    // Update email status to failed
    if (outreachEmail) {
      await prisma.outreachEmail.update({
        where: { id: outreachEmail.id },
        data: {
          status: 'FAILED'
        }
      })
    }

    // Log the email send failure
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        leadId: emailData.leadId,
        action: 'EMAIL_SEND_FAILED',
        metadata: {
          to: emailData.to,
          subject: emailData.subject,
          error: message,
          errorCode,
          retries: MAX_RETRIES,
          timestamp: new Date().toISOString()
        }
      }
    })

    throw new AppError(500, `Failed to send email after ${MAX_RETRIES} retries: ${message}`, errorCode)
  }
})

/**
 * GET - Get email draft status
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  // Get recent emails sent by this user
  const recentEmails = await prisma.outreachEmail.findMany({
    where: {
      userId: session.user.id
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { lead: true }
  })

  return NextResponse.json({
    recentEmails: recentEmails.map(e => ({
      id: e.id,
      to: e.to,
      subject: e.subject,
      status: e.status,
      sentAt: e.sentAt,
      lead: e.lead?.companyName
    }))
  })
})
