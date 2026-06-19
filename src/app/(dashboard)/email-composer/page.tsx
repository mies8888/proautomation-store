'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const TEMPLATES = {
  cold_outreach: {
    name: 'Cold Outreach',
    subject: 'Quick opportunity for {{companyName}}',
    body: `Hi {{contactName}},

I was impressed by {{companyName}}'s work in {{industry}} and think I might be able to help you with {{service}}.

{{benefit}}

Would you be open to a brief conversation?

Best regards,
{{senderName}}`
  },
  follow_up: {
    name: 'Follow Up',
    subject: 'Following up - {{companyName}}',
    body: `Hi {{contactName}},

I wanted to follow up on my previous email about helping {{companyName}} with {{service}}.

{{opportunity}}

Let me know if you'd like to discuss further.

Best regards,
{{senderName}}`
  },
  demo_request: {
    name: 'Demo Request',
    subject: 'Demo: See {{service}} in action',
    body: `Hi {{contactName}},

I'd love to show you how {{service}} has helped companies like {{companyName}} {{benefit}}.

Would {{demoTime}} work for a quick 15-min demo?

Best regards,
{{senderName}}`
  },
  problem_aware: {
    name: 'Problem Aware',
    subject: 'Solution for {{companyName}}\'s {{problemArea}}',
    body: `Hi {{contactName}},

I noticed {{companyName}} might be facing challenges with {{problemArea}}.

{{solution}}

Would it make sense to explore this together?

Best regards,
{{senderName}}`
  },
  case_study: {
    name: 'Case Study',
    subject: 'Case Study: How {{companyName}} increased {{metric}}',
    body: `Hi {{contactName}},

I wanted to share a case study showing how a company similar to {{companyName}} increased {{metric}} using {{service}}.

{{result}}

Would you be interested in learning more?

Best regards,
{{senderName}}`
  },
  proposal: {
    name: 'Proposal',
    subject: 'Proposal: {{service}} for {{companyName}}',
    body: `Hi {{contactName}},

Based on our conversation, I've prepared a proposal for implementing {{service}} at {{companyName}}.

{{details}}

Let me know if you'd like to discuss the next steps.

Best regards,
{{senderName}}`
  }
}

interface FormData {
  to: string
  cc?: string
  subject: string
  body: string
}

interface ScheduleData {
  isScheduled: boolean
  scheduledTime?: string
  recurrence: 'none' | 'daily' | 'weekly' | 'custom'
  recurrenceEndDate?: string
}

const SAMPLE_DATA = {
  companyName: 'Acme Corp',
  contactName: 'John',
  service: 'Lead Generation',
  benefit: 'We help companies like yours increase sales by 40%',
  industry: 'Technology',
  senderName: 'Sales Team',
  opportunity: 'There might be a good fit for what we discussed',
  demoTime: 'tomorrow at 2pm',
  problemArea: 'lead generation',
  solution: 'We have a proven approach to help with this',
  metric: 'conversion rate by 35%',
  result: 'The result was a 35% increase in conversion rate',
  details: 'The proposal includes implementation, training, and ongoing support'
}

