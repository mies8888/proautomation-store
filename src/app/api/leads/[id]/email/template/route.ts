import { NextRequest, NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { withErrorHandling, ForbiddenError, NotFoundError } from '@/lib/errors/handler'
import { prisma } from '@/lib/db/prisma'
import { getAvailableTemplates, renderTemplate, getTemplatePreview } from '@/services/gmail/templates'
import { z } from 'zod'

const RenderTemplateSchema = z.object({
  templateName: z.string().min(1),
  variables: z.record(z.string(), z.string()).optional(),
})

/**
 * GET /api/leads/[id]/email/templates
 * List all available email templates
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const templates = getAvailableTemplates()
  const templatesWithPreview = templates.map((template) => ({
    ...template,
    preview: getTemplatePreview(template.name === 'Cold Outreach' ? 'cold_outreach' : template.name.toLowerCase().replace(/ /g, '_')),
  }))

  return NextResponse.json(templatesWithPreview)
})

/**
 * POST /api/leads/[id]/email/templates/render
 * Render a template with variables
 */
export const POST = withErrorHandling(async (req: NextRequest, props: { params: Promise<{ id: string }> }) => {
  const params = await props.params
  const leadId = params.id
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  // Verify lead exists and user owns it
  const lead = await prisma.lead.findUnique({
    where: { id: leadId }
  })

  if (!lead) {
    throw new NotFoundError('Lead')
  }

  if (lead.ownerUserId !== session.user.id) {
    throw new ForbiddenError('You can only work with your own leads')
  }

  // Parse request body
  const body = await req.json()
  const data = RenderTemplateSchema.parse(body)

  // Render template with default variables from lead
  const variables = {
    companyName: lead.companyName,
    contactName: lead.contactEmail?.split('@')[0] || 'there',
    service: 'our service',
    benefit: 'help grow your business',
    senderName: session.user.name || 'A potential partner',
    ...data.variables,
  }

  const rendered = renderTemplate(data.templateName, variables)

  return NextResponse.json({
    templateName: data.templateName,
    subject: rendered.subject,
    body: rendered.body,
    variables,
  })
})
