import User from '../model/User.js';
import { getOnlineCount } from '../socket/socketManager.js';
import Transaction from '../model/Transaction.js';

class AdminService {
  static async getTotalPlayers() {
    // Gọi phương thức mới từ model User
    const total = await User.getTotalCount();
    return total;
  }

  //số người dùng bị banned
  static async getTotalBannedPlayers() {
    const totalBanned = await User.getTotalBannedCount();
    return totalBanned;
  }

  // lấy só lượng người chơi trực tuyến
  static async getOnlinePlayers() {
    const count = getOnlineCount(); 
    return count;
  }
  
  // Lấy thống kê Coin theo khoảng thời gian
  static async getCoinStats(startDate, endDate) {
    // Gọi hàm từ model Transaction
    const stats = await Transaction.getCoinStats(startDate, endDate); 
    return stats;
  }

  /**
   * Lấy thống kê Người chơi
   * - activePlayersInPeriod: Số người chơi duy nhất có giao dịch trong khoảng thời gian
   * - Các chỉ số khác là tổng thể hoặc hiện tại
   */
  static async getPlayerStats(startDate, endDate) {
    // ❌ REMOVE THE CALL TO GameHistory
    // const [activeByTx, activeByWin] = await Promise.all([
    //   Transaction.getActivePlayersByTx(startDate, endDate),
    //   GameHistory.getWinningPlayersCount(startDate, endDate)
    // ]);

    // ✅ ONLY CALL Transaction model for period activity
    const activePlayersInPeriod = await Transaction.getActivePlayersByTx(startDate, endDate);
    
    // Get other stats (these don't depend on the date range)
    const totalRegistered = await User.getTotalCount(); 
    const totalBanned = await User.getBannedCount(); 
    const currentlyOnline = getOnlineCount(); 

    // ✅ RETURN THE UPDATED STRUCTURE
    return {
      totalRegistered: totalRegistered,       // Tổng số đăng ký (không bị ban)
      totalBanned: totalBanned,           // Tổng số bị ban
      currentlyOnline: currentlyOnline,     // Đang online ngay lúc này
      activePlayersInPeriod: activePlayersInPeriod // Hoạt động (có giao dịch) trong kỳ
      // activeByWin is removed
    };
  }
}
  export default AdminService;