// models/User.js
import db from './DatabaseConnection.js';

class User {
  // Bỏ static instances, việc cache này gây ra lỗi treo server.
  // Nếu cần cache trong tương lai, nên dùng một giải pháp chuyên dụng như Redis.

  constructor({
    user_id = null,
    username = null,
    password = null,
    balance = 0,
    banned = false,
    elo = 1000,
    avatar_url = null,
  }) {
    this.user_id = user_id;
    this.username = username;
    this.password = password;
    this.balance = Number(balance) || 0; // Đảm bảo balance là một con số
    this.banned = Boolean(banned);
    this.elo = Number(elo) || 1000;
    this.avatar_url = avatar_url;
  }

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
      user_id: this.user_id,
      username: this.username,
      balance: this.balance,
      banned: this.banned,
      elo: this.elo,
      avatar_url: this.avatar_url,
    };
  }

  async save() {
    this.validate();
    if (this.user_id) {
      return await User.updateInDatabase(this);
    } else {
      return await User.insertIntoDatabase(this);
    }
  }

  // 🗄️ STATIC DATABASE METHODS (Đã sửa lỗi)
  static async findById(user_id) {
    const dbRow = (await db.query('SELECT * FROM user WHERE user_id = ?', [user_id]))[0];
    if (dbRow) {
      return new User(dbRow); // Trả về instance User, không gọi lại findById
    }
    return null;
  }

  static async findByName(name) {
    const dbRow = (await db.query('SELECT * FROM user WHERE username = ?', [name]))[0];
    if (dbRow) {
      return new User(dbRow); // Trả về instance User
    }
    return null;
  }
  
  // (Các hàm khác giữ nguyên cấu trúc nhưng đảm bảo chúng hoạt động với constructor mới)
  static async listRankings(limit = 100) {
    const dbRows = await db.query(
      `SELECT * FROM user WHERE banned = false ORDER BY elo DESC LIMIT ${limit}`
    );
    return dbRows.map(row => new User(row));
  }

  static async insertIntoDatabase(user) {
    const query = `
      INSERT INTO user (username, password, elo, avatar_url, balance, banned)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await db.query(query, [
      user.username,
      user.password,
      user.elo,
      user.avatar_url,
      user.balance,
      user.banned
    ]);
    user.user_id = result.insertId;
    return user;
  }

  static async updateInDatabase(user) {
    const query = `
      UPDATE user
      SET username = ?, password = ?, elo = ?, balance = ?, banned = ?, avatar_url = ?
      WHERE user_id = ?
    `;
    await db.query(query, [
      user.username,
      user.password,
      user.elo,
      user.balance,
      user.banned,
      user.avatar_url, 
      user.user_id
    ]);
    return user;
  }
}

export default User;