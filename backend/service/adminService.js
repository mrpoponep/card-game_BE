import User from '../model/User.js';
import { getOnlineCount } from '../socket/socketManager.js';

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
}
  export default AdminService;