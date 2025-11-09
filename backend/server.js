// Load environment variables FIRST
import './config/dotenv-config.js';

import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { initSocketManager } from './socket/socketManager.js';
import RewardDistributionService from './service/RewardDistributionService.js';
import attachSocketServices from './socket/index.js';

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Attach socket services (auth middleware + per-service handlers)
attachSocketServices(io);
initSocketManager(io);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Poker Server running on port ${PORT}`);

  // Initialize reward distribution scheduler
  console.log('\n🎁 Khởi tạo hệ thống phân phối phần thưởng...');
  try {
    // Khởi động scheduler (tự động catch-up + chạy theo lịch)
    RewardDistributionService.startScheduler();
    
    console.log('✅ Hệ thống phân phối phần thưởng đã được khởi tạo thành công');
  } catch (error) {
    console.error('❌ Không thể khởi tạo hệ thống phân phối phần thưởng:', error.message);
  }
});
