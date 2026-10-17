/*
  No daily limit on coins from mini-games and jobs any more: play as much as you like, it just gets harder.
  Within one hour (from the first coins of that hour) the pay slowly drops the more was already earned:
  full pay first, then 60%, then 35%, then 20%. Members' steps are twice as wide. A new hour starts fresh.
  The server (routes/rewards.js, routes/jobs.js) works this out; the page only shows it.
*/
export const HOUR_MS = 60 * 60 * 1000;
export const PACE = {
  games: [150, 300, 500],   // coins in this hour where the pay drops to 60%, 35%, 20%
  jobs: [600, 1200, 2000],
};
const STEPS = [1, 0.6, 0.35, 0.2];

// this hour's coins so far ({ at, earned } as stored; a finished hour counts as 0)
export function hourEarned(rec, now = Date.now()) {
  const at = rec && rec.at ? new Date(rec.at).getTime() : 0;
  return at && now - at < HOUR_MS ? rec.earned || 0 : 0;
}
// how much of the full pay the next coins are worth (1 = all of it)
export function paceFactor(kind, earned, member = false) {
  const t = PACE[kind].map((x) => x * (member ? 2 : 1));
  let i = 0;
  while (i < t.length && earned >= t[i]) i++;
  return STEPS[i];
}
// pay `full` coins at the current pace, coin by coin across the steps (so a big pay crossing a step isn't all cut)
export function paceCoins(kind, earned, full, member = false) {
  let left = Math.max(0, Math.floor(full)), got = 0, e = earned, part = 0;
  const t = PACE[kind].map((x) => x * (member ? 2 : 1));
  while (left > 0) {
    let i = 0;
    while (i < t.length && e >= t[i]) i++;
    const room = i < t.length ? Math.min(left, Math.ceil((t[i] - e) / STEPS[i])) : left;
    part += room * STEPS[i];
    got = Math.floor(part);
    e = earned + got;
    left -= room;
  }
  return Math.max(full > 0 ? 1 : 0, got);
}
// for the page: { factor, earned, nextAt } (nextAt = when this hour is over and full pay is back)
export function paceView(kind, rec, member = false, now = Date.now()) {
  const earned = hourEarned(rec, now), at = rec && rec.at ? new Date(rec.at).getTime() : 0;
  return { factor: paceFactor(kind, earned, member), earned, resetAt: earned && at ? at + HOUR_MS : 0 };
}
