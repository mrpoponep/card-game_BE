// services/DailyRewardService.js
import db from '../model/DatabaseConnection.js';

class DailyRewardService {
  /**
   * Kiểm tra xem user đã nhận thưởng hôm nay chưa
   * @param {number} userId 
   * @returns {Promise<{canClaim: boolean, reward: number|null, lastClaimed: Date|null}>}
   */
  static async checkDailyReward(userId) {
    const now = new Date();
    const today = {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate()
    };

    // Kiểm tra xem đã nhận thưởng hôm nay chưa
    const claimed = await db.query(
      `SELECT * FROM daily_rewards 
       WHERE user_id = ? AND year = ? AND month = ? AND day_of_month = ?`,
      [userId, today.year, today.month, today.day]
    );

    if (claimed.length > 0) {
      return {
        canClaim: false,
        reward: null,
        lastClaimed: claimed[0].claimed_at,
        alreadyClaimed: true
      };
    }

    // Lấy reward cho ngày hôm nay
    const rewardConfig = await db.query(
      'SELECT reward_amount FROM daily_reward_config WHERE day_of_month = ?',
      [today.day]
    );

    const rewardAmount = rewardConfig.length > 0 ? rewardConfig[0].reward_amount : 100;

    return {
      canClaim: true,
      reward: rewardAmount,
      lastClaimed: null,
      alreadyClaimed: false,
      dayOfMonth: today.day
    };
  }

  /**
   * Nhận thưởng hằng ngày
   * @param {number} userId 
   * @returns {Promise<{success: boolean, reward: number, balance: number}>}
   */
  static async claimDailyReward(userId) {
    const now = new Date();
    const today = {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate()
    };

    // Kiểm tra đã nhận chưa
    const checkResult = await this.checkDailyReward(userId);
    if (!checkResult.canClaim) {
      throw new Error('Bạn đã nhận thưởng hôm nay rồi!');
    }

    const rewardAmount = checkResult.reward;

    // Bắt đầu transaction
    const connection = await db.beginTransaction();
    
    try {
      await connection.beginTransaction();

      // 1. Lưu lịch sử nhận thưởng
      await connection.query(
        `INSERT INTO daily_rewards (user_id, day_of_month, month, year, reward_amount, claimed_at)
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
        [userId, today.day, today.month, today.year, rewardAmount]
      );

      // 2. Ghi log transaction (trigger sẽ tự động cập nhật balance)
      await connection.query(
        `INSERT INTO Transactions (user_id, amount, reason, source, time)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP())`,
        [userId, rewardAmount, `Phần thưởng hằng ngày - Ngày ${today.day}`, 'daily_reward']
      );

      // 3. Lấy số dư mới
      const [userResult] = await connection.query(
        'SELECT balance FROM User WHERE user_id = ?',
        [userId]
      );

      await db.commit(connection);

      return {
        success: true,
        reward: rewardAmount,
        balance: userResult[0].balance,
        dayOfMonth: today.day
      };
    } catch (error) {
      await db.rollback(connection);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Lấy lịch sử nhận thưởng của user
   * @param {number} userId 
   * @param {number} limit 
   * @returns {Promise<Array>}
   */
  static async getRewardHistory(userId, limit = 30) {
    const history = await db.query(
      `SELECT day_of_month, month, year, reward_amount, claimed_at 
       FROM daily_rewards 
       WHERE user_id = ? 
       ORDER BY claimed_at DESC 
       LIMIT ${limit}`,
      [userId]
    );

    return history;
  }

  /**
   * Lấy danh sách phần thưởng cả tháng
   * @returns {Promise<Array>}
   */
  static async getMonthlyRewards() {
    const rewards = await db.query(
      'SELECT day_of_month, reward_amount FROM daily_reward_config ORDER BY day_of_month ASC'
    );

    return rewards;
  }

  /**
   * Lấy số ngày đã nhận thưởng trong tháng hiện tại
   * @param {number} userId 
   * @returns {Promise<number>}
   */
  static async getMonthlyClaimCount(userId) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const result = await db.query(
      `SELECT COUNT(*) as count FROM daily_rewards 
       WHERE user_id = ? AND year = ? AND month = ?`,
      [userId, currentYear, currentMonth]
    );

    return result[0].count;
  }
}

export default DailyRewardService;
