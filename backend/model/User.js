// models/User.js
import db from './DatabaseConnection.js';

/**
 * User Model - Định nghĩa cấu trúc và validation cho User
 */
class User {
  // Tạo mảng để lưu các user đã được khởi tạo
  static instances = [];

  constructor({
    user_id = null,
    username = null,
    password = null,
    balance = 0,
    banned = false,
    elo = 1000,
  }) {
    if (user_id) {
      if (username === null) {
        const dbExisting = User.findById(user_id);
        if (dbExisting) {
          return dbExisting;
        }
      }
      this.user_id = user_id;
      this.username = username; 
      this.password = password;
      this.balance = balance;
      this.banned = banned;
      this.elo = elo;
      User.instances.push(this);
      return this;
    }
    
    this.username = username;
    this.password = password;
    this.balance = balance;
    this.banned = banned;
    this.elo = elo;

    // Validate dữ liệu khi tạo instance
    this.validate();

    User.instances.push(this);
  }

  // 🔍 VALIDATION METHODS
  validate() {
    if (!this.username || this.username.length < 3) {
      throw new Error('User name must be at least 3 characters long');
    }

    if (this.elo < 0) {
      throw new Error('Elo cannot be negative');
    }
  }

  dispose() {
    const index = User.instances.indexOf(this);
    if (index !== -1) {
      this.save();
      User.instances.splice(index, 1);
    }
  }

  setBanned(banned) {
    this.banned = banned;
    this.save();
  }

  setElo(elo) {
    if (elo < 0) {
      throw new Error('Elo cannot be negative');
    }
    this.elo = elo;
    this.save();
  }

  async getRank() {
    // Olympic ranking: người cùng ELO có cùng rank
    // Rank = số người có ELO STRICTLY GREATER + 1
    // Ví dụ: 2 người ELO 2500 (rank 1), 1 người ELO 2000 (rank 3)
    const result = await db.query(
      "SELECT COUNT(*) + 1 AS 'rank' FROM user WHERE elo > ? AND banned = false", 
      [this.elo]
    );
    return result[0].rank;
  }

  // 🔄 SERIALIZATION
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      gamesPlayed: this.gamesPlayed,
      winRate: this.winRate,
      balance: this.balance,
      banned: this.banned,
      elo: this.elo,
    };
  }

  // � DATABASE OPERATIONS
  /**
   * Lưu thay đổi vào database
   * @returns {Promise<User>} Updated user instance
   */
  async save() {
    this.validate(); // Validate trước khi save
    
    if (this.user_id) {
      // UPDATE existing user
      return await User.updateInDatabase(this);
    } else {
      // CREATE new user
      return await User.insertIntoDatabase(this);
    }
  }

  // 🗄️ STATIC DATABASE METHODS
  /**
   * Tìm user theo ID
   */
  static async findById(user_id) {
    // Tìm user trong bộ nhớ trước
    const cachedUser = User.instances.find(user => user.user_id === user_id);
    if (cachedUser) {
      return cachedUser;
    }

    const dbRow = (await db.query('SELECT * FROM user WHERE user_id = ?', [user_id]))[0];
    if (dbRow) {
      const data = {
        user_id: dbRow.user_id,
        username: dbRow.username,
        password: dbRow.password,
        balance: dbRow.balance,
        banned: dbRow.banned,
        elo: dbRow.elo,
      };
      return new User(data);
    }
    return null;
  }

  /**
   * Tìm user theo name
   */
  static async findByName(name) {
    // Tìm user trong bộ nhớ trước
    const cachedUser = User.instances.find(user => user.username === name);
    if (cachedUser) {
      return cachedUser;
    }

    const dbRow = (await db.query('SELECT * FROM user WHERE username = ?', [name]))[0];
    if (dbRow) {
      const data = {
        user_id: dbRow.user_id,
        username: dbRow.username,
        password: dbRow.password,
        balance: dbRow.balance,
        banned: dbRow.banned,
        elo: dbRow.elo,
      };
      return new User(data);
    }
    return null;
  }

  static async listRankings(limit = 100) {
    const dbRows = await db.query(
      `SELECT * FROM user WHERE banned = false ORDER BY elo DESC LIMIT ${limit}`
    );
    return dbRows.map(row => new User(row));
  }

  /**
   * Tạo user mới trong database
   */
  static async insertIntoDatabase(user) {
    const query = `
      INSERT INTO user (username, password, elo)
      VALUES (?, ?, ?)
    `;
    
    const result = await db.query(query, [
      user.username,
      user.password,
      user.elo,
    ]);
    
    user.user_id = result.insertId;
    return user;
  }

  /**
   * Cập nhật user trong database
   */
  static async updateInDatabase(user) {
    const query = `
      UPDATE user
      SET username = ?, password = ?, elo = ?, balance = ?, banned = ?
      WHERE user_id = ?
    `;
    
    await db.query(query, [
      user.username,
      user.password,
      user.elo,
      user.balance,
      user.banned,
      user.user_id
    ]);
    
    return user;
  }
}

export default User;