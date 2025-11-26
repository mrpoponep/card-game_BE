import AdminService from "../service/adminService.js";

class AdminController {
/**
   * API Handler: Lấy tổng số người chơi
   */
  static async getTotalPlayers(req, res) {
    try {
      const total = await AdminService.getTotalPlayers();
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
    const totalBanned = await AdminService.getTotalBannedPlayers();
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
    const { from, to } = req.query; 

    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Vui lòng cung cấp ngày bắt đầu (from) và kết thúc (to) hợp lệ theo định dạng YYYY-MM-DD.' 
        });
    }

    try {
      const stats = await AdminService.getCoinStats(from, to);
        res.json({
        success: true,
        stats: stats 
      });
    } catch (error) {
      console.error('API Error getCoinStats:', error); 
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy thống kê coin.'
      });
    }
  }

  /**
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
        stats: stats 
      });
    } catch (error) {
      console.error('API Error getPlayerStats:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy thống kê người chơi.'
      });
    }
  }
  // Lấy tổng số ván chơi trong khoảng thời gian
  static async getTotalGames(req, res) {
    const { from, to } = req.query; 
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Vui lòng cung cấp ngày bắt đầu (from) và kết thúc (to) hợp lệ theo định dạng YYYY-MM-DD.' 
        });
    }
    try {
      const totalGames = await AdminService.getTotalGames(from, to);
      res.json({
        success: true,
        totalGames: totalGames 
      });
    }
    catch (error) {
      console.error('API Error getTotalGames:', error); 
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy tổng số ván chơi.' 
      });
    }
  }
  // GET /api/admin/series/coin
  static async getCoinSeries(req, res) {
    const { from, to } = req.query;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ success: false, message: 'from/to YYYY-MM-DD' });
    }
    try {
      const series = await AdminService.getCoinSeries(from, to);
      res.json({ success: true, series });
    } catch (e) {
      console.error('API Error getCoinSeries:', e);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // GET /api/admin/series/active-players
  static async getActivePlayersSeries(req, res) {
    const { from, to } = req.query;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ success: false, message: 'from/to YYYY-MM-DD' });
    }
    try {
      const series = await AdminService.getActivePlayersSeries(from, to);
      res.json({ success: true, series });
    } catch (e) {
      console.error('API Error getActivePlayersSeries:', e);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // GET /api/admin/series/matches
  static async getMatchesSeries(req, res) {
    const { from, to } = req.query;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ success: false, message: 'from/to YYYY-MM-DD' });
    }
    try {
      const series = await AdminService.getMatchesSeries(from, to);
      res.json({ success: true, series });
    } catch (e) {
      console.error('API Error getMatchesSeries:', e);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
  // GET /api/admin/series/table-usage
  static async getActiveTablesSeries(req, res) {
    const { from, to } = req.query;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ success: false, message: 'from/to phải là YYYY-MM-DD' });
    }
    try {
      const series = await AdminService.getActiveTablesSeries(from, to);
      res.json({ success: true, series });
    } catch (e) {
      console.error('API Error getActiveTablesSeries:', e);
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }

  // GET /api/admin/total-active-tables
  static async getTotalActiveTables(req, res) {
    const { from, to } = req.query;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ success: false, message: 'from/to phải là YYYY-MM-DD' });
    }
    try {
      const total = await AdminService.getTotalActiveTables(from, to);
      res.json({ success: true, totalActiveTables: total });
    } catch (e) {
      console.error('API Error getTotalActiveTables:', e);
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }
  //GET /api/admin/total-active-players?from=YYYY-MM-DD&to=YYYY-MM-DD

  static async getTotalActivePlayers(req, res) {
    const { from, to } = req.query;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ success: false, message: 'from/to phải là YYYY-MM-DD' });
    }
    try {
      const total = await AdminService.getTotalActivePlayers(from, to);
      res.json({ success: true, totalActivePlayers: total });
    } catch (e) {
      console.error('API Error getTotalActivePlayers:', e);
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }
}

export default AdminController;