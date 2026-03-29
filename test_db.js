const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const p = await prisma.patient.create({
      data: {
        name: "TEST_DB_FIELD",
        cpf: "TEST-" + Date.now(),
        birthDate: "2000-01-01",
        plan: "Test Plan",
        phone: "123456789"
      }
    });
    console.log("SUCCESS: Patient created with phone:", p.phone);
    await prisma.patient.delete({ where: { id: p.id } });
  } catch (e) {
    console.error("FAILURE:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
test();
