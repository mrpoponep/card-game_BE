// services/ListRoomService.js
import { listTables, getTableMetrics } from '../model/TableConfig.js';
import db from '../model/DatabaseConnection.js'; 

class ListRoomService {
  /**
   * Logic lấy danh sách bàn
   */
  static async getTableList(isPrivate) {
    // Gọi thẳng model (vì logic đơn giản)
    return await listTables(isPrivate);
  }

  /**
   * Logic lấy số liệu thống kê bàn
   */
  static async getMetrics() {
    return await getTableMetrics();
  }
}

export default ListRoomService;

export const updateTableById = async (tableId, payload = {}) => {
  const ALLOWED = new Set([
    'min_players','max_players',
    'small_blind','max_blind',
    'min_buy_in','max_buy_in',
    'rake','is_private','status'
  ]);

  const fields = [];
  const values = [];

  for (const [k, v] of Object.entries(payload)) {
    if (!ALLOWED.has(k)) continue;

    let val = v;
    if (val === '') val = null;
    // Ép kiểu số khi cần
    if ([
      'min_players','max_players',
      'small_blind','max_blind',
      'min_buy_in','max_buy_in',
      'rake'
    ].includes(k) && val !== null && val !== undefined) {
      const num = Number(val);
      if (Number.isNaN(num)) continue;
      val = num;
    }
    if (k === 'is_private') {
      // chấp nhận true/false hoặc 0/1
      val = !!Number(val) || val === true;
    }
    if (k === 'status') {
      // chỉ cho phép 'waiting' | 'playing' 
      const ALLOWED_STATUS = new Set(['waiting','playing']);
      if (!ALLOWED_STATUS.has(val)) continue;
    }

    fields.push(`${k} = ?`);
    values.push(val);
  }

  if (fields.length === 0) {
    return { affectedRows: 0 };
  }

  values.push(tableId);

  const sql = `
    UPDATE Table_Info
       SET ${fields.join(', ')}
     WHERE table_id = ?
    LIMIT 1
  `;

  const result = await db.query(sql, values);
  return result; 
};