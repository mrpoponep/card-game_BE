import db from './DatabaseConnection.js';

class ReferralClick {
    /**
     * Record a new click
     */
    static async create({ linkId, refCode, ipAddress, userAgent, deviceId }) {
        const query = `
            INSERT INTO Referral_Clicks (ref_code, ip_address, user_agent, device_id)
            VALUES (?, ?, ?, ?)
        `;
        const result = await db.query(query, [refCode, ipAddress, userAgent, deviceId]);
        return result.insertId;
    }

    /**
     * Check if device/IP already clicked (fraud prevention)
     */
    static async hasClicked({ refCode, ipAddress, deviceId }) {
        const query = `
            SELECT id FROM Referral_Clicks 
            WHERE ref_code = ? 
            AND (ip_address = ? OR device_id = ?)
            AND clicked_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `;
        const [rows] = await db.query(query, [refCode, ipAddress, deviceId]);
        return rows.length > 0;
    }

    /**
     * Get click history for a ref code
     */
    static async getByRefCode(refCode, limit = 50) {
        const query = `
            SELECT * FROM Referral_Clicks 
            WHERE ref_code = ?
            ORDER BY clicked_at DESC
            LIMIT ?
        `;
        const [rows] = await db.query(query, [refCode, limit]);
        return rows;
    }
}

export default ReferralClick;
