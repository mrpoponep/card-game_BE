const GLOBAL_CHAT_ROOM = 'global_chat_room';

// Room chat history cache: { roomCode: [{ userId, username, text, timestamp }] }
const roomChatHistory = {};

/**
 * Get chat history for a specific user in a room
 * @param {string} roomCode - Room code
 * @param {number} userId - User ID to filter messages
 * @returns {Array} Array of messages from the specified user
 */
export function getUserChatHistory(roomCode, userId) {
    if (!roomChatHistory[roomCode]) {
        return [];
    }
    return roomChatHistory[roomCode].filter(msg => msg.userId === userId);
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
            username: user.username,
            text: text.trim(),
            timestamp: new Date().toISOString()
        });

        io.to(roomCode).emit('receiveRoomMessage', messagePayload);
    });
}