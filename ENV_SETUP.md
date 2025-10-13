# 🔧 Hướng dẫn tạo file .env

Hướng dẫn đơn giản tạo file `.env` cho Card Game Server.

## 📝 **Cách tạo file .env**

### **Bước 1: Copy từ template**
```bash
# Copy file mẫu
copy .envsample.txt .env
```

### **Bước 2: Sửa thông tin MySQL của bạn**

Mở file `.env` và thay đổi thông tin sau:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root        # Thay bằng tên đăng nhập MySQL của bạn
DB_PASSWORD=0000    # Thay bằng mật khẩu MySQL của bạn
DB_NAME=poker_system

# Connection Pool Settings
DB_CONNECTION_LIMIT=10
DB_ACQUIRE_TIMEOUT=60000
DB_TIMEOUT=60000

# Security
DB_SSL=false

# Application
NODE_ENV=test
PORT=3000
```

## ⚠️ **Quan trọng - Phải thay đổi:**

### **1. DB_PASSWORD**
```env
DB_PASSWORD=0000    # ❌ Đừng để default như này
DB_PASSWORD=mat_khau_mysql_cua_ban    # ✅ Thay bằng password thật
```

### **2. DB_USER (nếu khác root)**
```env
DB_USER=root                 # ✅ OK nếu bạn dùng root
DB_USER=ten_user_cua_ban    # ✅ Hoặc thay bằng user MySQL của bạn
```

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
- ✅ **Thay đổi** password mặc định `0000`  
- ✅ File `.env` đã được thêm vào `.gitignore`

---

**Xong! Bây giờ bạn có thể chạy server rồi! 🚀**