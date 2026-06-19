import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  withErrorHandling,
  ForbiddenError,
  AppError
} from '@/lib/errors/handler'
import { prisma } from '@/lib/db/prisma'
import { ReplyDetectionService } from '@/lib/gmail/reply-detection'

/**
 * POST - Process and classify email reply
 * Analyzes incoming email to detect if it's a reply to a sent email
 * Updates reply count and sentiment analysis
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const body = await req.json()
  const { gmailMessageData, leadId } = body

  if (!gmailMessageData || !leadId) {
    throw new AppError(400, 'gmailMessageData and leadId are required', 'MISSING_PARAMS')
  }

  // Verify user owns the lead
  const lead = await prisma.lead.findUnique({
    where: { id: leadId }
  })

  if (!lead || lead.ownerUserId !== session.user.id) {
    throw new ForbiddenError('You do not have access to this lead')
  }

  // Detect if this is a reply
  const replyDetection = await ReplyDetectionService.detectReply(
    session.user.id,
    gmailMessageData
  )

  if (!replyDetection.isReply) {
    return NextResponse.json({
      success: false,
      message: 'Message does not appear to be a reply',
      detection: replyDetection
    }, { status: 400 })
  }

  // Get the matched outreach email
  const outreachEmail = await prisma.outreachEmail.findUnique({
    where: { id: replyDetection.matchedEmailId! }
  })

  if (!outreachEmail) {
    throw new AppError(404, 'Original email not found', 'NOT_FOUND')
  }

  // Extract text from Gmail message for sentiment analysis
  const messageText = gmailMessageData.payload?.parts?.[0]?.body?.data || ''
  const decodedText = Buffer.from(messageText, 'base64').toString('utf-8')

  // Analyze sentiment and classify reply
  const sentiment = ReplyDetectionService.analyzeSentiment(decodedText)
  const replyType = ReplyDetectionService.classifyReplyType(decodedText)

  // Create EmailReply record
  const emailReply = await prisma.emailReply.create({
    data: {
      outreachEmailId: outreachEmail.id,
      fromEmail: gmailMessageData.payload?.headers?.find((h: any) => h.name === 'from')?.value || '',
      body: decodedText.substring(0, 1000),
      sentiment: sentiment.sentiment,
      gmailMessageId: gmailMessageData.id,
      gmailThreadId: gmailMessageData.threadId || '',
      repliedAt: new Date(parseInt(gmailMessageData.internalDate || 0))
    }
  })

  // Update outreach email with reply status
  const updatedEmail = await prisma.outreachEmail.update({
    where: { id: outreachEmail.id },
    data: {
      status: 'REPLIED',
      updatedAt: new Date()
    }
  })

  // Determine lead status and score adjustment
  let leadNewStatus = lead.status
  let scoreAdjustment = 0

  switch (replyType) {
    case 'positive_interest':
      leadNewStatus = 'ENGAGED'
      scoreAdjustment = 25
      break
    case 'question':
      leadNewStatus = 'ENGAGED'
      scoreAdjustment = 15
      break
    case 'objection':
      leadNewStatus = 'ENGAGED'
      scoreAdjustment = 8
      break
    case 'negative_uninterested':
      leadNewStatus = 'UNQUALIFIED'
      scoreAdjustment = -15
      break
    default:
      leadNewStatus = 'ENGAGED'
      scoreAdjustment = 5
  }

  // Update lead with new status
  const updatedLead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: leadNewStatus,
      leadScore: Math.max(0, lead.leadScore + scoreAdjustment)
    }
  })

  // Count total replies for the lead to update engagement level
  const totalReplies = await prisma.emailReply.count({
    where: {
      outreachEmail: {
        leadId
      }
    }
  })

  // Stop any pending sequences if we got a positive reply
  if (replyType === 'positive_interest') {
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        leadId,
        action: 'SEQUENCE_PAUSED',
        metadata: {
          reason: 'Positive reply received',
          replyId: emailReply.id,
          timestamp: new Date().toISOString()
        }
      }
    })
  }

  // Log the reply processing with comprehensive metadata
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      leadId,
      action: 'EMAIL_REPLY_RECEIVED',
      metadata: {
        replyId: emailReply.id,
        originalEmailId: outreachEmail.id,
        confidence: replyDetection.confidence,
        matchType: replyDetection.matchType,
        sentiment: sentiment.sentiment,
        replyType,
        scoreAdjustment,
        totalReplies,
        leadStatusUpdate: {
          from: lead.status,
          to: leadNewStatus
        },
        timestamp: new Date().toISOString()
      }
    }
  })

  return NextResponse.json({
    success: true,
    reply: {
      id: emailReply.id,
      sentiment: sentiment.sentiment,
      replyType,
      confidence: replyDetection.confidence,
      matchType: replyDetection.matchType,
      scoreAdjustment
    },
    originalEmail: {
      id: outreachEmail.id,
      status: updatedEmail.status
    },
    lead: {
      id: lead.id,
      previousStatus: lead.status,
      newStatus: updatedLead.status,
      leadScore: updatedLead.leadScore,
      totalReplies
    }
  }, { status: 201 })
})

/**
 * GET - Retrieve reply analysis for an email
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const { searchParams } = new URL(req.url)
  const emailId = searchParams.get('emailId')

  if (!emailId) {
    throw new AppError(400, 'emailId is required', 'MISSING_EMAIL_ID')
  }

  // Verify user owns the email
  const email = await prisma.outreachEmail.findUnique({
    where: { id: emailId },
    include: {
      replies: {
        orderBy: { repliedAt: 'desc' },
        take: 10
      }
    }
  })

  if (!email || email.userId !== session.user.id) {
    throw new ForbiddenError('You do not have access to this email')
  }

  return NextResponse.json({
    email: {
      id: email.id,
      subject: email.subject,
      status: email.status,
      to: email.to,
      sentAt: email.sentAt
    },
    replies: email.replies.map(reply => ({
      id: reply.id,
      fromEmail: reply.fromEmail,
      sentiment: reply.sentiment,
      repliedAt: reply.repliedAt,
      preview: reply.body.substring(0, 100)
    }))
  })
})
