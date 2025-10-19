// models/DatabaseConnection.js
import mysql from 'mysql2/promise';
import { currentConfig } from '../config/database.config.js';

/**
 * MySQL Database Connection Handler
 * Kết nối thật sự với MySQL Database
 */
class DatabaseConnection {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  // 🔍 QUERY METHODS
  async query(sql, params = []) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🗄️ MySQL Query: ${sql}`);
        console.log('📋 Params:', params);
      }
      const [rows, fields] = await this.pool.execute(sql, params);
      
      // Handle different query types
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return rows; // Multiple rows
      }
      
      if (sql.trim().toUpperCase().startsWith('INSERT')) {
        return {
          insertId: rows.insertId,
          affectedRows: rows.affectedRows
        };
      }
      
      if (sql.trim().toUpperCase().startsWith('UPDATE') || 
          sql.trim().toUpperCase().startsWith('DELETE')) {
        return {
          affectedRows: rows.affectedRows,
          changedRows: rows.changedRows || 0
        };
      }
      
      return rows;
      
    } catch (error) {
      console.error('❌ MySQL Query Error:', error.message);
      throw error;
    }
  }

  // 🔧 CONNECTION METHODS
  async connect() {
    try {
      if (this.isConnected) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('🔗 Already connected to MySQL');
        }
        return this;
      }

      console.log('🔄 Connecting to MySQL...');
      console.log('📍 Host:', currentConfig.host);
      console.log('🗄️ Database:', currentConfig.database);
      
      // Create connection pool
      this.pool = mysql.createPool({
        host: currentConfig.host,
        port: currentConfig.port,
        user: currentConfig.user,
        password: currentConfig.password,
        database: currentConfig.database,
        connectionLimit: currentConfig.connectionLimit,
        charset: currentConfig.charset,
        timezone: currentConfig.timezone,
        dateStrings: currentConfig.dateStrings,
        supportBigNumbers: currentConfig.supportBigNumbers,
        bigNumberStrings: currentConfig.bigNumberStrings,
        ssl: currentConfig.ssl
      });

      // Test connection
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      
      this.isConnected = true;
      console.log('✅ MySQL connected successfully!');
      
      return this;
      
    } catch (error) {
      console.error('❌ MySQL Connection Error:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (!this.isConnected || !this.pool) {
        console.log('⚠️ No active MySQL connection to close');
        return;
      }

      await this.pool.end();
      this.isConnected = false;
      console.log('❌ MySQL disconnected');
      
    } catch (error) {
      console.error('❌ Error disconnecting MySQL:', error.message);
      throw error;
    }
  }

  // 🔄 TRANSACTION METHODS
  async beginTransaction() {
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔄 MySQL Transaction started');
    }
    return connection;
  }

  async transactionQuery(connection, sql, params = []) {
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🗄️ MySQL Transaction Query: ${sql}`, params);
      }
      const [rows, fields] = await connection.execute(sql, params);
      
      // Handle different query types
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return rows; // Multiple rows
      }
      if (sql.trim().toUpperCase().startsWith('INSERT')) {
        return {
          insertId: rows.insertId,
          affectedRows: rows.affectedRows
        };
      }
      if (sql.trim().toUpperCase().startsWith('UPDATE') ||
          sql.trim().toUpperCase().startsWith('DELETE')) {
        return {
          affectedRows: rows.affectedRows,
          changedRows: rows.changedRows || 0
        };
      }
      return rows;
    } catch (error) {
      console.error('❌ MySQL Transaction Query Error:', error.message);
      console.error('📝 SQL:', sql);
      console.error('📋 Params:', params);
      throw error;
    }
  }

  async commit(connection) {
    await connection.commit();
    connection.release();
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ MySQL Transaction committed');
    }
  }

  async rollback(connection) {
    await connection.rollback();
    connection.release();
    if (process.env.NODE_ENV !== 'production') {  
      console.log('↩️ MySQL Transaction rolled back');
    }
  }


  // 📊 UTILITY METHODS
  async getConnectionStatus() {
    try {
      if (!this.pool) return { connected: false };
      
      const connection = await this.pool.getConnection();
      const [rows] = await connection.execute('SELECT 1 as ping');
      connection.release();
      
      return {
        connected: true,
        config: {
          host: currentConfig.host,
          database: currentConfig.database,
          connectionLimit: currentConfig.connectionLimit
        }
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }


  // ⚠️ DANGEROUS: Only for development
  async clearAllData() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clear data in production environment!');
    }
    
    await this.query('SET FOREIGN_KEY_CHECKS = 0');
    await this.query('TRUNCATE TABLE user');
    await this.query('TRUNCATE TABLE appeal');
    await this.query('TRUNCATE TABLE banned_player');
    await this.query('TRUNCATE TABLE table_info');
    await this.query('TRUNCATE TABLE transactions');
    await this.query('TRUNCATE TABLE game_history');
    await this.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🗑️ All data cleared from MySQL database');
  }
}

// Singleton instance
const db = new DatabaseConnection();

export default db;