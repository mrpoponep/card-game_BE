const GLOBAL_CHAT_ROOM = 'global_chat_room';

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
    io.to(roomCode).emit('receiveRoomMessage', {
      userId: user.user_id,
      username: user.username,
      text: text.trim(),
      timestamp: new Date(),
      type: 'room'
    });
  });
}