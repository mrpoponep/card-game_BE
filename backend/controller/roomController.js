import { createTable } from "../model/TableConfig.js";
import User from "../model/User.js";
import db from "../model/DatabaseConnection.js";

// Combined controller for Room: create and find
export const createGameRoom = async (req, res) => {
  try {
    const {
      small_blind,
      max_players,
    } = req.body;

    // Lấy user_id từ access token nếu có
    const user_id = req.user?.user_id || req.user?.userId || req.body?.user_id;

    if (!user_id || !small_blind || !max_players) {
      return res.status(400).json({ message: "Thiếu thông tin tạo phòng." });
    }

    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng." });

    const min_buy_in = small_blind * 10;
    if (user.balance < min_buy_in) {
      return res.status(403).json({ message: `Bạn không đủ tiền. Cần ít nhất ${min_buy_in.toLocaleString()} (10x mức cược).` });
    }

    const tableConfig = {
      min_players: 2,
      max_players: max_players,
      small_blind: small_blind,
      max_blind: small_blind * 2,
      min_buy_in: min_buy_in,
      max_buy_in: small_blind * 100,
      rake: 0.05,
      is_private: false,
      created_by: user_id
    };

    const table = await createTable(
      tableConfig.min_players,
      tableConfig.max_players,
      tableConfig.small_blind,
      tableConfig.max_blind,
      tableConfig.min_buy_in,
      tableConfig.max_buy_in,
      tableConfig.rake,
      tableConfig.is_private,
      tableConfig.created_by
    );

    res.status(201).json({ message: "Phòng đã được tạo thành công!", table, room_code: table.room_code });
  } catch (err) {
    console.error('❌ Lỗi tạo phòng:', err);
    res.status(500).json({ message: err.message || 'Lỗi tạo phòng!' });
  }
};

export const findRoom = async (req, res) => {
  const { code } = req.params;
  const userId = req.user?.user_id || req.user?.userId || req.query?.userId;

  try {
    const rows = await db.query("SELECT * FROM table_info WHERE room_code = ?", [code]);
    if (!rows || rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy phòng!' });

    const room = rows[0];
    if (!userId) return res.status(400).json({ message: 'Thiếu ID người dùng.' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });

    if (user.balance < room.min_buy_in) {
      return res.status(403).json({ message: `Bạn không đủ tiền. Phòng này yêu cầu ít nhất ${room.min_buy_in.toLocaleString()}.` });
    }

    res.json(room);
  } catch (err) {
    console.error('❌ Lỗi khi tìm phòng:', err);
    res.status(500).json({ message: err.message || 'Lỗi khi tìm phòng!' });
  }
};

export default {
  createGameRoom,
  findRoom
};
