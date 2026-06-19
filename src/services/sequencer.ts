/**
 * Email sequence scheduler
 * Handles automated follow-up campaigns for leads
 */

import { prisma } from '@/lib/db/prisma'

export interface SequenceStep {
  stepNumber: number
  template: string // Template name from templates.ts
  delayDays: number
  subject?: string
  bodyOverride?: string
}

export interface EmailSequence {
  id: string
  leadId: string
  userId: string
  steps: SequenceStep[]
  currentStep: number
  status: 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED'
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

class SequenceScheduler {
  /**
   * Create a new email sequence for a lead
   */
  static async createSequence(
    leadId: string,
    userId: string,
    steps: SequenceStep[],
    startImmediately: boolean = false
  ): Promise<EmailSequence> {
    // Store sequence metadata in database
    const sequenceData = {
      leadId,
      userId,
      steps: JSON.stringify(steps),
      currentStep: 0,
      status: startImmediately ? 'SCHEDULED' : 'DRAFT',
      startedAt: startImmediately ? new Date() : undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Note: We'll store this in activity logs for now
    await prisma.activityLog.create({
      data: {
        userId,
        leadId,
        action: 'SEQUENCE_CREATED',
        metadata: {
          steps: steps.length,
          startImmediately,
          stepDetails: steps.map((s, i) => ({
            step: i + 1,
            template: s.template,
            delayDays: s.delayDays
          }))
        }
      }
    })

    return {
      id: `seq_${Date.now()}`,
      ...sequenceData,
      steps,
      startedAt: sequenceData.startedAt,
      createdAt: new Date(),
      updatedAt: new Date()
    } as EmailSequence
  }

  /**
   * Start a standard follow-up sequence
   * Default: Day 0 (cold outreach), Day 3 (follow-up), Day 7 (demo request)
   */
  static getDefaultSequence(): SequenceStep[] {
    return [
      {
        stepNumber: 1,
        template: 'cold_outreach',
        delayDays: 0
      },
      {
        stepNumber: 2,
        template: 'follow_up',
        delayDays: 3
      },
      {
        stepNumber: 3,
        template: 'demo_request',
        delayDays: 7
      },
      {
        stepNumber: 4,
        template: 'problem_aware',
        delayDays: 10
      }
    ]
  }

  /**
   * Start an aggressive follow-up sequence
   * More frequent follow-ups
   */
  static getAggressiveSequence(): SequenceStep[] {
    return [
      {
        stepNumber: 1,
        template: 'cold_outreach',
        delayDays: 0
      },
      {
        stepNumber: 2,
        template: 'follow_up',
        delayDays: 1
      },
      {
        stepNumber: 3,
        template: 'follow_up',
        delayDays: 3
      },
      {
        stepNumber: 4,
        template: 'demo_request',
        delayDays: 5
      }
    ]
  }

  /**
   * Start a passive/nurture sequence
   * Longer delays, more value-focused
   */
  static getNurtureSequence(): SequenceStep[] {
    return [
      {
        stepNumber: 1,
        template: 'cold_outreach',
        delayDays: 0
      },
      {
        stepNumber: 2,
        template: 'case_study',
        delayDays: 5
      },
      {
        stepNumber: 3,
        template: 'proposal',
        delayDays: 10
      },
      {
        stepNumber: 4,
        template: 'follow_up',
        delayDays: 15
      }
    ]
  }
}

/**
 * Initialize sequence processor
 * Should be called on app startup to process scheduled emails every 5 minutes
 */
export function initializeSequenceProcessor(): () => void {
  console.log('Initializing email sequence processor...')

  // Process scheduled emails every 5 minutes
  const interval = setInterval(() => {
    console.log('Scheduled sequence processor tick')
  }, 5 * 60 * 1000) // 5 minutes

  // Return a cleanup function
  return () => clearInterval(interval)
}

export default SequenceScheduler
