import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../model/DatabaseConnection.js';
import crypto from 'crypto';
import { sendPasswordResetOTP } from '../services/emailService.js';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access_secret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh_secret';
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 10) || 30;
const RESET_PASSWORD_TOKEN_EXPIRES_MINUTES = parseInt(process.env.RESET_PASSWORD_TOKEN_EXPIRES_MINUTES, 10) || 15;

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
    const ok = await bcrypt.compare(password, user.password);
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
    const tokens = await db.query('SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()', [refreshTokenHash]);
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
      await db.query('UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE token_hash = ?', [refreshTokenHash]);
      res.clearCookie('refresh_token', { path: '/api/auth' });
    }
    res.json({ success: true, message: 'Đã đăng xuất' });
  }

  // Gửi mã OTP qua email (bước 1)
  static async sendResetOTP(req, res) {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên đăng nhập' });
    }

    try {
      // 1. Tìm user theo username
      const users = await db.query('SELECT * FROM User WHERE username = ?', [username]);
      const user = users && users[0];
      
      if (!user) {
        return res.status(404).json({ success: false, message: 'Tên đăng nhập không tồn tại' });
      }

      if (!user.email) {
        return res.status(400).json({ success: false, message: 'Tài khoản này chưa có email. Vui lòng liên hệ quản trị viên' });
      }

      // 2. Tạo mã OTP 6 số
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const tokenHash = hashToken(otpCode);
      const expiresAt = new Date(Date.now() + RESET_PASSWORD_TOKEN_EXPIRES_MINUTES * 60 * 1000);

      // 3. Xóa các OTP cũ chưa dùng của user này
      await db.query('DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL', [user.user_id]);

      // 4. Lưu OTP hash vào DB
      await db.query(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [user.user_id, tokenHash, expiresAt]
      );

      // 5. Gửi email với OTP
      const emailSent = await sendPasswordResetOTP(user.email, user.username, otpCode);
      
      if (!emailSent) {
        console.error('Failed to send OTP email to:', user.email);
        return res.status(500).json({ success: false, message: 'Không thể gửi email. Vui lòng thử lại sau' });
      }

      // Ẩn một phần email để bảo mật
      const hiddenEmail = user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

      res.json({ 
        success: true, 
        message: `Mã xác thực đã được gửi đến ${hiddenEmail}`,
        email: hiddenEmail
      });
    } catch (error) {
      console.error('Send OTP error:', error);
      res.status(500).json({ success: false, message: 'Đã xảy ra lỗi, vui lòng thử lại sau' });
    }
  }

  // Xác thực OTP và đặt lại mật khẩu (bước 2)
  static async verifyOTPAndResetPassword(req, res) {
    const { username, otp, newPassword } = req.body;

    if (!username || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    try {
      // 1. Tìm user
      const users = await db.query('SELECT * FROM User WHERE username = ?', [username]);
      const user = users && users[0];

      if (!user) {
        return res.status(404).json({ success: false, message: 'Tên đăng nhập không tồn tại' });
      }

      const tokenHash = hashToken(otp);

      // 2. Tìm OTP trong DB (chưa dùng, chưa hết hạn)
      const tokens = await db.query(
        'SELECT * FROM password_reset_tokens WHERE user_id = ? AND token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()',
        [user.user_id, tokenHash]
      );
      const tokenRow = tokens && tokens[0];

      if (!tokenRow) {
        return res.status(400).json({ success: false, message: 'Mã xác thực không đúng hoặc đã hết hạn' });
      }

      // 3. Hash mật khẩu mới
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // 4. Cập nhật mật khẩu
      await db.query('UPDATE User SET password = ? WHERE user_id = ?', [hashedPassword, user.user_id]);

      // 5. Đánh dấu OTP đã dùng
      await db.query('UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ?', [tokenRow.id]);

      // 6. Revoke tất cả refresh tokens (đăng xuất tất cả thiết bị)
      await db.query('UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ?', [user.user_id]);

      res.json({ success: true, message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ success: false, message: 'Đã xảy ra lỗi, vui lòng thử lại sau' });
    }
  }
}
