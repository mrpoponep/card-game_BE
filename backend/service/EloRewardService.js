import db from '../model/DatabaseConnection.js';

class EloRewardService {
    /**
     * Lấy mùa đang active hiện tại
     */
    static async getCurrentSeason() {
        try {
            const seasons = await db.query(
                `SELECT season_id, season_name, start_date 
                 FROM reward_seasons 
                 WHERE is_active = TRUE 
                 ORDER BY season_id DESC 
                 LIMIT 1`
            );
            
            if (seasons.length === 0) {
                throw new Error('Không tìm thấy mùa đang hoạt động');
            }
            
            return seasons[0];
        } catch (error) {
            console.error('Error getting current season:', error);
            throw error;
        }
    }

    /**
     * Kiểm tra trạng thái các milestone rewards cho user
     * CHỈ kiểm tra các reward đã được tạo sẵn (bởi trigger khi đạt milestone)
     * @param {number} userId - ID người dùng
     * @returns {Promise<Object>} Thông tin về các milestone và trạng thái claim
     */
    static async checkMilestoneRewards(userId) {
        try {
            // Lấy ELO hiện tại của user
            const userRows = await db.query(
                'SELECT elo FROM User WHERE user_id = ?',
                [userId]
            );

            if (userRows.length === 0) {
                throw new Error('Không tìm thấy người dùng');
            }

            const currentElo = userRows[0].elo;

            // Lấy mùa hiện tại
            const currentSeason = await this.getCurrentSeason();

            // Lấy tất cả milestones và trạng thái (dựa vào claimed_at)
            const milestones = await db.query(
                `SELECT 
                    m.milestone_id,
                    m.elo_required,
                    m.gems_reward,
                    m.description,
                    c.claim_id,
                    c.claimed_at,
                    c.elo_at_claim,
                    CASE 
                        WHEN c.claimed_at IS NOT NULL THEN 'claimed'
                        WHEN c.claim_id IS NOT NULL AND c.claimed_at IS NULL THEN 'claimable'
                        ELSE 'locked'
                    END as status
                FROM elo_milestone_rewards m
                LEFT JOIN elo_milestone_claims c 
                    ON m.milestone_id = c.milestone_id 
                    AND c.user_id = ? 
                    AND c.season_id = ?
                ORDER BY m.elo_required ASC`,
                [userId, currentSeason.season_id]
            );

            // Tính tổng gems có thể nhận (chỉ từ các reward đã tạo nhưng chưa claim)
            const claimableGems = milestones
                .filter(m => m.status === 'claimable')
                .reduce((sum, m) => sum + m.gems_reward, 0);

            const claimedGems = milestones
                .filter(m => m.status === 'claimed')
                .reduce((sum, m) => sum + m.gems_reward, 0);

            return {
                currentElo,
                currentSeason: {
                    id: currentSeason.season_id,
                    name: currentSeason.season_name,
                    startDate: currentSeason.start_date
                },
                milestones,
                summary: {
                    total: milestones.length,
                    claimed: milestones.filter(m => m.status === 'claimed').length,
                    claimable: milestones.filter(m => m.status === 'claimable').length,
                    locked: milestones.filter(m => m.status === 'locked').length,
                    claimableGems,
                    claimedGems
                }
            };
        } catch (error) {
            console.error('Error checking milestone rewards:', error);
            throw error;
        }
    }

