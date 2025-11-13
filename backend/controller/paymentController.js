import { createPaymentService, verifyReturnService, verifyIpnService } from '../service/vnpayService.js';

export const createPaymentUrl = async (req, res) => {
    try {
        const paymentUrl = await createPaymentService(req);
        return res.status(200).json({ success: true, paymentUrl });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const vnpayReturn = async (req, res) => {
    try {
        const result = await verifyReturnService(req);
        return res.status(200).json(result);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const vnpayIpn = async (req, res) => {
    try {
        const result = await verifyIpnService(req);
        return res.status(200).json(result);
    } catch (err) {
        return res.status(500).json({ RspCode: '99', Message: err.message });
    }
};
