// controllers/DailyRewardController.js
import DailyRewardService from '../service/DailyRewardService.js';

class DailyRewardController {
  /**
   * Kiểm tra trạng thái nhận thưởng hằng ngày
   * POST /api/daily-reward/check
   */
  static async checkReward(req, res) {
    try {
      const userId = req.user.userId; // Từ JWT middleware

      const result = await DailyRewardService.checkDailyReward(userId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Nhận thưởng hằng ngày
   * POST /api/daily-reward/claim
   */
  static async claimReward(req, res) {
    try {
      const userId = req.user.userId; // Từ JWT middleware

      const result = await DailyRewardService.claimDailyReward(userId);

      res.json({
        success: true,
        message: `Bạn đã nhận ${result.reward} xu!`,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Lấy lịch sử nhận thưởng
   * GET /api/daily-reward/history
   */
  static async getHistory(req, res) {
    try {
      const userId = req.user.userId;
      const limit = parseInt(req.query.limit) || 30;

      const history = await DailyRewardService.getRewardHistory(userId, limit);

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Lấy danh sách phần thưởng cả tháng
   * GET /api/daily-reward/monthly
   */
  static async getMonthlyRewards(req, res) {
    try {
      const rewards = await DailyRewardService.getMonthlyRewards();

      res.json({
        success: true,
        data: rewards
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default DailyRewardController;
