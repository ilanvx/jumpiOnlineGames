/*
  The Season (free for everyone) and the daily Lucky Wheel. Used by the game and the server.

  Season: 30 tiers, 100 XP each. XP comes from playing (mini-games, jobs, the daily gift, the wheel),
  at most SEASON_DAY_XP a day so nobody can rush it in one evening. Every tier has a prize you claim;
  6 of them are season-only clothes (outfits.js, gift: "season:<id>") that are never sold and never traded.
  Add new seasons at the end of SEASONS (their clothes at the end of the lists in outfits.js).
  After the last season ends a "Bonus Season" with coin prizes keeps running until a new one is added.

  Lucky Wheel: one free spin every 24 hours (from your last spin). Never for money.
*/
import { OUTFITS } from "./outfits.js";

export const TIERS = 30;
export const TIER_XP = 100;
export const SEASON_DAY_XP = 320;
// XP for each thing you do
export const SEASON_XP = { minigame: 25, jobTask: 8, daily: 40, wheel: 20 };

export const SEASONS = [
  {
    id: "s1", name: "Galaxy Season", start: "2026-10-07", end: "2026-11-07",
    colors: ["#2a1f6e", "#9b5cff", "#5fe0ff"],
    about: "Stars, comets and cosmic style. Collect all six galaxy pieces before the season ends!",
  },
];
// the season-only clothes of a season (in the order they appear on the track)
export function seasonItems(id) {
  const out = [];
  for (const slot of Object.keys(OUTFITS)) OUTFITS[slot].forEach((o, i) => { if (o.gift === "season:" + id) out.push({ id: `${slot}:${i}`, slot, i, tier: o.tier }); });
  return out.sort((a, b) => a.tier - b.tier);
}
const ISRAEL = "Asia/Jerusalem";
const dayStr = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: ISRAEL, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const atMidnight = (s) => new Date(s + "T00:00:00+03:00");
// the season running now (or a Bonus Season after the last one)
export function currentSeason(now = new Date()) {
  const today = dayStr(now);
  for (const S of SEASONS) if (today >= S.start && today < S.end) return { ...S, endsAt: atMidnight(S.end).getTime(), bonus: false };
  // after the last season: 30-day bonus seasons with coins only
  const last = SEASONS[SEASONS.length - 1], from = atMidnight(last.end).getTime(), span = 30 * 86_400_000;
  const k = Math.max(0, Math.floor((now.getTime() - from) / span));
  return { id: `bonus${k + 1}`, name: "Bonus Season", start: "", end: "", colors: ["#1f4f8f", "#2fd36b", "#ffd23a"], about: "A brand-new season is on its way! Until then, earn coins on the bonus track.", endsAt: from + (k + 1) * span, bonus: true };
}
// the prize of every tier (1..30): season clothes on their tiers, coins on the others
export function seasonRewards(S) {
  const items = S.bonus ? [] : seasonItems(S.id), byTier = new Map(items.map((it) => [it.tier, it.id]));
  const out = [];
  for (let t = 1; t <= TIERS; t++) {
    if (byTier.has(t)) out.push({ tier: t, item: byTier.get(t) });
    else out.push({ tier: t, coins: t % 10 === 0 ? 500 : t % 5 === 0 ? 250 : 60 + Math.floor(t / 3) * 10 });
  }
  return out;
}
export const tierOf = (xp) => Math.min(TIERS, Math.floor((xp || 0) / TIER_XP));

/* ---------- Lucky Wheel ---------- */
export const WHEEL_MS = 24 * 3600 * 1000;
// slices in order round the wheel; weight = how likely (out of the total)
export const WHEEL = [
  { kind: "coins", amount: 25, weight: 24, color: "#ff8a1c" },
  { kind: "xp", amount: 100, weight: 14, color: "#9b5cff" },
  { kind: "coins", amount: 50, weight: 22, color: "#1fb6ff" },
  { kind: "coins", amount: 150, weight: 12, color: "#2fd36b" },
  { kind: "coins", amount: 75, weight: 16, color: "#ff5fa8" },
  { kind: "xp", amount: 200, weight: 6, color: "#5fe0c0" },
  { kind: "coins", amount: 400, weight: 4, color: "#e8423b" },
  { kind: "item", weight: 2, color: "#ffd23a" },   // the Lucky Hat (outfits.js, gift: "wheel"); coins if you already have it
];
export const wheelItem = () => { const i = OUTFITS.hat.findIndex((o) => o.gift === "wheel"); return i >= 0 ? `hat:${i}` : null; };
