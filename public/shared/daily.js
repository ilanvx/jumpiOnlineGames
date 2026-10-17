/*
  The daily gift (routes/rewards.js, the daily window in the game).
  Days keep counting (1, 2, … 8, 9, …) while the player comes back every day. Missing a day ends the streak; for a week
  after, the player can win it back once for some coins (restoreCost), or start again at day 1.
  Every day gives coins, the same 7-day pattern every week (members get double). Every 10th day is a special gift on the
  bar at the top: a big chest of coins, or membership (1 day on every 20th day, 2 days on every 50th, a week on every 100th).
*/
export const DAILY_COINS = [20, 30, 40, 50, 60, 80, 150];
export const CHEST_COINS = 250;      // the chest on the 10th, 30th, 70th, 90th… day
export const RESTORE_DAYS = 7;       // a lost streak can be won back for this many days after the last gift

export function memberDaysFor(day) {
  if (day % 100 === 0) return 7;
  if (day % 50 === 0) return 2;
  if (day % 20 === 0) return 1;
  return 0;
}
export const isSpecial = (day) => day % 10 === 0;
// what day N gives: { memberDays } or { coins, chest? }
export function giftFor(day, member = false) {
  const m = memberDaysFor(day);
  if (m) return { memberDays: m, special: true };
  const k = member ? 2 : 1;
  if (isSpecial(day)) return { coins: CHEST_COINS * k, chest: true, special: true };
  return { coins: DAILY_COINS[(day - 1) % DAILY_COINS.length] * k };
}
// the next day (from `from`, counted in) with membership
export function nextMemberDay(from) {
  for (let d = Math.max(1, from); d < from + 101; d++) if (memberDaysFor(d)) return d;
  return 0;
}
// what winning back a streak of N days costs: 10 coins a day, at least 30 and at most 600
export const restoreCost = (days) => Math.max(30, Math.min(600, Math.round(days * 10)));
