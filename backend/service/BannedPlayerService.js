// Server/services/BannedPlayerService.js
import db from '../model/DatabaseConnection.js';
import BannedPlayer from '../model/BannedPlayer.js';

class BannedPlayerService {
  /**
   * Tạo report mới -> trigger trong DB sẽ tự tăng violation_count + auto ban nếu đủ 3 lần
   */
  static async createReport({ reportedId, reason, chatHistory }) {
    const bp = new BannedPlayer({
      reported_id: reportedId,
      reason,
      chat_history: chatHistory || null
    });

    const saved = await bp.save();

    // Lấy thông tin user sau khi trigger chạy
    const users = await db.query(
      'SELECT user_id, username, banned, violation_count FROM User WHERE user_id = ?',
      [reportedId]
    );
    const user = users && users[0] ? users[0] : null;

    return { report: saved, user };
  }

  static async getReportById(reportId) {
    return await BannedPlayer.findById(reportId);
  }

  static async getReportsByUser(reportedId, limit = 50) {
    return await BannedPlayer.findByReportedId(reportedId, limit);
  }

  static async listAllReports({ limit = 100, offset = 0 } = {}) {
    return await BannedPlayer.listAll(limit, offset);
  }

  static async deleteReport(reportId) {
    return await BannedPlayer.removeById(reportId);
  }
}

export default BannedPlayerService;
