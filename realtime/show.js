import { User } from "../models/User.js";
import { AdminLog, logQuietly } from "../models/Logs.js";
import { addLevelXp } from "../routes/levels.js";
import { checkText } from "../public/shared/profanity.js";
import { SHOW_SEATS, WHEEL, WHEEL_SPIN_MS, WHEEL_BUDGET, SHOW_GIFT_MAX, POLL_SECS } from "../public/shared/show.js";

/*
  The Jumpi Show ("משחקי המשגיחים"), the server side. One show at a time. A moderator or an admin opens it whenever
  they like (no schedule): every player in the game gets a note at the top with a way in (also the ones who come in
  later, until it closes). The players in it are in the room "show" (realtime/plaza.js "join" with show: true), so the
  chat, its filter and the moderation all work like everywhere else.
  Seats: the first SHOW_SEATS players get a place on the stage (front row first, middle first); the rest are viewers.
  Only the one who opened the show runs it (other admins and moderators in it are like everyone else). The host moves
  people between the stage and the viewers, and runs the activities. Everything a moderator gives
  comes out of their monthly budget (like the coins in the admin window); every prize and gift is in the admin log.
  The prize wheel is free and only the host hands it out: nobody can buy a spin (not gambling).
*/
const ROOM = "show";
const S = fresh();
function fresh() {
  return { shuffling: false, open: false, hostUid: null, hostSid: null, hostName: "", openedAt: 0, seats: Array(SHOW_SEATS).fill(null),
    poll: null, wheel: null, spot: null, leaving: new Set(), kicked: new Set(), wasOn: new Set(), hostGoneAt: 0 };
}
let ioRef = null, playersRef = null, H = { dropPlayer: () => {}, setInvisible: () => {} };
// plaza.js hands over what the show needs from it (taking a player out of a room, an admin's invisibility)
export function initShow(helpers) { H = { ...H, ...helpers }; }
// a player the host sent out can't come back into this show
export const showRefused = (userId) => S.open && S.kicked.has(String(userId));
const isStaff = (u) => u && (u.role === "admin" || u.role === "mod");
export const showIsOpen = () => S.open;
export const showBanner = () => (S.open ? { host: S.hostName, at: S.openedAt } : null);

function inShow(sid) { const p = playersRef?.get(sid); return p && p.room === ROOM ? p : null; }
// players who left the show (closed the window, went back to the world): their seat is free again
function prune() {
  let changed = false;
  S.seats = S.seats.map((sid) => { if (sid && !inShow(sid)) { changed = true; return null; } return sid; });
  if (S.hostSid && !inShow(S.hostSid)) { S.hostSid = null; changed = true; }
  if (S.wheel && !inShow(S.wheel.sid) && S.wheel.state === "ready") { S.wheel = null; changed = true; }
  if (S.spot && !S.seats.includes(S.spot)) { S.spot = null; changed = true; }   // the spotlight goes off when its player leaves the stage
  return changed;
}
function viewers() {
  const seated = new Set(S.seats.filter(Boolean));
  return [...playersRef.values()].filter((p) => p.room === ROOM && !seated.has(p.id) && p.id !== S.hostSid && !p.invisible);
}
// what every window in the show sees
function view() {
  return {
    open: S.open, host: S.hostName, hostSid: S.hostSid, seats: S.seats, viewers: viewers().length, spot: S.spot,
    poll: S.poll ? { q: S.poll.q, opts: S.poll.opts, ends: S.poll.ends, done: S.poll.done || false, counts: S.poll.done ? counts() : null } : null,
    wheel: S.wheel ? { sid: S.wheel.sid, state: S.wheel.state, slice: S.wheel.state === "spin" ? S.wheel.slice : null, at: S.wheel.at || 0 } : null,
  };
}
function counts() { const c = S.poll.opts.map(() => 0); for (const i of S.poll.votes.values()) c[i]++; return c; }
function push() { if (ioRef) { prune(); ioRef.to(ROOM).emit("show:state", view()); } }
function fx(d) { ioRef?.to(ROOM).emit("show:fx", d); }

