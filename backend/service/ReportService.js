// service/ReportService.js
import Report from '../model/Report.js';

/**
 * Report Service - Business logic cho Report system
 */
class ReportService {
  /**
   * Tạo report mới với validation
   * @param {Object} params - Report parameters
   * @param {number} params.reporter_id - ID của người báo cáo
   * @param {number} params.reported_id - ID của người bị báo cáo
   * @param {string} params.type - Loại báo cáo
   * @param {string} params.reason - Lý do báo cáo
   * @param {string} [params.chat_history] - Lịch sử chat của người bị báo cáo (JSON string)
   */
  static async createReport({ reporter_id, reported_id, type, reason, chat_history = null }) {
    try {
      // Tạo report
      const report = new Report({
        reporter_id,
        reported_id,
        type,
        reason,
        chat_history
      });

      await report.save();

      return {
        success: true,
        report: report.toJSON(),
        message: 'Report created successfully'
      };
    } catch (error) {
      throw new Error(`Failed to create report: ${error.message}`);
    }
  }
}

export default ReportService;
