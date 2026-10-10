import express from "express";
import crypto from "node:crypto";
import { User } from "../models/User.js";
import { requireJson } from "./auth.js";
import { requireUser } from "./shop.js";
import { notifyCoins } from "../realtime/plaza.js";
import { bumpNeeds } from "../realtime/needs.js";
import { addSeasonXp } from "./season.js";
import { SEASON_XP } from "../public/shared/season.js";
import { addLevelXp } from "./levels.js";
import { questEvent } from "./quests.js";
import { LEVEL_XP } from "../public/shared/levels.js";

/*
  Ways to earn coins:
  - a daily login bonus that grows with the streak (7-day cycle)
  - three mini-games; the server decides how many coins a round is worth
  Nothing the page sends is trusted on its own: times, scores and the
  treasure map are checked or kept here.
*/
const router = express.Router();

/* ---------- days are counted in Israel time ---------- */
const TZ = "Asia/Jerusalem";
const dayKey = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const yesterdayKey = () => dayKey(new Date(Date.now() - 86_400_000));

/* ---------- daily bonus ---------- */
export const DAILY_REWARDS = [20, 30, 40, 50, 60, 80, 150];

function dailyState(user) {
  const today = dayKey();
  if (user.dailyLast === today) {
    const streak = Math.max(1, user.dailyStreak || 1);
    return { today, canClaim: false, streak, day: (streak - 1) % 7 };
  }
  const streak = user.dailyLast === yesterdayKey() ? (user.dailyStreak || 0) + 1 : 1;
  return { today, canClaim: true, streak, day: (streak - 1) % 7 };
}

router.get("/rewards/daily", requireUser, (req, res) => {
  const s = dailyState(req.user);
  res.set("Cache-Control", "no-store");
  const k = req.user.isMember() ? 2 : 1; // members see (and get) double gifts
  res.json({ canClaim: s.canClaim, streak: s.streak, day: s.day, rewards: DAILY_REWARDS.map((r) => r * k), member: k === 2 });
});

router.post("/rewards/daily/claim", requireJson, requireUser, async (req, res, next) => {
  try {
    const s = dailyState(req.user);
    if (!s.canClaim) return res.status(409).json({ error: "You already took today's gift. Come back tomorrow!" });
    const reward = DAILY_REWARDS[s.day] * (req.user.isMember() ? 2 : 1); // members get a double gift
    // only succeeds if nobody claimed in the meantime (two tabs, double clicks)
    const updated = await User.findOneAndUpdate(
      { _id: req.user._id, dailyLast: sameAs(req.user.dailyLast, "") },
      { $set: { dailyLast: s.today, dailyStreak: s.streak }, $inc: { coins: reward } },
      { new: true }
    );
    if (!updated) return res.status(409).json({ error: "You already took today's gift. Come back tomorrow!" });
    notifyCoins(updated._id.toString(), updated.coins);
    addSeasonXp(updated._id, SEASON_XP.daily);
    addLevelXp(updated._id, LEVEL_XP.daily, { why: "daily" });
    res.json({ reward, streak: s.streak, day: s.day, coins: updated.coins });
  } catch (err) {
    next(err);
  }
});

/* ---------- mini-games ---------- */
const DAILY_GAME_CAP = 200; // most coins mini-games can give in one day (members: twice as much)
const dailyCapOf = (user) => DAILY_GAME_CAP * (user.isMember() ? 2 : 1);
const ROUND_CAP = 40; // most coins one round can give
const ROUND_SECS = 30; // fruit and shell rounds
const GAMES = ["fruit", "shell", "dig", "flap"];
const rnd = () => crypto.randomInt(1_000_000) / 1_000_000;

