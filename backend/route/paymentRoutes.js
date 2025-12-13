import express from "express";
import {
    createPaymentUrl,
    vnpayReturn,
    vnpayIpn,
    getTransactionHistory,
} from "../controller/paymentController.js";
import { authenticateJWT } from "../middleware/auth.js";

const router = express.Router();

router.post("/create_payment_url", authenticateJWT, createPaymentUrl);
router.get("/vnpay_return", vnpayReturn);
router.get("/vnpay_ipn", vnpayIpn);
router.get("/history", authenticateJWT, getTransactionHistory); // 🔥 Protected route

export default router;
