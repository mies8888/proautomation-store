import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  withErrorHandling,
  ForbiddenError,
  AppError
} from '@/lib/errors/handler'
import { emailTemplates } from '@/services/gmail/templates'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  htmlBody: z.string().optional(),
  description: z.string().optional(),
  category: z.enum(['cold_outreach', 'follow_up', 'demo_request', 'problem_aware', 'case_study', 'proposal', 'custom']).optional()
})

/**
 * GET - List all email templates
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')

  // Built-in templates
  const builtInTemplates = Object.entries(emailTemplates).map(([key, template]) => ({
    id: key,
    ...template,
    isBuiltIn: true,
    category: key
  }))

  // User custom templates
  const customTemplates = await prisma.activityLog.findMany({
    where: {
      userId: session.user.id,
      action: 'CUSTOM_TEMPLATE_CREATED'
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  const templates = [
    ...builtInTemplates,
    ...customTemplates.map(log => ({
      id: log.id,
      ...(log.metadata as any),
      isBuiltIn: false,
      category: (log.metadata as any)?.category || 'custom'
    }))
  ]

  // Filter by category if provided
  const filtered = category
    ? templates.filter(t => t.category === category)
    : templates

  return NextResponse.json({
    templates: filtered,
    total: filtered.length,
    categories: ['cold_outreach', 'follow_up', 'demo_request', 'problem_aware', 'case_study', 'proposal', 'custom']
  })
})

/**
 * POST - Create custom template
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const body = await req.json()
  const templateData = CreateTemplateSchema.parse(body)

  // Create template record
  const templateId = `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'CUSTOM_TEMPLATE_CREATED',
      metadata: {
        templateId,
        ...templateData,
        createdAt: new Date().toISOString()
      }
    }
  })

  return NextResponse.json({
    success: true,
    template: {
      id: templateId,
      ...templateData,
      isBuiltIn: false
    }
  }, { status: 201 })
})
