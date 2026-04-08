const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { broadcastUpdate } = require('../lib/socket');
const { getWhatsAppHandler } = require('../lib/whatsapp');
const { syncAppointmentToGoogle } = require('../google_calendar');
const neverReject = require('../system/never-reject-engine');
const pushHandler = require('../lib/push');

// Mutex for appointment slot locking (moved logic to a local helper or import if possible, but keep here for now if simple)
const slotLocks = new Map();
function acquireSlotLock(dateTime) {
  if (slotLocks.has(dateTime)) return false;
  slotLocks.set(dateTime, true);
  return true;
}
function releaseSlotLock(dateTime) {
  slotLocks.delete(dateTime);
}

// --- AGENDA: CANCELAMENTO COM MOTIVO ---
router.post('/cancel', authenticateToken, async (req, res) => {
  const { id, reason } = req.body;
  if (!id) return res.status(400).json({ error: 'ID do agendamento obrigatorio' });

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(id) },
      include: { patient: true }
    });

    if (!appointment) return res.status(404).json({ error: 'Agendamento nao encontrado' });
    if (appointment.status === 'CANCELADO') return res.status(400).json({ error: 'Agendamento ja cancelado' });

    const updated = await prisma.appointment.update({
      where: { id: parseInt(id) },
      data: {
        status: 'CANCELADO',
        cancelReason: reason || 'Nao informado'
      },
      include: { patient: true }
    });

    const waHandler = getWhatsAppHandler();
    if (waHandler && waHandler.status === 'CONNECTED' && updated.patient.phone) {
      waHandler.sendCancellation(updated.patient, appointment.dateTime, reason).catch(err => {
        console.error('[WA] Erro ao enviar cancelamento:', err.message);
      });
    }

    broadcastUpdate('agenda:updated', updated);
    res.json({ success: true, appointment: updated });
  } catch (error) {
    console.error('JARVIS: Cancel Error:', error.message);
    res.status(500).json({ error: 'Erro ao cancelar agendamento' });
  }
});

// --- AGENDA: REAGENDAMENTO ---
router.post('/reschedule', authenticateToken, async (req, res) => {
  const { id, newDateTime, reason } = req.body;
  if (!id || !newDateTime) return res.status(400).json({ error: 'ID e novo horario obrigatorios' });

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(id) },
      include: { patient: true }
    });

    if (!appointment) return res.status(404).json({ error: 'Agendamento nao encontrado' });
    if (appointment.status === 'CANCELADO') return res.status(400).json({ error: 'Nao e possivel reagendar um agendamento cancelado' });

    if (!acquireSlotLock(newDateTime)) {
      return res.status(409).json({ error: 'Slot ocupado. Por favor, escolha outro horario.' });
    }

    try {
      const existing = await prisma.appointment.findFirst({
        where: {
          dateTime: newDateTime,
          status: { not: 'CANCELADO' }
        }
      });

      if (existing) {
        return res.status(409).json({ error: 'Slot ocupado. Por favor, escolha outro horario.' });
      }

      const updated = await prisma.appointment.update({
        where: { id: parseInt(id) },
        data: {
          dateTime: newDateTime,
          status: 'REAGENDADO',
          rescheduleReason: reason || appointment.rescheduleReason || 'Nao informado',
          rescheduleCount: { increment: 1 },
          originalDateTime: appointment.originalDateTime || appointment.dateTime,
          reminderSent: false
        },
        include: { patient: true }
      });

      syncAppointmentToGoogle(updated.id).catch(err => {
        console.error('JARVIS: Google Sync on reschedule failed:', err.message);
      });

      const waHandler = getWhatsAppHandler();
      if (waHandler && waHandler.status === 'CONNECTED' && updated.patient.phone) {
        const oldDate = appointment.originalDateTime || appointment.dateTime;
        waHandler.sendReschedule(updated.patient, oldDate, newDateTime, reason).catch(err => {
          console.error('[WA] Erro ao enviar reagendamento:', err.message);
        });
      }

      broadcastUpdate('agenda:updated', updated);
      res.json({ success: true, appointment: updated });
    } finally {
      releaseSlotLock(newDateTime);
    }
  } catch (error) {
    console.error('JARVIS: Reschedule Error:', error.message);
    res.status(500).json({ error: 'Erro ao reagendar agendamento' });
  }
});

