import express from 'express';
import { createGameRoom, findRoom } from '../controller/roomController.js';

const router = express.Router();

// Create room (requires auth)
// POST /api/room
router.post('/', createGameRoom);

// Find/join room (requires auth)
// GET /api/room/:code
router.get('/:code', findRoom);

export default router;
