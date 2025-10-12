const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for both Express and Socket.io
app.use(cors({
  origin: "http://localhost:5173", // Vite default port
  credentials: true
}));

const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 8000;

// Basic middleware
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Card Game Server is running on port ' + PORT });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  // Add your game logic here
  socket.on('join-game', (data) => {
    console.log('User joining game:', data);
    socket.emit('game-joined', { success: true, playerId: socket.id });
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});