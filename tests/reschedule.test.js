// ═══════════════════════════════════════════════════════
// HOLOZONIC - TEST SUITE COMPLEXO v2
// Modulo: Reagendamento / Cancelamento / Notas / IA Suggest
// Autor: JARVIS-001
// Data: 07/04/2026
// ═══════════════════════════════════════════════════════

const http = require('http');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://127.0.0.1:3001';
const API = `${BASE_URL}/api`;

let AUTH_TOKEN = null;
let testPatientId = null;
let testAppointmentId = null;
let testUserId = null;

// ═══════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════

let passed = 0;
let failed = 0;
let errors = [];

function assert(condition, testName, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${testName}${detail ? ' - ' + detail : ''}`);
  } else {
    failed++;
    const msg = `❌ FAIL: ${testName}${detail ? ' - ' + detail : ''}`;
    console.log(`  ${msg}`);
    errors.push(msg);
  }
}

async function apiRequest(method, path, body = null, token = null) {
  const url = new URL(path, BASE_URL);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method,
    headers
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function generateValidCpf() {
  const digits = [];
  for (let i = 0; i < 9; i++) digits.push(Math.floor(Math.random() * 10));
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += digits[i] * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  digits.push(rest);
  sum = 0;
  for (let i = 0; i < 10; i++) sum += digits[i] * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  digits.push(rest);
  return digits.join('');
}

function futureDate(daysFromNow, time = '10:00') {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return `${d.toISOString().split('T')[0]} ${time}`;
}

async function createTestPatient(nameSuffix = '') {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${nameSuffix}`;
  return await apiRequest('POST', '/api/patients', {
    name: `Paciente Teste ${uniqueId}`,
    cpf: generateValidCpf(),
    phone: `119${Math.floor(Math.random() * 900000000 + 100000000)}`,
    birthDate: '1990-01-01',
    plan: 'Teste'
  }, AUTH_TOKEN);
}

async function createTestAppointment(patientId, daysFromNow, time = '10:00') {
  return await apiRequest('POST', '/api/agenda', {
    patientId,
    dateTime: futureDate(daysFromNow, time),
    type: 'PRESENCIAL',
    status: 'AGUARDANDO'
  }, AUTH_TOKEN);
}

// ═══════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════

async function setup() {
  console.log('\n═══════════════════════════════════════════');
  console.log('🧪 HOLOZONIC TEST SUITE - MODULO AUTONOMIA IA v2');
  console.log('═══════════════════════════════════════════\n');

  const loginRes = await apiRequest('POST', '/api/auth/login', { user: 'admin', pass: '1234' });
  assert(loginRes.status === 200, 'Login admin', `Status: ${loginRes.status}`);
  AUTH_TOKEN = loginRes.body.token;
  assert(!!AUTH_TOKEN, 'Token JWT recebido');
  testUserId = loginRes.body.user?.id;

  const patientRes = await createTestPatient('setup');
  assert(patientRes.status === 200, 'Paciente teste criado', `ID: ${patientRes.body.id}`);
  testPatientId = patientRes.body.id;

  const aptRes = await createTestAppointment(testPatientId, 3, '10:00');
  assert(aptRes.status === 200, 'Agendamento teste criado', `ID: ${aptRes.body?.id || 'N/A'}, Status: ${aptRes.status}`);
  testAppointmentId = aptRes.body?.id;
  assert(!!testAppointmentId, 'Appointment ID valido');

  console.log(`\n📋 Setup completo: Patient=${testPatientId}, Appointment=${testAppointmentId}\n`);
}

// ═══════════════════════════════════════════════════════
// TESTE 1: CANCELAMENTO COM MOTIVO
// ═══════════════════════════════════════════════════════

