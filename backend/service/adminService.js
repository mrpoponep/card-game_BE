import User from '../model/User.js';
import { getOnlineCount } from '../socket/socketManager.js';
import Transaction from '../model/Transaction.js';
import GameHistory from '../model/GameHistory.js';

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
    const stats = await Transaction.getCoinStats(startDate, endDate); 
    return stats;
  }

  /**
   * - activePlayersInPeriod: Số người chơi duy nhất có giao dịch trong khoảng thời gian
   */
  static async getPlayerStats(startDate, endDate) {
    const activePlayersInPeriod = await Transaction.getActivePlayersByTx(startDate, endDate);
    
    // Get other stats (these don't depend on the date range)
    const totalRegistered = await User.getTotalCount(); 
    const totalBanned = await User.getTotalBannedCount(); 
    const currentlyOnline = getOnlineCount(); 

    // ✅ RETURN THE UPDATED STRUCTURE
    return {
      totalRegistered: totalRegistered,    
      totalBanned: totalBanned,      
      currentlyOnline: currentlyOnline,   
      activePlayersInPeriod: activePlayersInPeriod 
      // activeByWin is removed
    };
  }
  // Tổng người chơi active trong kỳ (đếm DISTINCT theo giao dịch)
  static async getTotalActivePlayers(startDate, endDate) {
    return await Transaction.getActivePlayersByTx(startDate, endDate);
  }

  // Lấy tổng số ván chơi trong khoảng thời gian
  static async getTotalGames(startDate, endDate) {
    const totalGames = await GameHistory.getTotalGames(startDate, endDate);
    return totalGames;
  }

  // Timeseries: coin
  static async getCoinSeries(startDate, endDate) {
    return await Transaction.getCoinSeries(startDate, endDate);
  }

  // Timeseries: người chơi active theo giao dịch
  static async getActivePlayersSeries(startDate, endDate) {
    return await Transaction.getActivePlayersSeries(startDate, endDate);
  }

  // Timeseries: ván chơi
  static async getMatchesSeries(startDate, endDate) {
    return await GameHistory.getMatchesSeries(startDate, endDate);
  }
  /**
 * Timeseries: Số bàn hoạt động (có ván chơi) theo ngày
 */
  static async getActiveTablesSeries(startDate, endDate) {
    return await GameHistory.getActiveTablesSeries(startDate, endDate);
  }

  static async getTotalActiveTables(startDate, endDate) {
    return await GameHistory.getTotalActiveTables(startDate, endDate);
  }
}
  export default AdminService;