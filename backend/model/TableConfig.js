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

    return rows[0];
};

//Lấy danh sách bàn
/**
 * 🧩 Lấy danh sách các bàn theo trạng thái public/private
 * @param {boolean} isPrivate - true (lấy bàn private) hoặc false (lấy bàn public)
 * @returns {Promise<Array>} Danh sách các bàn
 */
export const listTables = async (isPrivate = false) => {
    const sql = `
    SELECT table_id, room_code, min_players, max_players, small_blind, max_blind,
           min_buy_in, max_buy_in, rake, is_private, status, created_by
    FROM table_info
    WHERE is_private = ?
    ORDER BY table_id DESC
  `;
  try {
    const rows = await db.query(sql, [isPrivate]);
    return rows;
  } catch (error) {
    console.error('Error fetching table list:', error);
    throw error;
  }
};

export const getTableMetrics = async () => {
    const sql = `
    SELECT 
      COUNT(*) AS totalTables,
      SUM(CASE WHEN is_private = false THEN 1 ELSE 0 END) AS publicTables,
      SUM(CASE WHEN is_private = true THEN 1 ELSE 0 END) AS privateTables,
      SUM(CASE WHEN status = 'playing' THEN 1 ELSE 0 END) AS activeTables
   FROM table_info
  `;
  try {
    const rows = await db.query(sql);
    return rows[0];
  } catch (error) {
    console.error('Error fetching table metrics:', error);
    throw error;
  }
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
