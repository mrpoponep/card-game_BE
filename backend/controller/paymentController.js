import { createPaymentService, verifyReturnService, verifyIpnService } from '../service/vnpayService.js';
import Transaction from '../model/Transaction.js';
import User from '../model/User.js';

export const createPaymentUrl = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.user_id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        const amount = Number(req.body.amount || 0);
        if (amount < 10000 || amount > 500000000) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount (must be between 10,000 - 500,000,000 VND)'
            });
        }

        const result = await createPaymentService(req, userId);
        const paymentUrl = typeof result === 'string' ? result : result?.paymentUrl;

        console.log('Service result:', paymentUrl);

        const txnRef = result?.paramsBeforeSort?.vnp_TxnRef || result?.paramsSorted?.vnp_TxnRef;
        if (txnRef) {
            const reason = Transaction.buildReason({
                txnRef: txnRef,
                orderInfo: req.body.orderDescription || `Nạp tiền ${txnRef}`,
                status: 'PENDING'
            });

            await Transaction.insertIntoDatabase(new Transaction({
                user_id: userId,
                source_id: null,
                amount: amount,
                reason: reason,
                source: 'vnpay',
                time: new Date()
            }));
        }

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
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        if (!result.success) {
            console.error('VNPay signature verification failed:', result);
            return res.redirect(`${frontendUrl}/payment-result?status=failed&message=Invalid+signature`);
        }

        const {
            vnp_Amount,
            vnp_BankCode,
            vnp_CardType,
            vnp_OrderInfo,
            vnp_PayDate,
            vnp_ResponseCode,
            vnp_TxnRef,
            vnp_TransactionNo
        } = result.data;

        const amount = Number(vnp_Amount) / 100;
        const isSuccess = vnp_ResponseCode === '00';

        const pendingTx = await Transaction.findByTxnRef(vnp_TxnRef);
        if (pendingTx) {
            const parsed = pendingTx.parseReason();
            const newReason = Transaction.buildReason({
                txnRef: vnp_TxnRef,
                orderInfo: parsed.orderInfo || vnp_OrderInfo,
                status: isSuccess ? 'SUCCESS' : 'FAILED',
                responseCode: vnp_ResponseCode,
                transactionNo: vnp_TransactionNo
            });

            // 🔥 INSERT transaction mới thay vì UPDATE
            const newTx = new Transaction({
                user_id: pendingTx.user_id,
                source_id: null,
                amount: isSuccess ? amount : -Math.abs(pendingTx.amount),
                reason: newReason,
                source: 'vnpay',
                time: new Date()
            });
            await Transaction.insertIntoDatabase(newTx);

            if (isSuccess) {
                try {
                    await User.updateBalanceById(pendingTx.user_id, amount);
                    console.log(`✅ Balance updated for user ${pendingTx.user_id}: +${amount} VND`);
                } catch (balanceError) {
                    console.error('Failed to update balance:', balanceError);
                }
            }
        } else {
            console.warn(`Transaction not found for txnRef: ${vnp_TxnRef}`);
        }

        const queryParams = new URLSearchParams({
            status: isSuccess ? 'success' : 'failed',
            amount: amount.toString(),
            txnRef: vnp_TxnRef,
            responseCode: vnp_ResponseCode,
            message: isSuccess ? 'Payment successful' : 'Payment failed'
        });

        return res.redirect(`${frontendUrl}/payment-result?${queryParams.toString()}`);
    } catch (err) {
        console.error('VNPay return error:', err);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/payment-result?status=error&message=${encodeURIComponent(err.message)}`);
    }
};

export const vnpayIpn = async (req, res) => {
    try {
        const result = await verifyIpnService(req);

        if (result.RspCode !== '00') {
            console.error('VNPay IPN signature verification failed:', result);
            return res.status(200).json(result);
        }

        const {
            vnp_Amount,
            vnp_ResponseCode,
            vnp_TxnRef,
            vnp_TransactionNo,
            vnp_OrderInfo
        } = req.query;

        const amount = Number(vnp_Amount) / 100;
        const isSuccess = vnp_ResponseCode === '00';

        const pendingTx = await Transaction.findByTxnRef(vnp_TxnRef);

        if (!pendingTx) {
            console.warn(`IPN: Transaction not found for txnRef: ${vnp_TxnRef}`);
            return res.status(200).json({
                RspCode: '01',
                Message: 'Order not found'
            });
        }

        const parsed = pendingTx.parseReason();
        if (parsed.status !== 'PENDING') {
            console.log(`IPN: Transaction ${vnp_TxnRef} already processed with status ${parsed.status}`);
            return res.status(200).json({
                RspCode: '02',
                Message: 'Order already confirmed'
            });
        }

        const newReason = Transaction.buildReason({
            txnRef: vnp_TxnRef,
            orderInfo: parsed.orderInfo || vnp_OrderInfo,
            status: isSuccess ? 'SUCCESS' : 'FAILED',
            responseCode: vnp_ResponseCode,
            transactionNo: vnp_TransactionNo
        });

        // 🔥 INSERT transaction mới thay vì UPDATE
        const newTx = new Transaction({
            user_id: pendingTx.user_id,
            source_id: null,
            amount: isSuccess ? amount : -Math.abs(pendingTx.amount),
            reason: newReason,
            source: 'vnpay',
            time: new Date()
        });
        await Transaction.insertIntoDatabase(newTx);

        if (isSuccess) {
            try {
                await User.updateBalanceById(pendingTx.user_id, amount);
                console.log(`✅ IPN: Balance updated for user ${pendingTx.user_id}: +${amount} VND`);
            } catch (balanceError) {
                console.error('IPN: Failed to update balance:', balanceError);
                return res.status(200).json({
                    RspCode: '99',
                    Message: 'Failed to update balance'
                });
            }
        }

        return res.status(200).json({
            RspCode: '00',
            Message: 'Success'
        });
    } catch (err) {
        console.error('VNPay IPN error:', err);
        return res.status(200).json({
            RspCode: '99',
            Message: err.message
        });
    }
};
