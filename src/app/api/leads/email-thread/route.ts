import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  withErrorHandling,
  ForbiddenError,
  AppError
} from '@/lib/errors/handler'
import { prisma } from '@/lib/db/prisma'
import { google } from 'googleapis'
import { z } from 'zod'

const QuerySchema = z.object({
  leadId: z.string(),
  emailId: z.string().optional()
})

/**
 * GET - Fetch email thread for a lead
 * Returns all emails (sent and received) for a specific lead
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const { searchParams } = new URL(req.url)
  const leadId = searchParams.get('leadId')
  const emailId = searchParams.get('emailId')

  if (!leadId) {
    throw new AppError(400, 'leadId is required', 'MISSING_LEAD_ID')
  }

  // Verify user owns the lead
  const lead = await prisma.lead.findUnique({
    where: { id: leadId }
  })

  if (!lead || lead.ownerUserId !== session.user.id) {
    throw new AppError(403, 'You do not have access to this lead', 'FORBIDDEN')
  }

  // Get Gmail account
  const gmailAccount = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: 'google'
    }
  })

  if (!gmailAccount) {
    throw new AppError(400, 'Gmail account not connected', 'GMAIL_NOT_CONNECTED')
  }

  // Create Gmail client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/callback/google`
  )

  oauth2Client.setCredentials({
    refresh_token: gmailAccount.refresh_token,
    access_token: gmailAccount.access_token
  })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  // Get all outreach emails for this lead
  const outreachEmails = await prisma.outreachEmail.findMany({
    where: {
      leadId,
      gmailMessageId: { not: null }
    },
    include: { replies: true },
    orderBy: { sentAt: 'asc' }
  })

  if (outreachEmails.length === 0) {
    return NextResponse.json({
      lead: { id: lead.id, companyName: lead.companyName },
      emails: [],
      total: 0
    })
  }

  // If specific email requested, fetch full thread
  if (emailId) {
    const email = outreachEmails.find(e => e.id === emailId)
    if (!email || !email.gmailMessageId) {
      throw new AppError(404, 'Email not found', 'EMAIL_NOT_FOUND')
    }

    try {
      const thread = await gmail.users.threads.get({
        userId: 'me',
        id: email.gmailMessageId
      })

      const messages = thread.data.messages?.map(msg => ({
        id: msg.id,
        from: msg.payload?.headers?.find(h => h.name === 'From')?.value,
        to: msg.payload?.headers?.find(h => h.name === 'To')?.value,
        subject: msg.payload?.headers?.find(h => h.name === 'Subject')?.value,
        date: msg.payload?.headers?.find(h => h.name === 'Date')?.value,
        snippet: msg.snippet,
        internalDate: msg.internalDate,
        labels: msg.labelIds
      })) || []

      return NextResponse.json({
        lead: { id: lead.id, companyName: lead.companyName },
        thread: thread.data,
        messages: messages.sort((a, b) => 
          parseInt(a.internalDate || '0') - parseInt(b.internalDate || '0')
        )
      })
    } catch (error) {
      console.error('Error fetching thread:', error)
      throw new AppError(500, 'Failed to fetch email thread', 'THREAD_FETCH_ERROR')
    }
  }

  // Return summary of all emails for this lead
  return NextResponse.json({
    lead: { id: lead.id, companyName: lead.companyName },
    emails: outreachEmails.map(e => ({
      id: e.id,
      to: e.to,
      subject: e.subject,
      status: e.status,
      sentAt: e.sentAt,
      gmailMessageId: e.gmailMessageId,
      replyCount: e.replies.length,
      replies: e.replies.map(r => ({
        id: r.id,
        from: r.fromEmail,
        fromName: r.fromName,
        body: r.body.slice(0, 200),
        repliedAt: r.repliedAt
      }))
    })),
    total: outreachEmails.length
  })
})

/**
 * PUT - Update email thread status
 */
export const PUT = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const body = await req.json()
  const { emailId, status } = z.object({
    emailId: z.string(),
    status: z.enum(['DRAFT', 'SCHEDULED', 'SENT', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED'])
  }).parse(body)

  // Get the email
  const email = await prisma.outreachEmail.findUnique({
    where: { id: emailId },
    include: { lead: true }
  })

  if (!email || email.lead.ownerUserId !== session.user.id) {
    throw new AppError(403, 'You do not have access to this email', 'FORBIDDEN')
  }

  // Update email status
  const updated = await prisma.outreachEmail.update({
    where: { id: emailId },
    data: { status }
  })

  // Log status change
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      leadId: email.leadId,
      action: `EMAIL_STATUS_CHANGED`,
      metadata: {
        emailId,
        newStatus: status,
        previousStatus: email.status,
        timestamp: new Date().toISOString()
      }
    }
  })

  return NextResponse.json({
    success: true,
    email: updated
  })
})
