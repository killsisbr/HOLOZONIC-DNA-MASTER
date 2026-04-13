const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { askWithContext, suggestAvailableSlots, analyzePreAtendimentoPattern, buildPreAtendimentoFromChat, autoCreatePreAtendimento, generatePreAtendimentoPrompt } = require('../system/ai-assistant');

// --- AI SWARM WITH CONTEXT (OLLAMA + RAG) ---
router.post('/ask', async (req, res) => {
  const { prompt, context } = req.body;
  const { context: aiContext, action } = await askWithContext(prompt);
  
  const systemPrompt = `Você é a Cecília, o núcleo de Inteligência Clínica (DNA JARVIS 4.1) da Holozonic.
Seu objetivo: Suporte técnico de alta precisão para a equipe médica e acolhimento estratégico para pacientes.
Pilares Holozonic:
1. Longevidade Bioenergética: Protocolos avançados de detox e regeneração.
2. Medicina do Sono: Especialistas em distúrbios do sono e ritos de descanso.
3. Hospedagem Integrativa (Lages/SC): Nossa unidade física premium.
${aiContext}`;

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        model: 'llama3:8b',
        prompt: `${systemPrompt}\n\nUsuário: ${prompt}\nCecília:`,
        stream: false
      })
    });
    
    if (!response.ok) throw new Error(`Ollama Error: ${response.statusText}`);
    const data = await response.json();
    
    let result = data.response || "Desculpe, meu motor de inteligência está processando algo pesado.";
    if (action && action.type === 'report') {
      result = action.content + '\n\n--- ANÁLISE IA ---\n' + result;
    }

    await prisma.aILog.create({
      data: { input: prompt, distilledPattern: `CECILIA_CONTEXTUAL: ${result.slice(0, 200)}`, confidence: 0.98 }
    });
    
    res.json({ response: result, context: aiContext ? 'loaded' : 'none', action: action ? action.type : null });
  } catch (error) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const fetch = (await import('node-fetch')).default;
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\nUsuário: ${prompt}\nCecília:` }] }] })
        });
        const geminiData = await geminiRes.json();
        const geminiResult = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Estou em manutenção profunda.";
        return res.json({ response: geminiResult + " (Fallback)", context: 'fallback' });
      } catch (e) {}
    }
    res.json({ response: "Modo offline." });
  }
});

router.post('/suggest-slots', authenticateToken, async (req, res) => {
  const { appointmentId, daysAhead, preferredPeriod, patientId } = req.body;
  try {
    const result = await suggestAvailableSlots({ appointmentId, daysAhead: daysAhead || 7, preferredPeriod, patientId });
    res.json({ success: true, slots: result.slots, total: result.total });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao sugerir horarios' });
  }
});

router.post('/distill', async (req, res) => {
  const { pattern, confidence } = req.body;
  const log = await prisma.aILog.create({
    data: { input: 'MANUAL_DISTILLATION', distilledPattern: pattern, confidence }
  });
  res.json(log);
});

router.post('/logs', async (req, res) => {
  const { input, distilledPattern, confidence } = req.body;
  const log = await prisma.aILog.create({
    data: { input, distilledPattern, confidence }
  });
  res.json(log);
});

router.get('/logs', authenticateToken, async (req, res) => {
  try {
    const logs = await prisma.aILog.findMany({ take: 50, orderBy: { timestamp: 'desc' } });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler logs' });
  }
});

// --- AI PRE-ATENDIMENTO ---
router.post('/pre-atendimento/analyze', async (req, res) => {
  try {
    const { data } = req.body;
    const analysis = await analyzePreAtendimentoPattern(data);
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/pre-atendimento/extract', async (req, res) => {
  try {
    const { message, existingData } = req.body;
    const extracted = buildPreAtendimentoFromChat(message, existingData || {});
    res.json({ extracted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/pre-atendimento/auto-create', authenticateToken, async (req, res) => {
  try {
    const { leadId, chatMessages } = req.body;
    const lead = await prisma.potentialLead.findUnique({ where: { id: parseInt(leadId) } });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
    const result = await autoCreatePreAtendimento(lead, chatMessages || []);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/pre-atendimento/questions', async (req, res) => {
  try {
    const { data } = req.body;
    const prompt = await generatePreAtendimentoPrompt(data);
    res.json(prompt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assistant Chat
router.post('/assistant', async (req, res) => {
  const { message, patientId, userId } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  
  try {
    const { context, action } = await askWithContext(message, userId);
    const systemPrompt = `Você é a Cecília, assistente clínica da Holozonic. ${context}`;
    
    const fetch = (await import('node-fetch')).default;
    let result = "Desculpe, estou processando...";
    let usedFallback = false;
    
    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        body: JSON.stringify({ model: 'llama3:8b', prompt: `${systemPrompt}\n\nPaciente: ${message}\nCecília:`, stream: false })
      });
      if (response.ok) {
        const data = await response.json();
        result = data.response || result;
      } else { usedFallback = true; }
    } catch (e) { usedFallback = true; }
    
    if (usedFallback) {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        try {
          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\nPaciente: ${message}\nCecília:` }] }] })
          });
          const geminiData = await geminiRes.json();
          result = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || result;
        } catch (e) {}
      }
    }
    
    await prisma.aILog.create({ data: { input: message, distilledPattern: result.slice(0, 200), confidence: 0.95 } });
    res.json({ success: true, response: result, context: !!context, action: action ? action.type : null });
  } catch (err) {
    res.status(500).json({ error: 'Erro no assistant', details: err.message });
  }
});

module.exports = router;
