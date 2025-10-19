# Database Testing Guide

## 🧪 Available Test Files

### 1. **DbTest.js** - Comprehensive Test Suite
- **Full test coverage**: Connection, CRUD, Transactions, Performance
- **User Model integration** testing
- **Error handling** verification  
- **Performance benchmarks**
- **Automated cleanup**

### 2. **QuickDbTest.js** - Quick Validation
- **Fast basic tests** (< 30 seconds)
- **Connection verification**
- **Basic CRUD operations**
- **Simple transaction test**

## 🚀 How to Run Tests

### Prerequisites:
1. **MySQL server running**
2. **Database configured** in `.env` file
3. **Dependencies installed**: `npm install`

### Run Commands:
```bash
# Quick test (recommended for first-time setup)
npm run test:quick

# Full comprehensive test suite  
npm run test:db

# Setup database (creates tables, sample data)
npm run db:setup
```

## 📋 Test Categories

### 🔗 **Connection Tests**
- ✅ Database connection establishment
- ✅ Connection pool functionality
- ✅ Connection status monitoring
- ✅ Auto-reconnection handling

### 🏗️ **Schema Tests**
- ✅ Table creation verification
- ✅ Index creation
- ✅ Foreign key constraints
- ✅ Data types validation

### 🔍 **CRUD Tests**
- ✅ **CREATE**: INSERT operations
- ✅ **READ**: SELECT queries with WHERE conditions
- ✅ **UPDATE**: Data modification
- ✅ **DELETE**: Record removal

### 👤 **User Model Tests**
- ✅ Model instantiation
- ✅ Model validation
- ✅ Save/Load operations
- ✅ Model-to-database integration

### 🔄 **Transaction Tests**
- ✅ **Success scenario**: Multiple operations commit
- ✅ **Failure scenario**: Automatic rollback
- ✅ **Concurrency**: Multiple transactions
- ✅ **Error recovery**: Connection release

### ❌ **Error Handling**
- ✅ **SQL syntax errors**
- ✅ **Constraint violations** (duplicate keys, etc.)
- ✅ **Connection failures**
- ✅ **Transaction rollbacks**

### ⚡ **Performance Tests**
- ✅ **Batch operations** throughput
- ✅ **Query response times**
- ✅ **Connection pool efficiency**
- ✅ **Memory usage monitoring**

## 📊 Expected Results

### Quick Test Output:
```
🧪 Quick Database Test Starting...

1️⃣ Testing connection...
✅ Connected successfully!

2️⃣ Testing basic query...
✅ Query result: { ping: 1, current_time: '2025-10-12 10:30:15' }

3️⃣ Testing insert...
✅ Insert result: { insertId: 1, affectedRows: 1 }

... (continuing through all 8 tests)

🎉 All quick tests passed!
```

### Full Test Suite Output:
```
🚀 Starting Database Test Suite...

🧪 Testing: Database Connection
✅ PASS: Database Connection

🧪 Testing: Basic SELECT Query  
✅ PASS: Basic SELECT Query

... (continuing through 20+ comprehensive tests)

🎯 DATABASE TEST SUMMARY
==================================================
📊 Total Tests: 23
✅ Passed: 23
❌ Failed: 0
📈 Success Rate: 100.0%

🎉 ALL TESTS PASSED!
```

## 🚨 Troubleshooting

### Common Issues:

1. **Connection Failed**
   ```
   ❌ MySQL Connection Error: connect ECONNREFUSED
   ```
   **Solution**: Check MySQL service is running, verify `.env` settings

2. **Database Not Found**
   ```
   ❌ Unknown database 'card_game_db'
   ```
   **Solution**: Create database: `CREATE DATABASE card_game_db;`

3. **Access Denied**
   ```
   ❌ Access denied for user 'root'@'localhost'
   ```
   **Solution**: Check username/password in `.env` file

4. **Tests Timeout**
   ```
   ❌ Test failed: timeout of 30000ms exceeded
   ```
   **Solution**: Check database performance, reduce test batch sizes

### Debug Commands:
```bash
# Check MySQL service (Windows)
services.msc

# Test MySQL connection manually
mysql -u root -p

# View current processes
SHOW PROCESSLIST;

# Check database size
SELECT table_name, table_rows 
FROM information_schema.tables 
WHERE table_schema = 'card_game_db';
```

## 🔧 Customization

### Add New Tests:
```javascript
// In DbTest.js
await this.test('Your Custom Test', async () => {
  // Your test logic here
  const result = await db.query('YOUR SQL');
  if (!result) {
    throw new Error('Test failed');
  }
});
```

### Modify Performance Thresholds:
```javascript
// In testPerformance()
if (duration > 5000) { // Change this threshold
  throw new Error(`Too slow: ${duration}ms`);
}
```

### Skip Cleanup (for debugging):
```javascript
// Set in .env
NODE_ENV=production  # Skips clearAllData()
```

## 📈 Performance Benchmarks

### Target Performance:
- **Connection**: < 2 seconds
- **Single INSERT**: < 50ms
- **100 Batch INSERTs**: < 5 seconds  
- **Complex SELECT**: < 100ms
- **Transaction (3 ops)**: < 200ms

### Optimization Tips:
1. **Use connection pooling** (already implemented)
2. **Add proper indexes** on frequently queried columns
3. **Use prepared statements** (already implemented)
4. **Batch operations** when possible
5. **Monitor connection pool** usage