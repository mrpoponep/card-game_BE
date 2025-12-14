// route/adminRoute.js
// Admin routes để test và quản lý hệ thống
import express from 'express';
import RewardDistributionService from '../service/RewardDistributionService.js';

const router = express.Router();

// ⚠️ Middleware: Chỉ cho phép trong development
const devOnly = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'This endpoint is disabled in production'
    });
  }
  next();
};

// Apply middleware cho tất cả routes
router.use(devOnly);

/**
 * POST /admin/trigger-reward
 * Trigger phát thưởng thủ công (cho testing)
 * Body: { type: 'weekly' | 'monthly' }
 */
router.post('/trigger-reward', async (req, res) => {
  try {
    const { type } = req.body;
    
    if (!type || !['weekly', 'monthly'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reward type. Must be "weekly" or "monthly"'
      });
    }
    
    console.log(`🎁 Admin triggered ${type} reward distribution`);
    
    let result;
    if (type === 'weekly') {
      result = await RewardDistributionService.distributeWeeklyRewards();
    } else {
      result = await RewardDistributionService.distributeMonthlyRewards();
    }
    
    return res.status(200).json({
      success: true,
      message: `${type} reward distribution completed`,
      data: result
    });
    
  } catch (error) {
    console.error('Error triggering reward:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * DELETE /admin/reward-log/:type
 * Xóa log phát thưởng để test lại
 * Params: type = 'weekly' | 'monthly'
 */
router.delete('/reward-log/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!['weekly', 'monthly'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reward type'
      });
    }
    
    const db = (await import('../model/DatabaseConnection.js')).default;
    
    // Xóa log gần nhất
    await db.query(
      `DELETE FROM reward_distribution_log 
       WHERE reward_type = ? 
       ORDER BY distributed_at DESC 
       LIMIT 1`,
      [type]
    );
    
    console.log(`🗑️ Deleted ${type} reward log`);
    
    return res.status(200).json({
      success: true,
      message: `${type} reward log deleted. You can now distribute again.`
    });
    
  } catch (error) {
    console.error('Error deleting reward log:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
