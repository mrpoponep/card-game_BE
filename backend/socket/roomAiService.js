import * as PokerGameAI from '../game/pokerLogicAI.js';
import fetch from 'node-fetch';

const AI_BOT_URL = process.env.AI_BOT_URL || 'http://localhost:8000';

const aiRooms = {}; // key: roomCode = `AI-<userId>`

function getRoomCodeForUser(userId) {
  return `AI-${userId}`;
}

function sendFullRoomStateUpdate(io, roomCode) {
  const room = aiRooms[roomCode];
  if (!room) return;

  const publicSeats = room.seats.map((seat, index) => {
    if (!seat) return null;

    let publicCards = null;
    if (room.gameState?.status === 'finished' && seat.cards && seat.cards.length > 0) {
      publicCards = seat.cards.map(c => ({ rank: c[0], suit: c[1].toUpperCase() }));
    }

    return {
      user_id: seat.user_id,
      username: seat.username,
      chips: seat.chips || 0,
      betThisRound: seat.betThisRound || 0,
      totalBet: seat.totalBet || 0,
      folded: seat.folded || false,
      allIn: seat.allIn || false,
      isActing: room.gameState?.toActSeat === index,
      cards: publicCards,
      handName: seat.handName,
      inHand: seat.inHand || false
    };
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

  io.to(roomCode).emit('ai:updateRoomState', currentStateData);

  const showHand = ['playing', 'preflop', 'flop', 'turn', 'river'].includes(room.gameState?.status);
  if (showHand) {
    room.seats.forEach(seat => {
      if (seat && seat.cards) {
        const formattedHand = seat.cards.map(c => ({ rank: c[0], suit: c[1].toUpperCase() }));
        // Only send to human player
        if (seat.isHuman) io.to(seat.socketId).emit('ai:updateMyHand', formattedHand);
      }
    });
  }
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

function startGameCountdown(io, roomCode) {
  const room = aiRooms[roomCode];
  if (!room) return;

  // Need both players with chips
  const readyPlayers = room.seats.filter(p => p && p.chips > 0);
  if (readyPlayers.length < 2) {
    resetRoomToWaiting(room);
    sendFullRoomStateUpdate(io, roomCode);
    return;
  }

  room.gameState.status = 'countdown';
  room.gameState.countdown = 5;
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

  if (room.timerId) clearInterval(room.timerId);
  room.timerId = setInterval(() => {
    if (!aiRooms[roomCode]) {
      clearInterval(room.timerId);
      return;
    }
    room.gameState.countdown -= 1;
    sendFullRoomStateUpdate(io, roomCode);

    if (room.gameState.countdown <= 0) {
      clearInterval(room.timerId);
      room.timerId = null;
      room.roomCode = roomCode;
      const started = PokerGameAI.startGame(room, io);
      if (started) {
        room.gameState.status = 'playing';
        sendFullRoomStateUpdate(io, roomCode);
        // If AI to act, perform move
        setTimeout(() => { checkAndMakeAIMove(io, roomCode); }, 500);
      } else {
        resetRoomToWaiting(room);
        sendFullRoomStateUpdate(io, roomCode);
      }
    }
  }, 1000);
}

async function onGameEnd(io, roomCode) {
  const room = aiRooms[roomCode];
  if (!room) return;

  // After 5s, start new game or force leave if out of chips
  setTimeout(() => {
    const human = room.seats.find(s => s && s.isHuman);
    if (!human || human.chips <= 0) {
      io.to(roomCode).emit('ai:forceLeave', { reason: 'Hết tiền ảo, vui lòng vào lại để reset 50k.' });
      // Cleanup
      try { io.socketsLeave(roomCode); } catch {}
      delete aiRooms[roomCode];
      return;
    }

    if (aiRooms[roomCode]) {
      resetRoomToWaiting(room);
      sendFullRoomStateUpdate(io, roomCode);
      startGameCountdown(io, roomCode);
    }
  }, 5000);
}

async function callBotDecision(room, aiSeat) {
  const state = {
    hole: aiSeat.cards || [],
    board: room.gameState.community || [],
    pot: room.gameState.pot || 0,
    to_call: Math.max(0, (room.gameState.currentBet || 0) - (aiSeat.betThisRound || 0)),
    min_raise: room.gameState.minRaise || 0,
    stack: aiSeat.chips || 0,
    stage: room.gameState.stage || 'flop'
  };

  try {
    const res = await fetch(`${AI_BOT_URL}/bot_action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    const data = await res.json();
    return data?.decision || { action: 'check', amount: 0 };
  } catch (e) {
    console.warn('AI bot decision error:', e.message);
    return { action: 'check', amount: 0 };
  }
}

async function checkAndMakeAIMove(io, roomCode) {
  const room = aiRooms[roomCode];
  if (!room) return;

  const aiIndex = room.seats.findIndex(s => s && s.isAI);
  if (aiIndex === -1) return;

  if (room.gameState.toActSeat !== aiIndex) return; // not AI turn

  const aiSeat = room.seats[aiIndex];
  if (!aiSeat || aiSeat.folded || !aiSeat.inHand) return;

  const decision = await callBotDecision(room, aiSeat);
  const action = decision.action;
  const amount = decision.amount || 0;

  PokerGameAI.handleAction(
    room,
    aiSeat.socketId,
    action,
    { amount },
    io,
    (ioArg, roomId) => {
      // broadcast
      sendFullRoomStateUpdate(ioArg, roomCode);
    },
    () => onGameEnd(io, roomCode)
  );

  // After AI acts, if still AI turn later (e.g., re-raise needed), chain next
  setTimeout(() => { checkAndMakeAIMove(io, roomCode); }, 400);
}

export function register(io, socket) {
  socket.on('ai:joinRoom', () => {
    const user = socket.user;
    if (!user) return;

    const roomCode = getRoomCodeForUser(user.user_id);
    socket.join(roomCode);

    if (!aiRooms[roomCode]) {
      aiRooms[roomCode] = {
        seats: Array(2).fill(null),
        settings: { max_players: 2, small_blind: 100 },
        gameState: { status: 'waiting' },
        timerId: null,
        roomCode
      };

      aiRooms[roomCode].seats[0] = {
        socketId: socket.id,
        user_id: user.user_id,
        username: user.username,
        chips: 50000,
        inHand: false,
        isHuman: true
      };

      aiRooms[roomCode].seats[1] = {
        socketId: `AI_SOCKET_${user.user_id}`,
        user_id: `AI_${user.user_id}`,
        username: 'AI Bot',
        chips: 999999999,
        inHand: false,
        isAI: true
      };
    } else {
      // Rejoin: reset human chips to 50k
      const room = aiRooms[roomCode];
      const human = room.seats[0];
      if (human) {
        human.socketId = socket.id;
        human.chips = 50000;
        human.inHand = false;
      } else {
        room.seats[0] = {
          socketId: socket.id,
          user_id: user.user_id,
          username: user.username,
          chips: 50000,
          inHand: false,
          isHuman: true
        };
      }
    }

    const room = aiRooms[roomCode];
    sendFullRoomStateUpdate(io, roomCode);

    // Start if waiting
    if (room.gameState?.status === 'waiting') {
      startGameCountdown(io, roomCode);
    }
  });

  socket.on('ai:leaveRoom', (callback) => {
    const user = socket.user;
    if (!user) { if (typeof callback === 'function') callback(); return; }
    const roomCode = getRoomCodeForUser(user.user_id);
    const room = aiRooms[roomCode];
    if (room) {
      // remove human seat
      room.seats[0] = null;
      try { socket.leave(roomCode); } catch {}
      // if no human, clean up
      delete aiRooms[roomCode];
    }
    if (typeof callback === 'function') callback();
  });

  socket.on('disconnect', () => {
    // Treat as leave
    const user = socket.user;
    if (!user) return;
    const roomCode = getRoomCodeForUser(user.user_id);
    const room = aiRooms[roomCode];
    if (room) {
      room.seats[0] = null;
      delete aiRooms[roomCode];
    }
  });

  socket.on('ai:playerAction', ({ action, amount }) => {
    const user = socket.user;
    if (!user) return;
    const roomCode = getRoomCodeForUser(user.user_id);
    const room = aiRooms[roomCode];
    if (!room) return;

    PokerGameAI.handleAction(
      room,
      socket.id,
      action,
      { amount },
      io,
      (ioArg, roomId) => { sendFullRoomStateUpdate(ioArg, roomCode); },
      () => onGameEnd(io, roomCode)
    );

    // After player acts, if AI is next, act
    setTimeout(() => { checkAndMakeAIMove(io, roomCode); }, 400);
  });
}

export { aiRooms, sendFullRoomStateUpdate, startGameCountdown };
