import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/prisma"
import Link from "next/link"
import GenerateWebsiteModal from "@/components/features/GenerateWebsiteModal"

export default async function WebsitesPage() {
  const session = await auth()
  if (!session) return null

  const projects = await prisma.websiteProject.findMany({
    include: { lead: true },
    orderBy: { createdAt: 'desc' }
  })

  // Get eligible leads for the generator dropdown
  const leads = await prisma.lead.findMany({
    orderBy: { companyName: 'asc' }
  })

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Website Builder</h1>
          <p className="text-slate-500 mt-1">Manage and generate AI landing pages for your clients.</p>
        </div>
        <GenerateWebsiteModal leads={leads} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {projects.map(project => (
          <Link key={project.id} href={`/dashboard/websites/${project.id}`} className="block">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition hover:border-indigo-300 group">
              <div className="w-full h-32 bg-slate-100 rounded-lg mb-4 flex items-center justify-center border border-slate-200 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-emerald-50 opacity-50"></div>
                <span className="text-slate-400 font-medium group-hover:scale-105 transition transform relative z-10">Website Preview</span>
              </div>
              <h3 className="font-semibold text-lg text-slate-900 truncate">{project.projectName}</h3>
              <p className="text-sm text-slate-500 truncate mt-1">Client: {project.lead.companyName}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-medium px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                  {project.status}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </Link>
        ))}
        {projects.length === 0 && (
          <div className="col-span-3 text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
            <h3 className="text-lg font-medium text-slate-900">No websites yet</h3>
            <p className="text-slate-500 mt-2">Generate your first AI website to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}
