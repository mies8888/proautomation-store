import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/prisma"
import BuyCreditsButton from "@/components/features/BuyCreditsButton"

export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const session = await auth()
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { credits: true }
  })

  const transactions = await prisma.creditTransaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Billing & Credits</h1>
          <p className="text-slate-500 mt-1">Manage your credit balance and view transaction history.</p>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Available Balance</p>
            <p className="text-3xl font-bold text-slate-900">{user?.credits ?? 0} <span className="text-lg text-slate-500">Credits</span></p>
          </div>
          <BuyCreditsButton />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Transaction Ledger</h2>
        </div>
        <div className="divide-y divide-slate-200 max-h-[600px] overflow-y-auto">
          {transactions.map(tx => (
            <div key={tx.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition">
              <div>
                <p className="font-semibold text-slate-900">{tx.reason}</p>
                {tx.description && <p className="text-sm text-slate-500">{tx.description}</p>}
                <p className="text-xs text-slate-400 mt-1">{new Date(tx.createdAt).toLocaleString()}</p>
              </div>
              <div className={`font-bold text-lg ${tx.amount > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                {tx.amount > 0 ? '+' : ''}{tx.amount}
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="p-10 text-center text-slate-500">
              No transactions yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
