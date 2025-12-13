import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../model/DatabaseConnection.js';
import crypto from 'crypto';
import { sendPasswordResetOTP, sendEmailVerificationOTP } from '../service/emailService.js';
import { setActiveAccessToken, revokeActiveAccessToken } from '../authTokenStore.js';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access_secret';
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 10) || 30;
const RESET_PASSWORD_TOKEN_EXPIRES_MINUTES = parseInt(process.env.RESET_PASSWORD_TOKEN_EXPIRES_MINUTES, 10) || 15;
const ADMIN_CONTACT_EMAIL = process.env.ADMIN_CONTACT_EMAIL || 'admin@example.com';

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
    // 2. Kiểm tra mật khẩu và trạng thái bị ban
    if (user.banned) {
      return res.status(403).json({ success: false, message: `Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên qua email: ${ADMIN_CONTACT_EMAIL}` });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu' });
    }
    
    // 3. Tạo access token
    const accessToken = jwt.sign({ userId: user.user_id, username: user.username, role: user.role }, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
    // Lưu access token hiện tại cho user (vô hiệu hóa token cũ ngay)
    try {
      setActiveAccessToken(user.user_id, accessToken);
    } catch (e) {
      console.warn('Failed to set active access token in store', e);
    }
    
    // 4. Prepare tokens and session id
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    // We'll always create a sessionId for this login. For non-remember, we'll only create the per-session token.
    // For remember=true, we'll create both: a generic persistent token and a per-session token (two cookies).
    const sessionId = crypto.randomBytes(32).toString('hex');

    // Per-session token
    const sessionRefreshToken = crypto.randomBytes(64).toString('hex');
    const sessionRefreshTokenHash = hashToken(sessionRefreshToken);
    await db.query('INSERT INTO refresh_tokens (user_id, session_id, token_hash, issued_at, expires_at, device_info) VALUES (?, ?, ?, ?, ?, ?)', [user.user_id, sessionId, sessionRefreshTokenHash, now, expiresAt, getDeviceInfo(req)]);

    // If remember, also create a generic persistent refresh token (session_id = NULL)
    let genericRefreshToken = null;
    if (remember) {
      genericRefreshToken = crypto.randomBytes(64).toString('hex');
      const genericRefreshTokenHash = hashToken(genericRefreshToken);
      await db.query('INSERT INTO refresh_tokens (user_id, session_id, token_hash, issued_at, expires_at, device_info) VALUES (?, NULL, ?, ?, ?, ?)', [user.user_id, genericRefreshTokenHash, now, expiresAt, getDeviceInfo(req)]);
    }

    // 5. Set cookies
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: remember ? REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000 : undefined,
      path: '/api/auth',
    };

    // Per-session cookie
    res.cookie(`refresh_token_${sessionId}`, sessionRefreshToken, cookieOpts);
    // Generic persistent cookie for remember
    if (remember && genericRefreshToken) {
      res.cookie('refresh_token', genericRefreshToken, cookieOpts);
    }

    // 6. Respond: include sessionId so client can persist it (localStorage for remember, sessionStorage for non-remember)
    const resp = { success: true, accessToken, user: { userId: user.user_id, username: user.username, role: user.role, balance: Math.floor(user.balance) || 0, elo: user.elo }, sessionId };
    res.json(resp);
  }

  static async refresh(req, res) {
    // Support two modes:
    // - client provides X-Session-Id header -> look for cookie `refresh_token_<sessionId>` and DB record with that session_id
    // - no session id -> fallback to generic cookie `refresh_token` (remember login)
    const sessionId = req.get('x-session-id') || null;
    const cookieName = sessionId ? `refresh_token_${sessionId}` : 'refresh_token';
    const refreshToken = req.cookies?.[cookieName];
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Thiếu refresh token' });
    }

    const refreshTokenHash = hashToken(refreshToken);
    // 1. Tìm token trong DB (nếu sessionId có thì match session_id)
    let tokens;
    if (sessionId) {
      tokens = await db.query('SELECT * FROM refresh_tokens WHERE token_hash = ? AND session_id = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()', [refreshTokenHash, sessionId]);
    } else {
      tokens = await db.query('SELECT * FROM refresh_tokens WHERE token_hash = ? AND session_id IS NULL AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()', [refreshTokenHash]);
    }
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
    if (user.banned) {
      return res.status(403).json({ success: false, message: `Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên qua email: ${ADMIN_CONTACT_EMAIL}` });
    }
    // 3. Rotate refresh token
    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    const newRefreshTokenHash = hashToken(newRefreshToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await db.query('UPDATE refresh_tokens SET revoked_at = ? , replaced_by = ? WHERE id = ?', [now, newRefreshTokenHash, tokenRow.id]);
    await db.query('INSERT INTO refresh_tokens (user_id, session_id, token_hash, issued_at, expires_at, device_info) VALUES (?, ?, ?, ?, ?, ?)', [user.user_id, tokenRow.session_id, newRefreshTokenHash, now, expiresAt, getDeviceInfo(req)]);
    // 4. Đặt lại cookie (tên cookie phụ thuộc vào session_id)
    const newCookieName = tokenRow.session_id ? `refresh_token_${tokenRow.session_id}` : 'refresh_token';
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    };
    res.cookie(newCookieName, newRefreshToken, cookieOpts);
    // 5. Trả về access token mới
    const accessToken = jwt.sign({ userId: user.user_id, username: user.username, role: user.role }, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
    try {
      setActiveAccessToken(user.user_id, accessToken);
    } catch (e) {
      console.warn('Failed to set active access token in store', e);
    }
    res.json({ success: true, accessToken, user: { userId: user.user_id, username: user.username, role: user.role, balance: Math.floor(user.balance) || 0, elo:user.elo } });
  }

  static async logout(req, res) {
    // Support per-session cookie names via X-Session-Id header
    const sessionId = req.get('x-session-id') || null;
    const cookieName = sessionId ? `refresh_token_${sessionId}` : 'refresh_token';
    const refreshToken = req.cookies?.[cookieName];
    if (refreshToken) {
      const refreshTokenHash = hashToken(refreshToken);
      await db.query('UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE token_hash = ?', [refreshTokenHash]);
      res.clearCookie(cookieName, { path: '/api/auth' });
    }
    // Also clear generic cookie if present (useful for remember logins which set two cookies)
    const genericToken = req.cookies?.['refresh_token'];
    if (genericToken) {
      const genericHash = hashToken(genericToken);
      await db.query('UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE token_hash = ?', [genericHash]);
      res.clearCookie('refresh_token', { path: '/api/auth' });
    }
    // Nếu route được bảo vệ bởi middleware authenticateJWT thì req.user có thể được dùng
    try {
      const userId = req.user?.userId || req.user?.user_id;
      if (userId) {
        revokeActiveAccessToken(userId);
      } else {
        // fallback: nếu không có req.user, cố gắng revoke bằng Authorization header
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.split(' ')[1];
          try {
            const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
            const uid = payload?.userId || payload?.user_id;
            if (uid) revokeActiveAccessToken(uid);
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      // ignore errors during revoke
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

      // Kiểm tra tài khoản bị ban
      if (user.banned) {
        return res.status(403).json({ success: false, message: `Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên qua email: ${ADMIN_CONTACT_EMAIL}` });
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

      // Kiểm tra tài khoản bị ban
      if (user.banned) {
        return res.status(403).json({ success: false, message: `Tài khoản của bạn đã bị khóa. Không thể đặt lại mật khẩu. Vui lòng liên hệ quản trị viên qua email: ${ADMIN_CONTACT_EMAIL}` });
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

  // Đăng ký tài khoản mới (chỉ cần username và password)
  static async register(req, res) {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin' });
    }

    if (username.length < 3) {
      return res.status(400).json({ success: false, message: 'Tên đăng nhập phải có ít nhất 3 ký tự' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    try {
      // 1. Kiểm tra username đã tồn tại chưa
      const existingUsers = await db.query('SELECT * FROM User WHERE username = ?', [username]);
      if (existingUsers && existingUsers.length > 0) {
        return res.status(409).json({ success: false, message: 'Tên đăng nhập đã tồn tại' });
      }

      // 2. Hash mật khẩu
      const hashedPassword = await bcrypt.hash(password, 10);

      // 3. Tạo user mới (không có email)
      const result = await db.query(
        'INSERT INTO User (username, password, role, balance, banned, elo) VALUES (?, ?, ?, ?, ?, ?)',
        [username, hashedPassword, 'Player', 0, false, 1000]
      );

      const userId = result.insertId;

      res.json({ 
        success: true, 
        message: 'Đăng ký thành công',
        user: { userId, username }
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ success: false, message: 'Đã xảy ra lỗi, vui lòng thử lại sau' });
    }
  }

  // Gửi OTP để xác thực email (liên kết email sau khi đăng ký)
  static async sendEmailVerificationOTP(req, res) {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
    }

    try {
      // 1. Tìm user
      const users = await db.query('SELECT * FROM User WHERE user_id = ?', [userId]);
      const user = users && users[0];

      if (!user) {
        return res.status(404).json({ success: false, message: 'Tài khoản không tồn tại' });
      }

      if (user.banned) {
        return res.status(403).json({ success: false, message: `Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên qua email: ${ADMIN_CONTACT_EMAIL}` });
      }

      // 2. Kiểm tra email đã được sử dụng bởi bao nhiêu tài khoản (tối đa 5)
      const emailUsers = await db.query('SELECT * FROM User WHERE email = ? AND user_id != ?', [email, userId]);
      if (emailUsers && emailUsers.length >= 5) {
        return res.status(409).json({ 
          success: false, 
          message: 'Email này đã được sử dụng cho 5 tài khoản (tối đa). Vui lòng sử dụng email khác' 
        });
      }

      // 3. Tạo mã OTP 6 số
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const tokenHash = hashToken(otpCode);
      const expiresAt = new Date(Date.now() + RESET_PASSWORD_TOKEN_EXPIRES_MINUTES * 60 * 1000);

      // 4. Xóa các OTP cũ chưa verify của user này
      await db.query('DELETE FROM email_verification_tokens WHERE user_id = ? AND verified_at IS NULL', [userId]);

      // 5. Lưu OTP hash vào DB
      await db.query(
        'INSERT INTO email_verification_tokens (user_id, email, token_hash, expires_at) VALUES (?, ?, ?, ?)',
        [userId, email, tokenHash, expiresAt]
      );

      // 6. Gửi email với OTP
      const emailSent = await sendEmailVerificationOTP(email, user.username, otpCode);
      
      if (!emailSent) {
        console.error('Failed to send verification email to:', email);
        return res.status(500).json({ success: false, message: 'Không thể gửi email. Vui lòng thử lại sau' });
      }

      res.json({ 
        success: true, 
        message: `Mã xác thực đã được gửi đến ${email}`
      });
    } catch (error) {
      console.error('Send verification OTP error:', error);
      res.status(500).json({ success: false, message: 'Đã xảy ra lỗi, vui lòng thử lại sau' });
    }
  }

  // Xác thực OTP và liên kết email với tài khoản
  static async verifyEmailOTP(req, res) {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin' });
    }

    try {
      // 1. Tìm user
      const users = await db.query('SELECT * FROM User WHERE user_id = ?', [userId]);
      const user = users && users[0];

      if (!user) {
        return res.status(404).json({ success: false, message: 'Tài khoản không tồn tại' });
      }

      if (user.banned) {
        return res.status(403).json({ success: false, message: `Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên qua email: ${ADMIN_CONTACT_EMAIL}` });
      }

      const tokenHash = hashToken(otp);

      // 2. Tìm OTP trong DB (chưa verify, chưa hết hạn)
      const tokens = await db.query(
        'SELECT * FROM email_verification_tokens WHERE user_id = ? AND token_hash = ? AND verified_at IS NULL AND expires_at > UTC_TIMESTAMP()',
        [userId, tokenHash]
      );
      const tokenRow = tokens && tokens[0];

      if (!tokenRow) {
        return res.status(400).json({ success: false, message: 'Mã xác thực không đúng hoặc đã hết hạn' });
      }

      // 3. Cập nhật email cho user
      await db.query('UPDATE User SET email = ? WHERE user_id = ?', [tokenRow.email, userId]);

      // 4. Đánh dấu OTP đã verify
      await db.query('UPDATE email_verification_tokens SET verified_at = UTC_TIMESTAMP() WHERE id = ?', [tokenRow.id]);

      res.json({ 
        success: true, 
        message: 'Xác thực email thành công',
        email: tokenRow.email
      });
    } catch (error) {
      console.error('Verify email OTP error:', error);
      res.status(500).json({ success: false, message: 'Đã xảy ra lỗi, vui lòng thử lại sau' });
    }
  }
}
