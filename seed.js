const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.aILog.deleteMany();
  await prisma.clinicalRecord.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();

  // Create Admin User
  await prisma.user.create({
    data: {
      user: 'admin',
      hash: '1234', // In a real app, hash this with argon2
      role: 'admin'
    }
  });

  // Sample Patients
  const p1 = await prisma.patient.create({
    data: {
      name: 'João Silva',
      cpf: '111.222.333-44',
      birthDate: '1980-05-15',
      plan: 'Unimed',
      records: {
        create: [
          { date: '10/03/2026', type: 'Evolução', description: 'Paciente relata dores leves na lombar. Prescrito repouso.', cid10: 'M54.5' }
        ]
      }
    }
  });

  const p2 = await prisma.patient.create({
    data: {
      name: 'Maria Fernandes',
      cpf: '555.666.777-88',
      birthDate: '1992-11-20',
      plan: 'Particular'
    }
  });

  // Sample Appointments
  await prisma.appointment.create({
    data: {
      patientId: p1.id,
      dateTime: 'Hoje 09:00',
      type: 'Consulta',
      status: 'Confirmado'
    }
  });

  await prisma.appointment.create({
    data: {
      patientId: p2.id,
      dateTime: 'Hoje 10:30',
      type: 'Teleconsulta',
      status: 'Aguardando Link'
    }
  });

  console.log('Database seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
