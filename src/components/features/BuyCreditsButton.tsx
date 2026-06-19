"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function BuyCreditsButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleBuy = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/billing/buy", { 
        method: "POST",
        body: JSON.stringify({ credits: 100, redirectUrl: "/dashboard" })
      })
      if (res.ok) {
        router.refresh()
      } else {
        alert("Failed to purchase credits")
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button 
      onClick={handleBuy}
      disabled={loading}
      className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 shadow-sm transition disabled:opacity-50"
    >
      {loading ? "Processing..." : "Buy 100 Credits (Mock)"}
    </button>
  )
}
