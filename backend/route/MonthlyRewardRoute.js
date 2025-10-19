import express from 'express';
import MonthlyRewardController from '../controller/MonthlyRewardController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

// Tất cả routes đều yêu cầu authentication (đã được xử lý ở app.js)

// Kiểm tra trạng thái phần thưởng tháng
router.post('/check', MonthlyRewardController.checkMonthlyReward);

// Nhận phần thưởng tháng
router.post('/claim', MonthlyRewardController.claimMonthlyReward);

// Lấy lịch sử nhận thưởng tháng
router.get('/history', MonthlyRewardController.getMonthlyHistory);

// Lấy cấu hình phần thưởng tháng
router.get('/config', MonthlyRewardController.getMonthlyConfig);

// Lấy danh sách Top 100 players
router.get('/top100', MonthlyRewardController.getTop100);

export default router;
