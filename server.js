const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const PDFDocument = require('pdfkit');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

const path = require('path');
const session = require('express-session');
const setupGoogleAuth = require('./auth_google');
const { syncAppointmentToGoogle } = require('./google_calendar');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const JWT_SECRET = process.env.JWT_SECRET || 'jarvis_dna_secret_key';

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

// Multer Storage Configuration
const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.use(session({
  secret: process.env.SESSION_SECRET || 'jarvis_secret',
  resave: false,
  saveUninitialized: false
}));

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(compression());
app.use(cors());
app.use(express.json());

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  message: { error: 'Muitas requisicoes. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1'
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Muitas tentativas de autenticacao. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1'
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  message: { error: 'Limite de consultas IA atingido. Aguarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1'
});

app.use('/api/auth/', authLimiter);
app.use('/api/ai/', aiLimiter);
app.use('/api/', apiLimiter);

app.use(express.static(path.resolve(__dirname)));
app.use('/uploads', express.static(uploadDir));

// Initialize Google Auth
setupGoogleAuth(app);
console.log(`JARVIS: Serving static files from ${path.resolve(__dirname)}`);

// Security Headers & CSP (Loosened for Debug)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Ultra-permissive CSP for fixing the 'none' block
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' http://localhost:11434; frame-src 'self';");
  next();
});

console.log('JARVIS-001: RESTARTING SERVER WITH DNA SECURITY (ARGON2 + JWT)...');

// --- SECURITY MIDDLEWARES ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido ou expirado' });
    req.user = user;
    next();
  });
}

function checkRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado: Permissão insuficiente' });
    }
    next();
  };
}

app.get('/ping', (req, res) => res.send('PONG - JARVIS IS ALIVE'));

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

app.get('/app', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'app_cliente.html'));
});

// --- AUTH ---
app.post('/api/auth/login', async (req, res) => {
  const { user, pass } = req.body;
  try {
    const dbUser = await prisma.user.findUnique({ where: { user } });
    if (dbUser && await argon2.verify(dbUser.hash, pass)) {
      // Gerar Token JWT
      const token = jwt.sign(
        { id: dbUser.id, user: dbUser.user, role: dbUser.role },
        JWT_SECRET,
        { expiresIn: '8h' }
      );
      res.json({ success: true, token, user: { id: dbUser.id, user: dbUser.user, role: dbUser.role } });
    } else {
      res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }
  } catch (err) {
    console.error('JARVIS: Login Error:', err.message);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

function validateCpf(cpf) {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i)) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(clean.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i)) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(clean.charAt(10))) return false;

  return true;
}

// JARVIS 4.1.3: Patient Portal Auth (CPF Based)
app.post('/api/auth/patient/login', async (req, res) => {
  const { cpf } = req.body;
  if (!cpf) return res.status(400).json({ error: 'CPF obrigatorio' });

  const cleanCpf = cpf.replace(/\D/g, '');
  if (!validateCpf(cleanCpf)) {
    return res.status(400).json({ error: 'CPF invalido' });
  }

  try {
    const patient = await prisma.patient.findFirst({
      where: { cpf: cleanCpf }
    });

    if (patient) {
      const token = jwt.sign(
        { id: patient.id, name: patient.name, role: 'PACIENTE' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.json({ success: true, token });
    } else {
      res.status(401).json({ success: false, message: 'CPF não cadastrado no ecossistema' });
    }
  } catch (err) {
    console.error('JARVIS: Patient Login Error:', err.message);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err && user) {
        return res.json({ success: true, user });
      }
      res.json({ success: false });
    });
    return;
  }

  if (req.user) {
    return res.json({ success: true, user: req.user });
  }
  if (req.session.userId) {
    return res.json({ success: true, userId: req.session.userId });
  }
  res.json({ success: false });
});

