// services/RankingService.js
import User from '../model/User.js';

// 🌐 PUBLIC SERVICE CLASS (chỉ export những gì cần thiết)
class RankingService {
  static async getAllRankings(page = 0, limit = 0) {
    // Logic pagination
    const listRankings = await User.listRankings();
    const totalItems = listRankings.length > 100 ? 100 : listRankings.length;

    let rankings = listRankings.map((player, index) => ({
        rank: index + 1,
        userId: player.user_id,
        username: player.username,
        elo: player.elo,
      }));
    
    // Apply pagination if limit > 0
    if (limit > 0) {
      const startIndex = page * limit;
      const endIndex = startIndex + limit > totalItems ? totalItems : startIndex + limit;
      rankings = rankings.slice(startIndex, endIndex);
    }
    else {
      rankings = rankings.slice(0, totalItems);
    }
    
    return {
      rankings,
      totalItems
    };
  }

  static async getPlayerRanking(playerId) {
    const player = await User.findById(parseInt(playerId));
    if (!player) {
      throw new Error('Player not found');
    }
    if (player.banned) {
      return {
        rank: 'Người chơi bị cấm',
        userId: player.user_id,
        username: player.username,
        elo: player.elo,
      };
    }
    return {
      rank: await player.getRank(),
      userId: player.user_id,
      username: player.username,
      elo: player.elo,
    };
  }
}

export default RankingService;