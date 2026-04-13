const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const preAtendimento = await prisma.preAtendimento.create({
      data: {
        nome: data.nome, sexo: data.sexo, idade: data.idade ? parseInt(data.idade) : null,
        raca: data.raca, profissao: data.profissao, estadoCivil: data.estadoCivil, telefone: data.telefone,
        queixaPrincipal: data.queixaPrincipal, tempoSintoma: data.tempoSintoma, origin: data.origin || 'MANUAL', status: data.status || 'PENDENTE'
      }
    });
    res.json({ success: true, id: preAtendimento.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const registros = await prisma.preAtendimento.findMany({
      where: req.query.status ? { status: req.query.status } : {},
      orderBy: { createdAt: 'desc' },
      take: parseInt(req.query.limit || 50)
    });
    res.json(registros);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const registro = await prisma.preAtendimento.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!registro) return res.status(404).json({ error: 'Registro não encontrado' });
    res.json(registro);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/convert', authenticateToken, async (req, res) => {
  try {
    const preAt = await prisma.preAtendimento.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!preAt) return res.status(404).json({ error: 'Pré-atendimento não encontrado' });
    
    // Simplifed conversion logic (full details in server.js but this is the core)
    const patient = await prisma.patient.create({
      data: { name: preAt.nome, cpf: '00000000000', phone: preAt.telefone, birthDate: '1990-01-01', plan: 'CONVENIONAL', active: true }
    });
    
    await prisma.preAtendimento.update({ where: { id: preAt.id }, data: { status: 'CONVERTIDO', convertedToPatient: patient.id } });
    res.json({ success: true, patientId: patient.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
