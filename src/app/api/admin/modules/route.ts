import { NextResponse } from 'next/server'
import { prisma } from "@/lib/db/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const modules = await prisma.module.findMany({
    orderBy: { name: 'asc' }
  })
  
  return NextResponse.json(modules)
}
