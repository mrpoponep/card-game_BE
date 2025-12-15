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
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ["GET", "POST"],
    credentials: true
  }
});

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access_secret';
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 10) || 30;
const RESET_PASSWORD_TOKEN_EXPIRES_MINUTES = parseInt(process.env.RESET_PASSWORD_TOKEN_EXPIRES_MINUTES, 10) || 15;
const ADMIN_CONTACT_EMAIL = process.env.ADMIN_CONTACT_EMAIL || 'admin@example.com';


// Attach socket services (auth middleware + per-service handlers)
attachSocketServices(io);
initSocketManager(io);

// Export io instance for use in other services
export { io };

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Poker Server running on port ${PORT}`);

  console.log('--- ⚙️ THÔNG TIN CẤU HÌNH SERVER ---');
  console.log(`[APP] PORT: ${PORT}`);
  console.log(`[CORS] CLIENT_URL: ${process.env.CLIENT_URL || "http://localhost:3000"}`);
  console.log(`[DB] DB_HOST: ${process.env.DB_HOST}`);
  console.log(`[DB] DB_NAME: ${process.env.DB_NAME}`);

  console.log('\n--- 🔑 CẤU HÌNH BẢO MẬT/TOKEN ---');
  console.log(`[TOKEN] ACCESS_TOKEN_SECRET: ${ACCESS_TOKEN_SECRET}`);
  console.log(`[TOKEN] ACCESS_TOKEN_EXPIRES_IN: ${ACCESS_TOKEN_EXPIRES_IN}`);
  console.log(`[TOKEN] REFRESH_TOKEN_EXPIRES_DAYS: ${REFRESH_TOKEN_EXPIRES_DAYS} ngày`);

  console.log('\n--- ✉️ CẤU HÌNH EMAIL & ADMIN ---');
  console.log(`[EMAIL] SERVICE: ${process.env.EMAIL_SERVICE}`);
  console.log(`[EMAIL] USER (FROM): ${process.env.EMAIL_USER}`);
  console.log(`[RESET] EXPIRES_MINUTES: ${RESET_PASSWORD_TOKEN_EXPIRES_MINUTES} phút`);
  console.log(`[ADMIN] CONTACT_EMAIL: ${ADMIN_CONTACT_EMAIL}`);
  console.log('-------------------------------------\n');

  // Initialize reward distribution scheduler
  console.log('\n🎁 Khởi tạo hệ thống phân phối phần thưởng...');
  try {
    // Khởi động scheduler (tự động catch-up + chạy theo lịch)
    // Truyền io instance để có thể gửi notifications
    RewardDistributionService.startScheduler(io);
    
    console.log('✅ Hệ thống phân phối phần thưởng đã được khởi tạo thành công');
  } catch (error) {
    console.error('❌ Không thể khởi tạo hệ thống phân phối phần thưởng:', error.message);
  }
});