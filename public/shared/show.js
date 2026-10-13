/*
  The Jumpi Show ("משחקי המשגיחים"): a live show a moderator or an admin opens whenever they want. The players who
  come in stand on a big stage in 3 rows facing the screen; when it's full, the rest watch (viewers are only a number).
  Only the one who opened it runs it: a quick poll, confetti, balloons, a spotlight (it stays until the host turns it
  off), funny "off the stage" exits, new players for the stage (the ones who weren't up yet first), the prize wheel
  and coin gifts.
  Used by the game (index.html, SHOW block) and the server (realtime/show.js), which decides everything.
*/

// the stage: front row first, the middle seat first and then left / right in turn
export const SHOW_ROWS = [8, 10, 12];
export const SHOW_SEATS = SHOW_ROWS.reduce((a, b) => a + b, 0);

// seat number → [row, place in the row from the left]
const rowOrder = (len) => {
  const out = [], c = (len - 1) / 2;
  if (len % 2) { out.push(c); for (let d = 1; out.length < len; d++) { out.push(c + d); if (out.length < len) out.push(c - d); } }
  else for (let d = 0.5; out.length < len; d++) { out.push(c + d); out.push(c - d); }
  return out;
};
const ORDERS = SHOW_ROWS.map(rowOrder);
export function seatSpot(n) {
  let row = 0;
  while (row < SHOW_ROWS.length && n >= SHOW_ROWS[row]) { n -= SHOW_ROWS[row]; row++; }
  if (row >= SHOW_ROWS.length) return null;
  return [row, ORDERS[row][n]];
}

// the prize wheel: free, only the host gives a spin (no buying, no real money: it's a prize, not gambling).
// The server picks the slice by weight the moment the player presses SPIN; everyone sees the wheel stop on it.
export const WHEEL = [
  { k: "skull", label: "Nothing", weight: 14, color: "#4a4f63" },
  { k: "coins", n: 100, label: "100 coins", weight: 20, color: "#ffb21f" },
  { k: "xp", n: 50, label: "50 XP", weight: 15, color: "#2f9bff" },
  { k: "coins", n: 250, label: "250 coins", weight: 12, color: "#ff8a1c" },
  { k: "skull", label: "Nothing", weight: 14, color: "#4a4f63" },
  { k: "xp", n: 150, label: "150 XP", weight: 10, color: "#8a4dff" },
  { k: "coins", n: 500, label: "500 coins", weight: 7, color: "#2fd36b" },
  { k: "member", days: 7, label: "1 week membership", weight: 8, color: "#ff5fb4" },
];
export const WHEEL_SPIN_MS = 5200;   // how long the wheel turns before it stops
// what a moderator's monthly budget pays for each prize (admins have no limit)
export const WHEEL_BUDGET = { skull: 0, xp: 0, coins: (s) => s.n, member: () => 1500 };

export const SHOW_GIFT_MAX = 1000;            // the most coins the host gives in one gift
export const POLL_SECS = [10, 20, 30];        // how long a quick poll stays open
