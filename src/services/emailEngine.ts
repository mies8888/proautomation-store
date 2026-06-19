import { OpportunityReport, Lead } from '@prisma/client'

export async function generateColdEmail(lead: Lead, report: OpportunityReport): Promise<{ subject: string, body: string }> {
  // Simulate AI latency
  await new Promise(resolve => setTimeout(resolve, 2500))

  const companyName = lead.companyName

  const subject = `Quick question about ${companyName}'s website performance`

  const body = `Hi there,

I was doing some research on ${lead.industry} companies in ${lead.city} and came across your website.

I ran a quick audit on your site and noticed a few technical bottlenecks that might be costing you leads. I've actually put together a detailed Growth Opportunity Report specifically for ${companyName} that outlines these issues and how to fix them.

Would you be open to me sending that report over? No strings attached, just thought it might be helpful.

Best regards,
ProAutomation Engine`

  return { subject, body }
}
