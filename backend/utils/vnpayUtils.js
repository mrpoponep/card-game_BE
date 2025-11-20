const crypto = require('crypto');

function formatDate(date) {
    // yyyyMMddHHmmss
    const pad = (n, width = 2) => String(n).padStart(width, '0');
    return (
        date.getFullYear().toString() +
        pad(date.getMonth() + 1) +
        pad(date.getDate()) +
        pad(date.getHours()) +
        pad(date.getMinutes()) +
        pad(date.getSeconds())
    );
}

// encode according to RFC 3986 (encodeURIComponent but also escape ')
function rfc3986Encode(str) {
    return encodeURIComponent(str)
        .replace(/[!'()*]/g, function (c) {
            return '%' + c.charCodeAt(0).toString(16).toUpperCase();
        });
}

// Build the query string sorted by key
function buildVnpQueryString(params) {
    const sortedKeys = Object.keys(params).sort();
    const parts = sortedKeys.map((key) => {
        return `${key}=${rfc3986Encode(params[key] || '')}`;
    });
    return parts.join('&');
}

// Create HMAC SHA512 secure hash
function createSecureHash(data, secret) {
    return crypto.createHmac('sha512', secret).update(data).digest('hex');
}

// Build full payment url (vnpPayUrl + ? + query + &vnp_SecureHash=...)
function getPaymentUrl(vnpParams, vnpHashSecret, vnpPayUrl) {
    const query = buildVnpQueryString(vnpParams);
    const secureHash = createSecureHash(query, vnpHashSecret);
    // append secure hash
    const fullUrl = `${vnpPayUrl}?${query}&vnp_SecureHash=${secureHash}`;
    return fullUrl;
}

// Verify payment return. `fields` is an object that excludes vnp_SecureHash and vnp_SecureHashType
function verifyPayment(fields, vnpSecureHash, vnpHashSecret) {
    const query = buildVnpQueryString(fields);
    const expectedHash = createSecureHash(query, vnpHashSecret);
    // Compare case-insensitive (hex)
    return expectedHash.toLowerCase() === (vnpSecureHash || '').toLowerCase();
}

module.exports = {
    formatDate,
    buildVnpQueryString,
    getPaymentUrl,
    verifyPayment,
};