async function testCancelamento() {
  console.log('\n📌 TESTE 1: CANCELAMENTO COM MOTIVO');
  console.log('─'.repeat(50));

  const cancelRes = await apiRequest('POST', '/api/agenda/cancel', {
    id: testAppointmentId,
    reason: 'Paciente solicitou mudanca de horario'
  }, AUTH_TOKEN);

  assert(cancelRes.status === 200, '1.1 Cancelar com motivo valido', `Status: ${cancelRes.status}`);
  assert(cancelRes.body.success === true, '1.2 Response success=true');
  assert(cancelRes.body.appointment.status === 'CANCELADO', '1.3 Status atualizado para CANCELADO');
  assert(cancelRes.body.appointment.cancelReason === 'Paciente solicitou mudanca de horario', '1.4 Motivo salvo corretamente');

  const cancelAgain = await apiRequest('POST', '/api/agenda/cancel', {
    id: testAppointmentId,
    reason: 'Teste duplo cancelamento'
  }, AUTH_TOKEN);

  assert(cancelAgain.status === 400, '1.5 Duplo cancelamento bloqueado', `Status: ${cancelAgain.status}`);

  const p2 = await createTestPatient('cancel-noreason');
  const apt2 = await createTestAppointment(p2.body.id, 5, '14:00');
  if (apt2.status === 200) {
    const cancelNoReason = await apiRequest('POST', '/api/agenda/cancel', { id: apt2.body.id }, AUTH_TOKEN);
    assert(cancelNoReason.status === 200, '1.6 Cancelar sem motivo (usa padrao)', `Status: ${cancelNoReason.status}`);
    assert(cancelNoReason.body.appointment.cancelReason === 'Nao informado', '1.7 Motivo padrao aplicado');
  } else {
    console.log(`  ⚠️  1.6-1.7 Pulado (slot ocupado)`);
  }

  const cancelInvalid = await apiRequest('POST', '/api/agenda/cancel', { id: 99999 }, AUTH_TOKEN);
  assert(cancelInvalid.status === 404, '1.8 Cancelar inexistente retorna 404');

  const cancelNoId = await apiRequest('POST', '/api/agenda/cancel', { reason: 'teste' }, AUTH_TOKEN);
  assert(cancelNoId.status === 400, '1.9 Cancelar sem ID retorna 400');

  const cancelNoAuth = await apiRequest('POST', '/api/agenda/cancel', { id: 1 });
  assert(cancelNoAuth.status === 401 || cancelNoAuth.status === 403, '1.10 Cancelar sem token bloqueado', `Status: ${cancelNoAuth.status}`);
}

// ═══════════════════════════════════════════════════════
// TESTE 2: REAGENDAMENTO COMPLETO
// ═══════════════════════════════════════════════════════