// --- AGENDA: MARCAR NO-SHOW ---
router.post('/no-show', authenticateToken, async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'ID do agendamento obrigatorio' });

  try {
    const updated = await prisma.appointment.update({
      where: { id: parseInt(id) },
      data: {
        status: 'NO_SHOW',
        noShow: true
      },
      include: { patient: true }
    });

    broadcastUpdate('agenda:updated', updated);
    res.json({ success: true, appointment: updated });
  } catch (error) {
    console.error('JARVIS: No-show Error:', error.message);
    res.status(500).json({ error: 'Erro ao marcar no-show' });
  }
});

// --- AGENDA: ADD NOTAS ---
router.patch('/:id/notes', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  try {
    const updated = await prisma.appointment.update({
      where: { id: parseInt(id) },
      data: { notes }
    });

    res.json({ success: true, appointment: updated });
  } catch (error) {
    console.error('JARVIS: Notes Error:', error.message);
    res.status(500).json({ error: 'Erro ao adicionar notas' });
  }
});

// --- AGENDA & FILA ---
router.get('/', authenticateToken, async (req, res) => {
  const agenda = await prisma.appointment.findMany({
    include: { patient: true }
  });
  res.json(agenda);
});

router.patch('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, type, dateTime } = req.body;
  try {
    const appointment = await prisma.appointment.update({
      where: { id: parseInt(id) },
      data: { status, type, dateTime },
      include: { patient: true }
    });

    syncAppointmentToGoogle(appointment.id).catch(err => {
      console.error('JARVIS: Google Sync Update failed:', err.message);
    });

    broadcastUpdate('agenda:updated', appointment);
    res.json(appointment);
  } catch (error) {
    console.error('JARVIS: Agenda Update Error:', error.message);
    res.status(500).json({ error: 'Failed to update' });
  }
});

router.post('/checkin', authenticateToken, async (req, res) => {
  const { patientId, type } = req.body;
  const now = new Date();
  const entryTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      type,
      dateTime: entryTime,
      status: 'AGUARDANDO'
    }
  });

  syncAppointmentToGoogle(appointment.id).catch(console.error);
  res.json(appointment);
});

router.post('/', authenticateToken, async (req, res) => {
  const { patientId, dateTime, type, status } = req.body;
  
  try {
    if (!dateTime) {
      return res.status(400).json({ error: 'Data/hora obrigatoria' });
    }

    const pId = parseInt(patientId);
    if (isNaN(pId)) {
       return res.status(400).json({ error: 'ID de paciente invalido.' });
    }

    const requestedDate = new Date(dateTime);
    const { finalStart, isAdjusted } = await neverReject.findAvailableSlot(prisma, requestedDate, 60);
    const finalDateTime = finalStart.toISOString();

    if (!acquireSlotLock(finalDateTime)) {
      return res.status(409).json({ error: 'Slot ocupado. Por favor, escolha outro horario.' });
    }

    try {
      const appointment = await prisma.appointment.create({
        data: {
          patientId: pId,
          dateTime: finalDateTime,
          type: type || 'PRESENCIAL',
          status: isAdjusted ? 'AGENDADO' : (status || 'AGENDADO'),
          notes: isAdjusted ? `Horario original ajustado automaticamente pelo sistema Never-Reject` : null
        },
        include: { patient: true }
      });

      syncAppointmentToGoogle(appointment.id).catch(console.error);

      broadcastUpdate('agenda:created', appointment);
      
      pushHandler.sendPushNotification(
        appointment.patientId.toString(),
        'Agendamento Confirmado',
        `Sua consulta foi agendada para ${display.date} às ${display.time}`,
        '/app'
      ).catch(err => console.error('[PUSH] Erro ao enviar notificação:', err.message));
      
      const display = neverReject.formatDisplayDateTime(finalStart);
      res.status(201).json({ 
        ...appointment, 
        isAdjusted,
        adjustedFrom: isAdjusted ? dateTime : null,
        displayDate: display.date,
        displayTime: display.time
      });
    } finally {
      releaseSlotLock(finalDateTime);
    }
  } catch (error) {
    console.error('JARVIS: Agenda Create Error:', error.message);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// PUBLIC ROUTE - Get occupied slots
router.get('/occupied', async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { status: { not: 'CANCELADO' } },
      select: { dateTime: true }
    });
    const occupied = appointments.map(a => a.dateTime);
    res.json(occupied);
  } catch(e) {
    console.error('JARVIS: Error fetching occupied slots:', e);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
