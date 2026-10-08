import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Message } from "../models/Message.js";
import { ContactMessage } from "../models/ContactMessage.js";
import { Order } from "../models/Order.js";
import { Code, CodeUse, createCode } from "../models/Code.js";
import { EMAIL_ON, sendMail } from "../mail/send.js";
import { discordOn, modLog, postGiftCode } from "../discord/pip.js";
import { contactReplyEmail, ANSWER_SLOT } from "../mail/contactReply.js";
import { ChatLog, TradeLog, DuelLog, AdminLog, logQuietly } from "../models/Logs.js";
import { currentUser } from "./auth.js";
import { CATALOG, ITEMS, LOOK_SLOTS, MAX_FURNITURE } from "../catalog.js";
import { moderation, onlinePlayers, onlineWhere, setInvisible, modBudgetLeft, MOD_BUDGET } from "../realtime/plaza.js";
import { MOD_ITEMS } from "../catalog.js";
import { checkName } from "../public/shared/profanity.js";

/*
  The /admin website. Security, in layers:
  1. Signed in (the normal login cookie) AND role "admin" in the database, checked on every request.
     Anyone else gets "Not found", so the panel doesn't even admit it exists.
  2. Admins must type their password again to unlock the panel. The unlock lasts 30 minutes
     (renewed while active), lives in its own HttpOnly + SameSite=Strict cookie, and stops working
     if the admin's password is reset.
  3. Changes only accept JSON from this same site (blocks cross-site forms and requests).
  4. Rate limits, and every action (and every unlock attempt) is written to the admin log.
  5. Admins can't act on other admins (ban, mute, password...). Roles are only changed with
     `npm run make-admin` on the server computer.
*/
const router = express.Router();
const UNLOCK = "jumpi_admin";
const UNLOCK_MS = 30 * 60 * 1000;
const isId = (v) => mongoose.isValidObjectId(v);
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const clean = (v, max = 200) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const fail = (res, code, error, extra) => res.status(code).json({ error, ...extra });
const PAGE = 50;

// small per-key limiter
function limiter(max, ms) {
  const hits = new Map();
  return (key) => {
    const now = Date.now(), list = (hits.get(key) || []).filter((t) => now - t < ms);
    if (list.length >= max) return false;
    list.push(now);
    hits.set(key, list);
    if (hits.size > 2000) hits.clear();
    return true;
  };
}
const canUnlock = limiter(5, 15 * 60 * 1000);
const canCall = limiter(240, 60 * 1000);
const canChange = limiter(40, 60 * 1000);

function audit(req, action, user, details = "") {
  logQuietly(AdminLog, { adminId: req.admin._id, admin: req.admin.username, action, targetId: user?._id, target: user?.username || "", details: clean(details, 300), via: "panel", ip: req.ip || "" });
  modLog({ by: req.admin.username, byRole: "admin", action, target: user?.username, details: clean(details, 300), via: "panel" });   // #mod-log in Discord (moderation actions only)
}

/* ---------- layer 1: only admins, everything else is "Not found" ---------- */
router.use(async (req, res, next) => {
  res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
  try {
    const user = await currentUser(req);
    if (!user || user.role !== "admin" || user.isBanned()) return fail(res, 404, "Not found.");
    const as = req.get("x-jumpi-as");   // the game window plays another account (see requireUser in shop.js)
    if (as && as !== user._id.toString()) return res.status(409).json({ error: "You switched account in another tab.", code: "account-changed", now: user.username });
    req.admin = user;
    if (!canCall(user._id.toString())) return fail(res, 429, "Too many requests. Slow down a little.");
    next();
  } catch (err) {
    next(err);
  }
});

/* ---------- layer 3: changes must be JSON from this same site ---------- */
router.use((req, res, next) => {
  if (req.method === "GET") return next();
  if (!req.is("application/json")) return fail(res, 415, "Send JSON.");
  const origin = req.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== req.get("host")) return fail(res, 403, "Wrong origin.");
    } catch {
      return fail(res, 403, "Wrong origin.");
    }
  }
  if (!canChange(req.admin._id.toString())) return fail(res, 429, "Too many changes. Wait a minute.");
  next();
});

