# 🧪 Ranking System Test - 100 Players

Test script tự động thêm 100 người chơi ngẫu nhiên, chạy server để kiểm tra hệ thống ranking, và tự động dọn dẹp sau khi kết thúc.

## 🚀 Cách sử dụng

### 1. Chạy test
```bash
cd Server
npm run test:ranking
```

### 2. Quá trình test sẽ:
1. ✅ Thêm 100 người chơi với ELO ngẫu nhiên (1000-3000)
2. ✅ Hiển thị Top 10 ELO
3. ✅ Tự động khởi động server ở môi trường **TEST** (`http://localhost:3000`)
4. ⏳ Server chạy và chờ bạn test
5. 🛑 Nhấn `q + Enter` để dừng
6. 🧹 Tự động xóa 100 người chơi test
7. 👋 Thoát

## 📊 Output mẫu

```
╔════════════════════════════════════════════════════════════╗
║          🎮 RANKING SYSTEM TEST - 100 Players            ║
╚════════════════════════════════════════════════════════════╝

🎮 Bắt đầu thêm 100 người chơi test...

✅ Đã thêm 10/100 người chơi...
✅ Đã thêm 20/100 người chơi...
...
✅ Đã thêm 100/100 người chơi...

🎉 Đã thêm thành công 100 người chơi!
📊 User IDs: 123 - 222

🏆 Top 10 ELO:
┌─────────┬─────────────────┬──────┬──────────┐
│ (index) │    username     │ elo  │ balance  │
├─────────┼─────────────────┼──────┼──────────┤
│    0    │ 'Legend_45_...' │ 2987 │  89234   │
│    1    │ 'Master_78_...' │ 2856 │  45678   │
│   ...   │      ...        │ ...  │   ...    │
└─────────┴─────────────────┴──────┴──────────┘

🚀 Đang khởi động server (môi trường TEST)...

✅ Server đã khởi động!
🌐 Truy cập: http://localhost:3000
🗄️  Database: poker_system_test

⚠️  Nhấn q+Enter để dừng server và dọn dẹp dữ liệu test...
```

## 🔧 Chi tiết kỹ thuật

### Dữ liệu được tạo:
- **Username**: Ngẫu nhiên từ pool (Player, Gamer, Pro, Legend, etc.) + số thứ tự + timestamp
- **Password**: `test_password_hash` (giống nhau cho tất cả)
- **Balance**: Ngẫu nhiên từ 0 đến 100,000
- **ELO**: Ngẫu nhiên từ 1,000 đến 3,000
- **Role**: `Player`
- **Banned**: `false`

### Quy trình dọn dẹp:
1. Lưu tất cả `user_id` khi INSERT
2. Khi nhận signal `SIGINT` (q+Enter):
   - Dừng server process
   - DELETE tất cả user theo danh sách `user_id`
   - Disconnect database
   - Exit process

### Lợi ích:
- ✅ **An toàn**: Chỉ xóa đúng 100 user được thêm vào
- ✅ **Tự động**: Không cần thao tác thủ công
- ✅ **Nhanh chóng**: Thêm 100 user trong vài giây
- ✅ **Trực quan**: Log progress và top 10

## ⚠️ Lưu ý

1. **Database phải tồn tại** trước khi chạy test (chạy `npm run db:create:test`)
2. **Port 3000 phải rảnh** để server có thể start
3. **Nhớ nhấn q+Enter** để dọn dẹp, nếu không user test sẽ còn lại trong DB
4. Test chạy trên môi trường `test` (database: `poker_system_test`)
5. **Dữ liệu test cách ly**: Không ảnh hưởng đến database development/production

## 🐛 Troubleshooting

### Lỗi: "Cannot find module"
```bash
# Cài đặt dependencies
npm install
```

### Lỗi: "Database connection failed"
```bash
# Kiểm tra .env và tạo database
npm run db:create:dev
```

### Lỗi: "Port 3000 already in use"
```bash
# Dừng process đang dùng port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:3000 | xargs kill -9
```

### User test không bị xóa
```bash
# Xóa thủ công (username có pattern test)
# Vào MySQL và chạy:
DELETE FROM User WHERE username LIKE '%_[0-9]_%';
```

## 📝 Tùy chỉnh

### Thay đổi số lượng user:
Sửa file `tests/testRanking.js`:
```javascript
for (let i = 1; i <= 100; i++) {  // Đổi 100 thành số khác
```

### Thay đổi khoảng ELO:
```javascript
elo: 1000 + Math.floor(Math.random() * 2000), // Đổi 1000 và 2000
```

### Thay đổi port server:
Sửa file `backend/server.js` hoặc `.env`

## 🎯 Use Cases

- ✅ Test ranking system với dữ liệu lớn
- ✅ Demo tính năng leaderboard
- ✅ Kiểm tra performance query với nhiều records
- ✅ Test pagination trên ranking modal
- ✅ Validate logic sorting theo ELO

---

**Happy Testing!** 🎮
