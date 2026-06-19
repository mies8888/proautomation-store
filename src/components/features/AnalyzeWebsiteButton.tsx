"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function AnalyzeWebsiteButton({ leadId, hasWebsite }: { leadId: string, hasWebsite: boolean }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  if (!hasWebsite) return null

  const handleAnalyze = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/analyze`, { method: "POST" })
      if (res.ok) {
        router.refresh()
      } else {
        alert("Failed to analyze website.")
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button 
      onClick={handleAnalyze} 
      disabled={loading}
      className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
    >
      {loading ? "Analyzing Engine Running..." : "Analyze Website"}
    </button>
  )
}
