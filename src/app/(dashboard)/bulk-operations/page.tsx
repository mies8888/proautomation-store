'use client'

import { useState, useEffect } from 'react'

interface Lead {
  id: string
  companyName: string
  contactName: string
  contactEmail: string
  status: string
}

interface BulkCampaign {
  id: string
  name: string
  status: 'DRAFT' | 'QUEUED' | 'SENDING' | 'COMPLETED' | 'FAILED'
  leadsCount: number
  sentCount: number
  openCount: number
  clickCount: number
  replyCount: number
  failedCount: number
  createdAt: string
  completedAt?: string
  subject: string
  body: string
}

interface BulkOperationState {
  step: 'leads_selection' | 'template_compose' | 'confirmation' | 'results'
  selectedLeads: string[]
  subject: string
  body: string
  campaignName: string
}

const TEMPLATES = {
  mass_outreach: {
    name: 'Mass Outreach',
    subject: 'Quick opportunity for {{companyName}}',
    body: `Hi {{contactName}},

I was impressed by {{companyName}}'s work and think there might be a good fit for collaboration.

Would you be open to a brief conversation?

Best regards,
Sales Team`
  },
  announcement: {
    name: 'Product Announcement',
    subject: 'New feature announcement - {{companyName}}',
    body: `Hi {{contactName}},

We just launched a new feature designed specifically for companies like {{companyName}} in the {{industry}} space.

I'd love to share how it works in a quick demo.

Best regards,
Product Team`
  },
  promotion: {
    name: 'Limited Time Offer',
    subject: 'Special offer for {{companyName}}',
    body: `Hi {{contactName}},

We're offering a limited-time promotion for {{companyName}} customers.

This offer expires in 7 days, so let me know if you'd like to discuss.

Best regards,
Sales Team`
  }
}

