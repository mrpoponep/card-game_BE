// service/LuckyWheelService.js
import db from '../model/DatabaseConnection.js';

class LuckyWheelService {
  // Cấu hình giải thưởng (phải giống với frontend)
  static PRIZES = [
    { amount: 1000, probability: 30 },
    { amount: 2000, probability: 20 },
    { amount: 3000, probability: 15 },
    { amount: 5000, probability: 12 },
    { amount: 10000, probability: 10 },
    { amount: 20000, probability: 7 },
    { amount: 50000, probability: 5 },
    { amount: 100000, probability: 1 }  // Jackpot
  ];

  static COST_PER_SPIN = 100;

  /**
   * Chọn ngẫu nhiên giải thưởng theo tỷ lệ
   */
  static selectPrize() {
    const totalProbability = this.PRIZES.reduce((sum, prize) => sum + prize.probability, 0);
    let random = Math.random() * totalProbability;

    for (const prize of this.PRIZES) {
      random -= prize.probability;
      if (random <= 0) {
        return prize.amount;
      }
    }

    // Fallback (không bao giờ xảy ra)
    return this.PRIZES[0].amount;
  }

  /**
   * Quay vòng quay may mắn
   */
  static async spin(userId, multiplier) {
    const totalCost = this.COST_PER_SPIN * multiplier;

    // Kiểm tra số gems
    const userResult = await db.query(
      'SELECT gems, balance FROM User WHERE user_id = ?',
      [userId]
    );

    if (userResult.length === 0) {
      throw new Error('Không tìm thấy người dùng');
    }

    const currentGems = userResult[0].gems;
    const currentBalance = userResult[0].balance;

    if (currentGems < totalCost) {
      throw new Error('Không đủ gems để quay!');
    }

    // Bắt đầu transaction
    const connection = await db.beginTransaction();

    try {
      await connection.beginTransaction();

      // Chọn giải thưởng cho mỗi lần quay
      let totalWin = 0;
      const prizes = [];
      const prizeBreakdown = {}; // Đếm số lần trúng từng giải

      for (let i = 0; i < multiplier; i++) {
        const prizeAmount = this.selectPrize();
        prizes.push(prizeAmount);
        totalWin += prizeAmount;
        
        // Đếm số lần trúng
        prizeBreakdown[prizeAmount] = (prizeBreakdown[prizeAmount] || 0) + 1;
      }

      // Lấy 1 giải ngẫu nhiên từ danh sách để hiển thị trên vòng quay
      const displayPrize = prizes[Math.floor(Math.random() * prizes.length)];

      // Trừ gems
      await connection.query(
        'UPDATE User SET gems = gems - ? WHERE user_id = ?',
        [totalCost, userId]
      );

      // Lưu lịch sử
      await connection.query(
        `INSERT INTO lucky_wheel_history 
        (user_id, multiplier, gems_spent, prize_amount, total_win)
        VALUES (?, ?, ?, ?, ?)`,
        [userId, multiplier, totalCost, displayPrize, totalWin]
      );

      // Thêm transaction để cộng tiền thưởng (trigger sẽ tự động cập nhật balance)
      await connection.query(
        `INSERT INTO Transactions (user_id, amount, reason, source)
        VALUES (?, ?, ?, ?)`,
        [userId, totalWin, `Trúng thưởng vòng quay x${multiplier}`, 'lucky_wheel']
      );

      // Lấy số dư mới
      const newUserResult = await connection.query(
        'SELECT gems, balance FROM User WHERE user_id = ?',
        [userId]
      );

      await db.commit(connection);

      return {
        prizeAmount: displayPrize,
        totalWin: totalWin,
        multiplier: multiplier,
        newGems: newUserResult[0].gems,
        newBalance: newUserResult[0].balance,
        prizes: prizes, // Danh sách tất cả các giải (nếu cần)
        prizeBreakdown: prizeBreakdown // Thống kê số lần trúng từng giải
      };
    } catch (error) {
      await db.rollback(connection);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Lấy lịch sử quay
   */
  static async getHistory(userId, limit = 20) {
    // Đảm bảo limit là số nguyên an toàn
    const limitNum = Math.max(1, Math.min(parseInt(limit) || 20, 1000));
    
    // Sử dụng string interpolation cho LIMIT vì một số driver MySQL không hỗ trợ placeholder cho LIMIT
    const history = await db.query(
      `SELECT multiplier, gems_spent, prize_amount, total_win, spin_time
       FROM lucky_wheel_history
       WHERE user_id = ?
       ORDER BY spin_time DESC
       LIMIT ${limitNum}`,
      [userId]
    );

    return history;
  }

  /**
   * Lấy thống kê
   */
  static async getStats(userId) {
    const stats = await db.query(
      `SELECT 
        COUNT(*) as total_spins,
        SUM(multiplier) as total_times,
        SUM(gems_spent) as total_spent,
        SUM(total_win) as total_won,
        MAX(prize_amount) as highest_prize
       FROM lucky_wheel_history
       WHERE user_id = ?`,
      [userId]
    );

    return stats[0] || {
      total_spins: 0,
      total_times: 0,
      total_spent: 0,
      total_won: 0,
      highest_prize: 0
    };
  }

  /**
   * Lấy gems hiện tại của user
   */
  static async getUserGems(userId) {
    const userResult = await db.query(
      'SELECT gems FROM User WHERE user_id = ?',
      [userId]
    );

    if (userResult.length === 0) {
      throw new Error('Không tìm thấy người dùng');
    }

    return userResult[0].gems || 0;
  }
}

export default LuckyWheelService;
