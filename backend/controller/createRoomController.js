import { createTableConfig } from "../model/TableConfig.js";
import { createGame } from "../model/Game.js";
import { assignSeat } from "../model/Seat.js";
import pool from "../config/db.js";

export const createGameRoom = async (req, res) => {
    const client = await pool.connect();
    try {
        const { user_id, game_type, min_bet, max_players, small_blind, big_blind } = req.body;

        await client.query("BEGIN");

        const tableConfigId = await createTableConfig(game_type, min_bet, max_players, small_blind, big_blind);
        const game = await createGame(tableConfigId, user_id);
        await assignSeat(game.id, user_id, 1);

        await client.query("COMMIT");

        res.status(201).json({
            message: "Phòng đã được tạo thành công!",
            game: {
                id: game.id,
                table_config_id: tableConfigId,
                created_by: user_id,
                status: "waiting"
            }
        });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ Lỗi khi tạo phòng:", err);
        res.status(500).json({ error: "Lỗi khi tạo phòng!" });
    } finally {
        client.release();
    }
};
