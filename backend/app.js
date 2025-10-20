// Load environment variables FIRST before any other imports
import './config/dotenv-config.js';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authenticateJWT } from './middleware/auth.js';
import rateLimit from 'express-rate-limit';

// Import routes
import rankingRoute from './route/RankingRoute.js';
import createGameRoom from './route/createRoomRoute.js';
import authRoute from './route/AuthRoute.js';
import dailyRewardRoute from './route/DailyRewardRoute.js';
import eloRewardRoute from './route/EloRewardRoute.js';
import weeklyRewardRoute from './route/WeeklyRewardRoute.js';
import monthlyRewardRoute from './route/MonthlyRewardRoute.js';
const app = express();

// Configure CORS for Express
app.use(cors({
  origin: "http://localhost:5173", // Vite default port
  credentials: true
}));

// Basic middleware
app.use(express.json());                        // Cho JSON data
app.use(express.urlencoded({ extended: true })); // Cho form-urlencoded
app.use(cookieParser());

// Rate limit: 100 requests/15 phút mỗi IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Bạn gửi quá nhiều yêu cầu, vui lòng thử lại sau.' }
});
app.use('/api', apiLimiter);

// 🔍 Request & Response logger middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Log request
  console.log('\n' + '='.repeat(60));
  console.log(`📥 REQUEST [${timestamp}] ${req.method} ${req.originalUrl || req.url}`);
  console.log('📍 IP:', req.ip || req.connection.remoteAddress);
  
  if (Object.keys(req.query).length > 0) {
    console.log('🔍 Query:', JSON.stringify(req.query, null, 2));
  }
  
  if (Object.keys(req.params).length > 0) {
    console.log('🎯 Params:', JSON.stringify(req.params, null, 2));
  }
  
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  
  console.log('🔗 Headers:', {
    'content-type': req.headers['content-type'],
    'user-agent': req.headers['user-agent'],
    'origin': req.headers.origin
  });
  
  // Hook vào response để log khi hoàn thành
  const originalSend = res.send;
  let responseBody = null;
  
  res.send = function(data) {
    responseBody = data;
    return originalSend.call(this, data);
  };
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusColor = res.statusCode >= 400 ? '🔴' : res.statusCode >= 300 ? '🟡' : '🟢';
    
    console.log('─'.repeat(60));
    console.log(`📤 RESPONSE ${statusColor} Status: ${res.statusCode} | Duration: ${duration}ms`);
    
    if (responseBody) {
      try {
        let bodyObj;
        if (typeof responseBody === 'string') {
          try {
            bodyObj = JSON.parse(responseBody);
          } catch {
            bodyObj = responseBody;
          }
        } else {
          bodyObj = responseBody;
        }
        
        // Format JSON với indentation đẹp
        const formatted = JSON.stringify(bodyObj, null, 2);
        
        // Nếu quá dài (>1000 chars), truncate nhưng vẫn giữ format
        if (formatted.length > 1000) {
          const lines = formatted.split('\n');
          const preview = lines.slice(0, 20).join('\n');
          console.log('📨 Response:');
          console.log(preview);
          console.log(`   ... [truncated ${formatted.length - preview.length} chars, ${lines.length - 20} more lines]`);
        } else {
          console.log('📨 Response:');
          console.log(formatted);
        }
      } catch (e) {
        console.log('📨 Response: [unable to stringify]');
      }
    }
    
    console.log('='.repeat(60) + '\n');
  });
  
  next();
});

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Card Game Server is running' });
});

// API Routes
app.use('/api/auth', authRoute);

// Bảo vệ tất cả các route /api ngoại trừ /api/auth/login, /api/auth/refresh, /api/auth/logout
// Bảo vệ tất cả các route /api ngoại trừ /api/auth/login, /api/auth/refresh, /api/auth/logout
app.use((req, res, next) => {
  const openAuthPaths = [
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/logout',
    '/api/auth/send-reset-otp',
    '/api/auth/verify-otp-reset-password'
  ];
  // Nếu path bắt đầu bằng 1 trong các openAuthPaths thì bỏ qua xác thực
  if (openAuthPaths.some(path => req.path === path || req.path.startsWith(path + '/'))) {
    return next();
  }
  return authenticateJWT(req, res, next);
});

app.use('/api/rankings', rankingRoute);
app.use("/api/room", createGameRoom);
app.use('/api/daily-reward', dailyRewardRoute);
app.use('/api/elo-reward', eloRewardRoute);
app.use('/api/weekly-reward', weeklyRewardRoute);
app.use('/api/monthly-reward', monthlyRewardRoute);

export default app;