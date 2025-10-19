# 🎯 Database Setup Guide

Hướng dẫn sử dụng script `createDataDev.js` để khởi tạo database theo môi trường.

## 🚀 Cách sử dụng

### 1. **Development (mặc định):**
```bash
npm run db:create          # Tương đương npm run db:create:dev
npm run db:create:dev      # Tạo poker_system_dev + demo data
```

### 2. **Test environment:**
```bash
npm run db:create:test     # Tạo poker_system_test + demo data
```

### 3. **Production (có bảo vệ):**
```bash
npm run db:create:prod     # Tạo poker_system_prod (không có demo data)
```

### 4. **Chạy trực tiếp:**
```bash
NODE_ENV=development node create_data/createDataDev.js
```

## 🏗️ Những gì script sẽ làm:

### ✅ **Database Operations:**
1. 🗑️ Xóa database cũ (nếu có)
2. 🏗️ Tạo database mới (`poker_system` hoặc `poker_system_test`)
3. 📋 Tạo tất cả bảng theo thứ tự đúng
4. ⚡ Tạo indexes để tối ưu performance
5. 🎯 Tạo triggers để bảo vệ tính toàn vẹn dữ liệu
6. 📦 Tạo stored procedures cho hoàn tác giao dịch

### 🎭 **Demo Data:**
- 👥 **3 Users:** Alice, Bob (banned), Charlie
- 🎲 **1 Poker Table:** 2-6 players, blinds 50-100
- 💰 **Transactions:** Nạp tiền + chuyển tiền (tự động cập nhật balance)
- 🎮 **Game History:** 1 ván Texas Hold'em
- 🚫 **Ban Report:** Bob bị báo cáo
- 📞 **Appeal:** Bob khiếu nại

### 🧪 **Auto Tests:**
Script sẽ tự động test các tính năng:
1. ✅ Kiểm tra số dư sau khi chèn data
2. 🚫 Test trigger ngăn xóa giao dịch  
3. 🚫 Test trigger ngăn sửa giao dịch
4. 🔄 Test hoàn tác giao dịch bằng procedure
5. 📊 Hiển thị số dư sau hoàn tác
6. 📋 Hiển thị lịch sử giao dịch chi tiết

## 📊 **Kết quả mong đợi:**

### Balance sau demo data:
```
┌─────────┬──────────┬─────────┐
│ (index) │ username │ balance │
├─────────┼──────────┼─────────┤
│    0    │ 'Alice'  │ '-3000' │ <- Nạp 5000, chuyển 3000+1000
│    1    │  'Bob'   │ '3000'  │ <- Nhận 3000 từ Alice
│    2    │ 'Charlie'│ '1000'  │ <- Nhận 1000 từ Alice  
└─────────┴──────────┴─────────┘
```

### Balance sau hoàn tác TX#3:
```
┌─────────┬──────────┬─────────┐
│ (index) │ username │ balance │
├─────────┼──────────┼─────────┤
│    0    │ 'Alice'  │ '-2000' │ <- Được hoàn lại 1000
│    1    │  'Bob'   │ '3000'  │ <- Không đổi
│    2    │ 'Charlie'│   '0'   │ <- Trả lại 1000 cho Alice
└─────────┴──────────┴─────────┘
```

## 🛠️ **Cấu hình Database:**

Script sẽ đọc từ file `.env`:
```env
DB_HOST=localhost
DB_USER=root  
DB_PASSWORD=your_password
NODE_ENV=development  # 'development' | 'test' | 'production'
```

## 🗄️ **Database Names theo môi trường:**

| Môi trường | Database Name | Demo Data | Tests |
|------------|---------------|-----------|-------|
| `development` | `poker_system_dev` | ✅ Có | ✅ Chi tiết |
| `test` | `poker_system_test` | ✅ Có | ✅ Chi tiết |
| `production` | `poker_system_prod` | ❌ Không | ⚠️ Cơ bản |

## 🎯 **Features được tạo:**

### 🛡️ **Triggers bảo vệ:**
- ❌ Không cho xóa giao dịch
- ❌ Không cho sửa giao dịch  
- ✅ Tự động cập nhật số dư khi có giao dịch
- 🚫 Không cho số dư âm

### 🔄 **Hoàn tác giao dịch:**
```sql
CALL ReverseTransaction(tx_id, 'Lý do hoàn tác');
```

### 📋 **Audit Trail:**
Mọi giao dịch hoàn tác được đánh dấu trong `reason`:
```
"REVERSAL of TX#123 - Lý do hoàn tác"
```

## 🚨 **Lưu ý an toàn:**

### ⚠️ **Production Safety:**
- Script có **bảo vệ production** - sẽ từ chối chạy
- Cần remove safety check trong code nếu thực sự muốn chạy prod
- **LUÔN LUÔN** backup trước khi chạy production!

### 🗑️ **Data Loss Warning:**
- Script sẽ **XÓA HOÀN TOÀN** database cũ
- Tất cả dữ liệu hiện tại sẽ bị mất
- Không thể khôi phục sau khi chạy

### 🎯 **Environment-specific behavior:**
```bash
# Development: Full demo + tests
npm run db:create:dev     # poker_system_dev + Alice, Bob, Charlie + tests

# Test: Full demo + tests  
npm run db:create:test    # poker_system_test + Alice, Bob, Charlie + tests

# Production: Clean setup only
npm run db:create:prod    # poker_system_prod + NO demo data + basic tests
```

## 🎉 **Kết quả thành công:**

### Development/Test:
```
🚀 Starting database creation process for DEVELOPMENT environment...
✅ Database poker_system_dev created and selected!
🎭 Inserting demo data for development environment...
🧪 Running detailed tests for development...
🎉 Database setup completed successfully!
```

### Production:
```
🚀 Starting database creation process for PRODUCTION environment...
⚠️  WARNING: Running in PRODUCTION mode!
✅ Database poker_system_prod created and selected!
🎭 Skipping demo data for production environment
🧪 Running basic tests for production...
✅ Production setup completed successfully!
```