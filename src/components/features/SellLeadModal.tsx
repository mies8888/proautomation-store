"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function SellLeadModal({ leadId, isListed }: { leadId: string, isListed: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [askingPrice, setAskingPrice] = useState(50)
  const router = useRouter()

  if (isListed) {
    return (
      <button disabled className="w-full bg-slate-100 text-slate-400 py-2 rounded-lg text-sm font-medium border border-slate-200 cursor-not-allowed">
        Listed on Marketplace
      </button>
    )
  }

  const handleList = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/marketplace/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, askingPrice: Number(askingPrice) })
      })
      if (res.ok) {
        setIsOpen(false)
        router.refresh()
      } else {
        alert("Failed to list lead")
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
        className="w-full bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-200 py-2 rounded-lg text-sm font-semibold transition"
      >
        Sell Lead
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-900">List on Marketplace</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <form onSubmit={handleList} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Asking Price (Credits)</label>
                <input 
                  required
                  type="number" 
                  min="1"
                  value={askingPrice}
                  onChange={e => setAskingPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <p className="text-xs text-slate-500 mt-2">When another user purchases this lead, you will receive these credits.</p>
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
                  disabled={loading}
                  className="px-6 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 shadow-sm disabled:opacity-50"
                >
                  {loading ? "Listing..." : "Confirm Listing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
