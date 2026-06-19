const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@admin.com' },
    update: { passwordHash: hash },
    create: {
      email: 'admin@admin.com',
      passwordHash: hash,
      name: 'Admin'
    }
  });
  console.log('User created: admin@admin.com / password123');
}
main().catch(console.error).finally(() => prisma.$disconnect());
