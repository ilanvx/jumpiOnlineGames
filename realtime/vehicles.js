import { User } from "../models/User.js";
import { ghosts, hasGhosts } from "./blocks.js";
import { VEHICLES, VEH_SUMMON_GAP_MS, VEH_REACH, vehicleOf } from "../public/shared/vehicles.js";
import { PARK_FREE_MS, parkingAt, inCave, inLake, WORLD_BOUNDS } from "../public/shared/city-layout.js";

/*
  Vehicles in the open world (public/shared/vehicles.js). The server keeps where every vehicle is and who rides it:
  - one vehicle out per player ("veh:summon" from the phone's Garage), only for vehicles the player owns;
  - only the owner can get on ("veh:ride") and off ("veh:park");
  - parked outside a parking lot it is towed after PARK_FREE_MS; a vehicle whose owner left the game goes after a while too;
  - an invisible admin's vehicle is only shown to admins (like the admin).
  While someone rides, the vehicle simply goes where that player goes (their normal "move" messages).
*/
const ROOM = "plaza";
const OFFLINE_MS = 3 * 60 * 1000;   // a vehicle whose owner is gone this long is put away
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

function state(io) {
  if (io.__veh) return io.__veh;
  const S = (io.__veh = { byOwner: new Map(), io });
  // tow trucks and tidying, every 2 seconds
  setInterval(() => {
    const now = Date.now();
    for (const v of [...S.byOwner.values()]) {
      if (v.rider) continue;
      if (v.towAt && now >= v.towAt) gone(S, v, "tow");
      else if (v.offSince && now - v.offSince > OFFLINE_MS) gone(S, v, "away");
    }
  }, 2000).unref?.();
  return S;
}
const view = (v) => ({ o: v.owner, n: v.name, i: v.i, x: +v.x.toFixed(2), z: +v.z.toFixed(2), f: +v.f.toFixed(3), r: v.rider || null, tow: v.towAt ? Math.max(0, v.towAt - Date.now()) : 0 });
// tell everyone in the open world (an invisible admin's vehicle: admins only)
// (the vehicle of a player someone blocked: not to them, realtime/blocks.js)
const seesVeh = (p, v) => p.role === "admin" || (!v.hidden && !ghosts(p.userId, v.owner));
function send(S, v, event, data) {
  if (!v.hidden && !hasGhosts(v.owner)) return S.io.to(ROOM).emit(event, data);
  for (const p of S.players.values()) if (p.room === ROOM && seesVeh(p, v)) S.io.to(p.id).emit(event, data);
}
function gone(S, v, why) {
  S.byOwner.delete(v.owner);
  send(S, v, "veh:gone", { o: v.owner, why });
  if (why === "tow") S.emitToUser(v.owner, "veh:towed", { i: v.i });
}
function park(S, v, x, z, f) {
  v.rider = null;
  v.x = clampN(x, WORLD_BOUNDS.x0, WORLD_BOUNDS.x1);
  v.z = clampN(z, WORLD_BOUNDS.z0, WORLD_BOUNDS.z1);
  v.f = f;
  v.towAt = parkingAt(v.x, v.z) ? 0 : Date.now() + PARK_FREE_MS;
}

// the vehicles a player sees when they come into the open world
export function sendVehicles(io, socket, viewer) {
  const S = io.__veh;
  if (!S) return;
  socket.emit("veh:all", [...S.byOwner.values()].filter((v) => seesVeh(viewer, v)).map(view));
}
// a player left the open world (closed the game, went home or into a shop): their vehicle stays where it is, parked
export function vehiclePlayerLeft(io, socketId, p) {
  const S = io.__veh;
  if (!S || !p) return;
  const v = S.byOwner.get(p.userId);
  if (!v) return;
  if (v.rider === socketId) {
    park(S, v, p.x, p.z, p.face || 0);
    send(S, v, "veh:set", view(v));
  }
  // not in the open world any more in any window: start the "owner gone" clock
  setTimeout(() => {
    if (![...S.players.values()].some((q) => q.userId === p.userId && q.room === ROOM) && S.byOwner.get(p.userId) === v) v.offSince = Date.now();
  }, 3000);
}
export function vehiclePlayerBack(io, p) {
  const v = io.__veh?.byOwner.get(p.userId);
  if (v) v.offSince = 0;
}

