// Load environment variables FIRST
import './config/dotenv-config.js';

import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import RewardDistributionService from './service/RewardDistributionService.js';
import jwt from 'jsonwebtoken';

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'youraccesstokensecret';

// --- Deck Utilities ---
const SUITS = ['S', 'H', 'D', 'C']; // Spades, Hearts, Diamonds, Clubs
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
    [deck[i], deck[j]] = [deck[j], deck[i]]; // Swap
  }
  return deck;
}
// --- End Deck Utilities ---


// --- Game State Management ---
const roomState = {}; // { roomCode: { players: [], settings: {}, gameState: {}, timerId: null } }

// Function to send full game state update
const sendFullRoomStateUpdate = (roomCode) => {
  if (!roomState[roomCode]) return;

  const room = roomState[roomCode];
  const currentStateData = {
    players: room.players.map(p => ({ // Send public player info
      user_id: p.user.user_id,
      username: p.user.username,
      balance: p.user.balance, // Maybe send chip count later
      avatar_url: p.user.avatar_url,
      // Add game-specific info like 'isTurn', 'betAmount', etc. later
    })),
    settings: room.settings,
    gameState: {
      status: room.gameState?.status || 'waiting', // 'waiting', 'countdown', 'dealing', 'playing', 'finished'
      countdown: room.gameState?.countdown,
      communityCards: room.gameState?.communityCards || [],
      pot: room.gameState?.pot || 0,
      // DON'T send hole cards here
    },
  };

  // Send general state to everyone
  io.to(roomCode).emit('updateRoomState', currentStateData);

  // Send private hole cards to each player individually
  if (room.gameState?.status === 'dealing' || room.gameState?.status === 'playing') {
    room.players.forEach(player => {
      const hand = room.gameState.hands?.[player.user.user_id] || [];
      io.to(player.socketId).emit('updateMyHand', hand);
      // console.log(`Sent hand ${JSON.stringify(hand)} to ${player.user.username}`);
    });
  }

  console.log(`Sent room update for ${roomCode}. Status: ${currentStateData.gameState.status}`);
};

// Function to start the game countdown
const startGameCountdown = (roomCode) => {
  if (!roomState[roomCode] || roomState[roomCode].gameState?.status !== 'waiting') return;

  const room = roomState[roomCode];
  // Check player count
  if (room.players.length < 2) {
    console.log(`Not enough players in ${roomCode} to start.`);
    return;
  }

  console.log(`Starting 5s countdown for room ${roomCode}...`);
  room.gameState = { status: 'countdown', countdown: 5 };
  sendFullRoomStateUpdate(roomCode); // Notify clients about countdown start

  // Clear any previous timer
  if (room.timerId) clearTimeout(room.timerId);

  room.timerId = setInterval(() => {
    if (!roomState[roomCode]) { // Room might cease to exist
        clearInterval(room.timerId);
        return;
    }

    room.gameState.countdown -= 1;
    // Send countdown update (optional, could just rely on full update)
    // io.to(roomCode).emit('countdownTick', room.gameState.countdown);

    sendFullRoomStateUpdate(roomCode); // Send update with new countdown value


    if (room.gameState.countdown <= 0) {
      clearInterval(room.timerId);
      room.timerId = null;
      console.log(`Countdown finished for ${roomCode}. Dealing cards...`);
      dealNewHand(roomCode);
    }
  }, 1000); // Update every second
};

// Function to deal a new hand
const dealNewHand = (roomCode) => {
   if (!roomState[roomCode]) return;
   const room = roomState[roomCode];

   // 1. Set status and shuffle deck
   room.gameState = {
     ...(room.gameState || {}), // Keep existing state like pot if needed
     status: 'dealing',
     deck: shuffleDeck(createDeck()),
     hands: {}, // { userId: [card1, card2] }
     communityCards: [],
     pot: 0, // Reset pot for new hand
     // Add dealer button, turn index etc. later
   };

   // 2. Deal 2 cards to each player
   room.players.forEach(player => {
     room.gameState.hands[player.user.user_id] = [
       room.gameState.deck.pop(),
       room.gameState.deck.pop(),
     ];
   });

   // 3. Update status (e.g., to 'playing' or a specific betting round)
   room.gameState.status = 'playing'; // Or 'preflop'

   // 4. Send updates (full state + private hands)
   sendFullRoomStateUpdate(roomCode);
   console.log(`Dealt cards for room ${roomCode}`);

   // TODO: Add logic for betting rounds, flop, turn, river...
   // For now, let's pretend the hand finishes immediately
   setTimeout(() => endHand(roomCode), 3000); // Simulate hand end after 3s
};

// Function to end the hand and potentially start next
const endHand = (roomCode) => {
   if (!roomState[roomCode]) return;
   const room = roomState[roomCode];

   console.log(`Hand finished in room ${roomCode}`);
   room.gameState = {
       ...(room.gameState || {}),
       status: 'finished', // Showdown or end state
       hands: {}, // Clear hands after showing? Or keep for display?
       // TODO: Determine winner, award pot
   };
   sendFullRoomStateUpdate(roomCode);

   // Clear hand-specific data but keep players/settings
   room.gameState = { status: 'waiting' }; // Reset for next hand check

   // Automatically start next hand if enough players
   setTimeout(() => {
       if (roomState[roomCode] && roomState[roomCode].players.length >= 2) {
           startGameCountdown(roomCode);
       } else if (roomState[roomCode]) {
           // Not enough players, send final waiting state
           sendFullRoomStateUpdate(roomCode);
           console.log(`Room ${roomCode} waiting for more players.`);
       }
   }, 2000); // Wait 2s before starting next countdown
};


