import Anthropic from '@anthropic-ai/sdk'

// Initialize Anthropic client
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = 'claude-3-5-sonnet-20241022'

/**
 * AI Service - Abstraction layer for Claude API
 * Handles all AI operations: email generation, report generation, website analysis, lead scoring, duplicate detection
 */

export interface AIGenerationOptions {
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

/**
 * Generate an email using Claude
 * Used for outreach email templates and personalization
 */
export async function generateEmail(
  leadData: {
    companyName: string
    industry?: string
    website?: string
    description?: string
    yourCompanyName?: string
    yourServices?: string
  },
  emailType: 'cold_outreach' | 'follow_up' | 'proposal' = 'cold_outreach',
  options: AIGenerationOptions = {}
): Promise<{ subject: string; body: string }> {
  const systemPrompt = options.systemPrompt || `You are an expert sales email copywriter. Generate professional, personalized business emails that:
- Are concise and to the point (2-3 short paragraphs max)
- Focus on the prospect's needs and problems, not your features
- Include a clear, specific call-to-action
- Use professional but friendly tone
- Avoid generic templates and show you've researched the company

Respond ONLY with valid JSON in this format:
{
  "subject": "subject line here",
  "body": "email body here"
}

Do not include any other text before or after the JSON.`

  const prompt = generateEmailPrompt(leadData, emailType)

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: options.maxTokens || 1024,
    temperature: options.temperature || 0.7,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const responseText = extractTextContent(message.content)

  try {
    const result = JSON.parse(responseText)
    return {
      subject: result.subject || 'Subject not generated',
      body: result.body || 'Body not generated',
    }
  } catch {
    // Fallback if JSON parsing fails
    return {
      subject: 'Business Inquiry',
      body: responseText,
    }
  }
}

/**
 * Generate an opportunity report for a lead
 * Analyzes the lead and company to identify opportunities
 */
export async function generateOpportunityReport(
  leadData: {
    companyName: string
    website?: string
    industry?: string
    description?: string
    country?: string
    city?: string
  },
  options: AIGenerationOptions = {}
): Promise<string> {
  const systemPrompt = options.systemPrompt || `You are a business analyst specializing in B2B opportunity analysis. 
Analyze the provided company information and generate a comprehensive but concise opportunity report in markdown format.

Structure the report with:
1. **Company Overview** - 2-3 sentences about the company
2. **Market Position** - What space they operate in
3. **Growth Opportunities** - 3-5 specific opportunities for growth or improvement
4. **Key Challenges** - 2-3 potential pain points
5. **Recommendations** - 3-4 actionable next steps for outreach

Keep the total report under 500 words. Use markdown formatting.`

  const prompt = `Analyze this company and provide an opportunity report:

Company Name: ${leadData.companyName}
${leadData.website ? `Website: ${leadData.website}` : ''}
${leadData.industry ? `Industry: ${leadData.industry}` : ''}
${leadData.description ? `Business Description: ${leadData.description}` : ''}
${leadData.country ? `Country: ${leadData.country}` : ''}
${leadData.city ? `City: ${leadData.city}` : ''}

Please provide a detailed opportunity analysis.`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature || 0.6,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  return extractTextContent(message.content)
}

/**
 * Analyze a website and generate insights
 * Returns structured analysis data
 */
export async function analyzeWebsite(
  websiteData: {
    url: string
    htmlContent?: string
    industry?: string
    companyDescription?: string
  },
  options: AIGenerationOptions = {}
): Promise<{
  overallScore: number
  performanceScore: number
  seoScore: number
  accessibilityScore: number
  designScore: number
  weaknesses: string[]
  opportunities: string[]
}> {
  const systemPrompt = options.systemPrompt || `You are an expert website analyst. Evaluate the website and provide scores from 0-100 for each category.

Respond ONLY with valid JSON in this format:
{
  "overallScore": 75,
  "performanceScore": 70,
  "seoScore": 65,
  "accessibilityScore": 80,
  "designScore": 75,
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "opportunities": ["opportunity 1", "opportunity 2", "opportunity 3"]
}

Ensure all scores are between 0 and 100. List only top 3 weaknesses and opportunities.
Do not include any other text before or after the JSON.`

  const prompt = `Analyze this website:

URL: ${websiteData.url}
${websiteData.industry ? `Industry: ${websiteData.industry}` : ''}
${websiteData.companyDescription ? `Description: ${websiteData.companyDescription}` : ''}
${websiteData.htmlContent ? `HTML Sample:\n${websiteData.htmlContent.substring(0, 2000)}` : 'Please analyze based on URL only'}

Provide a comprehensive website analysis with scores and recommendations.`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: options.maxTokens || 1024,
    temperature: options.temperature || 0.5,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const responseText = extractTextContent(message.content)

  try {
    return JSON.parse(responseText)
  } catch {
    // Return default scores if parsing fails
    return {
      overallScore: 50,
      performanceScore: 50,
      seoScore: 50,
      accessibilityScore: 50,
      designScore: 50,
      weaknesses: ['Unable to analyze'],
      opportunities: ['Request manual review'],
    }
  }
}

/**
 * Generate lead scoring based on company data
 * Returns individual scores for different factors
 */
export async function scoreLead(
  leadData: {
    companyName: string
    industry?: string
    country?: string
    website?: string
    description?: string
    websiteAnalysis?: { overallScore: number }
  },
  options: AIGenerationOptions = {}
): Promise<{
  fitScore: number
  contactabilityScore: number
  urgencyScore: number
  revenuePotentialScore: number
  conversionProbabilityScore: number
  dataQualityScore: number
  confidenceScore: number
  recommendation: string
}> {
  const systemPrompt = options.systemPrompt || `You are a lead scoring expert. Rate each factor from 0-100 based on the provided company data.

Respond ONLY with valid JSON in this format:
{
  "fitScore": 75,
  "contactabilityScore": 80,
  "urgencyScore": 60,
  "revenuePotentialScore": 75,
  "conversionProbabilityScore": 65,
  "dataQualityScore": 85,
  "confidenceScore": 70,
  "recommendation": "Strong lead - prioritize for outreach"
}

All scores should be 0-100. Recommendation should be brief (1 sentence).
Do not include any other text before or after the JSON.`

  const prompt = `Score this lead based on the following data:

Company Name: ${leadData.companyName}
${leadData.industry ? `Industry: ${leadData.industry}` : 'Industry: Unknown'}
${leadData.country ? `Country: ${leadData.country}` : 'Country: Unknown'}
${leadData.website ? `Website: ${leadData.website}` : 'Website: Unknown'}
${leadData.description ? `Business Description: ${leadData.description}` : ''}
${leadData.websiteAnalysis ? `Website Analysis Score: ${leadData.websiteAnalysis.overallScore}/100` : ''}

Provide scores for:
1. Fit Score - How well does this company fit our target market?
2. Contactability Score - How easy is it to contact this company?
3. Urgency Score - How soon might they need our services?
4. Revenue Potential Score - What's the revenue potential?
5. Conversion Probability Score - How likely to convert?
6. Data Quality Score - How complete/accurate is the lead data?
7. Confidence Score - How confident are we in these scores?

Also provide a brief recommendation.`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: options.maxTokens || 1024,
    temperature: options.temperature || 0.5,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const responseText = extractTextContent(message.content)

  try {
    return JSON.parse(responseText)
  } catch {
    // Return default scores if parsing fails
    return {
      fitScore: 50,
      contactabilityScore: 50,
      urgencyScore: 50,
      revenuePotentialScore: 50,
      conversionProbabilityScore: 50,
      dataQualityScore: 50,
      confidenceScore: 50,
      recommendation: 'Unable to score - manual review recommended',
    }
  }
}

/**
 * Detect potential duplicate leads
 * Compares a new lead against existing leads and returns similarity scores
 */
export async function detectDuplicates(
  newLead: {
    companyName: string
    website?: string
    country?: string
    industry?: string
  },
  existingLeads: Array<{
    id: string
    companyName: string
    website?: string
    country?: string
    industry?: string
  }>,
  options: AIGenerationOptions = {}
): Promise<Array<{ leadId: string; similarityScore: number; reason: string }>> {
  if (existingLeads.length === 0) {
    return []
  }

  const systemPrompt = options.systemPrompt || `You are an expert at detecting duplicate leads and identifying similar companies.
Analyze the new lead and existing leads to identify potential duplicates based on:
- Company name similarity (typos, abbreviations, different names for same company)
- Website domain matches
- Location matches
- Industry matches

Respond ONLY with valid JSON in this format:
{
  "duplicates": [
    {
      "leadId": "lead-id-here",
      "similarityScore": 95,
      "reason": "Exact domain match and identical company name"
    }
  ]
}

Include only leads with similarity >= 70. Order by similarity descending.
Do not include any other text before or after the JSON.`

  const existingLeadsText = existingLeads
    .map(
      (lead) =>
        `ID: ${lead.id}, Name: ${lead.companyName}, Website: ${lead.website || 'N/A'}, Country: ${lead.country || 'N/A'}`
    )
    .join('\n')

  const prompt = `Detect duplicates for this new lead:

NEW LEAD:
Company: ${newLead.companyName}
Website: ${newLead.website || 'N/A'}
Country: ${newLead.country || 'N/A'}
Industry: ${newLead.industry || 'N/A'}

EXISTING LEADS:
${existingLeadsText}

Find any potential duplicates and score their similarity (0-100).`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: options.maxTokens || 1024,
    temperature: options.temperature || 0.3, // Low temperature for consistency
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const responseText = extractTextContent(message.content)

  try {
    const result = JSON.parse(responseText)
    return result.duplicates || []
  } catch {
    return []
  }
}

/**
 * Extract text content from Claude message response
 */
function extractTextContent(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block) => block.type === 'text')
    .map((block) => (block as Anthropic.TextBlock).text)
    .join('\n')
}

/**
 * Helper: Generate prompt for email based on lead data and type
 */
function generateEmailPrompt(
  leadData: {
    companyName: string
    industry?: string
    website?: string
    description?: string
    yourCompanyName?: string
    yourServices?: string
  },
  emailType: string
): string {
  const basePrompt = `Generate a professional business email for:

Company: ${leadData.companyName}
${leadData.industry ? `Industry: ${leadData.industry}` : ''}
${leadData.website ? `Website: ${leadData.website}` : ''}
${leadData.description ? `Business: ${leadData.description}` : ''}
${leadData.yourCompanyName ? `From Company: ${leadData.yourCompanyName}` : ''}
${leadData.yourServices ? `Our Services: ${leadData.yourServices}` : ''}

Email Type: ${emailType.replace('_', ' ')}`

  return basePrompt
}

/**
 * Health check - Verify API connectivity
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: 'Say OK',
        },
      ],
    })
    return message.content.length > 0
  } catch (error) {
    console.error('AI Service health check failed:', error)
    return false
  }
}
