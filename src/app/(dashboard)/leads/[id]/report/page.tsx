import { notFound } from "next/navigation"
import { prisma } from "@/lib/db/prisma"
import Link from "next/link"
import ReactMarkdown from "react-markdown"

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      opportunityReport: true
    }
  })

  if (!lead || !lead.opportunityReport) return notFound()

  return (
    <div className="p-8 max-w-4xl mx-auto min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/dashboard/leads/${id}`} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center transition">
          ← Back to Lead
        </Link>
        <button className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 shadow-sm transition">
          Download PDF
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-10 md:p-16 relative overflow-hidden">
        {/* Decorative header accent */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
        
        <article className="max-w-none">
          <ReactMarkdown
            components={{
              h1: ({node, ...props}) => <h1 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900 tracking-tight" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-2xl font-semibold mt-10 mb-4 text-slate-800 border-b border-slate-100 pb-3" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-xl font-medium mt-6 mb-3 text-slate-800" {...props} />,
              p: ({node, ...props}) => <p className="mb-5 text-slate-700 leading-relaxed" {...props} />,
              ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-6 space-y-2 text-slate-700" {...props} />,
              li: ({node, ...props}) => <li className="pl-1" {...props} />,
              hr: ({node, ...props}) => <hr className="my-10 border-slate-200" {...props} />,
              strong: ({node, ...props}) => <strong className="font-semibold text-slate-900" {...props} />,
            }}
          >
            {lead.opportunityReport.contentMarkdown}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  )
}
