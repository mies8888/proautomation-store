import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { withErrorHandling, ForbiddenError, AppError } from '@/lib/errors/handler'
import { Anthropic } from '@anthropic-ai/sdk'

const client = new Anthropic()

interface OptimizeEmailRequest {
  subject: string
  body: string
  leadName?: string
  leadCompany?: string
}

interface OptimizationSuggestion {
  field: 'subject' | 'body'
  current: string
  suggestion: string
  reasoning: string
  improvement: string
}

interface OptimizeEmailResponse {
  original: {
    subject: string
    body: string
  }
  suggestions: OptimizationSuggestion[]
  summary: string
  overallScore: number
}

/**
 * POST - Generate AI-powered email optimization suggestions
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  try {
    const data: OptimizeEmailRequest = await req.json()

    if (!data.subject || !data.body) {
      throw new AppError(400, 'Subject and body are required', 'MISSING_FIELDS')
    }

    // Use Claude to analyze and suggest improvements
    const prompt = `You are an expert email copywriter and marketing specialist. Analyze the following email and provide specific, actionable suggestions to improve open rates, click rates, and response rates.

Email Subject: "${data.subject}"

Email Body:
${data.body}

${data.leadName ? `Lead Name: ${data.leadName}` : ''}
${data.leadCompany ? `Lead Company: ${data.leadCompany}` : ''}

Please provide:
1. 2-3 suggestions to improve the subject line (for higher open rates)
2. 2-3 suggestions to improve the email body (for higher engagement)
3. For each suggestion, explain the reasoning and expected improvement

Format your response as a JSON object with this structure:
{
  "subjectSuggestions": [
    {
      "current": "original subject",
      "suggestion": "improved subject",
      "reasoning": "why this is better",
      "improvement": "e.g., +15% expected open rate"
    }
  ],
  "bodySuggestions": [
    {
      "current": "original text snippet (20 words max)",
      "suggestion": "improved text",
      "reasoning": "why this is better",
      "improvement": "e.g., +8% expected click rate"
    }
  ],
  "overallScore": 0-100,
  "summary": "brief overall assessment"
}`

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    // Extract the response text
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse JSON from response
    let analysis
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseErr) {
      console.error('Failed to parse Claude response:', responseText)
      throw new AppError(500, 'Failed to parse optimization suggestions', 'PARSE_ERROR')
    }

    // Format response
    const suggestions: OptimizationSuggestion[] = []

    // Add subject suggestions
    if (analysis.subjectSuggestions) {
      analysis.subjectSuggestions.forEach((s: any) => {
        suggestions.push({
          field: 'subject',
          current: s.current || data.subject,
          suggestion: s.suggestion,
          reasoning: s.reasoning,
          improvement: s.improvement
        })
      })
    }

    // Add body suggestions
    if (analysis.bodySuggestions) {
      analysis.bodySuggestions.forEach((s: any) => {
        suggestions.push({
          field: 'body',
          current: s.current,
          suggestion: s.suggestion,
          reasoning: s.reasoning,
          improvement: s.improvement
        })
      })
    }

    return NextResponse.json({
      success: true,
      original: {
        subject: data.subject,
        body: data.body
      },
      suggestions,
      summary: analysis.summary || 'Email optimization complete',
      overallScore: analysis.overallScore || 70
    })
  } catch (err: any) {
    if (err instanceof AppError) {
      throw err
    }
    console.error('Email optimization error:', err)
    throw new AppError(500, 'Failed to optimize email', 'OPTIMIZATION_FAILED')
  }
})

/**
 * GET - Get example email templates and best practices
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  return NextResponse.json({
    success: true,
    bestPractices: {
      subjectLines: [
        {
          category: 'Curiosity Gap',
          example: 'One thing most {{COMPANY}} misses about {{INDUSTRY}}...',
          openRate: '+25-35%'
        },
        {
          category: 'Personalization',
          example: '{{FIRST_NAME}}, {{COMPANY}} is doing something right',
          openRate: '+15-20%'
        },
        {
          category: 'Urgency',
          example: '{{FIRST_NAME}} - quick question about {{SOLUTION}}',
          openRate: '+12-18%'
        },
        {
          category: 'Social Proof',
          example: '{{COMPANY}} companies like {{PEER_COMPANY}} are adopting {{SOLUTION}}',
          openRate: '+18-25%'
        },
        {
          category: 'Question',
          example: 'Is {{COMPANY}} leaving money on the table with {{PROBLEM}}?',
          openRate: '+20-30%'
        }
      ],
      bodyBestPractices: [
        'Keep opening hook to 2-3 sentences maximum',
        'Use short paragraphs (2-3 lines each)',
        'Include one clear call-to-action (CTA)',
        'Personalize with company or industry references',
        'Avoid generic greetings - use first names',
        'Use numbers and specific metrics when possible',
        'End with a question to encourage replies',
        'Keep total length under 150 words for cold emails'
      ],
      ctaExamples: [
        'Quick question - do you have 10 min this week for a brief call?',
        'Would it make sense to schedule a 15-min call to explore this?',
        'Thoughts? Happy to share a 2-min breakdown if helpful.'
      ]
    }
  })
})
