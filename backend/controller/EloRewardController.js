import EloRewardService from '../service/EloRewardService.js';

class EloRewardController {
    /**
     * Kiểm tra trạng thái milestone rewards
     * POST /elo-reward/check
     */
    static async checkRewards(req, res) {
        try {
            console.log('🔍 req.user:', req.user); // Debug log
            console.log('🔍 req.headers:', req.headers); // Debug headers
            
            if (!req.user || !req.user.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Vui lòng đăng nhập để xem phần thưởng'
                });
            }
            
            const userId = req.user.userId; // Từ JWT middleware
            
            const rewardStatus = await EloRewardService.checkMilestoneRewards(userId);
            
            res.json({
                success: true,
                data: rewardStatus
            });
        } catch (error) {
            console.error('Error in checkRewards:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Lỗi khi kiểm tra phần thưởng'
            });
        }
    }

    /**
     * Nhận thưởng milestone
     * POST /elo-reward/claim
     * Body: { milestoneId: number }
     */
    static async claimReward(req, res) {
        try {
            const userId = req.user.userId; // Từ JWT middleware
            const { milestoneId } = req.body;

            if (!milestoneId) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu thông tin milestone'
                });
            }

            const result = await EloRewardService.claimMilestoneReward(userId, milestoneId);
            
            res.json({
                success: true,
                message: `Bạn đã nhận ${result.gemsReceived} gems!`,
                data: result
            });
        } catch (error) {
            console.error('Error in claimReward:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Lỗi khi nhận thưởng'
            });
        }
    }

    /**
     * Nhận tất cả thưởng milestone
     * POST /elo-reward/claim-all
     */
    static async claimAllRewards(req, res) {
        try {
            const userId = req.user.userId; // Từ JWT middleware
            
            const result = await EloRewardService.claimAllMilestoneRewards(userId);
            
            if (!result.success) {
                return res.json({
                    success: false,
                    message: result.message
                });
            }

            res.json({
                success: true,
                message: `Đã nhận ${result.claimedCount} phần thưởng! Tổng cộng ${result.totalGems} gems`,
                data: result
            });
        } catch (error) {
            console.error('Error in claimAllRewards:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Lỗi khi nhận thưởng'
            });
        }
    }
}

export default EloRewardController;
