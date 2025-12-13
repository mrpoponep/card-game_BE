// route/ReportRoute.js
import express from 'express';
import ReportController from '../controller/ReportController.js';

const router = express.Router();

/**
 * Report Routes
 * Định nghĩa các endpoint cho Report API
 */

// POST /api/reports - Tạo report mới
router.post('/', ReportController.createReport);
router.get('/', ReportController.listReports);
export default router;