/* ---------- layer 2: unlock with the password ---------- */
function unlockedUntil(req) {
  try {
    const p = jwt.verify(req.cookies?.[UNLOCK] || "", process.env.JWT_SECRET);
    if (p.k !== "admin" || p.sub !== req.admin._id.toString() || (p.v || 0) !== (req.admin.tokenVersion || 0)) return 0;
    return p.exp * 1000;
  } catch {
    return 0;
  }
}
function setUnlock(req, res) {
  const token = jwt.sign({ sub: req.admin._id.toString(), v: req.admin.tokenVersion || 0, k: "admin" }, process.env.JWT_SECRET, { expiresIn: UNLOCK_MS / 1000 });
  res.cookie(UNLOCK, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/api/admin", maxAge: UNLOCK_MS });
  return Date.now() + UNLOCK_MS;
}

router.get("/session", (req, res) => {
  const until = unlockedUntil(req);
  res.json({ admin: req.admin.username, unlocked: until > Date.now(), until, invisible: req.admin.adminInvisible !== false });
});

router.post("/unlock", async (req, res, next) => {
  try {
    if (!canUnlock(req.admin._id.toString() + "|" + req.ip)) return fail(res, 429, "Too many tries. Wait 15 minutes.");
    const ok = typeof req.body.password === "string" && (await bcrypt.compare(req.body.password, req.admin.passwordHash));
    audit(req, ok ? "unlock" : "unlock-failed", null);
    if (!ok) return fail(res, 401, "Wrong password.");
    res.json({ ok: true, until: setUnlock(req, res) });
  } catch (err) {
    next(err);
  }
});

router.post("/lock", (req, res) => {
  res.clearCookie(UNLOCK, { path: "/api/admin", sameSite: "strict", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  res.json({ ok: true });
});

router.use((req, res, next) => {
  const until = unlockedUntil(req);
  if (until <= Date.now()) return fail(res, 401, "Locked. Enter your password.", { locked: true });
  if (until - Date.now() < UNLOCK_MS - 5 * 60 * 1000) setUnlock(req, res);   // keep it open while the admin is working
  next();
});

/* ---------- helpers for players ---------- */
const brief = (u) => ({
  id: u._id.toString(), username: u.username, email: u.email, role: u.role || "player", coins: u.coins || 0,
  createdAt: u.createdAt, lastLoginAt: u.lastLoginAt || null,
  verified: u.emailVerified !== false,   // false only while an email code is still waiting
  bannedUntil: u.bannedUntil && u.bannedUntil.getTime() > Date.now() ? u.bannedUntil : null, banReason: u.banReason || "",
  mutedUntil: u.mutedUntil && u.mutedUntil.getTime() > Date.now() ? u.mutedUntil : null,
  online: onlineWhere(u._id.toString()),
});
async function target(req, res, { allowSelf = false, allowAdmin = false } = {}) {
  if (!isId(req.params.id)) return fail(res, 404, "No such player."), null;
  const user = await User.findById(req.params.id);
  if (!user) return fail(res, 404, "No such player."), null;
  const self = user._id.equals(req.admin._id);
  if (self && !allowSelf) return fail(res, 403, "You can't do that to yourself."), null;
  if (!self && user.role === "admin" && !allowAdmin) return fail(res, 403, "You can't do that to another admin."), null;
  return user;
}

/* ---------- overview ---------- */
router.get("/overview", async (req, res, next) => {
  try {
    const now = new Date(), day = new Date(Date.now() - 864e5), week = new Date(Date.now() - 7 * 864e5);
    const online = onlinePlayers();
    const rooms = {};
    for (const p of online) { const r = p.where.startsWith("home:") ? "homes" : p.where; rooms[r] = (rooms[r] || 0) + 1; }
    const [users, new24, new7, banned, muted, chat24, blocked24, trades24, duels24, contactOpen, recent, rich] = await Promise.all([
      User.estimatedDocumentCount(), User.countDocuments({ createdAt: { $gte: day } }), User.countDocuments({ createdAt: { $gte: week } }),
      User.countDocuments({ bannedUntil: { $gt: now } }), User.countDocuments({ mutedUntil: { $gt: now } }),
      ChatLog.countDocuments({ at: { $gte: day }, blocked: false }), ChatLog.countDocuments({ at: { $gte: day }, blocked: true }),
      TradeLog.countDocuments({ at: { $gte: day } }), DuelLog.countDocuments({ at: { $gte: day } }), ContactMessage.countDocuments({ handled: false }),
      AdminLog.find().sort({ at: -1 }).limit(8).lean(), User.find().sort({ coins: -1 }).limit(5).select("username coins").lean(),
    ]);
    res.json({ users, new24, new7, banned, muted, online: online.length, rooms, chat24, blocked24, trades24, duels24, contactOpen, recent, rich });
  } catch (err) {
    next(err);
  }
});

router.get("/online", (req, res) => {
  res.json({ players: onlinePlayers().sort((a, b) => a.username.localeCompare(b.username)) });
});

/* ---------- players ---------- */
router.get("/users", async (req, res, next) => {
  try {
    const q = clean(req.query.q, 64).toLowerCase(), filter = String(req.query.filter || ""), page = Math.max(0, Math.floor(num(req.query.page)));
    const find = {};
    if (q) find.$or = [{ usernameLower: { $regex: "^" + esc(q) } }, { email: { $regex: esc(q) } }];
    const now = new Date();
    if (filter === "banned") find.bannedUntil = { $gt: now };
    else if (filter === "muted") find.mutedUntil = { $gt: now };
    else if (filter === "admins") find.role = "admin";
    else if (filter === "mods") find.role = "mod";
    else if (filter === "unverified") find.emailVerified = false;
    else if (filter === "new") find.createdAt = { $gte: new Date(Date.now() - 7 * 864e5) };
    else if (filter === "online") find._id = { $in: onlinePlayers().map((p) => p.userId).filter(isId) };
    const sort = filter === "rich" ? { coins: -1 } : { createdAt: -1 };
    const [list, total] = await Promise.all([
      User.find(find).sort(sort).skip(page * PAGE).limit(PAGE).select("username email role coins createdAt lastLoginAt bannedUntil banReason mutedUntil emailVerified"),
      User.countDocuments(find),
    ]);
    res.json({ users: list.map(brief), total, page, pages: Math.ceil(total / PAGE) });
  } catch (err) {
    next(err);
  }
});

router.get("/users/:id", async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, "No such player.");
    const u = await User.findById(req.params.id);
    if (!u) return fail(res, 404, "No such player.");
    const ids = [...(u.friends || []), ...(u.friendReqIn || [])];
    const names = new Map((await User.find({ _id: { $in: ids } }).select("username").lean()).map((x) => [x._id.toString(), x.username]));
    const counts = [...u.itemCounts()].map(([id, n]) => ({ id, n, name: ITEMS.get(id)?.name || id, category: ITEMS.get(id)?.category || id.split(":")[0] }));
    const [trades, duels, chats, blocked, history, partners] = await Promise.all([
      TradeLog.countDocuments({ $or: [{ "a.userId": u._id }, { "b.userId": u._id }] }),
      DuelLog.countDocuments({ "players.userId": u._id }),
      ChatLog.countDocuments({ userId: u._id, blocked: false }),
      ChatLog.countDocuments({ userId: u._id, blocked: true }),
      AdminLog.find({ targetId: u._id }).sort({ at: -1 }).limit(30).lean(),
      Message.aggregate([{ $match: { $or: [{ from: u._id }, { to: u._id }] } },
        { $group: { _id: { $cond: [{ $eq: ["$from", u._id] }, "$to", "$from"] }, n: { $sum: 1 }, last: { $max: "$at" } } }, { $sort: { last: -1 } }, { $limit: 50 }]),
    ]);
    const pNames = new Map((await User.find({ _id: { $in: partners.map((p) => p._id) } }).select("username").lean()).map((x) => [x._id.toString(), x.username]));
    res.json({
      user: {
        ...brief(u), look: u.publicLook(), items: counts.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
        friends: (u.friends || []).map((id) => names.get(id.toString())).filter(Boolean),
        requests: (u.friendReqIn || []).map((id) => names.get(id.toString())).filter(Boolean),
        modBudgetLeft: u.role === "mod" ? modBudgetLeft(u) : null, modBudget: MOD_BUDGET,
        homeItems: (u.home?.items || []).length, dailyStreak: u.dailyStreak || 0, acceptedTermsAt: u.acceptedTermsAt, ageConfirmedAt: u.ageConfirmedAt,
        counts: { trades, duels, chats, blocked },
      },
      history,
      conversations: partners.map((p) => ({ id: p._id.toString(), username: pNames.get(p._id.toString()) || "(deleted)", n: p.n, last: p.last })),
    });
  } catch (err) {
    next(err);
  }
});

