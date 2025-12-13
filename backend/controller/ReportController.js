// controller/ReportController.js
import ReportService from '../service/ReportService.js';
import { getUserChatHistoryJSON } from '../socket/chatService.js';

/**
 * Report Controller - Xử lý các request liên quan đến báo cáo người chơi
 */
class ReportController {
  /**
   * Tạo report mới
   */
  static async createReport(req, res) {
    try {
      const { reporter_id, reported_id, type, reason, roomCode } = req.body;

      // Validate input
      if (!reporter_id || !reported_id || !type || !reason) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: reporter_id, reported_id, type, and reason are required'
        });
      }

      // Get chat history for the reported player if roomCode is provided
      let chat_history = null;
      if (roomCode) {
        chat_history = getUserChatHistoryJSON(roomCode, reported_id);
        // If empty array, set to null
        if (chat_history === '[]') {
          chat_history = null;
        }
      }

      // Sử dụng ReportService để tạo report
      const result = await ReportService.createReport({
        reporter_id,
        reported_id,
        type,
        reason,
        chat_history
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
