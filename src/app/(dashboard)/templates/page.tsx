import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { emailTemplates } from '@/services/gmail/templates'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const builtInTemplates = Object.entries(emailTemplates).map(([key, template]) => ({
    id: key,
    ...template,
    isBuiltIn: true
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Email Templates</h1>
        <p className="text-gray-600 mt-2">Manage pre-built and custom email templates for your outreach campaigns</p>
      </div>

      {/* Built-in Templates */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Pre-built Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {builtInTemplates.map(template => (
            <div
              key={template.id}
              className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">{template.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                </div>
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Built-in</span>
              </div>

              <div className="bg-gray-50 p-4 rounded mb-4 max-h-40 overflow-y-auto">
                <div className="text-xs font-mono text-gray-700">
                  <div className="font-semibold mb-2">Subject:</div>
                  <div className="mb-3 text-gray-600">{template.subject}</div>
                  <div className="font-semibold mb-2">Body:</div>
                  <div className="text-gray-600 whitespace-pre-wrap text-xs">{template.body.slice(0, 200)}...</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded text-sm font-medium hover:bg-blue-100 transition">
                  Preview
                </button>
                <button className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition">
                  Use Template
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Template Variables Reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-4">Available Variables</h2>
        <p className="text-sm text-blue-800 mb-4">
          Use these variables in your templates - they'll be automatically replaced with lead data:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { name: 'companyName', example: 'Acme Corp' },
            { name: 'contactName', example: 'John Smith' },
            { name: 'contactTitle', example: 'Sales Manager' },
            { name: 'industry', example: 'Technology' },
            { name: 'service', example: 'Lead Generation' },
            { name: 'benefit', example: 'Increase sales by 40%' },
            { name: 'callToAction', example: '15-minute demo' },
            { name: 'senderName', example: 'Your Name' },
            { name: 'senderTitle', example: 'Sales Rep' }
          ].map(variable => (
            <div key={variable.name} className="bg-white p-3 rounded border border-blue-100">
              <code className="text-xs font-mono text-blue-600">{`{{${variable.name}}}`}</code>
              <div className="text-xs text-gray-600 mt-1">e.g. {variable.example}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Templates */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Custom Templates</h2>
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
            + Create Template
          </button>
        </div>
        <div className="bg-white p-12 rounded-lg border border-gray-200 text-center">
          <div className="text-gray-500">
            <div className="text-lg font-medium mb-2">No custom templates yet</div>
            <p className="text-sm mb-4">Create your first custom template to get started</p>
            <button className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition">
              Create Template
            </button>
          </div>
        </div>
      </div>

      {/* Usage Tips */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage Tips</h2>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start">
            <span className="text-green-600 font-bold mr-3">✓</span>
            <span><strong>Keep it short:</strong> Best practice is 50-100 words in the body</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 font-bold mr-3">✓</span>
            <span><strong>Personalize:</strong> Use variables like companyName and contactName</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 font-bold mr-3">✓</span>
            <span><strong>Clear CTA:</strong> Include a clear call-to-action button or link</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 font-bold mr-3">✓</span>
            <span><strong>Test:</strong> A/B test different templates to find what works best</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