export function attachVehicles(io, socket, { players, limiter, emitToUser }) {
  const S = state(io);
  S.players = players;
  S.emitToUser = emitToUser;
  const canAct = limiter(12, 10_000);
  const reply = (ack) => (typeof ack === "function" ? ack : () => {});
  const here = () => {
    const p = players.get(socket.id);
    return p && p.room === ROOM ? p : null;
  };
  const owns = async (userId, i) => {
    const u = await User.findById(userId);
    return !!u && !u.isBanned() && u.ownedItems().has(`vehicle:${i}`);
  };

  socket.on("veh:summon", async (d, ack) => {
    const r = reply(ack), p = here();
    if (!p) return r({ error: "Vehicles only work outside, in the open world." });
    if (!canAct()) return r({ error: "Slow down a little!" });
    const i = Number(d?.i), def = vehicleOf(i);
    if (!def) return r({ error: "That vehicle doesn't exist." });
    if (inCave(p.x, p.z)) return r({ error: "There's no room for a vehicle in here!" });
    if (inLake(p.x, p.z, 1)) return r({ error: "Get out of the water first!" });
    const old = S.byOwner.get(p.userId);
    if (old?.rider) return r({ error: "Get off your vehicle first." });
    if (old && Date.now() - (old.at || 0) < VEH_SUMMON_GAP_MS) return r({ error: "Wait a moment before calling another one." });
    try {
      if (!(await owns(p.userId, i))) return r({ error: "You don't own that vehicle yet. Find it in the Shop!" });
    } catch {
      return r({ error: "Something went wrong. Try again." });
    }
    if (old) gone(S, old, "swap");
    // next to the player (to their right), facing the same way; the game moves it out of walls if needed
    const f = num(p.face), x = p.x + Math.cos(f) * 1.7, z = p.z - Math.sin(f) * 1.7;
    const v = { owner: p.userId, name: p.username, i, x: 0, z: 0, f: 0, rider: null, towAt: 0, at: Date.now(), hidden: !!p.invisible, offSince: 0 };
    park(S, v, num(d?.x, x), num(d?.z, z), f);
    if (Math.hypot(v.x - p.x, v.z - p.z) > 4) park(S, v, x, z, f);   // the page may pick a free spot, but only right next to you
    S.byOwner.set(p.userId, v);
    send(S, v, "veh:set", view(v));
    r({ ok: true, veh: view(v) });
  });

  socket.on("veh:ride", async (d, ack) => {
    const r = reply(ack), p = here();
    if (!p) return r({ error: "Not in the open world." });
    if (!canAct()) return r({ error: "Slow down a little!" });
    const v = S.byOwner.get(p.userId);
    if (!v) return r({ error: "Call your vehicle from the Garage app first." });
    if (v.rider && v.rider !== socket.id) return r({ error: "You're already riding it in another window." });
    if (Math.hypot(v.x - p.x, v.z - p.z) > VEH_REACH + 1.5) return r({ error: "Walk up to your vehicle first." });
    try {
      if (!(await owns(p.userId, v.i))) { gone(S, v, "away"); return r({ error: "You don't own that vehicle any more." }); }
    } catch {
      return r({ error: "Something went wrong. Try again." });
    }
    v.rider = socket.id;
    v.towAt = 0;
    v.offSince = 0;
    send(S, v, "veh:set", view(v));
    r({ ok: true, veh: view(v) });
  });

  socket.on("veh:park", (d, ack) => {
    const r = reply(ack), p = here();
    const v = p && S.byOwner.get(p.userId);
    if (!v || v.rider !== socket.id) return r({ error: "You're not riding." });
    // where the page says it stopped, if that's really where the player is
    const x = num(d?.x, p.x), z = num(d?.z, p.z);
    if (Math.hypot(x - p.x, z - p.z) < 3) park(S, v, x, z, num(d?.f, p.face));
    else park(S, v, p.x, p.z, num(p.face));
    send(S, v, "veh:set", view(v));
    r({ ok: true, veh: view(v) });
  });

  socket.on("veh:away", (d, ack) => {
    const r = reply(ack), p = players.get(socket.id);
    const v = p && S.byOwner.get(p.userId);
    if (!v) return r({ ok: true });
    if (v.rider && v.rider !== socket.id) return r({ error: "You're riding it in another window." });
    gone(S, v, "away");
    r({ ok: true });
  });
}

export const VEHICLE_COUNT = VEHICLES.length;
