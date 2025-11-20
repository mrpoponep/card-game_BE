# 💾 VNPay Payment - Sử Dụng Bảng Transactions Có Sẵn

## ✅ Giải Pháp

Thay vì tạo bảng mới `payment_transactions`, chúng ta sử dụng **bảng `Transactions` có sẵn** trong database và lưu thông tin VNPay vào field `reason` dưới dạng string format.

---

## 📊 Database Schema (Transactions Table)

```sql
CREATE TABLE Transactions (
    tx_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    source_id INT NULL,              -- Room/game ID (nullable cho payment)
    amount DECIMAL(15,2) NOT NULL,
    reason TEXT NULL,                -- ✨ Lưu VNPay data ở đây
    source VARCHAR(100) NULL,        -- 'vnpay' cho payment transactions
    time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES User(user_id),
    FOREIGN KEY (source_id) REFERENCES Room(room_id)
);
```

---

## 🎯 Data Mapping

### VNPay Fields → Transactions Fields

| VNPay Field | Transactions Field | Format |
|-------------|-------------------|--------|
| txn_ref | `reason` | `txnRef:1_1763655650\|...` |
| order_info | `reason` | `orderInfo:Nap 100k\|...` |
| status | `reason` | `status:SUCCESS\|...` |
| response_code | `reason` | `responseCode:00\|...` |
| transaction_no | `reason` | `transactionNo:15273694\|...` |
| amount | `amount` | 100000 (VNĐ) |
| user_id | `user_id` | 1 |
| - | `source` | 'vnpay' |
| - | `source_id` | NULL (không có room) |

---

## 📝 Reason Field Format

### Structure:
```
txnRef:{value}|orderInfo:{value}|status:{value}|responseCode:{value}|transactionNo:{value}
```

### Example (PENDING):
```
txnRef:1_1763655650|orderInfo:Nap goi 100000|status:PENDING
```

### Example (SUCCESS):
```
txnRef:1_1763655650|orderInfo:Nap goi 100000|status:SUCCESS|responseCode:00|transactionNo:15273694
```

### Example (FAILED):
```
txnRef:1_1763655650|orderInfo:Nap goi 100000|status:FAILED|responseCode:24|transactionNo:15273695
```

---

## 🔧 Transaction Model Methods

### 1. Build Reason String
```javascript
static buildReason({ txnRef, orderInfo, status, responseCode, transactionNo }) {
    const parts = [];
    if (txnRef) parts.push(`txnRef:${txnRef}`);
    if (orderInfo) parts.push(`orderInfo:${orderInfo}`);
    if (status) parts.push(`status:${status}`);
    if (responseCode) parts.push(`responseCode:${responseCode}`);
    if (transactionNo) parts.push(`transactionNo:${transactionNo}`);
    return parts.join('|');
}
```

**Usage:**
```javascript
const reason = Transaction.buildReason({
    txnRef: '1_1763655650',
    orderInfo: 'Nap goi 100k',
    status: 'PENDING'
});
// → "txnRef:1_1763655650|orderInfo:Nap goi 100k|status:PENDING"
```

---

### 2. Parse Reason String
```javascript
parseReason() {
    if (!this.reason) return {};
    
    const parts = this.reason.split('|');
    const result = {};
    
    parts.forEach(part => {
        const [key, value] = part.split(':');
        if (key && value) {
            result[key] = value;
        }
    });
    
    return result;
}
```

**Usage:**
```javascript
const transaction = await Transaction.findByTxnRef('1_1763655650');
const parsed = transaction.parseReason();
console.log(parsed);
// → {
//     txnRef: '1_1763655650',
//     orderInfo: 'Nap goi 100k',
//     status: 'SUCCESS',
//     responseCode: '00',
//     transactionNo: '15273694'
//   }
```

---

### 3. Find By TxnRef
```javascript
static async findByTxnRef(txnRef) {
    const dbRows = await db.query(
        "SELECT * FROM Transactions WHERE source = 'vnpay' AND reason LIKE ? LIMIT 1",
        [`txnRef:${txnRef}%`]
    );
    if (dbRows && dbRows.length > 0) {
        return new Transaction(dbRows[0]);
    }
    return null;
}
```

**Usage:**
```javascript
const transaction = await Transaction.findByTxnRef('1_1763655650');
if (transaction) {
    console.log('Found transaction:', transaction.toJSON());
}
```

---

### 4. Insert Transaction
```javascript
static async insertIntoDatabase(transaction) {
    const query = `
        INSERT INTO Transactions (user_id, source_id, amount, reason, source, time)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await db.query(query, [
        transaction.user_id,
        transaction.source_id,
        transaction.amount,
        transaction.reason,
        transaction.source,
        transaction.time
    ]);
    transaction.tx_id = result.insertId;
    return transaction;
}
```

**Usage:**
```javascript
const reason = Transaction.buildReason({
    txnRef: '1_1763655650',
    orderInfo: 'Nap 100k',
    status: 'PENDING'
});

const transaction = new Transaction({
    user_id: 1,
    source_id: null,
    amount: 100000,
    reason: reason,
    source: 'vnpay',
    time: new Date()
});

await transaction.save();
```

---

### 5. Update Transaction
```javascript
static async updateInDatabase(transaction) {
    const query = `
        UPDATE Transactions
        SET reason = ?, amount = ?
        WHERE tx_id = ?
    `;
    await db.query(query, [
        transaction.reason,
        transaction.amount,
        transaction.tx_id
    ]);
    return transaction;
}
```

**Usage:**
```javascript
const transaction = await Transaction.findByTxnRef('1_1763655650');
const parsed = transaction.parseReason();

// Update status to SUCCESS
transaction.reason = Transaction.buildReason({
    ...parsed,
    status: 'SUCCESS',
    responseCode: '00',
    transactionNo: '15273694'
});

