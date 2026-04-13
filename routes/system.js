const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { automateWorkflow, triageLead, getDashboardStats } = require('../system/ai-assistant');

// Health Check
router.get('/health', authenticateToken, async (req, res) => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  
  res.json({
    cpu: { model: cpus[0]?.model, cores: cpus.length, usage: `${(100 - (freeMem / totalMem * 100)).toFixed(1)}%` },
    memory: { total: `${(totalMem / 1024 / 1024 / 1024).toFixed(2)}GB`, percent: `${((1 - freeMem / totalMem) * 100).toFixed(1)}%` },
    uptime: `${Math.floor(process.uptime())}s`,
    status: "OPERATIONAL",
    version: "v4.1.7-Sinapse"
  });
});

// Audit
router.post('/audit', authenticateToken, async (req, res) => {
  try {
    const lastLogs = await prisma.aILog.findMany({ take: 50, orderBy: { timestamp: 'desc' } });
    const counts = await Promise.all([
      prisma.patient.count(), prisma.appointment.count(), prisma.clinicalRecord.count(), prisma.potentialLead.count()
    ]);
    
    const dbSize = fs.existsSync('./prisma/dev.db') ? (fs.statSync('./prisma/dev.db').size / 1024 / 1024).toFixed(2) : 'N/A';
    const files = fs.readdirSync(path.join(__dirname, '..')).filter(f => f.endsWith('.js') || f.endsWith('.html'));
    
    const auditReport = {
      timestamp: new Date().toISOString(),
      database: { size: `${dbSize} MB`, patients: counts[0], appointments: counts[1], records: counts[2], leads: counts[3] },
      health: { uptime: `${Math.floor(process.uptime())}s`, memoryRSS: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB` },
      status: "AUDIT_COMPLETE"
    };

    await prisma.aILog.create({
      data: { timestamp: new Date(), level: 'INFO', message: `Auto-Audit: ${files.length} files, ${counts[0]} patients`, context: 'System Evolution' }
    });

    res.json(auditReport);
  } catch (err) {
    res.status(500).json({ error: 'Falha na auditoria' });
  }
});


// Automation & Reports
router.post('/automation/workflow', authenticateToken, async (req, res) => {
  try {
    const results = await automateWorkflow(req.body.workflowType, req.body.data);
    res.json({ success: true, results });
  } catch (err) { res.status(500).json({ error: 'Erro no workflow' }); }
});

router.post('/automation/triage', authenticateToken, async (req, res) => {
  try {
    const result = await triageLead(req.body.leadId);
    if (result) await prisma.potentialLead.update({ where: { id: req.body.leadId }, data: { step: 1 } });
    res.json({ success: true, triage: result });
  } catch (err) { res.status(500).json({ error: 'Erro na triagem' }); }
});


router.get('/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json({ success: true, stats });
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar estatísticas' }); }
});

module.exports = router;
