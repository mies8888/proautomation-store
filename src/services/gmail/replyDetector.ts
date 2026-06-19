/**
 * Reply detection service for Gmail
 * Detects and processes replies to outreach emails
 */

import { gmail_v1, google } from 'googleapis'
import { prisma } from '@/lib/db/prisma'

interface ReplyMessage {
  id: string
  threadId: string
  from: string
  fromName?: string
  subject: string
  body: string
  htmlBody?: string
  receivedAt: Date
  inReplyTo?: string
}

interface DetectedReply {
  outreachEmailId: string
  replyMessage: ReplyMessage
  matchScore: number // 0-100 confidence score
  matched: boolean
}

export class ReplyDetectorService {
  private gmail: gmail_v1.Gmail

  constructor(gmail: gmail_v1.Gmail) {
    this.gmail = gmail
  }

  /**
   * Detect all replies to sent emails from a user's inbox
   */
  async detectReplies(userId: string): Promise<DetectedReply[]> {
    try {
      // Get all outreach emails that are sent but not yet marked as replied
      const sentEmails = await prisma.outreachEmail.findMany({
        where: {
          userId,
          status: 'SENT',
          gmailMessageId: {
            not: null
          }
        },
        include: { lead: true }
      })

      if (sentEmails.length === 0) {
        return []
      }

      // Fetch recent inbox messages
      const inboxMessages = await this.fetchInboxMessages()
      
      const detectedReplies: DetectedReply[] = []

      // Match each inbox message to outreach emails
      for (const message of inboxMessages) {
        const match = this.findMatchingOutreachEmail(
          message,
          sentEmails
        )

        if (match) {
          detectedReplies.push({
            outreachEmailId: match.outreachEmailId,
            replyMessage: message,
            matchScore: match.score,
            matched: match.score >= 70 // 70+ is confident match
          })
        }
      }

      return detectedReplies
    } catch (error) {
      console.error('Error detecting replies:', error)
      throw error
    }
  }

  /**
   * Process a detected reply and update database
   */
  async processReply(
    outreachEmailId: string,
    replyMessage: ReplyMessage
  ): Promise<void> {
    try {
      const outreachEmail = await prisma.outreachEmail.findUnique({
        where: { id: outreachEmailId },
        include: { lead: true }
      })

      if (!outreachEmail) {
        return
      }

      // Update outreach email status
      await prisma.outreachEmail.update({
        where: { id: outreachEmailId },
        data: {
          status: 'REPLIED'
        }
      })

      // Create activity log
      await prisma.activityLog.create({
        data: {
          userId: outreachEmail.userId,
          leadId: outreachEmail.leadId,
          action: 'EMAIL_REPLY_RECEIVED',
          metadata: {
            outreachEmailId,
            fromEmail: replyMessage.from,
            fromName: replyMessage.fromName,
            subject: replyMessage.subject,
            gmailThreadId: replyMessage.threadId,
            sentiment: this.detectSentiment(replyMessage.body)
          }
        }
      })

      // Update lead engagement scores
      if (outreachEmail.lead) {
        const sentiment = this.detectSentiment(replyMessage.body)
        
        await prisma.lead.update({
          where: { id: outreachEmail.leadId },
          data: {
            // Boost contactability score significantly (replied!)
            contactabilityScore: Math.min(100, outreachEmail.lead.contactabilityScore + 25),
            // Boost conversion probability
            conversionProbabilityScore: Math.min(100, outreachEmail.lead.conversionProbabilityScore + 15),
            // Update status if it was CONTACTED
            ...(outreachEmail.lead.status === 'CONTACTED' && {
              status: 'ENGAGED'
            })
          }
        })
      }
    } catch (error) {
      console.error('Error processing reply:', error)
      throw error
    }
  }

  /**
   * Fetch recent inbox messages (last 7 days, unread primarily)
   */
  private async fetchInboxMessages(): Promise<ReplyMessage[]> {
    try {
      // Query for recent emails (last 7 days)
      const query = 'newer_than:7d is:unread'
      
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100,
        fields: 'messages(id,threadId),nextPageToken'
      })

      if (!response.data.messages || response.data.messages.length === 0) {
        return []
      }

      const messages: ReplyMessage[] = []

      // Fetch full details for each message
      for (const msg of response.data.messages) {
        if (!msg.id) continue

        try {
          const fullMessage = await this.gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full',
            fields: 'payload(headers,mimeType,parts,body),id,threadId'
          })

