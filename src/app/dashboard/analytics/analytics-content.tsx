'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'

interface AnalyticsData {
  totalLeads: number
  openOpportunities: number
  closedLeads: number
  pendingEmails: number
  sentEmails: number
  totalRevenue: number
  averageLeadScore: number
  conversionRate: number
  emailOpenRate: number
  emailClickRate: number
  topIndustries: { name: string; count: number }[]
  leadStatusBreakdown: { status: string; count: number }[]
  scoringDistribution: { range: string; count: number }[]
  recentActivity: {
    id: string
    action: string
    leadName?: string
    timestamp: string
  }[]
}

interface StatsCardProps {
  label: string
  value: string | number
  icon: string
  trend?: number
  unit?: string
}

function StatsCard({ label, value, icon, trend, unit = '' }: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-600 text-sm font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {value}
            {unit && <span className="text-lg text-gray-600 ml-1">{unit}</span>}
          </p>
          {trend !== undefined && (
            <p className={`text-sm mt-2 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last month
            </p>
          )}
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  )
}

interface BarChartProps {
  title: string
  data: Array<{ label: string; value: number }>
  maxValue?: number
}

function BarChart({ title, data, maxValue }: BarChartProps) {
  const max = maxValue || Math.max(...data.map(d => d.value), 1)

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.label}>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
              <span className="text-sm text-gray-600">{item.value}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface TableProps {
  title: string
  columns: string[]
  rows: Array<Record<string, any>>
}

function Table({ title, columns, rows }: TableProps) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-4 text-center text-gray-500">
                  No data available
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col} className="px-6 py-4 text-sm text-gray-900">
                      {row[col.toLowerCase()] || '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AnalyticsContent() {
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)

  if (status === 'loading') {
    return <div className="p-8">Loading...</div>
  }

  if (status === 'unauthenticated') {
    redirect('/login')
  }

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch('/api/analytics/summary')
        if (!response.ok) {
          throw new Error('Failed to fetch analytics')
        }
        const data = await response.json()
        setAnalytics(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Failed to load analytics'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-2">Track your leads, engagement, and performance metrics</p>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard 
            label="Total Leads" 
            value={analytics.totalLeads} 
            icon="📊"
            trend={5}
          />
          <StatsCard 
            label="Open Opportunities" 
            value={analytics.openOpportunities} 
            icon="🎯"
            trend={12}
          />
          <StatsCard 
            label="Emails Sent" 
            value={analytics.sentEmails} 
            icon="📧"
            trend={8}
          />
          <StatsCard 
            label="Total Revenue" 
            value={`$${(analytics.totalRevenue / 100).toFixed(2)}`} 
            icon="💰"
            trend={15}
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard 
            label="Avg Lead Score" 
            value={analytics.averageLeadScore} 
            icon="⭐"
            unit="/100"
          />
          <StatsCard 
            label="Conversion Rate" 
            value={analytics.conversionRate} 
            icon="✅"
            unit="%"
          />
          <StatsCard 
            label="Email Open Rate" 
            value={analytics.emailOpenRate} 
            icon="👁️"
            unit="%"
          />
          <StatsCard 
            label="Email Click Rate" 
            value={analytics.emailClickRate} 
            icon="🔗"
            unit="%"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <BarChart 
            title="Lead Status Breakdown"
            data={analytics.leadStatusBreakdown.map(item => ({
              label: item.status,
              value: item.count
            }))}
          />
          <BarChart 
            title="Scoring Distribution"
            data={analytics.scoringDistribution.map(item => ({
              label: item.range,
              value: item.count
            }))}
          />
        </div>

        {/* Top Industries */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          <BarChart 
            title="Top Industries"
            data={analytics.topIndustries.map(item => ({
              label: item.name,
              value: item.count
            }))}
          />
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 gap-6">
          <Table
            title="Recent Activity"
            columns={['Timestamp', 'Action', 'Lead']}
            rows={analytics.recentActivity.map(activity => ({
              timestamp: new Date(activity.timestamp).toLocaleDateString(),
              action: activity.action,
              lead: activity.leadName || '-'
            }))}
          />
        </div>
      </div>
    </div>
  )
}
