import './config/dotenv-config.js';

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { authenticateJWT } from './middleware/auth.js';
import rateLimit from 'express-rate-limit';

import rankingRoute from './route/RankingRoute.js';
import roomRoute from './route/roomRoute.js';
import authRoute from './route/authRoutes.js';
import dailyRewardRoute from './route/DailyRewardRoute.js';
import eloRewardRoute from './route/EloRewardRoute.js';
import weeklyRewardRoute from './route/WeeklyRewardRoute.js';
import monthlyRewardRoute from './route/MonthlyRewardRoute.js';
import luckyWheelRoute from './route/luckyWheelRoute.js';
import paymentRoutes from "./route/paymentRoutes.js";
import adminRoutes from './route/adminRoutes.js'; 
import listRoomsRoute from './route/listRoomsRoute.js';
import bannedPlayerRoute from './route/BannedPlayerRoutes.js';
import aiReportRoutes from './route/AIReportRoutes.js';
import userRoutes from './route/UserRoutes.js';
import reportRoute from './route/ReportRoute.js';
import tableRoutes from './route/tableRoutes.js';
import referralRoute from './route/ReferralRoute.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000", 
  credentials: true
}));

// Chỉ áp dụng body parser cho các route không phải upload-avatar
app.use((req, res, next) => {
  if (req.path === '/api/user/upload-avatar') {
    return next();
  }
  express.json()(req, res, (err) => {
    if (err) return next(err);
    express.urlencoded({ extended: true })(req, res, next);
  });
});
app.use(cookieParser());

const isDev = process.env.NODE_ENV === 'development';

if (!isDev) {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { success: false, message: 'Bạn gửi quá nhiều yêu cầu, vui lòng thử lại sau.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', apiLimiter);
} else {
}

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/avatar/*', (req, res) => {
  const requestedPath = req.params[0]; // Lấy phần sau /avatar/ (không có đuôi)

  const avatarDir = path.join(__dirname, '..', 'public', 'avatar');

  let files;
  try {
    files = fs.readdirSync(avatarDir);
  } catch (error) {
    console.error('Error reading avatar directory:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }

  const matchingFile = files.find(file => file.startsWith(requestedPath + '.'));

  if (matchingFile) {
    const fullPath = path.join(avatarDir, matchingFile);
    return res.sendFile(fullPath);
  } else {
    const defaultPath = path.join(avatarDir, 'default.png');
    if (fs.existsSync(defaultPath)) {
      return res.sendFile(defaultPath);
    } else {
      return res.status(404).json({ success: false, message: 'Avatar not found' });
    }
  }
});

app.use((req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

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

  const originalSend = res.send;
  let responseBody = null;

  res.send = function (data) {
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

        const formatted = JSON.stringify(bodyObj, null, 2);

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

app.get('/', (req, res) => {
  res.json({ message: 'Card Game Server is running' });
});

app.use('/api/auth', authRoute);

app.use((req, res, next) => {
  const openAuthPaths = [
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/send-reset-otp',
    '/api/auth/verify-otp-reset-password',
    '/api/auth/register',  // Cho phép đăng ký
    '/avatar',
    '/api/payment/vnpay_return',  // Chỉ mở callback return từ VNPay
    '/api/payment/vnpay_ipn',     // Chỉ mở IPN webhook từ VNPay
    '/api/referral/track-click',  // Public endpoint referral
    '/api/referral/validate-link', // Public endpoint referral
    '/api/admin',  // Admin routes (Route này tự quản lý auth hoặc devOnly bên trong file adminRoutes)
  ];
  // Nếu path bắt đầu bằng 1 trong các openAuthPaths thì bỏ qua xác thực
  if (openAuthPaths.some(path => req.path === path || req.path.startsWith(path + '/'))) {
    return next();
  }
  return authenticateJWT(req, res, next);
});

app.use('/api/rankings', rankingRoute);
app.use('/api/room', roomRoute);
app.use('/api/daily-reward', dailyRewardRoute);
app.use('/api/elo-reward', eloRewardRoute);
app.use('/api/weekly-reward', weeklyRewardRoute);
app.use('/api/monthly-reward', monthlyRewardRoute);
app.use('/api/lucky-wheel', luckyWheelRoute);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes); // Sử dụng file route đã gộp
app.use('/api/listRoom', listRoomsRoute);
app.use('/api/ban', bannedPlayerRoute);
app.use('/api/ban/ai', authenticateJWT, aiReportRoutes);
app.use('/api/user', userRoutes);
app.use('/api/reports', reportRoute);
app.use('/api/tables', tableRoutes);
app.use('/api/referral', referralRoute);

app.get('/__routes', (req, res) => {
  try {
    const routes = [];
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        // routes registered directly on the app
        routes.push({ path: middleware.route.path, methods: middleware.route.methods });
      } else if (middleware.name === 'router' && middleware.handle && middleware.handle.stack) {
        // router middleware
        middleware.handle.stack.forEach((handler) => {
          if (handler.route) {
            routes.push({ path: handler.route.path, methods: handler.route.methods });
          }
        });
      }
    });
    res.json(routes);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default app;