export default function BulkOperationsPage() {
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<Lead[]>([])
  const [campaigns, setCampaigns] = useState<BulkCampaign[]>([])
  const [state, setState] = useState<BulkOperationState>({
    step: 'leads_selection',
    selectedLeads: [],
    subject: '',
    body: '',
    campaignName: ''
  })
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load leads
        const leadsRes = await fetch('/api/leads')
        if (leadsRes.ok) {
          const leadsData = await leadsRes.json()
          setLeads(leadsData.leads || [])
        }

        // Load campaigns
        const campaignsRes = await fetch('/api/bulk-email')
        if (campaignsRes.ok) {
          const campaignsData = await campaignsRes.json()
          setCampaigns(campaignsData.campaigns || [])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const toggleLead = (leadId: string) => {
    setState(prev => ({
      ...prev,
      selectedLeads: prev.selectedLeads.includes(leadId)
        ? prev.selectedLeads.filter(id => id !== leadId)
        : [...prev.selectedLeads, leadId]
    }))
  }

  const selectAll = () => {
    setState(prev => ({
      ...prev,
      selectedLeads: prev.selectedLeads.length === filteredLeads.length ? [] : filteredLeads.map(l => l.id)
    }))
  }

  const applyTemplate = (templateId: string) => {
    const template = TEMPLATES[templateId as keyof typeof TEMPLATES]
    if (template) {
      setState(prev => ({
        ...prev,
        subject: template.subject,
        body: template.body
      }))
    }
  }

  const handleSendCampaign = async () => {
    if (!state.campaignName || !state.subject || !state.body || state.selectedLeads.length === 0) {
      alert('Please fill in all required fields and select at least one lead')
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/bulk-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName: state.campaignName,
          leadIds: state.selectedLeads,
          subject: state.subject,
          body: state.body
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to send campaign')
      }

      const data = await response.json()
      setCampaigns(prev => [data.campaign, ...prev])
      alert('Campaign sent successfully!')
      setState({
        step: 'leads_selection',
        selectedLeads: [],
        subject: '',
        body: '',
        campaignName: ''
      })
    } catch (err: any) {
      console.error(err)
      alert(`Failed to send: ${err.message}`)
    } finally {
      setSending(false)
    }
  }

  const filteredLeads = leads.filter(lead => {
    if (filter === 'all') return true
    return lead.status === filter
  })

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Bulk Operations</h1>
        <p className="text-gray-600 mt-2">Send emails to multiple leads at once</p>
      </div>

      {state.step === 'leads_selection' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leads Selection */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Select Leads</h2>
                <span className="text-sm text-gray-600">
                  {state.selectedLeads.length} of {filteredLeads.length} selected
                </span>
              </div>

              {/* Filter and Select All */}
              <div className="flex gap-2 mb-4">
                <select
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="ENGAGED">Engaged</option>
                  <option value="QUALIFIED">Qualified</option>
                </select>

                <button
                  onClick={selectAll}
                  className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200"
                >
                  {state.selectedLeads.length === filteredLeads.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {/* Leads List */}
              <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4 bg-gray-50">
                {filteredLeads.length === 0 ? (
                  <p className="text-sm text-gray-500">No leads to select</p>
                ) : (
                  filteredLeads.map(lead => (
                    <label key={lead.id} className="flex items-start gap-3 p-3 bg-white rounded hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.selectedLeads.includes(lead.id)}
                        onChange={() => toggleLead(lead.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{lead.contactName}</p>
                        <p className="text-xs text-gray-600">{lead.companyName}</p>
                        <p className="text-xs text-gray-500">{lead.contactEmail}</p>
                      </div>
                      <span className="text-xs bg-gray-200 px-2 py-1 rounded">{lead.status}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {state.selectedLeads.length > 0 && (
              <button
                onClick={() => setState(prev => ({ ...prev, step: 'template_compose' }))}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Continue to Compose ({state.selectedLeads.length} leads)
              </button>
            )}
          </div>

          {/* Recent Campaigns */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 h-fit">
            <h2 className="text-lg font-semibold mb-4">Recent Campaigns</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {campaigns.length === 0 ? (
                <p className="text-sm text-gray-500">No campaigns yet</p>
              ) : (
                campaigns.slice(0, 10).map(campaign => (
                  <div key={campaign.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="font-medium text-sm truncate">{campaign.name}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Status: <span className={`font-semibold ${
                        campaign.status === 'COMPLETED' ? 'text-green-600' :
                        campaign.status === 'SENDING' ? 'text-blue-600' :
                        campaign.status === 'FAILED' ? 'text-red-600' : 'text-gray-600'
                      }`}>{campaign.status}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Leads: {campaign.leadsCount}</p>
                    {campaign.sentCount > 0 && (
                      <p className="text-xs text-gray-600 mt-1">
                        Opens: {campaign.openCount} · Replies: {campaign.replyCount}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {state.step === 'template_compose' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Campaign Name</label>
            <input
              type="text"
              value={state.campaignName}
              onChange={e => setState(prev => ({ ...prev, campaignName: e.target.value }))}
              placeholder="e.g., Q2 Outreach Campaign"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Quick Templates */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Quick Templates</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {Object.entries(TEMPLATES).map(([id, template]) => (
                <button
                  key={id}
                  onClick={() => applyTemplate(id)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition"
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Compose */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Subject</label>
              <input
                type="text"
                value={state.subject}
                onChange={e => setState(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Email subject (use {{companyName}}, {{contactName}}, etc.)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />

              <label className="block text-sm font-medium text-gray-900 mb-2">Message</label>
              <textarea
                value={state.body}
                onChange={e => setState(prev => ({ ...prev, body: e.target.value }))}
                placeholder="Email body..."
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                Available variables: {`{{companyName}}`}, {`{{contactName}}`}, {`{{contactEmail}}`}
              </p>
            </div>

            {/* Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Preview (Sample Lead)</label>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 h-full">
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-600 font-medium">To:</p>
                    <p>john@acme.com</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-medium">Subject:</p>
                    <p className="text-base font-semibold">{state.subject || '(no subject)'}</p>
                  </div>
                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-600 font-medium mb-2">Message:</p>
                    <p className="whitespace-pre-wrap text-gray-700">{state.body || '(no body)'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => setState(prev => ({ ...prev, step: 'leads_selection' }))}
              className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-300"
            >
              Back
            </button>
            <button
              onClick={() => setState(prev => ({ ...prev, step: 'confirmation' }))}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Review & Send ({state.selectedLeads.length} leads)
            </button>
          </div>
        </div>
      )}

      {state.step === 'confirmation' && (
        <div className="max-w-2xl mx-auto bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <h2 className="text-2xl font-bold">Review Campaign</h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-sm text-gray-600 font-medium">Campaign Name</p>
              <p className="text-lg font-semibold">{state.campaignName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Recipients</p>
              <p className="text-lg font-semibold">{state.selectedLeads.length} leads</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Subject</p>
              <p className="text-base">{state.subject}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Message Preview</p>
              <div className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {state.body}
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-900">
              ⚠️ This will send {state.selectedLeads.length} emails immediately. Make sure everything looks correct before confirming.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => setState(prev => ({ ...prev, step: 'template_compose' }))}
              className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-300"
            >
              Back
            </button>
            <button
              onClick={handleSendCampaign}
              disabled={sending}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {sending ? 'Sending Campaign...' : 'Send Campaign'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
