import db from './DatabaseConnection.js';

class ReferralActivation {
    /**
     * Create new activation (when referred user registers)
     */
    static async create({
        referrerId,
        referredUserId,
        refCode,
        deviceId = '',
        ipAddress = '',
        rewardAmount = 50000
    }) {
        const query = `
            INSERT INTO Referral_Activations 
            (referrer_id, referee_id, ref_code, device_id, ip_address, reward_amount, status)
            VALUES (?, ?, ?, ?, ?, ?, 'completed')
        `;
        const [result] = await db.query(query, [
            referrerId,
            referredUserId,
            refCode,
            deviceId,
            ipAddress,
            rewardAmount
        ]);
        return result.insertId;
    }

    /**
     * Find activation by referred user (check if already activated)
     */
    static async findByReferredUserId(userId) {
        const query = `
            SELECT * 
            FROM Referral_Activations 
            WHERE referee_id = ?
        `;
        const [rows] = await db.query(query, [userId]);
        return rows[0] || null;
    }

    /**
     * Get all activations for a referrer
     */
    static async getByReferrerId(referrerId, limit = 10) {
        let safeLimit = parseInt(limit, 10);
        if (isNaN(safeLimit) || safeLimit <= 0) safeLimit = 10;

        const query = `
            SELECT 
                ra.*,
                u.username AS referred_username,
                u.avatar_url AS referred_avatar
            FROM Referral_Activations ra
            JOIN User u ON ra.referee_id = u.user_id
            WHERE ra.referrer_id = ?
            ORDER BY ra.activated_at DESC
            LIMIT ${safeLimit}
        `;
        const [rows] = await db.query(query, [referrerId]);
        return rows;
    }

    /**
     * Get total rewards earned by referrer
     */
    static async getTotalRewards(referrerId) {
        const query = `
            SELECT COALESCE(SUM(reward_amount), 0) AS totalRewards
            FROM Referral_Activations
            WHERE referrer_id = ? AND status = 'completed'
        `;
        const [rows] = await db.query(query, [referrerId]);
        return rows[0]?.totalRewards || 0;
    }

    /**
     * Check if user has already been referred
     */
    static async hasBeenReferred(userId) {
        const query = `
            SELECT id FROM Referral_Activations 
            WHERE referee_id = ?
        `;
        const rows = await db.query(query, [userId]);
        return rows.length > 0;
    }
}

export default ReferralActivation;
