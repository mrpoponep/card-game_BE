# 🔧 Hướng dẫn tạo file .env

Hướng dẫn đơn giản tạo file `.env` cho Card Game Server.

## 📝 **Cách tạo file .env**

### **Bước 1: Copy từ template**
```bash
# Copy file mẫu
copy .envsample.txt .env
```

### **Bước 2: Sửa thông tin cấu hình**

Mở file `.env` và thay đổi thông tin sau:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root        # Thay bằng tên đăng nhập MySQL của bạn
DB_PASSWORD=1234    # Thay bằng mật khẩu MySQL của bạn
DB_NAME=poker_system

# Connection Pool Settings
DB_CONNECTION_LIMIT=10
DB_ACQUIRE_TIMEOUT=60000
DB_TIMEOUT=60000

# Security
DB_SSL=false

# Application
NODE_ENV=development
PORT=3000

# Auth secrets
ACCESS_TOKEN_SECRET=your_access_token_secret_here
REFRESH_TOKEN_SECRET=your_refresh_token_secret_here
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30

# Email configuration (Gmail)
EMAIL_SERVICE=gmail
EMAIL_USER=btthanh2004@gmail.com
EMAIL_PASSWORD=trbo vjlt dpwb bviq
EMAIL_FROM=Card Game <btthanh2004@gmail.com>
RESET_PASSWORD_TOKEN_EXPIRES_MINUTES=15

# Admin contact
ADMIN_CONTACT_EMAIL=btthanh2004@gmail.com
```

## ⚠️ **Quan trọng - Phải thay đổi:**

### **1. Database Configuration**
```env
DB_PASSWORD=1234    # ❌ Đừng để default như này
DB_PASSWORD=mat_khau_mysql_cua_ban    # ✅ Thay bằng password thật

DB_USER=root                 # ✅ OK nếu bạn dùng root
DB_USER=ten_user_cua_ban    # ✅ Hoặc thay bằng user MySQL của bạn
```

### **2. Auth Secrets (BẮT BUỘC thay đổi cho production)**
```env
ACCESS_TOKEN_SECRET=your_access_token_secret_here    # ❌ Phải thay đổi!
REFRESH_TOKEN_SECRET=your_refresh_token_secret_here  # ❌ Phải thay đổi!

# ✅ Tạo secret ngẫu nhiên bằng lệnh:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### **3. Email Configuration (cho tính năng reset password)**
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com           # ✅ Email của bạn
EMAIL_PASSWORD=your_app_password          # ✅ App password từ Google
EMAIL_FROM=Card Game <your_email@gmail.com>
ADMIN_CONTACT_EMAIL=your_email@gmail.com
```

**Lưu ý:** Để sử dụng Gmail, bạn cần:
1. Bật xác thực 2 bước trên tài khoản Google
2. Tạo App Password tại: https://myaccount.google.com/apppasswords
3. Sử dụng App Password thay vì mật khẩu thường

## 🔧 **Môi trường khác nhau**

### **Development:**
```env
NODE_ENV=development
DB_NAME=poker_system_dev
```

### **Test:**
```env
NODE_ENV=test
DB_NAME=poker_system_test
```

### **Production:**
```env
NODE_ENV=production
DB_NAME=poker_system_prod
```

## ✅ **Kiểm tra setup**

```bash
# Test kết nối database
npm run test:db

# Hoặc chạy server
npm start
```

## 🚨 **Lỗi thường gặp**

### **❌ Access denied:**
```
Error: Access denied for user 'root'@'localhost'
```
**Giải quyết:** Kiểm tra `DB_USER` và `DB_PASSWORD` trong `.env`

### **❌ Connection refused:**
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
**Giải quyết:** Khởi động MySQL service:
```bash
net start mysql    # Windows
```

### **❌ Database không tồn tại:**
```
Error: Unknown database 'poker_system'
```
**Giải quyết:** Chạy lệnh tạo database:
```bash
npm run db:create
```

## 🔒 **Bảo mật**

- ✅ **Không commit** file `.env` lên git
- ✅ **Thay đổi** password mặc định và các secret keys
- ✅ **Bảo vệ** EMAIL_PASSWORD (sử dụng App Password, không phải mật khẩu thật)
- ✅ File `.env` đã được thêm vào `.gitignore`
- ✅ **Production:** Luôn thay đổi `ACCESS_TOKEN_SECRET` và `REFRESH_TOKEN_SECRET`

---

**Xong! Bây giờ bạn có thể chạy server rồi! 🚀**