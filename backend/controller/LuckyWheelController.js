// controller/LuckyWheelController.js
import LuckyWheelService from '../service/LuckyWheelService.js';

class LuckyWheelController {
  /**
   * Quay vòng quay may mắn
   * POST /api/lucky-wheel/spin
   */
  static async spin(req, res) {
    try {
      const userId = req.user.userId;
      const { multiplier } = req.body;

      // Validate multiplier
      if (!multiplier || multiplier < 1 || multiplier > 100) {
        return res.status(400).json({
          success: false,
          message: 'Hệ số không hợp lệ (1-100)'
        });
      }

      const result = await LuckyWheelService.spin(userId, multiplier);

      res.json({
        success: true,
        message: `Chúc mừng! Bạn trúng ${result.prizeAmount.toLocaleString()} coin!`,
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
   * Lấy lịch sử quay
   * GET /api/lucky-wheel/history
   */
  static async getHistory(req, res) {
    try {
      const userId = req.user.userId;
      const limit = parseInt(req.query.limit) || 20;

      const history = await LuckyWheelService.getHistory(userId, limit);

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
   * Lấy thống kê
   * GET /api/lucky-wheel/stats
   */
  static async getStats(req, res) {
    try {
      const userId = req.user.userId;

      const stats = await LuckyWheelService.getStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Lấy gems hiện tại của user
   * GET /api/lucky-wheel/gems
   */
  static async getUserGems(req, res) {
    try {
      const userId = req.user.userId;

      const gems = await LuckyWheelService.getUserGems(userId);

      res.json({
        success: true,
        gems
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default LuckyWheelController;
