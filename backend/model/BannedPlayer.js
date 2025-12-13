// Server/models/BannedPlayer.js
import db from './DatabaseConnection.js';

class BannedPlayer {
  constructor({
    report_id = null,
    reported_id = null,
    reason = null,
    chat_history = null,
    created_at = null,
    ai_analysis = null,
    ai_verdict = 'pending'
  } = {}) {
    this.report_id = report_id;
    this.reported_id = reported_id;
    this.reason = reason;
    this.chat_history = chat_history;
    this.created_at = created_at;
    this.ai_analysis = ai_analysis;
    this.ai_verdict = ai_verdict;
  }

  toJSON() {
    return {
      report_id: this.report_id,
      reported_id: this.reported_id,
      reason: this.reason,
      chat_history: this.chat_history,
      created_at: this.created_at,
      ai_analysis: this.ai_analysis,
      ai_verdict: this.ai_verdict
    };
  }

  async save() {
    if (this.report_id) {
      return await BannedPlayer.updateInDatabase(this);
    }
    return await BannedPlayer.insertIntoDatabase(this);
  }

  // -------------------- Static DB methods --------------------
  static async findById(reportId) {
    const rows = await db.query(
      'SELECT * FROM Banned_Player WHERE report_id = ? LIMIT 1',
      [reportId]
    );

    if (rows && rows.length > 0) {
      return new BannedPlayer(rows[0]);
    }
    return null;
  }

  static async findByReportedId(reportedId, limit = 50) {
    const rows = await db.query(
      'SELECT * FROM Banned_Player WHERE reported_id = ? ORDER BY created_at DESC LIMIT ?',
      [reportedId, limit]
    );
    return rows.map(r => new BannedPlayer(r));
  }

  static async listAll(limit = 100, offset = 0) {
    const rows = await db.query(
      'SELECT * FROM Banned_Player ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return rows.map(r => new BannedPlayer(r));
  }

  static async insertIntoDatabase(bp) {
    const query = `
      INSERT INTO Banned_Player (reported_id, reason, chat_history, ai_analysis, ai_verdict)
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = await db.query(query, [
      bp.reported_id,
      bp.reason,
      bp.chat_history,
      bp.ai_analysis,
      bp.ai_verdict || 'pending'
    ]);

    // nếu DatabaseConnection đang trả về [result], thì chỉnh lại cho khớp
    bp.report_id = result.insertId || bp.report_id;
    return bp;
  }

  static async updateInDatabase(bp) {
    const query = `
      UPDATE Banned_Player
      SET reported_id = ?, reason = ?, chat_history = ?, ai_analysis = ?, ai_verdict = ?
      WHERE report_id = ?
    `;
    await db.query(query, [
      bp.reported_id,
      bp.reason,
      bp.chat_history,
      bp.ai_analysis,
      bp.ai_verdict,
      bp.report_id
    ]);
    return bp;
  }

  static async removeById(reportId) {
    const result = await db.query(
      'DELETE FROM Banned_Player WHERE report_id = ?',
      [reportId]
    );
    return result.affectedRows || 0;
  }
}

export default BannedPlayer;
