import { gmail_v1 } from 'googleapis'
import { prisma } from '@/lib/db/prisma'

/**
 * Advanced reply detection using envelope matching, subject analysis, and thread context
 */
export class ReplyDetectionService {
  /**
   * Check if a Gmail message is a reply to a previously sent email
   */
  static async detectReply(
    userId: string,
    message: gmail_v1.Schema$Message
  ): Promise<{
    isReply: boolean
    confidence: number
    matchedEmailId?: string
    matchType: 'subject_match' | 'thread_match' | 'address_match' | 'none'
  }> {
    if (!message.payload || !message.id) {
      return { isReply: false, confidence: 0, matchType: 'none' }
    }

    const headers = message.payload.headers || []
    const from = this.getHeader(headers, 'from')
    const to = this.getHeader(headers, 'to')
    const subject = this.getHeader(headers, 'subject')
    const inReplyTo = this.getHeader(headers, 'in-reply-to')
    const references = this.getHeader(headers, 'references')
    const messageId = this.getHeader(headers, 'message-id')

    // Strategy 1: In-Reply-To header (most reliable)
    if (inReplyTo) {
      const matchedEmail = await prisma.outreachEmail.findFirst({
        where: {
          userId,
          gmailMessageId: inReplyTo.replace(/[<>]/g, '')
        }
      })
      if (matchedEmail) {
        return {
          isReply: true,
          confidence: 0.99,
          matchedEmailId: matchedEmail.id,
          matchType: 'thread_match'
        }
      }
    }

    // Strategy 2: Subject line matching
    if (subject) {
      const replySubjectMatch = this.analyzeSubjectMatch(subject)
      if (replySubjectMatch.isReply) {
        const originalSubject = replySubjectMatch.originalSubject
        const matchedEmail = await prisma.outreachEmail.findFirst({
          where: {
            userId,
            status: { in: ['SENT', 'DELIVERED'] },
            subject: {
              contains: originalSubject
            }
          },
          orderBy: { createdAt: 'desc' }
        })

        if (matchedEmail && from) {
          return {
            isReply: true,
            confidence: 0.85,
            matchedEmailId: matchedEmail.id,
            matchType: 'subject_match'
          }
        }
      }
    }

    // Strategy 3: Address matching with time proximity
    if (from && to) {
      const fromEmail = this.extractEmail(from)
      const toEmail = this.extractEmail(to)

      if (fromEmail && toEmail) {
        const outreachEmail = await prisma.outreachEmail.findFirst({
          where: {
            userId,
            to: fromEmail,
            status: { in: ['SENT', 'DELIVERED'] }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        })

        if (outreachEmail) {
          // Check time proximity (reply should come within 30 days)
          const messageDate = message.internalDate
            ? new Date(parseInt(message.internalDate))
            : new Date()
          const daysSinceSend = Math.floor(
            (messageDate.getTime() - outreachEmail.createdAt.getTime()) /
              (1000 * 60 * 60 * 24)
          )

          if (daysSinceSend > 0 && daysSinceSend <= 30) {
            return {
              isReply: true,
              confidence: 0.7,
              matchedEmailId: outreachEmail.id,
              matchType: 'address_match'
            }
          }
        }
      }
    }

    return { isReply: false, confidence: 0, matchType: 'none' }
  }

  /**
   * Analyze email subject for reply indicators
   */
  private static analyzeSubjectMatch(subject: string): {
    isReply: boolean
    originalSubject: string
  } {
    // Common reply prefixes
    const replyPrefixes = ['re:', 're :', 'fwd:', 'fwd :', 'fw:']
    const lowerSubject = subject.toLowerCase().trim()

    for (const prefix of replyPrefixes) {
      if (lowerSubject.startsWith(prefix)) {
        const originalSubject = subject
          .substring(prefix.length)
          .trim()
          .replace(/^(\[.*?\])\s*/, '') // Remove bracketed prefixes

        return {
          isReply: true,
          originalSubject
        }
      }
    }

    return { isReply: false, originalSubject: subject }
  }

  /**
   * Extract email address from "Name <email@example.com>" format
   */
  private static extractEmail(addressString: string): string | null {
    const match = addressString.match(/<(.+?)>/)
    if (match) return match[1]

    // Fallback: try to parse as plain email
    const emailMatch = addressString.match(/[\w.-]+@[\w.-]+\.\w+/)
    return emailMatch ? emailMatch[0] : null
  }

  /**
   * Get header value from Gmail headers array
   */
  private static getHeader(
    headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
    name: string
  ): string | undefined {
    if (!headers) return undefined
    const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase())
    return header?.value || undefined
  }

  /**
   * Analyze sentiment of reply message
   */
  static analyzeSentiment(text: string): {
    sentiment: 'positive' | 'neutral' | 'negative'
    score: number
  } {
    const positiveKeywords = [
      'interested',
      'great',
      'excellent',
      'love',
      'amazing',
      'perfect',
      'yes',
      'absolutely',
      'definitely',
      'impressive',
      'please send',
      'looking forward',
      'excited'
    ]

    const negativeKeywords = [
      'not interested',
      'no thanks',
      'unsubscribe',
      'remove',
      'spam',
      'bad',
      'terrible',
      'worst',
      'annoyed',
      'frustrated',
      'disappointed',
      'never'
    ]

    const lowerText = text.toLowerCase()
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral'
    let score = 0

    positiveKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        score += 1
        sentiment = 'positive'
      }
    })

    negativeKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        score -= 1
        sentiment = 'negative'
      }
    })

    // Normalize score to -1 to 1
    if (score > 0) sentiment = 'positive'
    if (score < 0) sentiment = 'negative'
    if (score === 0) sentiment = 'neutral'

    return {
      sentiment,
      score: Math.max(-1, Math.min(1, score / 5))
    }
  }

  /**
   * Classify reply type based on content analysis
   */
  static classifyReplyType(text: string): 
    | 'positive_interest'
    | 'negative_uninterested'
    | 'question'
    | 'objection'
    | 'generic' {
    const lowerText = text.toLowerCase()

    // Check for questions
    if (text.includes('?')) {
      return 'question'
    }

    // Check for objections
    if (
      lowerText.includes('concerned') ||
      lowerText.includes('worried') ||
      lowerText.includes('issue') ||
      lowerText.includes('problem')
    ) {
      return 'objection'
    }

    // Check for positive interest
    if (
      lowerText.includes('interested') ||
      lowerText.includes('yes') ||
      lowerText.includes('let\'s')
    ) {
      return 'positive_interest'
    }

    // Check for negative
    if (
      lowerText.includes('not interested') ||
      lowerText.includes('no thanks') ||
      lowerText.includes('unsubscribe')
    ) {
      return 'negative_uninterested'
    }

    return 'generic'
  }
}
