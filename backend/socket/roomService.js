// Room service: manages room state, deck utilities and socket event handlers for rooms

// This module keeps its own roomState shared across connections.
const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Shared room state for all sockets
const roomState = {}; // { roomCode: { players: [], settings: {}, gameState: {}, timerId: null } }

function sendFullRoomStateUpdate(io, roomCode) {
  if (!roomState[roomCode]) return;
  const room = roomState[roomCode];
  const publicSeats = room.seats.map(seat => {
    if(!seat) return null;
    const s = io.of('/').sockets.get(seat.socketId);
    const u = s?.user || {};
    return ({
      user_id: u.user_id || seat.user_id,
      username: u.username || 'Unknown',
      balance: u.balance || 0,
    })
  })
  const currentStateData = {
    seats: publicSeats,
    settings: room.settings,
    gameState: {
      status: room.gameState?.status || 'waiting',
      countdown: room.gameState?.countdown,
      communityCards: room.gameState?.communityCards || [],
      pot: room.gameState?.pot || 0,
    },
  };

  io.to(roomCode).emit('updateRoomState', currentStateData);

  if (room.gameState?.status === 'dealing' || room.gameState?.status === 'playing') {
    room.seats.forEach(seat => {
      if(seat){
        const hand = room.gameState.hands?.[seat.user_id] || [];
        io.to(seat.socketId).emit('updateMyHand', hand);
      }
    });
  }
}

function startGameCountdown(io, roomCode) {
  if (!roomState[roomCode] || roomState[roomCode].gameState?.status !== 'waiting') return;
  const room = roomState[roomCode];
  const playerCount = room.seats.filter(p => p).length;
  if (playerCount < 2) return;

  room.gameState = { status: 'countdown', countdown: 5 };
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
      dealNewHand(io, roomCode);
    }
  }, 1000);
}

function dealNewHand(io, roomCode) {
  if (!roomState[roomCode]) return;
  const room = roomState[roomCode];

  room.gameState = {
    ...(room.gameState || {}),
    status: 'dealing',
    deck: shuffleDeck(createDeck()),
    hands: {},
    communityCards: [],
    pot: 0,
  };

  room.seats.forEach(seat => {
    if(seat){
      room.gameState.hands[seat.user_id] = [
        room.gameState.deck.pop(),
        room.gameState.deck.pop(),
      ];
    }
  });

  room.gameState.status = 'playing';
  sendFullRoomStateUpdate(io, roomCode);

  // Simulate short hand; replace with real logic later
  setTimeout(() => endHand(io, roomCode), 3000);
}

function endHand(io, roomCode) {
  if (!roomState[roomCode]) return;
  const room = roomState[roomCode];

  // TODO: Implement actual winner determination logic
  // For now, randomly select a winner from active players
  const activePlayers = room.seats.filter(seat => seat);
  const winnerIndex = Math.floor(Math.random() * activePlayers.length);
  const winnerId = activePlayers[winnerIndex]?.user_id;

  // Prepare match result data
  const matchResultData = {
    roomCode: roomCode,
    winnerId: winnerId,
    players: room.seats.map(seat => {
      if (!seat) return null;
      const s = io.of('/').sockets.get(seat.socketId);
      const u = s?.user || {};
      return {
        user_id: u.user_id || seat.user_id,
        username: u.username || 'Unknown',
        balance: u.balance || 0,
        isWinner: (u.user_id || seat.user_id) === winnerId
      };
    }).filter(p => p)
  };

  room.gameState = {
    ...(room.gameState || {}),
    status: 'finished',
    hands: {},
    matchResult: matchResultData
  };

  sendFullRoomStateUpdate(io, roomCode);

  // Emit match result event to all players in the room
  io.to(roomCode).emit('matchFinished', matchResultData);

  room.gameState = { status: 'waiting' };

  setTimeout(() => {
    if (roomState[roomCode]) {
      const playerCount = roomState[roomCode].seats.filter(p => p).length;
      if( playerCount >= 2 ){
        startGameCountdown(io, roomCode);
      }
    } else if (roomState[roomCode]) {
      sendFullRoomStateUpdate(io, roomCode);
    }
  }, 5000);
}

function handleLeaveRoom(io, socket) {
  let roomCodeToUpdate = null;
  let remainingPlayers = 0;

  for (const roomCode in roomState) {
    const room = roomState[roomCode];
    const playerIndex = room.seats.findIndex(p => p?.socketId === socket.id);
    if (playerIndex > -1) {
      room.seats[playerIndex] = null;       
      roomCodeToUpdate = roomCode;
      const activePlayers = room.seats.filter(p => p);
      remainingPlayers = activePlayers.length;

      if (remainingPlayers === 0) {
        delete roomState[roomCode];
      } else if (remainingPlayers < 2 && room.gameState?.status !== 'waiting') {
        if (room.timerId) clearInterval(room.timerId);
        room.timerId = null;
        room.gameState = { status: 'waiting' };
      }
      break;
    }
  }

  if (roomCodeToUpdate && roomState[roomCodeToUpdate]) {
    sendFullRoomStateUpdate(io, roomCodeToUpdate);
  }
}

// register socket event handlers for this service
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
    // else {
    //   const currentStatus = roomState[roomCode].gameState?.status;
    //   if (currentStatus && currentStatus !== 'waiting' && currentStatus !== 'finished') {
    //     isSpectator = true;
    //     socket.emit('spectatorMode', true);
    //   }
    // }

    const room = roomState[roomCode];
    const existingPlayerIndex = room.seats.findIndex(p => p?.user_id === user.user_id);
    let mySeatIndex = existingPlayerIndex;
    if( existingPlayerIndex > -1){
      room.seats[existingPlayerIndex].socketId = socket.id;
    }
    else{
      const emptySeatIndex = room.seats.indexOf(null);
      if(emptySeatIndex > -1){
        room.seats[emptySeatIndex] = {socketId: socket.id, user_id: user.user_id};
        mySeatIndex = emptySeatIndex;
      }
      else{
        isSpectator = true;
      }
    }

    const currentStatus = room.gameState?.status;
    if( mySeatIndex === -1 || (currentStatus !== 'waiting' && currentStatus !== 'finished')){
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
}

export { roomState, sendFullRoomStateUpdate, startGameCountdown };