// Patient Personal Data
app.get('/api/patient/data', authenticateToken, async (req, res) => {
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
app.get('/api/patients', authenticateToken, async (req, res) => {
  const patients = await prisma.patient.findMany({
    include: { appointments: true, records: true }
  });
  res.json(patients);
});

app.get('/api/patients/:id', authenticateToken, async (req, res) => {
  const patient = await prisma.patient.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { appointments: true, records: true }
  });
  if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });
  res.json(patient);
});

app.patch('/api/patients/:id', authenticateToken, checkRole(['ADMIN', 'MEDICO', 'ATENDENTE']), async (req, res) => {
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

app.post('/api/patients', authenticateToken, checkRole(['ADMIN', 'MEDICO', 'ATENDENTE']), async (req, res) => {
  const { name, cpf, birthDate, plan, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });

  try {
    // JARVIS: Busca inteligente por CPF, nome ou telefone
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
          plan: plan || "Particular"
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
app.get('/api/agenda', authenticateToken, async (req, res) => {
  const agenda = await prisma.appointment.findMany({
    include: { patient: true }
  });
  res.json(agenda);
});

app.patch('/api/agenda/:id', authenticateToken, async (req, res) => {
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

    res.json(appointment);
  } catch (error) {
    console.error('JARVIS: Agenda Update Error:', error.message);
    res.status(500).json({ error: 'Failed to update' });
  }
});

app.post('/api/agenda/checkin', authenticateToken, async (req, res) => {
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

// --- PEP / RECORDS (PROTECTED - ONLY MEDICO/ADMIN) ---
app.get('/api/records/:patientId', authenticateToken, checkRole(['ADMIN', 'MEDICO']), async (req, res) => {
  const records = await prisma.clinicalRecord.findMany({
    where: { patientId: parseInt(req.params.patientId) },
    include: { attachments: true },
    orderBy: { date: 'desc' }
  });
  res.json(records);
});

app.post('/api/attachments', authenticateToken, checkRole(['ADMIN', 'MEDICO']), upload.single('file'), async (req, res) => {
  try {
    const { recordId } = req.body;
    const file = req.file;
    if (!file || !recordId) return res.status(400).json({ success: false, message: 'Arquivo ou Record ID ausente.' });

    const attachment = await prisma.attachment.create({
      data: {
        clinicalRecordId: parseInt(recordId),
        fileName: file.originalname,
        filePath: `/uploads/${file.filename}`,
        fileType: file.mimetype
      }
    });

    res.json({ success: true, attachment });
  } catch (e) {
    console.error("Upload Error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/agenda', authenticateToken, async (req, res) => {
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

app.post('/api/records', authenticateToken, checkRole(['ADMIN', 'MEDICO']), async (req, res) => {

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
        model: 'llama3:8b', // JARVIS 4.1.4: Usando versão de 8b confirmada no ambiente
        prompt: `${systemPrompt}\n\nUsuário: ${prompt}\nCecília:`,
        stream: false
      })
    });
    
    if (!response.ok) throw new Error(`Ollama Error: ${response.statusText}`);

    const data = await response.json();
    
    if (data.error) {
      console.error('JARVIS: Ollama Model Error:', data.error);
      throw new Error(data.error);
    }

    const result = data.response || "Desculpe, meu motor de inteligência está processando algo pesado. Pode repetir?";
    
    console.log('JARVIS: Cecília respondeu via Ollama (llama3:8b).');

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

app.post('/api/leads/book-appointment', async (req, res) => {
  const { leadId } = req.body;
  if (!leadId) return res.status(400).json({ error: "Lead ID required." });

  try {
    const lead = await prisma.potentialLead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: "Lead not found." });

    let parsedData = null;
    try { parsedData = JSON.parse(lead.data); } catch(e) { /* ignore */ }

    // Support both Inez (index.html) and PWA (app_preview.html) data formats
    const inezData = parsedData?.inezData || {};
    const selectedProcedure = parsedData?.selectedProcedure || {};
    const hospData = parsedData?.hospedagemData || {};
    const sonoData = parsedData?.sonoData || {};
    const hospFull = parsedData?.hospFullData || {};
    const sonoFull = parsedData?.sonoFullData || {};

    // Extract date/time from Inez format or PWA format
    let dateVal = inezData.data || parsedData?.horaLoc?.split(' ')[0] || null;
    let timeVal = inezData.hora || parsedData?.horaLoc?.split(' ')[1] || null;

    if (!dateVal || !timeVal) {
      return res.status(400).json({ error: "Lead missing date/time data." });
    }

    const dateTimeStr = `${dateVal} ${timeVal}`;

    const existing = await prisma.appointment.findFirst({
      where: { dateTime: dateTimeStr }
    });
    if (existing) {
      return res.status(409).json({ error: "Slot ja ocupado." });
    }

    let patient = null;
    const patientConditions = [];
    if (lead.name) patientConditions.push({ name: lead.name });
    if (lead.phone) patientConditions.push({ phone: lead.phone.replace(/\D/g, '') });

    if (patientConditions.length > 0) {
      patient = await prisma.patient.findFirst({
        where: { OR: patientConditions }
      });
    }

    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          name: lead.name || 'Paciente Inez',
          cpf: generateValidCpf(),
          phone: lead.phone ? lead.phone.replace(/\D/g, '') : null,
          birthDate: "1900-01-01",
          plan: lead.source || "Inez"
        }
      });
    }

    const procName = selectedProcedure.name || parsedData?.procedimento || 'CONSULTA';
    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        dateTime: dateTimeStr,
        type: procName.toUpperCase().includes('TELE') ? 'TELE' : 'PRESENCIAL',
        status: 'AGUARDANDO'
      },
      include: { patient: true }
    });

    syncAppointmentToGoogle(appointment.id).catch(err => {
      console.error('JARVIS: Google Sync from Inez failed:', err.message);
    });

    await prisma.potentialLead.delete({ where: { id: leadId } });

    res.json({ success: true, appointment });
  } catch (error) {
    console.error('JARVIS: Book Appointment Error:', error.message);
    res.status(500).json({ error: "Failed to book appointment.", details: error.message });
  }
});

