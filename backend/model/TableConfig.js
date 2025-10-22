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
  // 🔹 Tạo room_code duy nhất
  let room_code;
  do {
    room_code = generateRoomCode();
  } while (await isRoomCodeExists(room_code));

  // 🔹 Thực hiện insert
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

  // 🔹 🔹 🔹 SỬA LỖI Ở ĐÂY 🔹 🔹 🔹
  // Lấy TOÀN BỘ thông tin bàn vừa tạo, thay vì chỉ 3 trường
  const rows = await db.query(
    `SELECT * FROM table_info WHERE table_id = ?`, // Dùng SELECT *
    [result.insertId]
  );

  return rows[0]; // Trả về object đầy đủ (sẽ bao gồm max_players)
};