/*
  Fruit and shell rounds are scripted here: the server decides every fruit and
  every shell (when it appears, where, and what it's worth) and sends the script
  to the page. At the end the page lists which ones it caught; the server only
  counts items that really exist, once each, and only if they had time to be
  caught before the round ended. So a forged request can't invent points.
*/
const FRUIT_KINDS = [["apple", 1, 34], ["pear", 1, 22], ["orange", 1, 22], ["gold", 3, 8], ["rotten", -2, 16]];
const SHELL_KINDS = [["shell", 1, 64], ["pearl", 3, 12], ["crab", -2, 24]];
const FALL = 368; // pixels from the top of the fruit game to the basket
function pickKind(kinds) {
  let r = rnd() * kinds.reduce((a, k) => a + k[2], 0);
  for (const k of kinds) if ((r -= k[2]) < 0) return k;
  return kinds[0];
}
function fruitScript() {
  const items = [];
  for (let t = 0.6, i = 0; t < ROUND_SECS - 0.4; i++) {
    const k = t / ROUND_SECS, [kind, pts] = pickKind(FRUIT_KINDS);
    const v = Math.round((190 + k * 190) * (0.85 + rnd() * 0.3));
    items.push({ i, t: +t.toFixed(3), x: Math.round(40 + rnd() * 640), k: kind, v, pts, catchAt: t + FALL / v });
    t += (0.62 - k * 0.3) * (0.7 + rnd() * 0.6);
  }
  return items;
}
function shellScript() {
  const items = [], busy = Array(12).fill(0);
  for (let t = 0.4, i = 0; t < ROUND_SECS - 0.3; ) {
    const k = t / ROUND_SECS, free = busy.map((b, h) => (b <= t ? h : -1)).filter((h) => h >= 0);
    if (free.length) {
      const h = free[crypto.randomInt(free.length)], [kind, pts] = pickKind(SHELL_KINDS), life = +(1.25 - k * 0.4).toFixed(3);
      items.push({ i: i++, t: +t.toFixed(3), h, k: kind, life, pts, catchAt: t + 0.05 });
      busy[h] = t + life;
    }
    t += (0.62 - k * 0.25) * (0.85 + rnd() * 0.3);
  }
  return items;
}
const forPage = (items) => items.map(({ i, t, x, h, k, v, life }) => ({ i, t, x, h, k, v, life }));

/*
  Jumpi Flap (Flappy-style, on the beach): the course is made here too. Obstacle k sits at
  x = FLAP.first + k * FLAP.gap and scrolls left at FLAP.speed px/s; Jumpi flies at x = FLAP.jumpiX.
  So obstacle k can't be passed before (first + k*gap + half width - jumpiX) / speed seconds,
  and a golden shell in gap k can't be picked up before it reaches Jumpi. The page reports how many
  obstacles it passed and which shells it took; anything faster than that is not counted.
*/
const FLAP = { count: 400, first: 800, gap: 270, speed: 200, jumpiX: 180, half: 40, shellEvery: 3 };
function flapScript() {
  const items = [];
  for (let k = 0; k < FLAP.count; k++) {
    const size = Math.round(Math.max(150, 190 - k * 1.2));   // the gaps get a little smaller
    const y = Math.round(130 + rnd() * 200);                  // centre of the gap (the play area is 480 high)
    items.push({ i: k, y, size, shell: k % FLAP.shellEvery === 1 && rnd() < 0.85 });
  }
  return items;
}
const flapPassAt = (k) => (FLAP.first + k * FLAP.gap + FLAP.half - FLAP.jumpiX) / FLAP.speed;
function flapScore(round, passed, shells) {
  const elapsed = (Date.now() - round.start) / 1000 + 1;   // 1 s for the network
  let n = Math.max(0, Math.min(FLAP.count, Math.floor(Number(passed) || 0)));
  while (n > 0 && flapPassAt(n - 1) > elapsed) n--;
  const seen = new Set();
  let got = 0;
  for (const raw of Array.isArray(shells) ? shells.slice(0, FLAP.count) : []) {
    const k = Number(raw);
    if (!Number.isInteger(k) || seen.has(k) || k > n || !round.items[k]?.shell) continue;
    if ((FLAP.first + k * FLAP.gap - FLAP.jumpiX) / FLAP.speed > elapsed) continue;
    seen.add(k);
    got++;
  }
  return n + got * 2;
}

