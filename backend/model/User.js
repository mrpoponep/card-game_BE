// models/User.js
import db from './DatabaseConnection.js';

/**
 * User Model - Định nghĩa cấu trúc và validation cho User
 */
class User {
  // Tạo mảng để lưu các user đã được khởi tạo
  static instances = [];

  constructor({
    id = null,
    name,
    password = null, // Hash password, không lưu plain text
    elo = 1000, // Điểm elo khởi đầu
    level = 1,
    experience = 0,
    avatar = null,
    joinedAt = new Date(),
    lastActiveAt = new Date(),
    status = 'offline', // offline, online, in-game, banned
  }) {
    if (id) {
      const existing = User.instances.find(user => user.id === id);
      if (existing) {
        return existing;
      }
    }

    this.id = id;
    this.name = name;
    this.password = password;
    this.elo = elo;
    this.level = level;
    this.experience = experience;
    this.avatar = avatar;
    this.joinedAt = joinedAt;
    this.lastActiveAt = lastActiveAt;
    this.status = status;

    // Validate dữ liệu khi tạo instance
    this.validate();

    User.instances.push(this);
  }

  // 🔍 VALIDATION METHODS
  validate() {
    if (!this.name || this.name.trim().length < 3) {
      throw new Error('User name must be at least 3 characters long');
    }

    if (this.elo < 0) {
      throw new Error('Elo cannot be negative');
    }

    if (!['offline', 'online', 'in-game', 'banned'].includes(this.status)) {
      throw new Error('Invalid user status');
    }
  }

  dispose() {
    const index = User.instances.indexOf(this);
    if (index !== -1) {
      this.save();
      User.instances.splice(index, 1);
    }
  }

  get experienceToNextLevel() {
    const requiredExp = this.level * 1000; // 1000 exp per level
    return Math.max(0, requiredExp - this.experience);
  }

  checkLevelUp() {
    const requiredExp = this.level * 1000;
    if (this.experience >= requiredExp) {
      this.level++;
      this.experience -= requiredExp; // Carry over excess exp
      return true; // Level up occurred
    }
    return false;
  }

  updateStatus(newStatus) {
    if (!['offline', 'online', 'in-game', 'banned'].includes(newStatus)) {
      throw new Error('Invalid status');
    }
    if (newStatus === 'offline') {
      this.lastActiveAt = new Date();
    }
    if (newStatus === 'banned' && this.status !== 'offline') {
      this.lastActiveAt = new Date();
    }
    this.status = newStatus;
  }

  // 🔄 SERIALIZATION
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      elo: this.elo,
      gamesPlayed: this.gamesPlayed,
      winRate: this.winRate,
      level: this.level,
      experience: this.experience,
      experienceToNextLevel: this.experienceToNextLevel,
      avatar: this.avatar,
      joinedAt: this.joinedAt,
      lastActiveAt: this.lastActiveAt,
      status: this.status,
    };
  }

  // � DATABASE OPERATIONS
  /**
   * Lưu thay đổi vào database
   * @returns {Promise<User>} Updated user instance
   */
  async save() {
    this.validate(); // Validate trước khi save
    
    if (this.id) {
      // UPDATE existing user
      return await User.updateInDatabase(this);
    } else {
      // CREATE new user
      return await User.insertIntoDatabase(this);
    }
  }

  // 🔧 STATIC FACTORY METHODS
  static fromDatabase(dbRow) {
    return new User({
      id: dbRow.id,
      name: dbRow.name,
      password: dbRow.password,
      elo: dbRow.elo || 1000,
      level: dbRow.level || 1,
      experience: dbRow.experience || 0,
      avatar: dbRow.avatar,
      joinedAt: new Date(dbRow.joined_at),
      lastActiveAt: new Date(dbRow.last_active_at),
      status: dbRow.status || 'offline',
    });
  }

  // 🗄️ STATIC DATABASE METHODS
  /**
   * Tìm user theo ID
   */
  static async findById(id) {
    // TODO: Implement database query
    const dbRow = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    return dbRow ? User.fromDatabase(dbRow) : null;
  }

  /**
   * Tìm user theo name
   */
  static async findByName(name) {
    const dbRow = await db.query('SELECT * FROM users WHERE name = ?', [name]);
    return dbRow ? User.fromDatabase(dbRow) : null;
  }

  /**
   * Tạo user mới trong database
   */
  static async insertIntoDatabase(user) {
    const query = `
      INSERT INTO users (name, password, elo, level, experience, avatar, joined_at, last_active_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await db.query(query, [
      user.name,
      user.password,
      user.elo,
      user.level,
      user.experience,
      user.avatar,
      user.joinedAt,
      user.lastActiveAt,
      user.status
    ]);
    
    user.id = result.insertId;
    return user;
  }

  /**
   * Cập nhật user trong database
   */
  static async updateInDatabase(user) {
    const query = `
      UPDATE users 
      SET name = ?, password = ?, elo = ?, level = ?, experience = ?, 
          avatar = ?, last_active_at = ?, status = ?
      WHERE id = ?
    `;
    
    await db.query(query, [
      user.name,
      user.password,
      user.elo,
      user.level,
      user.experience,
      user.avatar,
      user.lastActiveAt,
      user.status,
      user.id
    ]);
    
    return user;
  }
}

export default User;