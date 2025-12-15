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
}
export default UserController;
