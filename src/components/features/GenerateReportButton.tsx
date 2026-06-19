"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function GenerateReportButton({ leadId, hasAnalysis, hasReport }: { leadId: string, hasAnalysis: boolean, hasReport: boolean }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  if (!hasAnalysis) return null

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/report/generate`, { method: "POST" })
      if (res.ok) {
        router.push(`/dashboard/leads/${leadId}/report`)
      } else {
        alert("Failed to generate report.")
        setLoading(false)
      }
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  const handleView = () => {
    router.push(`/dashboard/leads/${leadId}/report`)
  }

  if (hasReport) {
    return (
      <button 
        onClick={handleView} 
        className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition shadow-sm"
      >
        View Opportunity Report
      </button>
    )
  }

  return (
    <button 
      onClick={handleGenerate} 
      disabled={loading}
      className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm flex items-center justify-center"
    >
      {loading ? (
        <span className="flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          AI Generating Pitch...
        </span>
      ) : "Generate Pitch Report"}
    </button>
  )
}
