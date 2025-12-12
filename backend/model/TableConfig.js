import db from './DatabaseConnection.js';

// 🧩 Hàm sinh mã phòng ngẫu nhiên 4 ký tự (0000–9999)
const generateRoomCode = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

const isRoomCodeExists = async (code) => {
  const rows = await db.query(
    'SELECT COUNT(*) AS count FROM table_info WHERE room_code = ?',
    [code]
  );
  if (!rows || rows.length === 0) return false; // ✅ tránh lỗi undefined
  return rows[0].count > 0;
};


// 🧩 Hàm tạo bàn poker mới
export const createTable = async (
  min_players,
  max_players,
  small_blind,
  max_blind,
  min_buy_in,
  max_buy_in,
  rake,
  is_private,
  created_by
) => {
  // Tạo room_code duy nhất
  let room_code;
  do {
    room_code = generateRoomCode();
  } while (await isRoomCodeExists(room_code));

  // Thực hiện insert
  const result = await db.query(
    `INSERT INTO table_info (
    room_code, min_players, max_players, small_blind, max_blind,
    min_buy_in, max_buy_in, rake, is_private, created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      room_code,
      min_players,
      max_players,
      small_blind,
      max_blind,
      min_buy_in,
      max_buy_in,
      rake,
      is_private,
      created_by,
    ]
  );

  // Lấy TOÀN BỘ thông tin bàn vừa tạo, thay vì chỉ 3 trường
  const rows = await db.query(
    `SELECT * FROM table_info WHERE table_id = ?`, // Dùng SELECT *
    [result.insertId]
  );

  return rows[0]; // Trả về object đầy đủ (sẽ bao gồm max_players)
};

// 🧩 Lấy tất cả bàn public
export const getAllPublicTables = async () => {
  const rows = await db.query(
    `SELECT 
      t.*,
      0 as current_players
     FROM Table_Info t
     WHERE is_private = FALSE 
     ORDER BY created_at DESC`
  );
  return rows || [];
};

// 🧩 Lấy bàn theo range buy-in (cho filter level)
export const getTablesByBuyInRange = async (minBuyIn, maxBuyIn) => {
  const rows = await db.query(
    `SELECT 
      t.*,
      0 as current_players
     FROM Table_Info t
     WHERE is_private = FALSE 
     AND min_buy_in BETWEEN ? AND ?
     ORDER BY min_buy_in ASC`,
    [minBuyIn, maxBuyIn]
  );
  return rows || [];
};

// 🧩 Lấy bàn theo room code
export const getByRoomCode = async (roomCode) => {
  const rows = await db.query(
    `SELECT 
      t.*,
      0 as current_players
     FROM Table_Info t
     WHERE t.room_code = ?`,
    [roomCode]
  );
  return rows && rows.length > 0 ? rows[0] : null;
};

// 🧩 Tạo bàn mới (wrapper cho createTable)
export const create = async (tableData) => {
  const {
    room_code,
    min_players,
    max_players,
    small_blind,
    max_blind,
    min_buy_in,
    max_buy_in,
    rake,
    is_private,
    created_by
  } = tableData;

  const result = await db.query(
    `INSERT INTO Table_Info (
            room_code, min_players, max_players, small_blind, max_blind,
            min_buy_in, max_buy_in, rake, is_private, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?)`,
    [
      room_code,
      min_players,
      max_players,
      small_blind,
      max_blind,
      min_buy_in,
      max_buy_in,
      rake,
      is_private,
      created_by
    ]
  );

  return result.insertId;
};

// 🧩 Cập nhật số người chơi hiện tại
export const updatePlayerCount = async (tableId, playerCount) => {
  await db.query(
    `UPDATE Table_Info SET current_players = ? WHERE table_id = ?`,
    [playerCount, tableId]
  );
};

// 🧩 Cập nhật trạng thái bàn
export const updateStatus = async (tableId, status) => {
  await db.query(
    `UPDATE Table_Info SET status = ? WHERE table_id = ?`,
    [status, tableId]
  );
};

export default {
  createTable,
  getAllPublicTables,
  getTablesByBuyInRange,
  getByRoomCode,
  create,
  updatePlayerCount,
  updateStatus
};
