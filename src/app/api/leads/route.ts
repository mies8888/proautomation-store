import { NextRequest, NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/prisma"
import { withErrorHandling, ForbiddenError } from '@/lib/errors/handler'

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const data = await req.json()
  
  if (!data.companyName) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 })
  }

  // Calculate a mock score for manually added leads
  const mockScore = Math.floor(Math.random() * 40) + 40 // 40-80 score

  const lead = await prisma.lead.create({
    data: {
      ownerUserId: session.user.id,
      companyName: data.companyName,
      websiteUrl: data.websiteUrl || null,
      industry: data.industry || null,
      leadScore: mockScore,
      status: "NEW",
      activityLogs: {
        create: {
          userId: session.user.id,
          action: "LEAD_CREATED",
          metadata: { source: "manual_entry" }
        }
      }
    }
  })

  return NextResponse.json(lead, { status: 201 })
})
