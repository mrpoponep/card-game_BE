// migrationToolV2.js - Using DatabaseConnection
import dotenv from 'dotenv';
import readline from 'readline';
import { SQLParser } from './sqlParser.js';
import path from 'path';
import db from '../backend/model/DatabaseConnection.js';

dotenv.config();

/**
 * 🔄 Migration Tool V2 - Sử dụng DatabaseConnection.js
 * Migrate dữ liệu an toàn từ schema cũ sang schema mới
 */

export class MigrationToolV2 {
  constructor(sqlFilePath) {
    this.sqlFilePath = sqlFilePath;
    this.db = db;
    this.parser = new SQLParser(sqlFilePath);
    this.currentSchema = new Map();
    this.newSchema = new Map();
    this.migrationPlan = [];
    this.dataBackup = new Map();
    
    this.dbName = this.getDatabaseName();
  }

  // 🔠 Tìm tên bảng mới theo cách không phân biệt hoa thường
  findNewTableName(oldName) {
    if (!oldName) return null;
    if (this.newSchema.has(oldName)) return oldName;
    const lower = oldName.toLowerCase();
    for (const name of this.newSchema.keys()) {
      if (name.toLowerCase() === lower) return name;
    }
    return null;
  }

  getDatabaseName() {
    const env = process.env.NODE_ENV || 'development';
    switch (env) {
      case 'test':
        return 'poker_system_test';
      case 'production':
        return 'poker_system';
      case 'development':
      default:
        return 'poker_system_dev';
    }
  }

  // 🔍 Lấy cấu trúc hiện tại từ database
  async getCurrentSchema() {
    try {
      // Check if database exists (avoid SHOW + placeholders)
      const databases = await db.query(
        `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
        [this.dbName]
      );
      
      if (!databases || databases.length === 0) {
        console.log(`⚠️  Database ${this.dbName} does not exist yet.`);
        return true;
      }
      
      // Use the database
      await db.query(`USE ${this.dbName}`);
      
      // Lấy danh sách tables
      const tables = await db.query(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ?
      `, [this.dbName]);
      
      if (!tables || tables.length === 0) {
        console.log('ℹ️  No tables found in current database.');
        return true;
      }
      
      for (const table of tables) {
        const tableName = table.TABLE_NAME;
        
        // Lấy columns
        const columns = await db.query(`
          SELECT 
            COLUMN_NAME as name,
            COLUMN_TYPE as type,
            IS_NULLABLE as nullable,
            COLUMN_KEY as key_type,
            COLUMN_DEFAULT as default_value,
            EXTRA as extra
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `, [this.dbName, tableName]);
        
        this.currentSchema.set(tableName, {
          name: tableName,
          columns: columns.map(col => ({
            name: col.name,
            type: col.type,
            nullable: col.nullable === 'YES',
            isPrimaryKey: col.key_type === 'PRI',
            default: col.default_value,
            autoIncrement: (col.extra || '').toLowerCase().includes('auto_increment')
          }))
        });
        
        console.log(`   ✓ ${tableName}: ${columns.length} columns`);
      }
      
      console.log(`✅ Current schema loaded: ${this.currentSchema.size} tables`);
      return true;
    } catch (error) {
      console.error('❌ Error reading current schema:', error.message);
      return false;
    }
  }

  // 📖 Parse schema mới từ Database.sql
  async parseNewSchema() {
    console.log('\n📖 Parsing new schema from Database.sql...');
    
    if (!this.parser.parseAll()) {
      return false;
    }
    
    this.parser.tables.forEach((table, name) => {
      this.newSchema.set(name, table);
    });
    
    this.parser.printSummary();
    return true;
  }