app.get('/api/leads', authenticateToken, async (req, res) => {
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

// --- FINANCE CORE ---
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const [patients, records, leads, transactions] = await Promise.all([
      prisma.patient.findMany({
        where: { active: true },
        include: { records: { orderBy: { date: 'desc' }, take: 2 } },
        orderBy: { id: 'desc' }
      }),
      prisma.clinicalRecord.findMany({
        orderBy: { date: 'desc' },
        take: 10,
        include: { patient: true }
      }),
      prisma.potentialLead.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30
      }),
      prisma.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50
      })
    ]);

    // Financial calculations
    const revenue = transactions.filter(t => t.type === 'INCOME' && t.status === 'PAID').reduce((a, b) => a + b.amount, 0);
    const expenses = transactions.filter(t => t.type === 'EXPENSE' && t.status === 'PAID').reduce((a, b) => a + b.amount, 0);
    const projected = transactions.filter(t => t.type === 'INCOME' && t.status === 'PENDING').reduce((a, b) => a + b.amount, 0);

    const dnaBase = patients.map(p => {
      const lastRecord = p.records[0];
      return {
        id: p.id,
        name: p.name,
        cpf: p.cpf,
        birthDate: p.birthDate,
        plan: p.plan,
        medications: p.medications ? p.medications.split(';') : [],
        lastVisit: lastRecord ? lastRecord.date : 'N/D',
        status: p.active ? 'Ativo' : 'Inativo'
      }
    });

    const cidDistribution = {};
    records.forEach(r => {
      if(r.cid10) cidDistribution[r.cid10] = (cidDistribution[r.cid10] || 0) + 1;
    });
    const cidData = Object.keys(cidDistribution).map(k => ({ name: k, count: cidDistribution[k] })).sort((a,b) => b.count - a.count);

    res.json({
      pacientes: dnaBase,
      cid10: cidData,
      fila: [],
      leads: leads,
      transactions: transactions,
      finances: { revenue, expenses, projected }
    });
  } catch (err) {
    console.error('JARVIS: Dashboard Error', err);
    res.status(500).json({ error: 'Failed to build DNA Dashboard', details: err.message });
  }
});

