const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticateToken, checkRole } = require('../middleware/auth');
const { broadcastUpdate } = require('../lib/socket');

// Patient Personal Data
router.get('/data', authenticateToken, async (req, res) => {
  if (req.user.role !== 'PACIENTE' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const patientId = req.user.id;
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });
    
    const appointments = await prisma.appointment.findMany({
      where: { patientId },
      orderBy: { dateTime: 'desc' }
    });

    const records = await prisma.clinicalRecord.findMany({
      where: { patientId },
      include: { attachments: true },
      orderBy: { date: 'desc' }
    });

    res.json({ patient, appointments, records });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dados do paciente' });
  }
});

// --- PATIENTS (PROTECTED) ---
router.get('/', authenticateToken, async (req, res) => {
  const patients = await prisma.patient.findMany({
    include: { appointments: true, records: true }
  });
  res.json(patients);
});

router.get('/:id', authenticateToken, async (req, res) => {
  const patient = await prisma.patient.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { appointments: true, records: true }
  });
  if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });
  res.json(patient);
});

router.patch('/:id', authenticateToken, checkRole(['ADMIN', 'MEDICO', 'ATENDENTE']), async (req, res) => {
  const { id } = req.params;
  const { name, birthDate, plan, medications, active, phone } = req.body;
  try {
    const patient = await prisma.patient.update({
      where: { id: parseInt(id) },
      data: { name, birthDate, plan, medications, active, phone }
    });
    res.json(patient);
  } catch (e) {
    res.status(400).json({ error: 'Erro ao atualizar paciente.' });
  }
});

router.post('/', authenticateToken, checkRole(['ADMIN', 'MEDICO', 'ATENDENTE']), async (req, res) => {
  const { name, cpf, birthDate, plan, phone, medications } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });

  try {
    let condition = [];
    if (cpf && typeof cpf === 'string' && !cpf.startsWith('LEAD-')) {
      condition.push({ cpf });
    }
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      condition.push({ phone: cleanPhone });
    }
    if (name) {
      condition.push({ name });
    }

    let patient = null;
    if (condition.length > 0) {
      patient = await prisma.patient.findFirst({
        where: { OR: condition }
      });
    }

    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          name,
          cpf: cpf || `LEAD-${Date.now()}`,
          phone: phone || null,
          birthDate: birthDate || "1900-01-01",
          plan: plan || "Particular",
          medications: medications || null
        }
      });
      broadcastUpdate('patients:updated', patient);
    }
    res.json(patient);
  } catch (e) {
    console.error('JARVIS: Patient Create Error:', e.message);
    res.status(500).json({ error: 'Erro no servidor ao buscar/criar paciente.' });
  }
});

module.exports = router;
