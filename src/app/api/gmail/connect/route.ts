import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { 
  withErrorHandling,
  ForbiddenError,
  AppError
} from '@/lib/errors/handler'
import { prisma } from '@/lib/db/prisma'
import { google } from 'googleapis'

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const userId = session.user.id

  // Check if user has Gmail connected
  const gmailAccount = await prisma.account.findFirst({
    where: {
      userId,
      provider: 'google'
    },
    select: {
      id: true,
      providerAccountId: true,
      access_token: true,
      refresh_token: true,
      expires_at: true
    }
  })

  if (!gmailAccount) {
    return NextResponse.json({
      connected: false,
      message: 'Gmail account not connected'
    })
  }

  // Check if token is expired
  const isTokenExpired = gmailAccount.expires_at
    ? new Date(gmailAccount.expires_at * 1000) < new Date()
    : false

  return NextResponse.json({
    connected: true,
    accountId: gmailAccount.providerAccountId,
    tokenExpired: isTokenExpired,
    message: isTokenExpired
      ? 'Gmail token expired - re-authentication may be needed'
      : 'Gmail account is connected and active'
  })
})

/**
 * DELETE - Disconnect/revoke Gmail access
 */
export const DELETE = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const userId = session.user.id

  // Find the Gmail account
  const gmailAccount = await prisma.account.findFirst({
    where: {
      userId,
      provider: 'google'
    }
  })

  if (!gmailAccount) {
    throw new AppError(400, 'Gmail account not connected', 'GMAIL_NOT_CONNECTED')
  }

  try {
    // Optionally: Revoke token at Google (requires additional scopes)
    // For now, we just delete the local record
    
    await prisma.account.delete({
      where: { id: gmailAccount.id }
    })

    // Log the disconnection
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'GMAIL_DISCONNECTED',
        metadata: {
          accountId: gmailAccount.providerAccountId,
          disconnectedAt: new Date().toISOString()
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Gmail account disconnected successfully'
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to disconnect'
    throw new AppError(500, `Failed to disconnect Gmail: ${message}`, 'GMAIL_DISCONNECT_ERROR')
  }
})

/**
 * POST /api/gmail/connect/test - Test Gmail connection
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const userId = session.user.id

  // Find Gmail account
  const gmailAccount = await prisma.account.findFirst({
    where: {
      userId,
      provider: 'google'
    }
  })

  if (!gmailAccount || !gmailAccount.refresh_token) {
    throw new AppError(400, 'Gmail account not connected', 'GMAIL_NOT_CONNECTED')
  }

  try {
    // Create OAuth client and test credentials
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

    // Test API call: get user profile
    const profile = await gmail.users.getProfile({
      userId: 'me',
      fields: 'emailAddress,messagesTotal,threadsTotal'
    })

    if (!profile.data || !profile.data.emailAddress) {
      throw new Error('Failed to get Gmail profile')
    }

    // Log successful test
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'GMAIL_CONNECTION_TEST',
        metadata: {
          success: true,
          email: profile.data.emailAddress,
          messagesTotal: profile.data.messagesTotal,
          threadsTotal: profile.data.threadsTotal,
          testedAt: new Date().toISOString()
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Gmail connection is working',
      data: {
        email: profile.data.emailAddress,
        messagesTotal: profile.data.messagesTotal,
        threadsTotal: profile.data.threadsTotal
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection test failed'

    // Log failed test
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'GMAIL_CONNECTION_TEST',
        metadata: {
          success: false,
          error: message,
          testedAt: new Date().toISOString()
        }
      }
    })

    throw new AppError(
      500,
      `Gmail connection test failed: ${message}. You may need to reconnect your Gmail account.`,
      'GMAIL_TEST_FAILED'
    )
  }
})
