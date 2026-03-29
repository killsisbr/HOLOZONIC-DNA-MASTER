const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  console.log('JARVIS: Verifying SQL Table Schema...');
  try {
    const tableInfo = await prisma.$queryRawUnsafe(`PRAGMA table_info(Patient);`);
    console.log('Table Info:', tableInfo);
    
    const medsColumn = tableInfo.find(c => c.name === 'medications');
    if (medsColumn) {
      console.log('SQL VERIFICATION SUCCESS: Column "medications" exists in SQLite.');
      
      // Try raw update
      await prisma.$executeRawUnsafe(`UPDATE Patient SET medications = 'RAW_SQL_TEST' WHERE id = (SELECT id FROM Patient LIMIT 1);`);
      console.log('Raw SQL Update executed.');
      
      const check = await prisma.$queryRawUnsafe(`SELECT name, medications FROM Patient LIMIT 1;`);
      console.log('Check result:', JSON.stringify(check, null, 2));
    } else {
      console.log('SQL VERIFICATION FAILURE: Column "medications" MISSING from SQLite.');
    }
  } catch (e) {
    console.error('SQL TEST ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
