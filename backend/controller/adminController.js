import AdminService from "../service/adminService.js";

class AdminController {
/**
   * 🌟 API Handler: Lấy tổng số người chơi
   */
  static async getTotalPlayers(req, res) {
    try {
      // Gọi service
      const total = await AdminService.getTotalPlayers();

      // Trả về JSON
      res.json({
        success: true,
        totalPlayers: total
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  //số người dùng bị banned
  static async getTotalBannedPlayers(req, res) {
    try {
      // Gọi service
    const totalBanned = await AdminService.getTotalBannedPlayers();
    // Trả về JSON
    res.json({
        success: true,
        totalBannedPlayers: totalBanned
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // lấy số lượng người chơi trực tuyến
  static async getOnlinePlayers(req, res) {
    try {
      // Gọi service
      const total = await AdminService.getOnlinePlayers();
      
      res.json({
        success: true,
        onlinePlayers: total
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
   // Lấy thống kê Coin
  static async getCoinStats(req, res) {
    // Lấy 'from' và 'to' từ query parameters
    const { from, to } = req.query; 

    // Kiểm tra tính hợp lệ của ngày (ví dụ đơn giản)
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Vui lòng cung cấp ngày bắt đầu (from) và kết thúc (to) hợp lệ theo định dạng YYYY-MM-DD.' 
        });
    }

    try {
      // Gọi service với ngày đã nhận
      const stats = await AdminService.getCoinStats(from, to);
      
      // Trả về kết quả
      res.json({
        success: true,
        stats: stats // Trả về object { totalVolume: ..., transactionCount: ..., ... }
      });
    } catch (error) {
      console.error('API Error getCoinStats:', error); // Log lỗi chi tiết hơn
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy thống kê coin.' // Thông báo lỗi chung chung hơn
      });
    }
  }

  /**
   * 🌟 API Handler MỚI 🌟
   * Lấy thống kê Người chơi hoạt động
   * Query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD
   */
  static async getPlayerStats(req, res) {
    const { from, to } = req.query;

    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ngày bắt đầu (from) và kết thúc (to) hợp lệ theo định dạng YYYY-MM-DD.'
      });
    }

    try {
      const stats = await AdminService.getPlayerStats(from, to);
      res.json({
        success: true,
        stats: stats // Trả về object { totalRegistered: ..., activeByTx: ..., ... }
      });
    } catch (error) {
      console.error('API Error getPlayerStats:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy thống kê người chơi.'
      });
    }
  }
}

export default AdminController;