// treasure map for the dig game: built here, never sent to the page
const DIG = { cols: 7, rows: 5, shovels: 10, items: [["chest", 10, 2], ["gem", 5, 3], ["coins", 2, 6]] };
function makeDigBoard() {
  const cells = Array(DIG.cols * DIG.rows).fill(null);
  const free = cells.map((_, i) => i);
  for (const [kind, value, count] of DIG.items)
    for (let n = 0; n < count; n++) {
      const pick = free.splice(crypto.randomInt(free.length), 1)[0];
      cells[pick] = { kind, value };
    }
  return cells;
}
function distanceToChest(board, dug, from) {
  let best = Infinity;
  board.forEach((c, i) => {
    if (c?.kind !== "chest" || dug.has(i)) return;
    const d = Math.abs((i % DIG.cols) - (from % DIG.cols)) + Math.abs(Math.floor(i / DIG.cols) - Math.floor(from / DIG.cols));
    best = Math.min(best, d);
  });
  return best === Infinity ? 0 : best;
}

const sessions = new Map(); // id -> round
const activeByUser = new Map(); // userId -> id
setInterval(() => {
  const old = Date.now() - 15 * 60_000;
  for (const [id, s] of sessions)
    if (s.start < old) {
      sessions.delete(id);
      if (activeByUser.get(s.userId) === id) activeByUser.delete(s.userId);
    }
}, 60_000).unref();

const todayEarned = (user) => (user.gamesDay === dayKey() ? user.gamesEarned || 0 : 0);
// older accounts may not have the new fields stored yet: "" / 0 also match a missing field
const sameAs = (v, empty) => (v === empty || v == null ? { $in: [empty, null] } : v);

const bestOf = (user, game) => (user.gameBest && typeof user.gameBest.get === "function" ? user.gameBest.get(game) : 0) || 0;

// for the start screen of a game: coins left today and your best scores
router.get("/minigame/status", requireUser, (req, res) => {
  res.json({ todayEarned: todayEarned(req.user), dailyCap: dailyCapOf(req.user), best: Object.fromEntries(GAMES.map((g) => [g, bestOf(req.user, g)])) });
});

const recentStarts = new Map();
router.post("/minigame/start", requireJson, requireUser, (req, res) => {
  const game = String(req.body.game || "");
  if (!GAMES.includes(game)) return res.status(400).json({ error: "That game doesn't exist." });
  const userId = req.user._id.toString();
  const now = Date.now();
  const list = (recentStarts.get(userId) || []).filter((t) => now - t < 60_000);
  if (list.length >= 10) return res.status(429).json({ error: "Take a little break and try again in a minute." });
  list.push(now);
  recentStarts.set(userId, list);
  const prev = activeByUser.get(userId);
  if (prev) sessions.delete(prev); // only one round at a time
  const id = crypto.randomUUID();
  const round = { id, userId, game, start: now, done: false };
  if (game === "dig") Object.assign(round, { board: makeDigBoard(), dug: new Set(), shovels: DIG.shovels, score: 0 });
  else round.items = game === "fruit" ? fruitScript() : game === "flap" ? flapScript() : shellScript();
  sessions.set(id, round);
  activeByUser.set(userId, id);
  res.json({
    id,
    game,
    todayEarned: todayEarned(req.user),
    dailyCap: dailyCapOf(req.user),
    roundCap: ROUND_CAP,
    best: bestOf(req.user, game),
    ...(game === "dig" ? { cols: DIG.cols, rows: DIG.rows, shovels: DIG.shovels }
      : game === "flap" ? { flap: { first: FLAP.first, gap: FLAP.gap, speed: FLAP.speed, jumpiX: FLAP.jumpiX, half: FLAP.half }, items: round.items }
      : { secs: ROUND_SECS, items: forPage(round.items) }),
  });
});

function ownRound(req, res) {
  const round = sessions.get(String(req.body.id || ""));
  if (!round || round.userId !== req.user._id.toString() || round.done) {
    res.status(404).json({ error: "This round has ended. Start a new one." });
    return null;
  }
  return round;
}

