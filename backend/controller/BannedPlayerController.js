// Server/controllers/BannedPlayerController.js
import BannedPlayerService from '../service/BannedPlayerService.js';

class BannedPlayerController {
  // POST /api/ban/banned-players
  static async create(req, res) {
    try {
      const { reportedId, reason, chatHistory } = req.body;

      if (!reportedId || !reason) {
        return res.status(400).json({
          message: 'reportedId và reason là bắt buộc'
        });
      }

      const result = await BannedPlayerService.createReport({
        reportedId,
        reason,
        chatHistory
      });

      return res.status(201).json({
        message: 'Đã ghi nhận báo cáo vi phạm',
        report: result.report.toJSON(),
        user: result.user // chứa banned + violation_count sau trigger
      });
    } catch (err) {
      console.error('Error create banned report:', err);
      return res.status(500).json({ message: 'Lỗi server khi tạo báo cáo.' });
    }
  }

  // GET /api/ban/banned-players
  static async list(req, res) {
    try {
      const limit = Number(req.query.limit) || 100;
      const offset = Number(req.query.offset) || 0;

      const reports = await BannedPlayerService.listAllReports({ limit, offset });
      return res.json(reports.map(r => r.toJSON()));
    } catch (err) {
      console.error('Error list banned reports:', err);
      return res.status(500).json({ message: 'Lỗi server khi lấy danh sách báo cáo.' });
    }
  }

  // GET /api/ban/banned-players/:reportId
  static async getById(req, res) {
    try {
      const { reportId } = req.params;
      const report = await BannedPlayerService.getReportById(reportId);

      if (!report) {
        return res.status(404).json({ message: 'Không tìm thấy báo cáo.' });
      }

      return res.json(report.toJSON());
    } catch (err) {
      console.error('Error get report by id:', err);
      return res.status(500).json({ message: 'Lỗi server.' });
    }
  }

  // GET /api/ban/banned-players/user/:userId
  static async getByUser(req, res) {
    try {
      const { userId } = req.params;
      const limit = Number(req.query.limit) || 50;

      const reports = await BannedPlayerService.getReportsByUser(
        userId,
        limit
      );
      return res.json(reports.map(r => r.toJSON()));
    } catch (err) {
      console.error('Error get reports by user:', err);
      return res.status(500).json({ message: 'Lỗi server.' });
    }
  }

  // DELETE /api/ban/banned-players/:reportId
  static async remove(req, res) {
    try {
      const { reportId } = req.params;
      const deleted = await BannedPlayerService.deleteReport(reportId);

      if (!deleted) {
        return res.status(404).json({ message: 'Không tìm thấy báo cáo để xóa.' });
      }

      return res.json({ message: 'Đã xóa báo cáo.', deletedRows: deleted });
    } catch (err) {
      console.error('Error delete report:', err);
      return res.status(500).json({ message: 'Lỗi server khi xóa báo cáo.' });
    }
  }
}

export default BannedPlayerController;
