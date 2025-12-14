// service/MonthlyRewardService.js
import db from '../model/DatabaseConnection.js';
import User from '../model/User.js';

class MonthlyRewardService {
  /**
   * Kiểm tra xem user có phần thưởng tháng chưa nhận không
   * CHỈ kiểm tra các reward đã được tạo sẵn (bởi scheduler)
   * @param {number} userId 
   * @returns {Promise<{canClaim: boolean, reward: number|null}>}
   */
  static async checkMonthlyReward(userId) {
    // Lấy rank hiện tại của user
    const user = await User.findById(userId);
    const currentRank = await user.getRank();

    // Kiểm tra có reward pending không (claimed_at IS NULL)
    const pendingRewards = await db.query(
      `SELECT * FROM monthly_reward_claims 
       WHERE user_id = ? AND claimed_at IS NULL
       ORDER BY month_year DESC
       LIMIT 1`,
      [userId]
    );

    if (pendingRewards.length > 0) {
      const reward = pendingRewards[0];
      const rank = reward.rank_at_claim;
      const gemsReceived = reward.gems_received;
      
      // Nếu gems = 0 (ngoài top 100), canClaim = false
      const canClaim = gemsReceived > 0;
      
      return {
        canClaim: canClaim,
        reward: gemsReceived,
        rank: rank,
        currentRank: currentRank,
        monthYear: reward.month_year,
        eloAtEarned: reward.elo_at_claim,
        message: canClaim
          ? `Bạn có thể nhận ${gemsReceived} gems cho tháng ${reward.month_year}!`
          : `Bạn đạt hạng ${rank} tháng ${reward.month_year}. Cần vào Top 100 để nhận gems!`
      };
    }

    // Nếu không có pending reward, lấy reward gần nhất (đã claim)
    const lastReward = await db.query(
      `SELECT * FROM monthly_reward_claims 
       WHERE user_id = ? AND claimed_at IS NOT NULL
       ORDER BY month_year DESC
       LIMIT 1`,
      [userId]
    );

    if (lastReward.length > 0) {
      const reward = lastReward[0];
      const rank = reward.rank_at_claim;
      const gemsReceived = reward.gems_received;
      
      return {
        canClaim: false,
        reward: gemsReceived,
        rank: rank,
        currentRank: currentRank,
        monthYear: reward.month_year,
        eloAtEarned: reward.elo_at_claim,
        claimedAt: reward.claimed_at,
        message: gemsReceived > 0
          ? 'Bạn đã nhận phần thưởng tháng này rồi'
          : `Bạn đạt hạng ${rank} tháng ${reward.month_year}`
      };
    }

    // Nếu chưa có reward nào (user mới hoặc chưa được phát)
    return {
      canClaim: false,
      reward: 0,
      currentRank: currentRank,
      message: currentRank > 100
        ? `Bạn đang ở hạng ${currentRank}. Cần vào Top 100 để nhận thưởng!`
        : 'Chưa có phần thưởng tháng nào'
    };
  }

  /**
   * Claim phần thưởng tháng (UPDATE claimed_at cho reward đã tạo sẵn)
   * @param {number} userId 
   * @returns {Promise<{success: boolean, reward: number, gems: number}>}
   */
  static async claimMonthlyReward(userId) {
    // Bắt đầu transaction
    const connection = await db.beginTransaction();
    
    try {
      // Kiểm tra có reward pending không
      const pendingRewards = await db.transactionQuery(
        connection,
        `SELECT * FROM monthly_reward_claims 
         WHERE user_id = ? AND claimed_at IS NULL
         ORDER BY month_year DESC
         LIMIT 1`,
        [userId]
      );

      if (pendingRewards.length === 0) {
        throw new Error('Không có phần thưởng tháng nào để nhận');
      }

      const reward = pendingRewards[0];
      const claimId = reward.claim_id;
      const gemsReceived = reward.gems_received;

      // UPDATE claimed_at thành thời điểm hiện tại
      await db.transactionQuery(
        connection,
        `UPDATE monthly_reward_claims 
         SET claimed_at = UTC_TIMESTAMP()
         WHERE claim_id = ?`,
        [claimId]
      );

      // Cộng gems cho user (COALESCE để xử lý NULL)
      await db.transactionQuery(
        connection,
        'UPDATE User SET gems = COALESCE(gems, 0) + ? WHERE user_id = ?',
        [gemsReceived, userId]
      );

      // Lấy số gems mới
      const userResult = await db.transactionQuery(
        connection,
        'SELECT gems FROM User WHERE user_id = ?',
        [userId]
      );

      await db.commit(connection);

      return {
        success: true,
        reward: gemsReceived,
        gems: userResult[0].gems,
        rank: reward.rank_at_claim,
        monthYear: reward.month_year,
        message: `Chúc mừng! Bạn đã nhận ${gemsReceived} gems cho hạng ${reward.rank_at_claim} tháng ${reward.month_year}!`
      };
    } catch (error) {
      await db.rollback(connection);
      throw error;
    }
  }

  /**
   * Lấy tháng-năm hiện tại
   * @returns {{monthYear: string, year: number, month: number}}
   */
  static getCurrentMonth() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1; // JavaScript months are 0-based
    const monthYear = `${year}-${String(month).padStart(2, '0')}`;
    
    return { monthYear, year, month };
  }

  /**
   * Lấy tháng-năm của tháng trước (giữ lại cho backward compatibility)
   * @returns {{monthYear: string, year: number, month: number}}
   */
  static getLastMonth() {
    const today = new Date();
    const year = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const month = today.getMonth() === 0 ? 12 : today.getMonth();
    const monthYear = `${year}-${String(month).padStart(2, '0')}`;
    
    return { monthYear, year, month };
  }

  /**
   * Lấy lịch sử nhận thưởng tháng
   * @param {number} userId 
   * @returns {Promise<Array>}
   */
  static async getRewardHistory(userId) {
    try {
      const history = await db.query(
        `SELECT 
          MONTH(STR_TO_DATE(CONCAT(month_year, '-01'), '%Y-%m-%d')) as month,
          YEAR(STR_TO_DATE(CONCAT(month_year, '-01'), '%Y-%m-%d')) as year,
          rank_at_claim as \`rank\`,
          gems_received as gems_reward,
          elo_at_claim,
          month_year,
          claimed_at
        FROM monthly_reward_claims 
        WHERE user_id = ? AND claimed_at IS NOT NULL
        ORDER BY claimed_at DESC
        LIMIT 100`,
        [userId]
      );

      return history;
    } catch (error) {
      console.error('Error getting monthly reward history:', error);
      throw error;
    }
  }
}

export default MonthlyRewardService;
