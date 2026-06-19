/**
 * Gmail webhook tracking service
 * Implements Gmail Push notifications for engagement tracking
 * Uses Cloud Pub/Sub to receive real-time notifications
 */

import { gmail_v1 } from 'googleapis'
import { prisma } from '@/lib/db/prisma'
import { TrackingService } from '@/services/tracking'

export class GmailWebhookService {
  private gmail: gmail_v1.Gmail

  constructor(gmail: gmail_v1.Gmail) {
    this.gmail = gmail
  }

  /**
   * Setup Gmail push notifications (webhooks)
   * Requires Cloud Pub/Sub topic and subscription configured
   */
  async setupPushNotifications(userId: string, topicName: string): Promise<void> {
    try {
      // Watch the user's mailbox for changes
      const response = await this.gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: topicName, // e.g., 'projects/PROJECT_ID/topics/gmail-notifications'
          labelIds: ['SENT'], // Only watch sent emails
          labelFilterBehavior: 'include',
        },
      })

      if (response.data.historyId) {
        // Save the initial history ID
        const account = await prisma.account.findFirst({
          where: { userId, provider: 'google' },
        })

        if (account) {
          await prisma.account.update({
            where: { id: account.id },
            data: { syncHistoryId: response.data.historyId },
          })
        }
      }

      console.log(`Gmail push notifications enabled for user ${userId}`)
    } catch (error) {
      console.error('Error setting up Gmail webhooks:', error)
      throw error
    }
  }

  /**
   * Process incoming webhook notification from Cloud Pub/Sub
   * Message format: { emailAddress: string, historyId: string }
   */
  async processWebhookNotification(message: any): Promise<void> {
    try {
      const emailAddress = message.emailAddress
      const historyId = message.historyId

      if (!emailAddress || !historyId) {
        console.warn('Invalid webhook notification', message)
        return
      }

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: emailAddress },
      })

      if (!user) {
        console.warn(`No user found for email ${emailAddress}`)
        return
      }

      // Get Gmail client for user
      const account = await prisma.account.findFirst({
        where: { userId: user.id, provider: 'google' },
      })

      if (!account) {
        console.warn(`No Gmail account found for user ${user.id}`)
        return
      }

      // Note: In production, you'd fetch the actual gmail client
      // For now, we'll just log the event
      console.log(`Webhook notification for ${emailAddress} at history ${historyId}`)

      // Log tracking event
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'GMAIL_WEBHOOK',
          metadata: {
            historyId,
          },
        },
      })
    } catch (error) {
      console.error('Error processing webhook notification:', error)
      throw error
    }
  }

  /**
   * Track email open events from Gmail
   * Called when tracking pixel is accessed (from /api/analytics/track)
   */
  async trackEmailOpen(emailId: string, userId: string): Promise<void> {
    try {
      const email = await prisma.outreachEmail.findUnique({
        where: { id: emailId },
      })

      if (!email) {
        return
      }

      // Log the open event
      await prisma.activityLog.create({
        data: {
          userId,
          leadId: email.leadId,
          action: 'EMAIL_OPENED',
          metadata: {
            emailId,
            subject: email.subject,
            recipient: email.to,
          },
        },
      })

      // Increase email engagement score
      const lead = await prisma.lead.findUnique({
        where: { id: email.leadId },
      })

      if (lead) {
        // Bump up contact engagement score
        const newScore = Math.min(100, lead.contactabilityScore + 10)
        await prisma.lead.update({
          where: { id: email.leadId },
          data: { contactabilityScore: newScore },
        })
      }
    } catch (error) {
      console.error('Error tracking email open:', error)
    }
  }

  /**
   * Track email click events
   * Called from wrapped tracking URL (from /api/analytics/track?type=click)
   */
  async trackEmailClick(emailId: string, userId: string, originalUrl: string): Promise<void> {
    try {
      const email = await prisma.outreachEmail.findUnique({
        where: { id: emailId },
      })

      if (!email) {
        return
      }

      // Log the click event
      await prisma.activityLog.create({
        data: {
          userId,
          leadId: email.leadId,
          action: 'EMAIL_CLICKED',
          metadata: {
            emailId,
            subject: email.subject,
            recipient: email.to,
            clickedUrl: originalUrl,
          },
        },
      })

      // Increase engagement and conversion potential
      const lead = await prisma.lead.findUnique({
        where: { id: email.leadId },
      })

      if (lead) {
        // Bump up conversion probability score
        const newScore = Math.min(100, lead.conversionProbabilityScore + 20)
        await prisma.lead.update({
          where: { id: email.leadId },
          data: { conversionProbabilityScore: newScore },
        })
      }
    } catch (error) {
      console.error('Error tracking email click:', error)
    }
  }

  /**
   * Track bounce events
   * Detected via Gmail labels or bounce notifications
   */
  async trackEmailBounce(emailId: string, userId: string, bounceType: 'hard' | 'soft'): Promise<void> {
    try {
      const email = await prisma.outreachEmail.findUnique({
        where: { id: emailId },
      })

      if (!email) {
        return
      }

      // Update email status
      await prisma.outreachEmail.update({
        where: { id: emailId },
        data: { status: 'BOUNCED' },
      })

      // Log bounce event
      await prisma.activityLog.create({
        data: {
          userId,
          leadId: email.leadId,
          action: `EMAIL_BOUNCED (${bounceType}): ${email.subject}`,
          metadata: {
            emailId,
            bounceType,
            recipient: email.to,
          },
        },
      })

      // Decrease contact engagement score for hard bounces
      const lead = await prisma.lead.findUnique({
        where: { id: email.leadId },
      })

      if (lead && bounceType === 'hard') {
        const newScore = Math.max(0, lead.contactabilityScore - 50)
        await prisma.lead.update({
          where: { id: email.leadId },
          data: { contactabilityScore: newScore },
        })
      }
    } catch (error) {
      console.error('Error tracking email bounce:', error)
    }
  }

  /**
   * Track email spam complaints
   */
  async trackSpamComplaint(emailId: string, userId: string): Promise<void> {
    try {
      const email = await prisma.outreachEmail.findUnique({
        where: { id: emailId },
      })

      if (!email) {
        return
      }

      // Update email status
      await prisma.outreachEmail.update({
        where: { id: emailId },
        data: { status: 'SPAM_COMPLAINT' },
      })

      // Log event
      await prisma.activityLog.create({
        data: {
          userId,
          leadId: email.leadId,
          action: `SPAM_COMPLAINT: ${email.subject}`,
          metadata: {
            emailId,
            recipient: email.to,
          },
        },
      })

      // Significantly decrease engagement scores
      const lead = await prisma.lead.findUnique({
        where: { id: email.leadId },
      })

      if (lead) {
        await prisma.lead.update({
          where: { id: email.leadId },
          data: {
            contactabilityScore: Math.max(0, lead.contactabilityScore - 100),
            conversionProbabilityScore: Math.max(0, lead.conversionProbabilityScore - 50),
          },
        })
      }
    } catch (error) {
      console.error('Error tracking spam complaint:', error)
    }
  }
}

/**
 * Setup engagement tracking middleware
 * This integrates with the existing tracking service
 */
export async function setupEngagementTracking() {
  // This would be called during application initialization
  // to set up Cloud Pub/Sub listeners and tracking handlers
  console.log('Engagement tracking service initialized')
}
