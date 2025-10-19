import MonthlyRewardService from '../service/MonthlyRewardService.js';

class MonthlyRewardController {
  // Kiểm tra trạng thái phần thưởng tháng
  async checkMonthlyReward(req, res) {
    try {
      const userId = req.user.userId;
      
      const result = await MonthlyRewardService.checkMonthlyReward(userId);
      
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error checking monthly reward:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi kiểm tra phần thưởng tháng'
      });
    }
  }

  // Nhận phần thưởng tháng
  async claimMonthlyReward(req, res) {
    try {
      const userId = req.user.userId;
      
      const result = await MonthlyRewardService.claimMonthlyReward(userId);
      
      return res.status(200).json({
        success: true,
        message: 'Nhận phần thưởng tháng thành công!',
        data: result
      });
    } catch (error) {
      console.error('Error claiming monthly reward:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Lỗi khi nhận phần thưởng tháng'
      });
    }
  }

  // Lấy lịch sử nhận thưởng tháng
  async getMonthlyHistory(req, res) {
    try {
      const userId = req.user.userId;
      
      const history = await MonthlyRewardService.getClaimHistory(userId);
      
      return res.status(200).json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Error getting monthly history:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy lịch sử nhận thưởng tháng'
      });
    }
  }

  // Lấy cấu hình phần thưởng tháng
  async getMonthlyConfig(req, res) {
    try {
      const config = await MonthlyRewardService.getRewardConfig();
      
      return res.status(200).json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('Error getting monthly config:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy cấu hình phần thưởng tháng'
      });
    }
  }

  // Lấy danh sách Top 100 players
  async getTop100(req, res) {
    try {
      const top100 = await MonthlyRewardService.getTop100Players();
      
      return res.status(200).json({
        success: true,
        data: top100
      });
    } catch (error) {
      console.error('Error getting top 100:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy danh sách Top 100'
      });
    }
  }
}

export default new MonthlyRewardController();
