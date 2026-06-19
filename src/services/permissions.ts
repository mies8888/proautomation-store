import { prisma } from "@/lib/db/prisma"

export async function hasModuleAccess(userId: string, moduleSlug: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      businessProfiles: true,
      moduleOverrides: {
        include: { module: true }
      },
    }
  })

  if (!user) return false
  
  // Super Admin & Admin always have access
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true

  // 1. Check user-specific overrides
  const override = user.moduleOverrides.find(o => o.module.slug === moduleSlug)
  if (override) return override.enabled

  // 2. Check business type defaults
  const targetModule = await prisma.module.findUnique({
    where: { slug: moduleSlug },
    include: {
      businessTypes: true
    }
  })

  if (!targetModule || !targetModule.isActive) return false

  if (user.businessProfiles.length > 0) {
    const businessTypeIds = user.businessProfiles.map(bp => bp.businessTypeId)
    
    // Check if any of the user's business types have this module enabled
    const hasAccess = targetModule.businessTypes.some(btm => 
      businessTypeIds.includes(btm.businessTypeId) && btm.enabled
    )

    if (hasAccess) return true
  }

  return false
}
