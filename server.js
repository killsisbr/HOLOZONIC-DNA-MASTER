const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = 3001;

const path = require('path');
const session = require('express-session');
const setupGoogleAuth = require('./auth_google');
const { syncAppointmentToGoogle } = require('./google_calendar');

app.use(session({
  secret: process.env.SESSION_SECRET || 'jarvis_secret',
  resave: false,
  saveUninitialized: false
}));

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname)));

// Initialize Google Auth
setupGoogleAuth(app);
console.log(`JARVIS: Serving static files from ${path.resolve(__dirname)}`);

// Security Headers & CSP (Loosened for Debug)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Ultra-permissive CSP for fixing the 'none' block
  res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src *; img-src * data:; font-src *; style-src * 'unsafe-inline';");
  next();
});

console.log('JARVIS-001: RESTARTING SERVER...');

app.get('/ping', (req, res) => res.send('PONG - JARVIS IS ALIVE'));

app.get('/api/agenda/occupied', async (req, res) => {
  const appointments = await prisma.appointment.findMany({
    select: { dateTime: true }
  });
  console.log('JARVIS: Occupied slots requested:', appointments.length);
  res.json(appointments.map(a => a.dateTime));
});

app.get('/debug-path', (req, res) => {
  res.json({
    dirname: __dirname,
    resolved: path.resolve(__dirname, 'index.html'),
    cwd: process.cwd()
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'dashboard_v2.html'));
});

// --- AUTH ---
app.post('/api/auth/login', async (req, res) => {
  const { user, pass } = req.body;
  const dbUser = await prisma.user.findUnique({ where: { user } });
  if (dbUser && dbUser.hash === pass) { // Simple check for now
    req.session.userId = dbUser.id;
    res.json({ success: true, user: dbUser });
  } else {
    res.status(401).json({ success: false, message: 'Credenciais inválidas' });
  }
});

app.get('/api/auth/me', (req, res) => {
  if (req.user) { // From Passport
    return res.json({ success: true, user: req.user });
  }
  if (req.session.userId) { // From legacy login
    // In a real app we'd fetch from DB here
    return res.json({ success: true, userId: req.session.userId });
  }
  res.json({ success: false });
});

// --- PATIENTS ---
app.get('/api/patients', async (req, res) => {
  const patients = await prisma.patient.findMany({
    include: { appointments: true, records: true }
  });
  res.json(patients);
});

app.post('/api/patients', async (req, res) => {
  const { name, cpf, birthDate, plan, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });

  try {
    // JARVIS: Busca inteligente (Bypass phone field due to Prisma Sync Issue)
    let condition = [];
    if (cpf && typeof cpf === 'string' && !cpf.startsWith('LEAD-')) {
      condition.push({ cpf });
    }
    // Buscamos apenas por nome por enquanto para evitar o erro do Prisma
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
          birthDate: birthDate || "1900-01-01",
          plan: plan || "Particular"
          // phone: phone // REMOVIDO TEMPORARIAMENTE
        }
      });
    }
    res.json(patient);
  } catch (e) {
    console.error('JARVIS: Patient Create Error:', e.message);
    res.status(500).json({ error: 'Erro no servidor ao buscar/criar paciente.' });
  }
});

// --- AGENDA & FILA ---
app.get('/api/agenda/occupied', async (req, res) => {
  const appointments = await prisma.appointment.findMany({
    select: { dateTime: true }
  });
  res.json(appointments.map(a => a.dateTime));
});

app.get('/api/agenda', async (req, res) => {
  const agenda = await prisma.appointment.findMany({
    include: { patient: true }
  });
  res.json(agenda);
});

app.patch('/api/agenda/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const appointment = await prisma.appointment.update({
      where: { id: parseInt(id) },
      data: { status }
    });
    
    // Async Sync to Google
    syncAppointmentToGoogle(appointment.id).catch(console.error);
    
    res.json(appointment);
  } catch (e) {
    res.status(400).json({ error: 'Erro ao atualizar agendamento.' });
  }
});

