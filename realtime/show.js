import { User } from "../models/User.js";
import { AdminLog, logQuietly } from "../models/Logs.js";
import { addLevelXp } from "../routes/levels.js";
import { checkText } from "../public/shared/profanity.js";
import { SHOW_SEATS, WHEEL, WHEEL_SPIN_MS, WHEEL_BUDGET, SHOW_GIFT_MAX, POLL_SECS, HANGMAN_LIVES } from "../public/shared/show.js";

/*
  The Jumpi Show ("משחקי המשגיחים"), the server side. One show at a time. A moderator or an admin opens it whenever
  they like (no schedule): every player in the game gets a note at the top with a way in (also the ones who come in
  later, until it closes). The players in it are in the room "show" (realtime/plaza.js "join" with show: true), so the
  chat, its filter and the moderation all work like everywhere else.
  Seats: the first SHOW_SEATS players get a place on the stage (front row first, middle first); the rest are viewers.
  The host moves people between the stage and the viewers, and runs the activities. Everything a moderator gives
  comes out of their monthly budget (like the coins in the admin window); every prize and gift is in the admin log.
  The prize wheel is free and only the host hands it out: nobody can buy a spin (not gambling).
*/
const ROOM = "show";
const S = fresh();
function fresh() {
  return { open: false, hostUid: null, hostSid: null, hostName: "", openedAt: 0, seats: Array(SHOW_SEATS).fill(null),
    poll: null, country: null, hangman: null, wheel: null, leaving: new Set() };
}
let ioRef = null, playersRef = null;
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
  return changed;
}
function viewers() {
  const seated = new Set(S.seats.filter(Boolean));
  return [...playersRef.values()].filter((p) => p.room === ROOM && !seated.has(p.id) && p.id !== S.hostSid && !p.invisible);
}
// what every window in the show sees
function view() {
  const H = S.hangman;
  return {
    open: S.open, host: S.hostName, hostSid: S.hostSid, seats: S.seats, viewers: viewers().length,
    poll: S.poll ? { q: S.poll.q, opts: S.poll.opts, ends: S.poll.ends, done: S.poll.done || false, counts: S.poll.done ? counts() : null } : null,
    country: S.country,
    hangman: H ? { mask: [...H.word].map((ch) => (ch === " " || H.got.has(ch) || H.done ? ch : "_")).join(""), used: [...H.used], wrong: H.wrong, lives: HANGMAN_LIVES, done: H.done || "" } : null,
    wheel: S.wheel ? { sid: S.wheel.sid, state: S.wheel.state, slice: S.wheel.state === "spin" ? S.wheel.slice : null, at: S.wheel.at || 0 } : null,
  };
}
function counts() { const c = S.poll.opts.map(() => 0); for (const i of S.poll.votes.values()) c[i]++; return c; }
function push() { if (ioRef) { prune(); ioRef.to(ROOM).emit("show:state", view()); } }
function fx(d) { ioRef?.to(ROOM).emit("show:fx", d); }

// a player came into the show room (plaza.js calls this after "join")
export function showJoined(p) {
  if (!S.open) return;
  prune();
  if (p.userId === S.hostUid) S.hostSid = p.id;
  else if (!S.seats.includes(p.id) && !p.invisible) {
    const free = S.seats.indexOf(null);
    if (free >= 0) S.seats[free] = p.id;   // a place on the stage while there is one; otherwise a viewer
  }
  push();
}
export function showLeft() { if (S.open && prune()) push(); }

function closeShow(by) {
  if (!S.open) return;
  ioRef.to(ROOM).emit("show:closed", { by });
  ioRef.emit("show:off");
  clearTimeout(S.pollT);
  Object.assign(S, fresh());
}

