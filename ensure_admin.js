const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const prisma = new PrismaClient();

async function main() {
  const hash = await argon2.hash('admin123');
  await prisma.user.upsert({
    where: { user: 'admin' },
    update: { hash: hash, role: 'ADMIN' },
    create: {
      user: 'admin',
      hash: hash,
      role: 'ADMIN'
    }
  });
  console.log('JARVIS: Admin user ensured with argon2 hash.');
}

main().finally(() => prisma.$disconnect());
