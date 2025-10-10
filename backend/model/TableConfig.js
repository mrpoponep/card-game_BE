import pool from "../config/db.js";

export const createTableConfig = async (game_type, min_bet, max_players, small_blind, big_blind) => {
    const result = await pool.query(
        `INSERT INTO table_configs (game_type, min_bet, max_players, small_blind, big_blind)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [game_type, min_bet, max_players, small_blind, big_blind]
    );
    return result.rows[0].id;
};
