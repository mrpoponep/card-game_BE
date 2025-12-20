import ListRoomService, { updateTableById } from "../service/ListRoomService.js";
import db from '../model/DatabaseConnection.js';
/**
 * 🌟 API Handler: Lấy danh sách các phòng
 * Query param: ?type=private (default là public)
 */
export async function getRoomList(req, res) {
  const type = (req.query.type || "public").toLowerCase();
  const isPrivate = type === "private";
  const rows = await ListRoomService.getTableList(isPrivate);

  const tables = rows.map(r => ({
    table_id: r.table_id,
    room_code: r.room_code,
    min_players: r.min_players,
    max_players: r.max_players,
    small_blind: r.small_blind,
    max_blind: r.max_blind,
    min_buy_in: r.min_buy_in,
    max_buy_in: r.max_buy_in,
    rake: Number(r.rake),
    visibility: r.is_private ? "private" : "public",
    status: r.status,
    created_by: r.created_by,
  }));
  return res.json({ success: true, tables });
}

// GET detail 1 bàn
export async function getTableById(req, res) {
  const id = Number(req.params.id);
  const rows = await db.query("SELECT * FROM Table_Info WHERE table_id = ?", [id]);
  return rows?.[0]
    ? res.json({ success: true, table: rows[0] })
    : res.status(404).json({ success: false, message: "Không tìm thấy bàn" });
}

// GET metrics
export async function getTableMetrics(req, res) {
  const metrics = await ListRoomService.getMetrics();
  return res.json({ success: true, ...metrics });
}

// PATCH update 1 bàn
export const updateTable = async (req, res) => {
  try {
    const tableId = Number(req.params.id);
    if (!tableId || Number.isNaN(tableId)) {
      return res.status(400).json({ success: false, message: 'tableId không hợp lệ.' });
    }

    // (khuyến nghị) validate nhẹ để tránh cấu hình sai
    const p = req.body || {};
    if (p.min_players && p.max_players && Number(p.min_players) > Number(p.max_players)) {
      return res.status(400).json({ success: false, message: 'min_players phải ≤ max_players.' });
    }
    if (p.small_blind && p.max_blind && Number(p.small_blind) > Number(p.max_blind)) {
      return res.status(400).json({ success: false, message: 'small_blind phải ≤ max_blind.' });
    }
    if (p.min_buy_in && p.max_buy_in && Number(p.min_buy_in) > Number(p.max_buy_in)) {
      return res.status(400).json({ success: false, message: 'min_buy_in phải ≤ max_buy_in.' });
    }

    const result = await updateTableById(tableId, p);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bàn hoặc không có gì để cập nhật.' });
    }

    const rows = await db.query(`SELECT * FROM Table_Info WHERE table_id = ?`, [tableId]);
    return res.json({ success: true, table: rows?.[0] || null });
  } catch (err) {
    console.error('updateTable error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật bàn.' });
  }
};