import ReferralLink from '../model/ReferralLink.js';
import ReferralClick from '../model/ReferralClick.js';
import ReferralActivation from '../model/ReferralActivation.js';
import Transaction from '../model/Transaction.js';
import User from '../model/User.js';
import crypto from 'crypto';

class ReferralService {
    static async generateUniqueCode(userId) {
        let code;
        let attempts = 0;

        do {
            const random = crypto.randomBytes(4).toString('hex').toUpperCase();
            code = `POKER${userId}_${random}`.substring(0, 20);
            attempts++;
        } while (await ReferralLink.codeExists(code) && attempts < 10);

        if (attempts >= 10) {
            throw new Error('Could not generate unique referral code');
        }

        return code;
    }

    static async createLink({ userId, campaignName = 'Default', platform = 'web' }) {
        const code = await this.generateUniqueCode(userId);

        const linkId = await ReferralLink.create({
            userId,
            code,
            campaignName,
            platform
        });

        return {
            success: true,
            link: {
                id: linkId,
                code,
                fullUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?ref=${code}`,
                campaignName,
                platform
            }
        };
    }

    static async trackClick({ refCode, ipAddress, userAgent, deviceId }) {
        const link = await ReferralLink.findByCode(refCode);
        if (!link) return { success: false, message: 'Invalid referral code' };

        await ReferralClick.create({
            refCode,
            ipAddress,
            userAgent,
            deviceId
        });

        await ReferralLink.incrementClicks(link.id);

        return { success: true };
    }

    /**
     * Activate referral when a new user registers with a refCode
     * This is the ONLY place that should reward the referrer for a successful registration
     */
    static async activateReferral({ refCode, refereeId }) {
        // Find the referral link
        const link = await ReferralLink.findByCode(refCode);
        if (!link) return;
        // Prevent self-referral
        if (link.user_id === refereeId) return;
        // Optional: Check if this user has already been referred (anti-cheat)
        const alreadyReferred = await ReferralActivation.hasBeenReferred(refereeId);
        if (alreadyReferred) return;
        const reward = 10000; // ví dụ 10k chips
        const db = (await import('../model/DatabaseConnection.js')).default;
        const conn = await db.pool.getConnection();
        try {
            await conn.beginTransaction();
            // Ghi activation
            await conn.query(
                `INSERT INTO Referral_Activations (referrer_id, referee_id, ref_code, device_id, ip_address, reward_amount, status) VALUES (?, ?, ?, ?, ?, ?, 'completed')`,
                [link.user_id, refereeId, refCode, '', '', reward]
            );
            // Cộng tiền cho referrer
            await conn.query(
                `UPDATE User SET balance = balance + ? WHERE user_id = ?`,
                [reward, link.user_id]
            );
            // Tăng total_activations
            await conn.query(
                `UPDATE Referral_Links SET total_activations = total_activations + 1 WHERE id = ?`,
                [link.id]
            );
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    static async getUserStats(userId) {
        const stats = await ReferralLink.getUserStats(userId);
        const totalRewards = await ReferralActivation.getTotalRewards(userId);
        const recentActivations = await ReferralActivation.getByReferrerId(userId, 10);

        return {
            success: true,
            stats: {
                totalClicks: stats.totalClicks || 0,
                totalActivations: stats.totalActivations || 0,
                totalLinks: stats.totalLinks || 0,
                totalRewards: totalRewards || 0
            },
            recentActivations
        };
    }

    static async handleRegisterReferral({ refCode, newUserId }) {
        const conn = await (await import('../model/DatabaseConnection.js')).default.pool.getConnection();
        try {
            await conn.beginTransaction();

            // Tìm link referral
            const [links] = await conn.query(
                `SELECT user_id FROM Referral_Links WHERE ref_code = ? AND is_active = 1 LIMIT 1`,
                [refCode]
            );
            if (!links || links.length === 0) {
                await conn.rollback();
                return;
            }
            const referrerId = links[0].user_id;
            if (referrerId === newUserId) {
                await conn.rollback();
                return;
            }
            // Ghi activation
            await conn.query(
                `INSERT INTO Referral_Activations (ref_code, referrer_id, referee_id, reward_amount, status) VALUES (?, ?, ?, ?, 'completed')`,
                [refCode, referrerId, newUserId, 1000]
            );
            // Cộng tiền cho người mời
            await conn.query(
                `UPDATE User SET balance = balance + 1000 WHERE user_id = ?`,
                [referrerId]
            );
            // Update thống kê link
            await conn.query(
                `UPDATE Referral_Links SET total_activations = total_activations + 1 WHERE ref_code = ?`,
                [refCode]
            );
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }
}

export default ReferralService;
