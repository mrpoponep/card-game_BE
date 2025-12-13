import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import ReferralController from '../controller/ReferralController.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/track-click', ReferralController.trackClick);
router.get('/validate-link/:code', ReferralController.validateLink);

// Protected routes (authentication required)
router.post('/create-link', authenticateJWT, ReferralController.createLink);
router.post('/activate', authenticateJWT, ReferralController.activateReferral);
router.get('/stats', authenticateJWT, ReferralController.getStats);

export default router;
