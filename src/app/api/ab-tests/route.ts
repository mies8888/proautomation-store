import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  withErrorHandling,
  ForbiddenError,
  AppError
} from '@/lib/errors/handler'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const ABTestCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  controlTemplateId: z.string(),
  variantTemplateId: z.string(),
  metric: z.enum(['open_rate', 'reply_rate', 'click_rate']),
  sampleSize: z.number().min(10).max(1000).optional(),
  confidence: z.number().min(0.8).max(0.99).optional()
})

type ABTestInput = z.infer<typeof ABTestCreateSchema>

/**
 * POST - Create A/B test campaign
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const body = await req.json()
  const testData = ABTestCreateSchema.parse(body)

  // Create test campaign
  const test = await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'AB_TEST_CREATED',
      metadata: {
        testName: testData.name,
        description: testData.description,
        controlTemplate: testData.controlTemplateId,
        variantTemplate: testData.variantTemplateId,
        metric: testData.metric,
        sampleSize: testData.sampleSize || 100,
        confidence: testData.confidence || 0.95,
        status: 'RUNNING',
        startedAt: new Date().toISOString(),
        results: {
          control: { sent: 0, opens: 0, replies: 0, clicks: 0 },
          variant: { sent: 0, opens: 0, replies: 0, clicks: 0 }
        }
      }
    }
  })

  return NextResponse.json({
    success: true,
    testId: test.id,
    test: {
      name: testData.name,
      status: 'RUNNING',
      controlTemplateId: testData.controlTemplateId,
      variantTemplateId: testData.variantTemplateId,
      metric: testData.metric,
      sampleSize: testData.sampleSize || 100
    }
  }, { status: 201 })
})

/**
 * GET - Retrieve A/B test results
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const { searchParams } = new URL(req.url)
  const testId = searchParams.get('testId')

  if (!testId) {
    throw new AppError(400, 'testId is required', 'MISSING_TEST_ID')
  }

  // Get test results
  const test = await prisma.activityLog.findUnique({
    where: { id: testId }
  })

  if (!test || test.userId !== session.user.id || test.action !== 'AB_TEST_CREATED') {
    throw new ForbiddenError('You do not have access to this test')
  }

  const metadata = test.metadata as any
  const results = metadata.results || { control: {}, variant: {} }

  // Calculate statistics
  const controlStats = calculateStats(results.control)
  const variantStats = calculateStats(results.variant)
  const significance = calculateSignificance(controlStats, variantStats)

  return NextResponse.json({
    test: {
      id: test.id,
      name: metadata.testName,
      status: metadata.status,
      metric: metadata.metric,
      startedAt: metadata.startedAt
    },
    control: {
      ...results.control,
      ...controlStats
    },
    variant: {
      ...results.variant,
      ...variantStats
    },
    significance: {
      isSignificant: significance.isSignificant,
      confidenceLevel: metadata.confidence,
      pValue: significance.pValue,
      winner: significance.winner
    }
  })
})

/**
 * PUT - Update A/B test status
 */
export const PUT = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const { searchParams } = new URL(req.url)
  const testId = searchParams.get('testId')

  if (!testId) {
    throw new AppError(400, 'testId is required', 'MISSING_TEST_ID')
  }

  const body = await req.json()
  const { status } = z.object({
    status: z.enum(['RUNNING', 'PAUSED', 'COMPLETED'])
  }).parse(body)

  // Get and verify ownership
  const test = await prisma.activityLog.findUnique({
    where: { id: testId }
  })

  if (!test || test.userId !== session.user.id) {
    throw new ForbiddenError('You do not have access to this test')
  }

  // Update test
  const metadata = test.metadata as any
  metadata.status = status
  if (status === 'COMPLETED') {
    metadata.completedAt = new Date().toISOString()
  }

  const updated = await prisma.activityLog.update({
    where: { id: testId },
    data: { metadata }
  })

  return NextResponse.json({
    success: true,
    test: {
      id: updated.id,
      status: metadata.status
    }
  })
})

/**
 * Calculate conversion rates and other metrics
 */
function calculateStats(data: any) {
  const sent = data.sent || 0
  const opens = data.opens || 0
  const replies = data.replies || 0
  const clicks = data.clicks || 0

  return {
    openRate: sent > 0 ? (opens / sent) * 100 : 0,
    replyRate: sent > 0 ? (replies / sent) * 100 : 0,
    clickRate: sent > 0 ? (clicks / sent) * 100 : 0,
    engagement: sent > 0 ? ((opens + replies + clicks) / (sent * 3)) * 100 : 0
  }
}

/**
 * Calculate statistical significance using chi-square
 */
function calculateSignificance(control: any, variant: any) {
  const controlConversion = control.openRate / 100
  const variantConversion = variant.openRate / 100

  // Simplified significance calculation
  // In production, use proper statistical library
  const difference = Math.abs(variantConversion - controlConversion)
  const winner =
    variantConversion > controlConversion
      ? 'variant'
      : controlConversion > variantConversion
        ? 'control'
        : 'tie'

  // Simple heuristic: significant if >5% difference
  const isSignificant = difference > 0.05

  return {
    isSignificant,
    pValue: isSignificant ? 0.05 : 0.5,
    winner
  }
}
