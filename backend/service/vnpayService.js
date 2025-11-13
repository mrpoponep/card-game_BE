import querystring from 'qs';
import crypto from 'crypto';

/**
 * @description Sắp xếp các key trong Object theo thứ tự alphabet.
 * @param {object} obj - Đối tượng cần sắp xếp.
 * @returns {object} Đối tượng đã sắp xếp.
 */
const sortObject = (obj) => {
    const sorted = {};
    const keys = Object.keys(obj).sort();
    keys.forEach((key) => (sorted[key] = obj[key]));
    return sorted;
};

// 📦 1. Tạo URL thanh toán
export const createPaymentService = async (req) => {
    // Lấy IP, chuẩn hóa IPv6 về IPv4 (127.0.0.1)
    let ipAddr =
        req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress;

    if (ipAddr && (ipAddr === '::1' || ipAddr.includes('::ffff:'))) {
        ipAddr = '127.0.0.1';
    }
    const normalizedIp = ipAddr || "127.0.0.1";

    const tmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_HASH_SECRET;
    const vnpUrl = process.env.VNP_URL;
    const returnUrl = process.env.VNP_RETURN_URL;

    const date = new Date();
    const createDate = date
        .toISOString()
        .replace(/[-T:\.Z]/g, '')
        .slice(0, 14);

    // Sử dụng timestamp + 3 số ngẫu nhiên cuối để đảm bảo tính duy nhất hơn
    const orderId = (Date.now() + Math.random().toString().slice(-3)).slice(-10);

    const amount = req.body.amount;
    const bankCode = req.body.bankCode || '';
    const orderInfo = req.body.orderDescription || 'Thanh toán đơn hàng';
    const orderType = req.body.orderType || 'other';
    const locale = req.body.language || 'vn';

    let vnp_Params = {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: tmnCode,
        vnp_Locale: locale,
        vnp_CurrCode: 'VND',
        vnp_TxnRef: orderId,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: orderType,
        vnp_Amount: amount * 100,
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr: normalizedIp,
        vnp_CreateDate: createDate,
    };

    if (bankCode) vnp_Params['vnp_BankCode'] = bankCode;

    // Bước 1: Sắp xếp các tham số
    vnp_Params = sortObject(vnp_Params);

    // FIX LỖI CHỮ KÝ: Sử dụng querystring.stringify để mã hóa (encode) TẤT CẢ các giá trị
    // (ví dụ: dấu cách, tiếng Việt có dấu) TRƯỚC KHI ký, đảm bảo chuỗi ký khớp với
    // dữ liệu được gửi trong URL.
    const signData = querystring.stringify(vnp_Params, { encode: true });

    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // Debug log để kiểm tra
    console.log("=== Create Debug ===");
    console.log("SignData (URL Encoded):", signData);
    console.log("SecureHash:", signed);

    // Bước 2: Thêm vnp_SecureHashType và vnp_SecureHash cho URL
    const urlParams = {
        ...vnp_Params,
        vnp_SecureHashType: 'HmacSHA512',
        vnp_SecureHash: signed
    };

    // Bước 3: Build URL với encode: true (đã được đảm bảo bởi querystring.stringify)
    // Sắp xếp lại lần cuối để đảm bảo thứ tự hash nằm cuối (mặc dù không bắt buộc)
    return `${vnpUrl}?${querystring.stringify(sortObject(urlParams), { encode: true })}`;
};

// 📦 2. Kiểm tra trả về từ VNPay
export const verifyReturnService = async (req) => {
    let vnp_Params = req.query;
    const secureHash = vnp_Params['vnp_SecureHash'];
    const secretKey = process.env.VNP_HASH_SECRET;

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    // Sắp xếp các tham số (vẫn là các giá trị đã DECODE)
    vnp_Params = sortObject(vnp_Params);

    // FIX LỖI CHỮ KÝ: Phải RE-ENCODE (mã hóa lại) các giá trị đã bị Express/Node.js DECODE
    // từ req.query TRƯỚC KHI ký, để chuỗi ký khớp với chuỗi đã được ký ở bước 1.
    const signData = querystring.stringify(vnp_Params, { encode: true });

    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // Debug log
    console.log("=== Verify Debug ===");
    console.log("SignData (URL Encoded):", signData);
    console.log("Expected hash:", signed);
    console.log("Received hash:", secureHash);

    if (secureHash === signed) {
        return {
            success: true,
            message: 'Thanh toán thành công',
            data: vnp_Params,
        };
    } else {
        return {
            success: false,
            message: 'Chữ ký không hợp lệ',
            data: vnp_Params,
        };
    }
};

// 📦 3. IPN (khi VNPay gửi notify)
export const verifyIpnService = async (req) => {
    let vnp_Params = req.query;
    const secureHash = vnp_Params['vnp_SecureHash'];
    const secretKey = process.env.VNP_HASH_SECRET;

    // Bước 1: Loại bỏ các tham số không dùng để ký và Hash
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    // Bước 2: Sắp xếp
    vnp_Params = sortObject(vnp_Params);

    // Bước 3: Tạo chuỗi ký (SignData) đã RE-ENCODE TỪ TẤT CẢ CÁC THAM SỐ CÒN LẠI
    // (Vì hàm tạo ký tất cả)
    const signData = querystring.stringify(vnp_Params, { encode: true });

    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // Debug log
    console.log("=== Verify IPN Debug ===");
    console.log("SignData (URL Encoded):", signData);
    console.log("Expected hash:", signed);
    console.log("Received hash:", secureHash);

    if (secureHash === signed) {
        return { RspCode: '00', Message: 'success' };
    } else {
        return { RspCode: '97', Message: 'Fail checksum' };
    }
};
