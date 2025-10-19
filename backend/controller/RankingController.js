// controllers/RankingController.js
import rankingService from '../service/RankingService.js';

class RankingController {
  static async getAllRankings(req, res) {
    try {
      // Lấy pagination parameters từ form data hoặc query params
      const page = parseInt(req.body.page || req.query.page || 0);
      const limit = parseInt(req.body.limit || req.query.limit || 0);
      
      // Validation cơ bản
      if (page < 0) {
        return res.status(400).json({
          success: false,
          message: 'Page must be 0 or greater'
        });
      }
      
      if (limit < 0) {
        return res.status(400).json({
          success: false,
          message: 'Limit must be 0 or greater'
        });
      }
      
      // Gọi service để xử lý với pagination
      const result = await rankingService.getAllRankings(page, limit);
      
      // Trả về response với pagination info
      res.json({
        success: true,
        data: result.rankings,
        pagination: {
          currentPage: page,
          limit: limit,
          totalItems: result.totalItems,
          totalPages: limit > 0 ? Math.ceil(result.totalItems / limit) : 1,
          hasNext: limit > 0 && (page + 1) * limit < result.totalItems,
          hasPrev: page > 0
        }
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