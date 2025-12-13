// model/Report.js
import db from './DatabaseConnection.js';

class Report {
  constructor({
    report_id = null,
    reporter_id = null,
    reported_id = null,
    type = null,
    reason = null,
    chat_history = null,
    created_at = null,
    ai_analysis = null,
    ai_verdict = 'pending'
  }) {
    this.report_id = report_id;
    this.reporter_id = reporter_id;
    this.reported_id = reported_id;
    this.type = type;
    this.reason = reason;
    this.chat_history = chat_history;
    this.created_at = created_at;
    this.ai_analysis = ai_analysis;
    this.ai_verdict = ai_verdict;
    // Validate dữ liệu khi tạo instance
    if (!report_id) {
      this.validate();
    }
  }

  // 🔍 VALIDATION METHODS
  validate() {
    if (!this.reporter_id) {
      throw new Error('Reporter user ID is required');
    }

    if (!this.reported_id) {
      throw new Error('Reported user ID is required');
    }

    if (!this.type || this.type.trim().length === 0) {
      throw new Error('Report type is required');
    }

    if (!this.reason || this.reason.trim().length === 0) {
      throw new Error('Report reason is required');
    }
  }

  // 🔄 SERIALIZATION
  toJSON() {
      return {
          report_id: this.report_id,
          reporter_id: this.reporter_id,
          reported_id: this.reported_id,
          type: this.type,
          reason: this.reason,
          chat_history: this.chat_history,
          created_at: this.created_at,
          ai_analysis: this.ai_analysis,
          ai_verdict: this.ai_verdict
      };
  }

  // 💾 DATABASE OPERATIONS
  /**
   * Lưu report mới vào database
   */
  async save() {
    try {
      const result = await db.query(
        `INSERT INTO Report 
        (reporter_id, reported_id, type, reason, chat_history, ai_analysis, ai_verdict) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            this.reporter_id, 
            this.reported_id, 
            this.type, 
            this.reason, 
            this.chat_history,
            this.ai_analysis, 
            this.ai_verdict
        ]
      );
      this.report_id = result.insertId;
      return this;
    } catch (error) {
      throw new Error(`Failed to save report: ${error.message}`);
    }
  }
  static async listAll(limit = 100, offset = 0) {
    const sql = `
      SELECT r.*, 
             u1.username as reporter_name, 
             u2.username as reported_name,
             u2.violation_count as current_violation_count
      FROM Report r
      LEFT JOIN User u1 ON r.reporter_id = u1.user_id
      LEFT JOIN User u2 ON r.reported_id = u2.user_id
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await db.query(sql, [limit, offset]);
    return rows;
  }
}
export default Report;