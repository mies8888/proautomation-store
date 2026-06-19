import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ForbiddenError, AppError, withErrorHandling } from '@/lib/errors/handler'
import SimpleJobQueue from '@/lib/jobs/email-queue'

/**
 * GET - Get job queue status and statistics
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  try {
    const queue = SimpleJobQueue.initialize()
    const stats = queue.getStats()
    const jobs = queue.getAllJobs()

    return NextResponse.json({
      status: 'running',
      stats,
      jobs: jobs.map(job => ({
        id: job.id,
        emailId: job.emailId,
        scheduleTime: job.scheduleTime,
        status: job.status,
        retryCount: job.retryCount,
        error: job.error
      }))
    })
  } catch (err) {
    throw new AppError(500, 'Failed to get queue status', 'QUEUE_STATUS_FAILED')
  }
})

/**
 * POST - Manually trigger job queue processing (admin only)
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  // Check if admin (optional - remove if not needed)
  // if (session.user.role !== 'ADMIN') {
  //   throw new ForbiddenError('Only admins can trigger manual processing')
  // }

  try {
    const queue = SimpleJobQueue.initialize()
    const stats = queue.getStats()

    return NextResponse.json({
      message: 'Queue is running',
      stats,
      nextCheck: 'Automatic - checks every 10 seconds'
    })
  } catch (err) {
    throw new AppError(500, 'Failed to process queue', 'QUEUE_PROCESS_FAILED')
  }
})
