import db from '../backend/model/DatabaseConnection.js';
import { resolveShowdown } from '../backend/game/pokerLogic.js';
import pokersolver from 'pokersolver';
const { Hand } = pokersolver;

// In-memory mock DB state
const eloMap = {};
let lastInsert = null;

// Mock db.query to intercept SELECT/UPDATE/INSERT
db.query = async (sql, params = []) => {
  const s = sql.trim().toUpperCase();
  if (s.startsWith('SELECT') && s.includes('ELO FROM USER')) {
    return params.map(id => ({ user_id: id, elo: eloMap[id] }));
  }
  if (s.startsWith('UPDATE USER SET ELO')) {
    const [delta, uid] = params;
    eloMap[uid] = (eloMap[uid] || 0) + Number(delta);
    return { affectedRows: 1 };
  }
  if (s.startsWith('INSERT INTO GAME_HISTORY')) {
    lastInsert = { sql, params };
    return { insertId: 1 };
  }
  return [];
};

// Mock pokersolver to avoid duplicate-card errors and to control winners
Hand.solve = (cards) => ({ name: 'MockHand', descr: 'mock' });
Hand.winners = (hands) => {
  // deterministic: first hand wins
  if (!Array.isArray(hands) || hands.length === 0) return [];
  return [hands[0]];
};

function randCard() {
  const suits = ['s','h','d','c'];
  const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
  return ranks[Math.floor(Math.random()*ranks.length)] + suits[Math.floor(Math.random()*suits.length)];
}

async function runCombinedTest() {
  // Build room with 3 players
  const room = {
    roomCode: 'TEST',
    roomId: 'TEST',
    settings: { table_id: 42 },
    seats: new Array(6).fill(null),
    gameState: { community: [randCard(), randCard(), randCard(), randCard(), randCard()], pot: 900 }
  };

  // players and initial elos
  eloMap[1] = 1500; eloMap[2] = 1520; eloMap[3] = 1490;

  for (let i = 0; i < 3; i++) {
    room.seats[i] = {
      user_id: i+1,
      username: `P${i+1}`,
      chips: 1000,
      inHand: true,
      folded: false,
      cards: [randCard(), randCard()]
    };
  }

  // run resolveShowdown
  await resolveShowdown(room, { to: () => ({ emit: () => {} }) }, () => {}, () => {});

  if (!lastInsert) {
    console.error('FAIL: No Game_History INSERT captured');
    process.exit(1);
  }

  const [tableId, resultStr, eloStr] = lastInsert.params;
  console.log('Captured INSERT -> table_id:', tableId);
  console.log(' result:', resultStr);
  console.log(' elo_change:', eloStr);

  const expectedResult = '1 2 3';
  const expectedElo = '30 -12 -12';

  if (resultStr !== expectedResult) {
    console.error('FAIL: result mismatch. got:', resultStr, 'expected:', expectedResult);
    process.exit(1);
  }

  if (eloStr !== expectedElo) {
    console.error('FAIL: elo_change mismatch. got:', eloStr, 'expected:', expectedElo);
    process.exit(1);
  }

  console.log('PASS: Combined ELO + Game_History test');
  process.exit(0);
}

runCombinedTest();