app.post('/api/agenda/checkin', async (req, res) => {
  const { patientId, type } = req.body;
  const now = new Date();
  const entryTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      type,
      dateTime: entryTime, // Using this for queue entry time
      status: 'AGUARDANDO'
    }
  });

  // Async Sync to Google
  syncAppointmentToGoogle(appointment.id).catch(console.error);

  res.json(appointment);
});

// --- PEP / RECORDS ---
app.get('/api/records/:patientId', async (req, res) => {
  const records = await prisma.clinicalRecord.findMany({
    where: { patientId: parseInt(req.params.patientId) },
    orderBy: { date: 'desc' }
  });
  res.json(records);
});


app.post('/api/agenda', async (req, res) => {
  const { patientId, dateTime, type, status } = req.body;
  
  try {
    // Safety Lock: Check if already booked
    const existing = await prisma.appointment.findFirst({
      where: { dateTime }
    });

    if (existing) {
      return res.status(409).json({ error: 'Slot ocupado. Por favor, escolha outro horário.' });
    }

    const pId = parseInt(patientId);
    if (isNaN(pId)) {
       return res.status(400).json({ error: 'ID de paciente inválido.' });
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId: pId,
        dateTime,
        type: type || 'CONSULTA',
        status: status || 'AGUARDANDO'
      },
      include: { patient: true }
    });

    // Sincronismo Automático Google Calendar
    syncAppointmentToGoogle(appointment.id).catch(err => {
      console.error('JARVIS: Google Initial Sync failed:', err.message);
    });

    res.json(appointment);
  } catch (error) {
    console.error('JARVIS: Agenda Create Error:', error.message);
    res.status(500).json({ error: 'Failed' });
  }
});

app.patch('/api/agenda/:id', async (req, res) => {
  const { id } = req.params;
  const { status, type, dateTime } = req.body;
  try {
    const appointment = await prisma.appointment.update({
      where: { id: parseInt(id) },
      data: { status, type, dateTime },
      include: { patient: true }
    });

    // Re-sincronizar se houver mudança relevante
    syncAppointmentToGoogle(appointment.id).catch(err => {
      console.error('JARVIS: Google Sync Update failed:', err.message);
    });

    res.json(appointment);
  } catch (error) {
    console.error('JARVIS: Agenda Update Error:', error.message);
    res.status(500).json({ error: 'Failed to update' });
  }
});

