import { NextRequest, NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/prisma"
import { 
  withErrorHandling,
  validateRequest,
  ForbiddenError,
  NotFoundError,
  ValidationError
} from '@/lib/errors/handler'
import { GenerateWebsiteSchema } from '@/lib/validation/schemas'
import { generateWebsite } from '@/services/websiteBuilderEngine'
import { COST, hasSufficientCredits, deductCredits } from '@/services/billing'
import { checkWebsiteAnalysisRateLimit, addRateLimitHeaders } from '@/lib/errors/rateLimiter'

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  // Validate request
  const data = await validateRequest(req, GenerateWebsiteSchema)

  // Check rate limit
  await checkWebsiteAnalysisRateLimit(req, session.user.id)

  // Verify user has credits
  if (!(await hasSufficientCredits(session.user.id, COST.WEBSITE_GENERATION))) {
    throw new ValidationError('Insufficient credits for website generation')
  }

  // Verify lead exists and user owns it
  const lead = await prisma.lead.findUnique({
    where: { id: data.leadId }
  })

  if (!lead) {
    throw new NotFoundError('Lead')
  }

  if (lead.ownerUserId !== session.user.id) {
    throw new ForbiddenError('You can only generate websites for your own leads')
  }

  // Deduct credits
  await deductCredits(
    session.user.id,
    COST.WEBSITE_GENERATION,
    "WEBSITE_GENERATION",
    `Website generation for: ${lead.companyName}`
  )

  // Generate website
  const htmlContent = await generateWebsite(lead, {
    companyName: data.companyName,
    tagline: data.tagline,
    description: data.description,
    primaryColor: data.primaryColor,
    includeContactForm: data.includeContactForm,
    includeBlog: data.includeBlog
  })

  // Save project
  const project = await prisma.websiteProject.create({
    data: {
      leadId: data.leadId,
      projectName: data.companyName,
      htmlContent,
      status: 'PUBLISHED'
    },
    include: { lead: true }
  })

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      leadId: lead.id,
      action: 'WEBSITE_GENERATED',
      metadata: {
        projectId: project.id,
        projectName: data.companyName,
        templateId: data.templateId
      }
    }
  })

  const response = NextResponse.json(project, { status: 201 })
  return addRateLimitHeaders(response, {
    allowed: true,
    remaining: 4,
    limit: 5,
    resetAt: Date.now() + 3600000
  })
})
