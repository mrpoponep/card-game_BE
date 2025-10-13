# MySQL Database Setup Guide

## 📋 Yêu Cầu
- MySQL Server 8.0+ hoặc MariaDB 10.3+
- Node.js 16+

## 🔧 Cài Đặt MySQL

### Windows:
1. Download MySQL từ: https://dev.mysql.com/downloads/mysql/
2. Hoặc dùng XAMPP: https://www.apachefriends.org/
3. Hoặc dùng WampServer: https://www.wampserver.com/

### Cấu hình MySQL:
```sql
-- Tạo database
CREATE DATABASE card_game_db;

-- Tạo user (optional)
CREATE USER 'card_game_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON card_game_db.* TO 'card_game_user'@'localhost';
FLUSH PRIVILEGES;
```

## ⚙️ Cấu Hình Project

### 1. Cập nhật file `.env`:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root                # Hoặc card_game_user
DB_PASSWORD=                # Mật khẩu MySQL của bạn
DB_NAME=card_game_db

# Connection Pool Settings
DB_CONNECTION_LIMIT=10
DB_ACQUIRE_TIMEOUT=60000
DB_TIMEOUT=60000

# Security
DB_SSL=false

# Application
NODE_ENV=development
PORT=3000
```

### 2. Cài đặt dependencies:
```bash
npm install mysql2 dotenv
```

## 🧪 Test Connection
```javascript
import db from './backend/model/DatabaseConnection.js';

async function testConnection() {
  try {
    await db.connect();
    console.log('✅ MySQL connected successfully!');
    
    const status = await db.getConnectionStatus();
    console.log('📊 Status:', status);
    
    await db.disconnect();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

testConnection();
```

## 🚨 Troubleshooting

### Lỗi thường gặp:

1. **Connection refused**:
   - Kiểm tra MySQL service đã chạy chưa
   - Verify host và port trong .env

2. **Access denied**:
   - Kiểm tra username/password
   - Verify user permissions

3. **Database không tồn tại**:
   - Tạo database manually: `CREATE DATABASE poker_system`

4. **SSL connection error**:
   - Set `DB_SSL=false` trong .env