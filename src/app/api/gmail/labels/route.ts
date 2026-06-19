import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  withErrorHandling,
  ForbiddenError,
  AppError
} from '@/lib/errors/handler'
import { getLabels, createLabel, addLabel } from '@/lib/gmail/service'
import { z } from 'zod'

const CreateLabelSchema = z.object({
  name: z.string().min(1).max(100),
  labelListVisibility: z.enum(['labelShow', 'labelHide']).optional(),
  messageListVisibility: z.enum(['show', 'hide']).optional()
})

/**
 * GET - List all Gmail labels
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  try {
    const labels = await getLabels(session.user.id)
    return NextResponse.json({
      labels: labels.map((label: any) => ({
        id: label.id,
        name: label.name,
        type: label.type,
        messageListVisibility: label.messageListVisibility,
        labelListVisibility: label.labelListVisibility,
        messagesUnread: label.messagesUnread || 0,
        messagesTotal: label.messagesTotal || 0
      }))
    })
  } catch (err) {
    throw new AppError(400, 'Failed to fetch labels', 'FETCH_LABELS_FAILED')
  }
})

/**
 * POST - Create new Gmail label
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const body = await req.json()
  const labelData = CreateLabelSchema.parse(body)

  try {
    const newLabel = await createLabel(session.user.id, labelData.name)

    return NextResponse.json({
      success: true,
      label: {
        id: newLabel.id,
        name: newLabel.name,
        type: newLabel.type
      }
    }, { status: 201 })
  } catch (err) {
    throw new AppError(400, 'Failed to create label', 'LABEL_CREATE_FAILED')
  }
})

/**
 * PUT - Apply label to emails
 */
export const PUT = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const { searchParams } = new URL(req.url)
  const labelId = searchParams.get('labelId')

  if (!labelId) {
    throw new AppError(400, 'labelId is required', 'MISSING_LABEL_ID')
  }

  const body = await req.json()
  const { emailIds } = z.object({
    emailIds: z.array(z.string()).min(1).max(100)
  }).parse(body)

  try {
    for (const emailId of emailIds) {
      await addLabel(session.user.id, emailId, labelId)
    }

    return NextResponse.json({
      success: true,
      message: `Label applied to ${emailIds.length} email(s)`
    })
  } catch (err) {
    throw new AppError(400, 'Failed to apply label', 'LABEL_APPLY_FAILED')
  }
})
