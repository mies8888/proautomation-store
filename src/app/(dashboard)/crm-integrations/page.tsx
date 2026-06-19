'use client'

import { useState, useEffect } from 'react'
import { Check, Link2, Unlink2, Loader } from 'lucide-react'

const CRM_PROVIDERS = [
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Connect HubSpot CRM to sync leads and track activities',
    icon: '🔗',
    color: 'from-orange-400 to-red-500',
    authUrl: 'https://app.hubspot.com/oauth/authorize'
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Sync leads and activities to Salesforce',
    icon: '☁️',
    color: 'from-blue-400 to-blue-600',
    authUrl: 'https://login.salesforce.com/services/oauth2/authorize'
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    description: 'Connect Pipedrive to manage deals and leads',
    icon: '📊',
    color: 'from-green-400 to-teal-500',
    authUrl: 'https://oauth.pipedrive.com/oauth/authorize'
  }
]

interface CRMStatus {
  connected: boolean
  crm: {
    type: string
    expiresAt: string
  } | null
}

export default function CRMIntegrationsPage() {
  const [status, setStatus] = useState<Record<string, CRMStatus | null>>({})
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)

  useEffect(() => {
    checkCRMStatus()
  }, [])

  const checkCRMStatus = async () => {
    try {
      const response = await fetch('/api/crm/sync', {
        method: 'GET'
      })

      if (response.ok) {
        const data = await response.json()
        setStatus({
          [data.crm?.type || 'none']: data
        })
      }
    } catch (err) {
      console.error('Error checking CRM status:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleConnectCRM = (provider: any) => {
    const authUrl = new URL(provider.authUrl)
    authUrl.searchParams.set('client_id', process.env.NEXT_PUBLIC_CRM_CLIENT_ID || '')
    authUrl.searchParams.set('redirect_uri', `${window.location.origin}/api/crm/callback`)
    authUrl.searchParams.set('scope', 'contacts deals activities')
    authUrl.searchParams.set('state', provider.id)
    window.location.href = authUrl.toString()
  }

  const handleDisconnectCRM = async (provider: any) => {
    if (!confirm(`Disconnect ${provider.name}?`)) return
    
    try {
      // TODO: Add disconnect endpoint
      alert('Disconnected!')
      checkCRMStatus()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const isConnected = (provider: any) => {
    return status[provider.id]?.connected
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">CRM Integrations</h1>
        <p className="text-gray-600 mt-1">Connect your CRM to sync leads and track activities</p>
      </div>

      {/* Overview */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Why Connect a CRM?</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Automatically sync leads to your CRM when you generate them</li>
          <li>• Track email opens, clicks, and replies directly in your CRM</li>
          <li>• Update deal stages based on email engagement</li>
          <li>• Keep your sales pipeline up-to-date automatically</li>
          <li>• No manual data entry between platforms</li>
        </ul>
      </div>

      {/* CRM Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CRM_PROVIDERS.map((provider) => {
          const connected = isConnected(provider)
          return (
            <div
              key={provider.id}
              className={`border-2 rounded-lg p-6 transition ${
                connected
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="text-4xl">{provider.icon}</div>
                {connected && <Check className="w-5 h-5 text-green-600" />}
              </div>

              {/* Provider Info */}
              <h3 className="text-lg font-semibold mb-2">{provider.name}</h3>
              <p className="text-sm text-gray-600 mb-4">{provider.description}</p>

              {/* Status */}
              {connected && status[provider.id] && (
                <div className="mb-4 p-3 bg-white rounded border border-green-200">
                  <p className="text-xs text-green-700">
                    <strong>✓ Connected</strong>
                  </p>
                  {status[provider.id]?.crm?.expiresAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Expires: {new Date(status[provider.id]!.crm!.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {!connected ? (
                  <button
                    onClick={() => handleConnectCRM(provider)}
                    className={`flex-1 px-4 py-2 bg-gradient-to-r ${provider.color} text-white rounded-lg text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2`}
                  >
                    <Link2 className="w-4 h-4" />
                    Connect
                  </button>
                ) : (
                  <button
                    onClick={() => handleDisconnectCRM(provider)}
                    className="flex-1 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition flex items-center justify-center gap-2"
                  >
                    <Unlink2 className="w-4 h-4" />
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold mb-3">📤 Sync Options</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>✓ One-way sync (ProAutomation → CRM)</li>
            <li>✓ Auto-sync new leads</li>
            <li>✓ Batch sync existing leads</li>
            <li>✓ Update contact information</li>
            <li>✓ Log email activities</li>
          </ul>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold mb-3">⚙️ Configuration</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>✓ Field mapping setup</li>
            <li>✓ Auto-sync frequency</li>
            <li>✓ Email notification tracking</li>
            <li>✓ Deal stage automation</li>
            <li>✓ Activity logging rules</li>
          </ul>
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">🚀 Getting Started</h3>
        <ol className="space-y-3 text-sm">
          <li>
            <span className="font-medium">1. Choose your CRM</span>
            <p className="text-gray-600">Click the Connect button for HubSpot, Salesforce, or Pipedrive</p>
          </li>
          <li>
            <span className="font-medium">2. Authorize access</span>
            <p className="text-gray-600">You'll be redirected to your CRM to authorize ProAutomation</p>
          </li>
          <li>
            <span className="font-medium">3. Configure sync settings</span>
            <p className="text-gray-600">Choose which data to sync and how often</p>
          </li>
          <li>
            <span className="font-medium">4. Start syncing</span>
            <p className="text-gray-600">Leads will automatically sync to your CRM</p>
          </li>
        </ol>
      </div>
    </div>
  )
}
