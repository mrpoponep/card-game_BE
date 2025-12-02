// Server/route/AIReportRoutes.js
import express from 'express';
import AIReportController from '../controller/AIReportController.js';

const router = express.Router();

// Đường dẫn: POST /api/ban/ai/analyze-and-save
router.post('/analyze-and-save', AIReportController.analyzeAndSave);

export default router;
