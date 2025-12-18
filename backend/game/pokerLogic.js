import pokersolver from 'pokersolver';
import db from '../model/DatabaseConnection.js';
const { Hand } = pokersolver;

const SB_AMOUNT = 50;
const BB_AMOUNT = 100;

const SUITS = ['s', 'h', 'd', 'c'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

/* ------------------------------ Helpers ------------------------------ */

function generateDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(rank + suit);
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

function nextOccupiedSeat(seats, currentSeatIdx) {
  const len = seats.length;
  let idx = currentSeatIdx;
  for (let i = 0; i < len; i++) {
    idx = (idx + 1) % len;
    const player = seats[idx];
    if (player && player.inHand && player.chips > 0) return idx;
  }
  return -1;
}

/* ------------------------------ Game Flow ------------------------------ */

export function startGame(room, io) {
  let activeCount = 0;
  
  room.seats.forEach(p => {
      if (p) {
          if (p.chips > 0) {
              p.inHand = true;
              activeCount++;
          } else {
              p.inHand = false;
          }
      }
  });

  if (activeCount < 2) return false;

  room.deck = shuffleDeck(generateDeck());
  room.gameState = {
    ...room.gameState,
    status: "playing",
    stage: "preflop",
    community: [],
    pot: 0,
    currentBet: 0,
    lastAction: null,
    roundStarterSeat: null,
    minRaise: BB_AMOUNT,
    winners: [] 
  };
  room.sidePots = [];

  room.seats.forEach(p => {
    if (p && p.inHand) {
      p.cards = [room.deck.pop(), room.deck.pop()];
      p.folded = false;
      p.betThisRound = 0;
      p.totalBet = 0;
      p.allIn = false;
      p.isActing = false;
      p.handName = null; 
    }
  });

  const len = room.seats.length;
  let dealer = room.gameState.dealerSeat ?? -1;
  for (let i = 0; i < len; i++) {
    dealer = (dealer + 1) % len;
    const p = room.seats[dealer];
    if (p && p.inHand) break;
  }
  room.gameState.dealerSeat = dealer;

  const sbSeat = nextOccupiedSeat(room.seats, dealer);
  const bbSeat = nextOccupiedSeat(room.seats, sbSeat);

  const sbPlayer = room.seats[sbSeat];
  const actualSB = Math.min(sbPlayer.chips, SB_AMOUNT);
  sbPlayer.chips -= actualSB;
  sbPlayer.betThisRound = actualSB;
  sbPlayer.totalBet = actualSB;
  if (sbPlayer.chips === 0) sbPlayer.allIn = true;

  const bbPlayer = room.seats[bbSeat];
  const actualBB = Math.min(bbPlayer.chips, BB_AMOUNT);
  bbPlayer.chips -= actualBB;
  bbPlayer.betThisRound = actualBB;
  bbPlayer.totalBet = actualBB;
  if (bbPlayer.chips === 0) bbPlayer.allIn = true;

  room.gameState.pot = actualSB + actualBB;
  room.gameState.currentBet = actualBB;

  const firstToActSeat = nextOccupiedSeat(room.seats, bbSeat);
  
  room.gameState.toActSeat = firstToActSeat;
  room.gameState.roundStarterSeat = firstToActSeat; 

  return true;
}

export function advanceTurn(room) {
  const len = room.seats.length;
  let idx = room.gameState.toActSeat ?? 0;
  let attempts = 0;
  let nextIdx = (idx + 1) % len;
  
  while (attempts < len) {
    const p = room.seats[nextIdx];
    if (p && p.inHand && !p.folded && !p.allIn) {
      room.gameState.toActSeat = nextIdx;
      return;
    }
    nextIdx = (nextIdx + 1) % len;
    attempts++;
  }
  room.gameState.toActSeat = null;
}

// Hàm mới: Tự động chạy hết các vòng khi All-in
async function autoRunToShowdown(room, io, broadcastFunc, onGameEnd) {
    const stages = ["preflop", "flop", "turn", "river", "showdown"];
    
    // Hàm đệ quy để chạy từng stage có delay (tạo hiệu ứng chia bài)
    const runNextStep = async () => {
        const currentStage = room.gameState.stage;
        
        if (currentStage === 'finished' || currentStage === 'showdown') {
            return; // Đã xong
        }

        // Chuyển sang stage tiếp theo
        await nextStage(room, io, broadcastFunc, onGameEnd);

        // Nếu chưa xong (chưa đến showdown), tiếp tục gọi đệ quy sau 1s
        if (room.gameState.stage !== 'finished') {
            setTimeout(async () => {
                await runNextStep();
            }, 1500); // Delay 1.5s giữa các lần chia bài
        }
    };

    // Bắt đầu chạy
    await runNextStep();
}

export async function checkAdvanceStage(room, io, broadcastFunc, onGameEnd) {
  const activePlayers = room.seats.filter(p => p && p.inHand && !p.folded);
  
  if (activePlayers.length === 1) {
    await resolveShowdown(room, io, broadcastFunc, onGameEnd);
    return true;
  }

  const allCalled = activePlayers.every(p => {
    return p.allIn || p.betThisRound === room.gameState.currentBet;
  });

  const nextSeat = room.gameState.toActSeat;
  const isRoundComplete = allCalled && (nextSeat === room.gameState.roundStarterSeat || nextSeat === null);

  if (isRoundComplete) {
    // *** LOGIC ALL-IN MỚI ***
    // Kiểm tra số người còn có thể hành động (chưa all-in)
    const playersWithChips = activePlayers.filter(p => !p.allIn).length;

    // Nếu tất cả đã all-in HOẶC chỉ còn 1 người có tiền (còn lại all-in)
    // => Không ai có thể cược thêm nữa -> Auto Run
    if (playersWithChips <= 1) {
        room.gameState.lastAction = "All-in! Chia bài...";
        room.gameState.toActSeat = null; // Khóa lượt đi
        broadcastFunc(io, room.roomCode || room.roomId);
        
        // Gọi hàm tự động chia bài
        setTimeout(() => {
          autoRunToShowdown(room, io, broadcastFunc, onGameEnd).catch(err => console.error('autoRunToShowdown error', err));
        }, 1000);
        return true;
    }

    await nextStage(room, io, broadcastFunc, onGameEnd);
    return true;
  }

  return false;
}

export async function nextStage(room, io, broadcastFunc, onGameEnd) {
  const order = ["preflop", "flop", "turn", "river", "showdown"];
  const currentIdx = order.indexOf(room.gameState.stage);
  
  if (currentIdx === -1 || currentIdx === order.length - 1) {
    await resolveShowdown(room, io, broadcastFunc, onGameEnd);
    return;
  }

  const nextStageName = order[currentIdx + 1];
  room.gameState.stage = nextStageName;

  if (nextStageName === "flop") {
    room.gameState.community.push(room.deck.pop(), room.deck.pop(), room.deck.pop());
  } else if (nextStageName === "turn" || nextStageName === "river") {
    room.gameState.community.push(room.deck.pop());
  } else if (nextStageName === "showdown") {
    await resolveShowdown(room, io, broadcastFunc, onGameEnd);
    return;
  }

  room.seats.forEach(p => {
    if (p && p.inHand) p.betThisRound = 0;
  });
  room.gameState.currentBet = 0;
  room.gameState.minRaise = BB_AMOUNT; 

  const starter = nextOccupiedSeat(room.seats, room.gameState.dealerSeat);
  room.gameState.toActSeat = starter;
  room.gameState.roundStarterSeat = starter;

  broadcastFunc(io, room.roomCode || room.roomId);
}

// handleAction giữ nguyên logic cũ, không thay đổi gì ở đây
export async function handleAction(room, socketId, action, opts = {}, io, broadcastFunc, onGameEnd) {
  if (room.gameState.status === 'finished') return;

  const seatIdx = room.seats.findIndex(p => p && p.socketId === socketId);
  if (seatIdx === -1) return;

  const player = room.seats[seatIdx];

  if (!player.inHand) {
      io.to(socketId).emit("error", { message: "Bạn không tham gia ván này!" });
      return;
  }

  if (room.gameState.toActSeat !== seatIdx) {
    io.to(socketId).emit("error", { message: "Chưa đến lượt của bạn!" });
    return;
  }

  switch (action) {
    case "fold":
      player.folded = true;
      room.gameState.lastAction = `${player.username} Bỏ bài`;
      break;

    case "check":
      if (player.betThisRound < room.gameState.currentBet) {
        io.to(socketId).emit("error", { message: "Phải Call hoặc Raise!" });
        return;
      }
      room.gameState.lastAction = `${player.username} Xem bài`;
      break;

    case "call": {
      const amountToCall = room.gameState.currentBet - player.betThisRound;
      const actualAmount = Math.min(amountToCall, player.chips);
      
      player.chips -= actualAmount;
      player.betThisRound += actualAmount;
      player.totalBet += actualAmount;
      room.gameState.pot += actualAmount;
      
      if (player.chips === 0) player.allIn = true;
      room.gameState.lastAction = `${player.username} Theo ${actualAmount}`;
      break;
    }

    case "raise": {
      const amount = Number(opts.amount); 
      if (amount < room.gameState.currentBet + room.gameState.minRaise) {}
      
      const added = amount - player.betThisRound;
      if (added > player.chips) return;

      player.chips -= added;
      player.betThisRound = amount;
      player.totalBet += added;
      room.gameState.pot += added;
      
      const raiseDiff = amount - room.gameState.currentBet;
      if (raiseDiff > 0) room.gameState.minRaise = raiseDiff; 
      room.gameState.currentBet = amount;
      
      room.gameState.roundStarterSeat = seatIdx; 
      room.gameState.lastAction = `${player.username} Tố lên ${amount}`;
      break;
    }
    
    case "allin": {
       const amount = player.chips;
       player.chips = 0;
       
       const totalBetAfterAllIn = player.betThisRound + amount;
       
       player.betThisRound = totalBetAfterAllIn;
       player.totalBet += amount;
       room.gameState.pot += amount;
       player.allIn = true;
       
       if (totalBetAfterAllIn > room.gameState.currentBet) {
           const raiseDiff = totalBetAfterAllIn - room.gameState.currentBet;
           if (raiseDiff >= room.gameState.minRaise) {
               room.gameState.minRaise = raiseDiff;
               room.gameState.roundStarterSeat = seatIdx;
           }
           room.gameState.currentBet = totalBetAfterAllIn;
       }
       
       room.gameState.lastAction = `${player.username} Tất tay ${amount}`;
       break;
    }
  }

  advanceTurn(room);
  
  const changedStage = await checkAdvanceStage(room, io, broadcastFunc, onGameEnd);
  
  if (!changedStage) {
      broadcastFunc(io, room.roomCode || room.roomId);
  }
}

async function computeEloChanges(winner_ids, user_ids) {
  // --- Save ELO adjustments and Game_History in a single transaction ---
  let deltas = {};

  // Use DB transaction helper from DatabaseConnection.js
  let txConn = null;
  try {
    // start transaction
    txConn = await db.beginTransaction();
    const rows = await db.transactionQuery(txConn, `SELECT user_id, elo FROM User WHERE user_id IN (${user_ids.map(() => '?').join(',')})`, user_ids);
    const eloMap = {};
    rows.forEach(r => { eloMap[r.user_id] = Number(r.elo || 0); });

    const clampCelo = (val) => {
      const v = Math.round(val);
      if (v < 15) return 15;
      if (v > 30) return 30;
      return v;
    };
    // compute deltas
    deltas = {};
    user_ids.forEach(p => { deltas[p] = 0; });

    for (const winnerId of winner_ids) {
      const eloW = eloMap[winnerId] || 0;
      let totalGainForWinner = 0;
      for (const loserId of user_ids) {
        if (winner_ids.includes(loserId)) continue;
        const eloL = eloMap[loserId] || 0;
        const base = (eloL - eloW) / 4.0;
        const celo = clampCelo(base);
        const gain = Math.round(celo);
        const loss = Math.round(Math.floor(0.8 * gain));
        totalGainForWinner += gain;
        deltas[loserId] -= loss; // each loser loses 80% of the gain vs this winner
      }
      deltas[winnerId] += totalGainForWinner;
    }
    // Apply DB updates within transaction
    for (const uid of Object.keys(deltas)) {
      const delta = deltas[uid];
      if (delta === 0) continue;
      await db.transactionQuery(txConn, 'UPDATE User SET elo = COALESCE(elo,0) + ? WHERE user_id = ?', [delta, uid]);
    }
    await db.commit(txConn);
    return deltas;
  } catch (err) {
    if (txConn) {
      await db.rollback(txConn);
      console.error('ELO Debug: transaction rolled back due to error', err);
    }
    throw err;
  } 
}
async function saveGameHistory(tableId, deltas) {
  const result = Object.keys(deltas).join(' ');
  const eloChange = Object.values(deltas).join(' ');
  await db.query('INSERT INTO Game_History (table_id, result, elo_change) VALUES (?, ?, ?)', [tableId, result, eloChange]);
}
export async function resolveShowdown(room, io, broadcastFunc, onGameEnd) {
  room.gameState.stage = "finished";
  room.gameState.status = "finished";
  room.gameState.toActSeat = null; 
  const activePlayers = room.seats.filter(p => p && p.inHand && !p.folded);
  const userIds = room.seats.filter(p => p).map(p => p.user_id);

  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    winner.chips += room.gameState.pot;
    room.gameState.lastAction = `${winner.username} thắng ${room.gameState.pot} (địch thủ bỏ bài)`;

    io.to(room.roomCode || room.roomId).emit('game:result', {
        winners: [{ userId: winner.user_id, amount: room.gameState.pot, handName: 'Thắng do bỏ bài' }]
    });

    const winnerIds = [winner.user_id];
    const deltas = await computeEloChanges(winnerIds, userIds);
    await saveGameHistory(room.roomCode, deltas);
    broadcastFunc(io, room.roomCode || room.roomId);
    if (onGameEnd) await onGameEnd(); 
    return;
  }

  // Solve hands
  const hands = activePlayers.map(p => {
    const cards = [...p.cards, ...room.gameState.community];
    const solved = Hand.solve(cards);
    solved.playerIndex = room.seats.indexOf(p);
    return solved;
  });

  const winners = Hand.winners(hands);
  const winAmount = Math.floor(room.gameState.pot / winners.length);
  const winnerDetails = [];
    
  // award chips (same as before)
  winners.forEach(hand => {
    const seatIdx = hand.playerIndex;
    const player = room.seats[seatIdx];
    player.chips += winAmount;
    player.handName = hand.name; 

    winnerDetails.push({
        userId: player.user_id,
        username: player.username,
        amount: winAmount,
        handName: hand.name, 
        description: hand.descr
    });
  });

  const winnerIds = winners.map(h => {
    const p = room.seats[h.playerIndex];
    return p.user_id;
  });
  const deltas = await computeEloChanges(winnerIds, userIds);
  await saveGameHistory(room.roomCode, deltas);
  room.gameState.lastAction = `Ván đấu kết thúc. ${winnerDetails.map(w => w.username).join(', ')} thắng!`;

  io.to(room.roomCode || room.roomId).emit('game:result', {
      winners: winnerDetails
  });
  
  broadcastFunc(io, room.roomCode || room.roomId);
  if (onGameEnd) await onGameEnd();
}