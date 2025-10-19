// service/ReportService.js
import Report from '../model/Report.js';

/**
 * Report Service - Business logic cho Report system
 */
class ReportService {
  /**
   * Tạo report mới với validation
   */
  static async createReport({ reported_id, type, reason }) {
    try {
      // Tạo report
      const report = new Report({
        reported_id,
        type,
        reason
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
