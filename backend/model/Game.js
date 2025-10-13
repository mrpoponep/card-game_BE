import pool from "../config/db.js";

export const createGame = async (table_config_id, created_by) => {
    const result = await pool.query(
        `INSERT INTO games (table_config_id, created_by, status)
     VALUES ($1, $2, 'waiting') RETURNING id, created_at`,
        [table_config_id, created_by]
    );
    return result.rows[0];
};
