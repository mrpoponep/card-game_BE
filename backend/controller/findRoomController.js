import pool from "../config/db.js";

export const findRoom = async (req, res) => {
    const { code } = req.params;
    try {
        const result = await pool.query(
            "SELECT * FROM table_info WHERE room_code = $1",
            [code]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy phòng!" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("❌ Lỗi khi tìm phòng:", err);
        res.status(500).json({ error: "Lỗi khi tìm phòng!" });
    }
};