router.post("/minigame/dig", requireJson, requireUser, (req, res) => {
  const round = ownRound(req, res);
  if (!round) return;
  if (round.game !== "dig") return res.status(400).json({ error: "Wrong game." });
  const cell = Number(req.body.cell);
  if (!Number.isInteger(cell) || cell < 0 || cell >= DIG.cols * DIG.rows) return res.status(400).json({ error: "Pick a spot in the sand." });
  if (round.dug.has(cell)) return res.status(409).json({ error: "You already dug there." });
  if (round.shovels <= 0) return res.status(409).json({ error: "No shovels left." });
  round.dug.add(cell);
  round.shovels--;
  const found = round.board[cell];
  if (found) round.score += found.value;
  const allChests = round.board.every((c, i) => c?.kind !== "chest" || round.dug.has(i));
  res.json({
    cell,
    item: found ? found.kind : null,
    value: found ? found.value : 0,
    hint: found ? null : distanceToChest(round.board, round.dug, cell),
    shovels: round.shovels,
    score: round.score,
    allChests,
  });
});

// the score of a scripted round, worked out from the item ids the page says it caught
function scriptedScore(round, caught) {
  const elapsed = Math.min(ROUND_SECS, (Date.now() - round.start) / 1000) + 1; // 1 s for the network
  const seen = new Set();
  let score = 0;
  for (const raw of Array.isArray(caught) ? caught.slice(0, 400) : []) {
    const i = Number(raw);
    if (!Number.isInteger(i) || seen.has(i)) continue;
    const item = round.items[i];
    if (!item || item.catchAt > elapsed) continue;
    seen.add(i);
    score += item.pts;
  }
  return Math.max(0, score);
}

// ends a round (also when the player leaves early) and pays out
router.post("/minigame/finish", requireJson, requireUser, async (req, res, next) => {
  try {
    const round = ownRound(req, res);
    if (!round) return;
    round.done = true; // before any await: a second finish for the same round gets nothing
    sessions.delete(round.id);
    if (activeByUser.get(round.userId) === round.id) activeByUser.delete(round.userId);
    const score = round.game === "dig" ? round.score : round.game === "flap" ? flapScore(round, req.body.passed, req.body.caught) : scriptedScore(round, req.body.caught);

    // add the coins, keeping today's total under the daily cap (retry if two rounds finish together)
    for (let attempt = 0; attempt < 3; attempt++) {
      const user = await User.findById(req.user._id);
      if (!user) return res.status(401).json({ error: "Please log in first." });
      const today = dayKey();
      const earnedToday = todayEarned(user);
      const cap = dailyCapOf(user);
      const coins = Math.max(0, Math.min(ROUND_CAP, score, cap - earnedToday));
      const oldBest = bestOf(user, round.game);
      const updated = await User.findOneAndUpdate(
        { _id: user._id, gamesDay: sameAs(user.gamesDay, ""), gamesEarned: sameAs(user.gamesEarned, 0) },
        { $set: { gamesDay: today, gamesEarned: earnedToday + coins }, $inc: { coins }, $max: { ["gameBest." + round.game]: score } },
        { new: true }
      );
      if (!updated) continue;
      if (coins) notifyCoins(updated._id.toString(), updated.coins);
      bumpNeeds(updated._id.toString(), { fun: 20 }); // playing is fun!
      addSeasonXp(updated._id, SEASON_XP.minigame);
      addLevelXp(updated._id, LEVEL_XP.minigame, { why: "minigame" });
      if (score > 0) questEvent(updated._id, "minigame", 1);   // quests: "play N mini-games"
      return res.json({ score, coins, total: updated.coins, todayEarned: earnedToday + coins, dailyCap: cap, best: Math.max(oldBest, score), newBest: score > oldBest && score > 0 });
    }
    res.status(409).json({ error: "Something got in the way. Try again." });
  } catch (err) {
    next(err);
  }
});

export default router;
