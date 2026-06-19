import { prisma } from "@/lib/db/prisma"

export const COST = {
  LEAD_SEARCH: 1,
  WEBSITE_ANALYSIS: 2,
  REPORT_GENERATION: 3,
  WEBSITE_GENERATION: 10
}

export async function hasSufficientCredits(userId: string, requiredCredits: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true }
  })
  
  if (!user) return false
  return user.credits >= requiredCredits
}

export async function deductCredits(userId: string, amount: number, reason: string, description?: string): Promise<boolean> {
  if (amount <= 0) return false

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { credits: true }
      })

      if (!user || user.credits < amount) {
        throw new Error("Insufficient credits")
      }

      await tx.user.update({
        where: { id: userId },
        data: { credits: { decrement: amount } }
      })

      await tx.creditTransaction.create({
        data: {
          userId,
          amount: -amount,
          reason,
          description
        }
      })
    })
    return true
  } catch (error) {
    console.error("Credit deduction failed:", error)
    return false
  }
}

export async function addCredits(userId: string, amount: number, reason: string, description?: string): Promise<boolean> {
  if (amount <= 0) return false

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: amount } }
      })

      await tx.creditTransaction.create({
        data: {
          userId,
          amount,
          reason,
          description
        }
      })
    })
    return true
  } catch (error) {
    console.error("Credit addition failed:", error)
    return false
  }
}
