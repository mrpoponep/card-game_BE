import express from 'express';
// 🔹 1. IMPORT THÊM HÀM 'login'
import { register, login } from '../controller/authController.js';

const router = express.Router();

// Định nghĩa route cho POST /api/auth/register
router.post('/register', register);

// 🔹 2. THÊM ROUTE CHO LOGIN
router.post('/login', login); 

export default router;