          if (fullMessage.data && fullMessage.data.payload) {
            const parsed = this.parseMessage(
              fullMessage.data.payload,
              fullMessage.data.id || '',
              fullMessage.data.threadId || ''
            )

            if (parsed) {
              messages.push(parsed)
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch message ${msg.id}:`, err)
        }
      }

      return messages
    } catch (error) {
      console.error('Error fetching inbox messages:', error)
      return []
    }
  }

  /**
   * Parse email message from Gmail payload
   */
  private parseMessage(
    payload: any,
    messageId: string,
    threadId: string
  ): ReplyMessage | null {
    try {
      const headers = payload.headers || []
      const getHeader = (name: string) =>
        headers.find((h: any) => h.name === name)?.value || ''

      const from = getHeader('From')
      const subject = getHeader('Subject')
      const date = getHeader('Date')
      
      if (!from || !subject) {
        return null
      }

      // Parse "Name <email@example.com>" format
      const emailMatch = from.match(/<([^>]+)>/)
      const email = emailMatch ? emailMatch[1] : from
      const nameMatch = from.match(/^([^<]+)</)
      const name = nameMatch ? nameMatch[1].trim() : undefined

      // Get body
      let body = ''
      let htmlBody = ''

      if (payload.body?.data) {
        body = Buffer.from(payload.body.data, 'base64').toString('utf-8')
        htmlBody = body
      } else if (payload.parts) {
        // Multipart message
        for (const part of payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8')
          } else if (part.mimeType === 'text/html' && part.body?.data) {
            htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8')
          }
        }
      }

      return {
        id: messageId,
        threadId,
        from: email,
        fromName: name,
        subject,
        body: body.substring(0, 5000), // Limit body size
        htmlBody: htmlBody.substring(0, 10000),
        receivedAt: new Date(date),
        inReplyTo: getHeader('In-Reply-To') || undefined
      }
    } catch (error) {
      console.warn('Error parsing message:', error)
      return null
    }
  }

  /**
   * Match inbox message to outreach email
   * Uses subject line and sender domain matching
   */
  private findMatchingOutreachEmail(
    inboxMessage: ReplyMessage,
    sentEmails: any[]
  ): { outreachEmailId: string; score: number } | null {
    let bestMatch: { outreachEmailId: string; score: number } | null = null

    for (const outreach of sentEmails) {
      let score = 0

      // Check if subject contains part of original subject (50 pts)
      const originalSubject = outreach.subject.toLowerCase()
      const inboxSubject = inboxMessage.subject.toLowerCase()
      
      if (originalSubject && inboxSubject.includes(originalSubject.substring(0, 20))) {
        score += 40
      }
      
      // Bonus if "Re:" indicates reply (25 pts)
      if (inboxSubject.startsWith('re:')) {
        score += 25
      }

      // Check if sender email matches recipient (but on same thread) (30 pts)
      // This is looser - we're checking if it's the company replying
      if (inboxMessage.from && outreach.to) {
        const inboxDomain = inboxMessage.from.split('@')[1]?.toLowerCase()
        const outreachDomain = outreach.to.split('@')[1]?.toLowerCase()
        
        if (inboxDomain && outreachDomain && inboxDomain === outreachDomain) {
          score += 30
        }
      }

      // Check if thread ID matches (if available)
      if (inboxMessage.inReplyTo && outreach.gmailMessageId === inboxMessage.inReplyTo) {
        score = 100 // Perfect match
      }

      // Thread ID from Gmail (if available)
      if (inboxMessage.threadId && outreach.externalThreadId === inboxMessage.threadId) {
        score = Math.max(score, 95) // Very confident
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = {
          outreachEmailId: outreach.id,
          score
        }
      }
    }

    return bestMatch
  }

  /**
   * Simple sentiment analysis based on keywords
   */
  private detectSentiment(text: string): string {
    const lowerText = text.toLowerCase()

    // Positive indicators
    const positiveKeywords = [
      'interested',
      'love',
      'great',
      'excellent',
      'perfect',
      'awesome',
      'impressed',
      'yes',
      'definitely',
      'absolutely',
      'would love',
      'sounds good',
      'exciting',
      'thank you',
      'thanks',
      'perfect timing'
    ]

    // Negative indicators
    const negativeKeywords = [
      'not interested',
      'unsubscribe',
      'stop',
      'remove me',
      'don\'t want',
      'spam',
      'irrelevant',
      'wrong person',
      'no thanks',
      'not for us'
    ]

    const positiveMatches = positiveKeywords.filter(kw => lowerText.includes(kw)).length
    const negativeMatches = negativeKeywords.filter(kw => lowerText.includes(kw)).length

    if (negativeMatches > positiveMatches) {
      return 'NEGATIVE'
    } else if (positiveMatches > 0) {
      return 'POSITIVE'
    }

    return 'NEUTRAL'
  }

  /**
   * Static factory method to create reply detector for a user
   */
  static async create(userId: string): Promise<ReplyDetectorService | null> {
    try {
      const account = await prisma.account.findFirst({
        where: { userId, provider: 'google' }
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
        access_token: account.access_token
      })

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
      return new ReplyDetectorService(gmail)
    } catch (error) {
      console.error('Error creating reply detector:', error)
      return null
    }
  }
}

/**
 * Batch detect and process all replies for a user
 */
export async function detectAndProcessReplies(userId: string): Promise<number> {
  try {
    const detector = await ReplyDetectorService.create(userId)
    if (!detector) {
      console.warn(`No Gmail connection found for user ${userId}`)
      return 0
    }

    const replies = await detector.detectReplies(userId)
    let processedCount = 0

    for (const detected of replies) {
      if (detected.matched) {
        await detector.processReply(detected.outreachEmailId, detected.replyMessage)
        processedCount++
      }
    }

    return processedCount
  } catch (error) {
    console.error('Error in detectAndProcessReplies:', error)
    return 0
  }
}
