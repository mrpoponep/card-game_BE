import express from 'express';
import WeeklyRewardController from '../controller/WeeklyRewardController.js';

const router = express.Router();

// Kiểm tra trạng thái phần thưởng tuần
router.post('/check', WeeklyRewardController.checkWeeklyReward);

// Nhận phần thưởng tuần
router.post('/claim', WeeklyRewardController.claimWeeklyReward);

// Lấy lịch sử nhận thưởng tuần
router.get('/history', WeeklyRewardController.getHistory);

export default router;
