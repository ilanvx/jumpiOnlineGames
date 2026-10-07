import { User } from "../models/User.js";

/*
  Jumpi's needs: hunger, energy (sleep), stamina and fun. 100 = full, 0 = empty.
  They only go down while the player is in the game (about 1.5–2 hours from full to empty),
  and the server does all the counting, so the page can't fake them:
  - sleeping in a bed, sitting, dancing and playing the piano are seen from the player's pose,
  - eating and drinking only count inside the Restaurant / Dance Club,
  - mini-games add fun,
  - a full refill costs FILL_PRICE coins (less if the bar is only partly empty).
*/
export const NEEDS = ["hunger", "energy", "stamina", "fun"];
export const FILL_PRICE = 25;

// points lost per hour while playing
const DECAY = { hunger: 60, energy: 50, stamina: 45, fun: 70 };
// points gained (or lost) per hour while doing something
const POSE_EFFECT = {
  sleep: { energy: 420 },
  sit: { stamina: 300, energy: 20 },
  play: { stamina: 200, fun: 240 },
  dance: { fun: 320, stamina: -90 },
};
const RUN_DRAIN = 180; // stamina per hour while running
const MEALS = { diner: { hunger: 40, stamina: 5 }, club: { hunger: 15, stamina: 25, fun: 5 } };
const TICK_MS = 5000;
const SAVE_MS = 60_000;

const live = new Map(); // userId -> { v: {hunger,...}, at, saved, lastMeal }
const clamp = (v) => Math.max(0, Math.min(100, v));
const round = (v) => Math.round(v * 10) / 10;

export function cleanNeeds(n) {
  const out = {};
  for (const k of NEEDS) out[k] = Number.isFinite(n?.[k]) ? clamp(n[k]) : 100;
  return out;
}
// how the character feels: shared with other players so they see it too
export function moodOf(v) {
  if (!v) return null;
  const m = [];
  if (v.energy < 25) m.push("tired");
  if (v.hunger < 25) m.push("hungry");
  if (v.stamina < 20) m.push("puffed");
  if (v.fun < 25) m.push("bored");
  return m.length ? m.join(",") : null;
}

let hooks = null; // { playersOf(userId) -> [player], send(userId, event, data), mood(userId, mood) }

// a player came into the game: start counting from their saved values
export function needsOnline(userId, saved) {
  if (live.has(userId)) return live.get(userId).v;
  const e = { v: cleanNeeds(saved), at: Date.now(), saved: Date.now(), lastMeal: 0, mood: null };
  e.mood = moodOf(e.v);
  live.set(userId, e);
  return e.v;
}
// the last game window closed: save and stop counting
export async function needsOffline(userId) {
  const e = live.get(userId);
  if (!e) return;
  live.delete(userId);
  await save(userId, e);
}
export const needsNow = (userId) => live.get(userId)?.v || null;
export const moodNow = (userId) => live.get(userId)?.mood || null;

async function save(userId, e) {
  e.saved = Date.now();
  try {
    await User.updateOne({ _id: userId }, { $set: { needs: { ...e.v } } });
  } catch (err) {
    console.error("[needs] could not save", err.message);
  }
}

function push(userId, e) {
  hooks?.send(userId, "needs", { needs: Object.fromEntries(NEEDS.map((k) => [k, round(e.v[k])])), price: FILL_PRICE });
  const mood = moodOf(e.v);
  if (mood !== e.mood) {
    e.mood = mood;
    hooks?.mood(userId, mood);
  }
}
export function sendNeeds(userId) {
  const e = live.get(userId);
  if (e) push(userId, e);
}

// add points (mini-game won, etc.) — only while the player is in the game
export function bumpNeeds(userId, add) {
  const e = live.get(userId);
  if (!e) return;
  for (const k of NEEDS) if (add[k]) e.v[k] = clamp(e.v[k] + add[k]);
  push(userId, e);
}

// ate or drank something; the room decides what it was (the page only says "I finished")
// paid: what was bought at the club bar (its own needs, paid for, so no waiting time)
export function ateMeal(userId, room, paid) {
  const e = live.get(userId);
  const meal = paid || (room === "place:diner" ? MEALS.diner : room === "place:club" ? MEALS.club : null);
  if (!e || !meal) return false;
  if (!paid && Date.now() - e.lastMeal < 25_000) return false; // a meal takes a while: no spamming
  e.lastMeal = Date.now();
  bumpNeeds(userId, meal);
  return true;
}

// pay coins to fill one bar right up. Coins are taken in the same database write that checks them.
export async function fillNeed(userId, need) {
  if (!NEEDS.includes(need)) return { status: 400, error: "That isn't a need." };
  const e = live.get(userId);
  let value = e?.v[need];
  if (value === undefined) {
    const u = await User.findById(userId, { needs: 1 });
    if (!u) return { status: 404, error: "Player not found." };
    value = cleanNeeds(u.needs)[need];
  }
  const missing = 100 - value;
  if (missing < 1) return { status: 409, error: "That one is already full!" };
  const cost = Math.max(1, Math.ceil((FILL_PRICE * missing) / 100));
  const user = await User.findOneAndUpdate(
    { _id: userId, coins: { $gte: cost } },
    { $inc: { coins: -cost }, $set: { ["needs." + need]: 100 } },
    { new: true, projection: { coins: 1 } }
  );
  if (!user) return { status: 402, error: `You need ${cost} coins for that.`, cost };
  if (e) {
    e.v[need] = 100;
    push(userId, e);
  }
  return { status: 200, coins: user.coins, cost, need };
}

// every few seconds: everyone online loses a little, and gains from what they're doing
export function startNeeds(h) {
  hooks = h;
  setInterval(() => {
    const now = Date.now();
    for (const [userId, e] of live) {
      const hours = (now - e.at) / 3_600_000;
      e.at = now;
      const p = hooks.playersOf(userId)[0];
      const delta = {};
      for (const k of NEEDS) delta[k] = -DECAY[k];
      const pose = p?.pose?.k;
      if (pose && POSE_EFFECT[pose]) for (const [k, v] of Object.entries(POSE_EFFECT[pose])) delta[k] += v + (v > 0 ? DECAY[k] : 0); // resting stops the loss too
      if (p?.moving && p?.run) delta.stamina -= RUN_DRAIN;
      for (const k of NEEDS) e.v[k] = clamp(e.v[k] + delta[k] * hours);
      push(userId, e);
      if (now - e.saved > SAVE_MS) save(userId, e);
    }
  }, TICK_MS).unref?.();
}
// the server is shutting down: save everyone
export async function saveAllNeeds() {
  await Promise.all([...live].map(([id, e]) => save(id, e)));
}
