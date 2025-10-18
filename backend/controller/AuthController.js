import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../model/DatabaseConnection.js';
import crypto from 'crypto';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access_secret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh_secret';
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 10) || 30;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getDeviceInfo(req) {
  return req.headers['user-agent'] || 'unknown';
}

export default class AuthController {
  static async login(req, res) {
    const { username, password, remember } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin đăng nhập' });
    }
    // 1. Tìm user
    const users = await db.query('SELECT * FROM User WHERE username = ?', [username]);
    const user = users && users[0];
    if (!user) {
      return res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu' });
    }
    // 2. Kiểm tra mật khẩu
    // const ok = await bcrypt.compare(password, user.password);
    const ok = password === user.password;
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu' });
    }
    // 3. Tạo access token
    const accessToken = jwt.sign({ userId: user.user_id, username: user.username, role: user.role }, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
    
    // 4. Tạo refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = hashToken(refreshToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    // 5. Lưu refresh token vào DB
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, issued_at, expires_at, device_info) VALUES (?, ?, ?, ?, ?)',
      [user.user_id, refreshTokenHash, now, expiresAt, getDeviceInfo(req)]
    );
    // 6. Đặt cookie httpOnly
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: remember ? REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000 : undefined,
      path: '/api/auth',
    });
    // 7. Trả về access token
    res.json({ success: true, accessToken, user: { userId: user.user_id, username: user.username, role: user.role } });
  }

  static async refresh(req, res) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Thiếu refresh token' });
    }
    const refreshTokenHash = hashToken(refreshToken);
    // 1. Tìm token trong DB
    const tokens = await db.query('SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW()', [refreshTokenHash]);
    const tokenRow = tokens && tokens[0];
    if (!tokenRow) {
      return res.status(401).json({ success: false, message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
    }
    // 2. Tìm user
    const users = await db.query('SELECT * FROM User WHERE user_id = ?', [tokenRow.user_id]);
    const user = users && users[0];
    if (!user) {
      return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại' });
    }
    // 3. Rotate refresh token
    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    const newRefreshTokenHash = hashToken(newRefreshToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await db.query('UPDATE refresh_tokens SET revoked_at = ? , replaced_by = ? WHERE id = ?', [now, newRefreshTokenHash, tokenRow.id]);
    await db.query('INSERT INTO refresh_tokens (user_id, token_hash, issued_at, expires_at, device_info) VALUES (?, ?, ?, ?, ?)', [user.user_id, newRefreshTokenHash, now, expiresAt, getDeviceInfo(req)]);
    // 4. Đặt lại cookie
    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });
    // 5. Trả về access token mới
    const accessToken = jwt.sign({ userId: user.user_id, username: user.username, role: user.role }, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
    res.json({ success: true, accessToken, user: { userId: user.user_id, username: user.username, role: user.role } });
  }

  static async logout(req, res) {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      const refreshTokenHash = hashToken(refreshToken);
      await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?', [refreshTokenHash]);
      res.clearCookie('refresh_token', { path: '/api/auth' });
    }
    res.json({ success: true, message: 'Đã đăng xuất' });
  }
}