// Function to handle player leaving/disconnecting
const handleLeaveRoom = (socket) => {
  console.log(`👋 Handling leave/disconnect for: ${socket.id}`);
  let roomCodeToUpdate = null;
  let playerLeftUsername = null;
  let remainingPlayers = 0;

  for (const roomCode in roomState) {
    const room = roomState[roomCode];
    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);

    if (playerIndex > -1) {
      playerLeftUsername = room.players[playerIndex].user.username;
      room.players.splice(playerIndex, 1);
      roomCodeToUpdate = roomCode;
      remainingPlayers = room.players.length;

      // TODO: Handle mid-game leave (e.g., fold player's hand)

      if (remainingPlayers === 0) {
        delete roomState[roomCode];
        console.log(`Room ${roomCode} is now empty and deleted.`);
      } else if (remainingPlayers < 2 && room.gameState?.status !== 'waiting') {
        // Stop game if only 1 player left
         if (room.timerId) clearInterval(room.timerId);
         room.timerId = null;
         room.gameState = { status: 'waiting' };
         console.log(`Game stopped in ${roomCode}, not enough players.`);
      }
      break;
    }
  }

  // Send update if the room still exists
  if (roomCodeToUpdate && roomState[roomCodeToUpdate]) {
    sendFullRoomStateUpdate(roomCodeToUpdate);
    console.log(`Player ${playerLeftUsername} left ${roomCodeToUpdate}. Remaining: ${remainingPlayers}`);
  } else if (roomCodeToUpdate) {
      console.log(`Player ${playerLeftUsername} left ${roomCodeToUpdate}, room deleted.`);
  }
};
// --- End Game State Management ---


// --- Socket.IO Connection Logic ---
io.use((socket, next) => {
  const token = socket.handshake.auth.token; // Client gửi token trong auth
  if (!token) return next(new Error('Authentication error'));
  
  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, payload) => {
    if (err) return next(new Error('Invalid token'));
    socket.user = payload; // Gán user vào socket
    next();
  });
});

io.on('connection', (socket) => {
  console.log(`User ${socket.user.username} connected`); // Giờ đã biết user

  socket.on('joinRoom', ({ roomCode, user, settings }) => {
    if (!user || !roomCode) return;

    socket.join(roomCode);

    let isSpectator = false;

    // Initialize room if it doesn't exist
    if (!roomState[roomCode]) {
      roomState[roomCode] = {
        players: [],
        settings: settings || { max_players: 4, small_blind: 1000 },
        gameState: { status: 'waiting' }, // Initial game state
        timerId: null
      };
      console.log(`Room ${roomCode} created with settings:`, roomState[roomCode].settings);
    } else {
        // Check if game is in progress for late joiners
        const currentStatus = roomState[roomCode].gameState?.status;
        if (currentStatus && currentStatus !== 'waiting' && currentStatus !== 'finished') {
            isSpectator = true;
            console.log(`User ${user.username} joins ${roomCode} as spectator.`);
            // Send spectator status immediately to this user only
            socket.emit('spectatorMode', true);
        }
    }

    const room = roomState[roomCode];

    // Add player if not already in and not spectator FOR THE GAME LOGIC (still join socket room)
    const existingPlayer = room.players.find(p => p.user.user_id === user.user_id);
    if (!existingPlayer) {
       room.players.push({ socketId: socket.id, user });
       console.log(`👤 User ${user.username} added to player list for ${roomCode}`);
    } else {
        // Update socket ID if user reconnects
        existingPlayer.socketId = socket.id;
        console.log(`User ${user.username} reconnected/updated socket ID in ${roomCode}`);
    }


    // Send the current full state to the joining user
    sendFullRoomStateUpdate(roomCode); // Sends to everyone, including newcomer

    // Trigger game start countdown if conditions met
    if (!isSpectator && room.players.length >= 2 && room.gameState?.status === 'waiting') {
      startGameCountdown(roomCode);
    }
  });

  socket.on('leaveRoom', () => {
    handleLeaveRoom(socket);
  });

  socket.on('disconnect', () => {
    handleLeaveRoom(socket);
  });

  // TODO: Add listeners for player actions (bet, check, fold)
  // socket.on('playerAction', (actionData) => { ... });
});
// --- End Socket.IO Logic ---

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Poker Server running on port ${PORT}`);

  // Initialize reward distribution scheduler
  console.log('\n🎁 Khởi tạo hệ thống phân phối phần thưởng...');
  try {
    // Khởi động scheduler (tự động catch-up + chạy theo lịch)
    RewardDistributionService.startScheduler();
    
    console.log('✅ Hệ thống phân phối phần thưởng đã được khởi tạo thành công');
  } catch (error) {
    console.error('❌ Không thể khởi tạo hệ thống phân phối phần thưởng:', error.message);
  }
});
