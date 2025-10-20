import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import app from './app.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// 🔹 1. BIẾN QUẢN LÝ TRẠNG THÁI PHÒNG
// Sẽ lưu: { "roomCode": [ {socketId: "...", user: {...}}, ... ] }
const roomState = {};

// 🔹 2. HÀM HELPER ĐỂ GỬI CẬP NHẬT
const sendPlayerListUpdate = (roomCode) => {
  if (roomState[roomCode]) {
    // Chỉ gửi danh sách user, không gửi socketId
    const playerList = roomState[roomCode].map(p => p.user);
    io.to(roomCode).emit('updatePlayerList', playerList);
    console.log(`Sent update to room ${roomCode}:`, playerList.map(u => u.username));
  }
};

// 🔹 3. HÀM HELPER XỬ LÝ KHI RỜI PHÒNG
const handleLeaveRoom = (socket) => {
  console.log(`👋 User left: ${socket.id}`);
  let roomCodeToUpdate = null;

  // Tìm socket này trong tất cả các phòng
  for (const roomCode in roomState) {
    const playerIndex = roomState[roomCode].findIndex(p => p.socketId === socket.id);

    if (playerIndex > -1) {
      // Tìm thấy, xóa user khỏi mảng
      roomState[roomCode].splice(playerIndex, 1);
      roomCodeToUpdate = roomCode;

      // Nếu phòng trống, xóa phòng
      if (roomState[roomCode].length === 0) {
        delete roomState[roomCode];
        console.log(`Room ${roomCode} is now empty and deleted.`);
      }
      break;
    }
  }

  // Gửi cập nhật cho những người còn lại
  if (roomCodeToUpdate) {
    sendPlayerListUpdate(roomCodeToUpdate);
  }
};

// 🔹 4. LOGIC SOCKET.IO CHÍNH
io.on('connection', (socket) => {
  console.log(`🔗 User connected: ${socket.id}`);

  // SỬA LẠI 'joinRoom'
  // Bây giờ chúng ta nhận { roomCode, user } từ client
  socket.on('joinRoom', ({ roomCode, user }) => {
    if (!user) return; // An toàn

    socket.join(roomCode);

    // Thêm user vào trạng thái
    if (!roomState[roomCode]) {
      roomState[roomCode] = [];
    }
    // Tránh thêm trùng lặp
    if (!roomState[roomCode].some(p => p.user.user_id === user.user_id)) {
      roomState[roomCode].push({ socketId: socket.id, user });
      console.log(`👤 User ${user.username} (Socket: ${socket.id}) joined room ${roomCode}`);
    }

    // Gửi danh sách người chơi mới cho MỌI NGƯỜI trong phòng
    sendPlayerListUpdate(roomCode);
  });

  // SỬA LẠI 'leaveRoom'
  socket.on('leaveRoom', () => {
    handleLeaveRoom(socket);
  });

  // SỬA LẠI 'disconnect'
  socket.on('disconnect', () => {
    handleLeaveRoom(socket); // Logic tương tự như leaveRoom
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Poker Server running on port ${PORT}`);
  console.log(`📡 Socket.io enabled for real-time features`);
  console.log(`🎮 REST API available at /api/room`);
});
