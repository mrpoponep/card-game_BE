import pokersolver from 'pokersolver';
const { Hand } = pokersolver;

// Mock DB module before importing pokerLogic
import db from '../backend/model/DatabaseConnection.js';

// In-memory ELO store for test users
const initialEloMap = {};

// Setup mock query handler
db.query = async (sql, params = []) => {
  const s = sql.trim().toUpperCase();
  if (s.startsWith('SELECT') && s.includes('ELO FROM USER')) {
    // params are user ids
    const rows = params.map(id => ({ user_id: id, elo: initialEloMap[id] }));
    return rows;
  }
  if (s.startsWith('UPDATE USER SET ELO')) {
    // params = [delta, user_id]
    const [delta, uid] = params;
    initialEloMap[uid] = (initialEloMap[uid] || 0) + Number(delta);
    return { affectedRows: 1 };
  }
  // Fallback
  return [];
};

// Mock Hand.solve and Hand.winners to pick a random winner for test simplicity
Hand.solve = (cards) => ({ name: 'MockHand', descr: 'mock' });
Hand.winners = (hands) => {
  if (!Array.isArray(hands) || hands.length === 0) return [];
  // choose 1..n winners randomly (but usually 1)
  const winnerCount = 1; // keep simple: single winner
  const idx = Math.floor(Math.random() * hands.length);
  return [hands[idx]];
};

// Now import the resolveShowdown from the poker logic
import { resolveShowdown } from '../backend/game/pokerLogic.js';

// Helper to create random card strings (not important because we mock Hand)
function randCard() {
  const suits = ['s','h','d','c'];
  const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
  return ranks[Math.floor(Math.random()*ranks.length)] + suits[Math.floor(Math.random()*suits.length)];
}

async function runSimulation(playerCount = 4) {
  if (playerCount < 2) playerCount = 2;
  if (playerCount > 6) playerCount = 6;

  // Build room
  const room = {
    roomCode: 'TESTROOM',
    roomId: 'TESTROOM',
    seats: new Array(6).fill(null),
    gameState: {
      community: [randCard(), randCard(), randCard(), randCard(), randCard()],
      pot: 1000
    }
  };

  // Create players in first playerCount seats
  for (let i = 0; i < playerCount; i++) {
    const uid = 1000 + i;
    // ELO random near 1500
    initialEloMap[uid] = 1500 + Math.floor((Math.random() - 0.5) * 200);
    room.seats[i] = {
      user_id: uid,
      username: `P${i+1}`,
      chips: 1000,
      inHand: true,
      folded: false,
      cards: [randCard(), randCard()]
    };
  }

  // Print initial ELOs
  console.log('Initial ELOs:');
  for (let i = 0; i < playerCount; i++) {
    const s = room.seats[i];
    console.log(`  ${s.username} (${s.user_id}): ${initialEloMap[s.user_id]}`);
  }

  // Stubs for io and broadcast
  const io = { to: () => ({ emit: (e,p) => console.log('EMIT', e, p) }) };
  const broadcastFunc = (ioArg, code) => console.log('broadcast room', code);
  const onGameEnd = () => console.log('onGameEnd called');

  // Call resolveShowdown
  await resolveShowdown(room, io, broadcastFunc, onGameEnd);

  // Print final ELOs
  console.log('\nFinal ELOs:');
  for (let i = 0; i < playerCount; i++) {
    const s = room.seats[i];
    console.log(`  ${s.username} (${s.user_id}): ${initialEloMap[s.user_id]}`);
  }
}

// Run multiple simulations
(async () => {
  console.log('Running ELO simulation tests...');
  for (let n = 2; n <= 6; n++) {
    console.log(`\n--- Simulation with ${n} players ---`);
    await runSimulation(n);
  }
})();
