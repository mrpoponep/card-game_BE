// service/MonthlyRewardService.js
import db from '../model/DatabaseConnection.js';
import User from '../model/User.js';

class MonthlyRewardService {
  /**
   * Kiểm tra xem user có thể nhận thưởng tháng không (Top 100)
   * @param {number} userId 
   * @returns {Promise<{canClaim: boolean, reward: number|null, rank: number|null}>}
   */
  static async checkMonthlyReward(userId) {
    // Lấy tháng-năm hiện tại (không phải tháng trước)
    const currentMonth = this.getCurrentMonth();
    const monthYear = currentMonth.monthYear; // Format: YYYY-MM

    // Lấy rank hiện tại của user
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const currentRank = await user.getRank();
    const currentElo = user.elo;

    // Kiểm tra có trong top 100 không
    if (currentRank > 100) {
      return {
        canClaim: false,
        reward: null,
        rank: currentRank,
        message: `Bạn không có trong top 100 (hạng ${currentRank})`
      };
    }

    // Tìm phần thưởng theo rank
    const rewardConfig = await db.query(
      `SELECT gems_reward 
       FROM monthly_reward_config
       WHERE rank_min <= ? AND rank_max >= ?
       ORDER BY rank_min ASC
       LIMIT 1`,
      [currentRank, currentRank]
    );

    if (rewardConfig.length === 0) {
      return {
        canClaim: false,
        reward: null,
        rank: currentRank,
        currentElo: currentElo,
        message: 'Không tìm thấy cấu hình phần thưởng phù hợp'
      };
    }

    // Kiểm tra đã claim tháng này chưa
    const claimed = await db.query(
      `SELECT * FROM monthly_reward_claims 
       WHERE user_id = ? AND month_year = ?`,
      [userId, monthYear]
    );

    const alreadyClaimed = claimed.length > 0;

    return {
      canClaim: !alreadyClaimed,
      reward: rewardConfig[0].gems_reward,
      rank: currentRank,
      currentElo: currentElo,
      monthYear: monthYear,
      alreadyClaimed: alreadyClaimed,
      message: alreadyClaimed 
        ? `Bạn đã nhận thưởng tháng ${monthYear} rồi!`
        : `Bạn có thể nhận ${rewardConfig[0].gems_reward} gems cho tháng ${monthYear}!`
    };
  }

  /**
   * Nhận thưởng hàng tháng (Top 100)
   * @param {number} userId 
   * @returns {Promise<{success: boolean, reward: number, gems: number}>}
   */
  static async claimMonthlyReward(userId) {
    // Kiểm tra điều kiện
    const checkResult = await this.checkMonthlyReward(userId);
    if (!checkResult.canClaim) {
      throw new Error(checkResult.message || 'Không thể nhận thưởng tháng này!');
    }

    const monthYear = checkResult.monthYear;
    const rewardAmount = checkResult.reward;
    const currentRank = checkResult.rank;
    const currentElo = checkResult.currentElo;

    // Bắt đầu transaction
    const connection = await db.beginTransaction();
    
    try {
      await connection.beginTransaction();

      // 1. Lưu lịch sử nhận thưởng
      await connection.query(
        `INSERT INTO monthly_reward_claims (user_id, month_year, rank_at_claim, elo_at_claim, gems_received, claimed_at)
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
        [userId, monthYear, currentRank, currentElo, rewardAmount]
      );

      // 2. Cập nhật gems
      await connection.query(
        'UPDATE User SET gems = gems + ? WHERE user_id = ?',
        [rewardAmount, userId]
      );

      // 3. Lấy số gems mới
      const userResult = await connection.query(
        'SELECT gems FROM User WHERE user_id = ?',
        [userId]
      );

      await db.commit(connection);

      return {
        success: true,
        reward: rewardAmount,
        gems: userResult[0].gems,
        rank: currentRank,
        monthYear: monthYear,
        message: `Chúc mừng! Bạn đã nhận ${rewardAmount} gems cho hạng ${currentRank} tháng ${monthYear}!`
      };
    } catch (error) {
      await db.rollback(connection);
      throw error;
    } finally {
      connection.release();
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
}

export default MonthlyRewardService;
