import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { 
  withErrorHandling,
  ForbiddenError,
  AppError
} from '@/lib/errors/handler'
import { detectAndProcessReplies } from '@/services/gmail/replyDetector'
import { GmailHistorySyncService } from '@/services/gmail/history'
import { prisma } from '@/lib/db/prisma'
import { google } from 'googleapis'
import SequenceScheduler from '@/services/sequencer'

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
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

  const userId = session.user.id
  const syncStartTime = new Date()

  try {
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

    // 1. Sync sent emails history
    console.log('Step 1: Syncing Gmail history...')
    const historyService = new GmailHistorySyncService(gmail)
    await historyService.syncSentEmails(userId)

    // 2. Detect and process replies
    console.log('Step 2: Detecting replies...')
    const repliesProcessed = await detectAndProcessReplies(userId)

    // 3. Log the sync activity
    const syncDuration = Date.now() - syncStartTime.getTime()
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'GMAIL_SYNC_COMPLETED',
        metadata: {
          repliesProcessed,
          syncDurationMs: syncDuration,
          syncedAt: syncStartTime.toISOString()
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Gmail sync completed successfully',
      data: {
        repliesProcessed,
        syncDurationMs: syncDuration,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gmail sync failed'
    
    // Log failed sync
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'GMAIL_SYNC_FAILED',
        metadata: {
          error: message,
          timestamp: new Date().toISOString()
        }
      }
    })

    throw new AppError(500, `Failed to sync Gmail: ${message}`, 'GMAIL_SYNC_ERROR')
  }
})

/**
 * GET - Check current sync status
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const userId = session.user.id

  // Get last sync activity
  const lastSync = await prisma.activityLog.findFirst({
    where: {
      userId,
      action: 'GMAIL_SYNC_COMPLETED'
    },
    orderBy: { createdAt: 'desc' }
  })

  // Count pending emails
  const pendingEmails = await prisma.outreachEmail.findMany({
    where: {
      userId,
      status: 'SCHEDULED'
    }
  })

  // Count emails awaiting reply
  const awaitingReply = await prisma.outreachEmail.findMany({
    where: {
      userId,
      status: 'SENT'
    }
  })

  return NextResponse.json({
    lastSyncAt: lastSync?.createdAt || null,
    lastSyncMetadata: lastSync?.metadata || null,
    pendingScheduledEmails: pendingEmails.length,
    emailsAwaitingReply: awaitingReply.length
  })
})
