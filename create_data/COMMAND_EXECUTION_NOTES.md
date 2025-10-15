# 📋 Command Execution - Sequential Processing

## ✅ Những gì đã thay đổi

### Before ❌
```javascript
// executeSQLFile() - Cũ
async executeSQLFile() {
  // Đọc toàn bộ SQL như một string lớn
  const sqlContent = this.parser.sqlContent;
  
  // Xóa bỏ DROP/CREATE/USE DATABASE bằng regex
  let cleanSql = sqlContent
    .replace(/DROP\s+DATABASE.../gi, '')
    .replace(/CREATE\s+DATABASE.../gi, '');
  
  // Execute toàn bộ như một script lớn (multiStatements)
  await db.query(cleanSql);
}
```

**Vấn đề:**
- ❌ Không kiểm soát từng lệnh riêng lẻ
- ❌ Khó debug khi có lỗi (không biết lệnh nào bị lỗi)
- ❌ Không linh hoạt (khó skip các lệnh cụ thể)
- ❌ Phụ thuộc vào multiStatements (không phải pool nào cũng hỗ trợ)

### After ✅
```javascript
// executeSQLFile() - Mới
async executeSQLFile() {
  // Lấy danh sách commands đã parse theo thứ tự
  const commands = this.parser.commands || [];
  
  // Thực thi TỪNG command một theo thứ tự
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    
    // Skip INSERT nếu production
    if (this.env === 'production' && cmd.type === 'INSERT') {
      skipped++;
      continue;
    }
    
    try {
      // Execute từng lệnh riêng lẻ
      await db.query(cmd.sql);
      executed++;
      
      // Log progress
      if (executed % 5 === 0) {
        console.log(`⚡ Đã thực thi ${executed}/${total} lệnh...`);
      }
      
    } catch (error) {
      // Báo lỗi chi tiết cho TỪNG lệnh
      console.error(`❌ Lỗi lệnh #${i + 1} [${cmd.type}]:`);
      console.error(`   SQL: ${cmd.sql.substring(0, 100)}...`);
      throw error;
    }
  }
}
```

**Lợi ích:**
- ✅ Kiểm soát từng lệnh riêng lẻ
- ✅ Debug dễ dàng (biết chính xác lệnh nào lỗi)
- ✅ Linh hoạt skip/filter commands theo điều kiện
- ✅ Không phụ thuộc multiStatements
- ✅ Progress tracking chi tiết

## 🔄 SQLParser - Command-Based Approach

### Cấu trúc Command
```javascript
{
  type: 'CREATE_TABLE' | 'CREATE_INDEX' | 'CREATE_TRIGGER' | 'CREATE_PROCEDURE' | 'INSERT',
  name: 'User',           // Tên table/index/trigger/procedure
  table: 'User',          // Tên table (cho INSERT)
  sql: 'CREATE TABLE...', // Câu SQL đầy đủ
  position: 1234,         // Vị trí trong file gốc
  // ... các thuộc tính khác tùy loại
}
```

### Quy trình Parse
```
Database.sql
    ↓
parseCommandsInOrder()
    ↓
[cmd1, cmd2, cmd3, ...] (sorted by position)
    ↓
categorizeCommands()
    ↓
{
  commands: [cmd1, cmd2, ...],  // Thứ tự thực thi
  tables: Map,                  // Thống kê
  indexes: [],
  triggers: [],
  procedures: [],
  sampleData: []
}
```

## 🎯 Use Cases

### 1. Skip INSERT trong Production
```javascript
if (this.env === 'production' && cmd.type === 'INSERT') {
  skipped++;
  continue;
}
```

### 2. Debug Chi Tiết
```javascript
catch (error) {
  console.error(`❌ Lỗi lệnh #${i + 1} [${cmd.type}]: ${cmd.name || cmd.table}`);
  console.error(`   SQL: ${cmd.sql.substring(0, 100)}...`);
  console.error(`   Lỗi: ${error.message}`);
  throw error;
}
```

### 3. Progress Tracking
```javascript
if (executed % 5 === 0) {
  console.log(`⚡ Đã thực thi ${executed}/${total} lệnh...`);
}
```

### 4. Retry Logic (Tương lai)
```javascript
for (let retry = 0; retry < 3; retry++) {
  try {
    await db.query(cmd.sql);
    break;
  } catch (error) {
    if (retry === 2) throw error;
    console.log(`⚠️  Retry ${retry + 1}/3...`);
  }
}
```

## 📊 Output Example

```
🏗️  Đang thực thi các lệnh SQL theo thứ tự...
   ⚡ Đã thực thi 5/42 lệnh...
   ⚡ Đã thực thi 10/42 lệnh...
   ⚡ Đã thực thi 15/42 lệnh...
   ⚡ Đã thực thi 20/42 lệnh...
   ⚡ Đã thực thi 25/42 lệnh...
   ⚡ Đã thực thi 30/42 lệnh...
   ⚡ Đã thực thi 35/42 lệnh...
   ⚡ Đã thực thi 40/42 lệnh...
✅ Đã thực thi tệp SQL thành công!
   • 42 lệnh đã được thực thi
   • 6 bảng đã được tạo
   • 5 chỉ mục đã được tạo
   • 4 triggers đã được tạo
   • 1 procedures đã được tạo
   • 8 câu lệnh dữ liệu mẫu đã được thực thi
```

## 🚀 Performance

### Sequential vs Batch
- **Sequential** (hiện tại): Thực thi từng lệnh → Chậm hơn nhưng dễ debug
- **Batch** (tương lai): Nhóm các lệnh không phụ thuộc → Nhanh hơn

### Optimization Ideas
```javascript
// Tương lai: Batch non-dependent commands
const batches = groupIndependentCommands(commands);
for (const batch of batches) {
  await Promise.all(batch.map(cmd => db.query(cmd.sql)));
}
```

## 🔍 Debugging Tips

### 1. In ra command đang thực thi
```javascript
console.log(`Executing #${i + 1}: [${cmd.type}] ${cmd.name || cmd.table}`);
await db.query(cmd.sql);
```

### 2. Dry run mode
```javascript
if (process.env.DRY_RUN === 'true') {
  console.log(`[DRY RUN] ${cmd.type}: ${cmd.sql.substring(0, 50)}...`);
  continue;
}
```

### 3. Lưu failed commands
```javascript
const failed = [];
for (const cmd of commands) {
  try {
    await db.query(cmd.sql);
  } catch (error) {
    failed.push({ cmd, error });
  }
}
// Retry failed commands sau
```

## 📝 Summary

| Aspect | Old Approach | New Approach |
|--------|-------------|--------------|
| **Execution** | Một script lớn | Từng lệnh riêng lẻ |
| **Error Handling** | Không biết lệnh nào lỗi | Biết chính xác lệnh lỗi |
| **Progress** | Không có | Log mỗi 5 lệnh |
| **Flexibility** | Khó skip lệnh | Dễ skip theo điều kiện |
| **Debugging** | Khó | Dễ dàng |
| **Performance** | Nhanh hơn | Chậm hơn một chút |

**Trade-off:** Đổi một chút performance để được control và debugging tốt hơn nhiều! 🎯