export default function EmailComposerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const leadId = searchParams.get('leadId')
  const templateId = searchParams.get('templateId')

  const [lead, setLead] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormData>({
    to: '',
    cc: '',
    subject: '',
    body: ''
  })
  const [schedule, setSchedule] = useState<ScheduleData>({
    isScheduled: false,
    recurrence: 'none'
  })
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [showOptimizer, setShowOptimizer] = useState(false)
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<any[]>([])
  const [drafts, setDrafts] = useState<any[]>([])

  // Load lead and set initial form
  useEffect(() => {
    const loadData = async () => {
      try {
        if (leadId) {
          const response = await fetch(`/api/leads/${leadId}`)
          if (!response.ok) throw new Error('Lead not found')
          const data = await response.json()
          setLead(data.lead)
          setForm(prev => ({ ...prev, to: data.lead.contactEmail || '' }))

          // Load drafts
          const draftsRes = await fetch(`/api/email-drafts?leadId=${leadId}`)
          const draftsData = await draftsRes.json()
          setDrafts(draftsData.drafts || [])
        }
      } catch (err) {
        console.error(err)
        router.push('/leads')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [leadId, router])

  // Apply template
  useEffect(() => {
    if (templateId && TEMPLATES[templateId as keyof typeof TEMPLATES]) {
      const template = TEMPLATES[templateId as keyof typeof TEMPLATES]
      setForm(prev => ({
        ...prev,
        subject: template.subject,
        body: template.body
      }))
    }
  }, [templateId])

  const previewText = (text: string) => {
    let result = text
    Object.entries(SAMPLE_DATA).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
    })
    return result
  }

  const handleSaveDraft = async () => {
    if (!leadId || !form.to || !form.subject || !form.body) {
      alert('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/email-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          to: form.to,
          cc: form.cc,
          subject: form.subject,
          body: form.body
        })
      })

      if (!response.ok) throw new Error('Failed to save draft')
      alert('Draft saved successfully')
    } catch (err) {
      console.error(err)
      alert('Failed to save draft')
    } finally {
      setSaving(false)
    }
  }

  const handleSendEmail = async () => {
    if (!leadId || !form.to || !form.subject || !form.body) {
      alert('Please fill in all required fields')
      return
    }

    if (!confirm('Send this email now?')) return

    setSending(true)
    try {
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          to: form.to,
          cc: form.cc,
          subject: form.subject,
          body: form.body
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to send email')
      }

      alert('Email sent successfully!')
      setForm({ to: lead?.contactEmail || '', cc: '', subject: '', body: '' })
    } catch (err: any) {
      console.error(err)
      alert(`Failed to send: ${err.message}`)
    } finally {
      setSending(false)
    }
  }

  const handleScheduleEmail = async () => {
    if (!leadId || !form.to || !form.subject || !form.body) {
      alert('Please fill in all required fields')
      return
    }

    if (!schedule.scheduledTime) {
      alert('Please select a date and time')
      return
    }

    // Validate scheduled time is in the future
    const scheduledDate = new Date(schedule.scheduledTime)
    if (scheduledDate <= new Date()) {
      alert('Scheduled time must be in the future')
      return
    }

    if (schedule.recurrence !== 'none' && !schedule.recurrenceEndDate) {
      alert('Please set an end date for recurring emails')
      return
    }

    setScheduling(true)
    try {
      const response = await fetch('/api/email-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          to: form.to,
          cc: form.cc,
          subject: form.subject,
          body: form.body,
          scheduledTime: schedule.scheduledTime,
          recurrence: schedule.recurrence,
          recurrenceEndDate: schedule.recurrenceEndDate
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to schedule email')
      }

      alert('Email scheduled successfully!')
      setShowScheduleModal(false)
      setSchedule({ isScheduled: false, recurrence: 'none' })
      setForm({ to: lead?.contactEmail || '', cc: '', subject: '', body: '' })
    } catch (err: any) {
      console.error(err)
      alert(`Failed to schedule: ${err.message}`)
    } finally {
      setScheduling(false)
    }
  }

  const handleTemplateSelect = (id: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('templateId', id)
    router.push(`?${url.searchParams}`)
  }

  const handleOptimizeEmail = async () => {
    if (!form.subject || !form.body) {
      alert('Please enter subject and body to optimize')
      return
    }

    setOptimizing(true)
    try {
      const response = await fetch('/api/ai/email-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: form.subject,
          body: form.body,
          leadName: lead?.name,
          leadCompany: lead?.company
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to optimize email')
      }

      const data = await response.json()
      setOptimizationSuggestions(data.suggestions || [])
      setShowOptimizer(true)
    } catch (err: any) {
      console.error(err)
      alert(`Failed to optimize: ${err.message}`)
    } finally {
      setOptimizing(false)
    }
  }

  const applySuggestion = (suggestion: any) => {
    if (suggestion.field === 'subject') {
      setForm({ ...form, subject: suggestion.suggestion })
    } else {
      setForm({ ...form, body: suggestion.suggestion })
    }
    setShowOptimizer(false)
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Compose Email</h1>
        {lead && (
          <p className="text-gray-600 mt-2">
            Sending to <span className="font-semibold">{lead.companyName}</span>
            {lead.contactEmail && ` (${lead.contactEmail})`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Templates Sidebar */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-4">
            <h2 className="font-semibold text-lg mb-4">Templates</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <div className="text-sm text-gray-600 mb-3">Quick templates</div>
              {Object.entries(TEMPLATES).map(([id, template]) => (
                <button
                  key={id}
                  onClick={() => handleTemplateSelect(id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                    templateId === id
                      ? 'bg-blue-100 text-blue-900 font-medium'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {template.name}
                </button>
              ))}
            </div>
            <button className="w-full mt-4 px-3 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition">
              + New Template
            </button>

            {drafts.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="text-sm font-medium mb-2">Drafts</div>
                <div className="space-y-1">
                  {drafts.map(draft => (
                    <div key={draft.id} className="text-xs bg-gray-50 p-2 rounded truncate cursor-pointer hover:bg-gray-100">
                      {draft.subject}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="md:col-span-3 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            {/* Recipient */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">To</label>
              <input
                type="email"
                value={form.to}
                onChange={e => setForm({ ...form, to: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* CC */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">CC (Optional)</label>
              <input
                type="email"
                value={form.cc || ''}
                onChange={e => setForm({ ...form, cc: e.target.value })}
                placeholder="cc@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Subject</label>
              <input
                type="text"
                value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })}
                placeholder="Email subject"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Use {`{{companyName}}`}, {`{{contactName}}`}, {`{{service}}`} etc.</p>
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Message</label>
              <textarea
                value={form.body}
                onChange={e => setForm({ ...form, body: e.target.value })}
                placeholder="Your email message..."
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                Available variables: companyName, contactName, service, benefit, industry, senderName
              </p>
            </div>

            {/* Preview */}
            <div className="bg-gray-50 p-4 rounded border border-gray-200">
              <h3 className="text-sm font-semibold mb-2">Preview (with sample data)</h3>
              <div className="bg-white p-3 rounded text-sm space-y-2 border border-gray-200">
                <div><strong>To:</strong> {previewText(form.to || 'recipient@example.com')}</div>
                <div><strong>Subject:</strong> {previewText(form.subject || '(no subject)')}</div>
                <div className="pt-2 text-gray-700 whitespace-pre-wrap">
                  {previewText(form.body || '(no body)')}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-300 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                onClick={handleOptimizeEmail}
                disabled={optimizing}
                className="px-4 py-2 bg-purple-50 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-100 transition disabled:opacity-50"
              >
                {optimizing ? 'Optimizing...' : '✨ Optimize'}
              </button>
              <button 
                onClick={() => setShowScheduleModal(true)}
                className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition"
              >
                Schedule Send
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sending}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 space-y-4">
            <h2 className="text-xl font-bold">Schedule Email</h2>

            {/* Scheduled Time */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Send on <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={schedule.scheduledTime || ''}
                onChange={e => setSchedule({ ...schedule, scheduledTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Must be a future date and time</p>
            </div>

            {/* Recurrence */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Recurrence</label>
              <select
                value={schedule.recurrence}
                onChange={e => setSchedule({ ...schedule, recurrence: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">No recurrence (send once)</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* Recurrence End Date */}
            {schedule.recurrence !== 'none' && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Stop recurring on <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={schedule.recurrenceEndDate || ''}
                  onChange={e => setSchedule({ ...schedule, recurrenceEndDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">When should the recurring emails stop?</p>
              </div>
            )}

            {/* Summary */}
            <div className="bg-gray-50 p-3 rounded text-sm text-gray-700">
              <p className="font-medium mb-1">Summary:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Send to: {form.to}</li>
                <li>First send: {schedule.scheduledTime ? new Date(schedule.scheduledTime).toLocaleString() : 'Not set'}</li>
                {schedule.recurrence !== 'none' && (
                  <li>Recurrence: {schedule.recurrence}, until {schedule.recurrenceEndDate || 'Not set'}</li>
                )}
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleEmail}
                disabled={scheduling}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {scheduling ? 'Scheduling...' : 'Schedule Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Optimizer Modal */}
      {showOptimizer && optimizationSuggestions.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-xl font-bold">✨ AI Email Optimization</h2>

            <div className="space-y-4">
              {optimizationSuggestions.map((suggestion, idx) => (
                <div key={idx} className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 mb-1">
                        {suggestion.field === 'subject' ? '📧 Subject Line' : '📝 Body Text'}
                      </p>
                      <div className="bg-white p-3 rounded border border-blue-200 mb-2 text-sm">
                        <p className="text-gray-600 line-through">{suggestion.current}</p>
                      </div>
                      <div className="bg-white p-3 rounded border border-green-200 mb-2 text-sm">
                        <p className="text-gray-900 font-medium">{suggestion.suggestion}</p>
                      </div>
                      <p className="text-xs text-blue-700"><strong>Why:</strong> {suggestion.reasoning}</p>
                      <p className="text-xs text-green-700 mt-1"><strong>Expected:</strong> {suggestion.improvement}</p>
                    </div>
                    <button
                      onClick={() => applySuggestion(suggestion)}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 whitespace-nowrap"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowOptimizer(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
