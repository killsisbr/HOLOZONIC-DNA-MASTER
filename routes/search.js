const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ results: [] });

  try {
    const [patients, records, leads] = await Promise.all([
      prisma.patient.findMany({ where: { OR: [{ name: { contains: q } }, { cpf: { contains: q } }] }, take: 5 }),
      prisma.clinicalRecord.findMany({ where: { OR: [{ description: { contains: q } }, { cid10: { contains: q } }] }, include: { patient: true }, take: 5 }),
      prisma.potentialLead.findMany({ where: { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] }, take: 5 })
    ]);

    const results = [
      ...patients.map(p => ({ id: p.id, type: 'PATIENT', title: p.name, pId: p.id })),
      ...records.map(r => ({ id: r.id, type: 'RECORD', title: `Evolução: ${r.patient.name}`, pId: r.patientId })),
      ...leads.map(l => ({ id: l.id, type: 'LEAD', title: l.name || 'Lead s/ nome', lId: l.id }))
    ];
    res.json({ results });
  } catch (err) {
    console.error('Search Error:', err);
    res.status(500).json({ error: 'Erro na busca global' });
  }
});

module.exports = router;
