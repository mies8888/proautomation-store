/**
 * Tests for tracking service
 */

import { TrackingService, TrackingStore } from '@/services/tracking'

describe('TrackingService', () => {
  describe('generateTrackingPixel', () => {
    it('should generate tracking pixel URL', () => {
      const result = TrackingService.generateTrackingPixel('email-id', 'user-id')
      
      expect(result.pixelUrl).toContain('/api/analytics/track')
      expect(result.pixelUrl).toContain('type=open')
      expect(result.pixelUrl).toContain('email=email-id')
      expect(result.trackingId).toBeTruthy()
      expect(result.trackingId.length).toBe(16)
    })

    it('should generate unique tracking IDs', () => {
      const result1 = TrackingService.generateTrackingPixel('email-1', 'user-1')
      const result2 = TrackingService.generateTrackingPixel('email-1', 'user-1')
      
      expect(result1.trackingId).not.toBe(result2.trackingId)
    })
  })

  describe('generateTrackedLink', () => {
    it('should wrap URL with tracking', () => {
      const originalUrl = 'https://example.com/article'
      const result = TrackingService.generateTrackedLink(originalUrl, 'email-id', 'user-id')
      
      expect(result.trackedUrl).toContain('/api/analytics/track')
      expect(result.trackedUrl).toContain('type=click')
      expect(result.trackingId).toBeTruthy()
    })

    it('should base64 encode the original URL', () => {
      const originalUrl = 'https://example.com'
      const result = TrackingService.generateTrackedLink(originalUrl, 'email-id', 'user-id')
      
      const urlParam = new URL(result.trackedUrl).searchParams.get('url')
      expect(urlParam).toBeTruthy()
      const decoded = Buffer.from(urlParam || '', 'base64').toString('utf-8')
      expect(decoded).toBe(originalUrl)
    })
  })

  describe('injectTracking', () => {
    it('should inject tracking pixel into HTML', () => {
      const html = '<html><body><p>Test</p></body></html>'
      const result = TrackingService.injectTracking(html, 'email-id', 'user-id')
      
      expect(result).toContain('<img')
      expect(result).toContain('type=open')
      expect(result).toContain('display:none')
    })

    it('should wrap links with tracking', () => {
      const html = '<a href="https://example.com">Link</a>'
      const result = TrackingService.injectTracking(html, 'email-id', 'user-id')
      
      expect(result).toContain('/api/analytics/track')
      expect(result).toContain('type=click')
    })

    it('should skip anchor links', () => {
      const html = '<a href="#section">Anchor</a>'
      const result = TrackingService.injectTracking(html, 'email-id', 'user-id')
      
      expect(result).toContain('href="#section"')
    })

    it('should skip mailto links', () => {
      const html = '<a href="mailto:test@example.com">Email</a>'
      const result = TrackingService.injectTracking(html, 'email-id', 'user-id')
      
      expect(result).toContain('href="mailto:test@example.com"')
    })
  })

  describe('createTrackingPixelGif', () => {
    it('should return a valid GIF buffer', () => {
      const gif = TrackingService.createTrackingPixelGif()
      
      expect(gif).toBeInstanceOf(Buffer)
      expect(gif.length).toBeGreaterThan(0)
      // GIF header is always "GIF89a" or "GIF87a"
      expect(gif.toString('ascii', 0, 3)).toBe('GIF')
    })
  })
})

describe('TrackingStore', () => {
  beforeEach(() => {
    // Clear store before each test
    jest.clearAllMocks()
  })

  describe('recordTracking', () => {
    it('should record a tracking event', () => {
      TrackingStore.recordTracking('tracking-id-1', 'open')
      
      expect(TrackingStore.hasBeenTracked('tracking-id-1')).toBe(true)
    })

    it('should distinguish between open and click events', () => {
      TrackingStore.recordTracking('tracking-id-2', 'click')
      
      expect(TrackingStore.getTrackingType('tracking-id-2')).toBe('click')
    })
  })

  describe('hasBeenTracked', () => {
    it('should return false for untracked IDs', () => {
      expect(TrackingStore.hasBeenTracked('non-existent')).toBe(false)
    })

    it('should return true for tracked IDs', () => {
      TrackingStore.recordTracking('test-id', 'open')
      expect(TrackingStore.hasBeenTracked('test-id')).toBe(true)
    })
  })

  describe('getTrackingType', () => {
    it('should return the tracking type', () => {
      TrackingStore.recordTracking('test-id-3', 'open')
      expect(TrackingStore.getTrackingType('test-id-3')).toBe('open')
      
      TrackingStore.recordTracking('test-id-4', 'click')
      expect(TrackingStore.getTrackingType('test-id-4')).toBe('click')
    })

    it('should return null for non-existent IDs', () => {
      expect(TrackingStore.getTrackingType('non-existent')).toBeNull()
    })
  })
})
