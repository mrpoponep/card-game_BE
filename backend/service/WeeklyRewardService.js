// service/WeeklyRewardService.js
import db from '../model/DatabaseConnection.js';

class WeeklyRewardService {
  /**
   * Kiểm tra xem user có phần thưởng tuần chưa nhận không
   * CHỈ kiểm tra các reward đã được tạo sẵn (bởi scheduler)
   * @param {number} userId 
   * @returns {Promise<{canClaim: boolean, reward: number|null}>}
   */
  static async checkWeeklyReward(userId) {
    // Kiểm tra có reward pending không (claimed_at IS NULL)
    const pendingRewards = await db.query(
      `SELECT * FROM weekly_reward_claims 
       WHERE user_id = ? AND claimed_at IS NULL
       ORDER BY week_start_date DESC
       LIMIT 1`,
      [userId]
    );

    if (pendingRewards.length > 0) {
      const reward = pendingRewards[0];
      return {
        canClaim: true,
        reward: reward.gems_received,
        title: reward.tier_name || 'Weekly Reward',
        weekStartDate: reward.week_start_date,
        eloAtEarned: reward.elo_at_claim,
        message: `Bạn có thể nhận ${reward.gems_received} gems cho tuần này!`
      };
    }

    // Nếu không có pending reward, lấy reward gần nhất (đã claim)
    const lastReward = await db.query(
      `SELECT * FROM weekly_reward_claims 
       WHERE user_id = ? AND claimed_at IS NOT NULL
       ORDER BY week_start_date DESC
       LIMIT 1`,
      [userId]
    );

    if (lastReward.length > 0) {
      const reward = lastReward[0];
      return {
        canClaim: false,
        reward: reward.gems_received,
        title: reward.tier_name || 'Weekly Reward',
        weekStartDate: reward.week_start_date,
        eloAtEarned: reward.elo_at_claim,
        claimedAt: reward.claimed_at,
        message: 'Bạn đã nhận phần thưởng tuần này rồi'
      };
    }

    // Nếu chưa có reward nào (user mới hoặc chưa đủ điều kiện)
    return {
      canClaim: false,
      reward: 0,
      title: 'Weekly Reward',
      message: 'Chưa có phần thưởng tuần nào'
    };
  }

  /**
   * Nhận thưởng hàng tuần
   * CHỈ cập nhật claimed_at cho reward đã được tạo sẵn
   * @param {number} userId 
   * @returns {Promise<{success: boolean, reward: number, gems: number}>}
   */
  static async claimWeeklyReward(userId) {
    // Kiểm tra điều kiện
    const checkResult = await this.checkWeeklyReward(userId);
    if (!checkResult.canClaim) {
      throw new Error(checkResult.message || 'Không thể nhận thưởng tuần này!');
    }

    // Bắt đầu transaction
    const connection = await db.beginTransaction();
    
    try {
      // Lấy reward pending
      const pendingReward = await db.transactionQuery(
        connection,
        `SELECT * FROM weekly_reward_claims 
         WHERE user_id = ? AND claimed_at IS NULL
         ORDER BY week_start_date DESC
         LIMIT 1`,
        [userId]
      );
      
      if (pendingReward.length === 0) {
        throw new Error('Không tìm thấy phần thưởng tuần để nhận');
      }

      const reward = pendingReward[0];
      
      // Cập nhật gems (COALESCE để xử lý NULL)
      await db.transactionQuery(
        connection,
        'UPDATE User SET gems = COALESCE(gems, 0) + ? WHERE user_id = ?',
        [reward.gems_received, userId]
      );

      // Cập nhật claimed_at = NOW()
      await db.transactionQuery(
        connection,
        `UPDATE weekly_reward_claims 
         SET claimed_at = UTC_TIMESTAMP()
         WHERE claim_id = ?`,
        [reward.claim_id]
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
        reward: reward.gems_received,
        gems: userResult[0].gems,
        weekStartDate: reward.week_start_date,
        message: `Chúc mừng! Bạn đã nhận ${reward.gems_received} gems cho tuần này!`
      };
    } catch (error) {
      await db.rollback(connection);
      throw error;
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
