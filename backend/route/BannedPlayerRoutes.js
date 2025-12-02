// Server/backend/routes/bannedPlayerRoutes.js
import express from 'express';
import BannedPlayerController from '../controller/BannedPlayerController.js';

const router = express.Router();

// Tạo báo cáo (có thể dùng cho AI/Socket hoặc nút "Report" trên UI)
router.post('/', BannedPlayerController.create);

// Danh sách tất cả report
router.get('/', BannedPlayerController.list);

// Lấy tất cả report của 1 user
router.get('/user/:userId', BannedPlayerController.getByUser);

// Lấy report theo id
router.get('/:reportId', BannedPlayerController.getById);

// Xóa report (nếu cần cho admin)
router.delete('/:reportId', BannedPlayerController.remove);

export default router;
