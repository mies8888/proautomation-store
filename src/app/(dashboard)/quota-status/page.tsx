'use client'

import { useState, useEffect } from 'react'

interface QuotaInfo {
  tier: 'FREE' | 'PREMIUM' | 'ELITE'
  emailsSent: number
  emailsToday: number
  emailsThisHour: number
  dailyLimit: number
  hourlyLimit: number
  creditsRemaining: number
  creditsDailyLimit: number
  resetTime: string
  hourlyResetTime: string
  percentUsedDaily: number
  percentUsedHourly: number
  isNearLimit: boolean
  message?: string
}

export default function QuotaDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [quota, setQuota] = useState<QuotaInfo | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadQuota = async () => {
      try {
        const response = await fetch('/api/rate-limits')
        if (!response.ok) {
          if (response.status === 429) {
            setError('You have exceeded your rate limit. Please wait before sending more emails.')
          } else {
            throw new Error('Failed to load quota')
          }
          return
        }

        const data = await response.json()
        setQuota(data)
      } catch (err) {
        console.error(err)
        setError('Failed to load quota information')
      } finally {
        setLoading(false)
      }
    }

    loadQuota()
    const interval = setInterval(loadQuota, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'FREE':
        return { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-900', badge: 'bg-gray-200 text-gray-800' }
      case 'PREMIUM':
        return { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-900', badge: 'bg-blue-200 text-blue-800' }
      case 'ELITE':
        return { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-900', badge: 'bg-purple-200 text-purple-800' }
      default:
        return { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-900', badge: 'bg-gray-200 text-gray-800' }
    }
  }

  const getProgressColor = (percent: number) => {
    if (percent < 50) return 'bg-green-500'
    if (percent < 80) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getStatusIcon = (percent: number) => {
    if (percent < 50) return '✅'
    if (percent < 80) return '⚠️'
    return '🚫'
  }

  if (loading) {
    return <div className="text-center py-8">Loading quota information...</div>
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-300 rounded-lg p-6 text-red-900">
          <p className="font-semibold">Error Loading Quota</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    )
  }

  if (!quota) {
    return <div className="text-center py-8">No quota information available</div>
  }

  const tierStyle = getTierColor(quota.tier)

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Quota & Rate Limits</h1>
        <p className="text-gray-600 mt-2">Monitor your email sending quota and usage</p>
      </div>

      {/* Tier Badge */}
      <div className="mb-6 flex items-center gap-4">
        <div className={`px-4 py-2 rounded-full font-semibold ${tierStyle.badge}`}>
          {quota.tier} Plan
        </div>
        <p className="text-sm text-gray-600">
          Current usage across all limits
        </p>
      </div>

      {/* Alert Banner */}
      {quota.isNearLimit && (
        <div className="mb-6 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
          <p className="font-semibold text-yellow-900">⚠️ Approaching Limit</p>
          <p className="text-sm text-yellow-800 mt-1">
            You are using {quota.percentUsedDaily.toFixed(0)}% of your daily quota. 
            {quota.message && ` ${quota.message}`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Quota */}
        <div className={`${tierStyle.bg} border-2 ${tierStyle.border} rounded-lg p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Daily Limit</h2>
            <span className="text-2xl">{getStatusIcon(quota.percentUsedDaily)}</span>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                {quota.emailsToday} / {quota.dailyLimit} emails sent today
              </p>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all ${getProgressColor(quota.percentUsedDaily)}`}
                  style={{ width: `${Math.min(quota.percentUsedDaily, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {quota.percentUsedDaily.toFixed(1)}% used
              </p>
            </div>

            <div className="bg-white bg-opacity-50 rounded p-3 text-sm">
              <p className="text-gray-700">
                <strong>{quota.dailyLimit - quota.emailsToday}</strong> emails remaining
              </p>
              <p className="text-gray-600 text-xs mt-1">
                Resets at {new Date(quota.resetTime).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>

        {/* Hourly Quota */}
        <div className={`${tierStyle.bg} border-2 ${tierStyle.border} rounded-lg p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Hourly Limit</h2>
            <span className="text-2xl">{getStatusIcon(quota.percentUsedHourly)}</span>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                {quota.emailsThisHour} / {quota.hourlyLimit} emails sent this hour
              </p>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all ${getProgressColor(quota.percentUsedHourly)}`}
                  style={{ width: `${Math.min(quota.percentUsedHourly, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {quota.percentUsedHourly.toFixed(1)}% used
              </p>
            </div>

            <div className="bg-white bg-opacity-50 rounded p-3 text-sm">
              <p className="text-gray-700">
                <strong>{Math.max(0, quota.hourlyLimit - quota.emailsThisHour)}</strong> emails remaining
              </p>
              <p className="text-gray-600 text-xs mt-1">
                Resets at {new Date(quota.hourlyResetTime).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Credit System (if applicable) */}
      {quota.creditsRemaining !== undefined && (
        <div className="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Credit System</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Credits Remaining</p>
              <p className="text-3xl font-bold text-purple-600">{quota.creditsRemaining.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Daily Limit from Credits</p>
              <p className="text-3xl font-bold text-purple-600">{quota.creditsDailyLimit.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Priority Override</p>
              <p className="text-sm text-gray-700 mt-2">
                Credits allow you to exceed tier limits. Each credit enables 2 additional emails per day.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Plan Limits Table */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Plan Details</h2>
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-300">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-900">Limit Type</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-900">FREE</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-900">PREMIUM</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-900">ELITE</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">Daily Limit</td>
                <td className="px-4 py-3 text-sm text-gray-700">50 emails</td>
                <td className="px-4 py-3 text-sm text-gray-700">500 emails</td>
                <td className="px-4 py-3 text-sm text-gray-700">5,000 emails</td>
              </tr>
              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">Hourly Limit</td>
                <td className="px-4 py-3 text-sm text-gray-700">10 emails</td>
                <td className="px-4 py-3 text-sm text-gray-700">100 emails</td>
                <td className="px-4 py-3 text-sm text-gray-700">500 emails</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">Credit Override</td>
                <td className="px-4 py-3 text-sm text-gray-700">1 credit = 2 emails/day</td>
                <td className="px-4 py-3 text-sm text-gray-700">1 credit = 2 emails/day</td>
                <td className="px-4 py-3 text-sm text-gray-700">1 credit = 2 emails/day</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage Tips */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">💡 Tips to Optimize Usage</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>✓ Use email scheduling to spread sends throughout the day</li>
          <li>✓ Batch similar emails to maximize A/B testing efficiency</li>
          <li>✓ Set up sequences to automate follow-ups without manual sends</li>
          <li>✓ Monitor reply detection to identify engaged leads early</li>
          <li>✓ Upgrade to PREMIUM or ELITE for higher limits</li>
        </ul>
      </div>
    </div>
  )
}
