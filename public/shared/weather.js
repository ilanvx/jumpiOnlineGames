/*
  Time of day and weather in Jumpi. Everything comes from the clock, so every player sees the same hour
  and the same weather without asking the server (the game corrects its clock with the server's Date header).
  The time of day is the real time in Israel (morning, sunset and night follow the real clock).
  The weather is mostly sunny; now and then (the same for everyone) clouds, a short rain or a thunderstorm
  come along for one spell of SPELL_MS, never two wet spells in a row and with long sunny gaps between them.
*/
export const DAY_MS = 24 * 60 * 60 * 1000;
export const SPELL_MS = 6 * 60 * 1000;
export const BLEND_MS = 40 * 1000;          // how long one weather takes to turn into the next
export const WEATHERS = {
  sunny: { name: "Sunny", night: "Clear Night" },
  cloudy: { name: "Cloudy", night: "Cloudy Night" },
  rain: { name: "Rain", night: "Rainy Night" },
  storm: { name: "Thunderstorm", night: "Thunderstorm" },
  heat: { name: "Heat Wave", night: "Warm Night" },
};
const BAG = [["sunny", 62], ["cloudy", 16], ["rain", 9], ["storm", 7], ["heat", 6]];
const TOTAL = BAG.reduce((s, [, w]) => s + w, 0);
function hash(n) {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
// how far Israel's clock is ahead of UTC (2 or 3 hours, summer time included); worked out once a minute
const OFF = { at: -1, ms: 0 };
let fmt = null;
function israelOffset(ms) {
  const bucket = Math.floor(ms / 60000);
  if (bucket === OFF.at) return OFF.ms;
  try {
    fmt = fmt || new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const p = Object.fromEntries(fmt.formatToParts(new Date(bucket * 60000)).map((x) => [x.type, x.value]));
    OFF.ms = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - bucket * 60000;
  } catch {
    OFF.ms = 3 * 3600000;
  }
  OFF.at = bucket;
  return OFF.ms;
}
// the hour (0..24) in Israel at a moment
export function gameHour(ms) {
  const t = ms + israelOffset(ms);
  return (((t % DAY_MS) + DAY_MS) % DAY_MS) / DAY_MS * 24;
}
function rawSpell(i) {
  let r = hash(i) * TOTAL;
  for (const [k, w] of BAG) { if ((r -= w) < 0) return k; }
  return "sunny";
}
// sunrise and sunset in Tel Aviv on that day (Israel hours), from the sun's position
const SUN = { day: -1, rise: 6, set: 18.5 };
export function sunTimes(ms) {
  const off = israelOffset(ms), t = ms + off, day = Math.floor(t / DAY_MS);
  if (day === SUN.day) return SUN;
  const d = new Date(day * DAY_MS), doy = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / DAY_MS);
  const rad = Math.PI / 180, lat = 32.08, lon = 34.78;
  const dec = 23.44 * Math.sin((2 * Math.PI * (284 + doy)) / 365) * rad;
  const H0 = Math.acos(Math.max(-1, Math.min(1, (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec))))) / rad;
  const B = (2 * Math.PI * (doy - 81)) / 364, eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const noon = 12 - (lon - 15 * (off / 3600000)) / 15 - eot / 60;
  Object.assign(SUN, { day, rise: noon - H0 / 15, set: noon + H0 / 15 });
  return SUN;
}
// the hour the sky is drawn for: the real hour stretched so that the real sunrise is 6:00 and the real sunset 18:40
// (the sky colours in the game are made for those two times)
export function skyHour(ms) {
  const h = gameHour(ms), { rise, set } = sunTimes(ms), R = 6, S = 18.67;
  if (h < rise) return (h / rise) * R;
  if (h < set) return R + ((h - rise) / (set - rise)) * (S - R);
  return S + ((h - set) / (24 - set)) * (24 - S);
}
// the weather of spell number i (storms only grow out of clouds or rain; no heat wave in the evening or at night)
export function spellWeather(i) {
  let k = rawSpell(i);
  // wet weather never twice in a row, and at least two dry spells after rain or a storm
  const wet = (q) => q === "rain" || q === "storm";
  if (wet(k) && (wet(rawSpell(i - 1)) || wet(rawSpell(i - 2)))) k = "cloudy";
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
// the clock as people in Israel read it (24 hours)
export function clockText(h) {
  const total = Math.floor(h * 60), hh = Math.floor(total / 60) % 24, mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
export const isNightHour = (h) => h >= 19.5 || h < 5.5;
