import ReportService from '../service/ReportService.js';
import { getUserChatHistoryJSON } from '../socket/chatService.js';
import ChatModerationAIService from '../service/ChatModerationAIService.js';
import Report from '../model/Report.js';

class ReportController {
  
  // API: Lấy danh sách báo cáo
  static async listReports(req, res) {
    try {
      const reports = await Report.listAll(100, 0);
      return res.json({ success: true, data: reports });
    } catch (error) {
      console.error('List reports error:', error);
      return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }

  // API: Tạo báo cáo
  static async createReport(req, res) {
    try {
      const { reporter_id, reported_id, type, reason, roomCode } = req.body;

      if (!reporter_id || !reported_id || !type || !reason) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin' });
      }

      // 1. Lấy chat history
      let chat_history = null;
      let chatHistoryArray = [];
      if (roomCode) {
        chat_history = getUserChatHistoryJSON(roomCode, reported_id);
        if (chat_history && chat_history !== '[]') {
            try { chatHistoryArray = JSON.parse(chat_history); } catch (e) {}
        } else {
            chat_history = null;
        }
      }

      // 2. AI Phân tích
      let aiAnalysis = null; 
      let aiVerdict = 'pending';

      if (chatHistoryArray.length > 0) {
          try {
              const aiResult = await ChatModerationAIService.analyzeConversation(chatHistoryArray);
              const violations = aiResult.violations || [];
              
              if (violations.length > 0) {
                  aiVerdict = 'violation_detected';
                  aiAnalysis = violations.map(v => 
                      `[${v.severity === 3 ? 'HIGH' : 'LOW'}] ${v.offensive_words.join(', ')}: ${v.explanation}`
                  ).join('\n');
              } else {
                  aiVerdict = 'clean';
                  aiAnalysis = "AI found no violations.";
              }
          } catch (aiError) {
              console.error("AI Error:", aiError);
              aiVerdict = 'error';
              aiAnalysis = "AI service error.";
          }
      } else {
          aiVerdict = 'clean';
          aiAnalysis = "No chat history.";
      }

      // 3. Gọi Service
      const result = await ReportService.createReport({
          reporter_id, reported_id, type, reason, 
          chat_history, 
          ai_analysis: aiAnalysis, 
          ai_verdict: aiVerdict
      });

      return res.status(201).json({
        success: true,
        message: 'Report created',
        data: result.report,
        ai_result: aiVerdict
      });

    } catch (error) {
      console.error('Error creating report:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // API: Cập nhật verdict (Admin sửa)
  static async updateVerdict(req, res) {
    try {
        const { reportId } = req.params;
        const { verdict } = req.body; 

        if (!['violation_detected', 'clean', 'pending'].includes(verdict)) {
            return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
        }

        await ReportService.updateReportVerdict(reportId, verdict);
        
        return res.json({ success: true, message: 'Đã cập nhật đánh giá và tính lại trạng thái người chơi' });
    } catch (error) {
        console.error('Update verdict error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
  }

  // API: Xóa báo cáo
  static async deleteReport(req, res) {
    try {
      const { reportId } = req.params;
      const db = (await import('../model/DatabaseConnection.js')).default;

      // Xóa trong bảng Report
      const result = await db.query('DELETE FROM Report WHERE report_id = ?', [reportId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo để xóa' });
      }

      return res.json({ success: true, message: 'Đã xóa báo cáo thành công' });
    } catch (error) {
      console.error('Delete report error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default ReportController;
