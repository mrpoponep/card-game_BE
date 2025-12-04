const GLOBAL_CHAT_ROOM = 'global_chat_room';

// Room chat history cache: { roomCode: [{ userId, player, text, timestamp }] }
const roomChatHistory = {};

/**
 * Format date to 'YYYY-MM-DD HH:mm:ss' format
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date string
 */
function formatTimestamp(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Get chat history for a specific user in a room
 * @param {string} roomCode - Room code
 * @param {number} userId - User ID to filter messages
 * @returns {Array} Array of messages from the specified user in format { timestamp, player, text }
 */
export function getUserChatHistory(roomCode, userId) {
    if (!roomChatHistory[roomCode]) {
        return [];
    }
    return roomChatHistory[roomCode].filter(msg => msg.userId === userId).map(msg => ({
        timestamp: msg.timestamp,
        player: msg.player,
        text: msg.text
    }));
}

/**
 * Get chat history as JSON string for a specific user in a room
 * @param {string} roomCode - Room code
 * @param {number} userId - User ID to filter messages
 * @returns {string} JSON string of user's chat messages
 */
export function getUserChatHistoryJSON(roomCode, userId) {
    const messages = getUserChatHistory(roomCode, userId);
    return JSON.stringify(messages);
}

/**
 * Clear chat history for a room (call on game end)
 * @param {string} roomCode - Room code to clear
 */
export function clearRoomChatHistory(roomCode) {
    if (roomChatHistory[roomCode]) {
        delete roomChatHistory[roomCode];
    }
}

export function register(io, socket){
    socket.on('joinGlobalChat', () => {
        socket.join(GLOBAL_CHAT_ROOM);
    });
    socket.on('leaveGlobalChat', () => {
        socket.leave(GLOBAL_CHAT_ROOM);
    });
    socket.on('sendGlobalMessage', (messageData) => {
        if(!messageData || !messageData.text || messageData.text.trim().length === 0){
            return;
        }
        const user = socket.user;
        if (!user){
            return;
        }
        const messagePayload = {
            userId: user.user_id,
            username: user.username,
            text: messageData.text.trim(),
            timestamp: new Date(),
        };
        io.to(GLOBAL_CHAT_ROOM).emit('receiveGlobalMessage', messagePayload);
    });

    socket.on('sendRoomMessage', ({ roomCode, text }) => {
        if (!text?.trim() || !roomCode) return;
        const user = socket.user;
        if (!user) return;

        const messagePayload = {
            userId: user.user_id,
            username: user.username,
            text: text.trim(),
            timestamp: new Date(),
            type: 'room'
        };

        // Store message in room chat history cache
        if (!roomChatHistory[roomCode]) {
            roomChatHistory[roomCode] = [];
        }
        roomChatHistory[roomCode].push({
            userId: user.user_id,
            player: user.username,
            text: text.trim(),
            timestamp: formatTimestamp(new Date())
        });

        io.to(roomCode).emit('receiveRoomMessage', messagePayload);
    });
}