# 🚀 Quick Reference - Database Tools

## Câu lệnh nhanh

### 1️⃣ Setup Database Mới (Fresh Install)
```bash
npm run db:setup          # Development
npm run db:setup:test     # Test
npm run db:setup:prod     # Production
```
**⚠️ MẤT TẤT CẢ DỮ LIỆU CŨ!**

---

### 2️⃣ Migrate Database (GIỮ DỮ LIỆU) ⭐ RECOMMENDED
```bash
npm run db:migrate
```
**✅ AN TOÀN - Giữ dữ liệu cũ**

Khi nào dùng:
- ✅ Database.sql thay đổi
- ✅ Thêm/sửa/xóa columns
- ✅ Thêm/sửa/xóa tables
- ✅ Production updates

---

### 3️⃣ Parse Database.sql (Xem cấu trúc)
```bash
npm run db:parse
```
**ℹ️ Read-only - Không thay đổi gì**

---

### 4️⃣ Legacy Create (Old method)
```bash
npm run db:create         # Development
npm run db:create:test    # Test
npm run db:create:prod    # Production
```
**⚠️ Hardcoded schema - Không nên dùng nữa**

---

## 📊 So sánh Tools

| Command | Tool | Giữ Data? | Use Case |
|---------|------|-----------|----------|
| `npm run db:migrate` | migrationTool.js | ✅ YES | **Cập nhật schema** |
| `npm run db:setup` | createDataV2.js | ❌ NO | Setup mới |
| `npm run db:create` | createData.js | ❌ NO | Legacy |
| `npm run db:parse` | sqlParser.js | - | Xem cấu trúc |

---

## 🎯 Workflow Thông Dụng

### Scenario A: Lần đầu setup project
```bash
cd Server
npm install
npm run db:setup
npm run dev
```

### Scenario B: Database.sql thay đổi
```bash
# 1. Sửa Database.sql
# 2. Chạy migration
npm run db:migrate

# 3. Confirm changes
# 4. Done! Data được giữ nguyên
```

### Scenario C: Reset toàn bộ (development)
```bash
npm run db:setup
```

---

## 🔍 Chi tiết từng tool

### migrationTool.js
**Input:** Database.sql (schema mới)  
**Output:** Database với schema mới + data cũ được migrate  
**Process:**
1. Parse Database.sql
2. Compare với schema hiện tại
3. Show migration plan
4. Xin confirmation
5. Backup data
6. Drop & recreate DB
7. Restore data (auto-map columns)

**Example:**
```bash
npm run db:migrate

# Output:
# 📋 MIGRATION PLAN:
# 1. 🆕 Create new table: User_Logs
# 2. ➕ Add column: User.email
# 3. ➕ Add column: User.created_at
# 4. 🔄 Modify column: User.balance (DECIMAL(10,2) → DECIMAL(15,2))
# 
# ❓ Continue with migration? (yes/no)
```

---

### createDataV2.js
**Input:** Database.sql  
**Output:** Fresh database từ Database.sql  
**Process:**
1. Parse Database.sql
2. Drop database
3. Create database
4. Execute all SQL statements
5. Insert sample data (dev/test only)

**Example:**
```bash
npm run db:setup

# Output:
# 📖 Parsing SQL file...
# ✅ Total tables parsed: 7
# 🗑️  Dropping database...
# 🏗️  Creating database...
# ⚡ Executing SQL statements...
# ✅ Database setup completed!
```

---

### sqlParser.js
**Input:** Database.sql  
**Output:** Parsed structure (console output)  
**Process:**
1. Read Database.sql
2. Parse tables, columns, constraints
3. Parse indexes, triggers, procedures
4. Display summary

**Example:**
```bash
npm run db:parse

# Output:
# 📊 SQL PARSING SUMMARY
# ====================================
# 📋 Tables: 7
#    • User: 7 columns
#    • Transactions: 7 columns
#    • Table_Info: 8 columns
#    ...
# ⚡ Indexes: 5
# 🎯 Triggers: 4
# 📦 Procedures: 1
```

---

## ⚙️ Environment Variables

```env
NODE_ENV=development          # development | test | production
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=poker_system_dev      # Optional
```

---

## 🆘 Help & Documentation

- **Full Guide:** `Server/create_data/MIGRATION_GUIDE.md`
- **Issues:** Check error messages, usually self-explanatory
- **Support:** Read MIGRATION_GUIDE.md for detailed examples

---

## 💡 Tips

1. **Luôn dùng `npm run db:migrate`** khi Database.sql thay đổi
2. **Backup production** trước khi migrate (bên ngoài tool)
3. **Test migration trên dev** trước khi chạy production
4. **Database.sql là single source of truth** - Không edit DB trực tiếp

---

## ⚠️ Warnings

- ❌ **KHÔNG** chạy `db:setup` trên production có data → Dùng `db:migrate`
- ❌ **KHÔNG** edit database bằng SQL commands thủ công → Sửa Database.sql rồi migrate
- ❌ **KHÔNG** skip confirmation trên production
- ✅ **LUÔN** backup production trước khi migrate

---

**Last Updated:** 2025-10-15
