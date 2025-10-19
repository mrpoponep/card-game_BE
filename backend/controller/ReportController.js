// controller/ReportController.js
import Report from '../model/Report.js';

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

      // Tạo report mới
      const report = new Report({
        reported_id,
        type,
        reason
      });

      await report.save();

      return res.status(201).json({
        success: true,
        message: 'Report created successfully',
        data: report.toJSON()
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
