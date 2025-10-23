// createDataV2.js - Version mới đọc từ Database.sql (refactor dùng DatabaseConnection.js)
import dotenv from 'dotenv';
import readline from 'readline';
import { SQLParser } from './sqlParser.js';
import db from '../backend/model/DatabaseConnection.js';
dotenv.config();

/**
 * 🚀 Database Creator V2 - Đọc cấu trúc từ Database.sql
 * Thay vì hardcode, giờ parse SQL file và execute
 */

class DatabaseCreatorV2 {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.sqlFilePath = "../Database.sql";
    this.parser = new SQLParser(this.sqlFilePath);

    if (this.env === 'production') {
      console.log('⚠️  WARNING: Running in PRODUCTION mode!');
      console.log('⚠️  This will DROP and RECREATE the production database!');
    }
    this.dbName = this.getDatabaseName();
  }

  getDatabaseName() {
    switch (this.env) {
      case 'test':
        return 'poker_system_test';
      case 'production':
        return 'poker_system';
      case 'development':
      default:
        return 'poker_system_dev';
    }
  }

  async checkDatabaseExists() {
    try {
      const [databases] = await this.admin.query(`SHOW DATABASES LIKE '${this.dbName}'`);
      return Array.isArray(databases) && databases.length > 0;
    } catch (error) {
      console.error('❌ Lỗi khi kiểm tra sự tồn tại của cơ sở dữ liệu:', error.message);
      return false;
    }
  }

  async confirmProduction() {
    if (this.env !== 'production') {
      return true;
    }

    console.log('🔍 Kiểm tra xem cơ sở dữ liệu sản xuất đã tồn tại chưa...');
    const dbExists = await this.checkDatabaseExists();

    if (!dbExists) {
      console.log('✅ Cơ sở dữ liệu chưa tồn tại. Đang tạo cơ sở dữ liệu mới...');
      console.log(`📍 Cơ sở dữ liệu: ${this.dbName}`);
      return true;
    }

    console.log('⚠️  Cơ sở dữ liệu cho môi trường sản xuất đã tồn tại!');
    console.log('\n' + '='.repeat(60));
    console.log('🚨 CẢNH BÁO GHI ĐÈ CƠ SỞ DỮ LIỆU SẢN XUẤT! 🚨');
    console.log('='.repeat(60));
    console.log('⚠️  Bạn sắp thực hiện:');
    console.log('   • DROP cơ sở dữ liệu sản xuất hiện tại');
    console.log('   • MẤT TẤT CẢ dữ liệu sản xuất hiện tại');
    console.log('   • TẠO LẠI tất cả bảng và triggers');
    console.log('='.repeat(60));
    
    return await this.getUserConfirmation();
  }

  async getUserConfirmation() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('\n❓ Nhập "YES" để tiếp tục hoặc "NO" để hủy bỏ: ', (answer) => {
        const input = answer.trim().toUpperCase();
        rl.close();
        
        if (input === 'YES') {
          console.log('✅ Đã xác nhận! Tiếp tục...');
          resolve(true);
        } else {
          console.log('🛑 Setup bị hủy bỏ.');
          resolve(false);
        }
      });
    });
  }

  async dropDatabase() {
    console.log(`\n🗑️  Drop cơ sở dữ liệu: ${this.dbName}`);
    try {
      await db.query(`DROP DATABASE IF EXISTS ${this.dbName}`);
      console.log(`✅ Đã xóa cơ sở dữ liệu: ${this.dbName}`);
    } catch (error) {
      console.error('❌ Lỗi khi xóa cơ sở dữ liệu:', error.message);
      throw error;
    }
  }
  async createDatabase() {
    console.log(`\n🏗️  Tạo cơ sở dữ liệu: ${this.dbName}`)
    try {
        await db.query(`CREATE DATABASE ${this.dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
        console.log(`✅ Đã tạo cơ sở dữ liệu: ${this.dbName}`)
        await db.query(`USE ${this.dbName}`)
        } catch (error) {
            console.error('❌ Lỗi khi tạo cơ sở dữ liệu:', error.message);
            throw error;
        }
    }

  async parseSQLFile() {
    if (!this.parser.parseAll()) {
      throw new Error('Lỗi khi phân tích tệp SQL');
    }
    
    this.parser.printSummary();
    return true;
  }

  async executeSQLFile() {
    console.log('\n🏗️  Đang thực thi các lệnh SQL theo thứ tự...');
    
    try {
      // Lấy danh sách commands đã parse theo thứ tự
      const commands = this.parser.commands || [];
      
      if (commands.length === 0) {
        console.log('⚠️  Không có lệnh SQL nào để thực thi');
        return false;
      }
      
      let executed = 0;
      let skipped = 0;
      
      // Thực thi từng command theo thứ tự
      for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        
        // Skip INSERT commands nếu là production
        if (this.env === 'production' && cmd.type === 'INSERT') {
          skipped++;
          continue;
        }
        
        try {
          // Thực thi command
          await db.query(cmd.sql);
          executed++;
          
          // Log tiến trình (mỗi 5 lệnh)
          if (executed % 5 === 0) {
            console.log(`   ⚡ Đã thực thi ${executed}/${commands.length - (this.env === 'production' ? this.parser.sampleData.length : 0)} lệnh...`);
          }
          
        } catch (error) {
          console.error(`❌ Lỗi khi thực thi lệnh #${i + 1} [${cmd.type}]:`);
          console.error(`   SQL: ${cmd.sql.substring(0, 100)}...`);
          console.error(`   Lỗi: ${error.message}`);
          throw error;
        }
      }
      
      console.log('✅ Đã thực thi tệp SQL thành công!');
      console.log(`   • ${executed} lệnh đã được thực thi`);
      if (skipped > 0) {
        console.log(`   • ${skipped} lệnh INSERT đã được bỏ qua (môi trường production)`);
      }
      console.log(`   • ${this.parser.tables.size} bảng đã được tạo`);
      console.log(`   • ${this.parser.indexes.length} chỉ mục đã được tạo`);
      console.log(`   • ${this.parser.triggers.length} triggers đã được tạo`);
      console.log(`   • ${this.parser.procedures.length} procedures đã được tạo`);

      if (this.env !== 'production' && this.parser.sampleData.length > 0) {
        console.log(`   • ${this.parser.sampleData.length} câu lệnh dữ liệu mẫu đã được thực thi`);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Lỗi khi thực thi SQL:', error.message);
      throw error;
    }
  }

  async run() {
    try {
      console.log(`🚀 Tạo cơ sở dữ liệu V2 (từ Database.sql)...\n`);
      console.log(`📍 Môi trường: ${this.env.toUpperCase()}`);
      console.log(`📍 Cơ sở dữ liệu: ${this.dbName}`);
      console.log(`📍 Tệp SQL: ${this.sqlFilePath}\n`);
      
      // Parse SQL file first
      await this.parseSQLFile();
      
      await db.connect(true); // Kết nối admin (không chọn database)

      // Confirm for production
      const confirmed = await this.confirmProduction();
      if (!confirmed) {
        console.log('\n🛑 Setup bị hủy bỏ bởi người dùng.');
        await db.disconnect();
        process.exit(0);
      }
      
      // Drop and recreate
      await this.dropDatabase();
      await this.createDatabase();
      
      // Execute SQL file
      await this.executeSQLFile();
      
      console.log('\n🎉 Cấu hình cơ sở dữ liệu hoàn tất!');
      console.log('💡 TIP: Dùng npm run db:migrate:(dev, test, prod) nếu bạn muốn giữ lại dữ liệu hiện có');
      
    } catch (error) {
      console.error('\n💥 Lỗi:', error.message);
      process.exit(1);
    } finally {
      await db.disconnect();
    }
  }
}

// 🎬 Run script
const creator = new DatabaseCreatorV2();
creator.run();

export default DatabaseCreatorV2;
