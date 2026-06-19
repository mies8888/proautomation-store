import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  withErrorHandling,
  ForbiddenError,
  AppError
} from '@/lib/errors/handler'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const TemplateUpdateSchema = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  htmlBody: z.string().optional(),
  description: z.string().optional()
})

/**
 * GET - Get template by ID
 */
export const GET = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const templateId = params.id

  // Check if it's a built-in or custom template
  const isBuiltIn = !templateId.startsWith('tmpl_')

  if (isBuiltIn) {
    // Return built-in template
    const { emailTemplates } = await import('@/services/gmail/templates')
    const template = emailTemplates[templateId as keyof typeof emailTemplates]
    
    if (!template) {
      throw new AppError(404, 'Template not found', 'TEMPLATE_NOT_FOUND')
    }

    return NextResponse.json({
      id: templateId,
      ...template,
      isBuiltIn: true
    })
  }

  // Get custom template from activity log
  const templateLog = await prisma.activityLog.findFirst({
    where: {
      userId: session.user.id,
      id: templateId,
      action: 'CUSTOM_TEMPLATE_CREATED'
    }
  })

  if (!templateLog) {
    throw new AppError(404, 'Template not found', 'TEMPLATE_NOT_FOUND')
  }

  return NextResponse.json({
    id: templateId,
    ...(templateLog.metadata as any),
    isBuiltIn: false
  })
})

/**
 * PUT - Update custom template
 */
export const PUT = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const templateId = params.id

  // Cannot edit built-in templates
  if (!templateId.startsWith('tmpl_')) {
    throw new AppError(400, 'Cannot edit built-in templates', 'CANNOT_EDIT_BUILTIN')
  }

  const body = await req.json()
  const updateData = TemplateUpdateSchema.parse(body)

  // Find the template log entry
  const templateLog = await prisma.activityLog.findFirst({
    where: {
      userId: session.user.id,
      id: templateId,
      action: 'CUSTOM_TEMPLATE_CREATED'
    }
  })

  if (!templateLog) {
    throw new AppError(404, 'Template not found', 'TEMPLATE_NOT_FOUND')
  }

  // Create update activity log
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'CUSTOM_TEMPLATE_UPDATED',
      metadata: {
        templateId,
        ...updateData,
        updatedAt: new Date().toISOString()
      }
    }
  })

  return NextResponse.json({
    success: true,
    template: {
      id: templateId,
      ...updateData,
      isBuiltIn: false
    }
  })
})

/**
 * DELETE - Delete custom template
 */
export const DELETE = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const templateId = params.id

  // Cannot delete built-in templates
  if (!templateId.startsWith('tmpl_')) {
    throw new AppError(400, 'Cannot delete built-in templates', 'CANNOT_DELETE_BUILTIN')
  }

  // Find and verify ownership
  const templateLog = await prisma.activityLog.findFirst({
    where: {
      userId: session.user.id,
      id: templateId,
      action: 'CUSTOM_TEMPLATE_CREATED'
    }
  })

  if (!templateLog) {
    throw new AppError(404, 'Template not found', 'TEMPLATE_NOT_FOUND')
  }

  // Log deletion
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'CUSTOM_TEMPLATE_DELETED',
      metadata: {
        templateId,
        templateName: (templateLog.metadata as any)?.name,
        deletedAt: new Date().toISOString()
      }
    }
  })

  return NextResponse.json({
    success: true,
    message: 'Template deleted'
  })
})