async function testReagendamento() {
  console.log('\n📌 TESTE 2: REAGENDAMENTO COMPLETO');
  console.log('─'.repeat(50));

  const p = await createTestPatient('reschedule');
  const apt = await createTestAppointment(p.body.id, 4, '09:00');
  if (apt.status !== 200) {
    console.log(`  ⚠️  Teste 2 pulado: nao foi criar agendamento`);
    return;
  }

  const aptId = apt.body.id;
  const originalDateTime = apt.body.dateTime;

  const newDateTime = futureDate(6, '14:00');
  const rescheduleRes = await apiRequest('POST', '/api/agenda/reschedule', {
    id: aptId,
    newDateTime,
    reason: 'Conflito de horario do paciente'
  }, AUTH_TOKEN);

  assert(rescheduleRes.status === 200, '2.1 Reagendar com motivo', `Status: ${rescheduleRes.status}`);
  assert(rescheduleRes.body.success === true, '2.2 Response success=true');
  assert(rescheduleRes.body.appointment.dateTime === newDateTime, '2.3 DateTime atualizado', `Novo: ${rescheduleRes.body.appointment.dateTime}`);
  assert(rescheduleRes.body.appointment.status === 'REAGENDADO', '2.4 Status = REAGENDADO');
  assert(rescheduleRes.body.appointment.rescheduleCount === 1, '2.5 rescheduleCount = 1', `Count: ${rescheduleRes.body.appointment.rescheduleCount}`);
  assert(rescheduleRes.body.appointment.rescheduleReason === 'Conflito de horario do paciente', '2.6 Motivo salvo');
  assert(rescheduleRes.body.appointment.originalDateTime === originalDateTime, '2.7 originalDateTime preservado', `Original: ${rescheduleRes.body.appointment.originalDateTime}`);
  assert(rescheduleRes.body.appointment.reminderSent === false, '2.8 reminderSent resetado para false');

  const newDateTime2 = futureDate(7, '11:00');
  const reschedule2 = await apiRequest('POST', '/api/agenda/reschedule', {
    id: aptId,
    newDateTime: newDateTime2,
    reason: 'Segundo reagendamento teste'
  }, AUTH_TOKEN);

  assert(reschedule2.status === 200, '2.9 Segundo reagendamento', `Status: ${reschedule2.status}`);
  assert(reschedule2.body.appointment.rescheduleCount === 2, '2.10 rescheduleCount incrementado para 2', `Count: ${reschedule2.body.appointment.rescheduleCount}`);

  const p3 = await createTestPatient('reschedule-conflict');
  const apt3 = await createTestAppointment(p3.body.id, 8, '11:00');
  const conflictRes = await apiRequest('POST', '/api/agenda/reschedule', {
    id: apt3.body.id,
    newDateTime: newDateTime2,
    reason: 'Teste conflito'
  }, AUTH_TOKEN);

  assert(conflictRes.status === 409, '2.11 Conflito de horario detectado', `Status: ${conflictRes.status}`);

  const p4 = await createTestPatient('reschedule-canceled');
  const apt4 = await createTestAppointment(p4.body.id, 9, '15:00');
  await apiRequest('POST', '/api/agenda/cancel', { id: apt4.body.id, reason: 'Cancelar para teste' }, AUTH_TOKEN);

  const rescheduleCanceled = await apiRequest('POST', '/api/agenda/reschedule', {
    id: apt4.body.id,
    newDateTime: futureDate(10, '09:00'),
    reason: 'Teste reagendar cancelado'
  }, AUTH_TOKEN);

  assert(rescheduleCanceled.status === 400, '2.12 Reagendar cancelado bloqueado', `Status: ${rescheduleCanceled.status}`);

  const rescheduleNoId = await apiRequest('POST', '/api/agenda/reschedule', { newDateTime: futureDate(11, '09:00') }, AUTH_TOKEN);
  assert(rescheduleNoId.status === 400, '2.13 Reagendar sem ID retorna 400');

  const rescheduleNoDate = await apiRequest('POST', '/api/agenda/reschedule', { id: aptId }, AUTH_TOKEN);
  assert(rescheduleNoDate.status === 400, '2.14 Reagendar sem newDateTime retorna 400');

  const rescheduleNoAuth = await apiRequest('POST', '/api/agenda/reschedule', { id: aptId, newDateTime: futureDate(12, '09:00') });
  assert(rescheduleNoAuth.status === 401 || rescheduleNoAuth.status === 403, '2.15 Reagendar sem token bloqueado', `Status: ${rescheduleNoAuth.status}`);
}

// ═══════════════════════════════════════════════════════
// TESTE 3: NO-SHOW
// ═══════════════════════════════════════════════════════

async function testNoShow() {
  console.log('\n📌 TESTE 3: MARCAR NO-SHOW');
  console.log('─'.repeat(50));

  const p = await createTestPatient('noshow');
  const apt = await createTestAppointment(p.body.id, 1, '08:00');

  const noShowRes = await apiRequest('POST', '/api/agenda/no-show', { id: apt.body.id }, AUTH_TOKEN);
  assert(noShowRes.status === 200, '3.1 Marcar no-show', `Status: ${noShowRes.status}`);
  assert(noShowRes.body.appointment.status === 'NO_SHOW', '3.2 Status = NO_SHOW');
  assert(noShowRes.body.appointment.noShow === true, '3.3 noShow flag = true');

  const noShowNoId = await apiRequest('POST', '/api/agenda/no-show', { id: null }, AUTH_TOKEN);
  assert(noShowNoId.status === 400, '3.4 No-show sem ID retorna 400');
}

// ═══════════════════════════════════════════════════════
// TESTE 4: NOTAS
// ═══════════════════════════════════════════════════════

