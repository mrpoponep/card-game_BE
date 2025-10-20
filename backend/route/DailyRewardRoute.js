// routes/DailyRewardRoute.js
import { Router } from 'express';
import DailyRewardController from '../controller/DailyRewardController.js';

const router = Router();

// Tất cả routes đều yêu cầu authentication
router.post('/check', DailyRewardController.checkReward);
router.post('/claim', DailyRewardController.claimReward);
router.get('/history', DailyRewardController.getHistory);
router.get('/monthly', DailyRewardController.getMonthlyRewards);

export default router;
