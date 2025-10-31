// models/GameHistory.js
import db from './DatabaseConnection.js';

class GameHistory {

  /**
   * Lấy tổng số ván chơi đã diễn ra trong khoảng thời gian
   * @param {string} startDate - 'YYYY-MM-DD'
   * @param {string} endDate - 'YYYY-MM-DD'
   * @returns {Promise<number>} Tổng số ván chơi
   */
  static async getTotalGames(startDate, endDate) {
    const sql = `
      SELECT COUNT(game_id) AS totalGames
      FROM Game_History
      WHERE time BETWEEN ? AND ?
    `;
    
    try {
      // Đảm bảo bao gồm cả ngày cuối cùng
      const startDateTime = `${startDate} 00:00:00`;
      const endDateTime = `${endDate} 23:59:59`;
      
      const rows = await db.query(sql, [startDateTime, endDateTime]);
      
      return parseInt(rows[0].totalGames) || 0;
    } catch (error) {
      console.error('❌ Lỗi khi đếm tổng số ván chơi:', error);
      throw error;
    }
  }
  // ➕ THÊM vào cuối class GameHistory (giữ nguyên hàm getTotalGames)
  /**
   * Timeseries: số ván chơi theo ngày
   * @returns [{date, totalGames}]
   */
  static async getMatchesSeries(startDate, endDate) {
    const sql = `
      SELECT DATE(time) AS date, COUNT(*) AS totalGames
      FROM Game_History
      WHERE time BETWEEN CONCAT(?, ' 00:00:00') AND CONCAT(?, ' 23:59:59')
      GROUP BY DATE(time)
      ORDER BY DATE(time)
    `;
    const rows = await db.query(sql, [startDate, endDate]);
    return rows.map(r => ({
      date: r.date,
      totalGames: Number(r.totalGames || 0),
    }));
  }
}

export default GameHistory;