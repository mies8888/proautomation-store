import { NextRequest, NextResponse } from 'next/server'
import { GmailWebhookService } from '@/services/gmail/webhooks'
import { google } from 'googleapis'
import { prisma } from '@/lib/db/prisma'
import { AppError } from '@/lib/errors/handler'

/**
 * Cloud Pub/Sub webhook receiver for Gmail push notifications
 * Receives messages when new emails arrive or mailbox changes
 * Message format: {
 *   "message": {
 *     "data": "base64_encoded_json"
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify request is valid
    if (req.method !== 'POST') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
      )
    }

    const body = await req.json()

    // Validate Pub/Sub message structure
    if (!body.message?.data) {
      console.warn('Invalid Pub/Sub message structure:', body)
      return NextResponse.json(
        { success: true, message: 'Message received' },
        { status: 200 }
      )
    }

    // Decode base64 message data
    let decodedData: any
    try {
      const decodedString = Buffer.from(body.message.data, 'base64').toString('utf-8')
      decodedData = JSON.parse(decodedString)
    } catch (error) {
      console.error('Failed to decode Pub/Sub message:', error)
      return NextResponse.json(
        { success: true, message: 'Message received' },
        { status: 200 }
      )
    }

    const { emailAddress, historyId } = decodedData

    if (!emailAddress || !historyId) {
      console.warn('Missing required fields in notification:', decodedData)
      return NextResponse.json(
        { success: true, message: 'Message received' },
        { status: 200 }
      )
    }

    console.log(`Gmail webhook: New notification for ${emailAddress} (historyId: ${historyId})`)

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: emailAddress }
    })

    if (!user) {
      console.warn(`No user found for email ${emailAddress}`)
      return NextResponse.json(
        { success: true, message: 'User not found' },
        { status: 200 }
      )
    }

    // Get user's Gmail account
    const gmailAccount = await prisma.account.findFirst({
      where: {
        userId: user.id,
        provider: 'google'
      }
    })

    if (!gmailAccount) {
      console.warn(`No Gmail account found for user ${user.id}`)
      return NextResponse.json(
        { success: true, message: 'Gmail account not found' },
        { status: 200 }
      )
    }

    // Create Gmail client with user's credentials
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

    // Process webhook notification
    const webhookService = new GmailWebhookService(gmail)
    await webhookService.processWebhookNotification({
      emailAddress,
      historyId
    })

    // Update sync history ID
    await prisma.account.update({
      where: { id: gmailAccount.id },
      data: { syncHistoryId: historyId }
    })

    // Log webhook event
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'GMAIL_WEBHOOK_RECEIVED',
        metadata: {
          emailAddress,
          historyId,
          timestamp: new Date().toISOString()
        }
      }
    })

    return NextResponse.json(
      { success: true, message: 'Webhook processed' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Webhook error:', error)
    
    // Always return 200 to Pub/Sub to prevent redelivery attempts
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 200 }
    )
  }
}

/**
 * GET - Health check for webhook endpoint
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Gmail webhook endpoint is running',
    timestamp: new Date().toISOString()
  })
}
