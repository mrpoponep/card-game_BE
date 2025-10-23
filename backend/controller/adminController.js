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
}

export default AdminController;