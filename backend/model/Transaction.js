// models/Transaction.js
// Sử dụng bảng Transactions có sẵn trong database
// Mapping: txn_ref → reason, order_info → reason, status → source
import db from './DatabaseConnection.js';

class Transaction {
    constructor({
        tx_id = null,           // Primary key của bảng Transactions
        user_id = null,
        source_id = null,       // Room/game source (nullable)
        amount = 0,
        reason = null,          // Lưu txn_ref và order_info
        source = 'vnpay',       // 'vnpay' cho payment
        time = new Date()
    }) {
        this.tx_id = tx_id;
        this.user_id = user_id;
        this.source_id = source_id;
        this.amount = Number(amount) || 0;
        this.reason = reason;   // Format: "txnRef:1_123456|orderInfo:Nap 100k|status:SUCCESS"
        this.source = source;
        this.time = time;
    }

    toJSON() {
        // Parse reason field để lấy thông tin VNPay
        const parsed = this.parseReason();
        return {
            tx_id: this.tx_id,
            user_id: this.user_id,
            source_id: this.source_id,
            amount: this.amount,
            source: this.source,
            time: this.time,
            // VNPay fields từ reason
            txn_ref: parsed.txnRef,
            order_info: parsed.orderInfo,
            status: parsed.status,
            response_code: parsed.responseCode,
            transaction_no: parsed.transactionNo
        };
    }

    // Parse reason field để extract VNPay data
    parseReason() {
        if (!this.reason) return {};

        const parts = this.reason.split('|');
        const result = {};

        parts.forEach(part => {
            const [key, value] = part.split(':');
            if (key && value) {
                result[key] = value;
            }
        });

        return result;
    }

    // Build reason string từ VNPay data
    static buildReason({ txnRef, orderInfo, status, responseCode, transactionNo }) {
        const parts = [];
        if (txnRef) parts.push(`txnRef:${txnRef}`);
        if (orderInfo) parts.push(`orderInfo:${orderInfo}`);
        if (status) parts.push(`status:${status}`);
        if (responseCode) parts.push(`responseCode:${responseCode}`);
        if (transactionNo) parts.push(`transactionNo:${transactionNo}`);
        return parts.join('|');
    }

    async save() {
        if (this.tx_id) {
            return await Transaction.updateInDatabase(this);
        } else {
            return await Transaction.insertIntoDatabase(this);
        }
    }

    // 🗄️ STATIC DATABASE METHODS
    static async findByTxnRef(txnRef) {
        // Tìm trong reason field với pattern "txnRef:xxx"
        const dbRows = await db.query(
            "SELECT * FROM Transactions WHERE source = 'vnpay' AND reason LIKE ? LIMIT 1",
            [`txnRef:${txnRef}%`]
        );
        if (dbRows && dbRows.length > 0) {
            return new Transaction(dbRows[0]);
        }
        return null;
    }

