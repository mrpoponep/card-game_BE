// route/tableRoutes.js
import express from 'express';
import {
    getPublicTables,
    joinTable,
    createTable
} from '../controller/tableController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/tables/list
 * @desc    Lấy danh sách bàn public
 * @query   level=beginner|amateur|pro|master|all (optional)
 * @access  Public
 */
router.get('/list', getPublicTables);

/**
 * @route   POST /api/tables/join
 * @desc    Tham gia bàn chơi
 * @body    { roomCode, buyInAmount }
 * @access  Private (JWT required)
 */
router.post('/join', authenticateJWT, joinTable);

/**
 * @route   POST /api/tables/create
 * @desc    Tạo bàn chơi mới
 * @body    { level, maxPlayers }
 * @access  Private (JWT required)
 */
router.post('/create', authenticateJWT, createTable);

export default router;
