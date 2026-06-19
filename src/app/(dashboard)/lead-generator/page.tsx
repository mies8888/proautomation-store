import { auth } from "@/lib/auth"
import LeadGeneratorClient from "@/components/features/LeadGeneratorClient"

export default async function LeadGeneratorPage() {
  const session = await auth()
  if (!session) return null

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Lead Generator</h1>
        <p className="text-slate-500 mt-1">Discover high-quality B2B leads tailored to your business needs.</p>
      </div>
      
      <LeadGeneratorClient />
    </div>
  )
}