// a private conversation (reading it is written to the admin log)
router.get("/users/:id/messages/:other", async (req, res, next) => {
  try {
    if (!isId(req.params.id) || !isId(req.params.other)) return fail(res, 404, "Not found.");
    const [u, o] = await Promise.all([User.findById(req.params.id).select("username"), User.findById(req.params.other).select("username")]);
    if (!u) return fail(res, 404, "No such player.");
    const list = await Message.find({ $or: [{ from: u._id, to: req.params.other }, { from: req.params.other, to: u._id }] }).sort({ at: -1 }).limit(200).lean();
    audit(req, "read-messages", u, `with ${o?.username || "(deleted)"}`);
    res.json({ messages: list.reverse().map((m) => ({ from: m.from.equals(u._id) ? u.username : o?.username || "(deleted)", text: m.text, at: m.at })) });
  } catch (err) {
    next(err);
  }
});

/* ---------- actions on a player ---------- */
const passwordOk = async (req) => typeof req.body.password === "string" && req.body.password.length <= 128 && (await bcrypt.compare(req.body.password, req.admin.passwordHash));
const ACTIONS = {
  async kick(req, res) {
    const u = await target(req, res); if (!u) return;
    const n = moderation.kick(u._id.toString());
    if (!n) return fail(res, 409, `${u.username} isn't in the game right now.`);
    audit(req, "kick", u);
    return `${u.username} was kicked.`;
  },
  async ban(req, res) {
    const u = await target(req, res); if (!u) return;
    const how = await moderation.ban(u, req.body.minutes, req.body.reason);
    audit(req, "ban", u, `${how}${u.banReason ? " · " + u.banReason : ""}`);
    return `${u.username} is banned ${how}.`;
  },
  async unban(req, res) {
    const u = await target(req, res); if (!u) return;
    await moderation.unban(u); audit(req, "unban", u);
    return `${u.username} is no longer banned.`;
  },
  async mute(req, res) {
    const u = await target(req, res); if (!u) return;
    const m = await moderation.mute(u, req.body.minutes); audit(req, "mute", u, `${m} min`);
    return `${u.username} is muted for ${m} min.`;
  },
  async unmute(req, res) {
    const u = await target(req, res); if (!u) return;
    await moderation.unmute(u); audit(req, "unmute", u);
    return `${u.username} can chat again.`;
  },
  async coins(req, res) {
    const u = await target(req, res, { allowSelf: true }); if (!u) return;
    const delta = Math.round(num(req.body.amount));
    if (!delta || Math.abs(delta) > 1_000_000) return fail(res, 400, "Enter an amount between 1 and 1,000,000 (use minus to take coins away).");
    const coins = await moderation.addCoins(u, delta);
    audit(req, "coins", u, `${delta > 0 ? "+" : ""}${delta} → ${coins}${req.body.note ? " · " + clean(req.body.note, 120) : ""}`);
    return `${u.username} now has ${coins.toLocaleString("en-US")} coins.`;
  },
  async password(req, res) {
    const u = await target(req, res); if (!u) return;
    const pw = req.body.password;
    if (typeof pw !== "string" || pw.length < 8 || pw.length > 128) return fail(res, 400, "The new password needs 8 to 128 characters.");
    u.passwordHash = await bcrypt.hash(pw, 12);
    u.tokenVersion = (u.tokenVersion || 0) + 1;   // every device is signed out
    await u.save();
    moderation.kick(u._id.toString(), "kicked:admin");
    audit(req, "password", u, "password reset, signed out everywhere");
    return `New password set for ${u.username}. They were signed out everywhere.`;
  },
  async logout(req, res) {
    const u = await target(req, res); if (!u) return;
    u.tokenVersion = (u.tokenVersion || 0) + 1;
    await u.save();
    moderation.kick(u._id.toString(), "kicked:admin");
    audit(req, "logout", u, "signed out everywhere");
    return `${u.username} was signed out on every device.`;
  },
  async rename(req, res) {
    const u = await target(req, res); if (!u) return;
    const name = clean(req.body.username, 32);
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return fail(res, 400, "Usernames are 3–16 letters, numbers or _.");
    if (!checkName(name).ok) return fail(res, 400, "That username isn't allowed.");
    if (await User.exists({ usernameLower: name.toLowerCase(), _id: { $ne: u._id } })) return fail(res, 409, "That username is taken.");
    const old = u.username;
    u.username = name; u.usernameLower = name.toLowerCase();
    await u.save();
    moderation.kick(u._id.toString(), "kicked:admin");
    audit(req, "rename", u, `${old} → ${name}`);
    return `${old} is now ${name}.`;
  },
  async give(req, res) {
    const u = await target(req, res, { allowSelf: true }); if (!u) return;
    const id = clean(req.body.item, 40), item = ITEMS.get(id);
    if (!item) return fail(res, 400, "Pick an item.");
    u.normalizeInventory();
    if (u.inventory.includes(id) && item.category !== "furniture") return fail(res, 409, `${u.username} already has ${item.name}.`);
    if (item.category === "furniture" && u.inventory.filter((x) => x.startsWith("furniture:")).length >= MAX_FURNITURE) return fail(res, 409, "Their furniture is full.");
    u.inventory = [...u.inventory, id];
    await u.save();
    moderation.refresh(u);
    audit(req, "give-item", u, `${item.name} (${id})`);
    return `Gave ${item.name} to ${u.username}.`;
  },
  async take(req, res) {
    const u = await target(req, res, { allowSelf: true }); if (!u) return;
    const id = clean(req.body.item, 40), item = ITEMS.get(id);
    u.normalizeInventory();
    const at = u.inventory.indexOf(id);
    if (!item || at < 0) return fail(res, 404, "They don't have that item.");
    const [slot, idx] = id.split(":");
    const inv = [...u.inventory]; inv.splice(at, 1);
    if (LOOK_SLOTS[slot] && u.look?.[slot] === Number(idx) && !inv.includes(id)) {
      if (LOOK_SLOTS[slot].optional) u.look[slot] = -1;
      else {
        const other = inv.find((x) => x.startsWith(slot + ":"));
        if (!other) return fail(res, 409, "They need at least one " + (slot === "color" ? "body colour." : "pair of eyes."));
        u.look[slot] = Number(other.split(":")[1]);
      }
      u.markModified("look");
    }
    u.inventory = inv;
    await u.save();
    moderation.refresh(u);
    audit(req, "take-item", u, `${item.name} (${id})`);
    return `Took ${item.name} from ${u.username}.`;
  },
  // the email check (code) is skipped: the account can log in right away
  async verify(req, res) {
    const u = await target(req, res, { allowAdmin: true }); if (!u) return;
    if (u.emailVerified === true) return fail(res, 409, `${u.username}'s email is already checked.`);
    u.emailVerified = true;
    u.verify = undefined;
    await u.save();
    audit(req, "verify-email", u, u.email);
    return `${u.username} can log in now (email marked as checked).`;
  },
  // admin role: the acting admin types their own password again
  async "make-admin"(req, res) {
    const u = await target(req, res); if (!u) return;
    if (!(await passwordOk(req))) return fail(res, 401, "Wrong password. The role wasn't changed.");
    if (u.isBanned()) return fail(res, 409, "Unban them first.");
    u.role = "admin";
    u.adminInvisible = true;
    await u.save();
    moderation.kick(u._id.toString(), "kicked:role");   // the game reloads with the admin tools
    audit(req, "make-admin", u);
    return `${u.username} is an admin now.`;
  },
  // moderator: a player chosen to help (kick, short bans, mutes, coins from a monthly budget; blue name and chat)
  async "make-mod"(req, res) {
    const u = await target(req, res); if (!u) return;
    if (u.role === "mod") return fail(res, 409, `${u.username} is already a moderator.`);
    if (u.isBanned()) return fail(res, 409, "Unban them first.");
    u.role = "mod";
    // dressed in the moderator set right away (shirt, pants, cap)
    const look = { ...(u.look?.toObject ? u.look.toObject() : u.look || {}) };
    for (const id of MOD_ITEMS) { const [slot, i] = id.split(":"); look[slot] = Number(i); }
    u.look = look; u.markModified("look");
    await u.save();
    moderation.kick(u._id.toString(), "kicked:role");
    audit(req, "make-mod", u);
    return `${u.username} is a moderator now.`;
  },
  async "remove-mod"(req, res) {
    const u = await target(req, res); if (!u) return;
    if (u.role !== "mod") return fail(res, 409, `${u.username} isn't a moderator.`);
    u.role = "player";
    // take off the moderator clothes (they only belong to moderators)
    const look = { ...(u.look?.toObject ? u.look.toObject() : u.look || {}) };
    for (const id of MOD_ITEMS) { const [slot, i] = id.split(":"); if (look[slot] === Number(i)) look[slot] = -1; }
    u.look = look; u.markModified("look");
    u.inventory = (u.inventory || []).filter((id) => !MOD_ITEMS.includes(id));
    await u.save();
    moderation.kick(u._id.toString(), "kicked:role");
    audit(req, "remove-mod", u);
    return `${u.username} is a regular player again.`;
  },
  async "remove-admin"(req, res) {
    const u = await target(req, res, { allowAdmin: true }); if (!u) return;
    if (u.role !== "admin") return fail(res, 409, `${u.username} isn't an admin.`);
    if (!(await passwordOk(req))) return fail(res, 401, "Wrong password. The role wasn't changed.");
    u.role = "player";
    await u.save();
    moderation.kick(u._id.toString(), "kicked:role");
    audit(req, "remove-admin", u);
    return `${u.username} is a regular player now.`;
  },
  async delete(req, res) {
    const u = await target(req, res); if (!u) return;
    if (req.body.confirm !== u.username) return fail(res, 400, `Type the username "${u.username}" to confirm.`);
    moderation.kick(u._id.toString(), "kicked:admin");
    await Promise.all([
      Message.deleteMany({ $or: [{ from: u._id }, { to: u._id }] }),
      ChatLog.deleteMany({ userId: u._id }),
      TradeLog.deleteMany({ $or: [{ "a.userId": u._id }, { "b.userId": u._id }] }),
      DuelLog.deleteMany({ "players.userId": u._id }),
      User.updateMany({}, { $pull: { friends: u._id, friendReqIn: u._id } }),
    ]);
    await User.deleteOne({ _id: u._id });
    audit(req, "delete-account", u, `deleted (${u.email})`);
    return `${u.username}'s account and data were deleted.`;
  },
};
router.post("/users/:id/:action", async (req, res, next) => {
  try {
    const fn = Object.hasOwn(ACTIONS, req.params.action) ? ACTIONS[req.params.action] : null;
    if (!fn) return fail(res, 404, "Unknown action.");
    const message = await fn(req, res);
    if (message && !res.headersSent) res.json({ ok: true, message });
  } catch (err) {
    next(err);
  }
});

