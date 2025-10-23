// services/ListRoomService.js
import { listTables, getTableMetrics } from '../model/TableConfig.js';
import db from '../model/DatabaseConnection.js'; // Import db nếu cần

class ListRoomService {
  /**
   * 🌟 Logic lấy danh sách bàn
   */
  static async getTableList(isPrivate) {
    // Gọi thẳng model (vì logic đơn giản)
    return await listTables(isPrivate);
  }

  /**
   * 🌟 Logic lấy số liệu thống kê bàn
   */
  static async getMetrics() {
    // Gọi thẳng model (vì logic đơn giản)
    return await getTableMetrics();
  }
}

export default ListRoomService;