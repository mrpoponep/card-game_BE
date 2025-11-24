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

    static async findByUserId(userId, limit = 20) {
        const dbRows = await db.query(
            "SELECT * FROM Transactions WHERE user_id = ? AND source = 'vnpay' ORDER BY time DESC LIMIT ?",
            [userId, limit]
        );
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
    }

    static async updateInDatabase(transaction) {
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
}

export default Transaction;
