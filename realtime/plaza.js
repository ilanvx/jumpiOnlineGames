import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { banMessage, needsVerify } from "../routes/auth.js";
import { attachTrading } from "./trade.js";
import { attachDuels } from "./duel.js";
import { EMOTE_LIST, hasEmote } from "../catalog.js";
import { checkText, FRIENDLY_MESSAGE, splitPhone, PRIVATE_MESSAGE } from "../public/shared/profanity.js";
import { ChatLog, AdminLog, logQuietly } from "../models/Logs.js";
import { needsOnline, needsOffline, sendNeeds, moodNow, ateMeal, startNeeds, bumpNeeds } from "./needs.js";
import { outPet } from "../routes/pets.js";
import { houseShape } from "../public/shared/houses.js";
import { BAR_MENU } from "../public/shared/bar.js";
import { foodOf, PARK_STANDS, PARK_MENU, STAND_REACH } from "../public/shared/food.js";
import { foodBag, addFood, biteFood, dropFood } from "./food.js";
import { createCode } from "../models/Code.js";
import { JOBS } from "../public/shared/jobs.js";
import { isBirthdayOn } from "../public/shared/birthday.js";
import { LAUNCH_AT, LAUNCH_HOSTS } from "../public/shared/launch.js";
import { modLog } from "../discord/pip.js";
const TOWN_BOUNDS = { x0: -56, x1: 56, z0: -56, z1: 56 };   // Pizza Town (the delivery job), a big map of your own

/*
  Real-time Plaza: everyone in the same room sees each other move, type and chat.
  Rooms: "plaza" (the open world) or "home:<owner>" (a player's home, with its visitors).
  Only logged-in, non-banned players can connect (same login cookie as the website).
  Admins (role "admin" in the database) can kick, ban, mute, announce and give coins.
*/
const ROOM = "plaza";
const COOKIE = "jumpi_token";
// the whole world: Plaza, Beach (and shallow sea), Park and Desert
const BOUNDS = { x0: -64, x1: 100, z0: -64, z1: 60 };
const HOME_BOUNDS = { x0: -7.4, x1: 7.4, z0: -5.6, z1: 5.6 };
// homes come in different sizes (bigger room, garden, second floor): the box players may move in, per home room
const homeBounds = new Map();
const boundsOf = (room) => (room === ROOM ? BOUNDS : homeBounds.get(room) || HOME_BOUNDS);
const POSES = new Set(["sit", "sleep", "play", "dance"]);
// the shops on the Plaza you can walk into (each one is its own room, the same size as a home)
const PLACES = new Set(["furniture", "clothes", "club", "diner", "pets"]);
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
const publicView = ({ id, username, look, role, x, z, face, moving, status, pose, mood, pet, member, invisible, phone, uniform, bday, hold }) => ({ id, username, look, role, x, z, face, moving, status: status || null, pose: pose || null, mood: mood || null, pet: pet || null, member: !!member, invisible: !!invisible, phone: !!phone, uniform: uniform || null, bday: !!bday, hold: hold || null });
const UNIFORMS = new Set(Object.keys(JOBS));   // work uniforms other players can see

/* ---------- invisible admins ----------
   An admin can play invisibly (on by default; "adminInvisible" on the User). Then only other admins
   in the same room see them (half see-through); everyone else gets nothing at all from them:
   not their character, moves, chat, emotes, pets, badges, and they don't show as online. */
