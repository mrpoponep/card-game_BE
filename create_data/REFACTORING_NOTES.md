# ✅ Migration Tools - Using DatabaseConnection.js

## 📝 Refactored to use existing code

Các migration tools đã được refactor để **tái sử dụng** `DatabaseConnection.js` thay vì code lại từ đầu.

## 🔄 Changes Made

### Before ❌
```javascript
// migrationTool.js (old)
import mysql from 'mysql2/promise';

class MigrationTool {
  constructor() {
    this.connection = null; // ❌ Code lại connection
    this.config = { ... };  // ❌ Hardcode config
  }
  
  async connect() {
    this.connection = await mysql.createConnection(this.config); // ❌ Duplicate
  }
  
  async query(sql) {
    await this.connection.query(sql); // ❌ Code lại query method
  }
}
```

### After ✅
```javascript
// migrationToolV2.js (new)
import db from '../backend/model/DatabaseConnection.js';
import { currentConfig } from '../backend/config/database.config.js';

class MigrationToolV2 {
  constructor() {
    this.db = db;  // ✅ Sử dụng singleton có sẵn
    this.dbName = currentConfig.database; // ✅ Dùng config có sẵn
  }
  
  async connect() {
    await this.db.connect(); // ✅ Dùng method có sẵn
  }
  
  // ✅ Không cần code lại query methods
}
```

## 📊 Files Structure

```
Server/
├── backend/
│   ├── model/
│   │   └── DatabaseConnection.js  ← ⭐ Core DB class (singleton)
│   └── config/
│       └── database.config.js     ← ⭐ Config file
└── create_data/
    ├── migrationToolV2.js         ← ✅ Uses DatabaseConnection
    ├── migrationTool.js           ← ⚠️  Old (duplicate code)
    ├── createDataV2.js            ← ✅ Uses parser + config
    ├── createData.js              ← ⚠️  Old (hardcoded)
    └── sqlParser.js               ← ✅ Standalone parser
```

## 🎯 Usage

### Recommended (Using DatabaseConnection)
```bash
# Migration with database connection reuse
npm run db:migrate

# Setup database from Database.sql
npm run db:create:v2

# Parse Database.sql
npm run db:parse
```

### Old (For comparison)
```bash
# Old migration tool (duplicate code)
npm run db:migrate:old

# Old create data (hardcoded)
npm run db:create
```

## 🔍 What DatabaseConnection.js Provides

```javascript
// backend/model/DatabaseConnection.js

class DatabaseConnection {
  // ✅ Connection pool management
  async connect()
  async disconnect()
  
  // ✅ Query methods with auto-handling
  async query(sql, params)          // Returns rows/insertId/affectedRows
  
  // ✅ Transaction support
  async beginTransaction()
  async transactionQuery(conn, sql, params)
  async commit(conn)
  async rollback(conn)
  
  // ✅ Utilities
  async getConnectionStatus()
  async clearAllData()              // Dev only
}

// ✅ Singleton instance
const db = new DatabaseConnection();
export default db;
```

## 📋 Benefits of Refactoring

| Aspect | Before | After |
|--------|--------|-------|
| **Code Reuse** | ❌ Duplicate connection code | ✅ Reuse DatabaseConnection |
| **Config** | ❌ Hardcoded/repeated | ✅ Centralized in database.config.js |
| **Maintenance** | ❌ Update in multiple places | ✅ Update once in DatabaseConnection |
| **Testing** | ❌ Hard to mock | ✅ Easy to mock singleton |
| **Consistency** | ❌ Different error handling | ✅ Consistent across project |
| **Features** | ❌ Basic query only | ✅ Transactions, pool, utilities |

## 🔧 Migration Tool V2 Features

### Uses DatabaseConnection for:
1. ✅ **Connection management** - Pool, reconnect, SSL
2. ✅ **Query execution** - Prepared statements, error handling
3. ✅ **Configuration** - Environment-specific settings
4. ✅ **Logging** - Consistent log format

### Still handles on its own:
1. **Schema comparison** - Old vs new structure
2. **Data backup** - Before migration
3. **Data restore** - After schema update
4. **User confirmation** - Interactive prompts
5. **Migration plan** - Change detection

## 💡 Why Not Use DatabaseConnection for Everything?

Migration tool needs **admin operations** that DatabaseConnection doesn't provide:

```javascript
// ❌ DatabaseConnection can't do these:
DROP DATABASE
CREATE DATABASE
USE database_name

// ✅ So migrationToolV2 uses raw connection for admin tasks:
this.rawConnection = await mysql.createConnection({ ... });
await this.rawConnection.query('DROP DATABASE ...');

// ✅ But reuses DatabaseConnection config:
import { currentConfig } from '../backend/config/database.config.js';
```

## 🎯 Best Practices Applied

### 1. DRY (Don't Repeat Yourself)
```javascript
// ❌ Before
class Tool1 { async query(sql) { /* code */ } }
class Tool2 { async query(sql) { /* same code */ } }

// ✅ After
import db from '../backend/model/DatabaseConnection.js';
// All tools use db.query()
```

### 2. Single Source of Truth
```javascript
// ❌ Before: Config in multiple places
// createData.js: { host: 'localhost', user: 'root', ... }
// migrationTool.js: { host: 'localhost', user: 'root', ... }

// ✅ After: Config in one place
import { currentConfig } from '../backend/config/database.config.js';
```

### 3. Separation of Concerns
```javascript
// ✅ DatabaseConnection: Generic DB operations
// ✅ MigrationTool: Migration-specific logic
// ✅ database.config.js: Configuration
```

## 📚 Related Files

- **DatabaseConnection.js** - Main DB class
- **database.config.js** - Centralized config
- **MIGRATION_GUIDE.md** - How to use migration tools
- **QUICK_START.md** - Quick commands reference

## 🚀 Next Steps

1. ✅ Use `npm run db:migrate` for migrations
2. ✅ Use `npm run db:create:v2` for fresh setups
3. ❌ Avoid old tools (`db:migrate:old`, `db:create`)
4. 📝 Update docs if DatabaseConnection.js changes

---

**Key Takeaway:** Reuse existing, tested code (`DatabaseConnection.js`) instead of duplicating functionality! 🎯

---

## Update (2025-10-15)

- `create_data/createDataV2.js` đã được refactor để sử dụng `DatabaseConnection.js`:
  - Kết nối admin (không chọn DB) qua `mysql2` chỉ dùng cho lệnh admin và chạy script SQL nhiều câu (multiStatements) sau khi `USE <db>`.
  - Kết nối pool chuẩn dùng `db` singleton (`backend/model/DatabaseConnection.js`) để chạy các câu kiểm tra và test sau khi tạo schema.
  - Config DB lấy từ `backend/config/database.config.js` (`currentConfig`).

