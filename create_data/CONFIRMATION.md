# 🔐 User Confirmation Methods

Hướng dẫn các cách đọc xác nhận từ người dùng trong Node.js.

## 📋 **Các phương pháp có sẵn trong createData.js**

### 1️⃣ **Simple Confirmation (Mặc định)**
```bash
npm run db:create:prod
```
- ✅ Đơn giản: Chỉ cần gõ "YES" hoặc "NO"
- ⏰ Có timeout 30 giây tự động hủy
- 🎯 Phù hợp cho hầu hết trường hợp

### 2️⃣ **Advanced Multi-step Confirmation**
```bash
PRODUCTION_ADVANCED_CONFIRM=true npm run db:create:prod
```
- 🛡️ Bảo mật cao với 3 bước xác nhận:
  1. Hỏi có muốn tiếp tục không (y/n)
  2. Phải gõ chính xác tên database
  3. Phải gõ "I UNDERSTAND THE RISKS"

## 🎯 **Cách sử dụng trong code**

### **Method 1: Simple với Timeout**
```javascript
async function getSimpleConfirmation() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    // Timeout sau 30 giây
    const timeout = setTimeout(() => {
      console.log('\n⏰ Timeout! Setup cancelled.');
      rl.close();
      resolve(false);
    }, 30000);

    rl.question('❓ Type "YES" to continue: ', (answer) => {
      clearTimeout(timeout);
      rl.close();
      resolve(answer.trim().toUpperCase() === 'YES');
    });
  });
}
```

### **Method 2: Multi-step Security**
```javascript
async function getUserConfirmation() {
  // Step 1: Basic yes/no
  const step1 = await askYesNo('Do you want to continue?');
  if (!step1) return false;

  // Step 2: Database name confirmation
  const step2 = await askDatabaseName();
  if (!step2) return false;

  // Step 3: Risk acknowledgment
  const step3 = await askRiskAcknowledgment();
  return step3;
}
```

### **Method 3: Menu-driven**
```javascript
async function menuConfirmation() {
  console.log('1. Continue');
  console.log('2. Cancel');
  console.log('3. Show warning again');
  
  const choice = await askChoice();
  // Xử lý choice...
}
```

## ⚙️ **Environment Variables**

```env
# Trong file .env
PRODUCTION_ADVANCED_CONFIRM=true     # Dùng multi-step confirmation
CONFIRMATION_TIMEOUT=30000           # Timeout (ms)
REQUIRE_DATABASE_NAME=true           # Yêu cầu nhập tên DB
```

## 🧪 **Test Confirmations**

```bash
# Test các method khác nhau
node create_data/test-confirmation.js
```

## 💡 **Best Practices**

### ✅ **Nên làm:**
- **Timeout:** Luôn có timeout để tránh treo process
- **Clear instructions:** Hướng dẫn rõ ràng phải gõ gì
- **Case insensitive:** Chấp nhận cả "y", "Y", "yes", "YES"
- **Multiple chances:** Cho phép user thử lại nếu nhập sai
- **Exit gracefully:** Đóng readline và exit process đúng cách

### ❌ **Không nên:**
- **No timeout:** Không có timeout sẽ treo process mãi
- **Unclear prompts:** Câu hỏi không rõ ràng
- **Single chance:** Chỉ cho 1 lần nhập, sai là hủy
- **Memory leaks:** Quên đóng readline interface

## 🔒 **Security Levels**

### 🟢 **Low Security (Development)**
```javascript
const confirmed = await simpleYesNo();
```

### 🟡 **Medium Security (Staging)**
```javascript
const confirmed = await confirmWithTimeout(30000);
```

### 🔴 **High Security (Production)**
```javascript
const confirmed = await multiStepConfirmation();
```

## 🎬 **Example Usage**

```javascript
// Trong production script
if (process.env.NODE_ENV === 'production') {
  const confirmed = await confirmProduction();
  if (!confirmed) {
    console.log('Setup cancelled.');
    process.exit(0);
  }
}

// Tiếp tục với setup...
await dropDatabase();
await createDatabase();
```

## 📱 **Interactive Examples**

### Simple:
```
❓ Type "YES" to continue or "NO" to abort: YES
✅ Confirmed! Proceeding...
```

### Advanced:
```
❓ Do you want to continue? (y/n): y
❓ Type the database name "poker_system_prod" to confirm: poker_system_prod
❓ Type "I UNDERSTAND THE RISKS" to proceed: I UNDERSTAND THE RISKS
✅ All confirmations completed!
```

### Timeout:
```
❓ Type "CONFIRM" within 10 seconds: [no input]
⏰ Timeout! Setup cancelled.
```