async function testNotas() {
  console.log('\n📌 TESTE 4: NOTAS DA CONSULTA');
  console.log('─'.repeat(50));

  const p = await createTestPatient('notes');
  const apt = await createTestAppointment(p.body.id, 10, '10:00');

  const notesRes = await apiRequest('PATCH', `/api/agenda/${apt.body.id}/notes`, {
    notes: 'Paciente prefere horario da tarde. Alergico a dipirona.'
  }, AUTH_TOKEN);

  assert(notesRes.status === 200, '4.1 Adicionar notas', `Status: ${notesRes.status}`);
  assert(notesRes.body.success === true, '4.2 Response success=true');
  assert(notesRes.body.appointment.notes === 'Paciente prefere horario da tarde. Alergico a dipirona.', '4.3 Notas salvas corretamente');

  const updateNotesRes = await apiRequest('PATCH', `/api/agenda/${apt.body.id}/notes`, {
    notes: 'Atualizacao: paciente agora pode horario da manha tambem.'
  }, AUTH_TOKEN);

  assert(updateNotesRes.status === 200, '4.4 Atualizar notas', `Status: ${updateNotesRes.status}`);
  assert(updateNotesRes.body.appointment.notes === 'Atualizacao: paciente agora pode horario da manha tambem.', '4.5 Notas atualizadas');

  const emptyNotesRes = await apiRequest('PATCH', `/api/agenda/${apt.body.id}/notes`, { notes: '' }, AUTH_TOKEN);
  assert(emptyNotesRes.status === 200, '4.6 Notas vazias aceitas', `Status: ${emptyNotesRes.status}`);
  assert(emptyNotesRes.body.appointment.notes === '', '4.7 Notas limpas');
}

// ═══════════════════════════════════════════════════════
// TESTE 5: IA SUGESTAO DE HORARIOS
// ═══════════════════════════════════════════════════════

async function testIaSuggestSlots() {
  console.log('\n📌 TESTE 5: IA SUGESTAO DE HORARIOS');
  console.log('─'.repeat(50));

  const suggestRes = await apiRequest('POST', '/api/ai/suggest-slots', { daysAhead: 7 }, AUTH_TOKEN);
  assert(suggestRes.status === 200, '5.1 Sugestao basica', `Status: ${suggestRes.status}`);
  assert(suggestRes.body.success === true, '5.2 Response success=true');
  assert(Array.isArray(suggestRes.body.slots), '5.3 Slots e um array', `Type: ${typeof suggestRes.body.slots}`);
  assert(suggestRes.body.slots.length > 0, '5.4 Slots encontrados', `Total: ${suggestRes.body.slots.length}`);
  assert(suggestRes.body.slots.length <= 10, '5.5 Maximo 10 slots retornados', `Count: ${suggestRes.body.slots.length}`);

  if (suggestRes.body.slots.length > 0) {
    const slot = suggestRes.body.slots[0];
    assert(!!slot.dateTime, '5.6 Slot tem dateTime');
    assert(!!slot.date, '5.7 Slot tem date');
    assert(!!slot.time, '5.8 Slot tem time');
    assert(typeof slot.score === 'number', '5.9 Slot tem score numerico', `Score: ${slot.score}`);
    assert(slot.score >= 0 && slot.score <= 100, '5.10 Score entre 0-100', `Score: ${slot.score}`);
    assert(!!slot.label, '5.11 Slot tem label');
  }

  const morningRes = await apiRequest('POST', '/api/ai/suggest-slots', { daysAhead: 5, preferredPeriod: 'morning' }, AUTH_TOKEN);
  assert(morningRes.status === 200, '5.12 Sugestao morning', `Status: ${morningRes.status}`);
  if (morningRes.body.slots.length > 0) {
    const allMorning = morningRes.body.slots.every(s => {
      const hour = parseInt(s.time.split(':')[0]);
      return hour >= 8 && hour <= 11;
    });
    assert(allMorning, '5.13 Todos slots morning sao entre 08-11h');
  }

  const afternoonRes = await apiRequest('POST', '/api/ai/suggest-slots', { daysAhead: 5, preferredPeriod: 'afternoon' }, AUTH_TOKEN);
  assert(afternoonRes.status === 200, '5.14 Sugestao afternoon', `Status: ${afternoonRes.status}`);
  if (afternoonRes.body.slots.length > 0) {
    const allAfternoon = afternoonRes.body.slots.every(s => {
      const hour = parseInt(s.time.split(':')[0]);
      return hour >= 13 && hour <= 17;
    });
    assert(allAfternoon, '5.15 Todos slots afternoon sao entre 13-17h');
  }

  const p = await createTestPatient('suggest-context');
  const apt = await createTestAppointment(p.body.id, 15, '10:00');
  const contextRes = await apiRequest('POST', '/api/ai/suggest-slots', { appointmentId: apt.body.id, daysAhead: 7 }, AUTH_TOKEN);
  assert(contextRes.status === 200, '5.16 Sugestao com appointmentId', `Status: ${contextRes.status}`);
  assert(contextRes.body.context !== null, '5.17 Contexto retornado');
  if (contextRes.body.context) {
    assert(!!contextRes.body.context.patientName, '5.18 Contexto tem patientName');
    assert(!!contextRes.body.context.originalDateTime, '5.19 Contexto tem originalDateTime');
    assert(typeof contextRes.body.context.rescheduleCount === 'number', '5.20 Contexto tem rescheduleCount');
  }

  const suggestNoAuth = await apiRequest('POST', '/api/ai/suggest-slots', { daysAhead: 7 });
  assert(suggestNoAuth.status === 401 || suggestNoAuth.status === 403, '5.21 Sugestao sem token bloqueada', `Status: ${suggestNoAuth.status}`);

  const weekRes = await apiRequest('POST', '/api/ai/suggest-slots', { daysAhead: 14 }, AUTH_TOKEN);
  if (weekRes.body.slots.length > 0) {
    const noSundays = weekRes.body.slots.every(slot => {
      const date = new Date(slot.date + 'T00:00:00');
      return date.getDay() !== 0;
    });
    assert(noSundays, '5.22 Nenhum slot em domingo');
  }

  if (weekRes.body.slots.length >= 2) {
    const sorted = [...weekRes.body.slots].sort((a, b) => b.score - a.score);
    const topSlot = sorted[0];
    assert(topSlot.score >= 50, '5.23 Top slot tem score >= 50', `Score: ${topSlot.score}`);
  }
}

