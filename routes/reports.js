const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { generateReport } = require('../system/ai-assistant');

router.get('/generate', authenticateToken, async (req, res) => {
  try {
    const report = await generateReport(req.query.type || 'daily');
    res.json({ success: true, report });
  } catch (err) { 
    console.error('Report Error:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório' }); 
  }
});

module.exports = router;
