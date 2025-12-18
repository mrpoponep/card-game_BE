// config/database.config.js
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Database Configuration
 * Cấu hình kết nối MySQL
 */
export const dbConfig = {
  // 🔧 CONNECTION SETTINGS
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'poker_system',

  // 🏊 CONNECTION POOL SETTINGS
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
  timeout: parseInt(process.env.DB_TIMEOUT) || 60000,
  reconnect: true,

  // 🔒 SECURITY SETTINGS
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,

  // ⚙️ ADDITIONAL SETTINGS
  charset: 'utf8mb4',
  timezone: '+00:00',
  dateStrings: true,
  supportBigNumbers: true,
  bigNumberStrings: true
};

/**
 * Environment-specific configurations
 */
export const environments = {
  development: {
    ...dbConfig,
    database: 'poker_system_dev',
    debug: true
  },

  production: {
    ...dbConfig,
    database: 'poker_system',
    ssl: {
      rejectUnauthorized: false
    }
  },

  test: {
    ...dbConfig,
    database: 'poker_system_test',
    connectionLimit: 5
  }
};

// Get current environment config
const env = process.env.NODE_ENV || 'development';
export const currentConfig = environments[env] || environments.development;
export default currentConfig;
