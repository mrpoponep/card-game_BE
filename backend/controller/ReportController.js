// controller/ReportController.js
import ReportService from '../service/ReportService.js';
import { getUserChatHistoryJSON } from '../socket/chatService.js';
import ChatModerationAIService from '../service/ChatModerationAIService.js'; // Import thêm service AI
import db from '../model/DatabaseConnection.js';
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

      // 3. Lưu vào DB (Bảng Report)
      const newReport = new Report({
          reporter_id,
          reported_id,
          type,
          reason,
          chat_history,
          ai_analysis: aiAnalysis,
          ai_verdict: aiVerdict
      });
      await newReport.save();

      // 4. LOGIC MỚI: Chỉ cộng violation_count nếu AI xác nhận vi phạm
      if (aiVerdict === 'violation_detected') {
          // Cộng điểm vi phạm
          await db.query(
              'UPDATE User SET violation_count = violation_count + 1 WHERE user_id = ?',
              [reported_id]
          );

          // Kiểm tra để Ban user (nếu >= 3 lần)
          const userRows = await db.query('SELECT violation_count FROM User WHERE user_id = ?', [reported_id]);
          if (userRows[0] && userRows[0].violation_count >= 3) {
              await db.query('UPDATE User SET banned = 1 WHERE user_id = ?', [reported_id]);
              console.log(`User ${reported_id} has been AUTO BANNED.`);
          }
      }

      return res.status(201).json({
        success: true,
        message: 'Report created',
        data: newReport,
        ai_result: aiVerdict
      });

    } catch (error) {
      console.error('Error creating report:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default ReportController;
