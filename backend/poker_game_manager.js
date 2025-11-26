// ==================== ROOM MANAGER ====================
const rooms = {};

export function createRoom(roomName) {
  const roomId = Math.random().toString(36).substring(2, 8);
  rooms[roomId] = {
    roomId,
    name: roomName,
    players: [],
    chat: [],
    deck: [],
    gameState: {
      stage: "waiting", // waiting | preflop | flop | turn | river | showdown
      pot: 0,
      currentBet: 0,
      minRaise: 10,
      toAct: null,
      community: [],
      lastAction: null,
      toAct: null,          // socket.id of in turn player
      currentPlayerIndex: 0, // index of in turn player
      dealerIndex: -1,
    },
  };
  return roomId;
}

export function getRoom(roomId) {
  return rooms[roomId];
}

export function joinRoom(roomId, socketId, username) {
  const room = rooms[roomId];
  if (!room) return null;
  const player = {
    id: socketId,
    username,
    chips: 1000,
    cards: [],
    folded: false,
  };
  room.players.push(player);
  return room;
}

export function leaveRoom(socketId) {
  for (const room of Object.values(rooms)) {
    room.players = room.players.filter((p) => p.id !== socketId);
  }
}

// ------------------ GAME FLOW ------------------
export function startGame(room, io) {
  room.deck = shuffleDeck(generateDeck());
  room.gameState.stage = "preflop";
  room.gameState.community = [];
  room.gameState.pot = 0;
  room.gameState.currentBet = 0;

  // Reset players
  room.players.forEach((p) => {
    p.cards = [room.deck.pop(), room.deck.pop()];
    p.folded = false;
    p.betThisRound = 0;
  });

  // Blind bets
  const numPlayers = room.players.length;
  if (numPlayers >= 2) {
    // Dealer change seat
    room.gameState.dealerIndex = (room.gameState.dealerIndex + 1) % numPlayers;

    const sbIndex = (room.gameState.dealerIndex + 1) % numPlayers;
    const bbIndex = (room.gameState.dealerIndex + 2) % numPlayers;

    const smallBlind = 10;
    const bigBlind = 20;
    console.log(`sb: ${sbIndex} bb: ${bbIndex} `);
    room.players[sbIndex].chips -= smallBlind;
    room.players[sbIndex].betThisRound = smallBlind;

    room.players[bbIndex].chips -= bigBlind;
    room.players[bbIndex].betThisRound = bigBlind;

    room.gameState.pot = smallBlind + bigBlind;
    room.gameState.currentBet = bigBlind;

    room.gameState.currentPlayerIndex = (bbIndex + 1) % numPlayers;
    room.gameState.toAct = room.players[room.gameState.currentPlayerIndex].id;
  }

  broadcastGameState(room, io);

  // Send private hole card
  room.players.forEach((p) => {
    io.to(p.id).emit("game:holeCards", { cards: p.cards });
  });

  return room;
}

export function advanceTurn(room) {
  if (room.players.length === 0) return;

  let idx = room.gameState.currentPlayerIndex;
  let nextIdx = (idx + 1) % room.players.length;

  while (room.players[nextIdx].folded || room.players[nextIdx].chips === 0) {
    nextIdx = (nextIdx + 1) % room.players.length;
    if (nextIdx === idx) break;
  }

  room.gameState.currentPlayerIndex = nextIdx;
  room.gameState.toAct = room.players[nextIdx].id;
}

export function checkAdvanceStage(room, io) {
  const activePlayers = room.players.filter(p => !p.folded && p.chips > 0);

  if (activePlayers.length === 1) {
    room.gameState.stage = "showdown";
    resolveShowdown(room, io);
    return true;
  }

  const allCalled = activePlayers.every(p => p.betThisRound === room.gameState.currentBet);
  if (allCalled) {
    nextStage(room, io);
    return true;
  }

  return false;
}

export function nextStage(room, io) {
  const stageOrder = ["preflop", "flop", "turn", "river"];
  const idx = stageOrder.indexOf(room.gameState.stage);

  if (idx === -1 || idx === stageOrder.length - 1) {
    room.gameState.stage = "showdown";
  } else {
    room.gameState.stage = stageOrder[idx + 1];
    if (room.gameState.stage === "flop") {
      room.gameState.community.push(room.deck.pop(), room.deck.pop(), room.deck.pop());
    } else {
      room.gameState.community.push(room.deck.pop());
    }
  }

  room.players.forEach(p => p.betThisRound = 0);
  room.gameState.currentBet = 0;

  // set to act player after dealer
  room.gameState.currentPlayerIndex = (room.gameState.dealerIndex + 1) % room.players.length;
  room.gameState.toAct = room.players[room.gameState.currentPlayerIndex].id;

  broadcastGameState(room, io);

  if (room.gameState.stage === "showdown") {
    resolveShowdown(room, io);
  }

  return room;
}

// ==================== UTILITIES ====================

function generateDeck() {
  const suits = ["S", "H", "D", "C"];
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
  const deck = [];
  for (const r of ranks) for (const s of suits) deck.push(`${r}${s}`);
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function broadcastGameState(room, io) {
  const publicPlayers = room.players.map((p) => ({
    id: p.id,
    username: p.username,
    chips: p.chips,
    folded: p.folded,
  }));

  // Update sbIndex & bbIndex
  const sbIndex = room.gameState.sbIndex ?? null;
  const bbIndex = room.gameState.bbIndex ?? null;

  io.to(room.roomId).emit("game:update", {
    gameState: room.gameState,
    players: publicPlayers,
  });
}

// ==================== HAND EVALUATION ====================

import pkg from "pokersolver";
const { Hand } = pkg;

export function resolveShowdown(room, io) {
  const activePlayers = room.players.filter(p => !p.folded);
  if (activePlayers.length === 0) return;

  const results = activePlayers.map(p => {
    const fullHand = [...p.cards, ...room.gameState.community];
    const hand = Hand.solve(fullHand);
    return { player: p, hand };
  });

  const winners = Hand.winners(results.map(r => r.hand));
  const winnerPlayers = results.filter(r => winners.includes(r.hand)).map(r => r.player);

  const potShare = room.gameState.pot / winnerPlayers.length;
  winnerPlayers.forEach(p => (p.chips += potShare));

  const reveal = room.players.map(p => ({
    username: p.username,
    cards: p.cards,
    folded: p.folded,
  }));

  io.to(room.roomId).emit("game:showdown", {
    reveal,
    winners: winnerPlayers.map(p => p.username),
  });

  room.gameState.stage = "waiting";
  room.gameState.pot = 0;
  broadcastGameState(room, io);

  return winnerPlayers;
}