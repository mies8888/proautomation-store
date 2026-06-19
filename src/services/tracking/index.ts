import crypto from 'crypto'

/**
 * Email engagement tracking service
 * Handles pixel tracking for opens and link click tracking
 */

interface TrackingPixelResult {
  pixelUrl: string
  trackingId: string
}

interface TrackedLinkResult {
  trackedUrl: string
  trackingId: string
}

export class TrackingService {
  /**
   * Generate a tracking pixel URL for email open tracking
   * Returns a 1x1 transparent GIF URL that logs when viewed
   */
  static generateTrackingPixel(
    emailId: string,
    userId: string,
    baseUrl: string = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  ): TrackingPixelResult {
    const trackingId = this.generateTrackingId(emailId, userId)
    
    const pixelUrl = `${baseUrl}/api/analytics/track?id=${trackingId}&type=open&email=${emailId}`
    
    return {
      pixelUrl,
      trackingId,
    }
  }

  /**
   * Wrap a URL with click tracking
   * When clicked, logs the click before redirecting to the original URL
   */
  static generateTrackedLink(
    originalUrl: string,
    emailId: string,
    userId: string,
    baseUrl: string = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  ): TrackedLinkResult {
    const trackingId = this.generateTrackingId(emailId, userId)
    const encodedUrl = Buffer.from(originalUrl).toString('base64')
    
    const trackedUrl = `${baseUrl}/api/analytics/track?id=${trackingId}&type=click&url=${encodedUrl}`
    
    return {
      trackedUrl,
      trackingId,
    }
  }

  /**
   * Generate a unique tracking ID for this event
   */
  private static generateTrackingId(emailId: string, userId: string): string {
    const data = `${emailId}-${userId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16)
  }

  /**
   * Inject tracking into email HTML content
   * - Adds pixel at the end of the email
   * - Wraps all links for click tracking
   */
  static injectTracking(
    htmlContent: string,
    emailId: string,
    userId: string,
    baseUrl?: string
  ): string {
    // Generate tracking pixel
    const { pixelUrl } = this.generateTrackingPixel(emailId, userId, baseUrl)
    
    // Add tracking pixel before closing body tag
    const pixelHtml = `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none;" />`
    let result = htmlContent
    
    if (htmlContent.includes('</body>')) {
      result = htmlContent.replace('</body>', `${pixelHtml}</body>`)
    } else {
      result = `${htmlContent}${pixelHtml}`
    }

    // Wrap all links for click tracking
    const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]+)"([^>]*)>/gi
    result = result.replace(linkRegex, (match, href, rest) => {
      // Skip anchor links and email links
      if (href.startsWith('#') || href.startsWith('mailto:')) {
        return match
      }

      const { trackedUrl } = this.generateTrackedLink(href, emailId, userId, baseUrl)
      return `<a href="${trackedUrl}"${rest}>`
    })

    return result
  }

  /**
   * Create tracking pixel as actual 1x1 GIF image
   * Used when returning as image/gif content type
   */
  static createTrackingPixelGif(): Buffer {
    // 1x1 transparent GIF
    return Buffer.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
      0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00,
      0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
      0x01, 0x00, 0x3b,
    ])
  }
}

/**
 * Tracking ID storage (in-memory for MVP, should use Redis in production)
 */
export class TrackingStore {
  private static trackedIds = new Map<string, { timestamp: number; type: string }>()
  private static EXPIRY_TIME = 24 * 60 * 60 * 1000 // 24 hours

  static recordTracking(trackingId: string, type: 'open' | 'click'): void {
    this.trackedIds.set(trackingId, {
      timestamp: Date.now(),
      type,
    })

    // Clean up old entries every hour
    if (this.trackedIds.size > 10000) {
      this.cleanupExpired()
    }
  }

  static hasBeenTracked(trackingId: string): boolean {
    const entry = this.trackedIds.get(trackingId)
    return !!entry && Date.now() - entry.timestamp < this.EXPIRY_TIME
  }

  static getTrackingType(trackingId: string): 'open' | 'click' | null {
    const entry = this.trackedIds.get(trackingId)
    return entry ? (entry.type as 'open' | 'click') : null
  }

  private static cleanupExpired(): void {
    const now = Date.now()
    for (const [id, entry] of this.trackedIds) {
      if (now - entry.timestamp > this.EXPIRY_TIME) {
        this.trackedIds.delete(id)
      }
    }
  }
}
