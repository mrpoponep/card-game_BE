// tests/testRanking.js
import db from '../backend/model/DatabaseConnection.js';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 🧪 Test Ranking System
 * - Thêm 100 người chơi ngẫu nhiên
 * - Chạy server để test ranking
 * - Dọn dẹp sau khi kết thúc
 */

class RankingTest {
  constructor() {
    this.testUserIds = [];
    this.serverProcess = null;
  }

  // 🎲 Tạo dữ liệu ngẫu nhiên
  generateRandomUser(index) {
    const usernames = [
      'Player', 'Gamer', 'Pro', 'Legend', 'Master', 'King', 'Queen',
      'Ninja', 'Dragon', 'Phoenix', 'Shadow', 'Thunder', 'Storm'
    ];
    const randomName = usernames[Math.floor(Math.random() * usernames.length)];
    
    return {
      username: `${randomName}_${index}_${Date.now()}`,
      password: 'test_password_hash',
      balance: Math.floor(Math.random() * 100000),
      elo: 1000 + Math.floor(Math.random() * 2000), // ELO từ 1000-3000
      role: 'Player',
      banned: false
    };
  }

  // ➕ Thêm 100 người chơi
  async addTestUsers() {
    console.log('🎮 Bắt đầu thêm 100 người chơi test...\n');
    
    try {
      await db.connect();
      
      for (let i = 1; i <= 100; i++) {
        const user = this.generateRandomUser(i);
        
        const result = await db.query(
          `INSERT INTO User (username, password, balance, elo, role, banned) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [user.username, user.password, user.balance, user.elo, user.role, user.banned]
        );
        
        this.testUserIds.push(result.insertId);
        
        // Log progress
        if (i % 10 === 0) {
          console.log(`✅ Đã thêm ${i}/100 người chơi...`);
        }
      }
      
      console.log('\n🎉 Đã thêm thành công 100 người chơi!');
      console.log(`📊 User IDs: ${this.testUserIds[0]} - ${this.testUserIds[this.testUserIds.length - 1]}\n`);
      
      // Hiển thị top 10
      const top10 = await db.query(
        `SELECT username, elo, balance 
         FROM User 
         ORDER BY elo DESC 
         LIMIT 10`
      );
      
      console.log('🏆 Top 10 ELO:');
      console.table(top10);
      
      return true;
    } catch (error) {
      console.error('❌ Lỗi khi thêm người chơi:', error.message);
      throw error;
    }
  }

  // 🚀 Khởi động server
  async startServer() {
    return new Promise((resolve, reject) => {
      console.log('\n🚀 Đang khởi động server (môi trường TEST)...\n');
      
      // Spawn server process ở môi trường test
      this.serverProcess = spawn('node', ['backend/server.js'], {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'test' },
        stdio: 'inherit'
      });

      this.serverProcess.on('error', (error) => {
        console.error('❌ Lỗi khi khởi động server:', error.message);
        reject(error);
      });

      // Đợi server khởi động (3 giây)
      setTimeout(() => {
        console.log('✅ Server đã khởi động!');
        console.log('🌐 Truy cập: http://localhost:3000');
        console.log('🗄️  Database: poker_system_test');
        console.log('\n⚠️  Nhấn q+Enter để dừng server và dọn dẹp dữ liệu test...\n');
        resolve();
      }, 3000);
    });
  }

  // 🗑️ Dọn dẹp dữ liệu test
  async cleanup() {
    console.log('\n🧹 Đang dọn dẹp dữ liệu test...');
    
    try {
      if (this.testUserIds.length === 0) {
        console.log('⚠️  Không có dữ liệu test để dọn dẹp');
        return;
      }

      // Xóa tất cả user test
      const placeholders = this.testUserIds.map(() => '?').join(',');
      const result = await db.query(
        `DELETE FROM User WHERE user_id IN (${placeholders})`,
        this.testUserIds
      );

      console.log(`✅ Đã xóa ${result.affectedRows} người chơi test`);
      console.log('🎉 Dọn dẹp hoàn tất!\n');
    } catch (error) {
      console.error('❌ Lỗi khi dọn dẹp:', error.message);
    }
  }

  // 🛑 Dừng server
  stopServer() {
    if (this.serverProcess) {
      console.log('🛑 Đang dừng server...');
      try {
        // Thử SIGTERM trước (graceful shutdown)
        this.serverProcess.kill('SIGTERM');
        
        // Nếu sau 2 giây vẫn không chết, force kill
        setTimeout(() => {
          if (this.serverProcess && !this.serverProcess.killed) {
            console.log('⚠️  Force killing server...');
            this.serverProcess.kill('SIGKILL');
          }
        }, 2000);
      } catch (error) {
        console.error('⚠️  Lỗi khi dừng server:', error.message);
      }
      this.serverProcess = null;
    }
  }

  // 🎬 Chạy test
  async run() {
    process.stdin.resume(); // Giữ event loop sống để cleanup luôn chạy xong
    // Đăng ký cleanup handler TRƯỚC khi làm gì cả
    let cleanupDone = false;
    
    const handleExit = async (signal) => {
      if (cleanupDone) return; // Tránh cleanup nhiều lần
      cleanupDone = true;
      
      console.log(`\n\n🛑 Nhận tín hiệu dừng (${signal})...`);
      
      // Timeout để tránh cleanup bị treo vô hạn
      const cleanupTimeout = setTimeout(() => {
        console.error('\n⚠️  Cleanup timeout (10s)! Force exit...');
        process.exit(1);
      }, 10000);
      
      try {
        // Dừng server
        this.stopServer();
        
        // Dọn dẹp dữ liệu
        await this.cleanup();
        
        // Đóng kết nối database
        await db.disconnect();
        
        console.log('👋 Tạm biệt!\n');
        clearTimeout(cleanupTimeout);
        process.exit(0);
      } catch (error) {
        console.error('\n❌ Lỗi trong cleanup:', error);
        clearTimeout(cleanupTimeout);
        process.exit(1);
      }
    };
    
    // Lắng nghe tín hiệu SIGUSR2 để cleanup và thoát
    process.on('SIGUSR2', () => handleExit('SIGUSR2'));
    process.on('SIGTERM', () => handleExit('SIGTERM'));
    
    // Lắng nghe phím 'q' + Enter để cleanup và thoát
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (data) => {
      if (data.trim().toLowerCase() === 'q') {
        handleExit('USER_QUIT (q)');
      }
    });
    
    process.on('exit', () => {
      if (!cleanupDone) {
        console.log('\n⚠️  Process đang thoát mà chưa cleanup!');
      }
    });
    
    try {
      // Bước 1: Thêm 100 người chơi
      await this.addTestUsers();
      
      // Bước 2: Khởi động server
      await this.startServer();
      
      // Giữ process chạy
      await new Promise(() => {}); // Chờ vô hạn cho đến khi q+Enter
      
    } catch (error) {
      console.error('\n💥 Lỗi:', error.message);
      if (!cleanupDone) {
        await this.cleanup();
        await db.disconnect();
      }
      process.exit(1);
    }
  }
}

// 🎬 Khởi chạy test
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║          🎮 RANKING SYSTEM TEST - 100 Players            ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const test = new RankingTest();
test.run();
