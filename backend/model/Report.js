// models/Report.js
import db from './DatabaseConnection.js';

/**
 * Report Model - Định nghĩa cấu trúc và validation cho Report
 */
class Report {
  constructor({
    report_id = null,
    reported_id = null,
    type = null,
    reason = null,
    created_at = null,
  }) {
    this.report_id = report_id;
    this.reported_id = reported_id;
    this.type = type;
    this.reason = reason;
    this.created_at = created_at;

    // Validate dữ liệu khi tạo instance
    if (!report_id) {
      this.validate();
    }
  }

  // 🔍 VALIDATION METHODS
  validate() {
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
      reported_id: this.reported_id,
      type: this.type,
      reason: this.reason,
      created_at: this.created_at,
    };
  }

  // 💾 DATABASE OPERATIONS
  /**
   * Lưu report mới vào database
   */
  async save() {
    try {
      // Insert new report
      const result = await db.query(
        'INSERT INTO Report (reported_id, type, reason) VALUES (?, ?, ?)',
        [this.reported_id, this.type, this.reason]
      );
      this.report_id = result.insertId;
      return this;
    } catch (error) {
      throw new Error(`Failed to save report: ${error.message}`);
    }
  }
}

export default Report;
