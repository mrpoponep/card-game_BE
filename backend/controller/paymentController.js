import { createPaymentService, verifyReturnService, verifyIpnService } from '../service/vnpayService.js';

export const createPaymentUrl = async (req, res) => {
    try {
        const result = await createPaymentService(req);

        // Hỗ trợ cả 2 kiểu trả về
        const paymentUrl = typeof result === 'string' ? result : result?.paymentUrl;

        console.log('Service result:', paymentUrl);

        return res.json({
            success: true,
            paymentUrl
        });
    } catch (e) {
        console.error('Create payment error:', e);
        return res.status(400).json({
            success: false,
            message: e.message || 'Tạo URL thất bại'
        });
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
