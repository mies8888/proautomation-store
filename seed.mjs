import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = "postgres://postgres:password@localhost:5432/proautomation?sslmode=disable";
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding real data into PostgreSQL...');

  const hash = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@proautomation.store' },
    update: { 
      passwordHash: hash,
      role: 'ADMIN',
      credits: 50000
    },
    create: {
      email: 'admin@proautomation.store',
      passwordHash: hash,
      name: 'Admin User',
      role: 'ADMIN',
      credits: 50000,
    },
  });

  console.log(`✅ Admin User Seeded: ${user.email} / password123`);

  // Seed Leads
  const leadsData = [
    { company: 'Acme Plumbing', url: 'https://acmeplumbing.com', score: 85, status: 'NEW' },
    { company: 'Global Tech HVAC', url: 'https://globalhvac.com', score: 92, status: 'CONTACTED' },
    { company: 'Sarah\'s Bakery', url: 'https://sarahsbakery.com', score: 45, status: 'NEW' },
    { company: 'ProRoofing LLC', url: 'https://proroofing.com', score: 78, status: 'QUALIFIED' },
  ];

  for (const l of leadsData) {
    const lead = await prisma.lead.create({
      data: {
        ownerUserId: user.id,
        companyName: l.company,
        websiteUrl: l.url,
        leadScore: l.score,
        status: l.status,
      }
    });
    console.log(`✅ Seeded Lead: ${lead.companyName}`);

    // Seed Marketplace Listing for High-Score Leads
    if (l.score > 80) {
      await prisma.marketplaceListing.create({
        data: {
          leadId: lead.id,
          sellerId: user.id,
          askingPrice: l.score * 10,
          status: 'ACTIVE'
        }
      });
      console.log(`✅ Seeded Marketplace Listing for ${lead.companyName}`);
    }
  }

  console.log('🎉 Database fully seeded with real data!');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
