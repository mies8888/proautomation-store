import { notFound } from "next/navigation"
import { prisma } from "@/lib/db/prisma"
import AnalyzeWebsiteButton from "@/components/features/AnalyzeWebsiteButton"
import WebsiteAnalysisReport from "@/components/features/WebsiteAnalysisReport"
import GenerateReportButton from "@/components/features/GenerateReportButton"
import EmailComposerModal from "@/components/features/EmailComposerModal"
import SellLeadModal from "@/components/features/SellLeadModal"

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      activityLogs: {
        orderBy: { createdAt: 'desc' }
      },
      websiteAnalysis: true,
      opportunityReport: true,
      marketplaceListing: true
    }
  })

  if (!lead) return notFound()

  return (
    <div className="p-8 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Left Column: Details */}
      <div className="md:col-span-2 space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{lead.companyName}</h1>
              {lead.websiteUrl && (
                <a href={lead.websiteUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  {lead.websiteUrl}
                </a>
              )}
            </div>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
              Score: {lead.leadScore}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
            <div>
              <span className="text-slate-500 block">Industry</span>
              <span className="font-medium">{lead.industry || 'Unknown'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Location</span>
              <span className="font-medium">{lead.city ? `${lead.city}, ${lead.country}` : 'Unknown'}</span>
            </div>
          </div>
        </div>

        {lead.websiteAnalysis && (
          <WebsiteAnalysisReport analysis={lead.websiteAnalysis} />
        )}
      </div>

      {/* Right Column: Status & Activity */}
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold mb-4">CRM Actions</h3>
          <div className="p-3 bg-slate-50 border rounded-lg font-medium text-slate-700 text-center mb-4">
            Status: {lead.status}
          </div>
          
          <div className="space-y-3">
            <button className="w-full bg-slate-900 text-white py-2 rounded-lg text-sm hover:bg-slate-800 transition">
              Update Status
            </button>
            <AnalyzeWebsiteButton leadId={lead.id} hasWebsite={!!lead.websiteUrl} />
            <GenerateReportButton leadId={lead.id} hasAnalysis={!!lead.websiteAnalysis} hasReport={!!lead.opportunityReport} />
            <EmailComposerModal leadId={lead.id} hasReport={!!lead.opportunityReport} />
            <div className="pt-4 mt-4 border-t border-slate-200">
              <SellLeadModal leadId={lead.id} isListed={lead.marketplaceListing?.status === 'ACTIVE'} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Activity Timeline</h3>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {lead.activityLogs.map(log => (
              <div key={log.id} className="text-sm border-l-2 border-indigo-100 pl-3 py-1">
                <span className="text-slate-500 block text-xs">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
                <span className="font-medium text-slate-800">
                  {log.action.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
            {lead.activityLogs.length === 0 && (
              <p className="text-sm text-slate-500">No activity recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
