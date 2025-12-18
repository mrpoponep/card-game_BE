// Server/backend/routes/UserRoutes.js
import express from 'express';
import UserController from '../controller/UserController.js';
import multer from 'multer';
const upload = multer({limits: { fileSize: 100 * 1024 * 1024 }}); // Sử dụng multer để xử lý multipart/form-data

const router = express.Router();

// Lấy số lần bị báo cáo (violation_count) của user
router.get('/:userId/violation-count', UserController.getViolationCount);

// Lấy lịch sử đấu của user (raw SQL, không qua model)
router.get('/get-game-history', UserController.getGameHistory);

// Thay đổi ảnh đại diện (avatar) của user
router.post('/upload-avatar', upload.single('avatar'), UserController.uploadAvatar);

export default router;
