// service/RewardDistributionService.js
import db from '../model/DatabaseConnection.js';

/**
 * Service để phát thưởng tuần và tháng theo lịch
 */
class RewardDistributionService {
  
  /**
   * Phát thưởng tuần cho tất cả users
   * Gọi vào mỗi thứ 2 hoặc khi server khởi động
   */
  static async distributeWeeklyRewards() {
    let connection = null;
    
    try {
      // Lấy tuần trước (từ thứ 2 đến chủ nhật)
      const lastWeek = this.getLastWeekPeriod();
      const weekIdentifier = this.formatWeekIdentifier(lastWeek.startDate);
      
      // Kiểm tra đã phát thưởng tuần này chưa (trước khi bắt đầu transaction)
      const alreadyDistributed = await db.query(
        `SELECT * FROM reward_distribution_log 
         WHERE reward_type = 'weekly' AND period_identifier = ?`,
        [weekIdentifier]
      );
      
      if (alreadyDistributed.length > 0) {
        return { success: false, message: 'Đã phát thưởng' };
      }
      
      console.log('🎁 Phát thưởng tuần bắt đầu...');

      // Bắt đầu transaction
      connection = await db.beginTransaction();

      // ⚠️ SKIP PHẦN THƯỞNG CŨ CHƯA NHẬN
      const skippedResult = await db.transactionQuery(
        connection,
        `UPDATE weekly_reward_claims 
         SET claimed_at = UTC_TIMESTAMP() 
         WHERE claimed_at IS NULL`
      );
      
      if (skippedResult.affectedRows > 0) {
        console.log(`⏭️ Đã bỏ qua ${skippedResult.affectedRows} phần thưởng tuần chưa nhận từ các kỳ trước`);
      }
      
      // Lấy tất cả users active (không bị ban)
      const users = await db.transactionQuery(
        connection,
        `SELECT user_id, elo FROM User WHERE banned = FALSE`
      );
      
      let totalRewarded = 0;
      let totalGems = 0;
      
      // Phát thưởng cho từng user
      for (const user of users) {
        const { user_id, elo } = user;
        
        // Tìm tier phần thưởng dựa trên ELO
        const rewardConfig = await db.transactionQuery(
          connection,
          `SELECT gems_reward, tier_name 
           FROM weekly_reward_config
           WHERE elo_min <= ? AND (elo_max IS NULL OR elo_max >= ?)
           ORDER BY elo_min DESC
           LIMIT 1`,
          [elo, elo]
        );
        
        if (rewardConfig.length > 0) {
          const { gems_reward, tier_name } = rewardConfig[0];
          
          // Tạo record với claimed_at = NULL (chưa nhận)
          await db.transactionQuery(
            connection,
            `INSERT INTO weekly_reward_claims 
             (user_id, week_start_date, gems_received, elo_at_claim, tier_name, claimed_at)
             VALUES (?, ?, ?, ?, ?, NULL)`,
            [user_id, lastWeek.startDate, gems_reward, elo, tier_name]
          );
          
          totalRewarded++;
          totalGems += gems_reward;
        }
      }
      
      // Commit transaction TRƯỚC KHI gửi notifications
      await db.commit(connection);
      connection = null; // Đánh dấu đã commit để không rollback trong finally
      
      // Log việc phát thưởng (chạy sau commit để không block notifications)
      await db.query(
        `INSERT INTO reward_distribution_log 
         (reward_type, period_identifier, total_users_rewarded, total_gems_distributed)
         VALUES ('weekly', ?, ?, ?)`,
        [weekIdentifier, totalRewarded, totalGems]
      );
      
      console.log(`✅ Phần thưởng tuần ${weekIdentifier} đã được phát: ${totalRewarded} users, tổng ${totalGems} gems`);
      
      // Gửi notification cho tất cả users đang online
      if (this.io) {
        try {
          const { notifyAllUsers } = await import('../socket/index.js');
          notifyAllUsers(this.io, {
            type: 'weekly',
            message: 'Phần thưởng tuần mới đã có! 🎁',
            weekIdentifier
          });
        } catch (error) {
          console.error('⚠️ Không thể gửi notification:', error);
        }
      }
      
      return {
        success: true,
        weekIdentifier,
        totalUsers: totalRewarded,
        totalGems
      };
      
    } catch (error) {
      // Rollback nếu có lỗi
      if (connection) {
        await db.rollback(connection);
      }
      console.error('❌ Lỗi khi phát thưởng tuần:', error);
      throw error;
    } finally {
      // Release connection
      if (connection) {
        connection.release();
      }
    }
  }  /**
   * Phát thưởng tháng cho Top 100
   * Gọi vào ngày 1 hàng tháng hoặc khi server khởi động
   */
  static async distributeMonthlyRewards() {
    let connection = null;
    
    try {
      console.log('🏆 Phát thưởng tháng cho Top 100...');
      
      // Lấy tháng trước
      const lastMonth = this.getLastMonthPeriod();
      const monthIdentifier = lastMonth.monthYear; // Format: YYYY-MM
      
      // Kiểm tra đã phát thưởng tháng này chưa (trước khi bắt đầu transaction)
      const alreadyDistributed = await db.query(
        `SELECT * FROM reward_distribution_log 
         WHERE reward_type = 'monthly' AND period_identifier = ?`,
        [monthIdentifier]
      );
      
      if (alreadyDistributed.length > 0) {
        console.log(`✅ Phần thưởng tháng ${monthIdentifier} đã được phát`);
        return { success: false, message: 'Đã phát thưởng' };
      }
      
      // Bắt đầu transaction
      connection = await db.beginTransaction();
      
      // ⚠️ SKIP PHẦN THƯỞNG CŨ CHƯA NHẬN
      const skippedResult = await db.transactionQuery(
        connection,
        `UPDATE monthly_reward_claims 
         SET claimed_at = UTC_TIMESTAMP() 
         WHERE claimed_at IS NULL`
      );
      
      if (skippedResult.affectedRows > 0) {
        console.log(`⏭️ Đã bỏ qua ${skippedResult.affectedRows} phần thưởng tháng chưa nhận từ các kỳ trước`);
      }
      
      // Lấy TẤT CẢ users (theo ELO DESC, không bị ban)
      const allUsers = await db.transactionQuery(
        connection,
        `SELECT user_id, elo 
         FROM User 
         WHERE banned = FALSE 
         ORDER BY elo DESC`
      );
      
      let totalRewarded = 0;
      let totalGems = 0;
      
      // Tính rank thực tế (xử lý tie - cùng ELO = cùng rank)
      let currentRank = 1;
      let previousElo = null;
      
      // Phát thưởng cho TẤT CẢ users
      for (let i = 0; i < allUsers.length; i++) {
        const { user_id, elo } = allUsers[i];
        
        // Nếu ELO khác với người trước, cập nhật rank
        if (previousElo !== null && elo < previousElo) {
          currentRank = i + 1; // Rank bằng vị trí hiện tại (1-indexed)
        }
        previousElo = elo;
        
        const rank = currentRank;
        
        // Tìm tier phần thưởng dựa trên rank (chỉ Top 100 có gems > 0)
        let gems_reward = 0;
        
        if (rank <= 100) {
          const rewardConfig = await db.transactionQuery(
            connection,
            `SELECT gems_reward 
             FROM monthly_reward_config
             WHERE rank_min <= ? AND rank_max >= ?
             ORDER BY rank_min ASC
             LIMIT 1`,
            [rank, rank]
          );
          
          if (rewardConfig.length > 0) {
            gems_reward = rewardConfig[0].gems_reward;
          }
        }
        
        // Tạo record cho TẤT CẢ users (Top 100 có gems > 0, còn lại gems = 0)
        await db.transactionQuery(
          connection,
          `INSERT INTO monthly_reward_claims 
           (user_id, month_year, rank_at_claim, elo_at_claim, gems_received, claimed_at)
           VALUES (?, ?, ?, ?, ?, NULL)`,
          [user_id, monthIdentifier, rank, elo, gems_reward]
        );
        
        totalRewarded++;
        totalGems += gems_reward;
      }
      
      // Commit transaction TRƯỚC KHI gửi notifications
      await db.commit(connection);
      connection = null; // Đánh dấu đã commit để không rollback trong finally
      
      // Log việc phát thưởng (chạy sau commit)
      await db.query(
        `INSERT INTO reward_distribution_log 
         (reward_type, period_identifier, total_users_rewarded, total_gems_distributed)
         VALUES ('monthly', ?, ?, ?)`,
        [monthIdentifier, totalRewarded, totalGems]
      );
      
      console.log(`✅ Phần thưởng tháng ${monthIdentifier} đã được phát: ${totalRewarded} users, tổng ${totalGems} gems`);
      
      // Gửi notification cho tất cả users đang online
      if (this.io) {
        try {
          const { notifyAllUsers } = await import('../socket/index.js');
          notifyAllUsers(this.io, {
            type: 'monthly',
            message: 'Phần thưởng tháng mới đã có! 🏆',
            monthIdentifier
          });
        } catch (error) {
          console.error('⚠️ Không thể gửi notification:', error);
        }
      }
      
      return {
        success: true,
        monthIdentifier,
        totalUsers: totalRewarded,
        totalGems
      };
      
    } catch (error) {
      // Rollback nếu có lỗi
      if (connection) {
        await db.rollback(connection);
      }
      console.error('❌ Lỗi khi phát thưởng tháng:', error);
      throw error;
    } finally {
      // Release connection
      if (connection) {
        connection.release();
      }
    }
  }
  
