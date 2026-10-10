import { User } from "../models/User.js";

/*
  Blocked players are "ghosts" to each other: if A blocked B (or B blocked A), neither sees the
  other in the game: no character, moves, chat bubbles, emotes, vehicles, and they don't show in
  each other's Online list. Messages and friend requests are refused in routes/social.js.
  Admins are never hidden from anyone and never hidden from (they have to see everyone to moderate).

  This keeps the pairs in memory for the players who are online: loadBlocks(userId) when a player
  connects reads both directions from the database.
*/
const hide = new Map();     // userId -> Set of userIds hidden from them (both directions)
const loaded = new Set();   // users whose pairs are in memory

const S = (id) => String(id || "");
function add(a, b) {
  if (!hide.has(a)) hide.set(a, new Set());
  hide.get(a).add(b);
}
function del(a, b) {
  const s = hide.get(a);
  if (!s) return;
  s.delete(b);
  if (!s.size) hide.delete(a);
}

export async function loadBlocks(userId) {
  const id = S(userId);
  if (!id || loaded.has(id)) return;
  const [meU, them] = await Promise.all([User.findById(id).select("blocked").lean(), User.find({ blocked: id }).select("_id").lean()]);
  for (const b of meU?.blocked || []) { add(id, S(b)); add(S(b), id); }
  for (const u of them) { add(id, S(u._id)); add(S(u._id), id); }
  loaded.add(id);
}
// are these two players ghosts to each other?
export const ghosts = (a, b) => !!(a && b && hide.get(S(a))?.has(S(b)));
// does this player have any ghosts at all? (then their updates can't go to the whole room at once)
export const hasGhosts = (a) => !!hide.get(S(a))?.size;
// a block was added (on) or taken away (on = false: neither blocks the other any more)
export function setPair(a, b, on) {
  a = S(a); b = S(b);
  if (on) { add(a, b); add(b, a); }
  else { del(a, b); del(b, a); }
}
export const _test = { hide, loaded };
