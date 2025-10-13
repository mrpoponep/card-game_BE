import http from 'http';
import { Server } from 'socket.io';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import createGameRoom from './route/createRoomRoute.js';
import app from './app.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

// Khởi tạo Express app nếu chưa có
const expressApp = app || express();

// CORS middleware
expressApp.use(cors());
expressApp.use(express.json());

// REST API Routes - PostgreSQL integration
expressApp.use("/api/room", createGameRoom);

// Create HTTP server
const server = http.createServer(expressApp);

// Initialize Socket.io for real-time features
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔗 User connected:', socket.id);

  // Join room
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`👤 User ${socket.id} joined room ${roomId}`);
    socket.to(roomId).emit('userJoined', socket.id);
  });

  // Leave room
  socket.on('leaveRoom', (roomId) => {
    socket.leave(roomId);
    console.log(`👋 User ${socket.id} left room ${roomId}`);
    socket.to(roomId).emit('userLeft', socket.id);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Poker Server running on port ${PORT}`);
  console.log(`📡 Socket.io enabled for real-time features`);
  console.log(`🎮 REST API available at /api/room`);
});
