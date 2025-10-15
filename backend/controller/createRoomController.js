
import { createTable } from "../model/TableConfig.js";
import pool from "../config/db.js";

export const createGameRoom = async (req, res) => {
    try {
        const {
            min_players,
            max_players,
            small_blind,
            max_blind,
            min_buy_in,
            max_buy_in,
            rake,
            is_private,
            user_id
        } = req.body;

        // Tạo bàn mới
        const table = await createTable(
            min_players,
            max_players,
            small_blind,
            max_blind,
            min_buy_in,
            max_buy_in,
            rake,
            is_private,
            user_id
        );

        res.status(201).json({
            message: "Phòng đã được tạo thành công!",
            table
        });
    } catch (err) {
        console.error("❌ Lỗi tạo phòng:", err);
        res.status(500).json({ error: "Lỗi tạo phòng!" });
    }
};
