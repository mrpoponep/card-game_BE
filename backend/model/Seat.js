import pool from "../config/db.js";

export const assignSeat = async (game_id, user_id, seat_number = 1) => {
    await pool.query(
        `INSERT INTO seats (game_id, user_id, seat_number)
     VALUES ($1, $2, $3)`,
        [game_id, user_id, seat_number]
    );
};
