import { activeEvent } from "./events.js";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { banMessage, needsVerify, readToken, parentTime } from "../routes/auth.js";
import { quietNow, isQuickChat } from "../public/shared/parental.js";
import { attachTrading } from "./trade.js";
import { attachDuels } from "./duel.js";
import { attachShow, showJoined, showLeft, showIsOpen, showBanner, showTick, initShow, showRefused } from "./show.js";
import { attachVehicles, sendVehicles, vehiclePlayerLeft, vehiclePlayerBack, vehiclesGhost } from "./vehicles.js";
import { EMOTE_LIST, hasEmote } from "../catalog.js";
import { checkText, FRIENDLY_MESSAGE, splitPhone, PRIVATE_MESSAGE, riskText } from "../public/shared/profanity.js";
import { ANN_STYLES, MOD_STYLE, TIP_BY_ID } from "../public/shared/announce.js";
const MOD_ANNOUNCE_GAP = 2 * 60 * 1000, modAnnounceAt = new Map();   // moderators: one announcement every 2 minutes
import { ChatLog, AdminLog, logQuietly } from "../models/Logs.js";
import { Report } from "../models/Report.js";
import { socketIp } from "../routes/ip.js";
import { playOn, playOff, deviceOf, startPlaytime } from "./playtime.js";
import { needsOnline, needsOffline, sendNeeds, moodNow, ateMeal, startNeeds, bumpNeeds } from "./needs.js";
import { outPet } from "../routes/pets.js";
import { houseShape } from "../public/shared/houses.js";
import { BAR_MENU } from "../public/shared/bar.js";
import { foodOf, PARK_STANDS, PARK_MENU, STAND_REACH, standOf } from "../public/shared/food.js";
import { foodBag, addFood, biteFood, dropFood } from "./food.js";
import { createCode } from "../models/Code.js";
import { JOBS } from "../public/shared/jobs.js";
import { isBirthdayOn } from "../public/shared/birthday.js";
import { LAUNCH_AT, LAUNCH_HOSTS } from "../public/shared/launch.js";
import { WORLD_BOUNDS } from "../public/shared/city-layout.js";
import { modLog } from "../discord/pip.js";
import { loadBlocks, ghosts, hasGhosts } from "./blocks.js";
import { levelOf, MAX_LEVEL } from "../public/shared/levels.js";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
// which version of the game page this server has: a game window that reconnects to a server with a newer page
// reloads itself (and goes straight back into the game), so nobody keeps playing an old page against a new server
const BUILD = (() => { try { return createHash("sha1").update(readFileSync(new URL("../public/index.html", import.meta.url))).digest("hex").slice(0, 12); } catch { return String(Date.now()); } })();
const TOWN_BOUNDS = { x0: -56, x1: 56, z0: -56, z1: 56 };   // Pizza Town (the delivery job), a big map of your own

/*
  Real-time Plaza: everyone in the same room sees each other move, type and chat.
  Rooms: "plaza" (the open world) or "home:<owner>" (a player's home, with its visitors).
  Only logged-in, non-banned players can connect (same login cookie as the website).
  Admins (role "admin" in the database) can kick, ban, mute, announce and give coins.
*/
const ROOM = "plaza";
const COOKIE = "jumpi_token";
// the whole open world: the old heart (Plaza, Beach, Park, Water Park) and the city around it (public/shared/city-layout.js)
const BOUNDS = WORLD_BOUNDS;
const HOME_BOUNDS = { x0: -7.4, x1: 7.4, z0: -5.6, z1: 5.6 };
// homes come in different sizes (bigger room, garden, second floor): the box players may move in, per home room
const homeBounds = new Map();
const boundsOf = (room) => (room === ROOM ? BOUNDS : homeBounds.get(room) || HOME_BOUNDS);
const POSES = new Set(["sit", "sleep", "play", "dance", "lie"]);
const OUTDOOR_POSES = new Set(["sit", "lie"]);   // benches, picnic tables and sun loungers in the open world
// the shops on the Plaza you can walk into (each one is its own room, the same size as a home)
const PLACES = new Set(["furniture", "clothes", "club", "diner", "pets", "lounge"]);   // lounge: the Members Lounge (members and staff only)
const MAX_CHAT = 80;
const MAX_ANNOUNCE = 160;
const EMOTES = new Set(EMOTE_LIST);
const PERMANENT = new Date("9999-12-31T00:00:00Z");

const players = new Map(); // socket.id -> public player info
let ioRef = null;
const mutedUntil = new Map(); // userId -> ms timestamp

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

