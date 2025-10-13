// tests/DbTest.js
import db from '../backend/model/DatabaseConnection.js';
import User from '../backend/model/User.js';

/**
 * 🧪 Database Test Suite
 * Test tất cả database operations và connections
 */

class DbTest {
  constructor() {
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
  }

  // 📋 Test Runner
  async runAllTests() {
    console.log('🚀 Starting Database Test Suite...\n');
    
    try {
      // Test basic connection
      await this.testConnection();
      await this.testConnectionStatus();
      
      db.clearAllData();

      // Test basic CRUD operations
      await this.testBasicQueries();
      await this.testUserCRUD();
      
      // Test User Model integration
      await this.testUserModel();
      
      // Test transactions
      await this.testTransactions();
      
      // Test error handling
      await this.testErrorHandling();
      
      // Test performance
      await this.testPerformance();
      
      // Clean up
      await this.testCleanup();
      
    } catch (error) {
      console.error('🚨 Critical test suite error:', error);
    } finally {
      await this.printSummary();
      await db.disconnect();
    }
  }

  // 🔧 Test Helper Methods
  async test(testName, testFunction) {
    this.totalTests++;
    console.log(`\n🧪 Testing: ${testName}`);
    
    try {
      await testFunction();
      this.passedTests++;
      this.testResults.push({ name: testName, status: 'PASS' });
      console.log(`✅ PASS: ${testName}`);
    } catch (error) {
      this.failedTests++;
      this.testResults.push({ name: testName, status: 'FAIL', error: error.message });
      console.log(`❌ FAIL: ${testName} - ${error.message}`);
    }
  }

  // 🔗 Connection Tests
  async testConnection() {
    await this.test('Database Connection', async () => {
      await db.connect();
      if (!db.isConnected) {
        throw new Error('Connection failed');
      }
    });
  }

  async testConnectionStatus() {
    await this.test('Connection Status Check', async () => {
      const status = await db.getConnectionStatus();
      if (!status.connected) {
        throw new Error('Status check failed');
      }
      console.log('📊 Connection Status:', status);
    });
  }

  // 🔍 Basic Query Tests
  async testBasicQueries() {
    await this.test('Basic SELECT Query', async () => {
      const result = await db.query('SELECT 1 as ping');
      console.log('✅ Query result:', result[0]);
    });

    await this.test('Basic INSERT Query', async () => {
      const result = await db.query(
        `INSERT INTO user (username, password, elo) VALUES (?, ?, ?)`,
        ['test_user_1', 'hashed_password', 1200]
      );
      
      if (!result.insertId || result.affectedRows !== 1) {
        throw new Error('INSERT query failed');
      }
      console.log('📝 Inserted user with ID:', result.insertId);
    });

    await this.test('Basic UPDATE Query', async () => {
      const result = await db.query(
        `UPDATE user SET elo = ? WHERE username = ?`,
        [1300, 'test_user_1']
      );
      
      if (result.affectedRows !== 1) {
        throw new Error('UPDATE query failed');
      }
    });

    await this.test('Basic DELETE Query', async () => {
      const result = await db.query(
        `DELETE FROM user WHERE username = ?`,
        ['test_user_1']
      );
      
      if (result.affectedRows !== 1) {
        throw new Error('DELETE query failed');
      }
    });
  }

  // 👤 User Model Tests
  async testUserModel() {
    await this.test('User Model Creation', async () => {
      const user = new User({
        username: 'ModelTestUser',
        password: 'hashed_password_123'
      });
      
      if (user.username !== 'ModelTestUser') {
        throw new Error('User model creation failed');
      }
    });

    await this.test('User Model Save', async () => {
      const user = new User({
        username: 'SaveTestUser',
        password: 'hashed_password_456',
        elo: 1100
      });
      
      await user.save();
      
      if (!user.user_id) {
        throw new Error('User save failed - no ID assigned');
      }
      console.log('💾 Saved user with ID:', user.user_id);
    });

    await this.test('User Model Find', async () => {
      const user = await User.findByName('SaveTestUser');
      
      if (!user || user.elo !== 1100) {
        throw new Error('User find failed');
      }
      console.log('🔍 Found user:', user.name, 'with elo:', user.elo);
    });

    await this.test('User Model Update', async () => {
      const user = await User.findByName('SaveTestUser');
      user.elo = 1600;
      
      await user.save();
      
      // Verify update
      const updatedUser = await User.findByName('SaveTestUser');
      if (updatedUser.elo !== 1600) {
        throw new Error('User update failed');
      }
    });
  }

  // 🔄 Transaction Tests
  async testTransactions() {
    await this.test('Transaction Success Scenario', async () => {
      let connection = null;
      
      try {
        connection = await db.beginTransaction();
        
        // Insert test user 1
        const result1 = await db.transactionQuery(
          connection,
          'INSERT INTO user (username, password, elo) VALUES (?, ?, ?)',
          ['tx_user_1', 'pass1', 1000]
        );
        
        // Insert test user 2
        const result2 = await db.transactionQuery(
          connection,
          'INSERT INTO user (username, password, elo) VALUES (?, ?, ?)',
          ['tx_user_2', 'pass2', 1200]
        );
        
        await db.commit(connection);
        
        // Verify both user exist
        const users = await db.query('SELECT * FROM user WHERE username LIKE ?', ['tx_user_%']);
        if (users.length !== 2) {
          throw new Error('Transaction commit verification failed');
        }
        
      } catch (error) {
        if (connection) await db.rollback(connection);
        throw error;
      }
    });

    await this.test('Transaction Rollback Scenario', async () => {
      let connection = null;
      
      try {
        connection = await db.beginTransaction();
        
        // Insert valid user
        await db.transactionQuery(
          connection,
          'INSERT INTO user (username, password, elo) VALUES (?, ?, ?)',
          ['rollback_user_1', 'pass1', 1000]
        );
        
        // Try to insert duplicate (should fail)
        await db.transactionQuery(
          connection,
          'INSERT INTO user (username, password, elo) VALUES (?, ?, ?)',
          ['rollback_user_1', 'pass2', 1200] // Same name = duplicate key error
        );
        
        await db.commit(connection);
        throw new Error('Transaction should have failed due to duplicate key');
        
      } catch (error) {
        if (connection) await db.rollback(connection);
        
        // Verify rollback worked - no user with rollback_user prefix
        const users = await db.query('SELECT * FROM user WHERE username LIKE ?', ['rollback_user_%']);
        if (users.length > 0) {
          throw new Error('Transaction rollback failed - data still exists');
        }
        
        console.log('✅ Rollback worked correctly');
      }
    });
  }