export function attachShow(io, socket, { players, me, limiter, spendModBudget, modBudgetLeft, addCoins, notifyMember, socketIp }) {
  ioRef = io; playersRef = players;
  const canHost = limiter(30, 10_000), canPlay = limiter(10, 5_000), canGuess = limiter(1, 1_200);
  const self = () => players.get(socket.id);
  const fail = (r, message) => r({ error: message });
  const ack = (cb) => (typeof cb === "function" ? cb : () => {});
  const isHost = () => S.open && (me.id === S.hostUid || me.role === "admin") && inShow(socket.id);
  const audit = (action, target, details) => logQuietly(AdminLog, { adminId: me._id || me.id, admin: me.username, action, targetId: target?._id, target: target?.username || "", details, via: "game", ip: socketIp(socket) });
  const userOf = async (sid) => { const p = inShow(sid); return p ? User.findById(p.userId) : null; };
  // a moderator pays prizes and gifts from their monthly budget; admins don't
  const spend = async (n) => {
    if (me.role !== "mod" || !n) return true;
    const mod = await User.findById(me.id);
    return (await spendModBudget(mod, n)) !== null;
  };

  // ---- opening and closing ----
  socket.on("show:open", async (_d, cb) => {
    const r = ack(cb);
    if (!isStaff(me) || !canHost()) return fail(r, "Only moderators and admins can open a show.");
    if (S.open) return fail(r, `${S.hostName} is already running a show.`);
    Object.assign(S, fresh(), { open: true, hostUid: me.id, hostName: me.username, openedAt: Date.now() });
    io.emit("show:on", showBanner());
    audit("show:open", null, "");
    r({ ok: true });
  });
  socket.on("show:close", (_d, cb) => {
    const r = ack(cb);
    if (!S.open || !(me.id === S.hostUid || me.role === "admin")) return fail(r, "Only the host can end the show.");
    audit("show:close", null, "");
    closeShow(me.username);
    r({ ok: true });
  });

  // ---- the stage ----
  socket.on("show:act", (d) => {   // a player on the stage jumps or waves (fixed animations only: nothing to stream)
    if (!canPlay() || !S.seats.includes(socket.id)) return;
    const a = d?.a === "wave" ? "wave" : "jump";
    fx({ k: "act", sid: socket.id, a });
  });
  socket.on("show:fx", (d) => {
    if (!isHost() || !canHost()) return;
    const k = String(d?.k || "");
    if (k === "confetti" || k === "balloons") fx({ k });
    else if (k === "spot") {   // the spotlight wanders over the stage and stops on someone
      const on = S.seats.filter(Boolean);
      if (on.length) fx({ k: "spot", sid: on[Math.floor(Math.random() * on.length)], at: Date.now() });
    }
  });
  // off the stage (to the viewers) with a funny exit: a hole, a "poof" of confetti, or flying away on a balloon
  socket.on("show:down", (d) => {
    if (!isHost() || !canHost()) return;
    const ids = d?.all ? S.seats.filter(Boolean) : [String(d?.sid || "")].filter((id) => S.seats.includes(id));
    if (!ids.length) return;
    const style = ["hole", "poof", "balloon"].includes(d?.style) ? d.style : "poof";
    ids.forEach((sid) => S.leaving.add(sid));
    fx({ k: "down", sids: ids, style });
    setTimeout(() => { S.seats = S.seats.map((sid) => (ids.includes(sid) ? null : sid)); ids.forEach((sid) => S.leaving.delete(sid)); push(); }, 1700);
  });
  socket.on("show:up", (d, cb) => {   // a viewer up to the stage (in a free place, or instead of someone who goes down)
    const r = ack(cb);
    if (!isHost() || !canHost()) return fail(r, "Only the host can do that.");
    const sid = String(d?.sid || ""), down = String(d?.swap || "");
    if (!inShow(sid) || S.seats.includes(sid) || sid === S.hostSid) return fail(r, "That player isn't watching right now.");
    let i = down && S.seats.includes(down) ? S.seats.indexOf(down) : S.seats.indexOf(null);
    if (i < 0) return fail(r, "The stage is full. Pick someone to swap with.");
    S.seats[i] = sid;
    push();
    r({ ok: true });
  });
  socket.on("show:remove", (d, cb) => {   // send a player out of the show (back to the world)
    const r = ack(cb);
    if (!isHost() || !canHost()) return fail(r, "Only the host can do that.");
    const t = inShow(String(d?.sid || ""));
    if (!t || t.id === socket.id || t.role === "admin") return fail(r, "You can't send that player out.");
    S.seats = S.seats.map((sid) => (sid === t.id ? null : sid));
    io.to(t.id).emit("show:removed", { by: me.username });
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

  // ---- Country-City: a band at the top with the category and the letter the host picked ----
  socket.on("show:country", (d) => {
    if (!isHost() || !canHost()) return;
    if (d?.clear) S.country = null;
    else {
      const cat = String(d?.cat || "").trim().slice(0, 24), letter = String(d?.letter || "").trim().slice(0, 1).toUpperCase();
      if (!cat || !/^[A-Zא-ת]$/.test(letter) || !checkText(cat).ok) return;
      S.country = { cat, letter };
    }
    push();
  });

  // ---- Hangman (with balloons: a wrong letter pops one) ----
  socket.on("show:hangman", (d, cb) => {
    const r = ack(cb);
    if (!isHost() || !canHost()) return fail(r, "Only the host can start Hangman.");
    if (d?.clear) { S.hangman = null; push(); return r({ ok: true }); }
    const word = String(d?.word || "").trim().toUpperCase().replace(/\s+/g, " ").slice(0, 20);
    if (!/^[A-Zא-ת ]{2,20}$/.test(word) || !word.replace(/ /g, "")) return fail(r, "Use only letters (2 to 20).");
    if (!checkText(word).ok) return fail(r, "Let's keep it friendly: pick another word.");
    S.hangman = { word, got: new Set(), used: new Set(), wrong: 0, done: "" };
    push();
    r({ ok: true });
  });
  socket.on("show:guess", (d) => {
    const H = S.hangman, l = String(d?.l || "").toUpperCase().slice(0, 1);
    if (!H || H.done || !inShow(socket.id) || !canGuess() || !/^[A-Zא-ת]$/.test(l) || H.used.has(l)) return;
    H.used.add(l);
    if (H.word.includes(l)) H.got.add(l); else H.wrong++;
    const all = [...H.word].every((ch) => ch === " " || H.got.has(ch));
    if (all) { H.done = "win"; fx({ k: "confetti" }); }
    else if (H.wrong >= HANGMAN_LIVES) H.done = "lose";
    fx({ k: "guess", by: self()?.username || "", l, ok: H.word.includes(l) });
    push();
  });

  // ---- the prize wheel ----
  socket.on("show:wheel", async (d, cb) => {
    const r = ack(cb);
    if (!isHost() || !canHost()) return fail(r, "Only the host can give the wheel.");
    const sid = String(d?.sid || "");
    if (!S.seats.includes(sid)) return fail(r, "Give the wheel to a player on the stage.");
    if (S.wheel && S.wheel.state === "spin") return fail(r, "The wheel is still turning.");
    if (me.role === "mod") {   // the biggest prize has to fit in what's left of the month
      const mod = await User.findById(me.id), most = Math.max(...WHEEL.map((s) => cost(s)));
      if (modBudgetLeft(mod) < most) return fail(r, `Not enough budget for the wheel (it needs ${most.toLocaleString("en-US")} coins left this month).`);
    }
    S.wheel = { sid, uid: inShow(sid).userId, state: "ready", by: me.username, byRole: me.role, byId: me.id };
    push();
    r({ ok: true });
  });
  socket.on("show:spin", async () => {
    const W = S.wheel;
    if (!W || W.state !== "ready" || W.sid !== socket.id) return;
    let t = Math.random() * WHEEL.reduce((a, s) => a + s.weight, 0), slice = 0;
    for (; slice < WHEEL.length - 1; slice++) { t -= WHEEL[slice].weight; if (t < 0) break; }
    const prize = WHEEL[slice];
    // a moderator's wheel: the prize comes out of their budget now (if that fails, it lands on "Nothing")
    if (W.byRole === "mod" && cost(prize)) {
      const mod = await User.findById(W.byId);
      if (!mod || (await spendModBudget(mod, cost(prize))) === null) slice = WHEEL.findIndex((s) => s.k === "skull");
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
    if (t.userId === me.id) return fail(r, "Not to yourself.");
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
export function showTick() { if (S.open && prune()) push(); }
