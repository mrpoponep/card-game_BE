// Server/backend/service/ReportService.js
import Report from '../model/Report.js';
import db from '../model/DatabaseConnection.js';

class ReportService {
  
  /**
   * Tạo report mới và tính lại trạng thái user
   */
  static async createReport({ reporter_id, reported_id, type, reason, chat_history, ai_analysis, ai_verdict }) {
    try {
      // 1. Lưu report
      const report = new Report({
        reporter_id, reported_id, type, reason, chat_history, ai_analysis, ai_verdict
      });
      await report.save();

      // 2. Tính lại trạng thái user ngay lập tức
      await this.recalculateUserStatus(reported_id);

      return { success: true, report: report.toJSON(), message: 'Report created successfully' };
    } catch (error) {
      throw new Error(`Failed to create report: ${error.message}`);
    }
  }

  /**
   * Cập nhật đánh giá (Verdict) và tính lại trạng thái user
   */
  static async updateReportVerdict(reportId, newVerdict) {
    try {
      // 1. Lấy thông tin report cũ để biết ai là người bị báo cáo
      const rows = await db.query('SELECT reported_id FROM Report WHERE report_id = ?', [reportId]);
      if (rows.length === 0) throw new Error('Report not found');
      
      const userId = rows[0].reported_id;

      // 2. Cập nhật verdict mới
      await db.query('UPDATE Report SET ai_verdict = ? WHERE report_id = ?', [newVerdict, reportId]);

      // 3. Tính lại trạng thái user dựa trên dữ liệu mới
      await this.recalculateUserStatus(userId);

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to update report: ${error.message}`);
    }
  }

  static async recalculateUserStatus(userId) {
    // Sử dụng transaction để đảm bảo nhất quán
    const connection = await db.beginTransaction();
    try {
      // 1. Đếm số lỗi vi phạm (violation_detected) trong 1 THÁNG gần nhất
      const countResult = await db.transactionQuery(connection, `
        SELECT COUNT(*) as count 
        FROM Report 
        WHERE reported_id = ? 
          AND ai_verdict = 'violation_detected' 
          AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
      `, [userId]);

      const violationCount = countResult[0].count;
      const shouldBan = violationCount >= 3;

      // 2. Cập nhật vào bảng User
      await db.transactionQuery(connection, `
        UPDATE User 
        SET violation_count = ?, 
            banned = ? 
        WHERE user_id = ?
      `, [violationCount, shouldBan, userId]);

      await db.commit(connection);
      
      console.log(`User ${userId} recalculated: Count=${violationCount}, Banned=${shouldBan}`);
      return { violationCount, banned: shouldBan };
    } catch (error) {
      await db.rollback(connection);
      console.error('Error recalculating user status:', error);
    }
  }
}

export default ReportService;