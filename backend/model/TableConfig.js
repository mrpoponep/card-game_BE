import pool from "../config/db.js";

// Hàm tạo bàn poker mới
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
    const result = await pool.query(
        `INSERT INTO table_info (
        min_players, max_players, small_blind, max_blind,
        min_buy_in, max_buy_in, rake, is_private, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING table_id, room_code, status, created_at`,
        [
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

    return result.rows[0]; // trả về thông tin bàn vừa tạo
};
