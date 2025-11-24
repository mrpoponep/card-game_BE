# 🔄 Database Migration & Setup Tools

Hệ thống tự động để quản lý database schema và migration data an toàn.

## 📁 Files

### 1. `sqlParser.js`
**Parse file Database.sql** để trích xuất cấu trúc:
- Tables, columns, constraints
- Indexes
- Triggers
- Stored procedures
- Sample data

**Sử dụng:**
```bash
node sqlParser.js
```

### 2. `migrationTool.js` ⭐ **QUAN TRỌNG**
**Migration tool thông minh** để cập nhật schema KHÔNG MẤT DỮ LIỆU:
- So sánh schema hiện tại vs schema mới từ Database.sql
- Tự động phát hiện thay đổi (tables mới/xóa, columns thêm/bớt/đổi type)
- Backup dữ liệu cũ
- Migrate dữ liệu sang schema mới
- Map columns tự động (giữ data ở columns trùng tên)

**Sử dụng:**
```bash
node migrationTool.js
```

**Khi nào dùng:**
- ✅ Khi Database.sql thay đổi và muốn GIỮ DỮ LIỆU CŨ
- ✅ Khi thêm/sửa/xóa columns
- ✅ Khi rename tables
- ✅ Production updates

**Quy trình:**
1. Sửa `Database.sql` theo cấu trúc mới
2. Chạy `node migrationTool.js`
3. Tool sẽ:
   - Phân tích sự khác biệt
   - Hiển thị migration plan
   - Xin xác nhận
   - Backup data
   - Recreate DB với schema mới
   - Restore data (map tự động)

### 3. `createDataV2.js`
**Database creator mới** đọc từ Database.sql:
- Parse và execute Database.sql
- Tự động phát hiện tables, triggers, procedures
- Không cần hardcode như `createData.js` cũ
- Hỗ trợ dev/test/production environments
- Skip sample data cho production

**Sử dụng:**
```bash
# Development
node createDataV2.js

# Test
NODE_ENV=test node createDataV2.js

# Production
NODE_ENV=production node createDataV2.js
```

**Khi nào dùng:**
- ✅ Setup database mới từ đầu
- ✅ Reset toàn bộ database (MẤT DATA)
- ✅ Development/testing fresh start
- ❌ KHÔNG dùng khi muốn giữ data (dùng migrationTool.js)

### 4. `createData.js` (Old)
Version cũ với hardcoded schema. Vẫn giữ để tham khảo.

## 🚀 Quick Start Guide

### Scenario 1: Setup Database Lần Đầu
```bash
# Development
cd Server/create_data
node createDataV2.js
```

### Scenario 2: Cập Nhật Schema (GIỮ DATA) ⭐
```bash
# 1. Sửa Database.sql theo yêu cầu mới
# 2. Chạy migration
cd Server/create_data
node migrationTool.js

# Tool sẽ:
# - So sánh schema cũ vs mới
# - Hiển thị changes
# - Backup data tự động
# - Migrate data sang schema mới
```

### Scenario 3: Reset Toàn Bộ (MẤT DATA)
```bash
cd Server/create_data
node createDataV2.js
```

## 📊 Migration Examples

### Example 1: Thêm Column Mới
**Database.sql (before):**
```sql
CREATE TABLE User (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL
);
```

**Database.sql (after):**
```sql
CREATE TABLE User (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255),  -- NEW COLUMN
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- NEW COLUMN
);
```

**Chạy migration:**
```bash
node migrationTool.js
```

**Kết quả:**
- ✅ Data cũ (user_id, username, password) giữ nguyên
- ✅ Columns mới (email, created_at) được thêm với default values
- ✅ Không mất data

### Example 2: Đổi Column Type
**Database.sql (before):**
```sql
balance DECIMAL(10,2)
```

**Database.sql (after):**
```sql
balance DECIMAL(15,2)  -- Tăng độ chính xác
```

**Chạy migration:**
```bash
node migrationTool.js
```

**Kết quả:**
- ✅ Data balance cũ được giữ nguyên
- ✅ Column type được update
- ✅ Không mất data

### Example 3: Xóa Column
**Database.sql (before):**
```sql
CREATE TABLE User (
    user_id INT,
    username VARCHAR(100),
    old_field VARCHAR(100),  -- Column sẽ bị xóa
    password VARCHAR(255)
);
```

**Database.sql (after):**
```sql
CREATE TABLE User (
    user_id INT,
    username VARCHAR(100),
    -- old_field đã bị xóa
    password VARCHAR(255)
);
```

**Chạy migration:**
```bash
node migrationTool.js
```

**Kết quả:**
- ⚠️ Tool sẽ cảnh báo "old_field will be dropped"
- ✅ Data từ old_field được backup
- ✅ Các columns khác giữ nguyên data
- ℹ️ Data của old_field có thể restore thủ công từ backup

