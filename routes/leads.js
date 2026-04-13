const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { broadcastUpdate } = require('../lib/socket');
const { generateValidCpf } = require('../lib/utils');
const { syncAppointmentToGoogle } = require('../google_calendar');

// --- LEAD SYNC ---
router.post('/sync', async (req, res) => {
  const { name, phone, email, source, step, data } = req.body;
  if (!phone && !email) return res.status(400).json({ error: "Phone or Email required." });

  try {
    let lead = await prisma.potentialLead.findFirst({
      where: { OR: [{ phone: phone || undefined }, { email: email || undefined }] }
    });

    if (lead) {
      lead = await prisma.potentialLead.update({
        where: { id: lead.id },
        data: { name: name || lead.name, phone: phone || lead.phone, email: email || lead.email, source: source || lead.source, step: step || lead.step, data: JSON.stringify(data) }
      });
    } else {
      lead = await prisma.potentialLead.create({
        data: { name, phone, email, source, step, data: JSON.stringify(data) }
      });
    }
    broadcastUpdate('leads:updated', lead);
    res.json({ success: true, leadId: lead.id });
  } catch (error) {
    res.status(500).json({ error: "Failed to sync lead." });
  }
});

router.post('/book-appointment', async (req, res) => {
  const { leadId } = req.body;
  try {
    const lead = await prisma.potentialLead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: "Lead not found." });

    const parsedData = JSON.parse(lead.data || '{}');
    const inezData = parsedData.inezData || {};
    let dateVal = inezData.data || parsedData.horaLoc?.split(' ')[0] || null;
    let timeVal = inezData.hora || parsedData.horaLoc?.split(' ')[1] || null;

    if (!dateVal || !timeVal) return res.status(400).json({ error: "Lead missing date/time." });
    const dateTimeStr = `${dateVal} ${timeVal}`;

    const existing = await prisma.appointment.findFirst({ where: { dateTime: dateTimeStr } });
    if (existing) return res.status(409).json({ error: "Slot ocupado." });

    let patient = await prisma.patient.findFirst({ where: { OR: [{ name: lead.name }, { phone: lead.phone?.replace(/\D/g, '') }] } });
    if (!patient) {
      patient = await prisma.patient.create({
        data: { name: lead.name || 'Paciente Inez', cpf: generateValidCpf(), phone: lead.phone?.replace(/\D/g, '') || null, birthDate: "1900-01-01", plan: lead.source || "Inez" }
      });
    }

    const procName = parsedData.selectedProcedure?.name || parsedData.procedimento || 'CONSULTA';
    const appointment = await prisma.appointment.create({
      data: { patientId: patient.id, dateTime: dateTimeStr, type: procName.toUpperCase().includes('TELE') ? 'TELE' : 'PRESENCIAL', status: 'AGUARDANDO' },
      include: { patient: true }
    });

    syncAppointmentToGoogle(appointment.id).catch(console.error);
    await prisma.potentialLead.delete({ where: { id: leadId } });
    res.json({ success: true, appointment });
  } catch (error) {
    res.status(500).json({ error: "Failed to book appointment." });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  const leads = await prisma.potentialLead.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(leads);
});

router.post('/convert', authenticateToken, async (req, res) => {
  const leadId = parseInt(req.body.leadId);
  try {
    const lead = await prisma.potentialLead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: "Lead not found." });

    const newPatient = await prisma.patient.create({
      data: { name: lead.name || 'Paciente s/ Nome', cpf: generateValidCpf(), phone: lead.phone?.replace(/\D/g, '') || null, birthDate: "1900-01-01", plan: lead.source || "Lead Orgânico" }
    });

    let leadNotes = `[ CONVERSÃO DE LEAD ]\nOrigem: ${lead.source || 'N/D'}\n`;
    await prisma.clinicalRecord.create({
      data: { patientId: newPatient.id, date: new Date().toLocaleDateString('pt-BR'), type: 'Triagem de Lead', description: leadNotes, cid10: 'Z00.0' }
    });

    await prisma.potentialLead.delete({ where: { id: leadId } });
    broadcastUpdate('leads:converted', newPatient);
    res.json({ success: true, newPatient });
  } catch (error) {
    res.status(500).json({ error: 'Failed to convert lead.' });
  }
});

module.exports = router;
