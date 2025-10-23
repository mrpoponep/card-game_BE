import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

import {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  startGame,
  advanceTurn,
  checkAdvanceStage,
  broadcastGameState,
} from "./poker_game_manager.js";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = 3000;

// ------------------- SOCKET -------------------
io.on("connection", (socket) => {
  console.log(`⚡ ${socket.id} connected`);

  socket.on("room:create", ({ roomName }) => {
    const roomId = createRoom(roomName);
    socket.join(roomId);
    socket.emit("room:info", getRoom(roomId));
  });

  socket.on("room:join", ({ roomId, username }) => {
    const room = joinRoom(roomId, socket.id, username);
    if (!room) return socket.emit("error", { message: "Room not found" });
    socket.join(roomId);
    io.to(roomId).emit("room:info", room);
  });

  socket.on("game:start", ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    startGame(room, io);
  });

  socket.on("game:action", ({ roomId, action, amount }) => {
    const room = getRoom(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.folded) return;

    switch (action) {
      case "fold":
        player.folded = true;
        room.gameState.lastAction = `${player.username} folded`;
        break;
      case "call": {
        const toCall = room.gameState.currentBet - player.betThisRound;
        const actualCall = Math.min(toCall, player.chips);
        player.chips -= actualCall;
        player.betThisRound += actualCall;
        room.gameState.pot += actualCall;
        room.gameState.lastAction = `${player.username} called ${actualCall}`;
        break;
      }
      case "check":
        room.gameState.lastAction = `${player.username} checked`;
        break;
      case "raise": {
        const minRaise = room.gameState.currentBet + room.gameState.minRaise;
        if (amount < minRaise) return;
        const toRaise = Math.min(amount, player.chips);
        player.chips -= toRaise;
        player.betThisRound += toRaise;
        room.gameState.pot += toRaise;
        room.gameState.currentBet = player.betThisRound;
        room.gameState.lastAction = `${player.username} raised ${toRaise}`;
        break;
      }
    }

    advanceTurn(room);
    checkAdvanceStage(room, io);
    broadcastGameState(room, io);
  });

  socket.on("chat:message", ({ roomId, text }) => {
    const room = getRoom(roomId);
    if (!room) return;
    const msg = { from: socket.id.slice(0,5), text, time: new Date().toLocaleTimeString() };
    room.chat.push(msg);
    io.to(roomId).emit("chat:message", msg);
  });

  socket.on("disconnect", () => {
    leaveRoom(socket.id);
  });
});

server.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
