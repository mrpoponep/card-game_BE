import express from 'express';
import EloRewardController from '../controller/EloRewardController.js';

const router = express.Router();

// Kiểm tra trạng thái milestone rewards
router.post('/check', EloRewardController.checkRewards);

// Nhận thưởng 1 milestone
router.post('/claim', EloRewardController.claimReward);

// Nhận tất cả thưởng
router.post('/claim-all', EloRewardController.claimAllRewards);

// Lấy lịch sử nhận thưởng
router.get('/history', EloRewardController.getHistory);

export default router;
