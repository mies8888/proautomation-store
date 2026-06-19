import { notFound } from "next/navigation"
import { prisma } from "@/lib/db/prisma"
import WebsiteEditorTabs from "@/components/features/WebsiteEditorTabs"
import Link from "next/link"

export default async function WebsiteEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const project = await prisma.websiteProject.findUnique({
    where: { id },
    include: { lead: true }
  })

  if (!project) return notFound()

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50 -m-8"> {/* Negative margin to break out of layout padding */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/websites" className="text-slate-400 hover:text-slate-600 transition text-sm font-medium">
            ← Back to Projects
          </Link>
          <div className="h-6 w-px bg-slate-200"></div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">{project.projectName}</h1>
            <p className="text-xs text-slate-500">Client: {project.lead.companyName}</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button className="px-4 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition">
            Save Draft
          </button>
          <button className="px-4 py-1.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition shadow-sm">
            Publish Live
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <WebsiteEditorTabs htmlContent={project.htmlContent} />
      </div>
    </div>
  )
}