  // 🔍 So sánh schemas
  async analyzeDifferences() {
    console.log('\n🔍 Analyzing schema differences...');
    console.log('='.repeat(60));
    
    // 1. Tables mới
    const newTables = [];
    this.newSchema.forEach((table, name) => {
      if (!this.currentSchema.has(name)) {
        newTables.push(name);
        this.migrationPlan.push({
          type: 'CREATE_TABLE',
          table: name,
          action: `Create new table: ${name}`
        });
      }
    });
    
    if (newTables.length > 0) {
      console.log(`\n🆕 New tables (${newTables.length}):`);
      newTables.forEach(t => console.log(`   + ${t}`));
    }
    
    // 2. Tables bị xóa
    const deletedTables = [];
    this.currentSchema.forEach((table, name) => {
      if (!this.newSchema.has(name)) {
        deletedTables.push(name);
        this.migrationPlan.push({
          type: 'DROP_TABLE',
          table: name,
          action: `⚠️  Table will be DROPPED: ${name}`,
          requiresBackup: true
        });
      }
    });
    
    if (deletedTables.length > 0) {
      console.log(`\n🗑️  Tables to be dropped (${deletedTables.length}):`);
      deletedTables.forEach(t => console.log(`   - ${t}`));
    }
    
    // 3. Columns thay đổi
    const modifiedTables = [];
    this.newSchema.forEach((newTable, tableName) => {
      if (this.currentSchema.has(tableName)) {
        const oldTable = this.currentSchema.get(tableName);
        const changes = this.compareTableColumns(oldTable, newTable);
        
        if (changes.length > 0) {
          modifiedTables.push({ table: tableName, changes });
          
          changes.forEach(change => {
            this.migrationPlan.push({
              type: change.type,
              table: tableName,
              column: change.column,
              action: change.description,
              requiresBackup: change.requiresBackup || false
            });
          });
        }
      }
    });
    
    if (modifiedTables.length > 0) {
      console.log(`\n🔄 Modified tables (${modifiedTables.length}):`);
      modifiedTables.forEach(({ table, changes }) => {
        console.log(`\n   📋 ${table}:`);
        changes.forEach(ch => {
          const icon = ch.type === 'ADD_COLUMN' ? '+' : 
                      ch.type === 'DROP_COLUMN' ? '-' : '~';
          console.log(`      ${icon} ${ch.description}`);
        });
      });
    }
    
    if (this.migrationPlan.length === 0) {
      console.log('\n✅ No schema changes detected!');
      return false;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 Total changes: ${this.migrationPlan.length}`);
    console.log('='.repeat(60));
    
    return true;
  }

  // 🔍 So sánh columns
  compareTableColumns(oldTable, newTable) {
    const changes = [];
    const oldColumns = new Map(oldTable.columns.map(c => [c.name, c]));
    const newColumns = new Map(newTable.columns.map(c => [c.name, c]));
    
    // New columns
    newColumns.forEach((newCol, colName) => {
      if (!oldColumns.has(colName)) {
        changes.push({
          type: 'ADD_COLUMN',
          column: colName,
          description: `Add column: ${colName} ${newCol.type}`,
          requiresBackup: false
        });
      } else {
        const oldCol = oldColumns.get(colName);
        if (oldCol.type.toLowerCase() !== newCol.type.toLowerCase()) {
          changes.push({
            type: 'MODIFY_COLUMN',
            column: colName,
            description: `Modify column: ${colName} (${oldCol.type} → ${newCol.type})`,
            requiresBackup: true
          });
        }
      }
    });
    
    // Dropped columns
    oldColumns.forEach((oldCol, colName) => {
      if (!newColumns.has(colName)) {
        changes.push({
          type: 'DROP_COLUMN',
          column: colName,
          description: `⚠️  Drop column: ${colName}`,
          requiresBackup: true
        });
      }
    });
    
    return changes;
  }

  // 💾 Backup data
  async backupData() {
    console.log('\n💾 Backing up current data...');
    
    const tablesToBackup = new Set();
    this.migrationPlan.forEach(plan => {
      if (plan.requiresBackup) {
        tablesToBackup.add(plan.table);
      }
    });
    
    if (tablesToBackup.size === 0) {
      console.log('   ℹ️  No backup needed');
      return true;
    }
    
    for (const tableName of tablesToBackup) {
      try {
        const rows = await db.query(`SELECT * FROM \`${tableName}\``);
        this.dataBackup.set(tableName, rows);
        console.log(`   ✓ Backed up ${tableName}: ${rows.length} rows`);
      } catch (error) {
        console.error(`   ❌ Error backing up ${tableName}:`, error.message);
        return false;
      }
    }
    
    console.log(`✅ Backup completed: ${tablesToBackup.size} tables`);
    return true;
  }

  // 🔄 Execute migration
  async executeMigration() {
    console.log('\n🔄 Executing migration...');
    console.log('='.repeat(60));
    
    try {
      // Backup data
      if (!await this.backupData()) {
        throw new Error('Backup failed');
      }
      
      console.log('\n🏗️  Recreating database...');
      
      // Drop database
      await db.query(`DROP DATABASE IF EXISTS ${this.dbName}`);
      console.log(`   ✓ Dropped old database`);
      
      // Create database
      await db.query(`CREATE DATABASE ${this.dbName}`);
      await db.query(`USE ${this.dbName}`);
      console.log(`   ✓ Created new database`);
      
      // Execute SQL from Database.sql (schema only, skip sample data INSERTs)
      const commands = (this.parser.commands || []).filter(c => !/^INSERT\s+/i.test(c.type || c.sql));
      if (commands.length === 0) {
        throw new Error('No SQL commands to execute');
      }
      for (const cmd of commands) {
        await db.query(cmd.sql);
      }
      console.log(`   ✓ Executed Database.sql`);
      
      // Restore data
      await this.restoreData();
      
      console.log('\n✅ Migration completed successfully!');
      return true;
      
    } catch (error) {
      console.error('\n❌ Migration failed:', error.message);
      return false;
    }
  }

  // 📥 Restore data
  async restoreData() {
    console.log('\n📥 Restoring data...');
    
    if (this.dataBackup.size === 0) {
      console.log('   ℹ️  No data to restore');
      return true;
    }
    
    for (const [oldTableName, rows] of this.dataBackup) {
      const mappedName = this.findNewTableName(oldTableName);
      if (!mappedName) {
        console.log(`   ⚠️  Table "${oldTableName}" no longer exists. Data discarded.`);
        continue;
      }
      
      if (rows.length === 0) {
        console.log(`   ℹ️  ${mappedName}: no data`);
        continue;
      }
      
      try {
        const newTable = this.newSchema.get(mappedName);
        const newColumnNames = newTable.columns.map(c => c.name);
        const oldColumnNames = Object.keys(rows[0]);
        
        const commonColumns = oldColumnNames.filter(col => newColumnNames.includes(col));
        
        if (commonColumns.length === 0) {
          console.log(`   ⚠️  ${mappedName}: no matching columns`);
          continue;
        }
        
        for (const row of rows) {
          const values = commonColumns.map(col => row[col]);
          const placeholders = commonColumns.map(() => '?').join(', ');
          const cols = commonColumns.map(c => `\`${c}\``).join(', ');
          // Build ON DUPLICATE KEY UPDATE for non-PK columns present in commonColumns
          const pkCols = newTable.columns.filter(c => c.isPrimaryKey).map(c => c.name);
          const updateCols = commonColumns.filter(c => !pkCols.includes(c));
          const updateClause = updateCols.map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
          const sql = updateClause
            ? `INSERT INTO \`${mappedName}\` (${cols}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`
            : `INSERT INTO \`${mappedName}\` (${cols}) VALUES (${placeholders})`;
          await db.query(sql, values);
        }
        
        console.log(`   ✓ ${mappedName}: restored ${rows.length} rows`);
        
      } catch (error) {
        console.error(`   ❌ Error restoring ${oldTableName} -> ${mappedName}:`, error.message);
      }
    }
    
    console.log('✅ Data restoration completed!');
    return true;
  }

  // 📋 Show migration plan
  showMigrationPlan() {
    console.log('\n📋 MIGRATION PLAN:');
    console.log('='.repeat(60));
    
    if (this.migrationPlan.length === 0) {
      console.log('✅ No changes needed!');
      return;
    }
    
    this.migrationPlan.forEach((plan, idx) => {
      const icon = plan.type.includes('DROP') ? '🗑️' :
                   plan.type.includes('CREATE') ? '🆕' :
                   plan.type.includes('ADD') ? '➕' :
                   plan.type.includes('MODIFY') ? '🔄' : '📝';
      
      console.log(`${idx + 1}. ${icon} ${plan.action}`);
    });
    
    console.log('='.repeat(60));
  }

  // ❓ Confirm migration
  async confirmMigration() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      console.log('\n⚠️  This will recreate the database with new schema.');
      console.log('⚠️  Old data will be preserved where possible.\n');
      
      rl.question('❓ Continue with migration? (yes/no): ', (answer) => {
        const confirmed = answer.trim().toLowerCase() === 'yes';
        rl.close();
        resolve(confirmed);
      });
    });
  }

  // 🚀 Run migration
  async run() {
    try {
      console.log('🚀 Starting database migration...\n');
      
      await this.db.connect(true);
      if (!await this.getCurrentSchema()) return;
      if (!await this.parseNewSchema()) return;
      
      const hasChanges = await this.analyzeDifferences();
      if (!hasChanges) return;
      
      this.showMigrationPlan();
      
      const confirmed = await this.confirmMigration();
      if (!confirmed) {
        console.log('\n🛑 Migration cancelled.');
        return;
      }
      
      await this.executeMigration();
      
    } catch (error) {
      console.error('\n💥 Migration failed:', error.message);
    } finally {
      await db.disconnect();
    }
  }
}

// 🧪 Run
const sqlPath = path.join("../Database.sql");
const tool = new MigrationToolV2(sqlPath);
tool.run();

export default MigrationToolV2;
