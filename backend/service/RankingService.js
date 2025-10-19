// service/RankingService.js
import User from '../model/User.js';

// 🌐 PUBLIC SERVICE CLASS (chỉ export những gì cần thiết)
class RankingService {
  static async getAllRankings() {
    // Always return top 100 without pagination
    const listRankings = await User.listRankings(100);
    
    // Olympic ranking: cùng ELO thì cùng rank
    let currentRank = 1;
    let previousElo = null;
    
    const rankings = listRankings.map((player, index) => {
      // Nếu ELO khác với người trước đó, cập nhật rank
      if (previousElo !== null && player.elo < previousElo) {
        currentRank = index + 1;
      }
      previousElo = player.elo;
      
      return {
        rank: currentRank,
        userId: player.user_id,
        username: player.username,
        elo: player.elo,
      };
    });
    
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