// may player q see player p?
const sees = (q, p) => !p.invisible || q.role === "admin";
// send something about player p to the people in p's room who can see p (self: include p's own window)
function roomSend(p, event, data, { self = true, volatile = false } = {}) {
  if (!ioRef) return;
  if (!p.invisible) {
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
function cleanPose(p) {
  if (!p || !POSES.has(p.k)) return null;
  return { k: p.k, y: clamp(num(p.y), 0, 2), f: num(p.f) };
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
  announce(text, by) {
    const msg = cleanText(text, MAX_ANNOUNCE);
    if (!msg) return null;
    ioRef?.emit("announce", { text: msg, by }); // the Plaza and every home
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
      const { sub, v, tab: isTab } = jwt.verify(token, process.env.JWT_SECRET);
      if (tab && !isTab) return next(new Error("not-logged-in"));
      const user = await User.findById(sub);
      if (!user || (v || 0) !== (user.tokenVersion || 0)) return next(new Error("not-logged-in"));
      if (user.isBanned()) return next(new Error("banned"));
      if (needsVerify(user)) return next(new Error("verify-email"));   // the email code comes first
      // before the grand opening only admins can play on jumpigames.com (see public/shared/launch.js)
      const host = String(socket.handshake.headers["x-forwarded-host"] || socket.handshake.headers.host || "").split(",")[0].trim().split(":")[0].toLowerCase();
      const inApp = /JumpiApp\//.test(String(socket.handshake.headers["user-agent"] || ""));   // players in the Android app can play now
      if (LAUNCH_HOSTS.includes(host) && Date.now() < LAUNCH_AT && user.role !== "admin" && !inApp) return next(new Error("not-open"));
      socket.data.user = user.toPublic();
      if (user.mutedUntil && user.mutedUntil.getTime() > Date.now()) mutedUntil.set(user._id.toString(), user.mutedUntil.getTime());
      next();
    } catch {
      next(new Error("not-logged-in"));
    }
  });


  function removePlayer(id, sock) {
    if (!players.has(id)) return;
    const { room = ROOM, userId } = players.get(id);
    players.delete(id);
    sock?.leave(room);
    io.to(room).emit("player:leave", id);
    // the last game window of this player closed: stop counting their needs
    // (wait a moment: moving to another room or reloading the page removes and adds the player again)
    setTimeout(() => {
      if (![...players.values()].some((p) => p.userId === userId)) needsOffline(userId);
    }, 5000);
  }

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
    const me = socket.data.user;
    socket.emit("whoami", { id: String(me.id || me._id || "") });   // the game checks this is the account it shows (a stale socket after logging in as someone else reconnects)
    const canChat = limiter(5, 5000);
    const canMove = limiter(25, 1000);
    const canAdmin = limiter(20, 10000);
    const canEmote = limiter(4, 4000);
    const canPhone = limiter(12, 10000);
    // "trade" / "duel" badge above a player, seen by everyone
    const setStatus = (sid, status) => {
      const p = players.get(sid);
      if (!p || (p.status || null) === status) return;
      p.status = status;
      roomSend(p, "player:status", { id: sid, status });
    };
    attachTrading(io, socket, { players, me, notifyLook, limiter, setStatus });
    attachDuels(io, socket, { players, limiter, notifyCoins, setStatus });

    socket.on("join", async (pos) => {
      // which room: the Plaza, or someone's home (that player has to exist)
      let room = ROOM;
      const homeOf = cleanText(pos?.home, 32).toLowerCase();
      const place = typeof pos?.place === "string" && PLACES.has(pos.place) ? pos.place : "";
      if (place) {
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
          const owner = await User.findOne({ usernameLower: homeOf }, { house: 1 }).lean();
          if (!owner) return socket.emit("home:gone");
          homeBounds.set("home:" + homeOf, houseShape(owner.house).bounds);
        } catch {
          return;
        }
        room = "home:" + homeOf;
      }
      // fresh look / coins / role from the database (they may have shopped since connecting)
      try {
        const fresh = await User.findById(me.id);
        if (!fresh || fresh.isBanned()) return socket.disconnect(true);
        Object.assign(me, fresh.toPublic());
        needsOnline(me.id, fresh.needs);
        me.pet = outPet(fresh);
        me.member = fresh.isMember();
        me.bday = isBirthdayOn(fresh.birthDate);   // pink name with a cake all day
        me.invisible = fresh.role === "admin" && fresh.adminInvisible !== false;   // admins come in invisible unless they switched it off
      } catch {}
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
        uniform: UNIFORMS.has(pos?.uniform) ? pos.uniform : players.get(socket.id)?.uniform || null,
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
      };
      const already = players.has(socket.id);
      players.set(socket.id, player);
      socket.join(room);
      socket.emit("players", [...players.values()].filter((p) => p.id !== socket.id && p.room === room && sees(player, p)).map(publicView));
      socket.emit("self", { role: me.role, coins: me.coins, mutedUntil: mutedUntil.get(me.id) || 0, invisible: !!player.invisible });
      if (!already) roomSend(player, "player:join", publicView(player), { self: false });
      sendNeeds(me.id);
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
      if (owner && owner.invisible && !sees(p, owner)) return;
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
        const st = PARK_STANDS.find((q) => q.id === it.stand);
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
      p.x = clamp(num(d?.x, p.x), B.x0, B.x1);
      p.z = clamp(num(d?.z, p.z), B.z0, B.z1);
      p.face = num(d?.face, p.face);
      p.moving = d?.moving === true;
      p.pose = p.room === ROOM ? null : cleanPose(d?.pose); // sitting, sleeping and dancing only happen indoors
      p.run = p.moving && d?.run === true;
      roomSend(p, "player:move", { id: p.id, x: p.x, z: p.z, face: p.face, moving: p.moving, run: p.run, pose: p.pose }, { self: false, volatile: true });
    });

    socket.on("chat", async (raw) => {
      const p = players.get(socket.id);
      if (!p) return;
      const until = mutedUntil.get(me.id) || 0;
      if (until > Date.now()) return socket.emit("chat:muted", { until });
      const text = cleanText(raw);
      if (!text) return;
      // phone numbers, addresses and emails never go out (not a strike: the player gets a "never share this" window)
      const chk = checkText(text), sp = splitPhone(phoneBits(me.id), text);
      if (chk.kind === "private" || sp.hit) {
        phoneBits(me.id, "");
        logQuietly(ChatLog, { userId: me.id, username: me.username, room: p.room, text, blocked: true });
        return socket.emit("chat:private", { info: chk.info || "phone", message: PRIVATE_MESSAGE[chk.info || "phone"] });
      }
      phoneBits(me.id, sp.digits);
      // no bad words anywhere (Plaza, homes, trade and game windows all use this)
      if (!chk.ok) {
        logQuietly(ChatLog, { userId: me.id, username: me.username, room: p.room, text, blocked: true });
        const s = await strike(me.id);
        return socket.emit("chat:blocked", { message: FRIENDLY_MESSAGE, left: s.left ?? 0, muted: !!s.muted });
      }
      if (!canChat()) return socket.emit("chat:slow");
      roomSend(p, "chat", { id: p.id, username: p.username, role: p.role, text });
      logQuietly(ChatLog, { userId: me.id, username: me.username, room: p.room, text });
    });

    // taking the phone out / putting it away: everyone around sees the character hold it
    socket.on("phone", (on) => {
      const p = players.get(socket.id);
      if (!p || !canPhone()) return;
      p.phone = on === true;
      roomSend(p, "player:phone", { id: p.id, on: p.phone }, { self: false });
    });

    // put on / take off a work uniform (the police uniform on patrol)
    socket.on("uniform", (job) => {
      const p = players.get(socket.id);
      if (!p || !canPhone()) return;
      p.uniform = UNIFORMS.has(job) ? job : null;
      roomSend(p, "player:uniform", { id: p.id, job: p.uniform }, { self: false });
    });

    socket.on("typing", (on) => {
      const p = players.get(socket.id);
      if (!p) return;
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
          const fresh = await User.findById(me.id).select("inventory");
          if (fresh) me.inventory = fresh.inventory;
        } catch {}
        if (!hasEmote(me.inventory, e)) return reply({ ok: false, why: "locked" });
      }
      if (!players.has(socket.id)) return;
      roomSend(p, "emote", { id: p.id, e });
      const seen = (io.sockets.adapter?.rooms?.get(p.room)?.size || 1) - 1;
      console.log(`[emote] ${p.username} ${e} in ${p.room} -> seen by ${seen} other player(s)`);
      reply({ ok: true, seen });
    });

    // Space: a jump with a flip (dir 1 = forwards, -1 = backwards), or a small hop in the water
    socket.on("hop", (d) => {
      const p = players.get(socket.id);
      if (!p) return;
      roomSend(p, "hop", { id: p.id, dir: d?.dir === 1 ? 1 : -1, small: d?.small === true }, { self: false });
    });

    socket.on("leave", () => removePlayer(socket.id, socket));
    socket.on("disconnect", () => removePlayer(socket.id, socket));

    /* ---------------- admin actions ---------------- */
    // every action re-checks the database, so a stale or forged role can't be used
    // { mods: true } = moderators may use it too (with their limits: see findTarget, ban and coins below)
    function adminAction(name, handler, { mods = false } = {}) {
      socket.on(name, async (data, ack) => {
        const reply = typeof ack === "function" ? ack : () => {};
        try {
          if (!canAdmin()) return reply({ ok: false, error: "Too many actions. Wait a few seconds." });
          const admin = await User.findById(me.id);
          const allowed = admin && (admin.role === "admin" || (mods && admin.role === "mod"));
          if (!allowed || admin.isBanned()) return reply({ ok: false, error: mods ? "Only moderators and admins can do that." : "Only admins can do that." });
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
      logQuietly(AdminLog, { adminId: admin._id, admin: admin.username, action, targetId: user?._id, target: user?.username || "", details, via: "game", ip: socket.handshake.address || "" });
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
    }, { mods: true });

    adminAction("admin:unban", async ({ username }, admin) => {
      const user = await findTarget(username, admin);
      if (admin.role === "mod" && user.bannedUntil && user.bannedUntil.getFullYear() >= 9000) throw fail("Only an admin can lift a permanent ban.");
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
    }, { mods: true });

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
    });

    adminAction("admin:announce", async ({ text }, admin) => {
      const msg = moderation.announce(text, admin.username);
      if (!msg) throw fail("Write a message first.");
      audit(admin, "announce", null, msg);
      return { message: "Announcement sent to everyone in the Plaza." };
    });
  });
}

// called by the shop when someone changes clothes: everyone in the Plaza sees it
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
export function onlinePlayers(seeHidden = true, selfId = "") {
  const seen = new Map();
  for (const p of players.values())
    if (!seen.has(p.userId) && (seeHidden || !p.invisible || p.userId === selfId))
      seen.set(p.userId, { userId: p.userId, username: p.username, look: p.look, role: p.role, where: p.room || ROOM, invisible: !!p.invisible });
  return [...seen.values()];
}
// send something to every window this player has open in the game
export function emitToUser(userId, event, data) {
  if (!ioRef) return;
  for (const p of players.values()) if (p.userId === userId) ioRef.to(p.id).emit(event, data);
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
