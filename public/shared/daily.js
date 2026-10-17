/*
  The daily gift (routes/rewards.js, the daily window in the game).
  Days keep counting (1, 2, … 8, 9, …) while the player comes back every day; missing a day starts again at 1.
  Coins follow the same 7-day pattern every week (members get double). Now and then a day gives membership instead:
  1 day on every 20th day, 2 days on every 50th, and a whole week on every 100th (very rare).
*/
export const DAILY_COINS = [20, 30, 40, 50, 60, 80, 150];
export const PAGE = 10;   // days on one page of the gift book

export function memberDaysFor(day) {
  if (day % 100 === 0) return 7;
  if (day % 50 === 0) return 2;
  if (day % 20 === 0) return 1;
  return 0;
}
// what day N gives: { memberDays } or { coins }
export function giftFor(day, member = false) {
  const m = memberDaysFor(day);
  if (m) return { memberDays: m };
  return { coins: DAILY_COINS[(day - 1) % DAILY_COINS.length] * (member ? 2 : 1) };
}
// the next day (from day `from`, counted in) that gives membership
export function nextMemberDay(from) {
  for (let d = Math.max(1, from); d < from + 101; d++) if (memberDaysFor(d)) return d;
  return 0;
}
