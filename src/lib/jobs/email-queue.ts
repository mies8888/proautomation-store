interface ScheduledJob {
  id: string
  emailId: string
  scheduleTime: Date
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  retryCount: number
  maxRetries: number
  error?: string
  to: string
  cc?: string
  subject: string
  body: string
  leadId: string
  recurrence?: string
  recurrenceEndDate?: Date
}

class SimpleJobQueue {
  private jobs: Map<string, ScheduledJob> = new Map()
  private isProcessing = false
  private processInterval: NodeJS.Timeout | null = null
  private readonly CHECK_INTERVAL = 10000 // Check every 10 seconds

  /**
   * Initialize the job queue and start processing
   */
  static initialize() {
    const global = globalThis as any
    if (!global.emailJobQueue) {
      global.emailJobQueue = new SimpleJobQueue()
      global.emailJobQueue.start()
      console.log('Email job queue initialized')
    }
    return global.emailJobQueue as SimpleJobQueue
  }

  /**
   * Add a new scheduled email job
   */
  async addJob(emailId: string, scheduleTime: Date, emailData: {
    leadId: string
    to: string
    cc?: string
    subject: string
    body: string
    recurrence?: string
    recurrenceEndDate?: Date
  }): Promise<ScheduledJob> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const job: ScheduledJob = {
      id: jobId,
      emailId,
      scheduleTime,
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 3,
      ...emailData
    }

    this.jobs.set(jobId, job)
    console.log(`[Job Queue] Added job ${jobId} for email ${emailId} scheduled at ${scheduleTime}`)

    return job
  }

  /**
   * Start the job processing loop
   */
  private start() {
    if (this.processInterval) return

    this.processInterval = setInterval(() => {
      this.processPendingJobs().catch(err => {
        console.error('[Job Queue] Error processing jobs:', err)
      })
    }, this.CHECK_INTERVAL)

    console.log('[Job Queue] Started processing loop')
  }

  /**
   * Stop the job processing loop
   */
  stop() {
    if (this.processInterval) {
      clearInterval(this.processInterval)
      this.processInterval = null
      console.log('[Job Queue] Stopped processing loop')
    }
  }

  /**
   * Process all pending jobs due for execution
   */
  private async processPendingJobs() {
    if (this.isProcessing) return

    this.isProcessing = true

    try {
      const now = new Date()
      const jobsToProcess: ScheduledJob[] = []

      // Find jobs that are due
      for (const [, job] of this.jobs) {
        if (
          job.status === 'PENDING' &&
          job.scheduleTime <= now
        ) {
          jobsToProcess.push(job)
        }
      }

      // Process each job
      for (const job of jobsToProcess) {
        await this.processJob(job)
      }
    } catch (err) {
      console.error('[Job Queue] Error in processPendingJobs:', err)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Process a single job - send email and handle retries
   */
  private async processJob(job: ScheduledJob) {
    job.status = 'PROCESSING'
    console.log(`[Job Queue] Processing job ${job.id}`)

    try {
      // Send the email via Gmail API
      const sendResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/gmail/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: job.leadId,
          to: job.to,
          cc: job.cc,
          subject: job.subject,
          body: job.body
        })
      })

      if (!sendResponse.ok) {
        const error = await sendResponse.json()
        throw new Error(`Failed to send email: ${error.message}`)
      }

      job.status = 'COMPLETED'
      console.log(`[Job Queue] ✓ Job ${job.id} completed successfully`)

      // If recurring, schedule next occurrence
      if (job.recurrence && job.recurrence !== 'none') {
        await this.scheduleNextOccurrence(job)
      } else {
        // Remove one-time jobs after completion
        this.jobs.delete(job.id)
      }
    } catch (err: any) {
      job.retryCount++
      console.error(`[Job Queue] ✗ Job ${job.id} failed:`, err.message)

      if (job.retryCount < job.maxRetries) {
        // Retry with exponential backoff: 1min, 2min, 4min
        const backoffMs = Math.pow(2, job.retryCount - 1) * 60000
        job.scheduleTime = new Date(Date.now() + backoffMs)
        job.status = 'PENDING'
        job.error = err.message
        console.log(`[Job Queue] Retrying job ${job.id} in ${backoffMs / 60000} minute(s)`)
      } else {
        job.status = 'FAILED'
        job.error = `Failed after ${job.maxRetries} retries: ${err.message}`
        console.error(`[Job Queue] ✗ Job ${job.id} failed permanently:`, job.error)
      }
    }
  }

  /**
   * Schedule the next occurrence of a recurring email
   */
  private async scheduleNextOccurrence(job: ScheduledJob) {
    let nextScheduleTime = new Date(job.scheduleTime)

    switch (job.recurrence) {
      case 'daily':
        nextScheduleTime.setDate(nextScheduleTime.getDate() + 1)
        break
      case 'weekly':
        nextScheduleTime.setDate(nextScheduleTime.getDate() + 7)
        break
      default:
        return
    }

    // Check if within recurrence end date
    if (job.recurrenceEndDate && nextScheduleTime > job.recurrenceEndDate) {
      console.log(`[Job Queue] Recurrence ended for job ${job.id}`)
      return
    }

    // Create next occurrence job
    const nextJob: ScheduledJob = {
      ...job,
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scheduleTime: nextScheduleTime,
      status: 'PENDING',
      retryCount: 0
    }

    this.jobs.set(nextJob.id, nextJob)
    console.log(`[Job Queue] Scheduled next recurrence: ${nextJob.id} at ${nextScheduleTime}`)
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): ScheduledJob | undefined {
    return this.jobs.get(jobId)
  }

  /**
   * Get all jobs (for monitoring)
   */
  getAllJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values())
  }

  /**
   * Get job statistics
   */
  getStats() {
    const jobs = Array.from(this.jobs.values())
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'PENDING').length,
      processing: jobs.filter(j => j.status === 'PROCESSING').length,
      completed: jobs.filter(j => j.status === 'COMPLETED').length,
      failed: jobs.filter(j => j.status === 'FAILED').length
    }
  }
}

export default SimpleJobQueue
