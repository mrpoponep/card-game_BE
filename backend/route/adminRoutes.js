import { Router } from 'express';
import multer from 'multer';
import AdminController from '../controller/adminController.js';
const router = Router();
const upload = multer(); // Sử dụng bộ nhớ tạm để xử lý form-data

// 🌟 ROUTE MỚI
// GET /api/admin/total-players
router.get('/total-players', AdminController.getTotalPlayers);
// GET /api/admin/total-banned-players
router.get('/total-banned-players', AdminController.getTotalBannedPlayers);

export default router;