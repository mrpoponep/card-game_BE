import jwt from 'jsonwebtoken';
import { isAccessTokenValidForUser } from '../authTokenStore.js';
import User from '../model/User.js';
import * as roomService from './roomService.js';
import * as roomAIService from './roomAiService.js';
import * as chatService from './chatService.js';


const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'youraccesstokensecret';

function setupAuthMiddleware(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error(JSON.stringify({ code: 'AUTH_REQUIRED', message: 'Bạn cần đăng nhập để sử dụng tính năng này.' })));

    jwt.verify(token, ACCESS_TOKEN_SECRET, async (err, payload) => {
      if (err) return next(new Error(JSON.stringify({ code: 'AUTH_REQUIRED', message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' })));
      const userId = payload?.userId || payload?.user_id;
      if (!userId || !isAccessTokenValidForUser(userId, token)) {
        return next(new Error(JSON.stringify({ code: 'AUTH_REQUIRED', message: 'Access token đã bị thu hồi hoặc không hợp lệ. Vui lòng đăng nhập lại.' })));
      }
      socket.user = await User.findById(userId);
      if (!socket.user) {
        return next(new Error(JSON.stringify({ code: 'AUTH_REQUIRED', message: 'Người dùng không tồn tại. Vui lòng đăng nhập lại.' })));
      }
      socket.authToken = token;
      next();
    });
  });
}

function handleForceLogout(io, socket) {
  try {
    const newUserId = socket.user.user_id;
    const newToken = socket.authToken;
    if (newUserId && newToken) {
      for (const [sid, s] of io.of('/').sockets) {
        if (sid === socket.id) continue;
        const existingUserId = s.user?.user_id;
        const existingToken = s.authToken;
        if (existingUserId && String(existingUserId) === String(newUserId) && existingToken !== newToken) {
          try { s.emit('forceLogout', { message: 'Tài khoản đã được đăng nhập ở thiết bị khác' }); } catch (e) {}
          setTimeout(() => { try { s.disconnect(true); } catch (e) {} }, 200);
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ Lỗi khi xử lý ngắt kết nối socket cũ:', e.message);
  }
}

export default function attachSocketServices(io) {
  setupAuthMiddleware(io);

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.username} connected`);

    handleForceLogout(io, socket);

    roomService.register(io, socket);
    roomAIService.register(io, socket);
    chatService.register(io, socket);
  });
}