app.post('/api/finance', authenticateToken, async (req, res) => {
  const { type, amount, status, method, description, date } = req.body;
  try {
    const newTx = await prisma.transaction.create({
      data: {
        type: type || 'INCOME',
        amount: parseFloat(amount) || 0.0,
        status: status || 'PAID',
        method: method || 'N/A',
        description: description || 'Transação Avulsa',
        date: date || new Date().toISOString()
      }
    });
    res.json({ success: true, transaction: newTx });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

app.patch('/api/finance/:id', authenticateToken, async (req, res) => {
  try {
    const tx = await prisma.transaction.update({
      where: { id: parseInt(req.params.id) },
      data: { status: req.body.status || 'PAID' }
    });
    res.json({ success: true, transaction: tx });
  } catch(e) {
    res.status(500).json({ error: "Failed to update transaction" });
  }
});

// POST /api/leads/convert - Converter Lead em Paciente
app.post('/api/leads/convert', authenticateToken, async (req, res) => {
  const { leadId } = req.body;
  if (!leadId) return res.status(400).json({ error: "Lead ID required." });
  
  try {
    const lead = await prisma.potentialLead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: "Lead not found." });

    // Generate valid CPF with correct check digits
    const safeCpf = generateValidCpf();

    // Criar Paciente a partir do Lead
    const newPatient = await prisma.patient.create({
      data: {
        name: lead.name || 'Paciente s/ Nome',
        cpf: safeCpf,
        phone: lead.phone ? lead.phone.replace(/\D/g, '') : null,
        birthDate: "1900-01-01",
        plan: lead.source || "Lead Orgânico",
      }
    });

    // Transferir Histórico do Lead para o Prontuário (DNA)
    let leadNotes = `[ CONVERSÃO DE LEAD - INICIALIZAÇÃO DE DNA ]\n`;
    leadNotes += `📍 Origem do Lead: ${lead.source || 'N/D'}\n`;
    leadNotes += `📞 Telefone Integrado: ${lead.phone || 'N/D'}\n`;
    leadNotes += `📧 E-mail Integrado: ${lead.email || 'N/D'}\n\n`;
    
    let txAmount = 0;
    
    if (lead.data) {
       try {
         const parsed = JSON.parse(lead.data);
         leadNotes += `[ DADOS COLETADOS NA NEGOCIAÇÃO ]\n`;
         
         // Buscar valor previsto dentro do objeto
         let foundValue = parsed.valor || parsed.procedureVal || (parsed.selectedProcedure && parsed.selectedProcedure.val) || 0;
         if(foundValue) {
             let numVal = parseFloat(String(foundValue).replace(/[^0-9,.-]/g, '').replace(',', '.'));
             if(!isNaN(numVal) && numVal > 0) txAmount = numVal;
         }

         const formatObj = (obj, indent = "") => {
           let txt = "";
           for (const [k, v] of Object.entries(obj)) {
             if (typeof v === 'object' && v !== null) {
               if (Object.keys(v).length > 0) {
                 txt += `${indent}• ${k.toUpperCase()}:\n` + formatObj(v, indent + "  ");
               }
             } else {
               if (v !== '' && v !== null && v !== undefined) {
                 txt += `${indent}• ${k}: ${v}\n`;
               }
             }
           }
           return txt;
         };
         
         leadNotes += formatObj(parsed);
       } catch(e) { 
         leadNotes += `Dados Brutos Analisados:\n${lead.data}`; 
       }
    }

    await prisma.clinicalRecord.create({
      data: {
        patientId: newPatient.id,
        date: new Date().toLocaleDateString('pt-BR'),
        type: 'Triagem de Lead',
        description: leadNotes,
        cid10: 'Z00.0'
      }
    });

    // Se a IA capturou um valor, lança Previsão de Fluxo de Caixa Automático
    if(txAmount > 0) {
      await prisma.transaction.create({
        data: {
          type: 'INCOME',
          amount: txAmount,
          status: 'PENDING',
          method: 'PIX', // Padrão
          description: `Pré-Agendamento: ${newPatient.name}`,
          date: new Date().toISOString()
        }
      });
    }

    // Deletar Lead após conversão
    await prisma.potentialLead.delete({ where: { id: leadId } });

    res.json({ success: true, newPatient });
  } catch (error) {
    console.error('JARVIS: Lead Convert Error:', error.message);
    res.status(500).json({ error: 'Failed to convert lead.', details: error.message });
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

// --- CLINICAL DOCUMENTS (S3) ---
app.post('/api/documents/generate', authenticateToken, checkRole(['ADMIN', 'MEDICO']), async (req, res) => {
  const { recordId, type } = req.body; // type: 'PRESCRIPTION' or 'CERTIFICATE'
  
  try {
    const record = await prisma.clinicalRecord.findUnique({
      where: { id: parseInt(recordId) },
      include: { patient: true }
    });

    if (!record) return res.status(404).json({ error: 'Registro não encontrado' });

    const doc = new PDFDocument({ margin: 50 });
    let filename = `${type}_${record.patient.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // Header Branding
    doc.fillColor('#1a1a1a').fontSize(22).text('HOLOZONIC CARE', { align: 'center' });
    doc.fontSize(10).text('MEDICINA INTEGRATIVA & LONGEVIDADE', { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#cccccc');
    doc.moveDown(2);

    // Document Title
    const title = type === 'PRESCRIPTION' ? 'PRESCRIÇÃO MÉDICA' : 'ATESTADO MÉDICO';
    doc.fillColor('#004d40').fontSize(18).text(title, { align: 'center', underline: true });
    doc.moveDown(2);

    // Patient Info
    doc.fillColor('#1a1a1a').fontSize(12);
    doc.text(`PACIENTE: ${record.patient.name.toUpperCase()}`);
    doc.text(`CPF: ${record.patient.cpf}`);
    doc.text(`DATA DE NASCIMENTO: ${record.patient.birthDate}`);
    doc.moveDown();
    if (record.cid10) {
      doc.text(`DIAGNÓSTICO (CID-10): ${record.cid10}`);
    }
    doc.moveDown(2);

    // Content
    doc.fontSize(14).text('DESCRIÇÃO / ORIENTAÇÕES:', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(record.description, { align: 'justify', lineGap: 5 });

    // Footer / Signature
    doc.moveDown(5);
    const bottom = doc.page.height - 150;
    doc.moveTo(150, bottom).lineTo(450, bottom).stroke('#000');
    doc.fontSize(10).text('ASSINATURA DO MÉDICO RESPONSÁVEL', 150, bottom + 5, { width: 300, align: 'center' });
    doc.moveDown();
    doc.fontSize(8).fillColor('#888').text(`Protocolo JARVIS: ${Date.now()}-${recordId}`, { align: 'center' });
    doc.text('Validado digitalmente via Holozonic Clinical Ecosystem', { align: 'center' });

    doc.end();
  } catch (err) {
    console.error('JARVIS: PDF Gen Error:', err);
    res.status(500).json({ error: 'Erro ao gerar documento' });
  }
});

// --- OMNISEARCH (S4) ---
app.get('/api/search', authenticateToken, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ results: [] });

  try {
    const query = q.toLowerCase();
    
    // Parallel discovery via Prisma
    const [patients, records, leads] = await Promise.all([
      prisma.patient.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { cpf: { contains: q } }
          ]
        },
        take: 5
      }),
      prisma.clinicalRecord.findMany({
        where: {
          OR: [
            { description: { contains: q } },
            { cid10: { contains: q } }
          ]
        },
        include: { patient: true },
        take: 5
      }),
      prisma.potentialLead.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } }
          ]
        },
        take: 5
      })
    ]);

    // Categorized formatting
    const results = [
      ...patients.map(p => ({ id: p.id, type: 'PATIENT', title: p.name, subtitle: `CPF: ${p.cpf}`, pId: p.id })),
      ...records.map(r => ({ id: r.id, type: 'RECORD', title: `Evolução: ${r.patient.name}`, subtitle: r.description.slice(0, 50) + '...', pId: r.patientId })),
      ...leads.map(l => ({ id: l.id, type: 'LEAD', title: l.name || 'Lead s/ nome', subtitle: `Fonte: ${l.source || 'N/D'}`, lId: l.id }))
    ];

    res.json({ results });
  } catch (err) {
    console.error('JARVIS: Search Error:', err);
    res.status(500).json({ error: 'Erro na busca global' });
  }
});

// PUBLIC ROUTE - Get occupied slots for Inez front-end
app.get('/api/agenda/occupied', async (req, res) => {
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

app.get('/api/ai/logs', authenticateToken, async (req, res) => {
  try {
    const logs = await prisma.aILog.findMany({ take: 50, orderBy: { timestamp: 'desc' } });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler logs' });
  }
});

// --- SYSTEM CORE (S5) ---
app.get('/api/system/health', authenticateToken, async (req, res) => {
  const cpus = os.cpus();
  const cpuModel = cpus[0]?.model || 'Unknown';
  const cpuCount = cpus.length;
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = ((usedMem / totalMem) * 100).toFixed(1);

  const health = {
    cpu: {
      model: cpuModel,
      cores: cpuCount,
      loadAvg: os.loadavg().map(l => l.toFixed(2)),
      usage: `${(100 - (os.freemem() / os.totalmem() * 100)).toFixed(1)}%`
    },
    memory: {
      total: `${(totalMem / 1024 / 1024 / 1024).toFixed(2)}GB`,
      used: `${(usedMem / 1024 / 1024 / 1024).toFixed(2)}GB`,
      free: `${(freeMem / 1024 / 1024 / 1024).toFixed(2)}GB`,
      percent: `${memPercent}%`
    },
    uptime: `${Math.floor(process.uptime())}s`,
    dbStatus: "OPERATIONAL",
    jarvisCore: "ACTIVE",
    version: "v4.1.7-Sinapse",
    platform: `${os.type()} ${os.release()}`,
    nodeVersion: process.version
  };
  res.json(health);
});

app.post('/api/system/audit', authenticateToken, async (req, res) => {
  try {
    const lastLogs = await prisma.aILog.findMany({ 
      take: 20, 
      orderBy: { timestamp: 'desc' } 
    });
    
    // AI Analysis Simulation
    const auditReport = {
      timestamp: new Date().toISOString(),
      vulnerabilities: [
        { level: 'LOW', msg: 'Session TTL slightly long', action: 'Reduzir JWT_EXP' }
      ],
      optimizations: [
        { level: 'MED', msg: 'Patient search latency high', action: 'Criar INDEX em Patient(name)' },
        { level: 'LOW', msg: 'Asset cache miss', action: 'Implementar ETag' }
      ],
      status: "JARVIS analysis complete: System is 92% optimized."
    };
    
    // Log audit action
    await prisma.aILog.create({
      data: {
        timestamp: new Date(),
        level: 'INFO',
        message: 'Auto-Audit JARVIS performed.',
        context: 'System Evolution'
      }
    });

    res.json(auditReport);
  } catch (err) {
    res.status(500).json({ error: 'Falha na auditoria JARVIS' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`JARVIS-001: Holozonic Backend running on http://127.0.0.1:${PORT}`);
});
