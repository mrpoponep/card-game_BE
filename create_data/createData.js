// createData.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import readline from 'readline';

// Load environment variables
dotenv.config();

/**
 * 🚀 Script khởi tạo database cho môi trường development
 * Tương tự Database.sql nhưng sử dụng JavaScript
 */

class DatabaseCreator {
  constructor() {
    this.connection = null;
    this.env = process.env.NODE_ENV || 'development';

    this.config = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    };

    // Tên database theo môi trường
    this.dbName = this.getDatabaseName();

    // Cảnh báo cho production
    if (this.env === 'production') {
      console.log('⚠️  WARNING: Running in PRODUCTION mode!');
      console.log('⚠️  This will DROP and RECREATE the production database!');
    }
  }

  // 🎯 Lấy tên database theo môi trường
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

  // 🔗 Kết nối MySQL
  async connect() {
    try {
      console.log(`🔌 Connecting to MySQL... (Environment: ${this.env})`);
      console.log(`📍 Database: ${this.dbName}`);
      this.connection = await mysql.createConnection(this.config);
      console.log('✅ Connected to MySQL successfully!');
    } catch (error) {
      console.error('❌ MySQL Connection Error:', error.message);
      throw error;
    }
  }

  // 🔍 Kiểm tra database có tồn tại không
  async checkDatabaseExists() {
    try {
      const [databases] = await this.connection.query(`SHOW DATABASES LIKE '${this.dbName}'`);
      return databases.length > 0;
    } catch (error) {
      console.error('❌ Error checking database existence:', error.message);
      return false;
    }
  }

  // ⚠️ Xác nhận cho production
  async confirmProduction() {
    if (this.env !== 'production') {
      return true; // Không cần confirm cho dev/test
    }

    // Kết nối tạm để kiểm tra database
    console.log('🔍 Checking if production database already exists...');
    const dbExists = await this.checkDatabaseExists();

    if (!dbExists) {
      // Database chưa tồn tại - tạo mới không cần confirmation
      console.log('✅ Database does not exist yet. Creating new database...');
      console.log(`📍 Database: ${this.dbName}`);
      console.log('🎯 No confirmation needed for initial setup.');
      return true;
    }

    // Database đã tồn tại - yêu cầu confirmation tối đa
    console.log('⚠️  Database already exists! This will DESTROY existing data.');
    console.log('\n' + '='.repeat(60));
    console.log('🚨 PRODUCTION DATABASE OVERRIDE WARNING! 🚨');
    console.log('='.repeat(60));
    console.log('⚠️  You are about to:');
    console.log('   • DROP the EXISTING production database');
    console.log('   • LOSE ALL current production data');
    console.log('   • RECREATE all tables and triggers');
    console.log('');
    console.log('🚫 This action CANNOT be undone!');
    console.log('� ALL PRODUCTION DATA WILL BE LOST!');
    console.log('💡 You should backup your data first.');
    console.log('='.repeat(60));

    // Luôn dùng confirmation tối đa khi database đã tồn tại
    return await this.getMaximumSecurityConfirmation();
  }

  // 🎯 Xác nhận đơn giản với timeout
  async getSimpleConfirmation() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      // Timeout sau 30 giây
      const timeout = setTimeout(() => {
        console.log('\n⏰ Timeout! No response after 30 seconds.');
        console.log('🛑 Setup cancelled for security.');
        rl.close();
        resolve(false);
      }, 30000);

      rl.question('\n❓ Type "YES" to continue or "NO" to abort: ', (answer) => {
        clearTimeout(timeout);
        const input = answer.trim().toUpperCase();

        if (input === 'YES') {
          console.log('✅ Confirmed! Proceeding with production setup...');
          rl.close();
          resolve(true);
        } else {
          console.log('🛑 Setup cancelled by user.');
          rl.close();
          resolve(false);
        }
      });
    });
  }

  // 🎯 Đọc xác nhận từ người dùng
  async getUserConfirmation() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      let step = 1;

      const askStep1 = () => {
        rl.question('\n❓ Do you want to continue? (y/n): ', (answer) => {
          const input = answer.trim().toLowerCase();

          if (input === 'y' || input === 'yes') {
            step = 2;
            askStep2();
          } else if (input === 'n' || input === 'no') {
            console.log('🛑 Setup cancelled by user.');
            rl.close();
            resolve(false);
          } else {
            console.log('❌ Please answer "y" (yes) or "n" (no).');
            askStep1();
          }
        });
      };

      const askStep2 = () => {
        console.log('\n⚠️  FINAL WARNING: This will DESTROY all production data!');
        rl.question('❓ Type the database name "' + this.dbName + '" to confirm: ', (answer) => {
          const input = answer.trim();

          if (input === this.dbName) {
            step = 3;
            askStep3();
          } else {
            console.log(`❌ Database name "${input}" does not match "${this.dbName}".`);
            console.log('🛑 Setup cancelled for security.');
            rl.close();
            resolve(false);
          }
        });
      };

      const askStep3 = () => {
        console.log('\n🔐 Final security check:');
        rl.question('❓ Type "I UNDERSTAND THE RISKS" to proceed: ', (answer) => {
          const input = answer.trim();

          if (input === 'I UNDERSTAND THE RISKS') {
            console.log('\n✅ All confirmations completed! Proceeding with production setup...');
            rl.close();
            resolve(true);
          } else {
            console.log('❌ Security phrase does not match.');
            console.log('🛑 Setup cancelled for safety.');
            rl.close();
            resolve(false);
          }
        });
      };

      askStep1();
    });
  }

  // �️ Confirmation bảo mật tối đa cho database đã tồn tại
  async getMaximumSecurityConfirmation() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      let step = 1;

      const askStep1 = () => {
        console.log('\n⚠️  Step 1 of 4: Initial confirmation');
        rl.question('❓ Are you absolutely sure you want to DESTROY production data? (type "destroy"): ', (answer) => {
          const input = answer.trim().toLowerCase();

          if (input === 'destroy') {
            askStep2();
          } else {
            console.log('🛑 Setup cancelled. You must type exactly "destroy" to continue.');
            rl.close();
            resolve(false);
          }
        });
      };

      const askStep2 = () => {
        console.log('\n🔥 Step 2 of 4: Database name verification');
        console.log(`💀 This will completely WIPE "${this.dbName}" database!`);
        rl.question(`❓ Type the EXACT database name "${this.dbName}" to continue: `, (answer) => {
          const input = answer.trim();

          if (input === this.dbName) {
            askStep3();
          } else {
            console.log(`❌ Database name "${input}" does not match "${this.dbName}".`);
            console.log('🛑 Setup cancelled for security.');
            rl.close();
            resolve(false);
          }
        });
      };

      const askStep3 = () => {
        const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        console.log('\n📅 Step 3 of 4: Date confirmation');
        console.log('⚠️  To prevent accidents, confirm today\'s date:');
        rl.question(`❓ Type today's date (${currentDate}): `, (answer) => {
          const input = answer.trim();

          if (input === currentDate) {
            askStep4();
          } else {
            console.log(`❌ Date "${input}" does not match today "${currentDate}".`);
            console.log('🛑 Setup cancelled - possible automation or wrong date.');
            rl.close();
            resolve(false);
          }
        });
      };

      const askStep4 = () => {
        console.log('\n🔐 Step 4 of 4: Final security phrase');
        console.log('💀 LAST CHANCE TO CANCEL!');
        const securityPhrase = 'I FULLY UNDERSTAND THIS DESTROYS ALL PRODUCTION DATA';
        rl.question(`❓ Type: "${securityPhrase}": `, (answer) => {
          const input = answer.trim();

          if (input === securityPhrase) {
            console.log('\n💀 All security confirmations passed.');
            console.log('🔥 PROCEEDING WITH PRODUCTION DATA DESTRUCTION...');
            rl.close();
            resolve(true);
          } else {
            console.log('❌ Security phrase does not match exactly.');
            console.log('🛑 Setup cancelled for safety.');
            rl.close();
            resolve(false);
          }
        });
      };

      askStep1();
    });
  }

  // �🗑️ Xóa database nếu tồn tại
  async dropDatabase() {
    try {
      console.log(`🗑️ Dropping database ${this.dbName} if exists...`);
      await this.connection.query(`DROP DATABASE IF EXISTS ${this.dbName}`);
      console.log(`✅ Database ${this.dbName} dropped successfully!`);
    } catch (error) {
      console.error('❌ Error dropping database:', error.message);
      throw error;
    }
  }

  // 🏗️ Tạo database
  async createDatabase() {
    try {
      console.log(`🏗️ Creating database ${this.dbName}...`);
      await this.connection.query(`CREATE DATABASE ${this.dbName}`);
      await this.connection.query(`USE ${this.dbName}`);
      console.log(`✅ Database ${this.dbName} created and selected!`);
    } catch (error) {
      console.error('❌ Error creating database:', error.message);
      throw error;
    }
  }

  // �️ Helper method để chạy SQL - tự động chọn query/execute
  async runSQL(sql, params = []) {
    const ddlCommands = ['CREATE', 'DROP', 'ALTER', 'USE'];
    const isDDL = ddlCommands.some(cmd => sql.trim().toUpperCase().startsWith(cmd));

    if (isDDL) {
      return await this.connection.query(sql);
    } else {
      return await this.connection.execute(sql, params);
    }
  }

  // �📋 Tạo bảng User
  async createUserTable() {
    const sql = `
      CREATE TABLE User (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('Player', 'Admin') DEFAULT 'Player',
        balance DECIMAL(15,2) DEFAULT 0,
        banned BOOLEAN DEFAULT FALSE,
        elo INT DEFAULT 1000
      )
    `;

    try {
      console.log('📋 Creating User table...');
      await this.runSQL(sql);
      console.log('✅ User table created!');
    } catch (error) {
      console.error('❌ Error creating User table:', error.message);
      throw error;
    }
  }

  // 💰 Tạo bảng Transactions
  async createTransactionsTable() {
    const sql = `
      CREATE TABLE Transactions (
        tx_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        source_id INT,
        source VARCHAR(100),
        amount DECIMAL(15,2) NOT NULL,
        reason TEXT,
        time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES User(user_id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (source_id) REFERENCES User(user_id)
          ON DELETE SET NULL ON UPDATE CASCADE
      )
    `;

    try {
      console.log('💰 Creating Transactions table...');
      await this.runSQL(sql);
      console.log('✅ Transactions table created!');
    } catch (error) {
      console.error('❌ Error creating Transactions table:', error.message);
      throw error;
    }
  }

  // 🎲 Tạo bảng Table_Info
  async createTableInfoTable() {
    const sql = `
      CREATE TABLE Table_Info (
    table_id INT AUTO_INCREMENT PRIMARY KEY,
    room_code CHAR(4) NOT NULL UNIQUE,      -- 🔹 Mã phòng gồm 4 số, không trùng nhau
    min_players INT NOT NULL,
    max_players INT NOT NULL,
    small_blind DECIMAL(10,2),
    max_blind DECIMAL(10,2),
    min_buy_in DECIMAL(10,2),
    max_buy_in DECIMAL(10,2),
    rake DECIMAL(5,2),
    is_private BOOLEAN DEFAULT FALSE,
    status ENUM('waiting', 'playing') DEFAULT 'waiting',
    created_by INT,
    FOREIGN KEY (created_by) REFERENCES User(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

    `;

    try {
      console.log('🎲 Creating Table_Info table...');
      await this.runSQL(sql);
      console.log('✅ Table_Info table created!');
    } catch (error) {
      console.error('❌ Error creating Table_Info table:', error.message);
      throw error;
    }
  }

  // 🎮 Tạo bảng Game_History
  async createGameHistoryTable() {
    const sql = `
      CREATE TABLE Game_History (
        game_id INT AUTO_INCREMENT PRIMARY KEY,
        table_id INT NOT NULL,
        game_type VARCHAR(50),
        time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        winner INT,
        FOREIGN KEY (table_id) REFERENCES Table_Info(table_id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (winner) REFERENCES User(user_id)
          ON DELETE SET NULL ON UPDATE CASCADE
      )
    `;

    try {
      console.log('🎮 Creating Game_History table...');
      await this.runSQL(sql);
      console.log('✅ Game_History table created!');
    } catch (error) {
      console.error('❌ Error creating Game_History table:', error.message);
      throw error;
    }
  }

  // 🚫 Tạo bảng Banned_Player
  async createBannedPlayerTable() {
    const sql = `
      CREATE TABLE Banned_Player (
        report_id INT AUTO_INCREMENT PRIMARY KEY,
        reported_id INT NOT NULL,
        reason TEXT,
        chat_history TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reported_id) REFERENCES User(user_id)
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `;

    try {
      console.log('🚫 Creating Banned_Player table...');
      await this.runSQL(sql);
      console.log('✅ Banned_Player table created!');
    } catch (error) {
      console.error('❌ Error creating Banned_Player table:', error.message);
      throw error;
    }
  }

  // 📞 Tạo bảng Appeal
  async createAppealTable() {
    const sql = `
      CREATE TABLE Appeal (
        appeal_id INT AUTO_INCREMENT PRIMARY KEY,
        report_id INT NOT NULL,
        action VARCHAR(100),
        appeal_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (report_id) REFERENCES Banned_Player(report_id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (appeal_by) REFERENCES User(user_id)
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `;

    try {
      console.log('📞 Creating Appeal table...');
      await this.runSQL(sql);
      console.log('✅ Appeal table created!');
    } catch (error) {
      console.error('❌ Error creating Appeal table:', error.message);
      throw error;
    }
  }

  // 📝 Tạo bảng Report
  async createReportTable() {
    const sql = `
      CREATE TABLE Report (
        report_id INT AUTO_INCREMENT PRIMARY KEY,
        reporter_id INT NOT NULL,
        reported_id INT NOT NULL,
        type TEXT,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reporter_id) REFERENCES User(user_id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (reported_id) REFERENCES User(user_id)
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `;

    try {
      console.log('📝 Creating Report table...');
      await this.runSQL(sql);
      console.log('✅ Report table created!');
    } catch (error) {
      console.error('❌ Error creating Report table:', error.message);
      throw error;
    }
  }

  // ⚡ Tạo các indexes
  async createIndexes() {
    const indexes = [
      'CREATE INDEX idx_user_balance ON User(balance)',
      'CREATE INDEX idx_tx_user ON Transactions(user_id)',
      'CREATE INDEX idx_game_table ON Game_History(table_id)',
      'CREATE INDEX idx_ban_user ON Banned_Player(reported_id)',
      'CREATE INDEX idx_appeal_report ON Appeal(report_id)',
      'CREATE INDEX idx_report_reported ON Report(reported_id)',
      'CREATE INDEX idx_report_reporter ON Report(reporter_id)'
    ];

    try {
      console.log('⚡ Creating indexes...');
      for (const indexSql of indexes) {
        await this.runSQL(indexSql);
      }
      console.log('✅ All indexes created!');
    } catch (error) {
      console.error('❌ Error creating indexes:', error.message);
      throw error;
    }
  }

  // 🎯 Tạo triggers
  async createTriggers() {
    const triggers = [
      // Trigger cập nhật số dư khi có giao dịch mới
      `
      CREATE TRIGGER tr_transaction_insert
        AFTER INSERT ON Transactions
        FOR EACH ROW
      BEGIN
        UPDATE User 
        SET balance = balance + NEW.amount 
        WHERE user_id = NEW.user_id;
        
        IF NEW.source_id IS NOT NULL THEN
          UPDATE User 
          SET balance = balance - NEW.amount 
          WHERE user_id = NEW.source_id;
        END IF;
      END
      `,

      // Trigger ngăn xóa giao dịch
      `
      CREATE TRIGGER tr_prevent_transaction_delete
        BEFORE DELETE ON Transactions
        FOR EACH ROW
      BEGIN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Không được phép xóa giao dịch. Hãy tạo giao dịch hoàn tác thay vì xóa.';
      END
      `,

      // Trigger ngăn sửa giao dịch
      `
      CREATE TRIGGER tr_prevent_transaction_update
        BEFORE UPDATE ON Transactions
        FOR EACH ROW
      BEGIN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Không được phép sửa giao dịch. Hãy tạo giao dịch hoàn tác thay vì sửa đổi.';
      END
      `,

      // Trigger kiểm tra số dư không âm
      `
      CREATE TRIGGER tr_user_balance_check
        BEFORE UPDATE ON User
        FOR EACH ROW
      BEGIN
        IF NEW.balance < 0 THEN
          SIGNAL SQLSTATE '45000' 
          SET MESSAGE_TEXT = 'Số dư không thể âm. Giao dịch bị từ chối.';
        END IF;
      END
      `
    ];

    try {
      console.log('🎯 Creating triggers...');
      for (const triggerSql of triggers) {
        await this.runSQL(triggerSql);
      }
      console.log('✅ All triggers created!');
    } catch (error) {
      console.error('❌ Error creating triggers:', error.message);
      throw error;
    }
  }

  // 📦 Tạo stored procedure
  async createStoredProcedures() {
    const procedure = `
      CREATE PROCEDURE ReverseTransaction(
        IN original_tx_id INT,
        IN reversal_reason TEXT
      )
      BEGIN
        DECLARE original_user_id INT;
        DECLARE original_source_id INT;
        DECLARE original_amount DECIMAL(15,2);
        DECLARE original_reason TEXT;
        DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
          ROLLBACK;
          RESIGNAL;
        END;

        START TRANSACTION;
        
        SELECT user_id, source_id, amount, reason 
        INTO original_user_id, original_source_id, original_amount, original_reason
        FROM Transactions 
        WHERE tx_id = original_tx_id;
        
        IF original_user_id IS NULL THEN
          SIGNAL SQLSTATE '45000' 
          SET MESSAGE_TEXT = 'Giao dịch không tồn tại.';
        END IF;
        
        IF EXISTS (
          SELECT 1 FROM Transactions 
          WHERE reason LIKE CONCAT('REVERSAL of TX#', original_tx_id, '%')
        ) THEN
          SIGNAL SQLSTATE '45000' 
          SET MESSAGE_TEXT = 'Giao dịch đã được hoàn tác trước đó.';
        END IF;
        
        INSERT INTO Transactions (
          user_id, 
          source_id, 
          amount, 
          reason
        ) VALUES (
          original_source_id,
          original_user_id,
          original_amount,
          CONCAT('REVERSAL of TX#', original_tx_id, ' - ', reversal_reason)
        );
        
        COMMIT;
        
        SELECT LAST_INSERT_ID() as reversal_tx_id;
      END
    `;

    try {
      console.log('📦 Creating stored procedures...');
      await this.runSQL(procedure);
      console.log('✅ ReverseTransaction procedure created!');
    } catch (error) {
      console.error('❌ Error creating stored procedures:', error.message);
      throw error;
    }
  }

  // 🎭 Chèn dữ liệu demo
  async insertDemoData() {
    // Không chèn dữ liệu demo vào production
    if (this.env === 'production') {
      console.log('🎭 Skipping demo data for production environment');
      return;
    }

    try {
      console.log(`🎭 Inserting demo data for ${this.env} environment...`);

      // Thêm users
      await this.connection.execute(`
        INSERT INTO User (username, password, balance, banned) VALUES
        ('Alice', 'hashed_password_1', 0, FALSE),
        ('Bob', 'hashed_password_2', 0, TRUE),
        ('Charlie', 'hashed_password_3', 0, FALSE)
      `);
      console.log('👥 Demo users inserted!');

      // Thêm table info
      await this.connection.execute(`
        INSERT INTO Table_Info (min_players, max_players, small_blind, max_blind, min_buy_in, max_buy_in, rake)
        VALUES (2, 6, 50, 100, 2000, 10000, 0.05)
      `);
      console.log('🎲 Demo table info inserted!');

      // Thêm game history
      await this.connection.execute(`
        INSERT INTO Game_History (table_id, game_type, winner)
        VALUES (1, 'Texas Hold\\'em', 1)
      `);
      console.log('🎮 Demo game history inserted!');

      // Thêm transactions (triggers sẽ tự động cập nhật balance)
      await this.connection.execute(`
        INSERT INTO Transactions (user_id, amount, reason, source_id)
        VALUES
        (1, 5000, 'Initial deposit', null),
        (2, 3000, 'Game winnings', 1),
        (3, 1000, 'Send present', 1)
      `);
      console.log('💰 Demo transactions inserted!');

      // Thêm banned player
      await this.connection.execute(`
        INSERT INTO Banned_Player (reported_id, reason, chat_history)
        VALUES (2, 'Using offensive language in chat', '"You are so bad, noob!"')
      `);
      console.log('🚫 Demo banned player inserted!');

      // Thêm appeal
      await this.connection.execute(`
        INSERT INTO Appeal (report_id, action, appeal_by)
        VALUES (1, NULL, 2)
      `);
      console.log('📞 Demo appeal inserted!');

      // Thêm report
      await this.connection.execute(`
        INSERT INTO Report (reporter_id, reported_id, type, reason)
        VALUES 
        (1, 2, 'Cheating', 'Used bot to play'),
        (3, 2, 'Toxic Behavior', 'Offensive language and harassment')
      `);
      console.log('📝 Demo reports inserted!');

      console.log('✅ All demo data inserted successfully!');
    } catch (error) {
      console.error('❌ Error inserting demo data:', error.message);
      throw error;
    }
  }

  // 🧪 Test các triggers và procedures
  async runTests() {
    // Không test chi tiết trên production (chỉ test cơ bản)
    if (this.env === 'production') {
      console.log('\n🧪 Running basic tests for production...');

      try {
        // Chỉ test cơ bản: kiểm tra tables tồn tại
        const [tables] = await this.connection.query(`
          SELECT table_name FROM information_schema.tables 
          WHERE table_schema = DATABASE()
        `);

        console.log('✅ Database tables created successfully:');
        if (Array.isArray(tables) && tables.length > 0) {
          tables.forEach(t => console.log(`   • ${t.TABLE_NAME || t.table_name}`));
          console.log(`📊 Total tables: ${tables.length}`);
        } else {
          console.log('   • No tables found');
        }

        console.log('\n✅ Production setup completed successfully!');
        return;
      } catch (error) {
        console.error('❌ Production test failed:', error.message);
        throw error;
      }
    }

    try {
      console.log(`\n🧪 Running detailed tests for ${this.env}...`);

      // Test 1: Kiểm tra số dư sau khi chèn data
      console.log('\n📊 Test 1: Checking balances after demo data...');
      const [balances] = await this.connection.execute(`
        SELECT username, balance FROM User ORDER BY user_id
      `);
      console.table(balances);

      // Test 2: Thử xóa giao dịch (sẽ lỗi)
      console.log('\n🚫 Test 2: Trying to delete transaction (should fail)...');
      try {
        await this.connection.execute('DELETE FROM Transactions WHERE tx_id = 1');
        console.log('❌ ERROR: Delete should have failed!');
      } catch (error) {
        console.log('✅ Expected error:', error.message);
      }

      // Test 3: Thử sửa giao dịch (sẽ lỗi)
      console.log('\n🚫 Test 3: Trying to update transaction (should fail)...');
      try {
        await this.connection.execute('UPDATE Transactions SET amount = 6000 WHERE tx_id = 1');
        console.log('❌ ERROR: Update should have failed!');
      } catch (error) {
        console.log('✅ Expected error:', error.message);
      }

      // Test 4: Hoàn tác giao dịch
      console.log('\n🔄 Test 4: Reversing transaction #3...');
      await this.connection.execute('CALL ReverseTransaction(3, "Test reversal")');
      console.log('✅ Transaction reversed successfully!');

      // Test 5: Kiểm tra số dư sau hoàn tác
      console.log('\n📊 Test 5: Checking balances after reversal...');
      const [newBalances] = await this.connection.execute(`
        SELECT username, balance FROM User ORDER BY user_id
      `);
      console.table(newBalances);

      // Test 6: Xem lịch sử giao dịch
      console.log('\n📋 Test 6: Transaction history...');
      const [history] = await this.connection.execute(`
        SELECT tx_id, user_id, source_id, amount, reason, time
        FROM Transactions ORDER BY time
      `);
      console.table(history);

      console.log('\n🎉 All tests completed!');
    } catch (error) {
      console.error('❌ Error running tests:', error.message);
      throw error;
    }
  }

  // 🚪 Đóng kết nối
  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      console.log('🚪 Database connection closed.');
    }
  }

  // 🚀 Chạy toàn bộ quá trình
  async run() {
    try {
      console.log(`🚀 Starting database creation process for ${this.env.toUpperCase()} environment...\n`);

      // Kết nối trước để có thể kiểm tra database
      await this.connect();

      // Xác nhận sau khi đã kết nối (để có thể check database exists)
      const confirmed = await this.confirmProduction();
      if (!confirmed) {
        console.log('\n🛑 Setup cancelled by user.');
        await this.disconnect();
        process.exit(0);
      }
      await this.dropDatabase();
      await this.createDatabase();

      console.log('\n📋 Creating tables...');
      await this.createUserTable();
      await this.createTransactionsTable();
      await this.createTableInfoTable();
      await this.createGameHistoryTable();
      await this.createBannedPlayerTable();
      await this.createAppealTable();
      await this.createReportTable();

      await this.createIndexes();
      await this.createTriggers();
      await this.createStoredProcedures();
      await this.insertDemoData();

      await this.runTests();

      console.log('\n🎉 Database setup completed successfully!');

    } catch (error) {
      console.error('\n💥 Setup failed:', error.message);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// 🎬 Chạy script
const creator = new DatabaseCreator();
creator.run();

export default DatabaseCreator;
