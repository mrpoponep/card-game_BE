import express from 'express';
import cors from 'cors';
import path from 'path'; // 🔹 THÊM DÒNG NÀY
import { fileURLToPath } from 'url'; // 🔹 THÊM DÒNG NÀY

// Import routes
import rankingRoute from './route/RankingRoute.js';
import createGameRoom from './route/createRoomRoute.js';
import findRoomRoute from "./route/findRoomRoute.js";
import authRoute from './route/authRoute.js'; // 🔹 THÊM DÒNG NÀY

const app = express();

// 🔹 Cấu hình __dirname cho ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure CORS for Express
app.use(cors({
  origin: "http://localhost:5173", // Vite default port
  credentials: true
}));

// Basic middleware
app.use(express.json());               // Cho JSON data
app.use(express.urlencoded({ extended: true })); // Cho form-urlencoded

// 🔹 Phục vụ file tĩnh (cho avatars)
// __dirname đang là /Server/backend
// chúng ta cần đi lùi 1 cấp ra /Server, rồi vào /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// 🔍 Request & Response logger middleware
// ... (giữ nguyên middleware logger của bạn) ...
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
app.use('/api', rankingRoute);
app.use('/api/auth', authRoute); // 🔹 THÊM DÒNG NÀY

// REST API Routes - PostgreSQL integration
app.use("/api/room", createGameRoom);
app.use("/api/room", findRoomRoute);

export default app;
