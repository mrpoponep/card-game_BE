// vnpay.service.js
import qs from 'qs';
import crypto from 'crypto';

/** ---------------- Helpers ---------------- **/

function sortObject(obj) {
    const sorted = {};
    Object.keys(obj).sort().forEach(k => { sorted[k] = obj[k]; });
    return sorted;
}

function formatVNDate(date = new Date()) {
    const tzOffsetMin = 7 * 60;
    const localOffset = date.getTimezoneOffset();
    const d = new Date(date.getTime() + (tzOffsetMin + localOffset) * 60000);
    const pad = n => String(n).padStart(2, '0');
    return (
        d.getFullYear().toString() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds())
    );
}

function formatExpireDate(date = new Date(), minutes = 15) {
    return formatVNDate(new Date(date.getTime() + minutes * 60 * 1000));
}

function getClientIp(req) {
    let ipAddr = req.headers['x-forwarded-for'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        (req.connection && req.connection.socket ? req.connection.socket.remoteAddress : null);
    if (!ipAddr) return '127.0.0.1';
    if (ipAddr === '::1' || ipAddr.startsWith('::ffff:')) return '127.0.0.1';
    if (ipAddr.includes(',')) ipAddr = ipAddr.split(',')[0].trim();
    return ipAddr;
}

function buildSignData(sortedParams) {
    return Object.keys(sortedParams)
        .map(k => `${k}=${encodeURIComponent(sortedParams[k]).replace(/%20/g, '+')}`)
        .join('&');
}

function hmacSha512(secret, data) {
    return crypto.createHmac('sha512', secret).update(Buffer.from(data, 'utf-8')).digest('hex');
}

/** ---------------- Main functions ---------------- **/

export async function createPaymentService(req) {
    const tmnCode = (process.env.VNP_TMN_CODE || '').trim();
    const secretKey = (process.env.VNP_HASH_SECRET || '').trim();
    const vnpUrl = (process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html').trim();
    const returnUrl = (process.env.VNP_RETURN_URL || '').trim();

    if (!tmnCode || !secretKey || !returnUrl) throw new Error('Missing VNPay env');

    const now = new Date();
    const createDate = formatVNDate(now);
    const expireDate = formatExpireDate(now, 15);

    const orderId = Math.floor(Date.now() / 1000).toString();
    const amount = Number(req.body.amount || 0);
    const bankCode = (req.body.bankCode || '').trim();
    const orderInfo = (req.body.orderDescription || `Thanh toan ${orderId}`).trim();
    const orderType = (req.body.orderType || 'other').trim();
    const locale = (req.body.language || 'vn').trim();

    let vnp_Params = {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: tmnCode,
        vnp_Amount: Math.round(amount * 100),
        vnp_CurrCode: 'VND',
        vnp_TxnRef: orderId,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: orderType,
        vnp_Locale: locale,
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr: getClientIp(req),
        vnp_CreateDate: createDate,
        vnp_ExpireDate: expireDate
    };
    if (bankCode) vnp_Params.vnp_BankCode = bankCode;

    // Loại bỏ field rỗng
    Object.keys(vnp_Params).forEach(k => {
        if (vnp_Params[k] === '' || vnp_Params[k] === null || vnp_Params[k] === undefined) {
            delete vnp_Params[k];
        }
    });

    console.log('--- VNPAY Params BEFORE Sort ---');
    console.log(vnp_Params);

    const sorted = sortObject(vnp_Params);
    console.log('--- VNPAY Params AFTER Sort ---');
    console.log(sorted);

    const signData = buildSignData(sorted);
    const secureHash = hmacSha512(secretKey, signData);

    vnp_Params.vnp_SecureHash = secureHash;

    const paymentUrl = `${vnpUrl}?${qs.stringify(vnp_Params, { encode: true })}`;

    console.log('--- SIGN DEBUG ---');
    console.log('signData RAW:', signData);
    console.log('secureHash:', secureHash);
    console.log('paymentUrl:', paymentUrl);

    // trả luôn signData và secureHash để debug
    return { paymentUrl, signData, secureHash, paramsBeforeSort: vnp_Params, paramsSorted: sorted };
}

export async function verifyReturnService(req) {
    const secretKey = (process.env.VNP_HASH_SECRET || '').trim();
    if (!secretKey) throw new Error('Missing VNP_HASH_SECRET');

    const vnp_Params = { ...req.query };
    const receivedHash = vnp_Params.vnp_SecureHash?.toString();
    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    const sorted = sortObject(vnp_Params);
    const signData = buildSignData(sorted);
    const expectedHash = hmacSha512(secretKey, signData);

    const ok = expectedHash === (receivedHash || '');

    console.log('--- VERIFY RETURN DEBUG ---');
    console.log('receivedHash:', receivedHash);
    console.log('expectedHash:', expectedHash);
    console.log('signData:', signData);

    return { success: ok, expectedHash, receivedHash, signData, data: vnp_Params };
}

export async function verifyIpnService(req) {
    const secretKey = (process.env.VNP_HASH_SECRET || '').trim();
    if (!secretKey) throw new Error('Missing VNP_HASH_SECRET');

    const vnp_Params = { ...req.query };
    const receivedHash = vnp_Params.vnp_SecureHash?.toString();
    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    const sorted = sortObject(vnp_Params);
    const signData = buildSignData(sorted);
    const expectedHash = hmacSha512(secretKey, signData);

    console.log('--- VERIFY IPN DEBUG ---');
    console.log('receivedHash:', receivedHash);
    console.log('expectedHash:', expectedHash);
    console.log('signData:', signData);

    if (expectedHash === (receivedHash || '')) {
        return { RspCode: '00', Message: 'Success', expectedHash, receivedHash, signData };
    }
    return { RspCode: '97', Message: 'Fail checksum', expectedHash, receivedHash, signData };
}

export const _debug = { sortObject, formatVNDate, formatExpireDate, getClientIp, buildSignData, hmacSha512 };
