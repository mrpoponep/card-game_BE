// services/RankingService.js

// 🔒 PRIVATE HELPER FUNCTIONS (không export ra ngoài)
const calculateWinRate = (player) => {
  if (player.gamesPlayed === 0) return 0;
  return (player.wins / player.gamesPlayed * 100).toFixed(1);
};

const calculateNewScore = (player, gameScore, gameResult) => {
  let newTotalScore = player.totalScore + gameScore;
  
  // Bonus cho thắng
  if (gameResult === 'win') {
    newTotalScore += 100; // Bonus points
  }
  
  return newTotalScore;
};

// 🔒 PRIVATE DATABASE FUNCTIONS
const findPlayerById = async (playerId) => {
  // Database query logic
};

const getAllPlayers = async () => {
  // Database query logic
};

const updatePlayerScore = async (playerId, newScore) => {
  // Database update logic
};

// 🌐 PUBLIC SERVICE CLASS (chỉ export những gì cần thiết)
class RankingService {
  static async getAllRankings(page = 0, limit = 0) {
    // Logic pagination
    const allPlayers = await getAllPlayers();
    const totalItems = allPlayers.length > 100 ? 100 : allPlayers.length;
    
    let rankings = allPlayers
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((player, index) => ({
        rank: index + 1,
        playerId: player.id,
        playerName: player.name,
        totalScore: player.totalScore,
        gamesPlayed: player.gamesPlayed,
        winRate: calculateWinRate(player) // ✅ Gọi private function
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
    const player = await findPlayerById(playerId); // ✅ Gọi private function
    if (!player) {
      throw new Error('Player not found');
    }

    const allRankings = await this.getAllRankings();
    return allRankings.rankings.find(ranking => ranking.playerId === playerId);
  }

  static async updatePlayerRanking(playerId, gameScore, gameResult) {
    const player = await findPlayerById(playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const newScore = calculateNewScore(player, gameScore, gameResult); // ✅ Gọi private function
    await updatePlayerScore(playerId, newScore);
    
    return await this.getPlayerRanking(playerId);
  }
}

export default RankingService;