    /**
     * Nhận thưởng milestone
     * CHỈ cập nhật claimed_at cho reward đã được tạo sẵn
     * @param {number} userId - ID người dùng
     * @param {number} milestoneId - ID milestone muốn claim
     * @returns {Promise<Object>} Kết quả claim
     */
    static async claimMilestoneReward(userId, milestoneId) {
        const connection = await db.beginTransaction();
        
        try {
            // Lấy mùa hiện tại
            const currentSeason = await this.getCurrentSeason();

            // Kiểm tra có reward pending không (claimed_at IS NULL)
            const pendingReward = await db.transactionQuery(
                connection,
                `SELECT c.*, m.gems_reward, m.description, m.elo_required
                 FROM elo_milestone_claims c
                 JOIN elo_milestone_rewards m ON c.milestone_id = m.milestone_id
                 WHERE c.user_id = ? 
                   AND c.milestone_id = ? 
                   AND c.season_id = ?
                   AND c.claimed_at IS NULL`,
                [userId, milestoneId, currentSeason.season_id]
            );

            if (pendingReward.length === 0) {
                throw new Error('Không có phần thưởng milestone này để nhận hoặc đã nhận rồi');
            }

            const reward = pendingReward[0];

            // Cập nhật gems cho user (COALESCE để xử lý NULL)
            await db.transactionQuery(
                connection,
                'UPDATE User SET gems = COALESCE(gems, 0) + ? WHERE user_id = ?',
                [reward.gems_received, userId]
            );

            // Cập nhật claimed_at = NOW()
            await db.transactionQuery(
                connection,
                `UPDATE elo_milestone_claims 
                 SET claimed_at = UTC_TIMESTAMP()
                 WHERE claim_id = ?`,
                [reward.claim_id]
            );

            // Lấy gems balance mới
            const userRows = await db.transactionQuery(
                connection,
                'SELECT gems FROM User WHERE user_id = ?',
                [userId]
            );

            await db.commit(connection);

            return {
                success: true,
                gemsReceived: reward.gems_received,
                newGemsBalance: userRows[0].gems,
                milestone: {
                    id: reward.milestone_id,
                    eloRequired: reward.elo_required,
                    description: reward.description
                },
                season: {
                    id: currentSeason.season_id,
                    name: currentSeason.season_name
                }
            };
        } catch (error) {
            await db.rollback(connection);
            console.error('Error claiming milestone reward:', error);
            throw error;
        }
    }

    /**
     * Nhận tất cả thưởng milestone có thể claim
     * @param {number} userId - ID người dùng
     * @returns {Promise<Object>} Kết quả claim tất cả
     */
    static async claimAllMilestoneRewards(userId) {
        try {
            // Kiểm tra các milestone có thể claim
            const rewardStatus = await this.checkMilestoneRewards(userId);
            
            const claimableMilestones = rewardStatus.milestones
                .filter(m => m.status === 'claimable');

            if (claimableMilestones.length === 0) {
                return {
                    success: false,
                    message: 'Không có phần thưởng nào để nhận',
                    claimedCount: 0,
                    totalGems: 0
                };
            }

            // Claim từng milestone
            const results = [];
            let totalGems = 0;
            let successCount = 0;

            for (const milestone of claimableMilestones) {
                try {
                    const result = await this.claimMilestoneReward(userId, milestone.milestone_id);
                    results.push({
                        milestoneId: milestone.milestone_id,
                        success: true,
                        gems: result.gemsReceived
                    });
                    totalGems += result.gemsReceived;
                    successCount++;
                } catch (error) {
                    results.push({
                        milestoneId: milestone.milestone_id,
                        success: false,
                        error: error.message
                    });
                }
            }

            // Lấy gems balance mới
            const userRows = await db.query(
                'SELECT gems FROM User WHERE user_id = ?',
                [userId]
            );

            return {
                success: true,
                claimedCount: successCount,
                totalClaimed: claimableMilestones.length,
                totalGems,
                newGemsBalance: userRows[0].gems,
                details: results
            };
        } catch (error) {
            console.error('Error claiming all milestone rewards:', error);
            throw error;
        }
    }

    /**
     * Lấy lịch sử nhận thưởng ELO milestone
     * @param {number} userId - ID người dùng
     * @returns {Promise<Array>} Danh sách lịch sử nhận thưởng
     */
    static async getRewardHistory(userId) {
        try {
            const history = await db.query(
                `SELECT 
                    emc.gems_received,
                    emc.claimed_at,
                    rs.season_name
                FROM elo_milestone_claims emc
                LEFT JOIN reward_seasons rs ON emc.season_id = rs.season_id
                WHERE emc.user_id = ? AND emc.claimed_at IS NOT NULL
                ORDER BY emc.claimed_at DESC
                LIMIT 100`,
                [userId]
            );

            return history;
        } catch (error) {
            console.error('Error getting ELO reward history:', error);
            throw error;
        }
    }
}

export default EloRewardService;
