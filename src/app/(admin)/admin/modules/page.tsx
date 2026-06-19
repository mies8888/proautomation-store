import { prisma } from "@/lib/db/prisma"

export const dynamic = 'force-dynamic'

export default async function AdminModulesPage() {
  const modules = await prisma.module.findMany({
    orderBy: { name: 'asc' }
  })

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Module Management</h1>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors">
          Create Module
        </button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-700 uppercase tracking-wider text-xs">Module</th>
              <th className="px-6 py-4 font-semibold text-slate-700 uppercase tracking-wider text-xs">System Slug</th>
              <th className="px-6 py-4 font-semibold text-slate-700 uppercase tracking-wider text-xs">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {modules.map(mod => (
              <tr key={mod.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900">{mod.name}</td>
                <td className="px-6 py-4 text-slate-500 font-mono text-xs">{mod.slug}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    mod.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {mod.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
            
            {modules.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                  No modules found. Please run the database seed script.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
