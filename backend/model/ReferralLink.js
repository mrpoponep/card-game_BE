import db from './DatabaseConnection.js';

class ReferralLink {

    /**
     * Create referral link
     */
    static async create({ userId, code }) {
        const query = `
            INSERT INTO Referral_Links (user_id, ref_code, is_active)
            VALUES (?, ?, 1)
        `;

        const result = await db.query(query, [userId, code]);
        return result.insertId;
    }

    /**
     * Find referral link by referral code
     */
    static async findByCode(code) {
        if (!code) return null;

        const query = `
            SELECT *
            FROM Referral_Links
            WHERE ref_code = ?
              AND is_active = 1
              AND (expires_at IS NULL OR expires_at > NOW())
            LIMIT 1
        `;

        const rows = await db.query(query, [code]);
        return rows.length ? rows[0] : null;
    }

    /**
     * Find all referral links of a user
     */
    static async findByUserId(userId) {
        const query = `
            SELECT *
            FROM Referral_Links
            WHERE user_id = ?
            ORDER BY created_at DESC
        `;

        return await db.query(query, [userId]);
    }

    /**
     * Increment click count
     */
    static async incrementClicks(id) {
        const query = `
            UPDATE Referral_Links
            SET total_clicks = total_clicks + 1
            WHERE id = ?
        `;

        return await db.query(query, [id]);
    }

    /**
     * Increment activation count
     */
    static async incrementActivations(id) {
        const query = `
            UPDATE Referral_Links
            SET total_activations = total_activations + 1
            WHERE id = ?
        `;

        return await db.query(query, [id]);
    }

    /**
     * Get aggregated statistics for a user
     */
    static async getUserStats(userId) {
        const query = `
            SELECT
                COALESCE(SUM(total_clicks), 0) AS totalClicks,
                COALESCE(SUM(total_activations), 0) AS totalActivations,
                COUNT(*) AS totalLinks
            FROM Referral_Links
            WHERE user_id = ?
        `;

        const rows = await db.query(query, [userId]);
        return rows[0] || {
            totalClicks: 0,
            totalActivations: 0,
            totalLinks: 0
        };
    }

    /**
     * Check if referral code already exists
     */
    static async codeExists(code) {
        const query = `
            SELECT 1
            FROM Referral_Links
            WHERE ref_code = ?
            LIMIT 1
        `;

        const rows = await db.query(query, [code]);
        return rows.length > 0;
    }
}

export default ReferralLink;
