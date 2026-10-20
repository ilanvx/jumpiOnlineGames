import crypto from "node:crypto";

/*
  The Club's puzzle games (public/club/puzzle), played as coin rounds of routes/rewards.js.
  The server holds the board, so the page can't cheat:
  - MEMORY: 20 cards face down (10 pairs of Jumpi pictures). The page only learns a card when it flips it
    (POST /api/minigame/flip). Score: 10 a pair; finishing gives a bonus for few mistakes and for speed.
  - MATCH 3: an 8x8 board of 6 pets. Every swap goes to the server (POST /api/minigame/swap), which checks it
    makes a row of 3, clears, drops and refills (the new pieces are random here, so nobody can plan ahead)
    and sends back every step to show. 10 points a piece, more in a chain. 25 moves.
*/
const ri = (n) => crypto.randomInt(n);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---------- memory ---------- */
export const MEM = { cols: 4, rows: 5, secs: 150, gap: 180 };
// the pictures (public/club/emoji): different enough to tell apart at a glance
const MEM_PICS = ["jumpi_cool", "jumpi_love", "jumpi_party", "jumpi_king", "jumpi_police", "jumpi_bunny", "jumpi_kitty", "jumpi_sleep", "jumpi_pizza", "jumpi_star",
  "pet_dragon", "pet_panda", "pet_puppy", "pet_kitten", "food_burger", "food_icecream", "food_cottoncandy", "food_hotdog", "surfboard", "lucky_wheel", "jumpi_gift"];
export const MEM_PAIRS = (MEM.cols * MEM.rows) / 2;
export function memoryRound() {
  const pics = shuffle(MEM_PICS.slice()).slice(0, MEM_PAIRS);
  return { cards: shuffle([...pics, ...pics]), open: null, gone: new Set(), pairs: 0, misses: 0, lastFlip: 0 };
}
export function memoryFlip(round, raw, now = Date.now()) {
  const cell = Number(raw);
  if (!Number.isInteger(cell) || cell < 0 || cell >= round.cards.length) return { status: 400, error: "Pick a card." };
  if ((now - round.start) / 1000 > MEM.secs + 2) return { status: 409, error: "Time's up!" };
  if (round.gone.has(cell) || round.open === cell) return { status: 409, error: "That card is already open." };
  if (now - round.lastFlip < MEM.gap) return { status: 429, error: "Not so fast!" };
  round.lastFlip = now;
  const pic = round.cards[cell];
  if (round.open == null) { round.open = cell; return { cell, pic, pairs: round.pairs, misses: round.misses }; }
  const other = round.open, match = round.cards[other] === pic;
  round.open = null;
  if (match) { round.gone.add(cell); round.gone.add(other); round.pairs++; } else round.misses++;
  return { cell, pic, other, match, pairs: round.pairs, misses: round.misses, done: round.pairs === MEM_PAIRS };
}
export function memoryScore(round, now = Date.now()) {
  let score = round.pairs * 10;
  if (round.pairs === MEM_PAIRS) {
    const secs = (now - round.start) / 1000;
    score += Math.max(0, 60 - round.misses * 3) + Math.max(0, Math.round(MEM.secs - secs));
  }
  return score;
}

