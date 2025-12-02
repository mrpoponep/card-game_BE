// Server/controllers/AIReportController.js
import ChatModerationAIService from '../service/ChatModerationAIService.js';
import BannedPlayerService from '../service/BannedPlayerService.js';

class AIReportController {
  /**
   * POST /api/ban/ai/analyze-and-save
   * Body:
   * {
   *   "reportedId": 2,
   *   "conversation": [
   *     { "timestamp": "2025-11-26 10:05:14", "player": "Alice", "text": "dm mày chơi ngu vcl" },
   *     { "timestamp": "2025-11-26 10:05:18", "player": "Bob",   "text": "..." }
   *   ]
   * }
   */
  static async analyzeAndSave(req, res) {
    try {
      const { reportedId, conversation } = req.body;

      if (!reportedId || !Array.isArray(conversation) || conversation.length === 0) {
        return res.status(400).json({
          message: 'reportedId và conversation (array) là bắt buộc',
        });
      }

      // 1. Gửi log chat sang AI
      const aiResult = await ChatModerationAIService.analyzeConversation(conversation);
      const violations = Array.isArray(aiResult.violations) ? aiResult.violations : [];

      if (violations.length === 0) {
        // Không có chửi bậy → không lưu report, chỉ trả về
        return res.status(200).json({
          message: 'Không phát hiện vi phạm trong đoạn hội thoại.',
          violations: [],
        });
      }

      // 2. Build reason + chat_history để lưu vào DB
      const reasonLines = violations.map((v, idx) => {
        const sevLabel =
          v.severity === 3 ? 'HIGH' :
          v.severity === 2 ? 'MEDIUM' :
          'LOW';

        return `#${idx + 1} [${sevLabel}] ${v.player} (${v.language}) - offensive_words: ${v.offensive_words?.join(', ') || '[]'} | explanation: ${v.explanation}`;
      });

      const reason =
        `AI detected ${violations.length} violation(s) in conversation.\n` +
        reasonLines.join('\n');

      const chatLines = conversation.map(m => `[${m.timestamp}] ${m.player}: ${m.text}`);
      const chatHistory = chatLines.join('\n');

      // 3. Lưu vào Banned_Player qua service (trigger trong DB sẽ tự cộng violation_count + ban nếu >=3)
      const { report, user } = await BannedPlayerService.createReport({
        reportedId,
        reason,
        chatHistory,
      });

      return res.status(201).json({
        message: 'AI đã phân tích và lưu báo cáo vi phạm.',
        violations,
        report: report.toJSON(),
        user, // chứa banned + violation_count sau trigger
      });
    } catch (err) {
      console.error('Error in AIReportController.analyzeAndSave:', err);
      return res.status(500).json({
        message: 'Lỗi server khi AI phân tích và lưu báo cáo.',
      });
    }
  }
}

export default AIReportController;
