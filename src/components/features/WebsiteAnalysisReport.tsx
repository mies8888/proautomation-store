export default function WebsiteAnalysisReport({ analysis }: { analysis: any }) {
  if (!analysis) return null

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 bg-emerald-50 border-emerald-200"
    if (score >= 50) return "text-yellow-600 bg-yellow-50 border-yellow-200"
    return "text-red-600 bg-red-50 border-red-200"
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-slate-900 tracking-tight">Website Analysis</h3>
        <div className={`px-4 py-1.5 rounded-full border font-bold text-lg ${getScoreColor(analysis.overallScore)}`}>
          Score: {analysis.overallScore}/100
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-slate-50 rounded-lg text-center border border-slate-100">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Performance</div>
          <div className={`text-2xl font-bold ${getScoreColor(analysis.performanceScore).split(' ')[0]}`}>{analysis.performanceScore}</div>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg text-center border border-slate-100">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">SEO</div>
          <div className={`text-2xl font-bold ${getScoreColor(analysis.seoScore).split(' ')[0]}`}>{analysis.seoScore}</div>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg text-center border border-slate-100">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Access</div>
          <div className={`text-2xl font-bold ${getScoreColor(analysis.accessibilityScore).split(' ')[0]}`}>{analysis.accessibilityScore}</div>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg text-center border border-slate-100">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Design</div>
          <div className={`text-2xl font-bold ${getScoreColor(analysis.designScore).split(' ')[0]}`}>{analysis.designScore}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-semibold text-red-700 mb-3 flex items-center">
            <span className="bg-red-100 text-red-800 p-1 rounded mr-2 text-xs">⚠️</span> Weaknesses
          </h4>
          <ul className="space-y-2">
            {analysis.weaknesses.map((w: string, i: number) => (
              <li key={i} className="text-sm text-slate-700 flex items-start">
                <span className="text-red-500 mr-2">•</span> {w}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-emerald-700 mb-3 flex items-center">
            <span className="bg-emerald-100 text-emerald-800 p-1 rounded mr-2 text-xs">💡</span> Opportunities
          </h4>
          <ul className="space-y-2">
            {analysis.opportunities.map((o: string, i: number) => (
              <li key={i} className="text-sm text-slate-700 flex items-start">
                <span className="text-emerald-500 mr-2">•</span> {o}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
