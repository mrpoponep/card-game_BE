import * as PokerGame from '../game/pokerLogic.js';
import db from '../model/DatabaseConnection.js';
import { clearRoomChatHistory } from './chatService.js';

const roomState = {};

// Helper: Đồng bộ tiền từ bàn chơi về Database (Incremental Sync)
async function syncSeatToDB(seat) {
  if (!seat) return;
  try {
    const currentChips = seat.chips;
    const lastSynced = seat.synced || 0;
    const diff = currentChips - lastSynced;

    if (diff !== 0) {
      await db.query('UPDATE User SET balance = balance + ? WHERE user_id = ?', [diff, seat.user_id]);
      seat.synced = currentChips; 
    }
  } catch (err) {
    console.error('Sync DB Error:', err);
  }
}

function sendFullRoomStateUpdate(io, roomCode) {
  if (!roomState[roomCode]) return;
  const room = roomState[roomCode];

  const publicSeats = room.seats.map((seat, index) => {
    if (!seat) return null;

    const s = io.of('/').sockets.get(seat.socketId);
    const u = s?.user || {};
    
    let publicCards = null;
    if (room.gameState?.status === 'finished' && seat.cards && seat.cards.length > 0) {
        publicCards = seat.cards.map(c => ({
            rank: c[0], 
            suit: c[1].toUpperCase()
        }));
    }

    return ({
      user_id: u.user_id || seat.user_id,
      username: u.username || seat.username || 'Unknown',
      balance: u.balance || 0, 
      chips: seat.chips || 0,
      betThisRound: seat.betThisRound || 0,
      totalBet: seat.totalBet || 0,
      folded: seat.folded || false,
      allIn: seat.allIn || false,
      isActing: room.gameState?.toActSeat === index,
      cards: publicCards, 
      handName: seat.handName,
      inHand: seat.inHand || false 
    });
  });

  const currentStateData = {
    seats: publicSeats,
    settings: room.settings,
    gameState: {
      status: room.gameState?.status || 'waiting',
      countdown: room.gameState?.countdown,
      communityCards: room.gameState?.community || [],
      pot: room.gameState?.pot || 0,
      currentBet: room.gameState?.currentBet || 0,
      dealerSeat: room.gameState?.dealerSeat,
      lastAction: room.gameState?.lastAction,
      minRaise: room.gameState?.minRaise || 0
    },
  };

  io.to(roomCode).emit('updateRoomState', currentStateData);

  const showHand = ['playing', 'preflop', 'flop', 'turn', 'river'].includes(room.gameState?.status);
  
  if (showHand) {
    room.seats.forEach(seat => {
      if (seat && seat.cards) {
        const formattedHand = seat.cards.map(c => ({
            rank: c[0], 
            suit: c[1].toUpperCase()
        }));
        io.to(seat.socketId).emit('updateMyHand', formattedHand);
      }
    });
  }
}

function startGameCountdown(io, roomCode) {
  if (!roomState[roomCode]) return;
  const room = roomState[roomCode];

  // Chỉ đếm những người có tiền (chips > 0)
  const readyPlayers = room.seats.filter(p => p && p.chips > 0);
  
  if (readyPlayers.length < 2) {
      resetRoomToWaiting(room);
      sendFullRoomStateUpdate(io, roomCode);
      return;
  }

  room.gameState.status = 'countdown';
  room.gameState.countdown = 5;
  
  // Dọn dẹp bàn
  room.gameState.community = [];
  room.gameState.pot = 0;
  room.gameState.currentBet = 0;
  room.gameState.lastAction = null;
  
  room.seats.forEach(seat => {
      if (seat) {
          seat.cards = [];
          seat.betThisRound = 0;
          seat.totalBet = 0;
          seat.folded = false;
          seat.allIn = false;
          seat.handName = null;
      }
  });

  sendFullRoomStateUpdate(io, roomCode);

  if (room.timerId) clearTimeout(room.timerId);

  room.timerId = setInterval(() => {
    if (!roomState[roomCode]) {
      clearInterval(room.timerId);
      return;
    }
    room.gameState.countdown -= 1;
    sendFullRoomStateUpdate(io, roomCode);
    
    if (room.gameState.countdown <= 0) {
      clearInterval(room.timerId);
      room.timerId = null;
      
      room.roomCode = roomCode;
      const started = PokerGame.startGame(room, io);
      
      if(started) {
          room.gameState.status = 'playing';
          sendFullRoomStateUpdate(io, roomCode);
      } else {
          resetRoomToWaiting(room);
          sendFullRoomStateUpdate(io, roomCode);
      }
    }
  }, 1000);
}

