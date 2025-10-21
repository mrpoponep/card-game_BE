import express from "express";
import { getRoomList } from "../controller/ListRoomsController.js";

const router = express.Router();

// 🌟 ROUTE MỚI
// GET /api/room/list
// GET /api/room/list?type=private
router.get("/list", getRoomList);

export default router;