"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function EmailComposerModal({ leadId, hasReport }: { leadId: string, hasReport: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState<any>(null)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const router = useRouter()

  if (!hasReport) return null

  const handleOpen = async () => {
    setIsOpen(true)
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/email/draft`, { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setDraft(data)
        setSubject(data.subject)
        setBody(data.body)
      } else {
        alert("Failed to draft email")
        setIsOpen(false)
      }
    } catch (err) {
      console.error(err)
      setIsOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/email/send`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: draft.id, subject, body })
      })
      if (res.ok) {
        setIsOpen(false)
        router.refresh()
      } else {
        alert("Failed to send email")
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
        onClick={handleOpen}
        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm"
      >
        Draft Outreach Email
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-900">Compose Outreach</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {loading && !draft ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-4"></div>
                  <p>AI Engine is drafting the perfect cold email...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                    <input 
                      type="text" 
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Body</label>
                    <textarea 
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      rows={12}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleSend}
                disabled={loading || !draft}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center shadow-sm"
              >
                {loading && draft ? "Sending via Gmail..." : "Send via Gmail"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
