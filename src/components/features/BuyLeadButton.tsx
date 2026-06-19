"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function BuyLeadButton({ listingId, price }: { listingId: string, price: number }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleBuy = async () => {
    if (!confirm(`Are you sure you want to purchase this lead for ${price} credits?`)) return
    
    setLoading(true)
    try {
      const res = await fetch("/api/marketplace/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId })
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/dashboard/leads/${data.leadId}`)
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to purchase lead")
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button 
      onClick={handleBuy}
      disabled={loading}
      className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 shadow-sm transition disabled:opacity-50"
    >
      {loading ? "Purchasing..." : "Purchase"}
    </button>
  )
}
