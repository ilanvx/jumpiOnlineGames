import { PlaySession } from "../models/PlaySession.js";

/*
  Counting play time (for parents, /parents). A session starts when the player's first game window joins
  and ends when the last one leaves (realtime/plaza.js calls playOn / playOff; moving between rooms or
  reloading the page doesn't end it, plaza waits a few seconds first).
*/
const live = new Map();   // userId -> { id, start, closed }
const oops = (err) => console.error("[playtime]", err?.message || err);

export function deviceOf(ua) {
  ua = String(ua || "");
  if (/JumpiApp\//.test(ua)) return "app";
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return "phone";
  return "computer";
}

export const isPlaying = (userId) => live.has(String(userId));

export async function playOn(userId, device) {
  userId = String(userId);
  if (live.has(userId)) return;
  const entry = { id: null, start: new Date(), closed: null };
  live.set(userId, entry);
  try {
    const doc = await PlaySession.create({ userId, start: entry.start, last: entry.start, device });
    entry.id = doc._id;
    if (entry.closed) await PlaySession.updateOne({ _id: doc._id }, { $set: { end: entry.closed, last: entry.closed } });   // left while it was being saved
  } catch (err) {
    if (live.get(userId) === entry) live.delete(userId);
    oops(err);
  }
}

export function playOff(userId) {
  userId = String(userId);
  const entry = live.get(userId);
  if (!entry) return;
  live.delete(userId);
  const now = new Date();
  if (entry.id) PlaySession.updateOne({ _id: entry.id }, { $set: { end: now, last: now } }).catch(oops);
  else entry.closed = now;
}

let started = false;
export function startPlaytime() {
  if (started) return;
  started = true;
  // sessions the last run of the server left open: they ended at their last minute
  const boot = new Date();
  PlaySession.find({ end: null, start: { $lt: boot } }).select("last").lean()
    .then((open) => Promise.all(open.map((s) => PlaySession.updateOne({ _id: s._id, end: null }, { $set: { end: s.last } }))))
    .catch(oops);
  setInterval(() => {
    const ids = [...live.values()].map((e) => e.id).filter(Boolean);
    if (ids.length) PlaySession.updateMany({ _id: { $in: ids } }, { $set: { last: new Date() } }).catch(oops);
  }, 60 * 1000).unref?.();
}
