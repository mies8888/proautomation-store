import Link from "next/link"
import { auth } from "@/lib/auth"
import { hasModuleAccess } from "@/services/permissions"
import { prisma } from "@/lib/db/prisma"

// This defines all possible modules. The sidebar will filter them based on user permissions.
const allNavItems = [
  { label: 'Dashboard', href: '/dashboard', requiredModule: null },
  { label: 'CRM Pipeline', href: '/dashboard/leads', requiredModule: 'crm-pipeline' },
  { label: 'Lead Generator', href: '/dashboard/lead-generator', requiredModule: 'lead-generator' },
  { label: 'Website Builder', href: '/dashboard/websites', requiredModule: 'ai-website-builder' },
  { label: 'Outreach', href: '/dashboard/outreach', requiredModule: 'gmail-outreach' },
  { label: 'Hot Calls', href: '/dashboard/hotcalls', requiredModule: 'hot-call-marketplace' },
  { label: 'Email Composer', href: '/email-composer', requiredModule: 'gmail-outreach' },
  { label: 'Campaign Performance', href: '/campaign-performance', requiredModule: 'gmail-outreach' },
  { label: 'Quota Status', href: '/quota-status', requiredModule: 'gmail-outreach' },
  { label: 'Bulk Operations', href: '/bulk-operations', requiredModule: 'gmail-outreach' },
  { label: 'Job Queue Monitor', href: '/job-queue-monitor', requiredModule: null },
  { label: 'CRM Integrations', href: '/crm-integrations', requiredModule: null },
  { label: 'Billing & Credits', href: '/dashboard/billing', requiredModule: null },
]

export async function Sidebar() {
  const session = await auth()
  const userId = session?.user?.id

  const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } }) : null

  // Filter items based on access
  const availableItems = await Promise.all(
    allNavItems.map(async (item) => {
      if (!item.requiredModule) return item
      if (!userId) return null
      
      const hasAccess = await hasModuleAccess(userId, item.requiredModule)
      return hasAccess ? item : null
    })
  )

  const finalItems = availableItems.filter(Boolean) as typeof allNavItems

  return (
    <div className="w-64 bg-slate-900 text-slate-300 min-h-screen border-r border-slate-800 flex flex-col">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">ProAutomation</h2>
      </div>
      
      <nav className="flex-1 px-4 space-y-1 mt-4">
        {finalItems.map(item => (
          <Link 
            key={item.href} 
            href={item.href} 
            className="flex items-center px-4 py-3 text-sm font-medium rounded-lg hover:bg-indigo-600 hover:text-white transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-4">
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Credits</p>
          <div className="flex items-end space-x-2">
            <span className="text-xl font-bold text-emerald-400">{user?.credits ?? 0}</span>
            <Link href="/dashboard/billing" className="text-xs text-indigo-400 hover:text-indigo-300 pb-1">Top up</Link>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Logged in as {session?.user?.role || 'User'}
        </div>
      </div>
    </div>
  )
}
