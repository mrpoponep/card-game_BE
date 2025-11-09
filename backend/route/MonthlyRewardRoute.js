import express from 'express';
import MonthlyRewardController from '../controller/MonthlyRewardController.js';

const router = express.Router();

// Kiểm tra trạng thái phần thưởng tháng
router.post('/check', MonthlyRewardController.checkMonthlyReward);

// Nhận phần thưởng tháng
router.post('/claim', MonthlyRewardController.claimMonthlyReward);

export default router;
