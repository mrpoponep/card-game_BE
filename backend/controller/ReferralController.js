import ReferralService from '../service/ReferralService.js';

class ReferralController {
    static async createLink(req, res) {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { campaignName, platform } = req.body;

        const result = await ReferralService.createLink({
            userId,
            campaignName,
            platform
        });

        return res.status(result.success ? 200 : 400).json(result);
    }

    static async trackClick(req, res) {
        const { refCode } = req.body;
        if (!refCode) {
            return res.status(400).json({ success: false, message: 'Referral code required' });
        }

        const result = await ReferralService.trackClick({
            refCode,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            deviceId: req.get('x-device-id') || ''
        });

        return res.status(result.success ? 200 : 400).json(result);
    }

    static async activateReferral(req, res) {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { refCode } = req.body;
        if (!refCode) {
            return res.status(400).json({ success: false, message: 'Referral code required' });
        }

        const result = await ReferralService.activateReferral({
            refCode,
            newUserId: userId,
            ipAddress: req.ip
        });

        return res.status(result.success ? 200 : 400).json(result);
    }

    static async getStats(req, res) {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const result = await ReferralService.getUserStats(userId);
        return res.status(200).json(result);
    }
    /**
 * Validate referral link (PUBLIC)
 * GET /api/referral/validate-link/:code
 */
    static async validateLink(req, res) {
        try {
            const { code } = req.params;

            if (!code) {
                return res.status(400).json({
                    valid: false,
                    message: 'Referral code is required'
                });
            }

            // Ở đây có thể check DB nếu muốn
            return res.status(200).json({
                valid: true,
                code
            });
        } catch (error) {
            console.error('Error in validateLink:', error);
            return res.status(500).json({
                valid: false,
                message: 'Internal server error'
            });
        }
    }

}

export default ReferralController;
