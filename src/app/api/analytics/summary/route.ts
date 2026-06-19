import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Fetch all leads for the user
    const leads = await prisma.lead.findMany({
      where: { ownerUserId: userId },
      include: {
        outreachEmails: true,
        activityLogs: true,
      },
    })

    // Fetch credit transactions for revenue
    const creditTransactions = await prisma.creditTransaction.findMany({
      where: { userId },
    })

    // Fetch activity logs
    const activityLogs = await prisma.activityLog.findMany({
      where: { userId },
      include: { lead: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Calculate metrics
    const totalLeads = leads.length
    const openOpportunities = leads.filter(
      (l: any) => l.status === 'NEW' || l.status === 'IN_PROGRESS'
    ).length
    const closedLeads = leads.filter((l: any) => l.status === 'CLOSED').length
    
    const allEmails = leads.flatMap((l: any) => l.outreachEmails)
    const pendingEmails = allEmails.filter((e: any) => e.status === 'DRAFT').length
    const sentEmails = allEmails.filter((e: any) => e.sentAt !== null).length

    // Calculate revenue (sum of credit transactions)
    const totalRevenue = creditTransactions.reduce((sum: number, tx: any) => sum + tx.amount, 0)

    // Calculate average lead score
    const averageLeadScore = totalLeads > 0
      ? Math.round(leads.reduce((sum: number, l: any) => sum + l.leadScore, 0) / totalLeads)
      : 0

    // Calculate conversion rate
    const conversionRate = totalLeads > 0
      ? Math.round((closedLeads / totalLeads) * 100)
      : 0

// Calculate email engagement rates
     const emailOpenCount = activityLogs.filter((a: any) => a.action === 'EMAIL_OPENED').length
     const emailClickCount = activityLogs.filter((a: any) => a.action === 'EMAIL_CLICKED').length
    const emailOpenRate = sentEmails > 0
      ? Math.round((emailOpenCount / sentEmails) * 100)
      : 0
    const emailClickRate = sentEmails > 0
      ? Math.round((emailClickCount / sentEmails) * 100)
      : 0

    // Group by industry (top 5)
    const industriesCounts: Record<string, number> = {}
    leads.forEach((l: any) => {
      if (l.industry) {
        industriesCounts[l.industry] = (industriesCounts[l.industry] || 0) + 1
      }
    })
    const topIndustries = Object.entries(industriesCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Lead status breakdown
    const statusCounts: Record<string, number> = {}
    leads.forEach((l: any) => {
      statusCounts[l.status || 'UNKNOWN'] = (statusCounts[l.status || 'UNKNOWN'] || 0) + 1
    })
    const leadStatusBreakdown = Object.entries(statusCounts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count)

    // Scoring distribution
    const scoringRanges = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0,
    }
    leads.forEach((l: any) => {
      const score = l.leadScore
      if (score <= 20) scoringRanges['0-20']++
      else if (score <= 40) scoringRanges['21-40']++
      else if (score <= 60) scoringRanges['41-60']++
      else if (score <= 80) scoringRanges['61-80']++
      else scoringRanges['81-100']++
    })
    const scoringDistribution = Object.entries(scoringRanges)
      .map(([range, count]) => ({ range, count }))

    // Recent activity
    const recentActivity = activityLogs.slice(0, 20).map((log: any) => ({
      id: log.id,
      action: log.action,
      leadName: log.lead?.companyName,
      timestamp: log.createdAt.toISOString(),
    }))

    return NextResponse.json({
      totalLeads,
      openOpportunities,
      closedLeads,
      pendingEmails,
      sentEmails,
      totalRevenue,
      averageLeadScore,
      conversionRate,
      emailOpenRate,
      emailClickRate,
      topIndustries,
      leadStatusBreakdown,
      scoringDistribution,
      recentActivity,
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
