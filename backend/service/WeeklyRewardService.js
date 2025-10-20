// service/WeeklyRewardService.js
import db from '../model/DatabaseConnection.js';

class WeeklyRewardService {
  /**
   * Kiểm tra xem user có thể nhận thưởng tuần không
   * @param {number} userId 
   * @returns {Promise<{canClaim: boolean, reward: number|null, weekStartDate: Date|null}>}
   */
  static async checkWeeklyReward(userId) {
    // Lấy ngày thứ 2 đầu tuần hiện tại
    const weekStartDate = this.getMondayOfCurrentWeek();
    const weekStartDateStr = weekStartDate.toISOString().split('T')[0];

    // Lấy ELO hiện tại của user
    const user = await db.query(
      'SELECT elo FROM User WHERE user_id = ?',
      [userId]
    );

    if (!user || user.length === 0) {
      throw new Error('User not found');
    }

    const currentElo = user[0].elo;

    // Tìm phần thưởng theo ELO
    const rewardConfig = await db.query(
      `SELECT gems_reward, tier_name 
       FROM weekly_reward_config
       WHERE elo_min <= ? AND (elo_max IS NULL OR elo_max >= ?)
       ORDER BY elo_min DESC
       LIMIT 1`,
      [currentElo, currentElo]
    );

    if (rewardConfig.length === 0) {
      return {
        canClaim: false,
        reward: null,
        tierName: null,
        currentElo: currentElo,
        weekStartDate: weekStartDate,
        message: 'Không tìm thấy cấu hình phần thưởng phù hợp'
      };
    }

    // Kiểm tra đã claim tuần này chưa
    const claimed = await db.query(
      `SELECT * FROM weekly_reward_claims 
       WHERE user_id = ? AND week_start_date = ?`,
      [userId, weekStartDateStr]
    );

    const alreadyClaimed = claimed.length > 0;

    return {
      canClaim: !alreadyClaimed,
      reward: rewardConfig[0].gems_reward,
      tierName: rewardConfig[0].tier_name,
      currentElo: currentElo,
      weekStartDate: weekStartDate,
      alreadyClaimed: alreadyClaimed,
      message: alreadyClaimed 
        ? 'Bạn đã nhận thưởng tuần này rồi!' 
        : `Bạn có thể nhận ${rewardConfig[0].gems_reward} gems cho tuần này!`
    };
  }

  /**
   * Nhận thưởng hàng tuần
   * @param {number} userId 
   * @returns {Promise<{success: boolean, reward: number, gems: number}>}
   */
  static async claimWeeklyReward(userId) {
    // Kiểm tra điều kiện
    const checkResult = await this.checkWeeklyReward(userId);
    if (!checkResult.canClaim) {
      throw new Error(checkResult.message || 'Không thể nhận thưởng tuần này!');
    }

    const weekStartDate = checkResult.weekStartDate.toISOString().split('T')[0];
    const rewardAmount = checkResult.reward;
    const currentElo = checkResult.currentElo;

    // Bắt đầu transaction
    const connection = await db.beginTransaction();
    
    try {
      await connection.beginTransaction();

      // 1. Lưu lịch sử nhận thưởng
      await connection.query(
        `INSERT INTO weekly_reward_claims (user_id, week_start_date, gems_received, elo_at_claim, claimed_at)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP())`,
        [userId, weekStartDate, rewardAmount, currentElo]
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
        tierName: checkResult.tierName,
        message: `Chúc mừng! Bạn đã nhận ${rewardAmount} gems cho tuần này!`
      };
    } catch (error) {
      await db.rollback(connection);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Lấy ngày thứ 2 đầu tuần hiện tại
   * @returns {Date}
   */
  static getMondayOfCurrentWeek() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Nếu chủ nhật thì lùi 6 ngày
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }
}

export default WeeklyRewardService;
