'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle2, Clock, RotateCw, Trash2, Play } from 'lucide-react'

interface JobStatus {
  id: string
  emailId: string
  scheduleTime: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  retryCount: number
  error?: string
}

interface QueueStats {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
}

export default function JobQueueMonitorPage() {
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [jobs, setJobs] = useState<JobStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchQueueStatus = async () => {
    try {
      const response = await fetch('/api/jobs/queue', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) throw new Error('Failed to fetch queue status')

      const data = await response.json()
      setStats(data.stats)
      setJobs(data.jobs || [])
    } catch (err) {
      console.error('Error fetching queue status:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQueueStatus()

    if (autoRefresh) {
      const interval = setInterval(fetchQueueStatus, 5000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const triggerProcessing = async () => {
    try {
      const response = await fetch('/api/jobs/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) throw new Error('Failed to trigger processing')

      await fetchQueueStatus()
      alert('Queue processing triggered')
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-50 text-yellow-900'
      case 'PROCESSING':
        return 'bg-blue-50 text-blue-900'
      case 'COMPLETED':
        return 'bg-green-50 text-green-900'
      case 'FAILED':
        return 'bg-red-50 text-red-900'
      default:
        return 'bg-gray-50 text-gray-900'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-4 h-4" />
      case 'PROCESSING':
        return <RotateCw className="w-4 h-4 animate-spin" />
      case 'COMPLETED':
        return <CheckCircle2 className="w-4 h-4" />
      case 'FAILED':
        return <AlertCircle className="w-4 h-4" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RotateCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Loading queue status...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Job Queue Monitor</h1>
        <div className="flex gap-2">
          <button
            onClick={triggerProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Play className="w-4 h-4" />
            Process Now
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-200 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4"
            />
            Auto Refresh (5s)
          </label>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-gray-600 text-sm font-medium mb-1">Total Jobs</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>

          <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200 shadow-sm">
            <p className="text-yellow-700 text-sm font-medium mb-1">Pending</p>
            <p className="text-3xl font-bold text-yellow-900">{stats.pending}</p>
          </div>

          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 shadow-sm">
            <p className="text-blue-700 text-sm font-medium mb-1">Processing</p>
            <p className="text-3xl font-bold text-blue-900">{stats.processing}</p>
          </div>

          <div className="bg-green-50 p-6 rounded-lg border border-green-200 shadow-sm">
            <p className="text-green-700 text-sm font-medium mb-1">Completed</p>
            <p className="text-3xl font-bold text-green-900">{stats.completed}</p>
          </div>

          <div className="bg-red-50 p-6 rounded-lg border border-red-200 shadow-sm">
            <p className="text-red-700 text-sm font-medium mb-1">Failed</p>
            <p className="text-3xl font-bold text-red-900">{stats.failed}</p>
          </div>
        </div>
      )}

      {/* Jobs List */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Active Jobs</h2>
          <p className="text-sm text-gray-500">
            Showing {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </p>
        </div>

        {jobs.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            No jobs in queue
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Job ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Email ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Schedule Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Retries</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">{job.id.substring(0, 20)}...</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{job.emailId.substring(0, 10)}...</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(job.scheduleTime).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium w-fit ${getStatusColor(job.status)}`}>
                        {getStatusIcon(job.status)}
                        {job.status}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{job.retryCount}</td>
                    <td className="px-6 py-4 text-sm text-red-600">
                      {job.error ? (
                        <span title={job.error} className="truncate block max-w-xs">
                          {job.error.substring(0, 50)}...
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* System Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ How It Works</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Jobs are checked every 10 seconds automatically</li>
          <li>• Failed jobs retry with exponential backoff: 1min → 2min → 4min</li>
          <li>• Recurring emails schedule the next occurrence after completion</li>
          <li>• Use "Process Now" button to manually trigger queue processing</li>
          <li>• Enable "Auto Refresh" to see real-time updates</li>
        </ul>
      </div>
    </div>
  )
}
