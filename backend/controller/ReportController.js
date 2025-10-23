// controller/ReportController.js
import ReportService from '../service/ReportService.js';

/**
 * Report Controller - Xử lý các request liên quan đến báo cáo người chơi
 */
class ReportController {
  /**
   * Tạo report mới
   */
  static async createReport(req, res) {
    try {
      const { reported_id, type, reason } = req.body;

      // Validate input
      if (!reported_id || !type || !reason) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: reported_id, type, and reason are required'
        });
      }

      // Sử dụng ReportService để tạo report
      const result = await ReportService.createReport({
        reported_id,
        type,
        reason
      });

      return res.status(201).json({
        success: true,
        message: result.message,
        data: result.report
      });
    } catch (error) {
      console.error('Error creating report:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create report',
        error: error.message
      });
    }
  }
}

export default ReportController;
