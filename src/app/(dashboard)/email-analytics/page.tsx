import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function EmailAnalyticsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  // Get email statistics
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Email counts by status
  const emailStats = await prisma.outreachEmail.groupBy({
    by: ['status'],
    where: { userId: session.user.id },
    _count: true
  })

  // Today's emails
  const todayEmails = await prisma.outreachEmail.count({
    where: {
      userId: session.user.id,
      sentAt: { gte: todayStart }
    }
  })

  // This week emails
  const weekEmails = await prisma.outreachEmail.count({
    where: {
      userId: session.user.id,
      sentAt: { gte: weekStart }
    }
  })

  // Recent activity log
  const recentActivity = await prisma.activityLog.findMany({
    where: {
      userId: session.user.id,
      action: { in: ['EMAIL_SENT', 'EMAIL_OPENED', 'EMAIL_CLICKED', 'EMAIL_BOUNCED'] }
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { lead: { select: { companyName: true } } }
  })

  // Email status breakdown
  const statusCounts = {
    DRAFT: emailStats.find(s => s.status === 'DRAFT')?._count || 0,
    SCHEDULED: emailStats.find(s => s.status === 'SCHEDULED')?._count || 0,
    SENT: emailStats.find(s => s.status === 'SENT')?._count || 0,
    OPENED: emailStats.find(s => s.status === 'OPENED')?._count || 0,
    CLICKED: emailStats.find(s => s.status === 'CLICKED')?._count || 0,
    REPLIED: emailStats.find(s => s.status === 'REPLIED')?._count || 0,
    BOUNCED: emailStats.find(s => s.status === 'BOUNCED')?._count || 0
  }

  const totalSent = statusCounts.SENT + statusCounts.OPENED + statusCounts.CLICKED + statusCounts.REPLIED
  const openRate = totalSent > 0 ? ((statusCounts.OPENED + statusCounts.CLICKED + statusCounts.REPLIED) / totalSent * 100).toFixed(1) : 0
  const clickRate = totalSent > 0 ? ((statusCounts.CLICKED + statusCounts.REPLIED) / totalSent * 100).toFixed(1) : 0
  const replyRate = totalSent > 0 ? (statusCounts.REPLIED / totalSent * 100).toFixed(1) : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Email Analytics</h1>
        <p className="text-gray-600 mt-2">Track your outreach performance and engagement metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-gray-600 text-sm font-medium">Today</div>
          <div className="text-3xl font-bold mt-2">{todayEmails}</div>
          <div className="text-gray-500 text-xs mt-2">emails sent</div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-gray-600 text-sm font-medium">This Week</div>
          <div className="text-3xl font-bold mt-2">{weekEmails}</div>
          <div className="text-gray-500 text-xs mt-2">total sent</div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-gray-600 text-sm font-medium">Open Rate</div>
          <div className="text-3xl font-bold mt-2">{openRate}%</div>
          <div className="text-gray-500 text-xs mt-2">{statusCounts.OPENED} opened</div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-gray-600 text-sm font-medium">Reply Rate</div>
          <div className="text-3xl font-bold mt-2 text-green-600">{replyRate}%</div>
          <div className="text-gray-500 text-xs mt-2">{statusCounts.REPLIED} replies</div>
        </div>
      </div>

      {/* Email Status Breakdown */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Email Status Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Draft', count: statusCounts.DRAFT, color: 'bg-gray-100' },
            { label: 'Scheduled', count: statusCounts.SCHEDULED, color: 'bg-blue-100' },
            { label: 'Sent', count: statusCounts.SENT, color: 'bg-purple-100' },
            { label: 'Opened', count: statusCounts.OPENED, color: 'bg-yellow-100' },
            { label: 'Clicked', count: statusCounts.CLICKED, color: 'bg-orange-100' },
            { label: 'Replied', count: statusCounts.REPLIED, color: 'bg-green-100' },
            { label: 'Bounced', count: statusCounts.BOUNCED, color: 'bg-red-100' }
          ].map(item => (
            <div key={item.label} className={`p-4 rounded ${item.color}`}>
              <div className="text-gray-600 text-sm">{item.label}</div>
              <div className="text-2xl font-bold">{item.count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Performance Metrics</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Open Rate</span>
              <span className="font-semibold">{openRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded h-2">
              <div className="bg-blue-500 h-2 rounded" style={{ width: `${openRate}%` }} />
            </div>

            <div className="flex justify-between items-center mt-4">
              <span className="text-gray-600">Click Rate</span>
              <span className="font-semibold">{clickRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded h-2">
              <div className="bg-orange-500 h-2 rounded" style={{ width: `${clickRate}%` }} />
            </div>

            <div className="flex justify-between items-center mt-4">
              <span className="text-gray-600">Reply Rate</span>
              <span className="font-semibold">{replyRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded h-2">
              <div className="bg-green-500 h-2 rounded" style={{ width: `${replyRate}%` }} />
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Summary</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-gray-600">Total Sent (All Time)</span>
              <span className="font-semibold">{totalSent}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600">Total Opened</span>
              <span className="font-semibold">{statusCounts.OPENED}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600">Total Clicked</span>
              <span className="font-semibold">{statusCounts.CLICKED}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600">Total Replied</span>
              <span className="font-semibold">{statusCounts.REPLIED}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600">Bounced</span>
              <span className="font-semibold text-red-600">{statusCounts.BOUNCED}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {recentActivity.length > 0 ? (
            recentActivity.map(activity => (
              <div key={activity.id} className="flex justify-between items-center pb-3 border-b border-gray-100 last:border-b-0">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {activity.action.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {activity.lead?.companyName} • {activity.createdAt.toLocaleDateString()}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {activity.createdAt.toLocaleTimeString()}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              No email activity yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