// ═══════════════════════════════════════════════════════
// TESTE 6: FLUXO COMPLETO DE INTEGRACAO
// ═══════════════════════════════════════════════════════

async function testFluxoCompleto() {
  console.log('\n📌 TESTE 6: FLUXO COMPLETO DE INTEGRACAO');
  console.log('─'.repeat(50));

  const patientRes = await createTestPatient('fluxo-completo');
  const pId = patientRes.body.id;
  assert(patientRes.status === 200, '6.1 Paciente criado', `ID: ${pId}`);

  const aptRes = await createTestAppointment(pId, 2, '09:00');
  const aptId = aptRes.body.id;
  assert(aptRes.status === 200, '6.2 Agendamento criado', `ID: ${aptId}`);
  assert(aptRes.body.status === 'AGUARDANDO', '6.3 Status inicial = AGUARDANDO');

  const suggestRes = await apiRequest('POST', '/api/ai/suggest-slots', { appointmentId: aptId, daysAhead: 7 }, AUTH_TOKEN);
  assert(suggestRes.status === 200, '6.4 IA sugeriu horarios', `Slots: ${suggestRes.body.slots.length}`);

  if (suggestRes.body.slots.length > 0) {
    const newSlot = suggestRes.body.slots[0];
    const rescheduleRes = await apiRequest('POST', '/api/agenda/reschedule', {
      id: aptId,
      newDateTime: newSlot.dateTime,
      reason: 'Reagendamento via fluxo completo'
    }, AUTH_TOKEN);

    assert(rescheduleRes.status === 200, '6.5 Reagendamento via IA', `Status: ${rescheduleRes.status}`);
    assert(rescheduleRes.body.appointment.dateTime === newSlot.dateTime, '6.6 DateTime = slot sugerido pela IA');
    assert(rescheduleRes.body.appointment.rescheduleCount === 1, '6.7 rescheduleCount = 1');
  }

  const notesRes = await apiRequest('PATCH', `/api/agenda/${aptId}/notes`, {
    notes: 'Fluxo completo: paciente reagendado via sugestao IA'
  }, AUTH_TOKEN);

  assert(notesRes.status === 200, '6.8 Notas adicionadas no fluxo');

  const agendaRes = await apiRequest('GET', '/api/agenda', null, AUTH_TOKEN);
  assert(agendaRes.status === 200, '6.9 Agenda carregada', `Total: ${agendaRes.body.length}`);

  const updatedApt = agendaRes.body.find(a => a.id === aptId);
  assert(!!updatedApt, '6.10 Agendamento encontrado na agenda');
  assert(updatedApt.status === 'REAGENDADO' || updatedApt.status === 'CANCELADO', '6.11 Status valido na agenda', `Status: ${updatedApt.status}`);
  assert(updatedApt.notes === 'Fluxo completo: paciente reagendado via sugestao IA', '6.12 Notas persistidas');

  const cancelRes = await apiRequest('POST', '/api/agenda/cancel', {
    id: aptId,
    reason: 'Fluxo completo finalizado'
  }, AUTH_TOKEN);

  assert(cancelRes.status === 200, '6.13 Cancelamento no fluxo');
  assert(cancelRes.body.appointment.status === 'CANCELADO', '6.14 Status = CANCELADO');
  assert(cancelRes.body.appointment.cancelReason === 'Fluxo completo finalizado', '6.15 Motivo persistido');
}

