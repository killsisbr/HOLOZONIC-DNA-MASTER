const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { broadcastUpdate } = require('../lib/socket');

router.post('/:id/start', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(id) },
      include: { patient: true }
    });
    if (!appointment) return res.status(404).json({ error: 'Agendamento nao encontrado' });

    const roomId = `tele-${appointment.id}-${Date.now()}`;
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'EM_ATENDIMENTO' }
    });

    broadcastUpdate('teleconsulta:started', { roomId, appointmentId: appointment.id, patientName: appointment.patient.name });
    res.json({ success: true, roomId, appointmentId: appointment.id, patientName: appointment.patient.name });
  } catch (error) {
    console.error('[Teleconsulta] Erro:', error.message);
    res.status(500).json({ error: 'Erro ao iniciar teleconsulta' });
  }
});

module.exports = router;
