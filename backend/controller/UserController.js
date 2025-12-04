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
}

export default UserController;
