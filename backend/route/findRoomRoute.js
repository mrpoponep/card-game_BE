import express from "express";
import { findRoom } from "../controller/findRoomController.js";

const router = express.Router();

router.get("/:code", findRoom);

export default router;
