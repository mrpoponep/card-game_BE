import nodemailer from 'nodemailer';

// Tạo transporter với Gmail
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Verify connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email service error:', error);
  } else {
    console.log('✅ Email service ready');
  }
});

/**
 * Gửi email với mã OTP để reset password
 * @param {string} email - Email người nhận
 * @param {string} username - Tên đăng nhập
 * @param {string} otpCode - Mã OTP 6 số
 * @returns {Promise<boolean>}
 */
export async function sendPasswordResetOTP(email, username, otpCode) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #1a0a0a;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: linear-gradient(135deg, rgba(139, 26, 26, 0.95), rgba(165, 42, 42, 0.95));
          border: 3px solid #FFD700;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }
        .header {
          background: rgba(139, 26, 26, 0.9);
          padding: 30px;
          text-align: center;
          border-bottom: 2px solid #FFD700;
        }
        .header h1 {
          color: #FFD700;
          margin: 0;
          font-size: 28px;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
        }
        .content {
          padding: 40px 30px;
          color: #fff;
        }
        .content p {
          line-height: 1.6;
          margin: 15px 0;
          font-size: 15px;
        }
        .username {
          color: #FFD700;
          font-weight: bold;
        }
        .button-container {
          text-align: center;
          margin: 35px 0;
        }
        .reset-button {
          display: inline-block;
          padding: 14px 32px;
          background: linear-gradient(135deg, #FFD700, #FFA500);
          color: #4a2500;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 700;
          font-size: 16px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 14px rgba(255, 215, 0, 0.35);
          transition: all 0.3s ease;
        }
        .reset-button:hover {
          background: linear-gradient(135deg, #FFA500, #FFD700);
          box-shadow: 0 6px 18px rgba(255, 215, 0, 0.45);
        }
        .warning {
          background: rgba(255, 215, 0, 0.1);
          border-left: 4px solid #FFD700;
          padding: 15px;
          margin: 25px 0;
          border-radius: 4px;
        }
        .warning p {
          margin: 5px 0;
          font-size: 14px;
          color: #FFE27A;
        }
        .footer {
          background: rgba(26, 10, 10, 0.5);
          padding: 20px;
          text-align: center;
          font-size: 13px;
          color: #999;
          border-top: 1px solid rgba(255, 215, 0, 0.3);
        }
        .link {
          color: #FFD700;
          word-break: break-all;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎴 Card Game - Đặt lại mật khẩu</h1>
        </div>
        <div class="content">
          <p>Xin chào <span class="username">${username}</span>,</p>
          <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
          <p>Vui lòng sử dụng mã xác thực sau để tiếp tục:</p>
          
          <div class="button-container">
            <div style="
              display: inline-block;
              padding: 20px 40px;
              background: linear-gradient(135deg, #FFD700, #FFA500);
              color: #4a2500;
              border-radius: 8px;
              font-weight: 700;
              font-size: 32px;
              letter-spacing: 8px;
              text-align: center;
              box-shadow: 0 4px 14px rgba(255, 215, 0, 0.35);
              font-family: 'Courier New', monospace;
            ">${otpCode}</div>
          </div>
          
          <div class="warning">
            <p><strong>⚠️ Lưu ý quan trọng:</strong></p>
            <p>• Mã này chỉ có hiệu lực trong <strong>15 phút</strong></p>
            <p>• Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này</p>
            <p>• Không chia sẻ mã này với bất kỳ ai</p>
          </div>
          
          <p style="margin-top: 30px;">Trân trọng,<br><strong style="color: #FFD700;">Card Game Team</strong></p>
        </div>
        <div class="footer">
          <p>Email này được gửi tự động, vui lòng không trả lời.</p>
          <p>&copy; 2025 Card Game. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: '🎴 Card Game - Mã xác thực đặt lại mật khẩu',
    html: htmlContent
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Password reset OTP sent to:', email);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return false;
  }
}

export default { sendPasswordResetOTP };
