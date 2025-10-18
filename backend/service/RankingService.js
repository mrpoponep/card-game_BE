// services/RankingService.js
import User from '../model/User.js';

// 🌐 PUBLIC SERVICE CLASS (chỉ export những gì cần thiết)
class RankingService {
  static async getAllRankings() {
    // Always return top 100 without pagination
    const listRankings = await User.listRankings(100);
    const rankings = listRankings.map((player, index) => ({
      rank: index + 1,
      userId: player.user_id,
      username: player.username,
      elo: player.elo,
    }));
    return {
      rankings,
      totalItems: rankings.length
    };
  }

  static async getPlayerRanking(playerId) {
    const user = await User.findById(parseInt(playerId));
    if (!user) {
      throw new Error('Player not found');
    }
    if (user.banned) {
      return {
        rank: 'Người chơi bị cấm',
        userId: user.user_id,
        username: user.username,
        elo: user.elo,
      };
    }
    return {
      rank: await user.getRank(),
      userId: user.user_id,
      username: user.username,
      elo: user.elo,
    };
  }
}

export default RankingService;