// a seat for a player (remembered, so a shuffle gives the next turns to the ones who weren't up yet)
function seat(i, sid) { S.seats[i] = sid; const p = inShow(sid); if (p) S.wasOn.add(String(p.userId)); }
// a player came into the show room (plaza.js calls this after "join")
export function showJoined(p) {
  if (!S.open) return;
  prune();
  if (p.userId === S.hostUid) { S.hostSid = p.id; if (p.invisible) H.setInvisible(p.userId, false); }   // the kids have to see the host
  else if (!S.seats.includes(p.id) && !p.invisible) {
    const free = S.seats.indexOf(null);
    if (free >= 0) seat(free, p.id);   // a place on the stage while there is one; otherwise a viewer
  }
  push();
}
export function showLeft() { if (S.open && prune()) push(); }

function closeShow(by) {
  if (!S.open) return;
  ioRef.to(ROOM).emit("show:closed", { by });
  ioRef.emit("show:off");
  for (const p of [...playersRef.values()]) if (p.room === ROOM) H.dropPlayer(p.id, ioRef.sockets.sockets.get(p.id));   // out of the room on the server too (their windows join the Plaza again)
  clearTimeout(S.pollT);
  Object.assign(S, fresh());
}

export function attachShow(io, socket, { players, me, limiter, spendModBudget, modBudgetLeft, addCoins, notifyMember, socketIp }) {
  ioRef = io; playersRef = players;
  const canHost = limiter(30, 10_000);
  const self = () => players.get(socket.id);
  const fail = (r, message) => r({ error: message });
  const ack = (cb) => (typeof cb === "function" ? cb : () => {});
  // only the one who opened the show runs it: other admins and moderators who come in are like everyone else
  const isHost = () => S.open && isStaff(me) && me.id === S.hostUid && inShow(socket.id);
  // the role right now in the database (a moderator who was just removed can't open, give or hand out prizes)
  const freshStaff = async () => { const u = await User.findById(me.id); if (u) me.role = u.role; return u && isStaff(u) ? u : null; };
  const audit = (action, target, details) => logQuietly(AdminLog, { adminId: me._id || me.id, admin: me.username, action, targetId: target?._id, target: target?.username || "", details, via: "game", ip: socketIp(socket) });
  const userOf = async (sid) => { const p = inShow(sid); return p ? User.findById(p.userId) : null; };
  // a moderator pays prizes and gifts from their monthly budget; admins don't
  const spend = async (n) => {
    if (!n) return true;
    const u = await User.findById(me.id);
    if (u?.role === "admin") return true;
    if (u?.role !== "mod") return false;
    return (await spendModBudget(u, n)) !== null;
  };

  // ---- opening and closing ----
  socket.on("show:open", async (_d, cb) => {
    const r = ack(cb);
    if (!canHost() || !(await freshStaff())) return fail(r, "Only moderators and admins can open a show.");
    if (S.open) return fail(r, `${S.hostName} is already running a show.`);
    Object.assign(S, fresh(), { open: true, hostUid: me.id, hostName: me.username, openedAt: Date.now() });
    io.emit("show:on", showBanner());
    audit("show:open", null, "");
    r({ ok: true });
  });
  socket.on("show:close", (_d, cb) => {
    const r = ack(cb);
    // the host ends it; an admin can too, but only when the host isn't in the show any more (a show left behind)
    if (!S.open || !(me.id === S.hostUid || (me.role === "admin" && !S.hostSid))) return fail(r, "Only the host can end the show.");
    audit("show:close", null, "");
    closeShow(me.username);
    r({ ok: true });
  });

  // ---- the stage ----
  socket.on("show:fx", (d) => {
    if (!isHost() || !canHost()) return;
    const k = String(d?.k || "");
    if (k === "confetti" || k === "balloons") fx({ k });
    else if (k === "spot") {   // the spotlight wanders over the stage and stops on someone (or on the one the host picked); it stays until the host turns it off
      const want = String(d?.sid || ""), on = S.seats.filter(Boolean);
      const sid = want && S.seats.includes(want) ? want : on.length ? on[Math.floor(Math.random() * on.length)] : null;
      if (sid) { S.spot = sid; fx({ k: "spot", sid, at: Date.now() }); push(); }
    } else if (k === "spotoff") { if (S.spot) { S.spot = null; push(); } }
  });
  // off the stage (to the viewers) with a funny exit: a hole, a "poof" of confetti, or flying away on a balloon
  socket.on("show:down", (d) => {
    if (!isHost() || !canHost()) return;
    const ids = d?.all ? S.seats.filter(Boolean) : [String(d?.sid || "")].filter((id) => S.seats.includes(id));
    if (!ids.length) return;
    const style = ["hole", "poof", "balloon"].includes(d?.style) ? d.style : "poof";
    ids.forEach((sid) => S.leaving.add(sid));
    fx({ k: "down", sids: ids, style });
    const show = S.openedAt;   // the same show still (not closed / reopened meanwhile)
    setTimeout(() => { if (!S.open || S.openedAt !== show) return; S.seats = S.seats.map((sid) => (ids.includes(sid) ? null : sid)); ids.forEach((sid) => S.leaving.delete(sid)); push(); }, 1700);
  });
  // new players on the stage: everyone goes down, and players picked at random from the whole show come up, first the
  // ones who haven't been on the stage yet in this show (then the rest, and the ones who just went down last of all)
  socket.on("show:shuffle", (d, cb) => {
    const r = ack(cb);
    if (!isHost() || !canHost()) return fail(r, "Only the host can do that.");
    if (S.wheel) return fail(r, "Wait for the wheel to finish.");
    if (S.shuffling) return fail(r, "New players are already on their way.");
    prune();
    const down = S.seats.filter(Boolean);
    const pool = [...playersRef.values()].filter((p) => p.room === ROOM && p.id !== S.hostSid && p.userId !== S.hostUid && !p.invisible && !S.leaving.has(p.id));
    if (!pool.length) return fail(r, "Nobody is in the show yet.");
    const mix = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const fresh = mix(pool.filter((p) => !S.wasOn.has(String(p.userId)))), again = mix(pool.filter((p) => S.wasOn.has(String(p.userId)) && !down.includes(p.id))), last = mix(pool.filter((p) => S.wasOn.has(String(p.userId)) && down.includes(p.id)));
    const up = [...fresh, ...again, ...last].slice(0, SHOW_SEATS).map((p) => p.id);
    S.spot = null;
    down.forEach((sid) => S.leaving.add(sid));
    if (down.length) fx({ k: "down", sids: down, style: "poof" });
    const show = S.openedAt;S.shuffling = true;
    setTimeout(() => {
      if (!S.open || S.openedAt !== show) return;
      S.shuffling = false;
      down.forEach((sid) => S.leaving.delete(sid));
      S.seats = Array(SHOW_SEATS).fill(null);
      up.filter((sid) => inShow(sid)).forEach((sid, i) => seat(i, sid));
      fx({ k: "up" });
      push();
    }, down.length ? 1700 : 0);
    r({ ok: true, n: up.length });
  });
  socket.on("show:up", (d, cb) => {   // a viewer up to the stage (in a free place, or instead of someone who goes down)
    const r = ack(cb);
    if (!isHost() || !canHost()) return fail(r, "Only the host can do that.");
    const sid = String(d?.sid || ""), down = String(d?.swap || "");
    if (S.shuffling) return fail(r, "Wait a moment: new players are coming up.");
    if (S.leaving.has(down)) return fail(r, "That player is already going down.");
    const t = inShow(sid);
    if (!t || S.seats.includes(sid) || sid === S.hostSid || t.userId === S.hostUid || t.userId === me.id || t.invisible) return fail(r, "That player isn't watching right now.");
    let i = down && S.seats.includes(down) ? S.seats.indexOf(down) : S.seats.indexOf(null);
    if (i < 0) return fail(r, "The stage is full. Pick someone to swap with.");
    if (S.seats[i] && S.spot === S.seats[i]) S.spot = null;
    seat(i, sid);
    push();
    r({ ok: true });
  });
  socket.on("show:remove", (d, cb) => {   // send a player out of the show (back to the world)
    const r = ack(cb);
    if (!isHost() || !canHost()) return fail(r, "Only the host can do that.");
    const t = inShow(String(d?.sid || ""));
    if (!t || t.id === socket.id || t.role === "admin") return fail(r, "You can't send that player out.");
    S.seats = S.seats.map((sid) => (sid === t.id ? null : sid));
    S.kicked.add(String(t.userId));
    io.to(t.id).emit("show:removed", { by: me.username });
    H.dropPlayer(t.id, io.sockets.sockets.get(t.id));
    audit("show:remove", { _id: t.userId, username: t.username }, "");
    push();
    r({ ok: true });
  });
  socket.on("show:viewers", (_d, cb) => {   // the host's list of viewers (the eye button)
    const r = ack(cb);
    if (!isHost()) return fail(r, "Only the host sees the list.");
    r({ viewers: viewers().map((p) => ({ id: p.id, username: p.username, lv: p.lv || 1, role: p.role })) });
  });

  // ---- a quick poll: 2-4 answers for a few seconds; players and viewers vote ----
  socket.on("show:poll", (d, cb) => {
    const r = ack(cb);
    if (!isHost() || !canHost()) return fail(r, "Only the host can start a poll.");
    const q = String(d?.q || "").trim().slice(0, 80), opts = (Array.isArray(d?.opts) ? d.opts : []).map((o) => String(o || "").trim().slice(0, 30)).filter(Boolean).slice(0, 4);
    if (!q || opts.length < 2) return fail(r, "Write a question and 2 to 4 answers.");
    if ([q, ...opts].some((t) => !checkText(t).ok)) return fail(r, "Let's keep it friendly: change the words.");
    const secs = POLL_SECS.includes(+d?.secs) ? +d.secs : POLL_SECS[1];
    clearTimeout(S.pollT);
    S.poll = { q, opts, votes: new Map(), ends: Date.now() + secs * 1000 };
    S.pollT = setTimeout(() => { if (!S.poll) return; S.poll.done = true; push(); S.pollT = setTimeout(() => { S.poll = null; push(); }, 12_000); }, secs * 1000);
    push();
    r({ ok: true });
  });
  socket.on("show:vote", (d) => {
    const P = S.poll, i = Math.floor(+d?.i);
    if (!P || P.done || !inShow(socket.id) || !(i >= 0 && i < P.opts.length)) return;
    const uid = self()?.userId;
    if (!uid || P.votes.has(uid)) return;   // one vote per player
    P.votes.set(uid, i);
    socket.emit("show:voted", { i });
  });

  // ---- the prize wheel ----
  socket.on("show:wheel", async (d, cb) => {
    const r = ack(cb);
    if (!isHost() || !canHost()) return fail(r, "Only the host can give the wheel.");
    const sid = String(d?.sid || ""), t = inShow(sid);
    if (!t || !S.seats.includes(sid)) return fail(r, "Give the wheel to a player on the stage.");
    if (S.shuffling || S.leaving.has(sid)) return fail(r, "That player is going down. Pick someone else.");
    if (t.userId === me.id || t.userId === S.hostUid) return fail(r, "Not to yourself.");
    if (S.wheel && S.wheel.state !== "ready") return fail(r, "The wheel is still turning.");
    const u = await freshStaff();
    if (!u) return fail(r, "Only moderators and admins can do that.");
    if (u.role === "mod") {   // the biggest prize has to fit in what's left of the month
      const most = Math.max(...WHEEL.map((s) => cost(s)));
      if (modBudgetLeft(u) < most) return fail(r, `Not enough budget for the wheel (it needs ${most.toLocaleString("en-US")} coins left this month).`);
    }
    if (!inShow(sid) || !S.seats.includes(sid)) return fail(r, "That player left the stage.");
    S.wheel = { sid, uid: t.userId, state: "ready", by: me.username, byRole: u.role, byId: me.id };
    push();
    r({ ok: true });
  });
  socket.on("show:spin", async () => {
    const W = S.wheel;
    if (!W || W.state !== "ready" || W.sid !== socket.id) return;
    W.state = "picking";   // locked before anything waits: a second press can't spin (or pay) twice
    if (W.uid === W.byId) { S.wheel = null; return push(); }
    let t = Math.random() * WHEEL.reduce((a, s) => a + s.weight, 0), slice = 0;
    for (; slice < WHEEL.length - 1; slice++) { t -= WHEEL[slice].weight; if (t < 0) break; }
    const prize = WHEEL[slice];
    // a moderator's wheel: the prize comes out of their budget now (if that fails, it lands on "Nothing")
    if (cost(prize)) {   // a moderator pays from the month's budget; someone who isn't staff any more gives nothing
      try {
        const giver = await User.findById(W.byId);
        if (!giver || giver.role === "player" || (giver.role === "mod" && (await spendModBudget(giver, cost(prize))) === null)) slice = WHEEL.findIndex((s) => s.k === "skull");
      } catch (err) { if (S.wheel === W) S.wheel = null; push(); throw err; }   // the database didn't answer: no spin (the wheel isn't left stuck)
    }
    Object.assign(W, { state: "spin", slice, at: Date.now() });
    push();
    setTimeout(async () => {
      const P = WHEEL[slice], user = await User.findById(W.uid).catch(() => null);
      if (user && P.k === "coins") await addCoins(user, P.n);
      else if (user && P.k === "xp") await addLevelXp(user._id, P.n, { capped: false, why: "show wheel" });
      else if (user && P.k === "member") {
        const now = new Date(), from = user.memberUntil && user.memberUntil > now ? user.memberUntil : now;
        await User.updateOne({ _id: user._id }, { $set: { memberUntil: new Date(from.getTime() + P.days * 864e5) } });
        notifyMember(user._id.toString(), true);
        io.to(W.sid).emit("show:member", { until: new Date(from.getTime() + P.days * 864e5) });
      }
      if (user && P.k !== "skull") logQuietly(AdminLog, { adminId: W.byId, admin: W.by, action: "show:wheel", targetId: user._id, target: user.username, details: P.label, via: "game" });
      fx({ k: "prize", sid: W.sid, slice, name: user?.username || "" });
      setTimeout(() => { if (S.wheel === W) { S.wheel = null; push(); } }, 6000);
    }, WHEEL_SPIN_MS + 300);
  });

  // ---- coins as a gift, any time ----
  socket.on("show:gift", async (d, cb) => {
    const r = ack(cb);
    if (!isHost() || !canHost()) return fail(r, "Only the host can give coins.");
    const n = Math.round(+d?.coins), t = inShow(String(d?.sid || ""));
    if (!t || t.id === socket.id) return fail(r, "Pick a player in the show.");
    if (!(n >= 1 && n <= SHOW_GIFT_MAX)) return fail(r, `Between 1 and ${SHOW_GIFT_MAX.toLocaleString("en-US")} coins.`);
    if (t.userId === me.id || t.userId === S.hostUid) return fail(r, "Not to yourself.");
    if (!(await spend(n))) return fail(r, "Not enough budget left this month.");
    const user = await User.findById(t.userId);
    if (!user) return fail(r, "That player left.");
    await addCoins(user, n);
    audit("show:gift", user, `+${n}`);
    fx({ k: "gift", sid: t.id, n, name: t.username });
    r({ ok: true });
  });
}
const cost = (s) => { const c = WHEEL_BUDGET[s.k]; return typeof c === "function" ? c(s) : c || 0; };
export function showTick() {
  if (!S.open) return;
  if (prune()) push();
  // the host is gone (closed the game, lost the connection): after 3 minutes the show closes by itself
  if (!S.hostSid) { S.hostGoneAt ||= Date.now(); if (Date.now() - S.hostGoneAt > 3 * 60_000) closeShow(S.hostName); }
  else S.hostGoneAt = 0;
}
