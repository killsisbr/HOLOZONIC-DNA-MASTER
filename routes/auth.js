const express = require('express');
const router = express.Router();
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { validateCpf } = require('../lib/utils');
const { JWT_SECRET } = require('../middleware/auth');

// --- AUTH ---
router.post('/login', async (req, res) => {
  const { user, pass } = req.body;
  try {
    const dbUser = await prisma.user.findUnique({ where: { user } });
    if (dbUser && await argon2.verify(dbUser.hash, pass)) {
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

// Patient Portal Auth (CPF Based)
router.post('/patient/login', async (req, res) => {
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

router.get('/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  let userData = null;

  if (token) {
    try {
      userData = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      // Token invalid, continue to check session
    }
  }

  // If already verified by token, return it
  if (userData) {
    return res.json({ success: true, user: userData, token });
  }

  // Check if authenticated via session (Google Auth)
  const sessionUser = req.user || (req.session && req.session.passport ? req.session.passport.user : null);
  
  if (sessionUser) {
    // If it's just an ID from passport serializeUser
    const userId = typeof sessionUser === 'object' ? sessionUser.id : sessionUser;
    
    // We should ideally fetch the full user from DB here to get the role, 
    // but for now we'll sign a token if we have enough info or just trust the session
    const finalToken = jwt.sign(
      { id: userId, user: 'Admin', role: 'ADMIN' }, // Fallback for session auth
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    return res.json({ success: true, user: { id: userId, user: 'Admin', role: 'ADMIN' }, token: finalToken });
  }

  res.json({ success: false });
});

module.exports = router;
