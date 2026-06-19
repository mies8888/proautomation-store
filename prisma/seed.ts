import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  // Modules
  const modulesData = [
    { name: 'Lead Generator', slug: 'lead-generator', description: 'Find B2B leads online.' },
    { name: 'Website Analyzer', slug: 'website-analyzer', description: 'Analyze websites for opportunities.' },
    { name: 'AI Website Builder', slug: 'ai-website-builder', description: 'Build and sell fully working websites.' },
    { name: 'CRM Pipeline', slug: 'crm-pipeline', description: 'Manage leads in a CRM.' },
    { name: 'Gmail Outreach', slug: 'gmail-outreach', description: 'Generate personalized outreach emails.' },
    { name: 'Hot Call Marketplace', slug: 'hot-call-marketplace', description: 'Sell and buy hot calls.' },
  ]

  const createdModules = []
  for (const mod of modulesData) {
    const m = await prisma.module.upsert({
      where: { slug: mod.slug },
      update: {},
      create: mod,
    })
    createdModules.push(m)
  }
  
  // Business Types
  const businessTypesData = [
    { name: 'Staffing Agency / Uitzendbureau', slug: 'staffing-agency', description: 'For companies that recruit and place workers.' },
    { name: 'Personnel Supplier', slug: 'personnel-supplier', description: 'Supply workers, teams, freelancers.' },
    { name: 'Web Design Agency', slug: 'web-design-agency', description: 'Selling websites, redesigns.' },
    { name: 'SEO Agency', slug: 'seo-agency', description: 'Selling SEO and local SEO.' },
  ]

  for (const bt of businessTypesData) {
    const businessType = await prisma.businessType.upsert({
      where: { slug: bt.slug },
      update: {},
      create: bt,
    })

    // Assign standard modules based on type
    for (const mod of createdModules) {
      if (mod.slug === 'ai-website-builder' && bt.slug !== 'web-design-agency') continue
      
      await prisma.businessTypeModule.upsert({
        where: {
          businessTypeId_moduleId: {
            businessTypeId: businessType.id,
            moduleId: mod.id,
          }
        },
        update: {},
        create: {
          businessTypeId: businessType.id,
          moduleId: mod.id,
          enabled: true,
        }
      })
    }
  }

  // CRM Statuses for Staffing Agency
  const staffingBT = await prisma.businessType.findUnique({ where: { slug: 'staffing-agency' } })
  if (staffingBT) {
    await prisma.businessTypeCRMStatus.deleteMany({ where: { businessTypeId: staffingBT.id } })
    const statuses = [
      { label: 'New Lead', value: 'NEW', color: 'gray', sortOrder: 1, isDefault: true },
      { label: 'Website Found', value: 'WEBSITE_FOUND', color: 'blue', sortOrder: 2 },
      { label: 'Analyzed', value: 'ANALYZED', color: 'indigo', sortOrder: 3 },
      { label: 'Email Sent', value: 'EMAIL_SENT', color: 'yellow', sortOrder: 4 },
      { label: 'Interested', value: 'INTERESTED', color: 'green', sortOrder: 5 },
      { label: 'Client Won', value: 'WON', color: 'emerald', sortOrder: 6 },
    ]
    for (const st of statuses) {
      await prisma.businessTypeCRMStatus.create({
        data: { ...st, businessTypeId: staffingBT.id }
      })
    }
  }

  // CRM Statuses for Web Design
  const webBT = await prisma.businessType.findUnique({ where: { slug: 'web-design-agency' } })
  if (webBT) {
    await prisma.businessTypeCRMStatus.deleteMany({ where: { businessTypeId: webBT.id } })
    const webStatuses = [
      { label: 'New Lead', value: 'NEW', color: 'gray', sortOrder: 1, isDefault: true },
      { label: 'Weak Website Found', value: 'WEAK_FOUND', color: 'orange', sortOrder: 2 },
      { label: 'Demo Generated', value: 'DEMO_GENERATED', color: 'indigo', sortOrder: 3 },
      { label: 'Offer Sent', value: 'OFFER_SENT', color: 'yellow', sortOrder: 4 },
      { label: 'Website Published', value: 'PUBLISHED', color: 'emerald', sortOrder: 5 },
    ]
    for (const st of webStatuses) {
      await prisma.businessTypeCRMStatus.create({
        data: { ...st, businessTypeId: webBT.id }
      })
    }
  }

  // Create or update deterministic local admin user
  const adminEmail = process.env.SEED_TEST_USER_EMAIL || 'admin@proautomation.store'
  const adminPassword = process.env.SEED_TEST_USER_PASSWORD || 'password123'
  const passwordHash = await bcrypt.hash(adminPassword, 10)

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: passwordHash,
      role: UserRole.ADMIN,
    },
    create: {
      email: adminEmail,
      passwordHash: passwordHash,
      role: UserRole.ADMIN,
      credits: 1000,
      name: 'Admin User',
    }
  })

  // Attach admin user to staffing-agency business type
  const staffingBusinessType = await prisma.businessType.findUnique({
    where: { slug: 'staffing-agency' }
  })
  if (staffingBusinessType) {
    await prisma.userBusinessProfile.upsert({
      where: {
        userId_businessTypeId: {
          userId: adminUser.id,
          businessTypeId: staffingBusinessType.id,
        }
      },
      update: {},
      create: {
        userId: adminUser.id,
        businessTypeId: staffingBusinessType.id,
      }
    })
  }

  // Create sample lead for admin user if they have no leads
  const leadCount = await prisma.lead.count({
    where: { ownerUserId: adminUser.id }
  })
  if (leadCount === 0) {
    const lead = await prisma.lead.create({
      data: {
        ownerUserId: adminUser.id,
        businessTypeId: staffingBusinessType?.id,
        companyName: 'Acme Staffing',
        websiteUrl: 'https://example.com',
        industry: 'Staffing',
        status: 'NEW',
        leadScore: 72,
      }
    })
    await prisma.activityLog.create({
      data: {
        userId: adminUser.id,
        leadId: lead.id,
        action: 'LEAD_CREATED',
      }
    })
  }

  console.log('Seed completed.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
