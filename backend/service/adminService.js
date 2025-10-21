import User from '../model/User.js';

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
}
  export default AdminService;