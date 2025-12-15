// Server/controllers/UserController.js
import db from '../model/DatabaseConnection.js';

class UserController {
  // GET /api/user/:userId/violation-count
  static async getViolationCount(req, res) {
    try {
      const { userId } = req.params;
      const users = await db.query(
        'SELECT violation_count FROM User WHERE user_id = ?',
        [userId]
      );
      if (!users || !users[0]) {
        return res.status(404).json({ message: 'Không tìm thấy user.' });
      }
      return res.json({ userId, violation_count: users[0].violation_count });
    } catch (err) {
      console.error('Error get violation_count:', err);
      return res.status(500).json({ message: 'Lỗi server.' });
    }
  }

  // POST /api/user/upload-avatar
  static async uploadAvatar(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Không có file được tải lên.' });
      }
      const userId = req.user.userId; // Giả sử userId được lấy từ token đã xác thực
      const avatarPath = "/uploads/avatars/" + userId + ".png"; // Đường dẫn lưu avatar

      // Lưu file đã tải lên vào thư mục server
      const fs = await import('fs');
      fs.writeFileSync(`./public/avatar/${userId}.png`, req.file.buffer);

      return res.json({ message: 'Tải lên avatar thành công.', avatarUrl: avatarPath });
    } catch (err) {
      console.error('Error upload avatar:', err);
      return res.status(500).json({ message: 'Lỗi server.' });
    }
  }

  // GET /api/user/get-game-history
  // Query params: page (1-based), limit
  static async getGameHistory(req, res) {
    try {
      const userId = req.user?.userId || req.user?.user_id;
      if (!userId) return res.status(400).json({ success: false, message: 'Missing user context' });

      const page = parseInt(req.query.page || '1', 10) || 1;
      const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
      const offset = (page - 1) * limit;

      // Find Game_History rows where the result string contains this user id as a whole token
      const likePattern = `% ${userId} %`;
      // Note: some MySQL drivers have issues binding LIMIT/OFFSET as params.
      // Safely inject numeric limit/offset after validation to avoid mysqld_stmt_execute errors.
      const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : 50;
      const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0;
      const sql = `
        SELECT game_id, table_id, time, result, elo_change
        FROM Game_History
        WHERE CONCAT(' ', IFNULL(result,''), ' ') LIKE ?
        ORDER BY time DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset}
      `;

      const rows = await db.query(sql, [likePattern]);

      // Collect all user ids referenced in the returned rows
      const idSet = new Set();
      const parsed = rows.map(r => {
        const resultIds = (r.result || '').toString().trim().split(/\s+/).filter(Boolean);
        const eloArr = (r.elo_change || '').toString().trim().split(/\s+/).filter(Boolean);
        resultIds.forEach(id => idSet.add(id));
        return {
          game_id: r.game_id,
          table_id: r.table_id,
          time: r.time,
          result_ids: resultIds,
          elo_changes: eloArr
        };
      });

      // Fetch usernames for all referenced ids in one query
      let userMap = {};
      if (idSet.size > 0) {
        const ids = Array.from(idSet);
        // Build placeholders
        const placeholders = ids.map(() => '?').join(',');
        const users = await db.query(`SELECT user_id, username FROM User WHERE user_id IN (${placeholders})`, ids);
        users.forEach(u => { userMap[u.user_id] = u.username; });
      }

      // Attach usernames preserving order
      const result = parsed.map(p => ({
        game_id: p.game_id,
        table_id: p.table_id,
        time: p.time,
        result_ids: p.result_ids,
        result_usernames: p.result_ids.map(id => userMap[id] || null),
        elo_changes: p.elo_changes
      }));

      return res.json({ success: true, page, limit, data: result });
    } catch (err) {
      console.error('Error getGameHistory:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }
}
export default UserController;
