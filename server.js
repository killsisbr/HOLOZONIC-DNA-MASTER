const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

// --- LIBS & MIDDLEWARES ---
const prisma = require('./lib/prisma');
const { setIO } = require('./lib/socket');
const { setWhatsAppHandler } = require('./lib/whatsapp');
const { authenticateToken } = require('./middleware/auth');
const setupGoogleAuth = require('./auth_google');
const { setupWebRTCSignaling } = require('./system/webrtc-signaling');
const { HolozonicWhatsApp } = require('./system/whatsapp-integration.js');

// --- ROUTES ---
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const agendaRoutes = require('./routes/agenda');
const recordRoutes = require('./routes/records');
const aiRoutes = require('./routes/ai');
const systemRoutes = require('./routes/system');
const leadRoutes = require('./routes/leads');
const financeRoutes = require('./routes/finance');
const whatsappRoutes = require('./routes/whatsapp');
const teleRoutes = require('./routes/teleconsulta');
const preRoutes = require('./routes/pre-atendimento');
const reportRoutes = require('./routes/reports');
const searchRoutes = require('./routes/search');
const monitoringRoutes = require('./routes/monitoring');
const pushHandler = require('./lib/push');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

// Global Services Initialization
setIO(io);
setupWebRTCSignaling(io);

let waHandler = null;
try {
  waHandler = new HolozonicWhatsApp();
  waHandler.setSocketIO(io);
  setWhatsAppHandler(waHandler);
} catch(e) { console.log('[WA] WhatsApp não disponível:', e.message); }

const PORT = process.env.PORT || 3001;

// --- GLOBAL MIDDLEWARES ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'jarvis_secret',
  resave: false,
  saveUninitialized: false
}));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json());

// --- SECURITY HEADERS & CSP ---
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://randomuser.me https://ui-avatars.com https://i.imgur.com https://*.supabase.co",
    "connect-src 'self' http://localhost:11434",
    "frame-src 'self' https://calendar.google.com",
    "media-src 'self' blob:"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);
  next();
});

// LOG INTERCEPTION (Retained in main for now or move to lib/logger)
const logBuffer = [];
const MAX_LOG_BUFFER = 200;
const origConsoleLog = console.log;
const origConsoleError = console.error;
const origConsoleWarn = console.warn;

function interceptLogs() {
  console.log = (...args) => {
    const msg = `[LOG] ${new Date().toISOString().slice(11,23)} ${args.join(' ')}`;
    logBuffer.push(msg);
    if(logBuffer.length > MAX_LOG_BUFFER) logBuffer.shift();
    io.emit('system:log', { level: 'info', message: msg });
    origConsoleLog.apply(console, args);
  };
  console.error = (...args) => {
    const msg = `[ERR] ${new Date().toISOString().slice(11,23)} ${args.join(' ')}`;
    logBuffer.push(msg);
    if(logBuffer.length > MAX_LOG_BUFFER) logBuffer.shift();
    io.emit('system:log', { level: 'error', message: msg });
    origConsoleError.apply(console, args);
  };
  console.warn = (...args) => {
    const msg = `[WRN] ${new Date().toISOString().slice(11,23)} ${args.join(' ')}`;
    logBuffer.push(msg);
    if(logBuffer.length > MAX_LOG_BUFFER) logBuffer.shift();
    io.emit('system:log', { level: 'warn', message: msg });
    origConsoleWarn.apply(console, args);
  };
}
interceptLogs();

// --- MOUNT ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/patient', patientRoutes); // Compatibility
app.use('/api/agenda', agendaRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/attachments', recordRoutes); // Mounted specifically if needed
app.use('/api/ai', aiRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/teleconsulta', teleRoutes);
app.use('/api/pre-atendimento', preRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/documents', recordRoutes); // PDF Gen

// --- PUSH NOTIFICATIONS ---
app.post('/api/push/subscribe', (req, res) => {
  const { subscription, userId } = req.body;
  if (!subscription || !userId) {
    return res.status(400).json({ error: 'subscription e userId obrigatorios' });
  }
  
  pushHandler.addSubscription(userId, subscription);
  res.json({ success: true });
});

app.delete('/api/push/unsubscribe', (req, res) => {
  const { subscription, userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId obrigatorio' });
  }
  
  if (subscription?.endpoint) {
    pushHandler.removeSubscription(userId, subscription.endpoint);
  }
  
  res.json({ success: true });
});

app.post('/api/push/send', authenticateToken, async (req, res) => {
  const { userId, title, body, url } = req.body;
  if (!userId || !title) {
    return res.status(400).json({ error: 'userId e title obrigatorios' });
  }

  const result = await pushHandler.sendPushNotification(userId, title, body, url || '/');
  res.json({ success: true, ...result });
});

app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: pushHandler.getVapidPublicKey()?.replace(/=/g, '') || '' });
});

// Basic health check and system info for routes not in modules
app.get('/ping', (req, res) => res.send('PONG - JARVIS IS ALIVE'));
app.get('/api/system/logs', authenticateToken, (req, res) => res.json({ logs: [...logBuffer] }));

// --- STATIC ASSETS & HTML ---
app.use(express.static(path.resolve(__dirname)));
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));

setupGoogleAuth(app);

app.get('/', (req, res) => res.sendFile(path.resolve(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.resolve(__dirname, 'dashboard_v2.html')));
app.get('/monitoramento', (req, res) => res.sendFile(path.resolve(__dirname, 'monitoramento.html')));
app.get('/app', (req, res) => res.sendFile(path.resolve(__dirname, 'app_cliente.html')));

// --- START SERVER ---
server.listen(PORT, '0.0.0.0', () => {
  console.log(`JARVIS-001: Holozonic Backend running on http://127.0.0.1:${PORT}`);
  console.log(`[WS] Socket.IO enabled — Real-time active`);
  if (waHandler) {
    waHandler.start().catch(err => console.log('[WA] WhatsApp auto-start failed:', err.message));
  }
});
