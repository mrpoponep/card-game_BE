import pokersolver from 'pokersolver';
const { Hand } = pokersolver;
import db from '../backend/model/DatabaseConnection.js';
import { resolveShowdown } from '../backend/game/pokerLogic.js';

// Setup deterministic test data
const eloMap = {};
let lastInsert = null;

// Mock db.query
db.query = async (sql, params = []) => {
  const s = sql.trim().toUpperCase();

  if (s.startsWith('SELECT') && s.includes('ELO FROM USER')) {
    // return rows for each user_id param
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

  // fallback
  return [];
};

// Force deterministic winner: always first hand
Hand.winners = (hands) => [hands[0]];
// solve can be default; pokerLogic sets playerIndex itself

function randCard() {
  const suits = ['s','h','d','c'];
  const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
  return ranks[Math.floor(Math.random()*ranks.length)] + suits[Math.floor(Math.random()*suits.length)];
}

async function testInsert() {
  // Create room with 3 active players
  const room = {
    roomCode: 'TEST',
    roomId: 'TEST',
    settings: { table_id: 42 },
    seats: new Array(6).fill(null),
    gameState: { community: [randCard(), randCard(), randCard(), randCard(), randCard()], pot: 900 }
  };

  const players = [ {uid: 1, name: 'A'}, {uid:2, name: 'B'}, {uid:3, name: 'C'} ];

  // initial elos (close to each other)
  eloMap[1] = 1500;
  eloMap[2] = 1520;
  eloMap[3] = 1490;

  for (let i=0;i<3;i++) {
    room.seats[i] = {
      user_id: players[i].uid,
      username: players[i].name,
      chips: 1000,
      inHand: true,
      folded: false,
      cards: [randCard(), randCard()]
    };
  }

  // Run resolveShowdown
  await resolveShowdown(room, { to: () => ({ emit: () => {} }) }, () => {}, () => {});

  if (!lastInsert) {
    console.error('FAIL: No Game_History INSERT captured');
    process.exit(1);
  }

  const [tableId, resultStr, eloStr] = lastInsert.params;

  console.log('Captured INSERT into Game_History:');
  console.log(' table_id:', tableId);
  console.log(' result:', resultStr);
  console.log(' elo_change:', eloStr);

  // Expected: winner is first seat (user 1)
  const expectedResult = '1 2 3';

  // Compute expected ELO changes manually according to algorithm in code
  // For winner (1): vs 2 -> base=(1520-1500)/4=5 -> clamp->15 => gain=15, loser loss=floor(0.8*15)=12
  // vs 3 -> base=(1490-1500)/4=-2.5 -> round -2 -> clamp->15 => gain=15, loser loss=12
  // winner total = 30, losers -12 each
  const expectedElo = '30 -12 -12';

  if (resultStr !== expectedResult) {
    console.error('FAIL: unexpected result order. got:', resultStr, 'expected:', expectedResult);
    process.exit(1);
  }

  if (eloStr !== expectedElo) {
    console.error('FAIL: unexpected elo_change. got:', eloStr, 'expected:', expectedElo);
    process.exit(1);
  }

  console.log('PASS: Game_History insert matches expected result and elo_change');
  process.exit(0);
}

testInsert();
