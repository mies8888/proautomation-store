/**
 * Email templates for outreach campaigns
 * Supports variable substitution: {{companyName}}, {{contactName}}, {{service}}, etc.
 */

import { TrackingService } from '@/services/tracking'

export interface EmailTemplate {
  name: string
  subject: string
  body: string
  htmlBody?: string
  description: string
}

interface TemplateVariables {
  companyName?: string
  contactName?: string
  contactTitle?: string
  service?: string
  benefit?: string
  callToAction?: string
  senderName?: string
  senderTitle?: string
  [key: string]: string | undefined
}

/**
 * Pre-defined email templates
 */
export const emailTemplates: Record<string, EmailTemplate> = {
  cold_outreach: {
    name: 'Cold Outreach',
    subject: 'Quick opportunity for {{companyName}}',
    body: `Hi {{contactName}},

I was impressed by {{companyName}}'s work in {{industry}} and think I might be able to help you with {{service}}.

{{benefit}}

Would you be open to a brief conversation?

Best regards,
{{senderName}}`,
    htmlBody: `<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<p>Hi {{contactName}},</p>
<p>I was impressed by {{companyName}}'s work in {{industry}} and think I might be able to help you with {{service}}.</p>
<p>{{benefit}}</p>
<p>Would you be open to a brief conversation?</p>
<p>Best regards,<br>{{senderName}}</p>
</body>
</html>`,
    description: 'Initial cold outreach email',
  },

  follow_up: {
    name: 'Follow-up',
    subject: 'Following up on my previous email',
    body: `Hi {{contactName}},

I wanted to follow up on my previous email about {{service}} for {{companyName}}.

I still think there's a great opportunity to {{benefit}}.

Are you available for a quick chat?

Best regards,
{{senderName}}`,
    htmlBody: `<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<p>Hi {{contactName}},</p>
<p>I wanted to follow up on my previous email about {{service}} for {{companyName}}.</p>
<p>I still think there's a great opportunity to {{benefit}}.</p>
<p>Are you available for a quick chat?</p>
<p>Best regards,<br>{{senderName}}</p>
</body>
</html>`,
    description: 'Follow-up email for non-responders',
  },

  proposal: {
    name: 'Proposal',
    subject: 'Proposal: {{service}} for {{companyName}}',
    body: `Hi {{contactName}},

Thank you for our recent conversation about {{service}}.

As discussed, I've put together a proposal for {{companyName}} that would {{benefit}}.

Key benefits:
- {{benefit}}
- Tailored to your specific needs
- Proven results with similar companies

I'd love to discuss this further. Are you available next week?

Best regards,
{{senderName}}`,
    htmlBody: `<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<p>Hi {{contactName}},</p>
<p>Thank you for our recent conversation about {{service}}.</p>
<p>As discussed, I've put together a proposal for {{companyName}} that would {{benefit}}.</p>
<h3 style="color: #0066cc;">Key benefits:</h3>
<ul>
<li>{{benefit}}</li>
<li>Tailored to your specific needs</li>
<li>Proven results with similar companies</li>
</ul>
<p>I'd love to discuss this further. Are you available next week?</p>
<p>Best regards,<br>{{senderName}}</p>
</body>
</html>`,
    description: 'Proposal email after initial conversation',
  },

  thank_you: {
    name: 'Thank You',
    subject: 'Thank you for your time, {{contactName}}',
    body: `Hi {{contactName}},

Thank you for taking the time to speak with me about {{service}} today.

I really appreciated learning more about {{companyName}}'s vision and goals.

As discussed, {{benefit}}.

I'll send over the next steps and look forward to working together.

Best regards,
{{senderName}}`,
    htmlBody: `<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<p>Hi {{contactName}},</p>
<p>Thank you for taking the time to speak with me about {{service}} today.</p>
<p>I really appreciated learning more about {{companyName}}'s vision and goals.</p>
<p>As discussed, {{benefit}}.</p>
<p>I'll send over the next steps and look forward to working together.</p>
<p>Best regards,<br>{{senderName}}</p>
</body>
</html>`,
    description: 'Thank you email after meeting',
  },

  demo_request: {
    name: 'Demo Request',
    subject: 'Let me show you how {{service}} can help {{companyName}}',
    body: `Hi {{contactName}},

I'd love to give you a quick demo of {{service}} and show you how it can {{benefit}} for {{companyName}}.

The demo takes about 15 minutes and could save your team hours of work.

Are you available this week?

Best regards,
{{senderName}}`,
    htmlBody: `<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<p>Hi {{contactName}},</p>
<p>I'd love to give you a quick demo of {{service}} and show you how it can {{benefit}} for {{companyName}}.</p>
<p>The demo takes about 15 minutes and could save your team hours of work.</p>
<p>Are you available this week?</p>
<p>Best regards,<br>{{senderName}}</p>
</body>
</html>`,
    description: 'Demo request email',
  },

  case_study: {
    name: 'Case Study',
    subject: 'How {{companyName}} can achieve similar results',
    body: `Hi {{contactName}},

I thought you might be interested in how a similar company achieved {{benefit}} using {{service}}.

Here's their success story: {{caseStudyUrl}}

I'd love to discuss how {{companyName}} could achieve similar results.

Best regards,
{{senderName}}`,
    htmlBody: `<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<p>Hi {{contactName}},</p>
<p>I thought you might be interested in how a similar company achieved {{benefit}} using {{service}}.</p>
<p>Here's their success story: <a href="{{caseStudyUrl}}">Click here to read the case study</a></p>
<p>I'd love to discuss how {{companyName}} could achieve similar results.</p>
<p>Best regards,<br>{{senderName}}</p>
</body>
</html>`,
    description: 'Email with case study reference',
  },

  problem_aware: {
    name: 'Problem Aware',
    subject: '{{companyName}} - {{benefit}}',
    body: `Hi {{contactName}},

I recently noticed that many companies like {{companyName}} are struggling with {{problem}}.

The good news is that {{service}} can help you {{benefit}}.

In fact, we recently helped a similar company {{result}}.

Would you like to explore how we could do the same for {{companyName}}?

Best regards,
{{senderName}}`,
    htmlBody: `<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<p>Hi {{contactName}},</p>
<p>I recently noticed that many companies like {{companyName}} are struggling with {{problem}}.</p>
<p>The good news is that {{service}} can help you {{benefit}}.</p>
<p>In fact, we recently helped a similar company {{result}}.</p>
<p>Would you like to explore how we could do the same for {{companyName}}?</p>
<p>Best regards,<br>{{senderName}}</p>
</body>
</html>`,
    description: 'Email that addresses specific problem',
  },
}