function readCookie(header, name) {
  for (const part of (header || "").split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function cleanText(text, max = MAX_CHAT) {
  return String(text ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// allow `max` events per `windowMs` for one socket
function limiter(max, windowMs) {
  let stamps = [];
  return () => {
    const now = Date.now();
    stamps = stamps.filter((t) => now - t < windowMs);
    if (stamps.length >= max) return false;
    stamps.push(now);
    return true;
  };
}

// the food someone holds (only for show): { k, i, f } with f = how much is left (0..1)
const cleanHold = (h) => (h && foodOf(h.k, Number(h.i)) ? { k: h.k, i: Number(h.i), f: Math.max(0.05, Math.min(1, Number(h.f) || 1)) } : null);
const publicView = ({ id, username, look, role, x, z, face, moving, status, pose, mood, pet, member, invisible, phone, uniform, bday, hold, lv }) => ({ id, username, look, role, x, z, face, moving, status: status || null, pose: pose || null, mood: mood || null, pet: pet || null, member: !!member, invisible: !!invisible, phone: !!phone, uniform: uniform || null, bday: !!bday, hold: hold || null, lv: lv || 1 });
const UNIFORMS = new Set(Object.keys(JOBS));   // work uniforms other players can see

/* ---------- invisible admins ----------
   An admin can play invisibly (on by default; "adminInvisible" on the User). Then only other admins
   in the same room see them (half see-through); everyone else gets nothing at all from them:
   not their character, moves, chat, emotes, pets, badges, and they don't show as online. */
// may player q see player p? (invisible admins, and players who blocked each other: realtime/blocks.js)
const ghostPair = (q, p) => q.role !== "admin" && p.role !== "admin" && ghosts(q.userId, p.userId);
const sees = (q, p) => (!p.invisible || q.role === "admin") && !ghostPair(q, p);
// send something about player p to the people in p's room who can see p (self: include p's own window)
function roomSend(p, event, data, { self = true, volatile = false } = {}) {
  if (!ioRef) return;
  if (!p.invisible && !hasGhosts(p.userId)) {
    const s = ioRef.sockets.sockets.get(p.id);
    let to = self || !s ? ioRef.to(p.room) : s.to(p.room);
    if (volatile) to = to.volatile;
    return to.emit(event, data);
  }
  for (const q of players.values()) {
    if (q.room !== p.room || !sees(q, p) || (!self && q.id === p.id)) continue;
    (volatile ? ioRef.to(q.id).volatile : ioRef.to(q.id)).emit(event, data);
  }
}
/* Moves: instead of one message per step per player, the server collects them and sends each window ONE "moves"
   message 10 times a second with everyone who moved. Players far from you (more than NEAR) only once a second:
   they're small on the screen, and with lots of players in one place that's most of the traffic. */
const MOVE_MS = 100, NEAR = 70, FAR_EVERY = 10, CLOSE = 32;   // CLOSE: how many of the nearest players get every step
let moveTick = 0;
const r2 = (v) => Math.round(v * 100) / 100;
function flushMoves() {
  if (!ioRef) return;
  moveTick++;
  const farTick = moveTick % FAR_EVERY === 0, byRoom = new Map(), anyMoved = new Set();
  for (const p of players.values()) {
    let l = byRoom.get(p.room);
    if (!l) byRoom.set(p.room, (l = []));
    l.push(p);
    if (p.mv || (farTick && p.farMv)) anyMoved.add(p.room);
  }
  if (!anyMoved.size) return;
  for (const q of players.values()) {
    if (!anyMoved.has(q.room)) continue;
    const list = byRoom.get(q.room);
    // every step only for the players close to me (the CLOSE nearest within NEAR: the game draws about 25 around you);
    // everyone else in the room comes in the once-a-second round. With hundreds of players in one place, sending everyone
    // to everyone 10 times a second was what slowed the server down (a load test: it got stuck from ~300 players)
    let lim = NEAR;
    if (list.length > CLOSE + 1) {
      const d = DIST.length >= list.length ? DIST : (DIST = new Float64Array(list.length * 2));
      let n = 0;
      for (const p of list) if (p !== q) d[n++] = Math.hypot(p.x - q.x, p.z - q.z);
      if (n > CLOSE) lim = Math.min(NEAR, kth(d, n, CLOSE - 1));
    }
    const out = [];
    for (const p of list) {
      if (p === q || !(p.mv || (farTick && p.farMv)) || !sees(q, p)) continue;
      const near = Math.hypot(p.x - q.x, p.z - q.z) <= lim;
      // near: every step. Further away: the once-a-second round (with anyone who moved in the last second, so their last spot arrives too)
      if (near ? !p.mv : !farTick) continue;
      out.push([p.id, r2(p.x), r2(p.z), r2(p.face), (p.moving ? 1 : 0) | (p.run ? 2 : 0), p.pose || 0]);
    }
    if (!out.length) continue;
    // a game page from before this version (until it reloads) only knows "player:move", one player per message
    if (ioRef.sockets.sockets.get(q.id)?.data?.v2) ioRef.to(q.id).volatile.emit("moves", out);
    else for (const m of out) ioRef.to(q.id).volatile.emit("player:move", { id: m[0], x: m[1], z: m[2], face: m[3], moving: !!(m[4] & 1), run: !!(m[4] & 2), pose: m[5] || null });
  }
  for (const p of players.values()) { p.mv = false; if (farTick) p.farMv = false; }
}
// the k-th smallest of the first n numbers in a (0-based; a is reordered): quickselect, no sorting
let DIST = new Float64Array(256);
function kth(a, n, k) {
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const pv = a[(lo + hi) >> 1];
    let i = lo, j = hi;
    while (i <= j) { while (a[i] < pv) i++; while (a[j] > pv) j--; if (i <= j) { const t = a[i]; a[i] = a[j]; a[j] = t; i++; j--; } }
    if (k <= j) hi = j; else if (k >= i) lo = i; else return a[k];
  }
  return a[k];
}
// a new version is going live: every window shows a note (in: seconds until the restart; 0 = now)
export function announceUpdate(seconds) {
  if (ioRef) ioRef.emit("server:update", { in: Math.max(0, Math.round(seconds)) });
}

// turn invisibility on or off for every open window of this admin (from the game banner or the admin website)
export function setInvisible(userId, on) {
  if (!ioRef) return 0;
  let n = 0;
  for (const p of players.values()) {
    if (p.userId !== userId || !!p.invisible === !!on) continue;
    n++;
    p.invisible = !!on;
    for (const q of players.values()) {
      if (q.room !== p.room) continue;
      if (q.id === p.id) ioRef.to(q.id).emit("self:invisible", { on: p.invisible });
      else if (q.role === "admin") ioRef.to(q.id).emit("player:invisible", { id: p.id, on: p.invisible });
      else if (p.invisible) ioRef.to(q.id).emit("player:leave", p.id);
      else ioRef.to(q.id).emit("player:join", publicView(p));
    }
  }
  return n;
}
const roomOf = (sid) => players.get(sid)?.room || ROOM;
// a sitting / sleeping pose: what, how high (seat height) and which way
function cleanPose(p, outdoors = false) {
  if (!p || !POSES.has(p.k) || (outdoors && !OUTDOOR_POSES.has(p.k))) return null;
  return { k: p.k, y: clamp(num(p.y), 0, outdoors ? 60 : 3), f: num(p.f) };
}

// every open game window of one player
function socketsOfUser(userId) {
  if (!ioRef) return [];
  return [...players.values()].filter((p) => p.userId === userId).map((p) => ioRef.sockets.sockets.get(p.id)).filter(Boolean);
}
function dropPlayer(id, sock) {
  if (!players.has(id)) return;
  const room = players.get(id)?.room || ROOM;
  players.delete(id);
  sock?.leave(room);
  ioRef?.to(room).emit("player:leave", id);
}
const minutesFrom = (v, max = 60 * 24 * 365) => clamp(Math.round(num(v)), 1, max);

// the digits each player sent in the last 2 minutes (to catch a phone number sent in pieces)
const PHONE_BITS = new Map();
export function phoneBits(userId, set) {
  const k = String(userId), now = Date.now();
  if (set !== undefined) { if (set) PHONE_BITS.set(k, { d: set, t: now }); else PHONE_BITS.delete(k); if (PHONE_BITS.size > 5000) PHONE_BITS.clear(); return set; }
  const e = PHONE_BITS.get(k);
  return e && now - e.t < 120000 ? e.d : "";
}

/* ---------- moderators (role "mod"): chosen players with a few moderation tools ----------
   kick, ban up to 7 days, mute up to 1 day, unban / unmute, and give coins from a budget that starts again every month
   (Israel time). They can't act on admins or other moderators, and can't give coins to themselves. */
export const MOD_BUDGET = 10000, MOD_MAX_BAN = 7 * 24 * 60, MOD_MAX_MUTE = 24 * 60;
const modMonth = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit" }).format(d).slice(0, 7);
export const modBudgetLeft = (u) => MOD_BUDGET - (u && u.modBudget && u.modBudget.month === modMonth() ? u.modBudget.used || 0 : 0);
function modBudgetInfo(left) {
  const [y, m] = modMonth().split("-").map(Number);
  return { left, limit: MOD_BUDGET, resets: `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01` };
}
// take n coins from this month's budget; returns what's left, or null if there isn't enough (safe when two arrive together)
async function spendModBudget(mod, n) {
  const month = modMonth();
  if (n > MOD_BUDGET) return null;
  let u = await User.findOneAndUpdate({ _id: mod._id, "modBudget.month": month, "modBudget.used": { $lte: MOD_BUDGET - n } }, { $inc: { "modBudget.used": n } }, { new: true });
  if (!u) u = await User.findOneAndUpdate({ _id: mod._id, "modBudget.month": { $ne: month } }, { $set: { modBudget: { month, used: n } } }, { new: true });   // a new month
  return u ? MOD_BUDGET - u.modBudget.used : null;
}

/* ---------- moderation: used by the in-game admin window and by the /admin website ---------- */
export const moderation = {
  // throw the player out of the game (every window). Returns how many windows were closed.
  kick(userId, event = "kicked:admin", data) {
    const socks = socketsOfUser(String(userId));
    for (const s of socks) {
      s.emit(event, data);
      dropPlayer(s.id, s);
      s.disconnect(true);
    }
    return socks.length;
  },
  async ban(user, minutes, reason) {
    const permanent = num(minutes) <= 0;
    user.bannedUntil = permanent ? PERMANENT : new Date(Date.now() + minutesFrom(minutes) * 60000);
    user.banReason = cleanText(reason, 120);
    await user.save();
    this.kick(user._id.toString(), "banned", { message: banMessage(user) });
    return permanent ? "permanently" : `for ${minutesFrom(minutes)} min`;
  },
  async unban(user) {
    user.bannedUntil = null;
    user.banReason = "";
    await user.save();
  },
  async mute(user, minutes) {
    const m = minutesFrom(minutes, 60 * 24 * 30);
    user.mutedUntil = new Date(Date.now() + m * 60000);
    await user.save();
    const id = user._id.toString();
    mutedUntil.set(id, user.mutedUntil.getTime());
    for (const s of socketsOfUser(id)) {
      s.emit("muted", { until: user.mutedUntil.getTime() });
      s.to(roomOf(s.id)).emit("typing", { id: s.id, on: false });
    }
    return m;
  },
  async unmute(user) {
    user.mutedUntil = null;
    await user.save();
    const id = user._id.toString();
    mutedUntil.delete(id);
    for (const s of socketsOfUser(id)) s.emit("muted", { until: 0 });
  },
  async addCoins(user, delta) {
    const result = await User.findOneAndUpdate({ _id: user._id }, [{ $set: { coins: { $max: [0, { $add: [{ $ifNull: ["$coins", 0] }, delta] }] } } }], { new: true });
    for (const s of socketsOfUser(user._id.toString())) s.emit("coins", { coins: result.coins, delta });
    return result.coins;
  },
  // style: public/shared/announce.js (moderators: always "mod", blue); center: a window in the middle of the screen with an OK
  // button (otherwise a strip at the top); tip: a ready-made safety tip, shown in each player's own language
  announce(text, by, { role = "admin", center = false, style = "admin", tip = "" } = {}) {
    const T = TIP_BY_ID[tip];
    const msg = T ? T.en : cleanText(text, MAX_ANNOUNCE);
    if (!msg) return null;
    const st = role === "mod" ? MOD_STYLE : T ? "tip" : ANN_STYLES.includes(style) ? style : "admin";
    ioRef?.emit("announce", { text: msg, by, role: role === "mod" ? "mod" : "admin", center: center === true, style: st, ...(T ? { tip: T.id } : {}) }); // the Plaza and every home
    return msg;
  },
  // the player's look, coins or inventory were changed by an admin: refresh open windows
  refresh(user) {
    const id = user._id.toString();
    notifyLook(id, user.publicLook());
    notifyCoins(id, user.coins || 0);
  },
};

export function attachPlaza(io) {
  ioRef = io;
  // who is connecting? read the login cookie
  io.use(async (socket, next) => {
    try {
      // the game tab's own token first (each tab can play its own account), else the login cookie
      const tab = typeof socket.handshake.auth?.tab === "string" ? socket.handshake.auth.tab : "";
      const token = tab || readCookie(socket.handshake.headers.cookie, COOKIE);
      if (!token) return next(new Error("not-logged-in"));
      let pl = readToken(token, tab ? "tab" : "login");   // the right kind of token, not logged out (routes/auth.js)
      if (!pl && tab) pl = readToken(readCookie(socket.handshake.headers.cookie, COOKIE), "login");   // this tab's token ran out: the browser's login (the game checks "whoami")
      if (!pl) return next(new Error("not-logged-in"));
      const { sub, v } = pl;
      socket.data.jti = pl.jti || "";
      const user = await User.findById(sub);
      if (!user || (v || 0) !== (user.tokenVersion || 0)) return next(new Error("not-logged-in"));
      if (user.isBanned()) return next(new Error("banned"));
      if (needsVerify(user)) return next(new Error("verify-email"));   // the email code comes first
      if (parentTime(user)) return next(new Error("parent-time"));    // parents set a no-Jumpi time (the /parents page)
      // before the grand opening only admins can play on jumpigames.com (see public/shared/launch.js)
      const host = String(socket.handshake.headers["x-forwarded-host"] || socket.handshake.headers.host || "").split(",")[0].trim().split(":")[0].toLowerCase();
      const inApp = /JumpiApp\//.test(String(socket.handshake.headers["user-agent"] || ""));   // players in the Android app can play now
      if (LAUNCH_HOSTS.includes(host) && Date.now() < LAUNCH_AT && user.role !== "admin" && !inApp) return next(new Error("not-open"));
      socket.data.user = user.toPublic();
      await loadBlocks(user._id).catch(() => {});   // who this player blocked / is blocked by: they don't see each other
      if (user.mutedUntil && user.mutedUntil.getTime() > Date.now()) mutedUntil.set(user._id.toString(), user.mutedUntil.getTime());
      next();
    } catch {
      next(new Error("not-logged-in"));
    }
  });


  function removePlayer(id, sock) {
    if (!players.has(id)) return;
    const { room = ROOM, userId } = players.get(id);
    if (room === ROOM) vehiclePlayerLeft(io, id, players.get(id));   // riding: the vehicle stays parked where they were
    players.delete(id);
    sock?.leave(room);
    io.to(room).emit("player:leave", id);
    // the last game window of this player closed: stop counting their needs
    // (wait a moment: moving to another room or reloading the page removes and adds the player again)
    setTimeout(() => {
      if (![...players.values()].some((p) => p.userId === userId)) { needsOffline(userId); playOff(userId); }
    }, 5000);
  }

  startPlaytime();
  initShow({ dropPlayer, setInvisible });
  setInterval(flushMoves, MOVE_MS);
  setInterval(showTick, 1000);   // the show notices players who left (their place on the stage is free again)
  // hunger, energy, stamina and fun go down while playing
  startNeeds({
    playersOf: (userId) => [...players.values()].filter((p) => p.userId === userId),
    send: (userId, event, data) => emitToUser(userId, event, data),
    mood: (userId, mood) => {
      for (const p of players.values())
        if (p.userId === userId) {
          p.mood = mood;
          roomSend(p, "player:mood", { id: p.id, mood });
        }
    },
  });

  io.on("connection", (socket) => {
    // every handler is guarded: a mistake or a database hiccup in one event is logged, it never stops the server
    const on0 = socket.on.bind(socket);
    socket.on = (ev, fn) => on0(ev, (...args) => {
      try {
        const r = fn(...args);
        if (r && typeof r.catch === "function") r.catch((err) => console.error(`[socket ${ev}]`, err));
      } catch (err) {
        console.error(`[socket ${ev}]`, err);
      }
    });
    const me = socket.data.user;
    socket.data.v2 = socket.handshake.auth?.v === 2;   // the game page knows "moves" (see flushMoves)
    socket.emit("whoami", { id: String(me.id || me._id || "") });
    socket.emit("build", BUILD);
    socket.emit("event", { event: activeEvent() });   // the holiday event that is on (public/shared/events.js)   // the game checks this is the account it shows (a stale socket after logging in as someone else reconnects)
    const canChat = limiter(5, 5000);
    const canMove = limiter(25, 1000);
    const canAdmin = limiter(20, 10000);
    const canEmote = limiter(4, 4000);
    const canPhone = limiter(12, 10000);
    const canType = limiter(20, 5000), canHop = limiter(8, 2000), canJoin = limiter(12, 10000), canLeave = limiter(12, 10000);   // one window can't flood the room
    // "trade" / "duel" badge above a player, seen by everyone
    const setStatus = (sid, status) => {
      const p = players.get(sid);
      if (!p || (p.status || null) === status) return;
      p.status = status;
      roomSend(p, "player:status", { id: sid, status });
    };
    attachTrading(io, socket, { players, me, notifyLook, limiter, setStatus });
    attachDuels(io, socket, { players, limiter, notifyCoins, setStatus });
    attachShow(io, socket, { players, me, limiter, spendModBudget, modBudgetLeft, addCoins: (u, n) => moderation.addCoins(u, n), notifyMember, socketIp });
    if (showIsOpen()) socket.emit("show:on", showBanner());   // a show is on: the note at the top (also for players who come in later)
    attachVehicles(io, socket, { players, limiter, emitToUser });

    socket.on("join", async (pos) => {
      if (!canJoin()) return;
      // which room: the Plaza, or someone's home (that player has to exist)
      let room = ROOM;
      const homeOf = cleanText(pos?.home, 32).toLowerCase();
      const place = typeof pos?.place === "string" && PLACES.has(pos.place) ? pos.place : "";
      if (pos?.show === true) {   // the Jumpi Show (realtime/show.js): only while one is open (and not for someone the host sent out)
        if (!showIsOpen() || showRefused(me.id)) return socket.emit("show:gone");
        room = "show";
        homeBounds.set(room, { x0: -40, x1: 40, z0: -40, z1: 40 });
      }
      else if (place) {
        room = "place:" + place;
        if (place === "club") homeBounds.set(room, houseShape({ big: true }).bounds);   // the Dance Club is the big room
      }
      else if (pos?.work === true || pos?.work === "delivery") {   // at work: a restaurant / a whole town of your own (the customers are bots)
        room = "work:" + me.id;
        if (pos.work === "delivery") homeBounds.set(room, TOWN_BOUNDS);
        else homeBounds.delete(room);
      }
      else if (homeOf) {
        try {
          const owner = await User.findOne({ usernameLower: homeOf }, { house: 1, username: 1, friends: 1, blocked: 1, homeAccess: 1 }).lean();
          if (!owner) return socket.emit("home:gone");
          if (!mayVisit(owner, { id: me.id, role: me.role })) return socket.emit("home:gone", { message: visitRefusal(owner) });
          homeBounds.set("home:" + homeOf, houseShape(owner.house).bounds);
        } catch {
          return;
        }
        room = "home:" + homeOf;
      }
      // fresh look / coins / role from the database (they may have shopped since connecting)
      let jobsOf = {}, parental = {}, loungeOk = false;
      try {
        const fresh = await User.findById(me.id);
        jobsOf = (fresh && fresh.jobs) || {};
        parental = (fresh && fresh.parental) || {};
        if (!fresh || fresh.isBanned()) return socket.disconnect(true);
        Object.assign(me, fresh.toPublic());
        needsOnline(me.id, fresh.needs);
        me.pet = outPet(fresh);
        me.member = fresh.isMember();
        if (place === "lounge") loungeOk = me.member || fresh.role === "admin" || fresh.role === "mod";
        me.bday = isBirthdayOn(fresh.birthDate);
        me.lv = fresh.role === "admin" ? MAX_LEVEL : levelOf(fresh.levelXp || 0);   // the level badge next to the name (admins: always the top level)   // pink name with a cake all day
        me.invisible = fresh.role === "admin" && fresh.adminInvisible !== false;   // admins come in invisible unless they switched it off
      } catch {}
      // the Members Lounge: only members (and staff), and only when the account really loaded (a database hiccup = no entry)
      if (place === "lounge" && !loungeOk) return socket.emit("place:refused", { place, code: "members" });
      // the same account in a second window: the older window leaves
      for (const [id, p] of players) {
        if (p.userId === me.id && id !== socket.id) {
          const old = io.sockets.sockets.get(id);
          old?.emit("kicked");
          removePlayer(id, old);
        }
      }
      const B = boundsOf(room);
      // moving to another room: the old room sees you leave
      const before = players.get(socket.id);
      if (before && before.room !== room) removePlayer(socket.id, socket);
      const player = {
        id: socket.id,
        room,
        status: players.get(socket.id)?.status || null,
        phone: pos?.phone === true || !!players.get(socket.id)?.phone,
        uniform: UNIFORMS.has(pos?.uniform) && jobsOf[pos.uniform]?.hired ? pos.uniform : before?.uniform || null,   // only a job they have
        hold: cleanHold(pos?.hold),   // the food in your hand (only for show; eating is checked by food:bite)   // holding the phone (also after moving to another room)
        userId: me.id,
        username: me.username,
        look: me.look,
        role: me.role,
        x: clamp(num(pos?.x), B.x0, B.x1),
        z: clamp(num(pos?.z, 9), B.z0, B.z1),
        face: num(pos?.face),
        moving: false,
        mood: moodNow(me.id),
        pet: me.pet || null,
        member: !!me.member,
        invisible: !!me.invisible,
        bday: !!me.bday,
        lv: me.lv || 1,
        parental,             // parents' settings: chat lock and no-Jumpi times (public/shared/parental.js)
        warpAt: Date.now(),   // just arrived (see "move")
        movedAt: Date.now(),
      };
      const qr = quietNow(parental);
      if (qr) { socket.emit("kicked:parent", { message: `Your parents set a no-Jumpi time until ${qr.to}. See you then!`, until: qr.to }); return socket.disconnect(true); }
      const already = players.has(socket.id);
      players.set(socket.id, player);
      socket.join(room);
      socket.emit("players", [...players.values()].filter((p) => p.id !== socket.id && p.room === room && sees(player, p)).map(publicView));
      socket.emit("self", { role: me.role, coins: me.coins, mutedUntil: mutedUntil.get(me.id) || 0, invisible: !!player.invisible });
      if (!already) roomSend(player, "player:join", publicView(player), { self: false });
      if (room === ROOM) { sendVehicles(io, socket, player); vehiclePlayerBack(io, player); }
      if (room === "show") showJoined(player); else showLeft();
      sendNeeds(me.id);
      playOn(me.id, deviceOf(socket.handshake.headers["user-agent"]));   // play time for the parents' page
    });

    // the owner sends a visitor out of their home (still friends: they may come back if the home's setting allows it)
    socket.on("home:kick", (d, ack) => {
      const r = typeof ack === "function" ? ack : () => {};
      const p = players.get(socket.id), t = players.get(String(d?.id || ""));
      if (!p || p.room !== "home:" + String(me.username).toLowerCase()) return r({ error: "You can only do that in your own home." });
      if (!t || t.room !== p.room || t.userId === p.userId) return r({ error: "That player isn't in your home." });
      if (t.role === "admin") return r({ error: "Admins can't be sent out." });
      sendOut(t, `${p.username} asked you to leave their home.`);
      r({ ok: true, message: `${t.username} left your home.` });
    });

    // patting a pet (yours or someone else's): everyone around sees the hearts, and it's fun
    const canPat = limiter(6, 10_000);
    let lastPatFun = 0;
    socket.on("pet:pat", (d) => {
      const p = players.get(socket.id);
      if (!p || !canPat()) return;
      const owner = typeof d?.owner === "string" ? players.get(d.owner) : null;   // a pet walking with someone
      const pid = typeof d?.pid === "string" && /^[a-f0-9]{10}$/.test(d.pid) ? d.pid : null; // a pet at home
      if (owner ? owner.room !== p.room || !owner.pet : !pid) return;
      if (owner && !sees(p, owner)) return;   // invisible admins, and players who blocked each other
      roomSend(p.invisible ? p : owner || p, "pet:pat", owner ? { owner: owner.id, by: p.id } : { pid, by: p.id });
      if (Date.now() - lastPatFun > 20_000) {
        lastPatFun = Date.now();
        bumpNeeds(p.userId, { fun: 4 });
      }
    });

    /* ---- the food bar: get food, hold it, eat it bite by bite (realtime/food.js) ---- */
    const reply = (ack) => (typeof ack === "function" ? ack : () => {});
    socket.on("food:get", async (_d, ack) => {
      const p = players.get(socket.id);
      if (!p) return reply(ack)({ error: "Not in the game." });
      try { reply(ack)({ ok: true, bag: await foodBag(p.userId) }); } catch { reply(ack)({ error: "Try again." }); }
    });
    // the free Restaurant and the Water Park stands (the club bar is "bar:buy" below)
    const canTake = limiter(10, 60_000);
    socket.on("food:take", async (d, ack) => {
      const r = reply(ack), p = players.get(socket.id);
      if (!p) return r({ error: "Not in the game." });
      const k = d?.k, i = Number(d?.i), it = foodOf(k, i);
      if (!it || (k !== "diner" && k !== "park")) return r({ error: "That isn't on the menu." });
      if (k === "diner" && p.room !== "place:diner") return r({ error: "Get it at the Restaurant." });
      if (k === "park") {
        const st = standOf(it.stand);   // Water Park stands and the city's street food (public/shared/food.js)
        if (p.room !== ROOM || !st || Math.hypot(p.x - st.x, p.z - st.z) > STAND_REACH + 2) return r({ error: "Walk up to the stand to buy that." });
      }
      if (p.foodBusy || !canTake()) return r({ error: "One at a time! Try again in a moment." });
      p.foodBusy = true;
      try {
        const out = await addFood(p.userId, k, i, it.price || 0);
        if (out.ok && it.price) notifyCoins(p.userId, out.coins);
        r(out);
      } catch { r({ error: "Something went wrong. Try again." }); } finally { p.foodBusy = false; }
    });
    // one bite or sip (at most about two a second)
    socket.on("food:bite", async (d, ack) => {
      const r = reply(ack), p = players.get(socket.id);
      if (!p) return r({ error: "Not in the game." });
      if (p.foodBusy || Date.now() - (p.lastBite || 0) < 420) return r({ error: "slow" });
      p.foodBusy = true;p.lastBite = Date.now();
      try {
        const out = await biteFood(p.userId, d?.id);
        if (out.ok) {
          p.hold = out.left > 0 ? { k: out.k, i: out.i, f: out.left / out.n } : null;
          roomSend(p, "player:bite", { id: p.id, hold: p.hold }, { self: false });
        }
        r(out);
      } catch { r({ error: "Something went wrong. Try again." }); } finally { p.foodBusy = false; }
    });
    socket.on("food:drop", async (d, ack) => {
      const r = reply(ack), p = players.get(socket.id);
      if (!p) return r({ error: "Not in the game." });
      try { r(await dropFood(p.userId, d?.id)); } catch { r({ error: "Something went wrong. Try again." }); }
    });
    // holding something / putting it away: everyone around sees it in the hand
    const canHold = limiter(40, 60_000);
    socket.on("food:hold", (h) => {
      const p = players.get(socket.id);
      if (!p || !canHold()) return;
      p.hold = cleanHold(h);
      roomSend(p, "player:hold", { id: p.id, hold: p.hold }, { self: false });
    });

    // buy something at the club bar (juices and snacks only, no alcohol). The coins are taken here and it goes into the food bar.
    const canBuy = limiter(8, 60_000);
    socket.on("bar:buy", async (d, ack) => {
      const r = reply(ack);
      const p = players.get(socket.id);
      if (!p || p.room !== "place:club") return r({ error: "Order at the bar in the Dance Club." });
      const i = Number(d?.i), it = BAR_MENU[i];
      if (!Number.isInteger(i) || !it) return r({ error: "That isn't on the menu." });
      if (p.barBusy || !canBuy()) return r({ error: "One at a time! Try again in a moment." });
      p.barBusy = true;
      try {
        const out = await addFood(p.userId, "club", i, it.price);
        if (out.ok) notifyCoins(p.userId, out.coins);
        r(out);
      } catch {
        r({ error: "Something went wrong. Try again." });
      } finally {
        p.barBusy = false;
      }
    });

    socket.on("move", (d) => {
      const p = players.get(socket.id);
      if (!p || !canMove()) return;
      const B = boundsOf(p.room);
      const nx = clamp(num(d?.x, p.x), B.x0, B.x1), nz = clamp(num(d?.z, p.z), B.z0, B.z1), now = Date.now();
      // faster than any vehicle: the position jumped (a city teleport, or a changed game). Treasure waits a little after a jump.
      const dt = Math.min(5, Math.max(0, (now - (p.movedAt || now)) / 1000));
      if (Math.hypot(nx - p.x, nz - p.z) > 30 * dt + 6) p.warpAt = now;
      p.movedAt = now;
      p.x = nx;
      p.z = nz;
      p.face = num(d?.face, p.face);
      p.moving = d?.moving === true;
      p.pose = cleanPose(d?.pose, p.room === ROOM); // outside only sitting and lying down (benches, sun loungers)
      p.run = p.moving && d?.run === true;
      p.mv = p.farMv = true;   // sent with the next "moves" round (flushMoves)
    });

    socket.on("chat", async (raw) => {
      const p = players.get(socket.id);
      if (!p) return;
      const until = mutedUntil.get(me.id) || 0;
      if (until > Date.now()) return socket.emit("chat:muted", { until });
      const text = cleanText(raw);
      if (!text) return;
      if (!canChat()) return socket.emit("chat:slow");   // before anything is checked or written down
      if (p.parental?.chatLock === true && !isQuickChat(text)) return socket.emit("chat:locked");   // parents: only the ready-made messages
      // phone numbers, addresses and emails never go out (not a strike: the player gets a "never share this" window)
      const chk = checkText(text), sp = splitPhone(phoneBits(me.id), text);
      if (chk.kind === "private" || sp.hit) {
        phoneBits(me.id, "");
        logQuietly(ChatLog, { userId: me.id, username: me.username, room: p.room, text, blocked: true });
        if (chk.info === "unsafe") flagChat(me.id, me.username, text, p.room, true);   // asking for pictures / secrets / meeting: the team sees it
        return socket.emit("chat:private", { info: chk.info || "phone", message: PRIVATE_MESSAGE[chk.info || "phone"] });
      }
      phoneBits(me.id, sp.digits);
      // no bad words anywhere (Plaza, homes, trade and game windows all use this)
      if (!chk.ok) {
        logQuietly(ChatLog, { userId: me.id, username: me.username, room: p.room, text, blocked: true });
        const s = await strike(me.id);
        return socket.emit("chat:blocked", { message: FRIENDLY_MESSAGE, left: s.left ?? 0, muted: !!s.muted });
      }
      roomSend(p, "chat", { id: p.id, username: p.username, role: p.role, text });
      logQuietly(ChatLog, { userId: me.id, username: me.username, room: p.room, text });
      if (riskText(text)) flagChat(me.id, me.username, text, p.room, false);   // "how old are you", "which school"…: allowed, but the team takes a look
    });

    // taking the phone out / putting it away: everyone around sees the character hold it
    socket.on("phone", (on) => {
      const p = players.get(socket.id);
      if (!p || !canPhone()) return;
      p.phone = on === true;
      roomSend(p, "player:phone", { id: p.id, on: p.phone }, { self: false });
    });

    // put on / take off a work uniform (the police uniform on patrol)
    socket.on("uniform", async (job) => {
      const p = players.get(socket.id);
      if (!p || !canPhone()) return;
      let wear = UNIFORMS.has(job) ? job : null;
      if (wear) {   // only players who have that job (routes/jobs.js)
        const u = await User.findById(me.id).select("jobs").lean();
        if (!u?.jobs?.[wear]?.hired) wear = null;
      }
      if (!players.has(socket.id)) return;
      p.uniform = wear;
      roomSend(p, "player:uniform", { id: p.id, job: p.uniform }, { self: false });
    });

    socket.on("typing", (on) => {
      const p = players.get(socket.id);
      if (!p || !canType()) return;
      if (on === true && (mutedUntil.get(me.id) || 0) > Date.now()) return;
      roomSend(p, "typing", { id: p.id, on: on === true }, { self: false });
    });

    // emotes: only the known faces, a few at a time, not while muted
    socket.on("emote", async (e, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      const p = players.get(socket.id);
      if (!p) return reply({ ok: false, why: "not in a room" });
      if (typeof e !== "string" || !EMOTES.has(e)) return reply({ ok: false, why: "unknown emote" });
      if (!canEmote()) return reply({ ok: false, why: "too fast" });
      if ((mutedUntil.get(me.id) || 0) > Date.now()) return reply({ ok: false, why: "muted" });
      // emotes you haven't bought can't be used (check the database if it was bought after joining)
      if (me.role !== "admin" && !hasEmote(me.inventory, e)) {
        try {
          const fresh = await User.findById(me.id);
          if (fresh) me.inventory = fresh.toPublic().inventory;   // (with what a member has for free)
        } catch {}
        if (!hasEmote(me.inventory, e)) return reply({ ok: false, why: "locked" });
      }
      if (!players.has(socket.id)) return;
      roomSend(p, "emote", { id: p.id, e });
      let seen = 0;   // the players around who see it (an invisible admin isn't counted: that would give them away)
      for (const q of players.values()) if (q.room === p.room && q.id !== p.id && sees(q, p) && sees(p, q)) seen++;
      reply({ ok: true, seen });
    });

    // Space: a jump with a flip (dir 1 = forwards, -1 = backwards), or a small hop in the water
    socket.on("hop", (d) => {
      const p = players.get(socket.id);
      if (!p || !canHop()) return;
      roomSend(p, "hop", { id: p.id, dir: d?.dir === 1 ? 1 : -1, small: d?.small === true }, { self: false });
    });

    socket.on("leave", () => { if (canLeave()) removePlayer(socket.id, socket); });
    socket.on("disconnect", () => removePlayer(socket.id, socket));

    /* ---------------- admin actions ---------------- */
    // every action re-checks the database, so a stale or forged role can't be used
    // { mods: true } = moderators may use it too (with their limits: see findTarget, ban and coins below)
    // heavy = big actions (coins, gift codes, permanent bans): an admin types their password first (once per 30 minutes in this window)
    function adminAction(name, handler, { mods = false, heavy = null } = {}) {
      socket.on(name, async (data, ack) => {
        const reply = typeof ack === "function" ? ack : () => {};
        try {
          if (!canAdmin()) return reply({ ok: false, error: "Too many actions. Wait a few seconds." });
          const admin = await User.findById(me.id);
          const allowed = admin && (admin.role === "admin" || (mods && admin.role === "mod"));
          if (!allowed || admin.isBanned()) return reply({ ok: false, error: mods ? "Only moderators and admins can do that." : "Only admins can do that." });
          if (heavy && admin.role === "admin" && heavy(data || {}) && !((socket.data.adminUnlock || 0) > Date.now() && socket.data.adminUnlockV === (admin.tokenVersion || 0)))
            return reply({ ok: false, code: "password", error: "Type your password to do this." });
          const result = await handler(data || {}, admin);
          console.log(`[admin] ${admin.username} ${name}`, JSON.stringify(data || {}).slice(0, 200));
          reply({ ok: true, ...result });
        } catch (err) {
          reply({ ok: false, error: err.publicMessage || "Something went wrong." });
          if (!err.publicMessage) console.error(err);
        }
      });
    }
    const fail = (msg) => Object.assign(new Error(msg), { publicMessage: msg });
    // the admin's password unlocks the heavy actions in this window for 30 minutes
    const canUnlock = limiter(5, 15 * 60_000);
    socket.on("admin:unlock", async (d, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      if (!canUnlock()) return reply({ ok: false, error: "Too many tries. Wait 15 minutes." });
      const admin = await User.findById(me.id);
      if (!admin || admin.role !== "admin" || admin.isBanned()) return reply({ ok: false, error: "Only admins can do that." });
      const ok = typeof d?.password === "string" && d.password.length <= 200 && (await bcrypt.compare(d.password, admin.passwordHash));
      logQuietly(AdminLog, { adminId: admin._id, admin: admin.username, action: ok ? "unlock" : "unlock-failed", details: "in the game", via: "game", ip: socketIp(socket) });
      if (!ok) return reply({ ok: false, error: "Wrong password." });
      socket.data.adminUnlock = Date.now() + 30 * 60_000;
      socket.data.adminUnlockV = admin.tokenVersion || 0;
      reply({ ok: true });
    });
    async function findTarget(username, admin, { allowSelf = false, allowAdmin = false } = {}) {
      const name = cleanText(username, 32).toLowerCase();
      if (!name) throw fail("Enter a username.");
      const user = await User.findOne({ usernameLower: name });
      if (!user) throw fail(`No player called "${cleanText(username, 32)}".`);
      const self = user._id.equals(admin._id);
      if (self && !allowSelf) throw fail("You can't do that to yourself.");
      if (!self && user.role === "admin" && !allowAdmin) throw fail("You can't do that to another admin.");
      if (!self && admin.role === "mod" && (user.role === "admin" || user.role === "mod")) throw fail("Moderators can't do that to admins or other moderators.");
      return user;
    }

    const audit = (admin, action, user, details = "") => {
      logQuietly(AdminLog, { adminId: admin._id, admin: admin.username, action, targetId: user?._id, target: user?.username || "", details, via: "game", ip: socketIp(socket) });
      modLog({ by: admin.username, byRole: admin.role, action, target: user?.username, details, via: "game" });   // #mod-log in Discord (moderation actions only)
    };

    adminAction("admin:kick", async ({ username }, admin) => {
      const user = await findTarget(username, admin);
      if (!moderation.kick(user._id.toString())) throw fail(`${user.username} isn't in the Plaza right now.`);
      audit(admin, "kick", user, admin.role === "mod" ? "by a moderator" : "");
      return { message: `${user.username} was kicked.` };
    }, { mods: true });

    adminAction("admin:ban", async ({ username, minutes, reason }, admin) => {
      const user = await findTarget(username, admin);
      if (admin.role === "mod" && !(num(minutes) > 0 && num(minutes) <= MOD_MAX_BAN)) throw fail("Moderators can ban for up to 7 days.");
      const how = await moderation.ban(user, minutes, reason);
      audit(admin, "ban", user, `${how}${user.banReason ? " · " + user.banReason : ""}`);
      return { message: `${user.username} is banned ${how}.` };
    }, { mods: true, heavy: (d) => !(num(d.minutes) > 0) });

    adminAction("admin:unban", async ({ username }, admin) => {
      if (admin.role === "mod") throw fail("Only an admin can lift a ban.");
      const user = await findTarget(username, admin);
      await moderation.unban(user);
      audit(admin, "unban", user);
      return { message: `${user.username} is no longer banned.` };
    }, { mods: true });

    adminAction("admin:mute", async ({ username, minutes }, admin) => {
      const user = await findTarget(username, admin);
      if (admin.role === "mod" && num(minutes) > MOD_MAX_MUTE) throw fail("Moderators can mute for up to 1 day.");
      const m = await moderation.mute(user, minutes);
      audit(admin, "mute", user, `${m} min`);
      return { message: `${user.username} is muted for ${m} min.` };
    }, { mods: true });

    adminAction("admin:unmute", async ({ username }, admin) => {
      const user = await findTarget(username, admin);
      await moderation.unmute(user);
      audit(admin, "unmute", user);
      return { message: `${user.username} can chat again.` };
    }, { mods: true });

    adminAction("admin:coins", async ({ username, amount }, admin) => {
      const mod = admin.role === "mod";
      const user = await findTarget(username, admin, { allowSelf: !mod, allowAdmin: !mod });
      const delta = Math.round(num(amount));
      if (mod) {
        // moderators: only giving, never to themselves, from a budget of MOD_BUDGET coins a month
        if (!(delta > 0)) throw fail("Moderators can only give coins (1 or more).");
        const left = await spendModBudget(admin, delta);
        if (left === null) throw fail(`Not enough budget: you have ${modBudgetLeft(await User.findById(admin._id)).toLocaleString("en-US")} coins left this month.`);
        const coins = await moderation.addCoins(user, delta);
        audit(admin, "coins", user, `+${delta} → ${coins} · by a moderator (${left} left this month)`);
        return { message: `Gave ${delta.toLocaleString("en-US")} coins to ${user.username}. Your budget: ${left.toLocaleString("en-US")} left this month.`, budget: modBudgetInfo(left) };
      }
      if (!delta || Math.abs(delta) > 1_000_000) throw fail("Enter an amount between 1 and 1,000,000.");
      const coins = await moderation.addCoins(user, delta);
      audit(admin, "coins", user, `${delta > 0 ? "+" : ""}${delta} → ${coins}`);
      return { message: `${user.username} now has ${coins.toLocaleString("en-US")} coins.` };
    }, { mods: true, heavy: () => true });

    // a moderator's coin budget for this month
    adminAction("mod:budget", async (_d, admin) => ({ budget: admin.role === "mod" ? modBudgetInfo(modBudgetLeft(admin)) : null }), { mods: true });

    adminAction("admin:invisible", async ({ on }, admin) => {
      admin.adminInvisible = on === true;
      await admin.save();
      setInvisible(admin._id.toString(), admin.adminInvisible);
      audit(admin, admin.adminInvisible ? "invisible on" : "invisible off", admin);
      return { invisible: admin.adminInvisible, message: admin.adminInvisible ? "You're invisible again." : "Everyone can see you now." };
    });

    adminAction("admin:code", async ({ code, coins, maxUses, days }, admin) => {
      let c;
      try { c = await createCode({ code, coins, maxUses, days, note: "made in the game", by: admin.username }); }
      catch (err) { throw err.publicMessage ? fail(err.publicMessage) : err; }
      audit(admin, "code-create", null, `${c.code} · ${c.coins} coins · ${c.maxUses || "no limit"} uses`);
      return { code: c.code, message: `Code ${c.code} is ready: ${c.coins.toLocaleString("en-US")} coins${c.maxUses ? ` for ${c.maxUses} player(s)` : ""}.` };
    }, { heavy: () => true });

    // moderators may announce too (blue), through the chat filter and at most once every 2 minutes
    adminAction("admin:announce", async ({ text, center, style, tip }, admin) => {
      const mod = admin.role === "mod";
      if (mod && tip) throw fail("Only admins can send the ready-made tips.");
      if (mod) {
        const chk = checkText(cleanText(text, MAX_ANNOUNCE) || "");
        if (!chk.ok) throw fail("That message can't be sent: it has a word or private details the chat filter stops.");
        const last = modAnnounceAt.get(admin._id.toString()) || 0;
        if (Date.now() - last < MOD_ANNOUNCE_GAP) throw fail(`Wait ${Math.ceil((MOD_ANNOUNCE_GAP - (Date.now() - last)) / 1000)} seconds before the next announcement.`);
      }
      const msg = moderation.announce(text, admin.username, { role: admin.role, center: center === true, style: String(style || ""), tip: String(tip || "") });
      if (!msg) throw fail("Write a message first.");
      if (mod) modAnnounceAt.set(admin._id.toString(), Date.now());
      audit(admin, "announce", null, `${center === true ? "[window] " : ""}${mod ? "" : `[${tip ? "tip" : style || "admin"}] `}${msg}${mod ? " · by a moderator" : ""}`);
      return { message: "Announcement sent to everyone in the Plaza." };
    }, { mods: true });
  });
}

// called by the shop when someone changes clothes: everyone in the Plaza sees it
// to every open game (the holiday event switch, realtime/events.js)
export function broadcastAll(event, data) {
  ioRef?.emit(event, data);
}
export function notifyLook(userId, look) {
  if (!ioRef) return;
  for (const p of players.values()) {
    if (p.userId !== userId) continue;
    p.look = look;
    roomSend(p, "player:look", { id: p.id, look });
  }
}
// a membership started (or ended): the golden name shows for everyone
export function notifyMember(userId, member) {
  if (!ioRef) return;
  for (const p of players.values()) {
    if (p.userId !== userId) continue;
    p.member = member;
    roomSend(p, "player:member", { id: p.id, member });
  }
}
// the pet walking with a player changed (adopted, sent home, called out)
export function notifyPet(userId, pet) {
  if (!ioRef) return;
  for (const p of players.values()) {
    if (p.userId !== userId) continue;
    p.pet = pet;
    roomSend(p, "player:pet", { id: p.id, pet });
  }
}
// send something to every open game window of one player (season XP, etc.)
export function notifyUser(userId, event, data) {
  if (!ioRef) return;
  for (const p of players.values()) if (p.userId === userId) ioRef.to(p.id).emit(event, data);
}
// called after a purchase so an open game window shows the new balance
export function notifyCoins(userId, coins) {
  if (!ioRef) return;
  for (const p of players.values()) if (p.userId === userId) ioRef.to(p.id).emit("coins", { coins, delta: 0 });
}
// the owner changed their home: visitors who are inside see it right away
export function notifyHome(usernameLower, home) {
  if (home?.house) homeBounds.set("home:" + usernameLower, houseShape(home.house).bounds);
  if (ioRef) ioRef.to("home:" + usernameLower).emit("home:update", { home });
}

/* ---------- who is online (for the phone: friends, online list, JumpiChat) ---------- */
// where a player is right now: "plaza", "home:<name>" or null when not in the game
// seeHidden: false for regular players (invisible admins don't show as online to them)
export function onlineWhere(userId, seeHidden = true) {
  for (const p of players.values()) if (p.userId === userId && (seeHidden || !p.invisible)) return p.room || ROOM;
  return null;
}
// where this player stands in the open world right now (the newest window), or null (for routes that need a position: the secret cave)
// steady = how long (ms) since the position last jumped or the player arrived
export function worldPos(userId) {
  let out = null;
  for (const p of players.values()) if (p.userId === userId && (p.room || ROOM) === ROOM) out = { x: p.x, z: p.z, steady: Date.now() - (p.warpAt || 0) };
  return out;
}
export function onlinePlayers(seeHidden = true, selfId = "") {
  const seen = new Map();
  for (const p of players.values())
    if (!seen.has(p.userId) && (seeHidden || ((!p.invisible || p.userId === selfId) && !(p.role !== "admin" && ghosts(selfId, p.userId)))))
      seen.set(p.userId, { userId: p.userId, username: p.username, look: p.look, role: p.role, where: p.room || ROOM, invisible: !!p.invisible });
  return [...seen.values()];
}
// a new level: the badge next to the name changes for everyone around
export function notifyLevel(userId, lv) {
  for (const p of players.values())
    if (p.userId === userId && p.role !== "admin") {
      p.lv = lv;
      roomSend(p, "player:level", { id: p.id, lv });
    }
}
// a block was added (on) or taken away: the two players vanish from / come back into each other's game right away
export function ghostUpdate(a, b, on) {   // a, b: { id, username, role }
  if (!ioRef) return;
  const A = [...players.values()].filter((p) => p.userId === String(a.id)), B = [...players.values()].filter((p) => p.userId === String(b.id));
  // visiting the other one's home (even when they're not online): back to the Plaza
  if (on && a.role !== "admin" && b.role !== "admin")
    for (const [X, y] of [[A, b], [B, a]])
      for (const x of X) if (x.room === "home:" + String(y.username).toLowerCase()) sendOut(x, "That home isn't there any more.");
  if (a.role !== "admin" && b.role !== "admin") vehiclesGhost(ioRef, a.id, b.id, on);
  for (const a of A)
    for (const b of B) {
      if (a.room !== b.room) continue;
      for (const [x, y] of [[a, b], [b, a]]) {
        if (on) { if (x.role !== "admin" && y.role !== "admin") ioRef.to(x.id).emit("player:leave", y.id); }
        else if (sees(x, y)) ioRef.to(x.id).emit("player:join", publicView(y));
      }
    }
}
// these logins were ended (log out): their game windows close
export function endSessions(jtis) {
  if (!ioRef) return;
  const set = new Set(jtis);
  for (const s of ioRef.sockets.sockets.values()) {
    if (!s.data?.jti || !set.has(s.data.jti)) continue;
    s.emit("kicked:logout");
    dropPlayer(s.id, s);
    s.disconnect(true);
  }
}
// to every admin playing right now (a new report). Only admins (not moderators: a moderator could be the one reported),
// never to the player the report is about, and it never says who reported
export function emitToAdmins(event, data, { except = "" } = {}) {
  if (!ioRef) return;
  for (const p of players.values()) if (p.role === "admin" && p.userId !== String(except)) ioRef.to(p.id).emit(event, data);
}
// send something to every window this player has open in the game
export function emitToUser(userId, event, data) {
  if (!ioRef) return;
  for (const p of players.values()) if (p.userId === userId) ioRef.to(p.id).emit(event, data);
}

/* ---------- parental controls (routes/parents.js) ----------
   A parent changed the settings: open game windows follow right away (chat lock), and a no-Jumpi time closes the game.
   Every half minute the open games are checked too (a no-Jumpi time that starts while playing). */
function parentKick(p, message) {
  const s = ioRef?.sockets.sockets.get(p.id);
  if (!s) return;
  s.emit("kicked:parent", { message, until: message.match(/\d\d:\d\d/)?.[0] || "" });
  dropPlayer(p.id, s);
  s.disconnect(true);
}
export function parentalChanged(userId, parental) {
  for (const p of [...players.values()]) {
    if (p.userId !== String(userId)) continue;
    p.parental = parental;
    ioRef?.to(p.id).emit("parental", { chatLock: parental.chatLock === true });
    const r = quietNow(parental);
    if (r) parentKick(p, `Your parents set a no-Jumpi time until ${r.to}. See you then!`);
  }
}
setInterval(() => {
  for (const p of [...players.values()]) {
    if (!p.parental?.quiet?.length) continue;
    const r = quietNow(p.parental);
    if (r) parentKick(p, `Your parents set a no-Jumpi time until ${r.to}. See you then!`);
  }
}, 30_000).unref?.();

/* ---------- homes: who may come in (kids' safety) ----------
   The owner picks everyone / friends only (default) / nobody (User.homeAccess), and can send a visitor out of
   the home right now (they stay friends; they can come back if the home's setting lets them). Admins can always
   come in; blocked players never. */
// may this visitor ({ id, role }) come into this owner's home (a User with friends / blocked / homeAccess)?
export function mayVisit(owner, visitor) {
  const oid = String(owner._id), vid = String(visitor.id || visitor._id);
  if (oid === vid || visitor.role === "admin") return true;
  if (ghosts(oid, vid) || (owner.blocked || []).some((b) => String(b) === vid)) return false;
  const access = owner.homeAccess || "friends";
  if (access === "all") return true;
  if (access === "closed") return false;
  return (owner.friends || []).some((f) => String(f) === vid);
}
export const visitRefusal = (owner) => (owner.homeAccess === "closed" ? `${owner.username}'s home is locked right now.` : `Only ${owner.username}'s friends can visit this home.`);
// send everyone out of this home who may not be there any more (after the owner changed who can visit)
export function evictHome(owner) {
  if (!ioRef) return;
  const room = "home:" + String(owner.usernameLower || owner.username).toLowerCase();
  for (const p of [...players.values()]) {
    if (p.room !== room || mayVisit(owner, { id: p.userId, role: p.role })) continue;
    sendOut(p, visitRefusal(owner));
  }
}
// throw one player out of the home they are in: the server takes them out of the room (their game goes back to the Plaza)
function sendOut(p, message) {
  const s = ioRef?.sockets.sockets.get(p.id);
  ioRef?.to(p.id).emit("home:gone", { message });
  dropPlayer(p.id, s);
}

/* ---------- the chat filter tells the team (kids' safety) ----------
   unsafe = a message that was stopped because it asks a child for pictures, secrets, being alone or meeting (urgent);
   otherwise a question worth a look (age, school, city, dating) that was allowed. One open report per player
   collects them (/admin → Player reports), with the player's chat from the last day. */
export async function flagChat(userId, username, text, room, unsafe) {
  try {
    const uid = String(userId), reason = unsafe ? "grooming" : "flagged";
    const line = { from: username, text: String(text).slice(0, 300), at: new Date(), room: String(room || "") };
    const open = await Report.findOne({ targetId: uid, where: "filter", reason, status: "open", at: { $gt: new Date(Date.now() - 6 * 3600_000) } }).select("_id context").lean();
    if (open) {
      if ((open.context || []).length < 80) await Report.updateOne({ _id: open._id }, { $push: { context: line } });
      return;
    }
    const said = await ChatLog.find({ userId: uid, at: { $gt: new Date(Date.now() - 86400_000) } }).sort({ at: -1 }).limit(15).lean();
    const context = [...said.reverse().map((c) => ({ from: username, text: c.text, at: c.at, room: c.room + (c.blocked ? " (stopped by the filter)" : "") })), line];
    const r = await Report.create({
      fromId: uid, from: "Jumpi filter", targetId: uid, target: username, reason, where: "filter", room: line.room, context,
      details: unsafe ? "The chat filter stopped a message asking for pictures, secrets, being alone or meeting." : "The chat filter noticed a question about age, school, city or dating. It was sent; just worth a look.",
    });
    emitToAdmins("admin:report", { id: String(r._id), target: username, reason, urgent: !!unsafe, filter: true }, { except: uid });
  } catch (err) {
    console.error("[filter] flag", err.message);
  }
}

/* ---------- bad words: 3 tries in 10 minutes = muted for 5 minutes ---------- */
const strikes = new Map(); // userId -> times a message was blocked
export async function strike(userId) {
  const now = Date.now();
  const list = (strikes.get(userId) || []).filter((t) => now - t < 10 * 60_000);
  list.push(now);
  strikes.set(userId, list);
  if (list.length < 3) return { left: 3 - list.length };
  strikes.delete(userId);
  const until = now + 5 * 60_000;
  mutedUntil.set(userId, until);
  try {
    await User.updateOne({ _id: userId }, { mutedUntil: new Date(until) });
  } catch (err) {
    console.error("[filter] could not save the mute", err);
  }
  for (const p of players.values())
    if (p.userId === userId) {
      ioRef?.to(p.id).emit("muted", { until });
      ioRef?.to(p.room || ROOM).emit("typing", { id: p.id, on: false });
    }
  console.log(`[filter] user ${userId} muted for 5 minutes (bad words)`);
  return { muted: true, until };
}
