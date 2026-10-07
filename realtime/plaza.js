import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { banMessage } from "../routes/auth.js";
import { attachTrading } from "./trade.js";
import { attachDuels } from "./duel.js";
import { EMOTE_LIST, hasEmote } from "../catalog.js";
import { checkText, FRIENDLY_MESSAGE } from "../public/shared/profanity.js";
import { ChatLog, AdminLog, logQuietly } from "../models/Logs.js";

/*
  Real-time Plaza: everyone in the same room sees each other move, type and chat.
  Rooms: "plaza" (the open world) or "home:<owner>" (a player's home, with its visitors).
  Only logged-in, non-banned players can connect (same login cookie as the website).
  Admins (role "admin" in the database) can kick, ban, mute, announce and give coins.
*/
const ROOM = "plaza";
const COOKIE = "jumpi_token";
// the whole world: Plaza, Beach (and shallow sea), Park and Desert
const BOUNDS = { x0: -42, x1: 86, z0: -46, z1: 60 };
const HOME_BOUNDS = { x0: -7.4, x1: 7.4, z0: -5.6, z1: 5.6 };
const POSES = new Set(["sit", "sleep", "play", "dance"]);
// the shops on the Plaza you can walk into (each one is its own room, the same size as a home)
const PLACES = new Set(["furniture", "clothes", "club", "diner"]);
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

