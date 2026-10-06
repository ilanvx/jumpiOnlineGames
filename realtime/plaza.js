import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { banMessage } from "../routes/auth.js";

/*
  Real-time Plaza: everyone in the same room sees each other move, type and chat.
  Only logged-in, non-banned players can connect (same login cookie as the website).
  Admins (role "admin" in the database) can kick, ban, mute, announce and give coins.
*/
const ROOM = "plaza";
const COOKIE = "jumpi_token";
// the whole world: Plaza, Beach (and shallow sea), Park and Desert
const BOUNDS = { x0: -42, x1: 86, z0: -46, z1: 60 };
const MAX_CHAT = 80;
const MAX_ANNOUNCE = 160;
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

const publicView = ({ id, username, look, role, x, z, face, moving }) => ({ id, username, look, role, x, z, face, moving });

export function attachPlaza(io) {
  ioRef = io;
  // who is connecting? read the login cookie
  io.use(async (socket, next) => {
    try {
      const token = readCookie(socket.handshake.headers.cookie, COOKIE);
      if (!token) return next(new Error("not-logged-in"));
      const { sub } = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(sub);
      if (!user) return next(new Error("not-logged-in"));
      if (user.isBanned()) return next(new Error("banned"));
      socket.data.user = user.toPublic();
      if (user.mutedUntil && user.mutedUntil.getTime() > Date.now()) mutedUntil.set(user._id.toString(), user.mutedUntil.getTime());
      next();
    } catch {
      next(new Error("not-logged-in"));
    }
  });

  const socketsOf = (userId) => [...players.values()].filter((p) => p.userId === userId).map((p) => io.sockets.sockets.get(p.id)).filter(Boolean);

  function removePlayer(id, sock) {
    if (!players.has(id)) return;
    players.delete(id);
    sock?.leave(ROOM);
    io.to(ROOM).emit("player:leave", id);
  }

  io.on("connection", (socket) => {
    const me = socket.data.user;
    const canChat = limiter(5, 5000);
    const canMove = limiter(25, 1000);
    const canAdmin = limiter(20, 10000);

    socket.on("join", async (pos) => {
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
      const player = {
        id: socket.id,
        userId: me.id,
        username: me.username,
        look: me.look,
        role: me.role,
        x: clamp(num(pos?.x), BOUNDS.x0, BOUNDS.x1),
        z: clamp(num(pos?.z, 9), BOUNDS.z0, BOUNDS.z1),
        face: num(pos?.face),
        moving: false,
      };
      const already = players.has(socket.id);
      players.set(socket.id, player);
      socket.join(ROOM);
      socket.emit("players", [...players.values()].filter((p) => p.id !== socket.id).map(publicView));
      socket.emit("self", { role: me.role, coins: me.coins, mutedUntil: mutedUntil.get(me.id) || 0 });
      if (!already) socket.to(ROOM).emit("player:join", publicView(player));
    });

    socket.on("move", (d) => {
      const p = players.get(socket.id);
      if (!p || !canMove()) return;
      p.x = clamp(num(d?.x, p.x), BOUNDS.x0, BOUNDS.x1);
      p.z = clamp(num(d?.z, p.z), BOUNDS.z0, BOUNDS.z1);
      p.face = num(d?.face, p.face);
      p.moving = d?.moving === true;
      socket.to(ROOM).volatile.emit("player:move", { id: p.id, x: p.x, z: p.z, face: p.face, moving: p.moving });
    });

    socket.on("chat", (raw) => {
      const p = players.get(socket.id);
      if (!p) return;
      const until = mutedUntil.get(me.id) || 0;
      if (until > Date.now()) return socket.emit("chat:muted", { until });
      const text = cleanText(raw);
      if (!text) return;
      if (!canChat()) return socket.emit("chat:slow");
      io.to(ROOM).emit("chat", { id: p.id, username: p.username, role: p.role, text });
    });

    socket.on("typing", (on) => {
      const p = players.get(socket.id);
      if (!p) return;
      if (on === true && (mutedUntil.get(me.id) || 0) > Date.now()) return;
      socket.to(ROOM).emit("typing", { id: p.id, on: on === true });
    });

    socket.on("hop", () => {
      const p = players.get(socket.id);
      if (p) socket.to(ROOM).emit("hop", p.id);
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
    const minutesFrom = (v, max = 60 * 24 * 365) => clamp(Math.round(num(v)), 1, max);

    adminAction("admin:kick", async ({ username }, admin) => {
      const user = await findTarget(username, admin);
      const socks = socketsOf(user._id.toString());
      if (!socks.length) throw fail(`${user.username} isn't in the Plaza right now.`);
      for (const s of socks) {
        s.emit("kicked:admin");
        removePlayer(s.id, s);
        s.disconnect(true);
      }
      return { message: `${user.username} was kicked.` };
    });

    adminAction("admin:ban", async ({ username, minutes, reason }, admin) => {
      const user = await findTarget(username, admin);
      const permanent = num(minutes) <= 0;
      user.bannedUntil = permanent ? PERMANENT : new Date(Date.now() + minutesFrom(minutes) * 60000);
      user.banReason = cleanText(reason, 120);
      await user.save();
      for (const s of socketsOf(user._id.toString())) {
        s.emit("banned", { message: banMessage(user) });
        removePlayer(s.id, s);
        s.disconnect(true);
      }
      return { message: `${user.username} is banned ${permanent ? "permanently" : `for ${minutesFrom(minutes)} min`}.` };
    });

    adminAction("admin:unban", async ({ username }, admin) => {
      const user = await findTarget(username, admin);
      user.bannedUntil = null;
      user.banReason = "";
      await user.save();
      return { message: `${user.username} is no longer banned.` };
    });

    adminAction("admin:mute", async ({ username, minutes }, admin) => {
      const user = await findTarget(username, admin);
      const m = minutesFrom(minutes, 60 * 24 * 30);
      user.mutedUntil = new Date(Date.now() + m * 60000);
      await user.save();
      const id = user._id.toString();
      mutedUntil.set(id, user.mutedUntil.getTime());
      for (const s of socketsOf(id)) {
        s.emit("muted", { until: user.mutedUntil.getTime() });
        s.to(ROOM).emit("typing", { id: s.id, on: false });
      }
      return { message: `${user.username} is muted for ${m} min.` };
    });

    adminAction("admin:unmute", async ({ username }, admin) => {
      const user = await findTarget(username, admin);
      user.mutedUntil = null;
      await user.save();
      const id = user._id.toString();
      mutedUntil.delete(id);
      for (const s of socketsOf(id)) s.emit("muted", { until: 0 });
      return { message: `${user.username} can chat again.` };
    });

    adminAction("admin:coins", async ({ username, amount }, admin) => {
      const user = await findTarget(username, admin, { allowSelf: true, allowAdmin: true });
      const delta = Math.round(num(amount));
      if (!delta || Math.abs(delta) > 1_000_000) throw fail("Enter an amount between 1 and 1,000,000.");
      user.coins = Math.max(0, (user.coins || 0) + delta);
      await user.save();
      for (const s of socketsOf(user._id.toString())) s.emit("coins", { coins: user.coins, delta });
      return { message: `${user.username} now has ${user.coins.toLocaleString("en-US")} coins.` };
    });

    adminAction("admin:announce", async ({ text }, admin) => {
      const msg = cleanText(text, MAX_ANNOUNCE);
      if (!msg) throw fail("Write a message first.");
      io.to(ROOM).emit("announce", { text: msg, by: admin.username });
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
    ioRef.to(ROOM).emit("player:look", { id: p.id, look });
  }
}
// called after a purchase so an open game window shows the new balance
export function notifyCoins(userId, coins) {
  if (!ioRef) return;
  for (const p of players.values()) if (p.userId === userId) ioRef.to(p.id).emit("coins", { coins, delta: 0 });
}
