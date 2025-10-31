import { Router } from 'express';
import multer from 'multer';
import AdminController from '../controller/adminController.js';
const router = Router();
const upload = multer(); // Sử dụng bộ nhớ tạm để xử lý form-data

// GET /api/admin/total-players
router.get('/total-players', AdminController.getTotalPlayers);
// GET /api/admin/total-banned-players
router.get('/total-banned-players', AdminController.getTotalBannedPlayers);
// GET /api/admin/online-players
router.get('/online-players', AdminController.getOnlinePlayers);
// GET /api/admin/coin-stats?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/coin-stats', AdminController.getCoinStats);
// GET /api/admin/player-stats?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/player-stats', AdminController.getPlayerStats);
// GET /api/admin/total-games?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/total-games', AdminController.getTotalGames);
// cho chart
router.get('/series/coin', AdminController.getCoinSeries);
router.get('/series/active-players', AdminController.getActivePlayersSeries);
router.get('/series/matches', AdminController.getMatchesSeries);
export default router;