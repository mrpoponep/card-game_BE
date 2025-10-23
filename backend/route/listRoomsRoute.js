import express from "express";
import { getRoomList, getTableMetrics } from "../controller/ListRoomsController.js";

const router = express.Router();

// 🌟 ROUTE MỚI
// GET /api/room/list
// GET /api/room/list?type=private
router.get("/list", getRoomList);
// GET /api/room/table-metrics
router.get("/table-metrics", getTableMetrics);

export default router;