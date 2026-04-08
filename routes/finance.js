const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

// --- FINANCE & DASHBOARD ---
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const [patients, records, leads, transactions] = await Promise.all([
      prisma.patient.findMany({ where: { active: true }, include: { records: { orderBy: { date: 'desc' }, take: 2 } }, orderBy: { id: 'desc' } }),
      prisma.clinicalRecord.findMany({ orderBy: { date: 'desc' }, take: 10, include: { patient: true } }),
      prisma.potentialLead.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
      prisma.transaction.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
    ]);

    const revenue = transactions.filter(t => t.type === 'INCOME' && t.status === 'PAID').reduce((a, b) => a + b.amount, 0);
    const expenses = transactions.filter(t => t.type === 'EXPENSE' && t.status === 'PAID').reduce((a, b) => a + b.amount, 0);
    const projected = transactions.filter(t => t.type === 'INCOME' && t.status === 'PENDING').reduce((a, b) => a + b.amount, 0);

    const dnaBase = patients.map(p => ({
      id: p.id, name: p.name, cpf: p.cpf, birthDate: p.birthDate, plan: p.plan,
      medications: p.medications ? p.medications.split(';') : [],
      lastVisit: p.records[0] ? p.records[0].date : 'N/D',
      status: p.active ? 'Ativo' : 'Inativo'
    }));

    res.json({ pacientes: dnaBase, leads, transactions, finances: { revenue, expenses, projected } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build DNA Dashboard' });
  }
});

router.post('/transactions', authenticateToken, async (req, res) => {
  const { type, amount, status, method, description, date } = req.body;
  try {
    const newTx = await prisma.transaction.create({
      data: { type: type || 'INCOME', amount: parseFloat(amount) || 0.0, status: status || 'PAID', method: method || 'N/A', description: description || 'Transação Avulsa', date: date || new Date().toISOString() }
    });
    res.json({ success: true, transaction: newTx });
  } catch(e) {
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

router.patch('/transactions/:id', authenticateToken, async (req, res) => {
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

module.exports = router;
