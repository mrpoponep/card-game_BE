// service/DailyRewardService.js
import db from '../model/DatabaseConnection.js';

class DailyRewardService {
  /**
   * Kiểm tra xem user đã nhận thưởng hôm nay chưa
   * @param {number} userId 
   * @returns {Promise<{canClaim: boolean, reward: number|null, lastClaimed: Date|null}>}
   */
  static async checkDailyReward(userId) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // 1. Kiểm tra đã claim hôm nay chưa (dựa vào DATE của claimed_at)
    const todayClaimed = await db.query(
      `SELECT * FROM daily_rewards 
       WHERE user_id = ? AND DATE(claimed_at) = UTC_DATE()`,
      [userId]
    );

    if (todayClaimed.length > 0) {
      return {
        canClaim: false,
        reward: null,
        lastClaimed: todayClaimed[0].claimed_at,
        alreadyClaimed: true,
        loginDayCount: todayClaimed[0].login_day_count
      };
    }

    // 2. Đếm số ngày đã đăng nhập trong tháng này
    const loginDaysResult = await db.query(
      `SELECT COUNT(*) as login_count
       FROM daily_rewards
       WHERE user_id = ? AND year = ? AND month = ?`,
      [userId, currentYear, currentMonth]
    );
    const loginDayCount = parseInt(loginDaysResult[0].login_count) + 1; // Số ngày tiếp theo

    // 3. Kiểm tra giới hạn (max 31 ngày)
    if (loginDayCount > 31) {
      return {
        canClaim: false,
        reward: null,
        lastClaimed: null,
        alreadyClaimed: false,
        loginDayCount: 31,
        maxReached: true,
        message: 'Bạn đã nhận đủ 31 ngày thưởng trong tháng này!'
      };
    }

    // 4. Lấy reward cho login_day_count tiếp theo
    const rewardConfig = await db.query(
      'SELECT reward_amount FROM daily_reward_config WHERE login_day_count = ?',
      [loginDayCount]
    );

    const rewardAmount = rewardConfig.length > 0 ? rewardConfig[0].reward_amount : 1000;

    return {
      canClaim: true,
      reward: rewardAmount,
      lastClaimed: null,
      alreadyClaimed: false,
      loginDayCount: loginDayCount,
      message: `Bạn có thể nhận thưởng ngày đăng nhập thứ ${loginDayCount}!`
    };
  }

  /**
   * Nhận thưởng hằng ngày
   * @param {number} userId 
   * @returns {Promise<{success: boolean, reward: number, balance: number}>}
   */
  static async claimDailyReward(userId) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDate = now.getDate();
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...

    // Kiểm tra đã nhận chưa
    const checkResult = await this.checkDailyReward(userId);
    if (!checkResult.canClaim) {
      if (checkResult.maxReached) {
        throw new Error('Bạn đã nhận đủ 31 ngày thưởng trong tháng này!');
      }
      throw new Error('Bạn đã nhận thưởng hôm nay rồi!');
    }

    const rewardAmount = checkResult.reward;
    const loginDayCount = checkResult.loginDayCount;

    // Bắt đầu transaction
    const connection = await db.beginTransaction();
    
    try {
      await connection.beginTransaction();

      // 1. Lưu lịch sử nhận thưởng daily (dùng login_day_count thay vì day_of_month)
      await connection.query(
        `INSERT INTO daily_rewards (user_id, login_day_count, month, year, reward_amount, claimed_at)
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
        [userId, loginDayCount, currentMonth, currentYear, rewardAmount]
      );

      // 2. Ghi log transaction (trigger sẽ tự động cập nhật balance)
      await connection.query(
        `INSERT INTO Transactions (user_id, amount, reason, source, time)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP())`,
        [userId, rewardAmount, `Phần thưởng đăng nhập ngày thứ ${loginDayCount}`, 'daily_reward']
      );

      // 3. Lấy số dư mới
      const userResult = await connection.query(
        'SELECT balance, gems FROM User WHERE user_id = ?',
        [userId]
      );

      await db.commit(connection);

      return {
        success: true,
        reward: rewardAmount,
        balance: userResult[0].balance,
        gems: userResult[0].gems,
        loginDayCount: loginDayCount,
        message: `Chúc mừng! Bạn đã nhận ${rewardAmount} xu cho ngày đăng nhập thứ ${loginDayCount}!`
      };
    } catch (error) {
      await db.rollback(connection);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Lấy lịch sử nhận thưởng của user trong tháng hiện tại
   * @param {number} userId 
   * @param {number} limit 
   * @returns {Promise<Array>}
   */
  static async getRewardHistory(userId, limit = 30) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const history = await db.query(
      `SELECT login_day_count, month, year, reward_amount, claimed_at 
       FROM daily_rewards 
       WHERE user_id = ? AND year = ? AND month = ?
       ORDER BY login_day_count ASC 
       LIMIT ${limit}`,
      [userId, currentYear, currentMonth]
    );

    return history;
  }

  /**
   * Lấy danh sách phần thưởng cả tháng (31 ngày)
   * @returns {Promise<Array>}
   */
  static async getMonthlyRewards() {
    const rewards = await db.query(
      'SELECT login_day_count, reward_amount FROM daily_reward_config ORDER BY login_day_count ASC'
    );

    return rewards;
  }
}

export default DailyRewardService;
