'use client'

import { useState, useEffect } from 'react'

interface ABTest {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED'
  variantA: string
  variantB: string
  createdAt: string
  completedAt?: string
  resultsA: {
    sent: number
    opens: number
    clicks: number
    replies: number
  }
  resultsB: {
    sent: number
    opens: number
    clicks: number
    replies: number
  }
  winner?: 'A' | 'B' | 'TIE'
}

interface CampaignStats {
  totalSent: number
  totalOpened: number
  totalClicked: number
  totalReplied: number
  openRate: number
  clickRate: number
  replyRate: number
  avgOpenRate: number
  avgClickRate: number
  avgReplyRate: number
  topPerformingTest?: string
  topPerformingVariant?: string
}

export default function CampaignPerformancePage() {
  const [loading, setLoading] = useState(true)
  const [tests, setTests] = useState<ABTest[]>([])
  const [stats, setStats] = useState<CampaignStats>({
    totalSent: 0,
    totalOpened: 0,
    totalClicked: 0,
    totalReplied: 0,
    openRate: 0,
    clickRate: 0,
    replyRate: 0,
    avgOpenRate: 0,
    avgClickRate: 0,
    avgReplyRate: 0
  })
  const [selectedTest, setSelectedTest] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(`/api/ab-tests?timeRange=${timeRange}`)
        if (!response.ok) throw new Error('Failed to load campaigns')
        
        const data = await response.json()
        const testsData = data.tests || []
        setTests(testsData)

        // Calculate aggregated stats
        const aggregated: CampaignStats = {
          totalSent: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalReplied: 0,
          openRate: 0,
          clickRate: 0,
          replyRate: 0,
          avgOpenRate: 0,
          avgClickRate: 0,
          avgReplyRate: 0
        }

        let testCount = 0
        let openRateSum = 0
        let clickRateSum = 0
        let replyRateSum = 0

        testsData.forEach((test: ABTest) => {
          const totalSent = test.resultsA.sent + test.resultsB.sent
          const totalOpened = test.resultsA.opens + test.resultsB.opens
          const totalClicked = test.resultsA.clicks + test.resultsB.clicks
          const totalReplied = test.resultsA.replies + test.resultsB.replies

          aggregated.totalSent += totalSent
          aggregated.totalOpened += totalOpened
          aggregated.totalClicked += totalClicked
          aggregated.totalReplied += totalReplied

          if (totalSent > 0) {
            openRateSum += (totalOpened / totalSent) * 100
            clickRateSum += (totalClicked / totalSent) * 100
            replyRateSum += (totalReplied / totalSent) * 100
            testCount++
          }
        })

        if (aggregated.totalSent > 0) {
          aggregated.openRate = (aggregated.totalOpened / aggregated.totalSent) * 100
          aggregated.clickRate = (aggregated.totalClicked / aggregated.totalSent) * 100
          aggregated.replyRate = (aggregated.totalReplied / aggregated.totalSent) * 100
        }

        if (testCount > 0) {
          aggregated.avgOpenRate = openRateSum / testCount
          aggregated.avgClickRate = clickRateSum / testCount
          aggregated.avgReplyRate = replyRateSum / testCount
        }

        // Find top performing test
        if (testsData.length > 0) {
          const topTest = testsData.reduce((best: ABTest, current: ABTest) => {
            const bestRate = best.resultsA.opens + best.resultsB.opens
            const currentRate = current.resultsA.opens + current.resultsB.opens
            return currentRate > bestRate ? current : best
          })
          aggregated.topPerformingTest = topTest.name
          
          const rateA = topTest.resultsA.sent > 0 ? (topTest.resultsA.opens / topTest.resultsA.sent) * 100 : 0
          const rateB = topTest.resultsB.sent > 0 ? (topTest.resultsB.opens / topTest.resultsB.sent) * 100 : 0
          aggregated.topPerformingVariant = rateA >= rateB ? 'A' : 'B'
        }

        setStats(aggregated)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [timeRange])

  const getTestWinner = (test: ABTest) => {
    const rateA = test.resultsA.sent > 0 ? (test.resultsA.opens / test.resultsA.sent) * 100 : 0
    const rateB = test.resultsB.sent > 0 ? (test.resultsB.opens / test.resultsB.sent) * 100 : 0
    const diff = Math.abs(rateA - rateB)
    
    if (diff < 2) return { winner: 'TIE', confidence: 'Low' }
    if (diff < 5) return { winner: rateA > rateB ? 'A' : 'B', confidence: 'Medium' }
    return { winner: rateA > rateB ? 'A' : 'B', confidence: 'High' }
  }

  const selectedTestData = tests.find(t => t.id === selectedTest)

  if (loading) {
    return <div className="text-center py-8">Loading campaign data...</div>
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Campaign Performance</h1>
        <p className="text-gray-600 mt-2">Track A/B test results and email metrics</p>
      </div>

      {/* Time Range Filter */}
      <div className="mb-6 flex gap-2">
        {(['7d', '30d', '90d', 'all'] as const).map(range => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              timeRange === range
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
            }`}
          >
            {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : range === '90d' ? 'Last 90 Days' : 'All Time'}
          </button>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 font-medium">Total Sent</p>
          <p className="text-3xl font-bold mt-2">{stats.totalSent.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">Across all campaigns</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 font-medium">Open Rate</p>
          <p className="text-3xl font-bold mt-2">{stats.openRate.toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-2">Average: {stats.avgOpenRate.toFixed(1)}%</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 font-medium">Click Rate</p>
          <p className="text-3xl font-bold mt-2">{stats.clickRate.toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-2">Average: {stats.avgClickRate.toFixed(1)}%</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 font-medium">Reply Rate</p>
          <p className="text-3xl font-bold mt-2">{stats.replyRate.toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-2">Average: {stats.avgReplyRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Performance Insight */}
      {stats.topPerformingTest && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
          <p className="font-semibold text-green-900">📈 Top Performing Campaign</p>
          <p className="text-sm text-green-800 mt-1">
            <strong>{stats.topPerformingTest}</strong> is performing best with variant <strong>{stats.topPerformingVariant}</strong> leading
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Test List */}
        <div className="lg:col-span-1 bg-white rounded-lg border border-gray-200 p-6 h-fit">
          <h2 className="text-lg font-semibold mb-4">A/B Tests</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {tests.length === 0 ? (
              <p className="text-sm text-gray-500">No campaigns yet</p>
            ) : (
              tests.map(test => (
                <button
                  key={test.id}
                  onClick={() => setSelectedTest(test.id)}
                  className={`w-full text-left p-3 rounded-lg transition text-sm ${
                    selectedTest === test.id
                      ? 'bg-blue-100 border border-blue-300'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <p className="font-medium truncate">{test.name}</p>
                  <p className="text-xs text-gray-600">
                    Status: <span className={`font-semibold ${
                      test.status === 'ACTIVE' ? 'text-green-600' : 
                      test.status === 'PAUSED' ? 'text-yellow-600' : 
                      'text-gray-600'
                    }`}>
                      {test.status}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Sent: {test.resultsA.sent + test.resultsB.sent}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Test Details */}
        <div className="lg:col-span-2">
          {selectedTestData ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold">{selectedTestData.name}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Status: <span className={`font-semibold ${
                    selectedTestData.status === 'ACTIVE' ? 'text-green-600' : 
                    selectedTestData.status === 'PAUSED' ? 'text-yellow-600' : 
                    'text-gray-600'
                  }`}>
                    {selectedTestData.status}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Created: {new Date(selectedTestData.createdAt).toLocaleDateString()}
                </p>
              </div>

              {/* Variant Comparison */}
              <div className="grid grid-cols-2 gap-4">
                {/* Variant A */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="font-semibold text-blue-900 mb-3">Variant A</p>
                  <p className="text-sm text-blue-800 mb-3 line-clamp-2">{selectedTestData.variantA}</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Sent:</span>
                      <span className="font-semibold">{selectedTestData.resultsA.sent}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Opens:</span>
                      <span className="font-semibold">
                        {selectedTestData.resultsA.opens} 
                        ({selectedTestData.resultsA.sent > 0 ? ((selectedTestData.resultsA.opens / selectedTestData.resultsA.sent) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Clicks:</span>
                      <span className="font-semibold">
                        {selectedTestData.resultsA.clicks} 
                        ({selectedTestData.resultsA.sent > 0 ? ((selectedTestData.resultsA.clicks / selectedTestData.resultsA.sent) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Replies:</span>
                      <span className="font-semibold">
                        {selectedTestData.resultsA.replies} 
                        ({selectedTestData.resultsA.sent > 0 ? ((selectedTestData.resultsA.replies / selectedTestData.resultsA.sent) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Variant B */}
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="font-semibold text-green-900 mb-3">Variant B</p>
                  <p className="text-sm text-green-800 mb-3 line-clamp-2">{selectedTestData.variantB}</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Sent:</span>
                      <span className="font-semibold">{selectedTestData.resultsB.sent}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Opens:</span>
                      <span className="font-semibold">
                        {selectedTestData.resultsB.opens} 
                        ({selectedTestData.resultsB.sent > 0 ? ((selectedTestData.resultsB.opens / selectedTestData.resultsB.sent) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Clicks:</span>
                      <span className="font-semibold">
                        {selectedTestData.resultsB.clicks} 
                        ({selectedTestData.resultsB.sent > 0 ? ((selectedTestData.resultsB.clicks / selectedTestData.resultsB.sent) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Replies:</span>
                      <span className="font-semibold">
                        {selectedTestData.resultsB.replies} 
                        ({selectedTestData.resultsB.sent > 0 ? ((selectedTestData.resultsB.replies / selectedTestData.resultsB.sent) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Winner Badge */}
              {selectedTestData.status === 'COMPLETED' && (
                <div className={`p-4 rounded-lg ${
                  getTestWinner(selectedTestData).winner === 'TIE' ? 'bg-gray-100' : 
                  getTestWinner(selectedTestData).winner === 'A' ? 'bg-blue-100' : 'bg-green-100'
                }`}>
                  <p className="font-semibold">Test Result</p>
                  <p className="text-sm mt-1">
                    Winner: <strong>{
                      getTestWinner(selectedTestData).winner === 'TIE' ? 
                      'No clear winner' : 
                      `Variant ${getTestWinner(selectedTestData).winner}`
                    }</strong> 
                    ({getTestWinner(selectedTestData).confidence} confidence)
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-12 text-center">
              <p className="text-gray-600">Select a campaign to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