// --- CẬP NHẬT LOGIC KẾT THÚC VÁN ---
async function onGameEnd(io, roomCode) {
    const room = roomState[roomCode];
    if (room) {
        // 1. Đồng bộ tiền về DB cho tất cả người chơi
        for (const seat of room.seats) {
            await syncSeatToDB(seat);
        }

        // 2. Kiểm tra điều kiện tiền tối thiểu (>= 10 lần Small Blind)
        const minChips = room.settings.small_blind * 10;
        const kickList = [];

        room.seats.forEach((seat) => {
            if (seat && seat.chips < minChips) {
                kickList.push(seat);
            }
        });

        // 3. Đuổi người chơi không đủ tiền
        for (const seat of kickList) {
            const socket = io.of('/').sockets.get(seat.socketId);
            if (socket) {
                // Gửi thông báo riêng cho người bị đuổi
                socket.emit('forceLeave', { reason: `Số dư ${seat.chips} không đủ để tiếp tục (Cần tối thiểu ${minChips}).` });
                // Xử lý thoát phòng
                await handleLeaveRoom(io, socket);
            }
        }
    }

    // 4. Đợi 15 giây rồi bắt đầu ván mới (nếu còn đủ người)
    // Note: Clear chat history AFTER the delay so reports can still access it during result screen
    setTimeout(() => {
        // Clear chat history before starting next game
        clearRoomChatHistory(roomCode);

        if (roomState[roomCode]) {
            const playerCount = roomState[roomCode].seats.filter(p => p).length;
            if (playerCount >= 2) {
                roomState[roomCode].gameState.status = 'waiting';
                startGameCountdown(io, roomCode);
            } else {
                // Không đủ người thì reset về chờ
                resetRoomToWaiting(roomState[roomCode]);
                sendFullRoomStateUpdate(io, roomCode);
            }
        }
    }, 15000);
}

function resetRoomToWaiting(room) {
    room.gameState.status = 'waiting';
    room.gameState.community = [];
    room.gameState.pot = 0;
    room.gameState.lastAction = null;
    room.seats.forEach(s => { 
        if(s) { 
            s.cards = []; 
            s.betThisRound = 0; 
            s.totalBet = 0;
            s.folded = false;
            s.allIn = false;
            s.handName = null; 
            s.inHand = false;
        }
    });
}

async function handleLeaveRoom(io, socket) {
  let roomCodeToUpdate = null;

  for (const roomCode in roomState) {
    const room = roomState[roomCode];
    const playerIndex = room.seats.findIndex(p => p?.socketId === socket.id);
    
    if (playerIndex > -1) {
      const player = room.seats[playerIndex];
      
      // 1. Sync tiền lần cuối
      await syncSeatToDB(player);

      // 2. Xử lý game nếu đang chơi
      const isPlaying = ['playing', 'preflop', 'flop', 'turn', 'river'].includes(room.gameState?.status);
      
      // Nếu đang chơi (inHand) mà thoát -> Fold
      if (isPlaying && player.inHand && !player.folded) {
         PokerGame.handleAction(room, socket.id, 'fold', {}, io, sendFullRoomStateUpdate, () => onGameEnd(io, roomCode));
      }

      // 3. Xóa khỏi ghế
      room.seats[playerIndex] = null;
      roomCodeToUpdate = roomCode;
      
      // 4. Kiểm tra người còn lại
      const activePlayers = room.seats.filter(p => p); // Người còn ngồi
      const inHandPlayers = room.seats.filter(p => p && p.inHand && !p.folded); // Người đang chơi ván này

      if (activePlayers.length === 0) {
        delete roomState[roomCode];
      } else if (isPlaying && inHandPlayers.length === 1) {
        // --- CÒN 1 NGƯỜI ĐANG CHƠI -> THẮNG LUÔN ---
        const winner = inHandPlayers[0];
        winner.chips += room.gameState.pot;
        room.gameState.lastAction = `${winner.username} thắng (đối thủ thoát)`;
        
        await syncSeatToDB(winner);
        
        if (room.timerId) clearInterval(room.timerId);
        room.timerId = null;
        
        // Gửi kết quả và reset
        io.to(roomCode).emit('game:result', {
             winners: [{ userId: winner.user_id, amount: room.gameState.pot, handName: 'Đối thủ thoát' }]
        });
        
        // Gọi onGameEnd để xử lý luồng kết thúc chuẩn (check tiền, đếm ngược ván mới)
        onGameEnd(io, roomCode);
        
      } else if (activePlayers.length < 2 && room.gameState.status !== 'playing' && room.gameState.status !== 'finished') {
          // Nếu đang chờ/đếm ngược mà còn < 2 người -> Reset
          if (room.timerId) clearInterval(room.timerId);
          room.timerId = null;
          resetRoomToWaiting(room);
      }
      break;
    }
  }

  if (roomCodeToUpdate && roomState[roomCodeToUpdate]) {
    sendFullRoomStateUpdate(io, roomCodeToUpdate);
  }
}