const publicView = ({ id, username, look, role, x, z, face, moving, status, pose }) => ({ id, username, look, role, x, z, face, moving, status: status || null, pose: pose || null });
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
      const token = readCookie(socket.handshake.headers.cookie, COOKIE);
      if (!token) return next(new Error("not-logged-in"));
      const { sub, v } = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(sub);
      if (!user || (v || 0) !== (user.tokenVersion || 0)) return next(new Error("not-logged-in"));
      if (user.isBanned()) return next(new Error("banned"));
      socket.data.user = user.toPublic();
      if (user.mutedUntil && user.mutedUntil.getTime() > Date.now()) mutedUntil.set(user._id.toString(), user.mutedUntil.getTime());
      next();
    } catch {
      next(new Error("not-logged-in"));
    }
  });


  function removePlayer(id, sock) {
    if (!players.has(id)) return;
    const room = players.get(id)?.room || ROOM;
    players.delete(id);
    sock?.leave(room);
    io.to(room).emit("player:leave", id);
  }

  io.on("connection", (socket) => {
    const me = socket.data.user;
    const canChat = limiter(5, 5000);
    const canMove = limiter(25, 1000);
    const canAdmin = limiter(20, 10000);
    const canEmote = limiter(4, 4000);
    // "trade" / "duel" badge above a player, seen by everyone
    const setStatus = (sid, status) => {
      const p = players.get(sid);
      if (!p || (p.status || null) === status) return;
      p.status = status;
      io.to(p.room).emit("player:status", { id: sid, status });
    };
    attachTrading(io, socket, { players, me, notifyLook, limiter, setStatus });
    attachDuels(io, socket, { players, limiter, notifyCoins, setStatus });

    socket.on("join", async (pos) => {
      // which room: the Plaza, or someone's home (that player has to exist)
      let room = ROOM;
      const homeOf = cleanText(pos?.home, 32).toLowerCase();
      const place = typeof pos?.place === "string" && PLACES.has(pos.place) ? pos.place : "";
      if (place) room = "place:" + place;
      else if (homeOf) {
        try {
          if (!(await User.exists({ usernameLower: homeOf }))) return socket.emit("home:gone");
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
      } catch {}
      // the same account in a second window: the older window leaves
      for (const [id, p] of players) {
        if (p.userId === me.id && id !== socket.id) {
          const old = io.sockets.sockets.get(id);
          old?.emit("kicked");
          removePlayer(id, old);
        }
      }
      const B = room === ROOM ? BOUNDS : HOME_BOUNDS;
      // moving to another room: the old room sees you leave
      const before = players.get(socket.id);
      if (before && before.room !== room) removePlayer(socket.id, socket);
      const player = {
        id: socket.id,
        room,
        status: players.get(socket.id)?.status || null,
        userId: me.id,
        username: me.username,
        look: me.look,
        role: me.role,
        x: clamp(num(pos?.x), B.x0, B.x1),
        z: clamp(num(pos?.z, 9), B.z0, B.z1),
        face: num(pos?.face),
        moving: false,
      };
      const already = players.has(socket.id);
      players.set(socket.id, player);
      socket.join(room);
      socket.emit("players", [...players.values()].filter((p) => p.id !== socket.id && p.room === room).map(publicView));
      socket.emit("self", { role: me.role, coins: me.coins, mutedUntil: mutedUntil.get(me.id) || 0 });
      if (!already) socket.to(room).emit("player:join", publicView(player));
    });

    socket.on("move", (d) => {
      const p = players.get(socket.id);
      if (!p || !canMove()) return;
      const B = p.room === ROOM ? BOUNDS : HOME_BOUNDS;
      p.x = clamp(num(d?.x, p.x), B.x0, B.x1);
      p.z = clamp(num(d?.z, p.z), B.z0, B.z1);
      p.face = num(d?.face, p.face);
      p.moving = d?.moving === true;
      p.pose = p.room === ROOM ? null : cleanPose(d?.pose); // sitting, sleeping and dancing only happen indoors
      p.run = p.moving && d?.run === true;
      socket.to(p.room).volatile.emit("player:move", { id: p.id, x: p.x, z: p.z, face: p.face, moving: p.moving, run: p.run, pose: p.pose });
    });

    socket.on("chat", async (raw) => {
      const p = players.get(socket.id);
      if (!p) return;
      const until = mutedUntil.get(me.id) || 0;
      if (until > Date.now()) return socket.emit("chat:muted", { until });
      const text = cleanText(raw);
      if (!text) return;
      // no bad words anywhere (Plaza, homes, trade and game windows all use this)
      if (!checkText(text).ok) {
        logQuietly(ChatLog, { userId: me.id, username: me.username, room: p.room, text, blocked: true });
        const s = await strike(me.id);
        return socket.emit("chat:blocked", { message: FRIENDLY_MESSAGE, left: s.left ?? 0, muted: !!s.muted });
      }
      if (!canChat()) return socket.emit("chat:slow");
      io.to(p.room).emit("chat", { id: p.id, username: p.username, role: p.role, text });
      logQuietly(ChatLog, { userId: me.id, username: me.username, room: p.room, text });
    });

    socket.on("typing", (on) => {
      const p = players.get(socket.id);
      if (!p) return;
      if (on === true && (mutedUntil.get(me.id) || 0) > Date.now()) return;
      socket.to(p.room).emit("typing", { id: p.id, on: on === true });
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
      if (!hasEmote(me.inventory, e)) {
        try {
          const fresh = await User.findById(me.id).select("inventory");
          if (fresh) me.inventory = fresh.inventory;
        } catch {}
        if (!hasEmote(me.inventory, e)) return reply({ ok: false, why: "locked" });
      }
      if (!players.has(socket.id)) return;
      io.to(p.room).emit("emote", { id: p.id, e });
      const seen = (io.sockets.adapter?.rooms?.get(p.room)?.size || 1) - 1;
      console.log(`[emote] ${p.username} ${e} in ${p.room} -> seen by ${seen} other player(s)`);
      reply({ ok: true, seen });
    });

    // Space: a jump with a flip (dir 1 = forwards, -1 = backwards), or a small hop in the water
    socket.on("hop", (d) => {
      const p = players.get(socket.id);
      if (!p) return;
      socket.to(p.room).emit("hop", { id: p.id, dir: d?.dir === 1 ? 1 : -1, small: d?.small === true });
    });

    socket.on("leave", () => removePlayer(socket.id, socket));
    socket.on("disconnect", () => removePlayer(socket.id, socket));

    /* ---------------- admin actions ---------------- */
    // every action re-checks the database, so a stale or forged role can't be used
    function adminAction(name, handler) {
      socket.on(name, async (data, ack) => {
        const reply = typeof ack === "function" ? ack : () => {};
        try {
          if (!canAdmin()) return reply({ ok: false, error: "Too many actions. Wait a few seconds." });
          const admin = await User.findById(me.id);
          if (!admin || admin.role !== "admin" || admin.isBanned()) return reply({ ok: false, error: "Only admins can do that." });
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
      return user;
    }

    const audit = (admin, action, user, details = "") =>
      logQuietly(AdminLog, { adminId: admin._id, admin: admin.username, action, targetId: user?._id, target: user?.username || "", details, via: "game", ip: socket.handshake.address || "" });

    adminAction("admin:kick", async ({ username }, admin) => {
      const user = await findTarget(username, admin);
      if (!moderation.kick(user._id.toString())) throw fail(`${user.username} isn't in the Plaza right now.`);
      audit(admin, "kick", user);
      return { message: `${user.username} was kicked.` };
    });

    adminAction("admin:ban", async ({ username, minutes, reason }, admin) => {
      const user = await findTarget(username, admin);
      const how = await moderation.ban(user, minutes, reason);
      audit(admin, "ban", user, `${how}${user.banReason ? " · " + user.banReason : ""}`);
      return { message: `${user.username} is banned ${how}.` };
    });

    adminAction("admin:unban", async ({ username }, admin) => {
      const user = await findTarget(username, admin);
      await moderation.unban(user);
      audit(admin, "unban", user);
      return { message: `${user.username} is no longer banned.` };
    });

    adminAction("admin:mute", async ({ username, minutes }, admin) => {
      const user = await findTarget(username, admin);
      const m = await moderation.mute(user, minutes);
      audit(admin, "mute", user, `${m} min`);
      return { message: `${user.username} is muted for ${m} min.` };
    });

    adminAction("admin:unmute", async ({ username }, admin) => {
      const user = await findTarget(username, admin);
      await moderation.unmute(user);
      audit(admin, "unmute", user);
      return { message: `${user.username} can chat again.` };
    });

    adminAction("admin:coins", async ({ username, amount }, admin) => {
      const user = await findTarget(username, admin, { allowSelf: true, allowAdmin: true });
      const delta = Math.round(num(amount));
      if (!delta || Math.abs(delta) > 1_000_000) throw fail("Enter an amount between 1 and 1,000,000.");
      const coins = await moderation.addCoins(user, delta);
      audit(admin, "coins", user, `${delta > 0 ? "+" : ""}${delta} → ${coins}`);
      return { message: `${user.username} now has ${coins.toLocaleString("en-US")} coins.` };
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
    ioRef.to(p.room).emit("player:look", { id: p.id, look });
  }
}
// called after a purchase so an open game window shows the new balance
export function notifyCoins(userId, coins) {
  if (!ioRef) return;
  for (const p of players.values()) if (p.userId === userId) ioRef.to(p.id).emit("coins", { coins, delta: 0 });
}
// the owner changed their home: visitors who are inside see it right away
export function notifyHome(usernameLower, home) {
  if (ioRef) ioRef.to("home:" + usernameLower).emit("home:update", { home });
}

/* ---------- who is online (for the phone: friends, online list, JumpiChat) ---------- */
// where a player is right now: "plaza", "home:<name>" or null when not in the game
export function onlineWhere(userId) {
  for (const p of players.values()) if (p.userId === userId) return p.room || ROOM;
  return null;
}
export function onlinePlayers() {
  const seen = new Map();
  for (const p of players.values()) if (!seen.has(p.userId)) seen.set(p.userId, { userId: p.userId, username: p.username, look: p.look, role: p.role, where: p.room || ROOM });
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