/* ---------- invisible in the game (only other admins see you) ---------- */
router.post("/invisible", async (req, res, next) => {
  try {
    req.admin.adminInvisible = req.body.on === true;
    await req.admin.save();
    const windows = setInvisible(req.admin._id.toString(), req.admin.adminInvisible);
    audit(req, req.admin.adminInvisible ? "invisible on" : "invisible off", req.admin);
    res.json({ ok: true, invisible: req.admin.adminInvisible, windows });
  } catch (err) {
    next(err);
  }
});

/* ---------- announcements (shown on everyone's screen in the game) ---------- */
router.post("/announce", (req, res) => {
  const msg = moderation.announce(req.body.text, req.admin.username);
  if (!msg) return fail(res, 400, "Write a message first.");
  audit(req, "announce", null, msg);
  res.json({ ok: true, message: `Sent to ${onlinePlayers().length} player(s) online.` });
});
router.get("/announcements", async (req, res, next) => {
  try { res.json({ list: await AdminLog.find({ action: "announce" }).sort({ at: -1 }).limit(50).lean() }); } catch (err) { next(err); }
});

/* ---------- history ---------- */
const before = (req) => (num(req.query.before) ? { $lt: new Date(num(req.query.before)) } : null);
async function userIdFrom(req) {
  const name = clean(req.query.user, 32).toLowerCase();
  if (!name) return undefined;
  const u = await User.findOne({ usernameLower: name }).select("_id").lean();
  return u ? u._id : null;
}
router.get("/chat", async (req, res, next) => {
  try {
    const q = {}, b = before(req), uid = await userIdFrom(req);
    if (uid === null) return res.json({ list: [] });
    if (uid) q.userId = uid;
    if (b) q.at = b;
    if (req.query.blocked === "1") q.blocked = true;
    const room = clean(req.query.room, 40);
    if (room) q.room = room === "homes" ? { $regex: "^home:" } : room === "dm" ? { $regex: "^dm:" } : room;
    const text = clean(req.query.q, 60);
    if (text) q.text = { $regex: esc(text), $options: "i" };
    res.json({ list: await ChatLog.find(q).sort({ at: -1 }).limit(100).lean() });
  } catch (err) {
    next(err);
  }
});
router.get("/trades", async (req, res, next) => {
  try {
    const q = {}, b = before(req), uid = await userIdFrom(req);
    if (uid === null) return res.json({ list: [] });
    if (uid) q.$or = [{ "a.userId": uid }, { "b.userId": uid }];
    if (b) q.at = b;
    const list = await TradeLog.find(q).sort({ at: -1 }).limit(100).lean();
    const name = (id) => ITEMS.get(id)?.name || id;
    res.json({ list: list.map((t) => ({ ...t, a: { ...t.a, names: t.a.items.map(name) }, b: { ...t.b, names: t.b.items.map(name) } })) });
  } catch (err) {
    next(err);
  }
});
router.get("/duels", async (req, res, next) => {
  try {
    const q = {}, b = before(req), uid = await userIdFrom(req);
    if (uid === null) return res.json({ list: [] });
    if (uid) q["players.userId"] = uid;
    if (b) q.at = b;
    res.json({ list: await DuelLog.find(q).sort({ at: -1 }).limit(100).lean() });
  } catch (err) {
    next(err);
  }
});
router.get("/logs", async (req, res, next) => {
  try {
    const q = {}, b = before(req);
    if (b) q.at = b;
    const who = clean(req.query.user, 32);
    if (who) q.$or = [{ target: { $regex: "^" + esc(who) + "$", $options: "i" } }, { admin: { $regex: "^" + esc(who) + "$", $options: "i" } }];
    res.json({ list: await AdminLog.find(q).sort({ at: -1 }).limit(100).lean() });
  } catch (err) {
    next(err);
  }
});