// ═══════════════════════════════════════════════════════
// TESTE 7: CONCURRENCY / DOUBLE BOOKING
// ═══════════════════════════════════════════════════════

async function testConcorrencia() {
  console.log('\n📌 TESTE 7: CONCURRENCY E DOUBLE BOOKING');
  console.log('─'.repeat(50));

  const slotDateTime = futureDate(20, '10:00');
  const p = await createTestPatient('concurrency');

  const res1 = await apiRequest('POST', '/api/agenda', {
    patientId: p.body.id,
    dateTime: slotDateTime,
    type: 'PRESENCIAL',
    status: 'AGUARDANDO'
  }, AUTH_TOKEN);

  const res2 = await apiRequest('POST', '/api/agenda', {
    patientId: p.body.id,
    dateTime: slotDateTime,
    type: 'TELE',
    status: 'AGUARDANDO'
  }, AUTH_TOKEN);

  const successCount = [res1, res2].filter(r => r.status === 200).length;
  const conflictCount = [res1, res2].filter(r => r.status === 409).length;

  assert(successCount === 1, '7.1 Exatamente 1 agendamento criado', `Success: ${successCount}`);
  assert(conflictCount === 1, '7.2 Exatamente 1 conflito detectado', `Conflict: ${conflictCount}`);

  const p3 = await createTestPatient('concurrency-reschedule');
  const apt3 = await createTestAppointment(p3.body.id, 21, '09:00');
  const apt4 = await createTestAppointment(p3.body.id, 22, '09:30');

  const targetSlot = futureDate(25, '14:00');

  const res3 = await apiRequest('POST', '/api/agenda/reschedule', {
    id: apt3.body.id,
    newDateTime: targetSlot,
    reason: 'Teste concorrencia 1'
  }, AUTH_TOKEN);

  const res4 = await apiRequest('POST', '/api/agenda/reschedule', {
    id: apt4.body.id,
    newDateTime: targetSlot,
    reason: 'Teste concorrencia 2'
  }, AUTH_TOKEN);

  const rescheduleSuccess = [res3, res4].filter(r => r.status === 200).length;
  const rescheduleConflict = [res3, res4].filter(r => r.status === 409).length;

  assert(rescheduleSuccess === 1, '7.3 Exatamente 1 reagendamento criado', `Success: ${rescheduleSuccess}`);
  assert(rescheduleConflict === 1, '7.4 Exatamente 1 conflito de reagendamento', `Conflict: ${rescheduleConflict}`);
}

// ═══════════════════════════════════════════════════════
// TESTE 8: STRESS / EDGE CASES
// ═══════════════════════════════════════════════════════

