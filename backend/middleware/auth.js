import jwt from 'jsonwebtoken';
import { isAccessTokenValidForUser } from '../authTokenStore.js';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access_secret';

export function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để sử dụng tính năng này.' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' });
    }
    // Kiểm tra token có khớp với token hiện hành của user không
    const userId = payload?.userId || payload?.user_id;
    if (!userId || !isAccessTokenValidForUser(userId, token)) {
      return res.status(401).json({ success: false, message: 'Access token đã bị thu hồi hoặc không hợp lệ. Vui lòng đăng nhập lại.' });
    }
    req.user = payload;
    console.log(payload);
    next();
  });
}
