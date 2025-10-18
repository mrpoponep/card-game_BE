// controllers/RankingController.js
import rankingService from '../service/RankingService.js';

class RankingController {
  static async getAllRankings(req, res) {
    try {
      // Luôn trả top 100, bỏ pagination
      const result = await rankingService.getAllRankings();
      
      // Trả về response tối giản
      res.json({
        success: true,
        data: result.rankings
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getPlayerRanking(req, res) {
    try {
      const { playerId } = req.params;
      const ranking = await rankingService.getPlayerRanking(playerId);
      
      res.json({
        success: true,
        data: ranking
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }
  }
}

export default RankingController;