    static async findByUserId(userId, limit = 20, statusFilter = null) {
        // 🔥 LIMIT không thể dùng placeholder trong MySQL prepared statement
        // Validate limit để tránh SQL injection
        const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));

        // 🔥 Filter theo status nếu được chỉ định (chỉ lấy SUCCESS)
        let query = `SELECT * FROM Transactions WHERE user_id = ? AND source = 'vnpay'`;

        if (statusFilter === 'SUCCESS') {
            query += ` AND reason LIKE '%status:SUCCESS%'`;
        }

        query += ` ORDER BY time DESC LIMIT ${safeLimit}`;

        const dbRows = await db.query(query, [userId]);
        return dbRows.map(row => new Transaction(row));
    }

    static async insertIntoDatabase(transaction) {
        const query = `
            INSERT INTO Transactions (user_id, source_id, amount, reason, source, time)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const result = await db.query(query, [
            transaction.user_id,
            transaction.source_id,
            transaction.amount,
            transaction.reason,
            transaction.source,
            transaction.time
        ]);
        transaction.tx_id = result.insertId;
        return transaction;
    } static async updateInDatabase(transaction) {
        const query = `
            UPDATE Transactions
            SET reason = ?, amount = ?
            WHERE tx_id = ?
        `;
        await db.query(query, [
            transaction.reason,
            transaction.amount,
            transaction.tx_id
        ]);
        return transaction;
    }
    /**
   * Lấy các thống kê Coin (volume, count, avg) trong khoảng thời gian
   * @param {string} startDate - Định dạng 'YYYY-MM-DD HH:MM:SS'
   * @param {string} endDate - Định dạng 'YYYY-MM-DD HH:MM:SS'
   * @returns {Promise<object>} Object chứa totalVolume, transactionCount, averageTransaction
   */
  static async getCoinStats(startDate, endDate) {
    const sql = `
      SELECT 
        SUM(ABS(amount)) AS totalVolume,  -- Tính tổng giá trị tuyệt đối (cả nạp/rút/thắng/thua)
        COUNT(tx_id) AS transactionCount,
        AVG(ABS(amount)) AS averageTransaction 
      FROM Transactions 
      WHERE time BETWEEN ? AND ? 
    `;
    try {
      // Thêm giờ phút giây để bao gồm cả ngày cuối cùng
      const startDateTime = `${startDate} 00:00:00`;
      const endDateTime = `${endDate} 23:59:59`;
      
      const rows = await db.query(sql, [startDateTime, endDateTime]);
      
      // Kết quả trả về từ DB có thể là null nếu không có giao dịch nào
      const stats = rows[0];
      return {
          totalVolume: parseFloat(stats.totalVolume) || 0, // Chuyển sang số, mặc định 0
          transactionCount: parseInt(stats.transactionCount) || 0, // Chuyển sang số, mặc định 0
          averageTransaction: parseFloat(stats.averageTransaction) || 0 // Chuyển sang số, mặc định 0
      };
    } catch (error) {
      console.error('❌ Lỗi khi lấy thống kê coin:', error);
      throw error;
    }
  }

/**
   * Đếm số người chơi duy nhất có giao dịch trong khoảng thời gian
   * @param {string} startDate - 'YYYY-MM-DD HH:MM:SS'
   * @param {string} endDate - 'YYYY-MM-DD HH:MM:SS'
   * @returns {Promise<number>} Số lượng người chơi duy nhất
   */
  static async getActivePlayersByTx(startDate, endDate) {
    // Đếm distinct user_id và source_id (loại bỏ NULL)
    const sql = `
      SELECT COUNT(DISTINCT player_id) AS activeCount
      FROM (
          SELECT user_id AS player_id FROM Transactions WHERE time BETWEEN ? AND ? AND user_id IS NOT NULL
          UNION
          SELECT source_id AS player_id FROM Transactions WHERE time BETWEEN ? AND ? AND source_id IS NOT NULL
      ) AS distinct_players;
    `;
    try {
      const startDateTime = `${startDate} 00:00:00`;
      const endDateTime = `${endDate} 23:59:59`;
      // Cần truyền ngày tháng 2 lần vì UNION
      const rows = await db.query(sql, [startDateTime, endDateTime, startDateTime, endDateTime]);
      return parseInt(rows[0].activeCount) || 0;
    } catch (error) {
      console.error('❌ Lỗi khi đếm người chơi hoạt động (GD):', error);
      throw error;
    }
  }
 // ➕ THÊM vào cuối class Transaction (giữ nguyên các hàm cũ)
  /**
   * Timeseries: coin theo ngày trong khoảng [startDate..endDate]
   * @returns [{date, totalVolume, transactionCount, averageTransaction}]
   */
  static async getCoinSeries(startDate, endDate) {
    const sql = `
      SELECT DATE(time) AS date,
             SUM(ABS(amount)) AS totalVolume,
             COUNT(*) AS transactionCount,
             AVG(ABS(amount)) AS averageTransaction
      FROM Transactions
      WHERE time BETWEEN CONCAT(?, ' 00:00:00') AND CONCAT(?, ' 23:59:59')
      GROUP BY DATE(time)
      ORDER BY DATE(time)
    `;
    const rows = await db.query(sql, [startDate, endDate]);
    return rows.map(r => ({
      date: r.date,
      totalVolume: Number(r.totalVolume || 0),
      transactionCount: Number(r.transactionCount || 0),
      averageTransaction: Number(r.averageTransaction || 0),
    }));
  }

  /**
   * Timeseries: người chơi active (có giao dịch) theo ngày
   * @returns [{date, activeByTx}]
   */
  static async getActivePlayersSeries(startDate, endDate) {
    const sql = `
      SELECT date, COUNT(DISTINCT player_id) AS activeByTx
      FROM (
        SELECT DATE(time) AS date, user_id AS player_id
        FROM Transactions
        WHERE time BETWEEN CONCAT(?, ' 00:00:00') AND CONCAT(?, ' 23:59:59') AND user_id IS NOT NULL
        UNION ALL
        SELECT DATE(time) AS date, source_id AS player_id
        FROM Transactions
        WHERE time BETWEEN CONCAT(?, ' 00:00:00') AND CONCAT(?, ' 23:59:59') AND source_id IS NOT NULL
      ) t
      GROUP BY date
      ORDER BY date
    `;
    const rows = await db.query(sql, [startDate, endDate, startDate, endDate]);
    return rows.map(r => ({
      date: r.date,
      activeByTx: Number(r.activeByTx || 0),
    }));
  }

    // 🔥 UPDATE status của PENDING transaction (BYPASS trigger bằng cách dùng raw SQL)
    static async updateStatusBypassTrigger(txnRef, { status, responseCode, transactionNo, newAmount }) {
        // Tìm transaction PENDING
        const pendingTx = await Transaction.findByTxnRef(txnRef);
        if (!pendingTx) {
            throw new Error(`Transaction not found: ${txnRef}`);
        }

        const parsed = pendingTx.parseReason();

        // Build reason mới với status updated
        const updatedReason = Transaction.buildReason({
            txnRef: parsed.txnRef || txnRef,
            orderInfo: parsed.orderInfo,
            status: status,
            responseCode: responseCode,
            transactionNo: transactionNo
        });

        // 💡 DISABLE trigger tạm thời bằng cách dùng session variable
        await db.query('SET @TRIGGER_DISABLED = 1');

        try {
            // UPDATE transaction
            const query = `
                UPDATE Transactions
                SET reason = ?, amount = ?
                WHERE tx_id = ?
            `;

            await db.query(query, [
                updatedReason,
                newAmount || pendingTx.amount,
                pendingTx.tx_id
            ]);

            pendingTx.reason = updatedReason;
            pendingTx.amount = newAmount || pendingTx.amount;
            return pendingTx;
        } finally {
            // Re-enable trigger
            await db.query('SET @TRIGGER_DISABLED = NULL');
        }
    }
}

export default Transaction;

