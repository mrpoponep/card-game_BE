// routes/rankingRoute.js
import { Router } from 'express';
import multer from 'multer';
import RankingController from '../controller/RankingController.js';
const router = Router();
const upload = multer(); // Sử dụng bộ nhớ tạm để xử lý form-data

router.post('/rankings/list', upload.none(), RankingController.getAllRankings);
router.get('/rankings/:playerId', RankingController.getPlayerRanking);

export default router;