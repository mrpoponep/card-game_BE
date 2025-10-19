// routes/DailyRewardRoute.js
import { Router } from 'express';
import DailyRewardController from '../controller/DailyRewardController.js';

const router = Router();

// Tất cả routes đều yêu cầu authentication
router.post('/daily-reward/check', DailyRewardController.checkReward);
router.post('/daily-reward/claim', DailyRewardController.claimReward);
router.get('/daily-reward/history', DailyRewardController.getHistory);
router.get('/daily-reward/monthly', DailyRewardController.getMonthlyRewards);
router.get('/daily-reward/stats', DailyRewardController.getStats);

export default router;
