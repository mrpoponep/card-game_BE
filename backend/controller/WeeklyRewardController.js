import WeeklyRewardService from '../service/WeeklyRewardService.js';

class WeeklyRewardController {
  // Kiểm tra trạng thái phần thưởng tuần
  async checkWeeklyReward(req, res) {
    try {
      const userId = req.user.userId;
      
      const result = await WeeklyRewardService.checkWeeklyReward(userId);
      
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error checking weekly reward:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi kiểm tra phần thưởng tuần'
      });
    }
  }

  // Nhận phần thưởng tuần
  async claimWeeklyReward(req, res) {
    try {
      const userId = req.user.userId;
      
      const result = await WeeklyRewardService.claimWeeklyReward(userId);
      
      return res.status(200).json({
        success: true,
        message: 'Nhận phần thưởng tuần thành công!',
        data: result
      });
    } catch (error) {
      console.error('Error claiming weekly reward:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Lỗi khi nhận phần thưởng tuần'
      });
    }
  }
}

export default new WeeklyRewardController();