app.post('/api/records', async (req, res) => {

  const { patientId, type, description, cid10 } = req.body;
  const record = await prisma.clinicalRecord.create({
    data: {
      patientId,
      type,
      description,
      cid10,
      date: new Date().toLocaleDateString('pt-BR')
    }
  });
  res.json(record);
});
// --- AI SWARM (OLLAMA INTEGRATION) ---
app.post('/api/ai/ask', async (req, res) => {
  const { prompt, context } = req.body;
  
  const systemPrompt = `Você é a Cecília, o núcleo de Inteligência Clínica (DNA JARVIS 4.1) da Holozonic.
  Seu objetivo: Suporte técnico de alta precisão para a equipe médica e acolhimento estratégico para pacientes.
  
  Pilares Holozonic:
  1. Longevidade Bioenergética: Protocolos avançados de detox e regeneração.
  2. Medicina do Sono: Especialistas em distúrbios do sono e ritos de descanso.
  3. Hospedagem Integrativa (Lages/SC): Nossa unidade física premium.
  
  Instruções de Resposta:
  - Tom: Profissional, futurista (JARVIS style), mas empático.
  - Se perguntada sobre dados de pacientes, informe que o Dr. Jarvis (você) processa os dados de forma segura via RAG local.
  - Use termos como 'Matriz de Dados', 'Protocolo' e 'Otimização' de forma sutil.
  - Prioridade: Agendamentos orientar para Inêz. Casos clínicos sugerir consulta.
  - Língua: Português do Brasil. Seja densa e técnica.`;

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        model: 'llama3', // Modelo padrão sugerido para o JARVIS 4.1
        prompt: `${systemPrompt}\n\nUsuário: ${prompt}\nCecília:`,
        stream: false
      })
    });
    
    const data = await response.json();
    const result = data.response || "Desculpe, meu motor de inteligência está processando algo pesado. Pode repetir?";

    // Auto-log the interaction
    await prisma.aILog.create({
      data: { input: prompt, distilledPattern: `CECILIA_REPLY: ${result}`, confidence: 0.98 }
    });
    
    res.json({ response: result });
  } catch (error) {
    console.warn('JARVIS: Ollama Offline. Tentando Fallback Gemini...', error.message);
    
    // JARVIS 4.1 - Gemini Fallback Strategy
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const fetch = (await import('node-fetch')).default;
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\nUsuário: ${prompt}\nCecília:` }] }]
          })
        });
        const geminiData = await geminiRes.json();
        const geminiResult = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Estou em manutenção profunda.";
        
        return res.json({ response: geminiResult + " (Modo Fallback Gemini)" });
      } catch (geminiErr) {
        console.error('JARVIS: Gemini Fallback Error:', geminiErr.message);
      }
    }

    res.json({ response: "Estou em modo de manutenção offline. Verifique se o Ollama está rodando ou configure GEMINI_API_KEY no .env." });
  }
});

// --- LEAD SYNC (FUNNEL PERSISTENCE) ---
app.post('/api/leads/sync', async (req, res) => {
  const { name, phone, email, source, step, data } = req.body;
  
  if (!phone && !email) {
    return res.status(400).json({ error: "Phone or Email required for syncing." });
  }

  try {
    // Try to find an existing lead by phone or email
    let lead = await prisma.potentialLead.findFirst({
      where: {
        OR: [
          { phone: phone || undefined },
          { email: email || undefined }
        ]
      }
    });

    if (lead) {
      lead = await prisma.potentialLead.update({
        where: { id: lead.id },
        data: {
          name: name || lead.name,
          phone: phone || lead.phone,
          email: email || lead.email,
          source: source || lead.source,
          step: step || lead.step,
          data: JSON.stringify(data)
        }
      });
    } else {
      lead = await prisma.potentialLead.create({
        data: {
          name,
          phone,
          email,
          source,
          step,
          data: JSON.stringify(data)
        }
      });
    }

    res.json({ success: true, leadId: lead.id });
  } catch (error) {
    console.error('JARVIS: Lead Sync Error:', error.message);
    res.status(500).json({ error: "Failed to sync lead." });
  }
});

app.get('/api/leads', async (req, res) => {
  try {
    const leads = await prisma.potentialLead.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(leads);
  } catch (error) {
    console.error('JARVIS: Fetch Leads Error:', error);
    res.status(500).json({ error: 'Failed to fetch leads.', details: error.message });
  }
});

// POST /api/leads/convert - Converter Lead em Paciente
app.post('/api/leads/convert', async (req, res) => {
  const { leadId } = req.body;
  if (!leadId) return res.status(400).json({ error: "Lead ID required." });

  try {
    const lead = await prisma.potentialLead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: "Lead not found." });

    // Criar Paciente a partir do Lead
    const patient = await prisma.patient.create({
      data: {
        name: lead.name || 'Paciente s/ Nome',
        cpf: lead.phone || `LEAD-${leadId}`, // Fallback CPF
        email: lead.email,
        phone: lead.phone,
        birthDate: "1900-01-01", // Default
        plan: "Particular"
      }
    });

    // Deletar Lead após conversão
    await prisma.potentialLead.delete({ where: { id: leadId } });

    res.json({ success: true, patient });
  } catch (error) {
    console.error('JARVIS: Lead Convert Error:', error.message);
    res.status(500).json({ error: 'Failed to convert lead.' });
  }
});

app.post('/api/ai/distill', async (req, res) => {
  const { pattern, confidence } = req.body;
  const log = await prisma.aILog.create({
    data: { input: 'MANUAL_DISTILLATION', distilledPattern: pattern, confidence }
  });
  res.json(log);
});

// --- AI & LOGS ---
app.post('/api/ai/logs', async (req, res) => {
  const { input, distilledPattern, confidence } = req.body;
  const log = await prisma.aILog.create({
    data: { input, distilledPattern, confidence }
  });
  res.json(log);
});

app.get('/api/ai/logs', async (req, res) => {
  const logs = await prisma.aILog.findMany({ take: 50, orderBy: { timestamp: 'desc' } });
  res.json(logs);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`JARVIS-001: Holozonic Backend running on http://127.0.0.1:${PORT}`);
});
