const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { getWhatsAppHandler } = require('../lib/whatsapp');

router.get('/status', authenticateToken, async (req, res) => {
  const waHandler = getWhatsAppHandler();
  if (!waHandler) return res.status(503).json({ error: 'WhatsApp não disponível' });
  res.json({ success: true, ...waHandler.getStatus() });
});

router.post('/start', authenticateToken, async (req, res) => {
  const waHandler = getWhatsAppHandler();
  if (!waHandler) return res.status(503).json({ error: 'WhatsApp não disponível' });
  try {
    await waHandler.start();
    res.json({ success: true, message: 'WhatsApp iniciado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/send', authenticateToken, async (req, res) => {
  const waHandler = getWhatsAppHandler();
  if (!waHandler) return res.status(503).json({ error: 'WhatsApp não disponível' });
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'Phone e message são obrigatórios' });
  try {
    const result = await waHandler.sendMessage(phone, message);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/reminder', authenticateToken, async (req, res) => {
  const waHandler = getWhatsAppHandler();
  if (!waHandler) return res.status(503).json({ error: 'WhatsApp não disponível' });
  try {
    const appointment = await prisma.appointment.findUnique({ where: { id: parseInt(req.body.appointmentId) }, include: { patient: true } });
    if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado' });
    const result = await waHandler.sendReminder(appointment.patient, appointment);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/lead/welcome', authenticateToken, async (req, res) => {
  const waHandler = getWhatsAppHandler();
  if (!waHandler) return res.status(503).json({ error: 'WhatsApp não disponível' });
  try {
    const lead = await prisma.potentialLead.findUnique({ where: { id: parseInt(req.body.leadId) } });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
    const result = await waHandler.sendLeadWelcome(lead);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
