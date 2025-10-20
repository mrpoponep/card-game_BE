// Server/backend/route/findRoomRoute.js
import express from "express";
import { findRoom } from "../controller/findRoomController.js";

const router = express.Router();

// 🔹 SỬA LẠI ĐƯỜNG DẪN Ở ĐÂY
// Thêm '/find' để khớp với API call từ client
router.get("/find/:code", findRoom);

export default router;