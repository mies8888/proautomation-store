"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
// import GodModeMap from "../maps/GodModeMap" // TODO: Fix lit module resolution

export default function LeadGeneratorClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  
  // Live Monitor State
  const [liveStatus, setLiveStatus] = useState<string>("Awaiting command...")
  const [liveFrame, setLiveFrame] = useState<string | null>(null)
  const [eventSource, setEventSource] = useState<EventSource | null>(null)

  const [formData, setFormData] = useState({
    industry: "Software & IT",
    country: "United States",
    city: "Austin",
    purpose: "Cold Outreach"
  })

  const CITIES_BY_COUNTRY: Record<string, string[]> = {
    "United States": ["Austin", "New York", "San Francisco", "Miami", "Chicago", "Seattle"],
    "United Kingdom": ["London", "Manchester", "Birmingham", "Edinburgh", "Glasgow"],
    "Canada": ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa"],
    "Australia": ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"],
    "Germany": ["Berlin", "Munich", "Frankfurt", "Hamburg", "Cologne"],
    "Netherlands": ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven"]
  }

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountry = e.target.value
    setFormData({
      ...formData,
      country: newCountry,
      city: CITIES_BY_COUNTRY[newCountry][0] // Auto-select first city of new country
    })
  }

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [eventSource])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (eventSource) {
      eventSource.close()
    }
    
    setLoading(true)
    setResults([])
    setSelectedLeads(new Set())
    setLiveFrame(null)
    setLiveStatus("Connecting to Visual Scraping Engine...")

    const query = `${formData.industry} in ${formData.city}, ${formData.country}`
    const source = new EventSource(`/api/live-scraper?q=${encodeURIComponent(query)}`)
    setEventSource(source)

    source.addEventListener('status', (e) => {
      const data = JSON.parse(e.data)
      setLiveStatus(data.message)
    })

    source.addEventListener('frame', (e) => {
      const data = JSON.parse(e.data)
      setLiveFrame(`data:image/jpeg;base64,${data.image}`)
    })

    source.addEventListener('result', (e) => {
      const data = JSON.parse(e.data)
      // Add result with a random lead score for simulation
      const leadWithScore = { ...data, leadScore: Math.floor(Math.random() * 30) + 70 }
      setResults(prev => [...prev, leadWithScore])
    })

    source.addEventListener('error', (e) => {
      setLiveStatus("Error: Next.js Server needs to be restarted to load Playwright. Please press Ctrl+C in your terminal and run 'npm run dev' again.")
      source.close()
      // Keep loading true so the terminal stays visible
    })

    source.addEventListener('done', (e) => {
      setLiveStatus("Scraping complete.")
      source.close()
      setLoading(false)
      // Auto-select all results
      setResults(currentResults => {
        setSelectedLeads(new Set(currentResults.map((_, i) => i)))
        return currentResults
      })
    })
  }

  const toggleSelection = (index: number) => {
    const newSelected = new Set(selectedLeads)
    if (newSelected.has(index)) newSelected.delete(index)
    else newSelected.add(index)
    setSelectedLeads(newSelected)
  }

  const handleImport = async () => {
    if (selectedLeads.size === 0) return
    setImporting(true)
    
    // Convert generic objects to match the API structure
    const leadsToImport = Array.from(selectedLeads).map(i => {
       const l = results[i]
       return {
         companyName: l.companyName,
         websiteUrl: l.websiteUrl,
         industry: formData.industry,
         country: formData.country,
         city: formData.city,
         contactEmail: l.contactEmail,
         leadScore: l.leadScore
       }
    })

    try {
      const res = await fetch("/api/lead-generator/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: leadsToImport })
      })
      const data = await res.json()
      if (data.success) {
        alert(`Successfully imported ${data.count} leads to your CRM!`)
        router.push("/dashboard/leads")
      }
    } catch (err) {
      console.error(err)
      alert("Failed to import leads.")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Search Form */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Search Criteria</h2>
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
            <select 
              value={formData.industry}
              onChange={e => setFormData({...formData, industry: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" 
            >
              <option value="Software & IT">Software & IT</option>
              <option value="Real Estate">Real Estate</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Finance & Accounting">Finance & Accounting</option>
              <option value="E-commerce">E-commerce</option>
              <option value="Marketing Agency">Marketing Agency</option>
              <option value="Construction">Construction</option>
              <option value="Legal Services">Legal Services</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
            <select 
              value={formData.country}
              onChange={handleCountryChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" 
            >
              {Object.keys(CITIES_BY_COUNTRY).map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">City / Region</label>
            <select 
              value={formData.city}
              onChange={e => setFormData({...formData, city: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" 
            >
              {CITIES_BY_COUNTRY[formData.country].map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
            <select 
              value={formData.purpose}
              onChange={e => setFormData({...formData, purpose: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="Cold Outreach">Cold Outreach</option>
              <option value="SEO Audit">SEO Audit</option>
              <option value="Website Redesign">Website Redesign</option>
            </select>
          </div>
          <div className="md:col-span-4 flex justify-end mt-2">
            <button 
              type="submit" 
              disabled={loading}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
            >
              {loading ? "Engaging Visual Scraper..." : "Deploy Live Scraper"}
            </button>
          </div>
        </form>
      </div>
      {/* Live Monitor */}
      {(loading || liveFrame || results.length > 0) && (
        <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-800 overflow-hidden relative">
          {/* Monitor Header */}
          <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <h3 className="text-slate-400 text-xs font-mono tracking-widest uppercase ml-4">Live Scraping Terminal</h3>
            </div>
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                {loading && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${loading ? 'bg-red-500' : 'bg-slate-600'}`}></span>
              </span>
              <span className="text-slate-400 text-xs font-mono uppercase">{loading ? 'REC' : 'IDLE'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3">
            {/* 3D Map Engine - TODO: Fix lit module resolution */}
            <div className="md:col-span-2 aspect-video bg-black relative flex flex-col overflow-hidden border-r border-slate-800 p-0 m-0 w-full h-[500px]">
              <div className="flex items-center justify-center h-full text-slate-400">
                <div className="text-center">
                  <p className="text-sm">Map visualization disabled</p>
                  <p className="text-xs text-slate-500 mt-2">Location: {loading ? `${formData.city}, ${formData.country}` : 'Awaiting input'}</p>
                </div>
              </div>
              {/* Scanlines overlay effect */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(transparent_50%,rgba(0,0,0,1)_50%)] bg-[length:100%_4px] z-50"></div>
            </div>

            {/* Status Feed */}
            <div className="bg-slate-900 p-4 font-mono text-xs flex flex-col">
              <div className="text-emerald-500 mb-4 border-b border-slate-800 pb-2 uppercase tracking-wide font-bold">
                System Status
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-slate-300">
                  <span className="text-blue-400 mr-2">{'>'}</span> 
                  {liveStatus}
                </p>
                {loading && (
                  <p className="text-slate-500 animate-pulse">_</p>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800">
                <p className="text-slate-400">Leads Extracted: <span className="text-emerald-400 font-bold">{results.length}</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h3 className="font-semibold text-slate-800">Extracted Leads</h3>
            <button 
              onClick={handleImport}
              disabled={importing || selectedLeads.size === 0}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm"
            >
              {importing ? "Importing..." : `Import Selected (${selectedLeads.size}) to CRM`}
            </button>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-12">
                  <input 
                    type="checkbox" 
                    checked={selectedLeads.size === results.length}
                    onChange={() => {
                      if (selectedLeads.size === results.length) setSelectedLeads(new Set())
                      else setSelectedLeads(new Set(results.map((_, i) => i)))
                    }}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">Company</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Website</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Email</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((lead, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <input 
                      type="checkbox" 
                      checked={selectedLeads.has(i)}
                      onChange={() => toggleSelection(i)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900">{lead.companyName}</td>
                  <td className="px-4 py-3 text-blue-600 truncate max-w-[200px]">
                    <a href={lead.websiteUrl} target="_blank" rel="noreferrer" className="hover:underline">{lead.websiteUrl}</a>
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-medium">{lead.contactEmail}</td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      {lead.leadScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
