/*
  Player levels 1-99. Used by the game and the server (routes/levels.js keeps the XP).

  XP comes from playing: mini-games, jobs, board games, the daily gift (at most LEVEL_DAY_XP a day from those),
  and from quests (not capped). Each level needs more XP than the one before, so the top is a long way up:
  about 250,000 XP for level 99.

  Every 10 levels the badge next to your name changes shape and colour, and so does your chat bubble
  (RANKS). The game shows all of them in the Levels window so players can see what's coming.
*/
export const MAX_LEVEL = 99;
export const LEVEL_DAY_XP = 500;
// XP for each thing you do (quests give their own amount)
export const LEVEL_XP = { minigame: 20, jobTask: 5, daily: 30, duel: 10, duelWin: 20, tutorial: 200 };

// XP to go from level L to L + 1
export const needFor = (L) => Math.round(40 + 12 * L + 0.6 * L * L);
// TOTAL[L] = XP needed to reach level L (TOTAL[1] = 0)
export const TOTAL = [0, 0];
for (let L = 2; L <= MAX_LEVEL; L++) TOTAL[L] = TOTAL[L - 1] + needFor(L - 1);

export function levelOf(xp) {
  xp = Math.max(0, Number(xp) || 0);
  let lo = 1, hi = MAX_LEVEL;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (TOTAL[mid] <= xp) lo = mid; else hi = mid - 1; }
  return lo;
}
// where you are inside your level: { level, into, need, pct } (at 99: pct 1)
export function levelProgress(xp) {
  const level = levelOf(xp);
  if (level >= MAX_LEVEL) return { level, into: 0, need: 0, pct: 1 };
  const into = Math.max(0, xp - TOTAL[level]), need = needFor(level);
  return { level, into, need, pct: Math.min(1, into / need) };
}

/* the ranks: a new badge and chat bubble every 10 levels (and a special one at 99)
   bubble: [background, border, text]; a background can be a gradient */
export const RANKS = [
  { from: 1, name: "Sprout", shape: "circle", c: "#5ec46f", e: "#2f8a3f", bubble: ["#ffffff", "#1f3355", "#22324a"] },
  { from: 10, name: "Explorer", shape: "rounded", c: "#1fb6ff", e: "#06639e", bubble: ["#e1f4ff", "#1f7fd1", "#0b3f73"] },
  { from: 20, name: "Adventurer", shape: "hexagon", c: "#2fd3a0", e: "#11806a", bubble: ["#dcfaef", "#14967a", "#0b4a3d"] },
  { from: 30, name: "Star", shape: "star", c: "#ffc21f", e: "#b07800", bubble: ["#fff4c4", "#d39a00", "#5a3d00"] },
  { from: 40, name: "Hero", shape: "shield", c: "#ff8a1c", e: "#a3410a", bubble: ["#ffe5cc", "#e06a00", "#5a2600"] },
  { from: 50, name: "Champion", shape: "wings", c: "#ff5fb4", e: "#a3205f", bubble: ["#ffe0f1", "#e0388f", "#6b0f3d"] },
  { from: 60, name: "Master", shape: "diamond", c: "#9b5cff", e: "#5a22d6", bubble: ["#ece2ff", "#7a3ef0", "#34126e"] },
  { from: 70, name: "Legend", shape: "flame", c: "#ff4f4f", e: "#8f1218", bubble: ["linear-gradient(180deg,#ff8a6b,#ff4f4f)", "#8f1218", "#ffffff"] },
  { from: 80, name: "Mythic", shape: "gem", c: "#12c6d6", e: "#0a6f7a", bubble: ["linear-gradient(180deg,#7ff0ff,#1fb6ff)", "#0a5a8a", "#06304f"] },
  { from: 90, name: "Royal", shape: "crown", c: "#ffbf1f", e: "#9a6400", bubble: ["linear-gradient(180deg,#fff0a8,#ffbf1f)", "#9a6400", "#4a2c00"] },
  { from: 99, name: "Jumpi Icon", shape: "crown", c: "#ff5fb4", e: "#5a22d6", rainbow: true,
    bubble: ["linear-gradient(90deg,#ffb3b3,#ffe08a,#b8f5b0,#a8e4ff,#d8c2ff)", "#5a22d6", "#2a1060"] },
];
export const rankOf = (level) => { let r = 0; RANKS.forEach((k, i) => { if (level >= k.from) r = i; }); return r; };
