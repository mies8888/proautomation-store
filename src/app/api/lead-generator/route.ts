import { NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { generateLeads } from '@/services/leadEngine'
import { COST, hasSufficientCredits, deductCredits } from '@/services/billing'
import { rateLimit } from '@/lib/security/rateLimiter'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'
  const rate = await rateLimit(`rate-limit:${ip}`, 10)
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasSufficientCredits(session.user.id, COST.LEAD_SEARCH))) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
  }

  const { industry, country, city, purpose } = await request.json()

  if (!industry || !country || !city) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    const leads = await generateLeads({ industry, country, city, purpose })

    await deductCredits(session.user.id, COST.LEAD_SEARCH, "LEAD_SEARCH", `Search: ${industry} in ${city}`)

    return NextResponse.json(leads)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate leads' }, { status: 500 })
  }
}
