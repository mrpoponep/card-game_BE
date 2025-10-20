// Server/backend/controller/findRoomController.js
import db from "../model/DatabaseConnection.js";
import User from "../model/User.js"; // 🔹 1. IMPORT USER MODEL

export const findRoom = async (req, res) => {
  const { code } = req.params;
  const { userId } = req.query; // 🔹 2. LẤY userId TỪ QUERY

  try {
    // 🔹 3. LẤY THÔNG TIN PHÒNG
    const rows = await db.query(
      "SELECT * FROM table_info WHERE room_code = ?",
      [code]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy phòng!" });
    }

    const room = rows[0];

    // 🔹 4. KIỂM TRA SỐ DƯ NGƯỜI VÀO
    if (!userId) {
      return res.status(400).json({ message: "Thiếu ID người dùng." });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    // 🔹 5. SO SÁNH TIỀN
    if (user.balance < room.min_buy_in) {
      return res.status(403).json({ // 403 Forbidden
        message: `Bạn không đủ tiền. Phòng này yêu cầu ít nhất ${room.min_buy_in.toLocaleString()}.`
      });
    }

    // 🔹 6. TRẢ VỀ THÔNG TIN PHÒNG NẾU ĐỦ TIỀN
    res.json(room);
  } catch (err) {
    console.error("❌ Lỗi khi tìm phòng:", err);
    res.status(500).json({ message: err.message || "Lỗi khi tìm phòng!" });
  }
};
