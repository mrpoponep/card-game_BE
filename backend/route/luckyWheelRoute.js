// route/luckyWheelRoute.js
import express from 'express';
import LuckyWheelController from '../controller/LuckyWheelController.js';

const router = express.Router();

// Lấy gems hiện tại
router.get('/gems', LuckyWheelController.getUserGems);

// Quay vòng may mắn
router.post('/spin', LuckyWheelController.spin);

// Lấy lịch sử
router.get('/history', LuckyWheelController.getHistory);

// Lấy thống kê
router.get('/stats', LuckyWheelController.getStats);

export default router;