async function testStress() {
  console.log('\n📌 TESTE 8: STRESS E EDGE CASES');
  console.log('─'.repeat(50));

  const p = await createTestPatient('stress');
  let currentDateTime = futureDate(30, '08:00');

  const aptRes = await createTestAppointment(p.body.id, 30, '08:00');
  const aptId = aptRes.body.id;

  for (let i = 1; i <= 10; i++) {
    const newDate = futureDate(30 + i, `${(8 + i % 10).toString().padStart(2, '0')}:00`);
    const res = await apiRequest('POST', '/api/agenda/reschedule', {
      id: aptId,
      newDateTime: newDate,
      reason: `Stress test reagendamento #${i}`
    }, AUTH_TOKEN);

    if (i <= 3) {
      assert(res.status === 200, `8.1.${i} Reagendamento #${i}`, `Count: ${res.body?.appointment?.rescheduleCount}`);
    }
  }

  const agendaRes = await apiRequest('GET', '/api/agenda', null, AUTH_TOKEN);
  const finalApt = agendaRes.body.find(a => a.id === aptId);
  assert(finalApt.rescheduleCount === 10, '8.2 rescheduleCount = 10 apos 10 reagendamentos', `Count: ${finalApt.rescheduleCount}`);

  const p2 = await createTestPatient('stress-special');
  const apt2 = await createTestAppointment(p2.body.id, 40, '10:00');

  const specialReason = 'Motivo com caracteres especiais: áéíóú ñ ç @#$%&* "aspas" <tags>';
  const specialRes = await apiRequest('POST', '/api/agenda/reschedule', {
    id: apt2.body.id,
    newDateTime: futureDate(41, '10:00'),
    reason: specialReason
  }, AUTH_TOKEN);

  assert(specialRes.status === 200, '8.3 Reagendar com caracteres especiais');
  assert(specialRes.body.appointment.rescheduleReason === specialReason, '8.4 Caracteres especiais preservados');

  const longNotes = 'A'.repeat(1000);
  const longNotesRes = await apiRequest('PATCH', `/api/agenda/${apt2.body.id}/notes`, { notes: longNotes }, AUTH_TOKEN);
  assert(longNotesRes.status === 200, '8.5 Notas longas (1000 chars)');
  assert(longNotesRes.body.appointment.notes.length === 1000, '8.6 Notas longas persistidas', `Length: ${longNotesRes.body.appointment.notes.length}`);

  const largeDaysRes = await apiRequest('POST', '/api/ai/suggest-slots', { daysAhead: 365 }, AUTH_TOKEN);
  assert(largeDaysRes.status === 200, '8.7 Sugestao com 365 dias', `Slots: ${largeDaysRes.body.slots.length}`);
  assert(largeDaysRes.body.slots.length <= 10, '8.8 Maximo 10 slots mesmo com 365 dias', `Count: ${largeDaysRes.body.slots.length}`);

  const zeroDaysRes = await apiRequest('POST', '/api/ai/suggest-slots', { daysAhead: 0 }, AUTH_TOKEN);
  assert(zeroDaysRes.status === 200, '8.9 Sugestao com 0 dias', `Slots: ${zeroDaysRes.body.slots.length}`);

  const p3 = await createTestPatient('stress-cancel');
  const apt3 = await createTestAppointment(p3.body.id, 45, '10:00');
  const longReason = 'B'.repeat(500);
  const longCancelRes = await apiRequest('POST', '/api/agenda/cancel', { id: apt3.body.id, reason: longReason }, AUTH_TOKEN);
  assert(longCancelRes.status === 200, '8.10 Cancelar com motivo longo (500 chars)');
  assert(longCancelRes.body.appointment.cancelReason.length === 500, '8.11 Motivo longo persistido');
}

// ═══════════════════════════════════════════════════════
// TESTE 9: VALIDACAO DE DADOS PERSISTIDOS
// ═══════════════════════════════════════════════════════