/* ---------- match 3 ---------- */
export const M3 = { cols: 8, rows: 8, kinds: 6, moves: 25, gap: 220 };
const N = M3.cols * M3.rows;
const at = (x, y) => y * M3.cols + x;
// every cell in a row (or column) of 3 or more of the same
function runs(b) {
  const hit = new Set();
  for (let y = 0; y < M3.rows; y++) for (let x = 0; x < M3.cols - 2; x++) {
    const k = b[at(x, y)]; if (k == null) continue;
    let e = x; while (e + 1 < M3.cols && b[at(e + 1, y)] === k) e++;
    if (e - x >= 2) for (let i = x; i <= e; i++) hit.add(at(i, y));
    x = e;
  }
  for (let x = 0; x < M3.cols; x++) for (let y = 0; y < M3.rows - 2; y++) {
    const k = b[at(x, y)]; if (k == null) continue;
    let e = y; while (e + 1 < M3.rows && b[at(x, e + 1)] === k) e++;
    if (e - y >= 2) for (let i = y; i <= e; i++) hit.add(at(x, i));
    y = e;
  }
  return hit;
}
const swapIn = (b, a, c) => { const t = b[a]; b[a] = b[c]; b[c] = t; };
const near = (a, c) => { const ax = a % M3.cols, ay = Math.floor(a / M3.cols), cx = c % M3.cols, cy = Math.floor(c / M3.cols); return Math.abs(ax - cx) + Math.abs(ay - cy) === 1; };
// is there any swap that makes a row?
export function hasMove(b) {
  for (let i = 0; i < N; i++) for (const j of [i + 1, i + M3.cols]) {
    if (j >= N || (j === i + 1 && j % M3.cols === 0)) continue;
    swapIn(b, i, j); const ok = runs(b).size > 0; swapIn(b, i, j);
    if (ok) return true;
  }
  return false;
}
// a fresh board: no rows yet, and at least one move
function freshBoard() {
  for (;;) {
    const b = new Array(N);
    for (let i = 0; i < N; i++) {
      const x = i % M3.cols, y = Math.floor(i / M3.cols);
      let k; do k = ri(M3.kinds); while ((x >= 2 && b[i - 1] === k && b[i - 2] === k) || (y >= 2 && b[i - M3.cols] === k && b[i - 2 * M3.cols] === k));
      b[i] = k;
    }
    if (hasMove(b)) return b;
  }
}
export function match3Round() { return { board: freshBoard(), moves: M3.moves, score: 0, lastSwap: 0 }; }
// one swap: { steps: [{ clear: [cells], add: points, board }], shuffled?: board }
export function match3Swap(round, ra, rc, now = Date.now()) {
  const a = Number(ra), c = Number(rc);
  if (!Number.isInteger(a) || !Number.isInteger(c) || a < 0 || c < 0 || a >= N || c >= N || !near(a, c)) return { status: 400, error: "Swap two pieces side by side." };
  if (round.moves <= 0) return { status: 409, error: "No moves left." };
  if (now - round.lastSwap < M3.gap) return { status: 429, error: "Not so fast!" };
  const b = round.board;
  swapIn(b, a, c);
  if (!runs(b).size) { swapIn(b, a, c); return { status: 409, error: "That doesn't make a row.", noMatch: true }; }
  round.lastSwap = now;
  round.moves--;
  const steps = [];
  for (let chain = 1; chain < 30; chain++) {
    const hit = runs(b);
    if (!hit.size) break;
    const add = hit.size * 10 * chain + (hit.size >= 5 ? 50 : hit.size >= 4 ? 20 : 0);
    round.score += add;
    for (const i of hit) b[i] = null;
    // drop down, new pieces from the top
    for (let x = 0; x < M3.cols; x++) {
      const col = [];
      for (let y = M3.rows - 1; y >= 0; y--) if (b[at(x, y)] != null) col.push(b[at(x, y)]);
      for (let y = M3.rows - 1, k = 0; y >= 0; y--, k++) b[at(x, y)] = k < col.length ? col[k] : ri(M3.kinds);
    }
    steps.push({ clear: [...hit], add, chain, board: b.slice() });
  }
  let shuffled = null;
  if (round.moves > 0 && !hasMove(b)) { round.board = freshBoard(); shuffled = round.board.slice(); }
  return { steps, shuffled, moves: round.moves, score: round.score };
}

// coins from a score: the puzzle scores are bigger numbers (they're also the leaderboard's)
export const coinScore = (game, score) => (game === "match3" ? Math.floor(score / 50) : game === "memory" ? Math.floor(score / 6) : score);