  // ==================== HELPER METHODS ====================
  
  /**
   * Lấy thông tin tuần trước (thứ 2 -> chủ nhật)
   */
  static getLastWeekPeriod() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...
    
    // Tính ngày thứ 2 tuần này
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() + daysToMonday);
    thisMonday.setHours(0, 0, 0, 0);
    
    // Tuần trước = thisMonday - 7 ngày
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    
    return {
      startDate: lastMonday.toISOString().split('T')[0], // YYYY-MM-DD
      endDate: lastSunday.toISOString().split('T')[0]
    };
  }
  
  /**
   * Lấy thông tin tháng trước
   */
  static getLastMonthPeriod() {
    const today = new Date();
    const year = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const month = today.getMonth() === 0 ? 12 : today.getMonth();
    const monthYear = `${year}-${String(month).padStart(2, '0')}`;
    
    return { monthYear, year, month };
  }
  
  /**
   * Format week identifier: YYYY-Www (ISO week format)
   */
  static formatWeekIdentifier(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    
    // Tính số tuần trong năm (ISO 8601)
    const firstDayOfYear = new Date(year, 0, 1);
    const daysSinceFirstDay = Math.floor((date - firstDayOfYear) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((daysSinceFirstDay + firstDayOfYear.getDay() + 1) / 7);
    
    return `${year}-W${String(weekNumber).padStart(2, '0')}`;
  }
  
  // ==================== SCHEDULER ====================
  
  /**
   * Khởi động scheduler để phát thưởng tự động theo lịch
   * Gọi từ server.js khi server start
   * Tự động catch-up phát thưởng bị miss khi khởi động
   * @param {Object} io - Socket.IO instance để gửi notifications
   */
  static startScheduler(io) {
    console.log('⏰ Khởi động scheduler phát thưởng tự động...');
    
    // Lưu io instance để dùng trong các hàm distribute
    this.io = io;
    
    // Function để phát thưởng (các hàm distribute đã có logic check bên trong)
    const distributeRewards = async () => {
      try {
        // Gọi trực tiếp, các hàm này sẽ tự check:
        // - Đã phát chưa (reward_distribution_log)
        // - Skip rewards cũ chưa nhận
        // - Tạo rewards mới
        await this.distributeWeeklyRewards();
        await this.distributeMonthlyRewards();
      } catch (error) {
        console.error('❌ Lỗi khi phát thưởng:', error);
      }
    };
    
    // Chạy ngay 1 lần khi start (catch-up nếu bị miss)
    console.log('🔍 Catch-up: Phát thưởng bị miss khi khởi động (nếu có)...\n');
    distributeRewards().then(() => {
      console.log('✅ Hoàn tất catch-up khi khởi động\n');
    });
    
    // Sau đó gọi mỗi 1 giờ
    const checkInterval = 60 * 60 * 1000; // 1 hour
    setInterval(distributeRewards, checkInterval);
    
    console.log('✅ Scheduler đã được khởi động (chạy mỗi 1 giờ)');
    console.log('   - Tự động phát thưởng tuần khi đến kỳ mới');
    console.log('   - Tự động phát thưởng tháng khi đến kỳ mới\n');
  }
}

export default RewardDistributionService;