await transaction.save();
```

---

## 🎬 Payment Flow Examples

### 1️⃣ Create Payment (PENDING)
```javascript
// paymentController.js - createPaymentUrl()
const reason = Transaction.buildReason({
    txnRef: '1_1763655650',
    orderInfo: 'Nap goi 100000',
    status: 'PENDING'
});

await Transaction.insertIntoDatabase(new Transaction({
    user_id: 1,
    source_id: null,
    amount: 100000,
    reason: reason,
    source: 'vnpay',
    time: new Date()
}));
```

**Database Result:**
```
tx_id: 123
user_id: 1
source_id: NULL
amount: 100000.00
reason: "txnRef:1_1763655650|orderInfo:Nap goi 100000|status:PENDING"
source: "vnpay"
time: 2025-11-20 16:30:00
```

---

### 2️⃣ Update to SUCCESS
```javascript
// paymentController.js - vnpayReturn()
const transaction = await Transaction.findByTxnRef('1_1763655650');
const parsed = transaction.parseReason();

transaction.reason = Transaction.buildReason({
    txnRef: parsed.txnRef,
    orderInfo: parsed.orderInfo,
    status: 'SUCCESS',
    responseCode: '00',
    transactionNo: '15273694'
});

await transaction.save();
await User.updateBalanceById(transaction.user_id, 100000);
```

**Database Result:**
```
tx_id: 123
user_id: 1
source_id: NULL
amount: 100000.00
reason: "txnRef:1_1763655650|orderInfo:Nap goi 100000|status:SUCCESS|responseCode:00|transactionNo:15273694"
source: "vnpay"
time: 2025-11-20 16:30:00
```

---

## 📊 SQL Queries

### View All VNPay Payments
```sql
SELECT 
    tx_id,
    user_id,
    amount,
    reason,
    time
FROM Transactions
WHERE source = 'vnpay'
ORDER BY time DESC
LIMIT 20;
```

### View User Payment History
```sql
SELECT 
    t.tx_id,
    t.amount,
    t.reason,
    t.time,
    u.username
FROM Transactions t
JOIN User u ON t.user_id = u.user_id
WHERE t.source = 'vnpay' AND u.username = 'Alice'
ORDER BY t.time DESC;
```

### Filter by Status (Extract from reason)
```sql
-- Successful payments
SELECT * FROM Transactions
WHERE source = 'vnpay' 
AND reason LIKE '%status:SUCCESS%'
ORDER BY time DESC;

-- Pending payments
SELECT * FROM Transactions
WHERE source = 'vnpay' 
AND reason LIKE '%status:PENDING%'
ORDER BY time DESC;

-- Failed payments
SELECT * FROM Transactions
WHERE source = 'vnpay' 
AND reason LIKE '%status:FAILED%'
ORDER BY time DESC;
```

### Revenue Report
```sql
SELECT 
    DATE(time) as payment_date,
    COUNT(*) as total_transactions,
    SUM(amount) as total_revenue
FROM Transactions
WHERE source = 'vnpay' 
AND reason LIKE '%status:SUCCESS%'
GROUP BY DATE(time)
ORDER BY payment_date DESC;
```

---

## ✅ Advantages

1. **✅ Không cần migration** - Sử dụng bảng có sẵn
2. **✅ Backward compatible** - Không ảnh hưởng đến game transactions hiện có
3. **✅ Flexible** - Dễ thêm fields mới vào `reason` string
4. **✅ Simple** - Chỉ cần parse/build reason string

---

## ⚠️ Limitations

1. **Không thể index** các fields trong `reason` (txnRef, status, etc.)
   - **Solution:** Dùng `LIKE` queries với wildcard
   
2. **Performance** có thể chậm hơn khi query lớn
   - **Solution:** Add index on `source` và `time`
   ```sql
   CREATE INDEX idx_transactions_source ON Transactions(source);
   CREATE INDEX idx_transactions_time ON Transactions(time);
   ```

3. **Data integrity** phụ thuộc vào string format
   - **Solution:** Luôn dùng `buildReason()` và `parseReason()` methods

---

## 🚀 Migration Strategy (If Needed Later)

Nếu sau này cần migrate sang schema riêng:

```sql
-- 1. Create new table
CREATE TABLE PaymentTransactions (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    tx_id INT NOT NULL,
    txn_ref VARCHAR(255) UNIQUE,
    status VARCHAR(20),
    response_code VARCHAR(10),
    transaction_no VARCHAR(255),
    FOREIGN KEY (tx_id) REFERENCES Transactions(tx_id)
);

-- 2. Migrate data
INSERT INTO PaymentTransactions (tx_id, txn_ref, status, response_code, transaction_no)
SELECT 
    tx_id,
    SUBSTRING_INDEX(SUBSTRING_INDEX(reason, 'txnRef:', -1), '|', 1) as txn_ref,
    SUBSTRING_INDEX(SUBSTRING_INDEX(reason, 'status:', -1), '|', 1) as status,
    SUBSTRING_INDEX(SUBSTRING_INDEX(reason, 'responseCode:', -1), '|', 1) as response_code,
    SUBSTRING_INDEX(reason, 'transactionNo:', -1) as transaction_no
FROM Transactions
WHERE source = 'vnpay';
```

---

## 📝 Summary

- ✅ Sử dụng bảng `Transactions` có sẵn
- ✅ Lưu VNPay data vào `reason` field với format `key:value|key:value`
- ✅ Parse/build bằng helper methods
- ✅ Filter bằng `source = 'vnpay'` và `reason LIKE '%pattern%'`
- ✅ Không cần modify database schema

**Status:** ✅ **HOÀN THÀNH**
