import * as PokerGame from '../game/pokerLogic.js';

const roomState = {};

function sendFullRoomStateUpdate(io, roomCode) {
  if (!roomState[roomCode]) return;
  const room = roomState[roomCode];

  const publicSeats = room.seats.map((seat, index) => {
    if (!seat) return null;

    const s = io.of('/').sockets.get(seat.socketId);
    const u = s?.user || {};
    
    // Logic gửi bài công khai khi KẾT THÚC
    let publicCards = null;
    if (room.gameState?.status === 'finished' && seat.cards) {
        publicCards = seat.cards.map(c => ({
            rank: c[0], 
            suit: c[1].toUpperCase()
        }));
    }

    return ({
      user_id: u.user_id || seat.user_id,
      username: u.username || 'Unknown',
      balance: u.balance || 0,
      chips: seat.chips || 0,
      betThisRound: seat.betThisRound || 0,
      totalBet: seat.totalBet || 0,
      folded: seat.folded || false,
      allIn: seat.allIn || false,
      isActing: room.gameState?.toActSeat === index,
      cards: publicCards, // Gửi bài để client lật
      handName: seat.handName 
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

  // Gửi bài riêng khi đang chơi
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
  if (!roomState[roomCode] || (roomState[roomCode].gameState?.status !== 'waiting' && roomState[roomCode].gameState?.status !== 'finished')) return;
  const room = roomState[roomCode];

  const playerCount = room.seats.filter(p => p).length;
  if (playerCount < 2) {
      room.gameState.status = 'waiting';
      // Dọn dẹp
      room.gameState.community = [];
      room.gameState.pot = 0;
      room.seats.forEach(s => { 
          if(s) { s.cards = []; s.betThisRound = 0; s.handName = null; }
      });
      sendFullRoomStateUpdate(io, roomCode);
      return;
  }

  room.gameState.status = 'countdown';
  room.gameState.countdown = 5;

  // Dọn dẹp bàn ngay khi bắt đầu đếm ngược
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
          room.gameState.status = 'waiting';
          sendFullRoomStateUpdate(io, roomCode);
      }
    }
  }, 1000);
}

function onGameEnd(io, roomCode) {
    setTimeout(() => {
        if (roomState[roomCode]) {
            roomState[roomCode].gameState.status = 'waiting';
            startGameCountdown(io, roomCode);
        }
    }, 5000);
}

function handleLeaveRoom(io, socket) {
  let roomCodeToUpdate = null;
  let remainingSeats = 0;

  for (const roomCode in roomState) {
    const room = roomState[roomCode];
    const playerIndex = room.seats.findIndex(p => p?.socketId === socket.id);
    
    if (playerIndex > -1) {
      if (room.gameState?.toActSeat === playerIndex) {
         PokerGame.handleAction(room, socket.id, 'fold', {}, io, sendFullRoomStateUpdate, () => onGameEnd(io, roomCode));
      }

      room.seats[playerIndex] = null;
      roomCodeToUpdate = roomCode;
      
      const activePlayers = room.seats.filter(p => p);
      remainingSeats = activePlayers.length;

      if (remainingSeats === 0) {
        delete roomState[roomCode];
      } else if (remainingSeats < 2 && room.gameState?.status !== 'waiting') {
        if (room.timerId) clearInterval(room.timerId);
        room.timerId = null;
        
        room.gameState.status = 'waiting';
        room.gameState.community = [];
        room.gameState.pot = 0;
        room.gameState.lastAction = null;
        
        room.seats.forEach(s => {
            if (s) {
                s.cards = [];
                s.betThisRound = 0;
                s.totalBet = 0;
                s.folded = false;
                s.allIn = false;
                s.handName = null;
            }
        });
      }
      break;
    }
  }

  if (roomCodeToUpdate && roomState[roomCodeToUpdate]) {
    sendFullRoomStateUpdate(io, roomCodeToUpdate);
  }
}

export function register(io, socket) {
  socket.on('joinRoom', ({ roomCode, settings }) => {
    const user = socket.user;
    if (!user || !roomCode) return;

    socket.join(roomCode);

    let isSpectator = false;
    if (!roomState[roomCode]) {
      const maxPlayers = settings?.max_players || 4;
      roomState[roomCode] = {
        seats: Array(maxPlayers).fill(null),
        settings: settings || { max_players: maxPlayers, small_blind: 1000 },
        gameState: { status: 'waiting' },
        timerId: null
      };
    }

    const room = roomState[roomCode];
    const existingPlayerIndex = room.seats.findIndex(p => p?.user_id === user.user_id);
    let mySeatIndex = existingPlayerIndex;

    if (existingPlayerIndex > -1) {
      room.seats[existingPlayerIndex].socketId = socket.id;
    } else {
      const emptySeatIndex = room.seats.indexOf(null);
      if (emptySeatIndex > -1) {
        room.seats[emptySeatIndex] = { 
            socketId: socket.id, 
            user_id: user.user_id,
            username: user.username,
            chips: user.balance || 10000 
        };
        mySeatIndex = emptySeatIndex;
      } else {
        isSpectator = true;
      }
    }
    
    const currentStatus = room.gameState?.status;
    if (mySeatIndex === -1 || (currentStatus !== 'waiting' && currentStatus !== 'finished')) {
       isSpectator = true;
       socket.emit('spectatorMode', true);
    }

    sendFullRoomStateUpdate(io, roomCode);

    const playerCount = room.seats.filter(p => p).length;
    if (!isSpectator && playerCount >= 2 && room.gameState?.status === 'waiting') {
      startGameCountdown(io, roomCode);
    }
  });

  socket.on('leaveRoom', () => {
    handleLeaveRoom(io, socket);
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