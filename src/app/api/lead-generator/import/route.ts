import { NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/prisma"

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leads } = await request.json()

  if (!leads || !Array.isArray(leads)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  try {
    const importedLeads = []

    for (const lead of leads) {
      // In a production app, we would validate each field using Zod
      const newLead = await prisma.lead.create({
        data: {
          ownerUserId: session.user.id,
          companyName: lead.companyName,
          websiteUrl: lead.websiteUrl,
          industry: lead.industry,
          country: lead.country,
          city: lead.city,
          contactEmail: lead.contactEmail,
          phone: lead.phone,
          leadScore: lead.leadScore,
          status: 'NEW'
        }
      })

      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          leadId: newLead.id,
          action: 'IMPORTED_FROM_GENERATOR',
          metadata: { source: 'LEAD_GENERATOR' }
        }
      })

      importedLeads.push(newLead)
    }

    return NextResponse.json({ success: true, count: importedLeads.length })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Failed to import leads' }, { status: 500 })
  }
}
