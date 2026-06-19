"use client"
import { useState } from "react"

export default function WebsiteEditorTabs({ htmlContent }: { htmlContent: string }) {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview')
  const [code, setCode] = useState(htmlContent)

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-center space-x-2 p-2 bg-slate-100 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('preview')}
          className={`px-6 py-1.5 rounded-full text-sm font-medium transition ${activeTab === 'preview' ? 'bg-white shadow-sm text-indigo-600 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Visual Preview
        </button>
        <button 
          onClick={() => setActiveTab('code')}
          className={`px-6 py-1.5 rounded-full text-sm font-medium transition ${activeTab === 'code' ? 'bg-white shadow-sm text-indigo-600 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Raw HTML/Tailwind
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative bg-slate-100 p-4">
        {activeTab === 'preview' ? (
          <div className="w-full h-full bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200 flex flex-col">
            <div className="h-8 bg-slate-50 border-b border-slate-200 flex items-center px-4 space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
              <div className="ml-4 text-xs text-slate-400 font-mono bg-slate-100 px-24 py-0.5 rounded-md border border-slate-200">localhost:3000/preview</div>
            </div>
            <iframe 
              srcDoc={code}
              className="w-full flex-1 border-none bg-white"
              title="Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        ) : (
          <div className="w-full h-full bg-[#1e1e1e] rounded-xl shadow-xl overflow-hidden border border-slate-800 flex flex-col">
            <div className="h-10 bg-[#2d2d2d] flex items-center px-4 border-b border-black">
              <span className="text-slate-300 text-xs font-mono">index.html</span>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full flex-1 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm p-6 focus:outline-none resize-none"
              spellCheck="false"
            />
          </div>
        )}
      </div>
    </div>
  )
}
