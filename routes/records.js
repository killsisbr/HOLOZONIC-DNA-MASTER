const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticateToken, checkRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

// Multer Setup (copied from server.js logic)
const uploadDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// --- RECORDS ---
router.get('/:patientId', authenticateToken, checkRole(['ADMIN', 'MEDICO']), async (req, res) => {
  const records = await prisma.clinicalRecord.findMany({
    where: { patientId: parseInt(req.params.patientId) },
    include: { attachments: true },
    orderBy: { date: 'desc' }
  });
  res.json(records);
});

router.post('/', authenticateToken, checkRole(['ADMIN', 'MEDICO']), async (req, res) => {
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

// --- ATTACHMENTS (Mounted at /api/records/attachments) ---
router.post('/attachments', authenticateToken, checkRole(['ADMIN', 'MEDICO']), upload.single('file'), async (req, res) => {
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

// --- DOCUMENTS (Mounted at /api/records/generate) ---
router.post('/generate', authenticateToken, checkRole(['ADMIN', 'MEDICO']), async (req, res) => {
    const { recordId, type } = req.body;
  
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

    doc.fillColor('#1a1a1a').fontSize(22).text('HOLOZONIC CARE', { align: 'center' });
    doc.fontSize(10).text('MEDICINA INTEGRATIVA & LONGEVIDADE', { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#cccccc');
    doc.moveDown(2);

    const title = type === 'PRESCRIPTION' ? 'PRESCRIÇÃO MÉDICA' : 'ATESTADO MÉDICO';
    doc.fillColor('#004d40').fontSize(18).text(title, { align: 'center', underline: true });
    doc.moveDown(2);

    doc.fillColor('#1a1a1a').fontSize(12);
    doc.text(`PACIENTE: ${record.patient.name.toUpperCase()}`);
    doc.text(`CPF: ${record.patient.cpf}`);
    doc.text(`DATA DE NASCIMENTO: ${record.patient.birthDate}`);
    doc.moveDown();
    if (record.cid10) {
      doc.text(`DIAGNÓSTICO (CID-10): ${record.cid10}`);
    }
    doc.moveDown(2);

    doc.fontSize(14).text('DESCRIÇÃO / ORIENTAÇÕES:', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(record.description, { align: 'justify', lineGap: 5 });

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

module.exports = router;