/**
 * Substitute variables in email content
 */
export function substituteVariables(
  content: string,
  variables: TemplateVariables
): string {
  let result = content
  const variablePattern = /\{\{(\w+)\}\}/g

  result = result.replace(variablePattern, (match, key) => {
    return variables[key] || match
  })

  return result
}

/**
 * Render email template with variables and optional tracking
 */
export function renderTemplate(
  templateName: string,
  variables: TemplateVariables,
  options?: {
    emailId?: string
    userId?: string
    baseUrl?: string
    includeTracking?: boolean
  }
): { subject: string; body: string; htmlBody?: string } {
  const template = emailTemplates[templateName]

  if (!template) {
    throw new Error(`Template "${templateName}" not found`)
  }

  let htmlBody = template.htmlBody ? substituteVariables(template.htmlBody, variables) : undefined

  // Inject tracking if requested
  if (options?.includeTracking && options?.emailId && options?.userId && htmlBody) {
    htmlBody = TrackingService.injectTracking(
      htmlBody,
      options.emailId,
      options.userId,
      options.baseUrl
    )
  }

  return {
    subject: substituteVariables(template.subject, variables),
    body: substituteVariables(template.body, variables),
    htmlBody,
  }
}

/**
 * Get all available templates
 */
export function getAvailableTemplates(): EmailTemplate[] {
  return Object.values(emailTemplates)
}

/**
 * Create custom template
 */
export function createCustomTemplate(
  name: string,
  subject: string,
  body: string,
  description: string
): EmailTemplate {
  return {
    name,
    subject,
    body,
    description,
  }
}

/**
 * Validate template content
 */
export function validateTemplate(
  subject: string,
  body: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!subject || subject.trim().length === 0) {
    errors.push('Subject is required')
  }

  if (subject.length > 200) {
    errors.push('Subject must be less than 200 characters')
  }

  if (!body || body.trim().length === 0) {
    errors.push('Body is required')
  }

  if (body.length > 10000) {
    errors.push('Body must be less than 10000 characters')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get template preview with sample variables
 */
export function getTemplatePreview(templateName: string): {
  subject: string
  body: string
} {
  const template = emailTemplates[templateName]

  if (!template) {
    throw new Error(`Template "${templateName}" not found`)
  }

  const sampleVariables: TemplateVariables = {
    companyName: 'Acme Corp',
    contactName: 'John',
    contactTitle: 'Manager',
    service: 'email outreach automation',
    benefit: 'increase leads by 40%',
    callToAction: 'Schedule a demo',
    senderName: 'Sarah',
    senderTitle: 'Sales',
    industry: 'Technology',
    problem: 'inefficient outreach processes',
    result: 'tripled their lead generation',
    caseStudyUrl: 'https://example.com/case-study',
  }

  return {
    subject: substituteVariables(template.subject, sampleVariables),
    body: substituteVariables(template.body, sampleVariables),
  }
}
