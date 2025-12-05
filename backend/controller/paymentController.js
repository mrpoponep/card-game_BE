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

            // 🔥 Tạo PENDING với amount = 0 để KHÔNG trigger cộng balance
            await Transaction.insertIntoDatabase(new Transaction({
                user_id: userId,
                source_id: null,
                amount: 0,  // 💡 Không cộng balance cho PENDING
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

        // 🔥 CHECK DUPLICATE trong Return callback (để tránh race condition)
        const DatabaseConnection = (await import('../model/DatabaseConnection.js')).default;
        const existingSuccess = await DatabaseConnection.query(
            `SELECT tx_id FROM Transactions 
             WHERE source = 'vnpay'
               AND reason LIKE ?
               AND reason LIKE ?
             LIMIT 1`,
            [`%txnRef:${vnp_TxnRef}%`, `%status:SUCCESS%`]
        );

        if (existingSuccess && existingSuccess.length > 0) {
            console.log(`⚠️ Return: Transaction ${vnp_TxnRef} already processed - SKIPPING (tx_id: ${existingSuccess[0].tx_id})`);

            // 🔥 Lấy transaction để check status thực tế
            const existingTx = await Transaction.findByTxnRef(vnp_TxnRef);
            const parsed = existingTx?.parseReason();
            const actualStatus = parsed?.status === 'SUCCESS' ? 'success' : 'failed';
            const actualAmount = existingTx?.amount || amount;

            return res.redirect(`${frontendUrl}/payment-result?status=${actualStatus}&amount=${actualAmount}&txnRef=${vnp_TxnRef}&message=Already+processed`);
        }

        const pendingTx = await Transaction.findByTxnRef(vnp_TxnRef);
        if (pendingTx) {
            const parsed = pendingTx.parseReason();

            // 🎯 Calculate bonus based on package
            const bonusRate = {
                100000: 0.05,   // 5% bonus
                250000: 0.05,   // 5% bonus
                500000: 0.10,   // 10% bonus
                1000000: 0.20,  // 20% bonus
                2500000: 0.25,  // 25% bonus
                5000000: 0.30,  // 30% bonus
            };

            const baseAmount = amount;
            const rate = bonusRate[baseAmount] || 0;
            const bonusAmount = Math.floor(baseAmount * rate);
            const totalAmount = baseAmount + bonusAmount;

            // 🔥 UPDATE PENDING transaction thay vì INSERT mới (bypass trigger)
            await Transaction.updateStatusBypassTrigger(vnp_TxnRef, {
                status: isSuccess ? 'SUCCESS' : 'FAILED',
                responseCode: vnp_ResponseCode,
                transactionNo: vnp_TransactionNo,
                newAmount: isSuccess ? totalAmount : 0
            });

            if (isSuccess) {
                try {
                    // Cộng vào balance với bonus (MANUAL UPDATE vì trigger đã bị bypass)
                    await User.updateBalanceById(pendingTx.user_id, totalAmount);
                    console.log(`✅ Balance updated for user ${pendingTx.user_id}: +${totalAmount} CHIP (${baseAmount} + ${bonusAmount} bonus = ${Math.round(rate * 100)}%)`);
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

        // 🔥 KIỂM TRA ĐÃ CÓ SUCCESS TRANSACTION CHƯA (để tránh duplicate từ Return callback)
        const DatabaseConnection = (await import('../model/DatabaseConnection.js')).default;

        // Tìm transaction SUCCESS với txnRef này
        const existingSuccess = await DatabaseConnection.query(
            `SELECT tx_id, reason FROM Transactions 
             WHERE source = 'vnpay'
               AND reason LIKE ?
               AND reason LIKE ?
             LIMIT 1`,
            [`%txnRef:${vnp_TxnRef}%`, `%status:SUCCESS%`]
        );

        if (existingSuccess && existingSuccess.length > 0) {
            console.log(`✅ IPN: Transaction ${vnp_TxnRef} already processed - SKIPPING (tx_id: ${existingSuccess[0].tx_id})`);
            console.log(`   Existing reason: ${existingSuccess[0].reason}`);
            return res.status(200).json({
                RspCode: '00',
                Message: 'Order already confirmed'
            });
        }

        console.log(`🔄 IPN: No SUCCESS transaction found, processing payment for ${vnp_TxnRef}`);

        const pendingTx = await Transaction.findByTxnRef(vnp_TxnRef);

        if (!pendingTx) {
            console.warn(`IPN: Transaction not found for txnRef: ${vnp_TxnRef}`);
            return res.status(200).json({
                RspCode: '01',
                Message: 'Order not found'
            });
        }

        // 🎯 Calculate bonus GIỐNG vnpayReturn
        const bonusRate = {
            100000: 0.05,   // 5% bonus
            250000: 0.05,   // 5% bonus
            500000: 0.10,   // 10% bonus
            1000000: 0.20,  // 20% bonus
            2500000: 0.25,  // 25% bonus
            5000000: 0.30,  // 30% bonus
        };

        const baseAmount = amount;
        const rate = bonusRate[baseAmount] || 0;
        const bonusAmount = Math.floor(baseAmount * rate);
        const totalAmount = baseAmount + bonusAmount;

        // 🔥 UPDATE PENDING transaction thay vì INSERT mới (bypass trigger)
        await Transaction.updateStatusBypassTrigger(vnp_TxnRef, {
            status: isSuccess ? 'SUCCESS' : 'FAILED',
            responseCode: vnp_ResponseCode,
            transactionNo: vnp_TransactionNo,
            newAmount: isSuccess ? totalAmount : 0
        });

        if (isSuccess) {
            try {
                // 🔥 Update balance với BONUS (MANUAL vì trigger đã bypass)
                await User.updateBalanceById(pendingTx.user_id, totalAmount);
                console.log(`✅ IPN: Balance updated for user ${pendingTx.user_id}: +${totalAmount} CHIP (${baseAmount} + ${bonusAmount} bonus = ${Math.round(rate * 100)}%)`);
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

// 🆕 Get transaction history
export const getTransactionHistory = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.user_id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        // 🔥 Chỉ lấy giao dịch SUCCESS
        const transactions = await Transaction.findByUserId(userId, 50, 'SUCCESS');

        // Parse reason field để lấy thông tin VNPay
        const formattedTransactions = transactions.map(tx => {
            const parsed = tx.parseReason();
            return {
                tx_id: tx.tx_id,
                amount: tx.amount,
                time: tx.time,
                status: parsed.status || 'UNKNOWN',
                order_info: parsed.orderInfo || '',
                txn_ref: parsed.txnRef || '',
                response_code: parsed.responseCode || '',
                transaction_no: parsed.transactionNo || ''
            };
        });

        return res.json({
            success: true,
            transactions: formattedTransactions
        });
    } catch (err) {
        console.error('Get transaction history error:', err);
        return res.status(500).json({
            success: false,
            message: err.message || 'Failed to fetch transaction history'
        });
    }
};
