// Server/backend/controller/createRoomController.js
import { createTable } from "../model/TableConfig.js";
import User from "../model/User.js"; // 🔹 1. IMPORT USER MODEL

export const createGameRoom = async (req, res) => {
  try {
    // 🔹 2. NHẬN YÊU CẦU ĐƠN GIẢN TỪ MODAL
    const {
      small_blind, // "Mức cược", vd: 5000
      max_players, // "Số người", vd: 4
      user_id      // ID người tạo
    } = req.body;

    // 🔹 3. KIỂM TRA SỐ DƯ
    if (!user_id || !small_blind || !max_players) {
      return res.status(400).json({ message: "Thiếu thông tin tạo phòng." });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    // 🔹 4. ÁP DỤNG LUẬT: "ít nhất 10 lần mức cược"
    const min_buy_in = small_blind * 10;

    if (user.balance < min_buy_in) {
      return res.status(403).json({ // 403 Forbidden
        message: `Bạn không đủ tiền. Cần ít nhất ${min_buy_in.toLocaleString()} (10x mức cược).`
      });
    }

    // 🔹 5. ÁNH XẠ SANG CẤU HÌNH BÀN ĐẦY ĐỦ
    const tableConfig = {
      min_players: 2,
      max_players: max_players,
      small_blind: small_blind,
      max_blind: small_blind * 2, // Tiêu chuẩn 1bb = 2sb
      min_buy_in: min_buy_in,       // 10x
      max_buy_in: small_blind * 100, // Tiêu chuẩn 100bb
      rake: 0.05, // 5% rake (giữ nguyên từ DB của bạn)
      is_private: false, // Phòng "Chơi với bạn" là công khai
      created_by: user_id
    };

    // 🔹 6. TẠO BÀN
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

    res.status(201).json({
      message: "Phòng đã được tạo thành công!",
      table,
      room_code: table.room_code // Rất quan trọng cho Frontend
    });
  } catch (err) {
    console.error("❌ Lỗi tạo phòng:", err);
    res.status(500).json({ message: err.message || "Lỗi tạo phòng!" });
  }
};