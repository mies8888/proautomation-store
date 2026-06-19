"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function AddLeadModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    const companyName = formData.get('companyName') as string
    const websiteUrl = formData.get('websiteUrl') as string
    const industry = formData.get('industry') as string
    
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, websiteUrl, industry })
      })
      
      if (res.ok) {
        setIsOpen(false)
        router.refresh()
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to add lead")
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
        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors"
      >
        + Manually Add Lead
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">Add New Lead</h2>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name *</label>
                <input 
                  required
                  name="companyName"
                  type="text" 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                  placeholder="e.g. Acme Corp"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Website URL</label>
                <input 
                  name="websiteUrl"
                  type="url" 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                  placeholder="https://acme.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                <input 
                  name="industry"
                  type="text" 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                  placeholder="e.g. Real Estate"
                />
              </div>

              <div className="pt-4 flex space-x-3 justify-end">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? "Adding..." : "Add Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
