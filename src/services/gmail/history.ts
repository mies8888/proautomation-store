/**
 * Gmail history sync service
 * Polls Gmail API to sync sent emails and track their status
 */

import { gmail_v1, google } from 'googleapis'
import { prisma } from '@/lib/db/prisma'

export class GmailHistorySyncService {
  private gmail: gmail_v1.Gmail

  constructor(gmail: gmail_v1.Gmail) {
    this.gmail = gmail
  }

  /**
   * Sync sent emails from Gmail to database
   * Poll every 30 minutes to fetch new sent emails
   */
  async syncSentEmails(userId: string): Promise<void> {
    try {
      // Get the user's last sync timestamp
      const account = await prisma.account.findFirst({
        where: { userId, provider: 'google' },
      })

      if (!account) {
        console.warn(`No Google account found for user ${userId}`)
        return
      }

      // Fetch all sent emails since last sync
      const historyId = account.syncHistoryId || '1'
      const response = await this.gmail.users.history.list({
        userId: 'me',
        startHistoryId: historyId,
        fields: 'history(messages(id,threadId,labelIds),labelsAdded)',
      })

      if (!response.data.history) {
        return
      }

      // Process each history item
      for (const history of response.data.history) {
        if (history.messages) {
          for (const message of history.messages) {
            // Check if this is a sent email
            const labels = history.labelsAdded?.[0]?.labelIds || []
            const isSent = labels.includes('SENT') || message.labelIds?.includes('SENT')

            if (isSent && message.id) {
              await this.processSentEmail(userId, message.id)
            }
          }
        }
      }

      // Update last sync history ID
      if (response.data.historyId) {
        await prisma.account.update({
          where: { id: account.id },
          data: { syncHistoryId: response.data.historyId },
        })
      }
    } catch (error) {
      console.error('Error syncing Gmail history:', error)
      throw error
    }
  }

  /**
   * Process a single sent email message
   */
  private async processSentEmail(userId: string, messageId: string): Promise<void> {
    try {
      const message = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      })

      if (!message.data || !message.data.payload) {
        return
      }

      const headers = message.data.payload.headers || []
      const getHeader = (name: string) =>
        headers.find(h => h.name === name)?.value || ''

      const to = getHeader('To')
      const subject = getHeader('Subject')
      const sentDate = new Date(getHeader('Date'))

      // Check if this email corresponds to an OutreachEmail record
      const outreachEmail = await prisma.outreachEmail.findFirst({
        where: {
          to: to,
          subject: subject,
        },
      })

      if (outreachEmail) {
        // Update the email status to sent
        await prisma.outreachEmail.update({
          where: { id: outreachEmail.id },
          data: {
            sentAt: sentDate,
            status: 'SENT',
            gmailMessageId: messageId,
          },
        })

        // Log activity
        await prisma.activityLog.create({
          data: {
            userId,
            leadId: outreachEmail.leadId,
            action: 'EMAIL_SENT',
            metadata: {
              gmailMessageId: messageId,
              subject,
              recipient: to,
            },
          },
        })
      }
    } catch (error) {
      console.error(`Error processing sent email ${messageId}:`, error)
      // Don't throw - continue processing other emails
    }
  }

  /**
   * Check email delivery status by polling Gmail labels
   * Detects bounces, spam, etc.
   */
  async checkEmailStatus(gmailMessageId: string): Promise<string> {
    try {
      const message = await this.gmail.users.messages.get({
        userId: 'me',
        id: gmailMessageId,
      })

      const labels = message.data.labelIds || []

      // Check for delivery failure indicators
      if (
        labels.includes('SPAM') ||
        labels.includes('TRASH') ||
        labels.includes('DRAFT')
      ) {
        return 'BOUNCED'
      }

      // Check for read status (indicates at least delivered)
      if (labels.includes('UNREAD')) {
        return 'SENT_UNREAD'
      }

      return 'SENT'
    } catch (error) {
      console.error(`Error checking email status for ${gmailMessageId}:`, error)
      return 'UNKNOWN'
    }
  }

  /**
   * Create Gmail client for user
   */
  static async createGmailClient(userId: string): Promise<gmail_v1.Gmail | null> {
    try {
      const account = await prisma.account.findFirst({
        where: { userId, provider: 'google' },
      })

      if (!account) {
        return null
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/callback/google`
      )

      oauth2Client.setCredentials({
        refresh_token: account.refresh_token,
        access_token: account.access_token,
      })

      return google.gmail({ version: 'v1', auth: oauth2Client })
    } catch (error) {
      console.error(`Error creating Gmail client for user ${userId}:`, error)
      return null
    }
  }

  /**
   * Start a background job that syncs every 30 minutes
   */
  static startBackgroundSync(userId: string, gmail: gmail_v1.Gmail) {
    const service = new GmailHistorySyncService(gmail)

    // Initial sync
    service.syncSentEmails(userId).catch(error => {
      console.error('Initial Gmail sync failed:', error)
    })

    // Schedule periodic syncs every 30 minutes
    const interval = setInterval(() => {
      service.syncSentEmails(userId).catch(error => {
        console.error('Scheduled Gmail sync failed:', error)
      })
    }, 30 * 60 * 1000) // 30 minutes

    // Return a function to stop the sync
    return () => clearInterval(interval)
  }
}

/**
 * Initialize Gmail history sync for all users with Google accounts
 */
export async function initializeGmailHistorySyncForAllUsers() {
  try {
    // Get all users with Gmail connected
    const accounts = await prisma.account.findMany({
      where: { provider: 'google' },
      include: { user: true },
    })

    for (const account of accounts) {
      try {
        const gmail = await GmailHistorySyncService.createGmailClient(account.user.id)
        if (gmail) {
          GmailHistorySyncService.startBackgroundSync(account.user.id, gmail)
        }
      } catch (error) {
        console.error(`Failed to start sync for user ${account.user.id}:`, error)
      }
    }
  } catch (error) {
    console.error('Error initializing Gmail history sync:', error)
  }
}
