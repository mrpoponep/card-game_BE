import express from 'express';
import AuthController from '../controller/AuthController.js';

const router = express.Router();

router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post('/send-reset-otp', AuthController.sendResetOTP);
router.post('/verify-otp-reset-password', AuthController.verifyOTPAndResetPassword);

export default router;
