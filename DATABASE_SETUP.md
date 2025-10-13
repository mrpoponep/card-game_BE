# 🎮 Card Game Database Setup Guide

Hướng dẫn chi tiết setup và test database cho ứng dụng Card Game.

## 📋 **Mục lục**
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cấu hình database](#cấu-hình-database)
- [Setup database](#setup-database)
- [Test database](#test-database)
- [Troubleshooting](#troubleshooting)

---

## 🔧 **Yêu cầu hệ thống**

### **Software Requirements:**
- **Node.js**: >= 16.0.0
- **MySQL**: >= 8.0 (hoặc MariaDB >= 10.6)
- **NPM**: >= 8.0.0

### **MySQL Configuration:**
```sql
-- Đảm bảo MySQL có các settings sau:
SET GLOBAL sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';
```

---

## ⚙️ **Cấu hình Database**

### **1. Tạo file .env:**
```bash
# Sao chép từ template
cp .env.example .env
```

### **2. Cấu hình MySQL trong .env:**
```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_PORT=3306

# Environment
NODE_ENV=development
```

### **3. Kiểm tra kết nối MySQL:**
```bash
# Test kết nối bằng MySQL client
mysql -h localhost -u root -p
```

---

## 🚀 **Setup Database**

### **Available Commands:**

| Command | Environment | Database Name | Demo Data | Confirmation |
|---------|-------------|---------------|-----------|--------------|
| `npm run db:create` | Development | `poker_system_dev` | ✅ Yes | ❌ No |
| `npm run db:create:dev` | Development | `poker_system_dev` | ✅ Yes | ❌ No |
| `npm run db:create:test` | Test | `poker_system_test` | ✅ Yes | ❌ No |
| `npm run db:create:prod` | Production | `poker_system_prod` | ❌ No | 🛡️ Smart |

### **Quick Start:**

#### **1. Development Setup (Khuyến nghị):**
```bash
# Setup database cho development với demo data
npm run db:create:dev
```

#### **2. Test Environment:**
```bash
# Setup database cho testing
npm run db:create:test
```

#### **3. Production Setup:**
```bash
# Setup production (có smart confirmation)
npm run db:create:prod
```

---

## 🛡️ **Production Safety Features**

### **Smart Confirmation System:**

#### **🆕 Database chưa tồn tại:**
```
🔍 Checking if production database already exists...
✅ Database does not exist yet. Creating new database...
🎯 No confirmation needed for initial setup.
```
- ✅ **Tạo ngay** - Không cần confirmation
- 🚀 **Setup nhanh chóng**

#### **⚠️ Database đã tồn tại:**
```
🚨 PRODUCTION DATABASE OVERRIDE WARNING! 🚨
⚠️ Database already exists! This will DESTROY existing data.
```
- 🛡️ **4-Step Maximum Security** confirmation
- 💀 **Cảnh báo mạnh** về mất dữ liệu

### **4-Step Security Process:**
1. **Step 1:** Type `"destroy"` to acknowledge data destruction
2. **Step 2:** Type exact database name `"poker_system_prod"`  
3. **Step 3:** Type current date (prevents automation)
4. **Step 4:** Type `"I FULLY UNDERSTAND THIS DESTROYS ALL PRODUCTION DATA"`

---

## 🧪 **Test Database**

### **Available Test Commands:**

```bash
# Test toàn diện database operations
npm run test:db

# Test nhanh cơ bản  
npm run test:quick
```

### **Test Categories:**

#### **🔗 Connection Tests:**
- ✅ Database connection
- ✅ Connection status validation
- ✅ Schema verification

#### **📋 CRUD Tests:**
- ✅ User creation, read, update, delete
- ✅ Transaction management
- ✅ Data integrity validation

#### **🎯 Trigger Tests:**
- ✅ Automatic balance updates
- ✅ Transaction protection (prevent delete/update)
- ✅ Balance validation (no negative)

#### **🔄 Transaction Reversal Tests:**
- ✅ Stored procedure `ReverseTransaction()`
- ✅ Double-reversal prevention
- ✅ Audit trail validation

#### **⚡ Performance Tests:**
- ✅ Batch operations (100 inserts)
- ✅ Query performance (50 SELECT queries)
- ✅ Index effectiveness

---

## 📊 **Database Schema**

### **Tables Created:**

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `User` | Player accounts | Auto-increment ID, unique username, ELO rating |
| `Transactions` | Financial records | Immutable, auto-balance updates via triggers |
| `Table_Info` | Poker table settings | Blinds, buy-in limits, rake configuration |
| `Game_History` | Game records | Winners, timestamps, table references |
| `Banned_Player` | Moderation | Reports with chat history evidence |
| `Appeal` | Ban appeals | Appeal process tracking |

### **Key Features:**

#### **🔒 Data Integrity:**
```sql
-- Transactions cannot be deleted or modified
TRIGGER tr_prevent_transaction_delete
TRIGGER tr_prevent_transaction_update

-- Automatic balance updates
TRIGGER tr_transaction_insert

-- No negative balances
TRIGGER tr_user_balance_check
```

#### **🔄 Transaction Reversal:**
```sql
-- Safe transaction reversal
CALL ReverseTransaction(tx_id, 'reason');
```

---

## 📈 **Expected Test Results**

### **Development/Test Environment:**
```
📊 Test Results Summary:
✅ Passed: 23/23 tests
📈 Success Rate: 100%

Balance after demo data:
┌─────────┬───────────┬───────────┐
│ (index) │ username  │ balance   │
├─────────┼───────────┼───────────┤
│ 0       │ 'Alice'   │ '1000.00' │
│ 1       │ 'Bob'     │ '3000.00' │
│ 2       │ 'Charlie' │ '1000.00' │
└─────────┴───────────┴───────────┘
```

### **Production Environment:**
```
✅ Database tables created successfully:
   • appeal
   • banned_player
   • game_history
   • table_info
   • transactions
   • user
📊 Total tables: 6
```

---

## 🚨 **Troubleshooting**

### **Common Issues:**

#### **❌ Connection Failed:**
```bash
❌ MySQL Connection Error: Access denied for user 'root'@'localhost'
```
**Solution:**
```bash
# Check MySQL credentials in .env
# Verify MySQL service is running
sudo service mysql start  # Linux
brew services start mysql # macOS
net start mysql          # Windows
```

#### **❌ Database Permission:**
```bash
❌ Error creating database: Access denied
```
**Solution:**
```sql
-- Grant privileges to user
GRANT ALL PRIVILEGES ON *.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
```

#### **❌ Cross-env not found:**
```bash
'cross-env' is not recognized as an internal or external command
```
**Solution:**
```bash
# Install cross-env
npm install --save-dev cross-env
```

#### **❌ Tests hanging:**
```bash
# Test process hangs without output
```
**Solution:**
```bash
# Check if MySQL connection is working
npm run db:create:test
# If still hanging, check MySQL configuration
```

### **Debug Commands:**

```bash
# Check MySQL connection manually
node -e "import mysql from 'mysql2/promise'; console.log('Testing...')"

# Verify environment variables
node -e "console.log(process.env.DB_HOST, process.env.DB_USER)"

# Test database existence
mysql -h localhost -u root -p -e "SHOW DATABASES LIKE '%poker%'"
```

---

## 🎯 **Best Practices**

### **✅ Development:**
- Luôn dùng `npm run db:create:dev` cho development
- Test thường xuyên với `npm run test:db`
- Backup database trước khi thử nghiệm lớn

### **✅ Testing:**
- Dùng `npm run db:create:test` cho isolated testing
- Chạy `npm run test:quick` trong CI/CD
- Verify schema với production

### **✅ Production:**
- **LUÔN LUÔN** backup trước khi chạy `npm run db:create:prod`
- Test trên staging trước
- Monitor logs sau khi deploy

### **❌ Don'ts:**
- ❌ Không chạy production commands trên development
- ❌ Không skip confirmation trong production
- ❌ Không modify transactions trực tiếp trong database

---

## 📚 **Advanced Usage**

### **Custom Environment:**
```bash
# Use custom environment
NODE_ENV=staging npm run db:create

# Override database name
DB_NAME=custom_poker_db npm run db:create:dev
```

### **Backup & Restore:**
```bash
# Backup database
mysqldump -u root -p poker_system_prod > backup.sql

# Restore database
mysql -u root -p poker_system_prod < backup.sql
```

### **Performance Monitoring:**
```sql
-- Check table sizes
SELECT 
  table_name,
  ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.tables 
WHERE table_schema = 'poker_system_prod';

-- Check index usage
SHOW INDEX FROM transactions;
```

---

## 🎉 **Success Indicators**

### **✅ Setup Successful When:**
- All tables created without errors
- Triggers and procedures installed  
- Demo data inserted correctly (dev/test)
- Test suite passes 100%
- No connection issues

### **🚀 Ready for Development:**
```
🎉 Database setup completed successfully!
📊 Total tables: 6
✅ All tests passed
🎮 Ready for card game development!
```

---

## 📞 **Support**

### **Need Help?**
- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues
- Review [CONFIRMATION.md](./create_data/CONFIRMATION.md) for confirmation system
- See [Database.sql](./create_data/Database.sql) for raw SQL schema

### **File Structure:**
```
Server/
├── create_data/
│   ├── createData.js          # Main setup script
│   ├── Database.sql           # Raw SQL schema  
│   ├── README.md              # Setup guide
│   └── CONFIRMATION.md        # Confirmation system
├── tests/
│   ├── DbTest.js              # Comprehensive tests
│   └── QuickDbTest.js         # Quick validation
├── backend/model/
│   ├── DatabaseConnection.js  # Connection handler
│   └── User.js                # User model
└── .env                       # Database config
```

**Happy Coding! 🚀**