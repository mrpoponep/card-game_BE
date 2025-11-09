import express from "express";
import { getRoomList, getTableMetrics, updateTable, getTableById } from "../controller/ListRoomsController.js";

const router = express.Router();

// Middleware nhỏ kiểm tra Admin
function requireAdmin(req, res, next) {
  if (req.user?.role === 'Admin') return next();
  return res.status(403).json({ success: false, message: 'Forbidden' });
}

// GET /api/listRoom/list
// GET /api/listRoom/list?type=private
router.get("/list",requireAdmin, getRoomList);
// GET /api/listRoom/table-metrics
router.get("/table-metrics",requireAdmin, getTableMetrics);
// PATCH /api/listRoom/table/:id  (body: các field cho phép)
router.patch("/table/:id", requireAdmin, updateTable);

router.get("/table/:id", requireAdmin, getTableById);

export default router;