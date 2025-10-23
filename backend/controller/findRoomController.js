// ✅ findRoomController.js
import db from "../model/DatabaseConnection.js";

export const findRoom = async (req, res) => {
    const { code } = req.params;
    try {
        const rows = await db.query(
            "SELECT * FROM table_info WHERE room_code = ?",
            [code]
        );

        if (!rows || rows.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy phòng!" });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error("❌ Lỗi khi tìm phòng:", err);
        res.status(500).json({ error: "Lỗi khi tìm phòng!" });
    }
};
