import express from "express";
import {
    createPaymentUrl,
    vnpayReturn,
    vnpayIpn,
} from "../controller/paymentController.js";

const router = express.Router();

router.post("/create_payment_url", createPaymentUrl);
router.get("/vnpay_return", vnpayReturn);
router.get("/vnpay_ipn", vnpayIpn);

export default router;
