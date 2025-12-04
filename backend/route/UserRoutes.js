// Server/backend/routes/UserRoutes.js
import express from 'express';
import UserController from '../controller/UserController.js';

const router = express.Router();

// Lấy số lần bị báo cáo (violation_count) của user
router.get('/:userId/violation-count', UserController.getViolationCount);

export default router;