  // 🔍 CRUD Tests
  async testUserCRUD() {
    let testUserId = null;
    
    await this.test('CRUD - Create User', async () => {
      const result = await db.query(
        'INSERT INTO user (username, password, elo) VALUES (?, ?, ?)',
        ['crud_test_user', 'hashed_pass', 1400]
      );
      
      testUserId = result.insertId;
      if (!testUserId) {
        throw new Error('Create operation failed');
      }
    });

    await this.test('CRUD - Read User', async () => {
      const users = await db.query('SELECT * FROM user where user_id= ?', [testUserId]);
      
      if (!users || users.length === 0 || users[0].username !== 'crud_test_user') {
        throw new Error('Read operation failed');
      }
      console.log('📖 Read user:', users[0].username);
    });

    await this.test('CRUD - Update User', async () => {
      const result = await db.query(
        'UPDATE user SET elo = ? where user_id= ?',
        [1800, testUserId]
      );
      
      if (result.affectedRows !== 1) {
        throw new Error('Update operation failed');
      }
    });

    await this.test('CRUD - Delete User', async () => {
      const result = await db.query('DELETE FROM user where user_id= ?', [testUserId]);
      
      if (result.affectedRows !== 1) {
        throw new Error('Delete operation failed');
      }
    });
  }

  // ❌ Error Handling Tests
  async testErrorHandling() {
    await this.test('Invalid Query Handling', async () => {
      try {
        await db.query('INVALID SQL SYNTAX');
        throw new Error('Should have thrown an error for invalid SQL');
      } catch (error) {
        if (!error.message.includes('SQL')) {
          throw new Error('Unexpected error type: ' + error.message);
        }
        console.log('✅ Properly caught SQL syntax error');
      }
    });

    await this.test('Duplicate Key Error', async () => {
      try {
        // Insert user
        await db.query('INSERT INTO user (username, password) VALUES (?, ?)', ['dup_user', 'pass1']);
        
        // Try to insert same username (should fail)
        await db.query('INSERT INTO user (username, password) VALUES (?, ?)', ['dup_user', 'pass2']);
        
        throw new Error('Should have thrown duplicate key error');
      } catch (error) {
        if (!error.message.includes('Duplicate') && !error.message.includes('duplicate')) {
          throw new Error('Unexpected error type: ' + error.message);
        }
        console.log('✅ Properly caught duplicate key error');
      }
    });
  }

  // ⚡ Performance Tests
  async testPerformance() {
    await this.test('Batch Insert Performance', async () => {
      const startTime = Date.now();
      const batchSize = 100;
      
      // Insert multiple user quickly
      for (let i = 0; i < batchSize; i++) {
        await db.query(
          'INSERT INTO user (username, password, elo) VALUES (?, ?, ?)',
          [`perf_user_${i}`, 'pass', 1000 + i]
        );
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`⚡ Inserted ${batchSize} user in ${duration}ms (${(batchSize/duration*1000).toFixed(2)} ops/sec)`);
      
      if (duration > 10000) { // More than 10 seconds is too slow
        throw new Error(`Performance too slow: ${duration}ms for ${batchSize} inserts`);
      }
    });

    await this.test('Query Performance', async () => {
      const startTime = Date.now();
      
      // Run multiple queries
      for (let i = 0; i < 50; i++) {
        await db.query('SELECT COUNT(*) as count FROM user');
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`⚡ 50 SELECT queries in ${duration}ms`);
      
      if (duration > 5000) { // More than 5 seconds is too slow
        throw new Error(`Query performance too slow: ${duration}ms`);
      }
    });
  }

  // 🗑️ Cleanup Tests
  async testCleanup() {
    await this.test('Data Cleanup', async () => {
      if (process.env.NODE_ENV === 'production') {
        console.log('⚠️ Skipping cleanup in production');
        return;
      }
      
      await db.clearAllData();
      
      // Verify cleanup
      const userCount = await db.query('SELECT COUNT(*) as count FROM user');
      if (userCount[0].count !== '0') {
        throw new Error('Cleanup failed - user data still exists');
      }
    });
  }

  // 📊 Test Summary
  async printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('🎯 DATABASE TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`📊 Total Tests: ${this.totalTests}`);
    console.log(`✅ Passed: ${this.passedTests}`);
    console.log(`❌ Failed: ${this.failedTests}`);
    console.log(`📈 Success Rate: ${((this.passedTests/this.totalTests)*100).toFixed(1)}%`);
    
    if (this.failedTests > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults
        .filter(test => test.status === 'FAIL')
        .forEach(test => {
          console.log(`  • ${test.name}: ${test.error}`);
        });
    }
    
    console.log('\n' + (this.failedTests === 0 ? '🎉 ALL TESTS PASSED!' : '🚨 SOME TESTS FAILED!'));
    console.log('='.repeat(50));
  }
}

const testSuite = new DbTest();
testSuite.runAllTests();

export default DbTest;