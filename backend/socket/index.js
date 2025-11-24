// Socket wiring: auth middleware, cross-service lifecycle and service registration
import jwt from 'jsonwebtoken';
import { isAccessTokenValidForUser } from '../authTokenStore.js';
import User from '../model/User.js';
import * as roomService from './roomService.js';

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

/**
 * Broadcast notification to specific user (if online)
 * @param {Object} io - Socket.IO server instance
 * @param {Number} userId - User ID to notify
 * @param {Object} data - Notification data
 */
export function notifyUser(io, userId, data) {
  try {
    for (const [sid, socket] of io.of('/').sockets) {
      if (socket.user?.user_id === userId) {
        socket.emit('newRewardAvailable', data);
        console.log(`📨 Sent reward notification to user ${userId}`);
        return true;
      }
    }
    return false; // User not online
  } catch (error) {
    console.error('Error notifying user:', error);
    return false;
  }
}

/**
 * Broadcast notification to all connected users
 * @param {Object} io - Socket.IO server instance
 * @param {Object} data - Notification data
 */
export function notifyAllUsers(io, data) {
  try {
    io.emit('newRewardAvailable', data);
    console.log(`📢 Broadcast reward notification to all users`);
  } catch (error) {
    console.error('Error broadcasting to all users:', error);
  }
}

export default function attachSocketServices(io) {
  setupAuthMiddleware(io);

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.username} connected`);

    // Cross-service lifecycle handling
    handleForceLogout(io, socket);

    // Register per-service handlers (keep services small and focused)
    roomService.register(io, socket);

    // Future services: chatService.register(io, socket); statsService.register(...)
  });
}
