// socket/socketManager.js
let ioInstance = null;

export function initSocketManager(io) {
  if (!ioInstance) {
    ioInstance = io;
    console.log('Socket Manager initialized.');
  }
}

/**
 * Hàm này được các service khác gọi để "đọc" số lượng kết nối
 */
export function getOnlineCount() {
  if (!ioInstance) {
    return 0;
  }
  // .sockets.sockets là một Map chứa tất cả kết nối
  return ioInstance.sockets.sockets.size;
}