/*
  Time of day and weather in Jumpi. Everything comes from the clock, so every player sees the same hour
  and the same weather without asking the server (the game corrects its clock with the server's Date header).
  One game day = 24 real minutes (one game minute = one real second). The weather changes every 4 real minutes.
*/
export const DAY_MS = 24 * 60 * 1000;
export const SPELL_MS = 4 * 60 * 1000;
export const BLEND_MS = 40 * 1000;          // how long one weather takes to turn into the next
export const WEATHERS = {
  sunny: { name: "Sunny", night: "Clear Night" },
  cloudy: { name: "Cloudy", night: "Cloudy Night" },
  rain: { name: "Rain", night: "Rainy Night" },
  storm: { name: "Thunderstorm", night: "Thunderstorm" },
  heat: { name: "Heat Wave", night: "Warm Night" },
};
const BAG = [["sunny", 30], ["cloudy", 22], ["rain", 18], ["storm", 10], ["heat", 20]];
const TOTAL = BAG.reduce((s, [, w]) => s + w, 0);
function hash(n) {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
// the hour (0..24) at a moment
export function gameHour(ms) {
  return (((ms % DAY_MS) + DAY_MS) % DAY_MS) / DAY_MS * 24;
}
function rawSpell(i) {
  let r = hash(i) * TOTAL;
  for (const [k, w] of BAG) { if ((r -= w) < 0) return k; }
  return "sunny";
}
// the weather of spell number i (storms only grow out of clouds or rain; no heat wave in the evening or at night)
export function spellWeather(i) {
  let k = rawSpell(i);
  if (k === "storm" && !["cloudy", "rain"].includes(rawSpell(i - 1))) k = "rain";
  if (k === "heat") {
    const h = gameHour(i * SPELL_MS);
    if (h >= 15 || h < 6) k = "sunny";
  }
  return k;
}
// what's happening right now: the weather, the one coming next, and how far the change has got (0..1)
export function weatherNow(ms) {
  const i = Math.floor(ms / SPELL_MS), into = ms - i * SPELL_MS;
  const kind = spellWeather(i), next = spellWeather(i + 1);
  const mix = Math.max(0, Math.min(1, (into - (SPELL_MS - BLEND_MS)) / BLEND_MS));
  return { kind, next, mix, msLeft: SPELL_MS - into };
}
export function clockText(h) {
  const total = Math.floor(h * 60), hh = Math.floor(total / 60) % 24, mm = total % 60;
  const h12 = hh % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
}
export const isNightHour = (h) => h >= 19.5 || h < 5.5;