## 🔒 Safety Features

### MigrationTool Safety:
1. **Pre-migration Analysis**: Hiển thị tất cả changes trước khi thực hiện
2. **Automatic Backup**: Backup data trước khi migrate
3. **Confirmation Required**: Xin xác nhận trước khi thực hiện changes nguy hiểm
4. **Column Mapping**: Tự động map columns trùng tên, giữ data
5. **Rollback Available**: Data backup lưu trong memory, có thể restore

### Production Safety:
- ✅ Confirmation dialog với nhiều bước
- ✅ Check database exists trước khi drop
- ✅ Skip sample data cho production
- ✅ Detailed logging
- ✅ Error handling với rollback

## 📋 Environment Variables

```env
# .env file
NODE_ENV=development          # development | test | production
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=poker_system_dev      # Optional, auto-detected from NODE_ENV
```

**Database names by environment:**
- `development` → `poker_system_dev`
- `test` → `poker_system_test`
- `production` → `poker_system`

## 🔍 Workflow Diagram

```
┌─────────────────────────────────────────────────┐
│  Developer sửa Database.sql                     │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Chạy: node migrationTool.js                    │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  sqlParser.js parse Database.sql                │
│  - Đọc cấu trúc mới                             │
│  - Parse tables, triggers, procedures           │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  migrationTool.js so sánh schemas               │
│  - Current DB schema vs New schema              │
│  - Detect: new tables, dropped tables           │
│  - Detect: new columns, dropped columns         │
│  - Detect: type changes                         │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Hiển thị Migration Plan                        │
│  📋 New tables: [...]                           │
│  🗑️  Dropped tables: [...]                      │
│  🔄 Modified tables: [...]                      │
│      + Add columns: [...]                       │
│      - Drop columns: [...]                      │
│      ~ Modify columns: [...]                    │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Xin confirmation                               │
│  ⚠️  This will recreate database                │
│  ❓ Continue? (yes/no)                          │
└────────────────┬────────────────────────────────┘
                 │ yes
                 ▼
┌─────────────────────────────────────────────────┐
│  💾 Backup current data                         │
│  - Backup tables có changes                     │
│  - Store in memory                              │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  🗑️  DROP DATABASE                              │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  🏗️  CREATE DATABASE                            │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  ⚡ Execute Database.sql                        │
│  - Create tables                                │
│  - Create triggers                              │
│  - Create procedures                            │
│  - Create indexes                               │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  📥 Restore data from backup                    │
│  - Map old columns → new columns                │
│  - Insert data với matching columns             │
│  - Skip non-matching columns                    │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  ✅ Migration completed!                        │
│  📊 Show statistics:                            │
│     - Tables created                            │
│     - Data rows migrated                        │
│     - Columns mapped                            │
└─────────────────────────────────────────────────┘
```

## 💡 Best Practices

### DO ✅:
1. **Luôn chạy migrationTool.js** khi Database.sql thay đổi
2. **Backup production** trước khi migrate (ngoài tool backup)
3. **Test migration trên dev/test** trước khi chạy production
4. **Review migration plan** cẩn thận trước khi confirm
5. **Giữ Database.sql** là single source of truth

### DON'T ❌:
1. ❌ Không edit database trực tiếp bằng SQL commands thủ công
2. ❌ Không skip confirmation trên production
3. ❌ Không chạy createDataV2.js trên production có data (dùng migrationTool.js)
4. ❌ Không sửa schema trong createData.js cũ (sửa Database.sql)

## 🐛 Troubleshooting

### Issue: "No changes detected"
- Kiểm tra Database.sql có đúng cấu trúc không
- Kiểm tra database name trong .env
- Chạy với --verbose để xem chi tiết

### Issue: "Column mapping failed"
- Manually map columns khi tool hỏi
- Hoặc accept data loss cho columns bị xóa

### Issue: "Migration failed midway"
- Data backup vẫn trong memory
- Check error message
- Có thể restore thủ công từ backup
- Hoặc rerun migration sau khi fix lỗi

## 📚 Additional Resources

- **Database.sql**: Single source of truth cho schema
- **ENV_SETUP.md**: Environment setup guide
- **MYSQL_SETUP.md**: MySQL installation guide

## 🎯 Summary

| Tool | Use Case | Data Safety |
|------|----------|-------------|
| **migrationTool.js** | Update schema, keep data | ✅ Safest |
| **createDataV2.js** | Fresh setup, reset DB | ❌ Loses data |
| **createData.js** | Legacy, deprecated | ❌ Loses data |
| **sqlParser.js** | Analyze Database.sql | ℹ️ Read-only |

**Recommendation:** Luôn dùng `migrationTool.js` khi Database.sql thay đổi!