async function testPersistencia() {
  console.log('\n📌 TESTE 9: VALIDACAO DE PERSISTENCIA');
  console.log('─'.repeat(50));

  const agendaRes = await apiRequest('GET', '/api/agenda', null, AUTH_TOKEN);
  assert(agendaRes.status === 200, '9.1 GET /api/agenda', `Total: ${agendaRes.body.length}`);

  if (agendaRes.body.length > 0) {
    const apt = agendaRes.body[0];
    assert('notes' in apt, '9.2 Campo notes existe');
    assert('cancelReason' in apt, '9.3 Campo cancelReason existe');
    assert('rescheduleReason' in apt, '9.4 Campo rescheduleReason existe');
    assert('rescheduleCount' in apt, '9.5 Campo rescheduleCount existe');
    assert('reminderSent' in apt, '9.6 Campo reminderSent existe');
    assert('noShow' in apt, '9.7 Campo noShow existe');
    assert('originalDateTime' in apt, '9.8 Campo originalDateTime existe');
    assert('createdAt' in apt, '9.9 Campo createdAt existe');
    assert('updatedAt' in apt, '9.10 Campo updatedAt existe');
    assert(typeof apt.rescheduleCount === 'number', '9.11 rescheduleCount e number');
    assert(typeof apt.reminderSent === 'boolean', '9.12 reminderSent e boolean');
    assert(typeof apt.noShow === 'boolean', '9.13 noShow e boolean');
  }

  const patientRes = await apiRequest('GET', `/api/patients/${testPatientId}`, null, AUTH_TOKEN);
  assert(patientRes.status === 200, '9.14 GET paciente com appointments');
  assert(Array.isArray(patientRes.body.appointments), '9.15 Patient.appointments e array');
}

// ═══════════════════════════════════════════════════════
// TESTE 10: DASHBOARD STATS
// ═══════════════════════════════════════════════════════

async function testDashboardStats() {
  console.log('\n📌 TESTE 10: DASHBOARD E STATS');
  console.log('─'.repeat(50));

  const dashRes = await apiRequest('GET', '/api/dashboard', null, AUTH_TOKEN);
  assert(dashRes.status === 200, '10.1 GET /api/dashboard', `Status: ${dashRes.status}`);
  assert(Array.isArray(dashRes.body.pacientes), '10.2 Dashboard tem pacientes');
  assert(Array.isArray(dashRes.body.leads), '10.3 Dashboard tem leads');
  assert(Array.isArray(dashRes.body.transactions), '10.4 Dashboard tem transactions');

  const statsRes = await apiRequest('GET', '/api/dashboard/stats', null, AUTH_TOKEN);
  assert(statsRes.status === 200, '10.5 GET /api/dashboard/stats');
  assert(typeof statsRes.body.stats === 'object', '10.6 Stats e objeto');

  const healthRes = await apiRequest('GET', '/api/system/health', null, AUTH_TOKEN);
  assert(healthRes.status === 200, '10.7 GET /api/system/health');
  assert(!!healthRes.body.cpu, '10.8 Health tem CPU info');
  assert(!!healthRes.body.memory, '10.9 Health tem Memory info');
  assert(healthRes.body.jarvisCore === 'ACTIVE', '10.10 JARVIS Core ativo');
}

// ═══════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════

function report() {
  const total = passed + failed;
  console.log('\n═══════════════════════════════════════════');
  console.log('📊 RELATORIO FINAL');
  console.log('═══════════════════════════════════════════');
  console.log(`  Total: ${total} testes`);
  console.log(`  ✅ Passou: ${passed}`);
  console.log(`  ❌ Falhou: ${failed}`);
  console.log(`  📈 Taxa de sucesso: ${((passed / total) * 100).toFixed(1)}%`);

  if (errors.length > 0) {
    console.log('\n⚠️  FALHAS DETALHADAS:');
    errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  }

  console.log('═══════════════════════════════════════════\n');

  return failed === 0;
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

async function main() {
  try {
    await setup();
    await testCancelamento();
    await testReagendamento();
    await testNoShow();
    await testNotas();
    await testIaSuggestSlots();
    await testFluxoCompleto();
    await testConcorrencia();
    await testStress();
    await testPersistencia();
    await testDashboardStats();

    const allPassed = report();
    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error('\n💥 ERRO FATAL:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
