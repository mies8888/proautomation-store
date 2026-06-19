"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function GenerateWebsiteModal({ leads }: { leads: any[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [leadId, setLeadId] = useState("")
  const [projectName, setProjectName] = useState("")
  const router = useRouter()

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/websites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, projectName })
      })
      if (res.ok) {
        const project = await res.json()
        setIsOpen(false)
        router.push(`/dashboard/websites/${project.id}`)
      } else {
        alert("Failed to generate website.")
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-sm transition"
      >
        + Generate New Website
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-900">AI Website Generator</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center text-slate-500">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-4"></div>
                <p>Generating Tailwind Template...</p>
              </div>
            ) : (
              <form onSubmit={handleGenerate} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Client (Lead)</label>
                  <select 
                    required
                    value={leadId}
                    onChange={e => {
                      setLeadId(e.target.value)
                      const lead = leads.find(l => l.id === e.target.value)
                      if (lead && !projectName) setProjectName(`${lead.companyName} Website`)
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="" disabled>Select a lead...</option>
                    {leads.map(l => (
                      <option key={l.id} value={l.id}>{l.companyName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
                  <input 
                    required
                    type="text" 
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div className="pt-4 flex justify-end space-x-3">
                  <button 
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm"
                  >
                    Generate Magic
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
