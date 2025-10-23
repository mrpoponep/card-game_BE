// models/Transaction.js
import db from './DatabaseConnection.js';

class Transaction {

  /**
   * Lấy các thống kê Coin (volume, count, avg) trong khoảng thời gian
   * @param {string} startDate - Định dạng 'YYYY-MM-DD HH:MM:SS'
   * @param {string} endDate - Định dạng 'YYYY-MM-DD HH:MM:SS'
   * @returns {Promise<object>} Object chứa totalVolume, transactionCount, averageTransaction
   */
  static async getCoinStats(startDate, endDate) {
    const sql = `
      SELECT 
        SUM(ABS(amount)) AS totalVolume,  -- Tính tổng giá trị tuyệt đối (cả nạp/rút/thắng/thua)
        COUNT(tx_id) AS transactionCount,
        AVG(ABS(amount)) AS averageTransaction 
      FROM Transactions 
      WHERE time BETWEEN ? AND ? 
    `;
    try {
      // Thêm giờ phút giây để bao gồm cả ngày cuối cùng
      const startDateTime = `${startDate} 00:00:00`;
      const endDateTime = `${endDate} 23:59:59`;
      
      const rows = await db.query(sql, [startDateTime, endDateTime]);
      
      // Kết quả trả về từ DB có thể là null nếu không có giao dịch nào
      const stats = rows[0];
      return {
          totalVolume: parseFloat(stats.totalVolume) || 0, // Chuyển sang số, mặc định 0
          transactionCount: parseInt(stats.transactionCount) || 0, // Chuyển sang số, mặc định 0
          averageTransaction: parseFloat(stats.averageTransaction) || 0 // Chuyển sang số, mặc định 0
      };
    } catch (error) {
      console.error('❌ Lỗi khi lấy thống kê coin:', error);
      throw error;
    }
  }

/**
   * Đếm số người chơi duy nhất có giao dịch trong khoảng thời gian
   * @param {string} startDate - 'YYYY-MM-DD HH:MM:SS'
   * @param {string} endDate - 'YYYY-MM-DD HH:MM:SS'
   * @returns {Promise<number>} Số lượng người chơi duy nhất
   */
  static async getActivePlayersByTx(startDate, endDate) {
    // Đếm distinct user_id và source_id (loại bỏ NULL)
    const sql = `
      SELECT COUNT(DISTINCT player_id) AS activeCount
      FROM (
          SELECT user_id AS player_id FROM Transactions WHERE time BETWEEN ? AND ? AND user_id IS NOT NULL
          UNION
          SELECT source_id AS player_id FROM Transactions WHERE time BETWEEN ? AND ? AND source_id IS NOT NULL
      ) AS distinct_players;
    `;
    try {
      const startDateTime = `${startDate} 00:00:00`;
      const endDateTime = `${endDate} 23:59:59`;
      // Cần truyền ngày tháng 2 lần vì UNION
      const rows = await db.query(sql, [startDateTime, endDateTime, startDateTime, endDateTime]);
      return parseInt(rows[0].activeCount) || 0;
    } catch (error) {
      console.error('❌ Lỗi khi đếm người chơi hoạt động (GD):', error);
      throw error;
    }
  }
}

export default Transaction;