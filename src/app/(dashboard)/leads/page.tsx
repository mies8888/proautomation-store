import Link from "next/link"
import { prisma } from "@/lib/db/prisma"
import { auth } from "@/lib/auth"
import AddLeadModal from "@/components/features/AddLeadModal"

export default async function LeadsPage() {
  const session = await auth()
  if (!session) return null

  const leads = await prisma.lead.findMany({
    where: { ownerUserId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100
  })

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Leads Pipeline</h1>
          <p className="text-slate-500 mt-1">Manage and track your generated opportunities.</p>
        </div>
        <AddLeadModal />
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-700 uppercase tracking-wider text-xs">Company</th>
              <th className="px-6 py-4 font-semibold text-slate-700 uppercase tracking-wider text-xs">Website</th>
              <th className="px-6 py-4 font-semibold text-slate-700 uppercase tracking-wider text-xs">Score</th>
              <th className="px-6 py-4 font-semibold text-slate-700 uppercase tracking-wider text-xs">Status</th>
              <th className="px-6 py-4 font-semibold text-slate-700 uppercase tracking-wider text-xs text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map(lead => (
              <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900">{lead.companyName}</td>
                <td className="px-6 py-4 text-blue-600 hover:underline">
                  {lead.websiteUrl ? (
                    <a href={lead.websiteUrl} target="_blank" rel="noreferrer">{lead.websiteUrl}</a>
                  ) : <span className="text-slate-400">N/A</span>}
                </td>
                <td className="px-6 py-4 font-semibold text-slate-700">{lead.leadScore}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                    {lead.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link href={`/dashboard/leads/${lead.id}`} className="text-indigo-600 hover:text-indigo-900 font-medium">
                    View Details
                  </Link>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No leads found. Start a new search or add one manually.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