export function register(io, socket) {
  // Quick-join matchmaking: find a public-ish room with players or create one
  // Optional payload: { excludeRoomCode }
  socket.on('quickJoin', async (payload = {}) => {
    try {
      const exclude = payload?.excludeRoomCode;
      // Priority 1: rooms with players and available seats
      let target = null;
      for (const code in roomState) {
        const room = roomState[code];
        if (!room || !room.settings) continue;
        if (exclude && code === exclude) continue; // skip excluded
        const occupied = room.seats.filter(p => p).length;
        const emptyIndex = room.seats.indexOf(null);
        if (occupied > 0 && emptyIndex > -1) {
          target = { code, settings: room.settings };
          break;
        }
      }

      // Priority 2: rooms waiting/countdown even if empty seat exists
      if (!target) {
        for (const code in roomState) {
          const room = roomState[code];
          if (!room || !room.settings) continue;
          if (exclude && code === exclude) continue;
          const emptyIndex = room.seats.indexOf(null);
          if (emptyIndex > -1 && ['waiting','countdown'].includes(room.gameState?.status)) {
            target = { code, settings: room.settings };
            break;
          }
        }
      }

      // Priority 3: create a new public room
      if (!target) {
        const generateRoomCode = () => Math.floor(1000 + Math.random() * 9000).toString();
        let roomCode;
        do { roomCode = generateRoomCode(); } while (roomState[roomCode]);
        const maxPlayers = 4;
        const smallBlind = 1000;
        roomState[roomCode] = {
          seats: Array(maxPlayers).fill(null),
          settings: { max_players: maxPlayers, small_blind: smallBlind },
          gameState: { status: 'waiting' },
          timerId: null
        };
        target = { code: roomCode, settings: roomState[roomCode].settings };
      }

      socket.emit('quickJoinResult', { roomCode: target.code, settings: target.settings });
    } catch (e) {
      try { socket.emit('error', { message: 'Không thể tìm phòng phù hợp' }); } catch {}
    }
  });
  socket.on('joinRoom', async ({ roomCode, settings }) => {
    const user = socket.user;
    if (!user || !roomCode) return;

    socket.join(roomCode);

    let isSpectator = false;
    if (!roomState[roomCode]) {
      const maxPlayers = settings?.max_players || 4;
      const smallBlind = settings?.small_blind || 1000;
      roomState[roomCode] = {
        seats: Array(maxPlayers).fill(null),
        settings: { max_players: maxPlayers, small_blind: smallBlind },
        gameState: { status: 'waiting' },
        timerId: null
      };
    }

    const room = roomState[roomCode];
    const existingPlayerIndex = room.seats.findIndex(p => p?.user_id === user.user_id);
    
    if (existingPlayerIndex > -1) {
      room.seats[existingPlayerIndex].socketId = socket.id;
    } else {
      const emptySeatIndex = room.seats.indexOf(null);
      
      if (emptySeatIndex > -1) {
        // --- LOGIC MANG TIỀN VÀO (BUY-IN) ---
        const smallBlind = room.settings.small_blind;
        const limit = smallBlind * 30; 
        let buyInAmount = 0;

        if (user.balance > limit) {
            buyInAmount = limit; // Giàu thì mang 30x
        } else {
            buyInAmount = user.balance; // Nghèo thì mang tất cả
        }

        try {
            // Trừ tiền trong DB ngay lập tức
            await db.query('UPDATE User SET balance = balance - ? WHERE user_id = ?', [buyInAmount, user.user_id]);
        } catch (e) {
            console.error("Buy-in error", e);
            return; 
        }

        room.seats[emptySeatIndex] = { 
            socketId: socket.id, 
            user_id: user.user_id,
            username: user.username,
            chips: buyInAmount, 
            synced: 0, // Đã trừ ở DB, nên mốc sync bắt đầu từ 0
            inHand: false // Mới vào thì chưa được chia bài
        };
      } else {
        isSpectator = true;
      }
    }
    
    const currentStatus = room.gameState?.status;
    if (currentStatus !== 'waiting' && currentStatus !== 'finished') {
       isSpectator = true;
       socket.emit('spectatorMode', true);
    }

    sendFullRoomStateUpdate(io, roomCode);

    // Kiểm tra để bắt đầu game (chỉ đếm người có tiền và chưa inHand để tránh start liên tục khi đang chơi)
    // Nhưng ở đây logic startGameCountdown đã handle việc check status 'waiting' nên an toàn
    const activePlayers = room.seats.filter(p => p && p.chips > 0).length;
    if (activePlayers >= 2 && room.gameState?.status === 'waiting') {
      startGameCountdown(io, roomCode);
    }
  });

  socket.on('leaveRoom', async (callback) => {
    await handleLeaveRoom(io, socket);
    if (typeof callback === 'function') callback();
  });

  socket.on('disconnect', () => {
    handleLeaveRoom(io, socket);
  });

  socket.on('playerAction', ({ action, amount }) => {
      let currentRoomCode = null;
      for(const code in roomState) {
          if (roomState[code].seats.some(s => s && s.socketId === socket.id)) {
              currentRoomCode = code;
              break;
          }
      }

      if (currentRoomCode) {
          const room = roomState[currentRoomCode];
          PokerGame.handleAction(
              room, 
              socket.id, 
              action, 
              { amount }, 
              io, 
              sendFullRoomStateUpdate, 
              () => onGameEnd(io, currentRoomCode)
          );
      }
  });
}

export { roomState, sendFullRoomStateUpdate, startGameCountdown };