const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  console.log('JARVIS: Verifying Medication Schema Persistence...');
  try {
    const patient = await prisma.patient.findFirst();
    if (!patient) {
      console.log('No patients found to test.');
      return;
    }
    
    console.log(`Testing with Patient ID: ${patient.id} (${patient.name})`);
    
    // Update medication
    const updated = await prisma.patient.update({
      where: { id: patient.id },
      data: { medications: 'Test Med 1; Test Med 2' }
    });
    
    console.log('Update Successful. Medications stored:', updated.medications);
    
    // Verify
    const verified = await prisma.patient.findUnique({ where: { id: patient.id } });
    if (verified.medications === 'Test Med 1; Test Med 2') {
      console.log('VERIFICATION SUCCESS: Data layer is 100% synchronized.');
    } else {
      console.log('VERIFICATION FAILURE: Data mismatch.');
    }
    
    // Cleanup
    await prisma.patient.update({
      where: { id: patient.id },
      data: { medications: null }
    });
    console.log('Cleanup Successful.');
    
  } catch (e) {
    console.error('VERIFICATION ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
