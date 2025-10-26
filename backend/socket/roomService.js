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

  const currentStateData = {
    players: room.players.map(p => {
      const s = io.of('/').sockets.get(p.socketId);
      const u = s?.user || {};
      return ({
        user_id: u.user_id || p.userId,
        username: u.username || 'Unknown',
        balance: u.balance || 0,
      });
    }),
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
    room.players.forEach(player => {
      const hand = room.gameState.hands?.[player.userId] || [];
      io.to(player.socketId).emit('updateMyHand', hand);
    });
  }
}

function startGameCountdown(io, roomCode) {
  if (!roomState[roomCode] || roomState[roomCode].gameState?.status !== 'waiting') return;
  const room = roomState[roomCode];
  if (room.players.length < 2) return;

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

  room.players.forEach(player => {
    room.gameState.hands[player.userId] = [
      room.gameState.deck.pop(),
      room.gameState.deck.pop(),
    ];
  });

  room.gameState.status = 'playing';
  sendFullRoomStateUpdate(io, roomCode);

  // Simulate short hand; replace with real logic later
  setTimeout(() => endHand(io, roomCode), 3000);
}

function endHand(io, roomCode) {
  if (!roomState[roomCode]) return;
  const room = roomState[roomCode];

  room.gameState = {
    ...(room.gameState || {}),
    status: 'finished',
    hands: {},
  };
  sendFullRoomStateUpdate(io, roomCode);

  room.gameState = { status: 'waiting' };

  setTimeout(() => {
    if (roomState[roomCode] && roomState[roomCode].players.length >= 2) {
      startGameCountdown(io, roomCode);
    } else if (roomState[roomCode]) {
      sendFullRoomStateUpdate(io, roomCode);
    }
  }, 2000);
}

function handleLeaveRoom(io, socket) {
  let roomCodeToUpdate = null;
  let playerLeftUsername = null;
  let remainingPlayers = 0;

  for (const roomCode in roomState) {
    const room = roomState[roomCode];
    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex > -1) {
      playerLeftUsername = socket.user?.username || room.players[playerIndex].userId;
      room.players.splice(playerIndex, 1);
      roomCodeToUpdate = roomCode;
      remainingPlayers = room.players.length;

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
      roomState[roomCode] = {
        players: [],
        settings: settings || { max_players: 4, small_blind: 1000 },
        gameState: { status: 'waiting' },
        timerId: null
      };
    } else {
      const currentStatus = roomState[roomCode].gameState?.status;
      if (currentStatus && currentStatus !== 'waiting' && currentStatus !== 'finished') {
        isSpectator = true;
        socket.emit('spectatorMode', true);
      }
    }

    const room = roomState[roomCode];
    const existingPlayer = room.players.find(p => p.userId === user.user_id);
    if (!existingPlayer) {
      room.players.push({ socketId: socket.id, userId: user.user_id });
    } else {
      existingPlayer.socketId = socket.id;
    }

    sendFullRoomStateUpdate(io, roomCode);

    if (!isSpectator && room.players.length >= 2 && room.gameState?.status === 'waiting') {
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
