import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { TrackingService, TrackingStore } from '@/services/tracking'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const trackingId = searchParams.get('id')
    const type = searchParams.get('type') as 'open' | 'click' | null
    const emailId = searchParams.get('email')
    const encodedUrl = searchParams.get('url')

    if (!trackingId || !type) {
      return NextResponse.json({ error: 'Missing tracking parameters' }, { status: 400 })
    }

    // Check if already tracked (prevent duplicate counting)
    const alreadyTracked = TrackingStore.hasBeenTracked(trackingId)
    
    try {
      if (type === 'open' && emailId) {
        // Log email open to activity log
        const email = await prisma.outreachEmail.findUnique({
          where: { id: emailId },
        })

        if (email) {
          await prisma.activityLog.create({
            data: {
              userId: email.userId,
              leadId: email.leadId,
              action: 'email_open',
              metadata: {
                emailId,
                trackingId,
                duplicateTracking: alreadyTracked,
              },
              ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
              userAgent: request.headers.get('user-agent') || undefined,
            },
          })
        }

        // Record tracking
        TrackingStore.recordTracking(trackingId, 'open')

        // Return tracking pixel GIF
        const gifBuffer = TrackingService.createTrackingPixelGif()
        const gifBlob = new Blob([new Uint8Array(gifBuffer)], { type: 'image/gif' })
        return new NextResponse(gifBlob, {
          headers: {
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        })
      } else if (type === 'click' && encodedUrl) {
        // Decode original URL
        let originalUrl: string
        try {
          originalUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8')
        } catch {
          return NextResponse.json({ error: 'Invalid URL encoding' }, { status: 400 })
        }

        // Validate URL format
        try {
          new URL(originalUrl)
        } catch {
          return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
        }

        // Try to find the email and log click
        const emails = await prisma.outreachEmail.findMany({
          where: { id: emailId || undefined },
          take: 1,
        })

        if (emails.length > 0) {
          const email = emails[0]
          await prisma.activityLog.create({
            data: {
              userId: email.userId,
              leadId: email.leadId,
              action: 'link_click',
              metadata: {
                emailId: email.id,
                trackingId,
                clickedUrl: originalUrl,
                duplicateTracking: alreadyTracked,
              },
              ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
              userAgent: request.headers.get('user-agent') || undefined,
            },
          })
        }

        // Record tracking
        TrackingStore.recordTracking(trackingId, 'click')

        // Redirect to original URL
        return NextResponse.redirect(originalUrl, { status: 302 })
      } else {
        return NextResponse.json({ error: 'Invalid tracking request' }, { status: 400 })
      }
    } catch (error) {
      console.error('Error logging tracking:', error)
      // Still handle the request even if logging fails
      if (type === 'open') {
        const gifBuffer = TrackingService.createTrackingPixelGif()
        const gifBlob = new Blob([new Uint8Array(gifBuffer)], { type: 'image/gif' })
        return new NextResponse(gifBlob, {
          headers: { 'Content-Type': 'image/gif' },
        })
      } else if (type === 'click' && encodedUrl) {
        try {
          const originalUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8')
          return NextResponse.redirect(originalUrl, { status: 302 })
        } catch {
          return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
        }
      }
      throw error
    }
  } catch (error) {
    console.error('Tracking endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
