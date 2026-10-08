/*
  Birthdays (used by the game and the server). The day counts in Israel time. Born on 29 February:
  the birthday is on 28 February in years without a 29th.
*/
export const BIRTHDAY_COINS = 500;
export const BIRTHDAY_PINK = "#ff7ac8";
const ISRAEL = "Asia/Jerusalem";
export function israelDay(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: ISRAEL, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now).map((x) => [x.type, +x.value || x.value]));
  return { y: p.year, m: p.month, d: p.day };
}
export function isBirthdayOn(birthDate, now = new Date()) {
  if (!birthDate) return false;
  const b = new Date(birthDate), bm = b.getUTCMonth() + 1, bd = b.getUTCDate(), t = israelDay(now);
  if (bm === t.m && bd === t.d) return true;
  const leap = (t.y % 4 === 0 && t.y % 100 !== 0) || t.y % 400 === 0;
  return bm === 2 && bd === 29 && !leap && t.m === 2 && t.d === 28;
}
