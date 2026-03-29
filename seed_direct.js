const { PrismaClient } = require('./prisma-client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { user: 'admin' },
    update: {},
    create: {
      user: 'admin',
      hash: 'admin', // In a real app, use bcrypt
      role: 'ADMIN'
    }
  });
  console.log('Admin user seeded:', admin.user);
}

main()
  .catch(e => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
