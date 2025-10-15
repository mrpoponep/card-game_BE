import express from "express";
import createGameRoom from "./route/createRoomRoute.js";
import findRoomRoute from "./route/findRoomRoute.js";
import cors from 'cors';
const app = express();

app.use(cors());
app.use(express.json());

// Route chính cho games
app.use("/api/room", createGameRoom);
app.use("/api/room", findRoomRoute);

app.listen(3000, () => console.log("✅ Poker API đang chạy trên cổng 3000"));
