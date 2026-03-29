const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

async function migrate() {
  console.log('JARVIS-001: Iniciando migração de segurança (Argon2)...');
  const users = await prisma.user.findMany();
  
  for (const user of users) {
    // Se o hash não parece um hash Argon2 (geralmente começa com $argon2), vamos hashear
    if (!user.hash.startsWith('$argon2')) {
      console.log(`Hasheando senha para usuário: ${user.user}`);
      const hashedPassword = await argon2.hash(user.hash);
      await prisma.user.update({
        where: { id: user.id },
        data: { hash: hashedPassword }
      });
    }
  }
  console.log('JARVIS-001: Migração concluída com sucesso.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
