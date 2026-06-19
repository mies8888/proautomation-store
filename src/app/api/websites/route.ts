import { NextRequest, NextResponse } from 'next/server'
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/prisma"
import { 
  withErrorHandling,
  ForbiddenError 
} from '@/lib/errors/handler'

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  const projects = await prisma.websiteProject.findMany({
    where: {
      lead: {
        ownerUserId: session.user.id
      }
    },
    include: { lead: true },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json(projects)
})
