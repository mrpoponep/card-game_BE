import express from 'express';
import WeeklyRewardController from '../controller/WeeklyRewardController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

// Tất cả routes đều yêu cầu authentication (đã được xử lý ở app.js)

// Kiểm tra trạng thái phần thưởng tuần
router.post('/check', WeeklyRewardController.checkWeeklyReward);

// Nhận phần thưởng tuần
router.post('/claim', WeeklyRewardController.claimWeeklyReward);

// Lấy lịch sử nhận thưởng tuần
router.get('/history', WeeklyRewardController.getWeeklyHistory);

// Lấy cấu hình phần thưởng tuần
router.get('/config', WeeklyRewardController.getWeeklyConfig);

export default router;
