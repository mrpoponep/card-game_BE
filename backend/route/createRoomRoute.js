import express from "express";
import { createGameRoom } from "../controller/createRoomController.js";

const router = express.Router();

router.post("/create", createGameRoom);

export default router;