/* ---------- every item in the game, and how many players own it ---------- */
router.get("/items", async (req, res, next) => {
  try {
    const rows = await User.aggregate([{ $unwind: "$inventory" }, { $group: { _id: "$inventory", copies: { $sum: 1 }, owners: { $addToSet: "$_id" } } }, { $project: { copies: 1, owners: { $size: "$owners" } } }]);
    const owned = new Map(rows.map((r) => [r._id, r]));
    res.json({ items: CATALOG.map((it) => ({ ...it, copies: owned.get(it.id)?.copies || 0, owners: owned.get(it.id)?.owners || 0 })) });
  } catch (err) {
    next(err);
  }
});

/* ---------- messages from the Contact page ---------- */
// Jumpi Store orders (real money) and totals
router.get("/orders", async (req, res, next) => {
  try {
    const status = ["pending", "paid", "failed", "cancelled", "duplicate", "refunded"].includes(req.query.status) ? req.query.status : null;
    const q = status ? { status } : {};
    const name = clean(req.query.q, 32).toLowerCase();
    if (name) q.username = new RegExp("^" + esc(name), "i");
    const [list, sums] = await Promise.all([
      Order.find(q).sort({ createdAt: -1 }).limit(200).lean(),
      Order.aggregate([{ $group: { _id: "$status", n: { $sum: 1 }, total: { $sum: "$amount" } } }]),
    ]);
    const since = new Date(Date.now() - 30 * 86400000);
    const month = await Order.aggregate([{ $match: { status: "paid", paidAt: { $gte: since } } }, { $group: { _id: null, n: { $sum: 1 }, total: { $sum: "$amount" } } }]);
    res.json({ list, sums, month: month[0] || { n: 0, total: 0 } });
  } catch (err) {
    next(err);
  }
});
router.get("/contact", async (req, res, next) => {
  try {
    const q = req.query.show === "all" ? {} : { handled: false };
    res.json({ list: await ContactMessage.find(q).sort({ createdAt: -1 }).limit(200).lean() });
  } catch (err) {
    next(err);
  }
});
// the answer letter: the email as the player will get it, with a spot for the admin's text (the panel puts a text box there)
router.get("/contact/:id/letter", async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, "Not found.");
    const m = await ContactMessage.findById(req.params.id).lean();
    if (!m) return fail(res, 404, "Not found.");
    res.json({ html: contactReplyEmail({ name: m.name, message: m.message, topic: m.topic, sentAt: m.createdAt, answer: ANSWER_SLOT, lang: m.lang }).html, slot: ANSWER_SLOT, lang: m.lang, email: m.email, emailOn: EMAIL_ON() });
  } catch (err) {
    next(err);
  }
});
router.post("/contact/:id/reply", async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, "Not found.");
    const text = String(req.body.text ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, 5000);
    if (text.length < 2) return fail(res, 400, "Write your answer first.");
    if (!EMAIL_ON()) return fail(res, 503, "Email isn't set up on the server (RESEND_API_KEY).");
    const m = await ContactMessage.findById(req.params.id);
    if (!m) return fail(res, 404, "Not found.");
    const sent = await sendMail({ to: m.email, ...contactReplyEmail({ name: m.name, message: m.message, topic: m.topic, sentAt: m.createdAt, answer: text, lang: m.lang }) });
    if (!sent.ok) return fail(res, 502, sent.error);
    m.replies.push({ text, admin: req.admin.username });
    m.handled = true;
    await m.save();
    audit(req, "contact-reply", null, `${m.email} · ${text.slice(0, 120)}`);
    res.json({ ok: true, message: `Answer sent to ${m.email}.` });
  } catch (err) {
    next(err);
  }
});
router.post("/contact/:id", async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, "Not found.");
    const m = await ContactMessage.findByIdAndUpdate(req.params.id, { handled: req.body.handled === true }, { new: true });
    if (!m) return fail(res, 404, "Not found.");
    audit(req, m.handled ? "contact-done" : "contact-reopen", null, `${m.email} · ${m.topic}`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ---------- gift codes (players type them on the sign in the game's start screen, routes/codes.js) ---------- */
const codeRow = (c) => ({ id: c._id.toString(), code: c.code, coins: c.coins, maxUses: c.maxUses, uses: c.uses, expiresAt: c.expiresAt, active: c.active,
  ended: !!(c.expiresAt && c.expiresAt.getTime() < Date.now()) || (c.maxUses > 0 && c.uses >= c.maxUses), note: c.note, createdBy: c.createdBy, createdAt: c.createdAt });
router.get("/codes", async (req, res, next) => {
  try {
    res.json({ list: (await Code.find().sort({ createdAt: -1 }).limit(300)).map(codeRow), discord: discordOn() });
  } catch (err) {
    next(err);
  }
});
router.post("/codes", async (req, res, next) => {
  try {
    const c = await createCode({ ...req.body, by: req.admin.username });
    audit(req, "code-create", null, `${c.code} · ${c.coins} coins · ${c.maxUses || "no limit"} uses${c.expiresAt ? " · until " + c.expiresAt.toISOString().slice(0, 10) : ""}`);
    // "Post in Discord": Pip posts it in #updates
    const posted = req.body.discord === true && discordOn() ? await postGiftCode(c) : null;
    if (posted) audit(req, "code-discord", null, c.code);
    res.json({ ok: true, message: `Code ${c.code} is ready.${posted ? " Pip posted it in Discord." : posted === false ? " (Couldn't post it in Discord: check the server log.)" : ""}`, code: codeRow(c) });
  } catch (err) {
    if (err.publicMessage) return fail(res, 400, err.publicMessage);
    next(err);
  }
});
router.post("/codes/:id", async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, "Not found.");
    const c = await Code.findByIdAndUpdate(req.params.id, { active: req.body.active === true }, { new: true });
    if (!c) return fail(res, 404, "Not found.");
    audit(req, c.active ? "code-on" : "code-off", null, c.code);
    res.json({ ok: true, message: c.active ? `${c.code} works again.` : `${c.code} is switched off.` });
  } catch (err) {
    next(err);
  }
});
// post an existing code in #updates
router.post("/codes/:id/discord", async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, "Not found.");
    if (!discordOn()) return fail(res, 400, "Discord isn't on for this server (DISCORD_LIVE=1 in .env).");
    const c = await Code.findById(req.params.id);
    if (!c) return fail(res, 404, "Not found.");
    if (!(await postGiftCode(c))) return fail(res, 502, "Couldn't post it in Discord. Check the server log.");
    audit(req, "code-discord", null, c.code);
    res.json({ ok: true, message: `Pip posted ${c.code} in Discord.` });
  } catch (err) {
    next(err);
  }
});
router.get("/codes/:id/uses", async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, "Not found.");
    res.json({ list: await CodeUse.find({ codeId: req.params.id }).sort({ at: -1 }).limit(500).lean() });
  } catch (err) {
    next(err);
  }
});

export default router;
