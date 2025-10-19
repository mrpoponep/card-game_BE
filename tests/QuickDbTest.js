// tests/QuickDbTest.js
import db from '../backend/model/DatabaseConnection.js';

/**
 * 🚀 Quick Database Test
 * Test nhanh các operations cơ bản
 */

async function quickTest() {
  console.log('🧪 Quick Database Test Starting...\n');
  
  try {
    // 1. Test Connection
    console.log('1️⃣ Testing connection...');
    await db.connect();
    console.log('✅ Connected successfully!');

    await db.clearAllData();

    // 2. Test Basic Query
    console.log('\n2️⃣ Testing basic query...');
    const pingResult = await db.query('SELECT 1 as ping, NOW() as CurrentTime;');
    console.log('✅ Query result:', pingResult[0]);
    
    // 3. Test Insert
    console.log('\n3️⃣ Testing insert...');
    const insertResult = await db.query(
      'INSERT INTO user (username, password, elo) VALUES (?, ?, ?)',
      ['quick_test_user', 'test_password', 1250]
    );
    console.log('✅ Insert result:', insertResult);
    
    // 4. Test Select
    console.log('\n4️⃣ Testing select...');
    const selectResult = await db.query('SELECT * FROM user WHERE username = ?', ['quick_test_user']);
    console.log('✅ Select result:', selectResult[0]);
    
    // 5. Test Update
    console.log('\n5️⃣ Testing update...');
    const updateResult = await db.query(
      'UPDATE user SET elo = ? WHERE username = ?',
      [1500, 'quick_test_user']
    );
    console.log('✅ Update result:', updateResult);
    
    // 6. Test Transaction
    console.log('\n6️⃣ Testing transaction...');
    let connection = null;
    try {
      connection = await db.beginTransaction();
      
      await db.transactionQuery(
        connection,
        'UPDATE user SET elo = ? WHERE username = ?',
        [1800, 'quick_test_user']
      );
      
      await db.commit(connection);
      console.log('✅ Transaction committed successfully');
    } catch (error) {
      if (connection) await db.rollback(connection);
      throw error;
    }
    
    // 7. Test Delete
    console.log('\n7️⃣ Testing delete...');
    const deleteResult = await db.query('DELETE FROM user WHERE username = ?', ['quick_test_user']);
    console.log('✅ Delete result:', deleteResult);
    
    // 8. Connection Status
    console.log('\n8️⃣ Testing connection status...');
    const status = await db.getConnectionStatus();
    console.log('✅ Connection status:', status);
    
    console.log('\n🎉 All quick tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('📋 Stack trace:', error.stack);
  } finally {
    await db.disconnect();
    console.log('\n👋 Database disconnected');
  }
}

quickTest();

export { quickTest };