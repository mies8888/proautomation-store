import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/prisma"
import Link from "next/link"

export default async function OutreachPage() {
  const session = await auth()
  if (!session) return null

  // Fetch leads that have an email and an opportunity report generated
  const outreachEligibleLeads = await prisma.lead.findMany({
    where: { 
      ownerUserId: session.user.id,
      opportunityReport: { isNot: null }
    },
    include: {
      opportunityReport: true
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  })

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Email Outreach</h1>
          <p className="text-slate-500 mt-1">Automate personalized cold email campaigns to your analyzed leads.</p>
        </div>
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 shadow-sm transition-colors">
          Connect Gmail Account
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Eligible Leads */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">Eligible Leads (Reports Generated)</h2>
            </div>
            
            <div className="divide-y divide-slate-100">
              {outreachEligibleLeads.map(lead => (
                <div key={lead.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{lead.companyName}</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {lead.websiteUrl} • Score: <span className="font-semibold text-indigo-600">{lead.leadScore}</span>
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <Link href={`/dashboard/leads/${lead.id}`} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition">
                      View Lead
                    </Link>
                    <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-sm">
                      Start Sequence
                    </button>
                  </div>
                </div>
              ))}
              {outreachEligibleLeads.length === 0 && (
                <div className="p-12 text-center">
                  <h3 className="text-lg font-medium text-slate-900">No eligible leads yet</h3>
                  <p className="text-slate-500 mt-2">Generate an Opportunity Report for a lead in your CRM to start outreach.</p>
                  <Link href="/dashboard/leads" className="inline-block mt-4 px-4 py-2 bg-indigo-50 text-indigo-700 font-medium rounded-lg hover:bg-indigo-100 transition">
                    Go to CRM Pipeline
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Settings & Stats */}
        <div className="space-y-6">
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">SMTP Settings</h3>
            <div className="space-y-3">
              <div className="p-3 bg-white border border-red-100 rounded-lg flex items-start space-x-3">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-red-500 flex-shrink-0"></div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Email Account Disconnected</p>
                  <p className="text-xs text-slate-500 mt-0.5">You need to connect an email account to send campaigns.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Campaign Statistics</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">Emails Sent</span>
                  <span className="font-medium text-slate-900">0</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full w-0"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">Open Rate</span>
                  <span className="font-medium text-slate-900">0%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-0"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
