// models/DatabaseConnection.js

/**
 * Database Connection Handler
 * Giả lập database operations (bạn có thể thay thế bằng MySQL, PostgreSQL, MongoDB...)
 */
class DatabaseConnection {
  constructor() {
    this.users = new Map(); // Giả lập table users
    this.games = new Map(); // Giả lập table games
    this.nextUserId = 1;
    this.nextGameId = 1;
  }

  // 🔍 QUERY METHODS
  async query(sql, params = []) {
    console.log(`🗄️ DB Query: ${sql}`, params);
    
    // Giả lập các operations cơ bản
    if (sql.includes('SELECT * FROM users WHERE id = ?')) {
      const [id] = params;
      return this.users.get(parseInt(id)) || null;
    }
    
    if (sql.includes('SELECT * FROM users WHERE name = ?')) {
      const [name] = params;
      for (const user of this.users.values()) {
        if (user.name === name) return user;
      }
      return null;
    }
    
    if (sql.includes('INSERT INTO users')) {
      const [name, password, elo, level, experience, avatar, joinedAt, lastActiveAt, status] = params;
      const newUser = {
        id: this.nextUserId++,
        name,
        password,
        elo,
        level,
        experience,
        avatar,
        joined_at: joinedAt,
        last_active_at: lastActiveAt,
        status
      };
      this.users.set(newUser.id, newUser);
      return { insertId: newUser.id };
    }
    
    if (sql.includes('UPDATE users')) {
      const [name, password, elo, level, experience, avatar, lastActiveAt, status, id] = params;
      const user = this.users.get(parseInt(id));
      if (user) {
        Object.assign(user, {
          name, password, elo, level, experience, avatar,
          last_active_at: lastActiveAt, status
        });
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }
    
    if (sql.includes('DELETE FROM users WHERE id = ?')) {
      const [id] = params;
      const deleted = this.users.delete(parseInt(id));
      return { affectedRows: deleted ? 1 : 0 };
    }
    
    if (sql.includes('SELECT * FROM users ORDER BY elo DESC')) {
      const [limit, offset] = params;
      const allUsers = Array.from(this.users.values())
        .sort((a, b) => b.elo - a.elo)
        .slice(offset, offset + limit);
      return allUsers;
    }
    
    throw new Error(`Unsupported query: ${sql}`);
  }

  // 🔧 UTILITY METHODS
  async connect() {
    console.log('🔗 Database connected');
    return this;
  }

  async disconnect() {
    console.log('❌ Database disconnected');
  }

  async beginTransaction() {
    console.log('🔄 Transaction started');
  }

  async commit() {
    console.log('✅ Transaction committed');
  }

  async rollback() {
    console.log('↩️ Transaction rolled back');
  }

  // 📊 DEBUG METHODS
  getAllUsers() {
    return Array.from(this.users.values());
  }

  getUserCount() {
    return this.users.size;
  }

  clearAllData() {
    this.users.clear();
    this.games.clear();
    this.nextUserId = 1;
    this.nextGameId = 1;
    console.log('🗑️ All data cleared');
  }
}

// Singleton instance
const db = new DatabaseConnection();

export default db;