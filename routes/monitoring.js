const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Push health data from wearable/gateway
router.post('/push', async (req, res) => {
    const { patientId, metrics, alert } = req.body;
    try {
        // Emit to global socket for real-time dashboard update
        const io = req.app.get('socketio');
        if (io) {
            io.emit('monitoring-update', { patientId, metrics, alert });
            
            if (alert && alert.type === 'FALL') {
                console.log(`🚨 FALL DETECTED for patient ${patientId}`);
                io.emit('emergency-alert', { patientId, message: 'QUEDA DETECTADA!', type: 'CRITICAL' });
            }
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao processar dados de monitoramento' });
    }
});

module.exports = router;
