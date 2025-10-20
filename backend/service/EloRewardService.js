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

            // Lấy tất cả milestones và trạng thái đã claim
            const milestones = await db.query(
                `SELECT 
                    m.milestone_id,
                    m.elo_required,
                    m.gems_reward,
                    m.description,
                    CASE 
                        WHEN c.claim_id IS NOT NULL THEN 'claimed'
                        WHEN ? >= m.elo_required THEN 'claimable'
                        ELSE 'locked'
                    END as status,
                    c.claimed_at,
                    c.elo_at_claim
                FROM elo_milestone_rewards m
                LEFT JOIN elo_milestone_claims c 
                    ON m.milestone_id = c.milestone_id 
                    AND c.user_id = ? 
                    AND c.season_id = ?
                ORDER BY m.elo_required ASC`,
                [currentElo, userId, currentSeason.season_id]
            );

            // Tính tổng gems có thể nhận
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
     * @param {number} userId - ID người dùng
     * @param {number} milestoneId - ID milestone muốn claim
     * @returns {Promise<Object>} Kết quả claim
     */
    static async claimMilestoneReward(userId, milestoneId) {
        const connection = await db.pool.getConnection();
        
        try {
            await connection.beginTransaction();

            // Lấy mùa hiện tại
            const currentSeason = await this.getCurrentSeason();

            // Kiểm tra milestone có tồn tại không
            const [milestoneRows] = await connection.query(
                'SELECT * FROM elo_milestone_rewards WHERE milestone_id = ?',
                [milestoneId]
            );

            if (milestoneRows.length === 0) {
                throw new Error('Milestone không tồn tại');
            }

            const milestone = milestoneRows[0];

            // Lấy thông tin user
            const [userRows] = await connection.query(
                'SELECT elo, gems FROM User WHERE user_id = ?',
                [userId]
            );

            if (userRows.length === 0) {
                throw new Error('Không tìm thấy người dùng');
            }

            const user = userRows[0];

            // Kiểm tra ELO có đủ không
            if (user.elo < milestone.elo_required) {
                throw new Error(`Bạn cần đạt ${milestone.elo_required} ELO để nhận thưởng này`);
            }

            // Kiểm tra đã claim chưa trong mùa này
            const [claimRows] = await connection.query(
                `SELECT claim_id FROM elo_milestone_claims 
                 WHERE user_id = ? AND milestone_id = ? AND season_id = ?`,
                [userId, milestoneId, currentSeason.season_id]
            );

            if (claimRows.length > 0) {
                throw new Error('Bạn đã nhận thưởng milestone này trong mùa hiện tại rồi');
            }

            // Thêm gems cho user
            await connection.query(
                'UPDATE User SET gems = gems + ? WHERE user_id = ?',
                [milestone.gems_reward, userId]
            );

            // Lưu lịch sử claim
            await connection.query(
                `INSERT INTO elo_milestone_claims 
                 (user_id, milestone_id, season_id, gems_received, elo_at_claim) 
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, milestoneId, currentSeason.season_id, milestone.gems_reward, user.elo]
            );

            await connection.commit();

            return {
                success: true,
                gemsReceived: milestone.gems_reward,
                newGemsBalance: user.gems + milestone.gems_reward,
                milestone: {
                    id: milestone.milestone_id,
                    eloRequired: milestone.elo_required,
                    description: milestone.description
                },
                season: {
                    id: currentSeason.season_id,
                    name: currentSeason.season_name
                }
            };
        } catch (error) {
            await connection.rollback();
            console.error('Error claiming milestone reward:', error);
            throw error;
        } finally {
            connection.release();
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
}

export default EloRewardService;
