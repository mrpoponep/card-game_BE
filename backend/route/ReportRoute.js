// route/ReportRoute.js
import express from 'express';
import ReportController from '../controller/ReportController.js';

const router = express.Router();
// POST /api/reports - Tạo report mới
router.post('/', ReportController.createReport);
router.get('/', ReportController.listReports);
router.patch('/:reportId/verdict', ReportController.updateVerdict); 
router.delete('/:reportId', ReportController.deleteReport);
export default router;
