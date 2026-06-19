import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import {
  convertToCSV,
  formatLeadForExport,
  filterLeads,
  generateHTMLReport,
  ExportOptions,
} from '@/services/export'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const dateFromStr = searchParams.get('dateFrom')
    const dateToStr = searchParams.get('dateTo')
    const minScoreStr = searchParams.get('minScore')
    const maxScoreStr = searchParams.get('maxScore')
    const status = searchParams.get('status')
    const industriesStr = searchParams.get('industries')

    // Parse filters
    const options: ExportOptions = {}
    if (dateFromStr) options.dateFrom = new Date(dateFromStr)
    if (dateToStr) options.dateTo = new Date(dateToStr)
    if (minScoreStr) options.minScore = parseInt(minScoreStr, 10)
    if (maxScoreStr) options.maxScore = parseInt(maxScoreStr, 10)
    if (status) options.status = status
    if (industriesStr) options.industries = industriesStr.split(',')

    // Fetch leads
    const leads = await prisma.lead.findMany({
      where: { ownerUserId: session.user.id },
      orderBy: { leadScore: 'desc' },
    })

    // Apply filters
    const filteredLeads = filterLeads(leads, options)

    if (format === 'csv') {
      // Format leads for CSV export
      const csvData = filteredLeads.map(formatLeadForExport)
      const csv = convertToCSV(csvData)

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="leads-export.csv"',
        },
      })
    } else if (format === 'html') {
      // Generate HTML report
      const totalLeads = filteredLeads.length
      const averageScore =
        totalLeads > 0
          ? Math.round(filteredLeads.reduce((sum: number, l: any) => sum + l.leadScore, 0) / totalLeads)
          : 0
      const highScoreCount = filteredLeads.filter((l: any) => l.leadScore >= 80).length

      // Get closed leads from activity logs
      const closedLeads = filteredLeads.filter((l: any) => l.status === 'CLOSED').length
      const conversionRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0

      // Get top industries
      const industriesCounts: Record<string, number> = {}
      filteredLeads.forEach((l: any) => {
        if (l.industry) {
          industriesCounts[l.industry] = (industriesCounts[l.industry] || 0) + 1
        }
      })
      const topIndustries = Object.entries(industriesCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

      const html = generateHTMLReport(
        'Lead Report',
        {
          totalLeads,
          averageScore,
          highScoreCount,
          conversionRate,
          topIndustries,
        },
        filteredLeads.slice(0, 20).map((l: any) => ({
          companyName: l.companyName,
          score: l.leadScore,
          status: l.status,
          industry: l.industry,
        }))
      )

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': 'attachment; filename="report.html"',
        },
      })
    } else {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
    }
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
