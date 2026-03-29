const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('JARVIS: Starting Demo Seed...');

  // 1. Clean up potential old data
  await prisma.appointment.deleteMany({});
  await prisma.clinicalRecord.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.potentialLead.deleteMany({});

  // 2. Create Patients
  const p1 = await prisma.patient.create({
    data: {
      name: 'Jorge Amado da Silva',
      cpf: '123.456.789-00',
      birthDate: '1965-05-20',
      plan: 'Particular',
      records: {
        create: [
          { date: '2026-03-20', type: 'Evolução Clínica', description: 'Paciente apresenta melhora significativa no padrão do sono após introdução do protocolo de higiene do sono.', cid10: 'G47.0' },
          { date: '2026-03-25', type: 'Exame Bioenergético', description: 'Níveis de cortisol em declínio. Alinhamento energético estável.', cid10: 'Z00.0' }
        ]
      }
    }
  });

  const p2 = await prisma.patient.create({
    data: {
      name: 'Clarice Lispector de Oliveira',
      cpf: '987.654.321-11',
      birthDate: '1982-12-10',
      plan: 'Unimed',
      records: {
        create: [
          { date: '2026-03-15', type: 'Consulta Inicial', description: 'Queixa de fadiga crônica e ansiedade leve.', cid10: 'F41.1' }
        ]
      }
    }
  });

  // 3. Create Appointments
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  await prisma.appointment.create({
    data: {
      patientId: p1.id,
      dateTime: `${today} 09:00`,
      type: 'CONSULTA PRESENCIAL',
      status: 'FINALIZADO'
    }
  });

  await prisma.appointment.create({
    data: {
      patientId: p1.id,
      dateTime: `${today} 14:00`,
      type: 'CONSULTA TELEMEDICINA',
      status: 'AGUARDANDO'
    }
  });

  await prisma.appointment.create({
    data: {
      patientId: p2.id,
      dateTime: `${today} 10:30`,
      type: 'PROCEDIMENTO BIO',
      status: 'EM_ATENDIMENTO'
    }
  });

  // 4. Create Leads (Funnel)
  await prisma.potentialLead.create({
    data: {
      name: 'Vinícius de Moraes',
      phone: '(48) 99999-0001',
      source: 'HOSPEDAGEM',
      step: 1,
      data: JSON.stringify({ interested_in: 'Pacote Longevidade 7 dias' })
    }
  });

  await prisma.potentialLead.create({
    data: {
      name: 'Cecília Meireles',
      email: 'cecilia@literatura.com',
      source: 'SONO',
      step: 2,
      data: JSON.stringify({ note: 'Interessada em terapia do sono avançada' })
    }
  });

  console.log('JARVIS: Demo Seed Completed Successfully.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
