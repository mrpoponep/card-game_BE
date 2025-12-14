import { Router } from 'express';
import AdminController from '../controller/adminController.js';
import RewardDistributionService from '../service/RewardDistributionService.js';
// Import database connection (đảm bảo đường dẫn đúng với cấu trúc dự án của bạn)
import db from '../model/DatabaseConnection.js';

const router = Router();

// ============================================================
// 1. MIDDLEWARE
// ============================================================

// Middleware: Chỉ cho phép trong development (Dùng cho các route test)
const devOnly = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'This endpoint is disabled in production'
    });
  }
  next();
};

// ============================================================
// 2. STATISTICS ROUTES (Dành cho Admin Dashboard)
// ============================================================

// GET /api/admin/total-players
router.get('/total-players', AdminController.getTotalPlayers);

// GET /api/admin/total-banned-players
router.get('/total-banned-players', AdminController.getTotalBannedPlayers);

// GET /api/admin/online-players
router.get('/online-players', AdminController.getOnlinePlayers);

// GET /api/admin/coin-stats?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/coin-stats', AdminController.getCoinStats);

// GET /api/admin/player-stats?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/player-stats', AdminController.getPlayerStats);

// GET /api/admin/total-active-players
router.get('/total-active-players', AdminController.getTotalActivePlayers);

// GET /api/admin/total-games?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/total-games', AdminController.getTotalGames);

// GET /api/admin/total-active-tables
router.get('/total-active-tables', AdminController.getTotalActiveTables);

// --- Routes cho biểu đồ (Chart Series) ---
router.get('/series/coin', AdminController.getCoinSeries);
router.get('/series/active-players', AdminController.getActivePlayersSeries);
router.get('/series/matches', AdminController.getMatchesSeries);
router.get('/series/table-usage', AdminController.getActiveTablesSeries);

// ============================================================
// 3. REWARD & TESTING ROUTES (Chỉ Dev & Test)
// ============================================================

/**
 * POST /api/admin/trigger-reward
 * Trigger phát thưởng thủ công (cho testing)
 * Body: { type: 'weekly' | 'monthly' }
 */
router.post('/trigger-reward', devOnly, async (req, res) => {
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
 * DELETE /api/admin/reward-log/:type
 * Xóa log phát thưởng để test lại
 * Params: type = 'weekly' | 'monthly'
 */
router.delete('/reward-log/:type', devOnly, async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!['weekly', 'monthly'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reward type'
      });
    }
    
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