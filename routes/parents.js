import express from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Message } from "../models/Message.js";
import { ChatLog, TradeLog, logQuietly, AdminLog } from "../models/Logs.js";
import { requireJson, readToken, revokeToken } from "./auth.js";
import { isHttps } from "./ip.js";
import { EMAIL_ON, sendMail } from "../mail/send.js";
import { parentCodeEmail } from "../mail/parentCode.js";
import { ITEMS } from "../catalog.js";
import { cleanParental, quietNow, israelDayStart } from "../public/shared/parental.js";
import { PlaySession } from "../models/PlaySession.js";
import { isPlaying } from "../realtime/playtime.js";
import { levelOf, MAX_LEVEL } from "../public/shared/levels.js";

/*
  Parental controls: the /parents page (public/site/parents.html). A parent types the email of the child's Jumpi
  account, gets a 6-digit code by email, and with it sees the account: what the child wrote in the chat, their trades,
  and sets quiet hours (no game) and the chat lock (only ready-made messages, no JumpiChat).
  The login lives in its own cookie (jumpi_parent, only for /api/parents, 2 hours). Nothing here says whether an
  email has an account (the answer is the same either way).
*/
const router = express.Router();
const COOKIE = "jumpi_parent";
const SESSION_MS = 2 * 3600_000;
const CODE_MIN = 15, SEND_GAP = 55_000, SENDS_PER_HOUR = 5, MAX_TRIES = 5;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const fail = (res, code, error, extra) => res.status(code).json({ error, ...extra });
const codeHash = (user, code) => crypto.createHmac("sha256", process.env.JWT_SECRET).update(String(user._id) + ":parent:" + code).digest("hex");

// IPv6: one home has a whole /64 block, so count by the block
function ipKey(ip) {
  const a = String(ip);
  if (!a.includes(":")) return a;
  const [head, tail = ""] = a.split("::"), h = head ? head.split(":") : [], t = tail ? tail.split(":") : [];
  const full = a.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
  return full.slice(0, 4).map((x) => (parseInt(x, 16) || 0).toString(16)).join(":") + "::/64";
}
function limiter(max, ms) {
  const hits = new Map();
  return (key) => {
    const now = Date.now(), e = hits.get(key);
    if (hits.size > 20000) for (const [k, x] of hits) if (x.reset < now) hits.delete(k);
    if (!e || e.reset < now) { hits.set(key, { n: 1, reset: now + ms }); return true; }
    return ++e.n <= max;
  };
}
const canAsk = limiter(8, 15 * 60_000), canAskEmail = limiter(4, 60 * 60_000), canTry = limiter(30, 15 * 60_000), canRead = limiter(120, 60_000), canSet = limiter(30, 60_000);

const cookieOpts = (res) => ({ httpOnly: true, sameSite: "strict", secure: isHttps(res.req), path: "/api/parents" });

// 1. send the code. The answer is the same, and comes at once, whether the email has an account or not (the work
//    happens after the answer). A code that still works isn't replaced (so nobody can spoil a parent's code), and
//    one account gets at most SENDS_PER_DAY codes a day.
const SENDS_PER_DAY = 8;
router.post("/code", requireJson, (req, res) => {
  if (!EMAIL_ON()) return fail(res, 503, "Email isn't switched on yet.", { code: "off" });
  const email = String(req.body.email || "").trim().toLowerCase().slice(0, 255);
  if (email.length > 254 || !EMAIL_RE.test(email)) return fail(res, 400, "Type the email of the Jumpi account.", { code: "email" });
  if (!canAsk(ipKey(req.ip)) || !canAskEmail(email + "|" + ipKey(req.ip))) return fail(res, 429, "Too many codes. Please wait a while and try again.", { code: "busy" });
  res.json({ ok: true, wait: Math.ceil(SEND_GAP / 1000) });
  (async () => {
    const user = await User.findOne({ email });
    if (!user) return;
    const now = Date.now(), old = user.parentCode || {};
    const sends = (old.sends || []).filter((t) => now - t < 86400_000);
    if (old.hash && now < old.expires && (old.tries || 0) < MAX_TRIES) return;   // the last code still works (15 minutes): it stays the one
    if ((old.sentAt && now - old.sentAt < SEND_GAP) || sends.filter((t) => now - t < 3600_000).length >= SENDS_PER_HOUR || sends.length >= SENDS_PER_DAY) return;
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    await User.updateOne({ _id: user._id }, { $set: { parentCode: { hash: codeHash(user, code), expires: now + CODE_MIN * 60_000, tries: 0, sentAt: now, sends: [...sends, now] } } });
    const sent = await sendMail({ to: user.email, ...parentCodeEmail({ username: user.username, code, minutes: CODE_MIN }) });
    if (!sent.ok) console.error("[parents] the code email didn't go out:", sent.error);
  })().catch((err) => console.error("[parents] code", err.message));
});

// 2. the code → the parents' login (every try is counted in one step, so many tries at once are all counted)
router.post("/verify", requireJson, async (req, res, next) => {
  try {
    if (!canTry(ipKey(req.ip))) return fail(res, 429, "Too many tries. Please wait a few minutes.", { code: "busy" });
    const email = String(req.body.email || "").trim().toLowerCase().slice(0, 255);
    const code = String(req.body.code || "").replace(/\D/g, "");
    const bad = () => fail(res, 400, "That code isn't right, or it ran out. Ask for a new one.", { code: "bad" });
    if (!EMAIL_RE.test(email) || code.length !== 6) return bad();
    const user = await User.findOne({ email });
    const P = user && user.parentCode;
    if (!P || !P.hash || Date.now() > P.expires) return bad();
    const counted = await User.findOneAndUpdate({ _id: user._id, "parentCode.hash": P.hash, "parentCode.tries": { $not: { $gte: MAX_TRIES } } }, { $inc: { "parentCode.tries": 1 } }, { new: true }).select("parentCode");
    if (!counted) return bad();
    if (!crypto.timingSafeEqual(Buffer.from(codeHash(user, code)), Buffer.from(P.hash))) return bad();
    await User.updateOne({ _id: user._id }, { $unset: { parentCode: 1 } });
    const token = jwt.sign({ sub: String(user._id), v: user.tokenVersion || 0, typ: "parent" }, process.env.JWT_SECRET, { expiresIn: SESSION_MS / 1000, jwtid: crypto.randomUUID() });
    res.cookie(COOKIE, token, { ...cookieOpts(res), maxAge: SESSION_MS });
    logQuietly(AdminLog, { adminId: user._id, admin: "parent", action: "parent-login", targetId: user._id, target: user.username, details: "parents' page", via: "parents", ip: req.ip || "" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// the parents' login (a new password on the account ends it too)
async function requireParent(req, res, next) {
  try {
    const p = readToken(req.cookies?.[COOKIE], "parent");
    if (!p) return fail(res, 401, "Please log in again.", { code: "login" });
    const user = await User.findById(p.sub);
    if (!user || (p.v || 0) !== (user.tokenVersion || 0)) return fail(res, 401, "Please log in again.", { code: "login" });
    if (!canRead(String(user._id))) return fail(res, 429, "Slow down a little.", { code: "busy" });
    req.child = user;
    next();
  } catch (err) {
    next(err);
  }
}

const settingsOf = (u) => ({ chatLock: u.parental?.chatLock === true, quiet: Array.isArray(u.parental?.quiet) ? u.parental.quiet : [] });
router.get("/me", requireParent, async (req, res, next) => {
  try {
  const u = req.child;
  const { onlineWhere } = await import("../realtime/plaza.js");
  res.set("Cache-Control", "no-store");
  res.json({
    username: u.username, look: u.publicLook(), coins: u.coins || 0, level: u.role === "admin" ? MAX_LEVEL : levelOf(u.levelXp || 0),
    createdAt: u.createdAt, lastLoginAt: u.lastLoginAt || null, member: u.isMember(), banned: u.isBanned(),
    online: !!onlineWhere(String(u._id)), friends: (u.friends || []).length, pets: (u.pets || []).length,
    settings: settingsOf(u), quietNow: !!quietNow(u.parental), todayMin: await playedToday(u._id),
  });
  } catch (err) {
    next(err);
  }
});

// play time: a session's minutes inside [from, to) (a session that is still on counts until now)
const sessionEnd = (s, playing, now) => (s.end ? s.end.getTime() : playing ? now : s.last.getTime());
const minutesIn = (s, playing, now, from, to) => Math.max(0, Math.min(sessionEnd(s, playing, now), to) - Math.max(s.start.getTime(), from)) / 60000;
async function playedToday(userId) {
  const now = Date.now(), from = israelDayStart(new Date(now)).getTime(), playing = isPlaying(userId);
  const list = await PlaySession.find({ userId, $or: [{ last: { $gte: new Date(from) } }, { end: null }] }).lean();
  return Math.round(list.reduce((sum, s) => sum + minutesIn(s, playing && !s.end, now, from, now), 0));
}

// what the child wrote: public chat (the last 30 days) and the private messages they sent, newest first
router.get("/chat", requireParent, async (req, res, next) => {
  try {
    const u = req.child, before = Number(req.query.before), q = Number.isFinite(before) ? { $lt: new Date(before) } : { $lte: new Date() };
    const [pub, dms] = await Promise.all([
      ChatLog.find({ userId: u._id, at: q }).sort({ at: -1 }).limit(60).lean(),   // ("dm:" rows here are private messages the filter stopped)
      Message.find({ from: u._id, at: q }).sort({ at: -1 }).limit(60).lean(),
    ]);
    const names = new Map((await User.find({ _id: { $in: [...new Set(dms.map((m) => String(m.to)))] } }).select("username").lean()).map((x) => [String(x._id), x.username]));
    const place = (room) => (room === "plaza" ? "Plaza" : room.startsWith("home:") ? `${room.slice(5)}'s home` : room.startsWith("place:") ? room.slice(6) : room.startsWith("work:") ? "at work" : room);
    const list = [
      ...pub.map((c) => (String(c.room || "").startsWith("dm:") ? { at: c.at, kind: "dm", where: c.room.slice(3), text: c.text, blocked: !!c.blocked } : { at: c.at, kind: "chat", where: place(c.room || "plaza"), text: c.text, blocked: !!c.blocked })),
      ...dms.map((m) => ({ at: m.at, kind: "dm", where: names.get(String(m.to)) || "(deleted player)", text: m.text, blocked: false })),
    ].sort((a, b) => b.at - a.at).slice(0, 60);
    res.set("Cache-Control", "no-store");
    res.json({ list: list.map((x) => ({ ...x, at: new Date(x.at).getTime() })), more: list.length === 60 });
  } catch (err) {
    next(err);
  }
});

// when the child played: minutes per day for the last 7 days (Israel time), and the sessions, newest first
router.get("/playtime", requireParent, async (req, res, next) => {
  try {
    const id = req.child._id, now = Date.now(), playing = isPlaying(id);
    const days = [];
    let dayEnd = now;
    for (let i = 0; i < 7; i++) {
      const s = israelDayStart(new Date(dayEnd - 1)).getTime();
      days.push({ at: s, to: dayEnd, min: 0 });
      dayEnd = s;
    }
    const weekFrom = days[6].at;
    const week = await PlaySession.find({ userId: id, $or: [{ last: { $gte: new Date(weekFrom) } }, { end: null }] }).lean();
    for (const s of week) for (const d of days) d.min += minutesIn(s, playing && !s.end, now, d.at, d.to);
    const before = Number(req.query.before);
    const list = await PlaySession.find({ userId: id, start: Number.isFinite(before) ? { $lt: new Date(before) } : { $lte: new Date(now) } }).sort({ start: -1 }).limit(40).lean();
    res.set("Cache-Control", "no-store");
    res.json({
      days: days.reverse().map((d) => ({ at: d.at, min: Math.round(d.min) })),
      list: list.map((s) => {
        const on = playing && !s.end, end = sessionEnd(s, on, now);
        return { start: s.start.getTime(), end: on ? null : end, min: Math.round((end - s.start.getTime()) / 60000), device: s.device || "computer" };
      }),
      more: list.length === 40,
    });
  } catch (err) {
    next(err);
  }
});

// JumpiChat: everyone the child wrote to or got messages from, newest conversation first
router.get("/dms", requireParent, async (req, res, next) => {
  try {
    const id = req.child._id;
    const rows = await Message.aggregate([
      { $match: { $or: [{ from: id }, { to: id }] } },
      { $sort: { at: -1 } },
      { $group: {
        _id: { $cond: [{ $eq: ["$from", id] }, "$to", "$from"] },
        at: { $first: "$at" }, text: { $first: "$text" }, mine: { $first: { $eq: ["$from", id] } },
        sent: { $sum: { $cond: [{ $eq: ["$from", id] }, 1, 0] } }, got: { $sum: { $cond: [{ $eq: ["$from", id] }, 0, 1] } },
      } },
      { $sort: { at: -1 } },
      { $limit: 100 },
    ]);
    const users = new Map((await User.find({ _id: { $in: rows.map((r) => r._id) } }).select("username").lean()).map((x) => [String(x._id), x.username]));
    const friends = new Set((req.child.friends || []).map(String));
    res.set("Cache-Control", "no-store");
    res.json({ list: rows.map((r) => ({ id: String(r._id), name: users.get(String(r._id)) || "(deleted player)", friend: friends.has(String(r._id)), at: new Date(r.at).getTime(), last: r.text, mine: !!r.mine, sent: r.sent, got: r.got })) });
  } catch (err) {
    next(err);
  }
});

// one JumpiChat conversation, both sides, newest first (60 at a time); messages the filter stopped are in it too
router.get("/dm/:with", requireParent, async (req, res, next) => {
  try {
    const me = req.child._id, w = String(req.params.with || "");
    if (!mongoose.isValidObjectId(w)) return res.status(400).json({ error: "Bad request." });
    const other = new mongoose.Types.ObjectId(w);
    const before = Number(req.query.before), at = Number.isFinite(before) ? { $lt: new Date(before) } : { $lte: new Date() };
    const otherUser = await User.findById(other).select("username").lean();
    const [msgs, stopped] = await Promise.all([
      Message.find({ $or: [{ from: me, to: other }, { from: other, to: me }], at }).sort({ at: -1 }).limit(60).lean(),
      otherUser ? ChatLog.find({ userId: me, room: "dm:" + otherUser.username, blocked: true, at }).sort({ at: -1 }).limit(60).lean() : [],
    ]);
    const list = [
      ...msgs.map((m) => ({ at: m.at, mine: String(m.from) === String(me), text: m.text, blocked: false })),
      ...stopped.map((c) => ({ at: c.at, mine: true, text: c.text, blocked: true })),
    ].sort((a, b) => b.at - a.at).slice(0, 60);
    res.set("Cache-Control", "no-store");
    res.json({ name: otherUser?.username || "(deleted player)", list: list.map((x) => ({ ...x, at: new Date(x.at).getTime() })), more: msgs.length === 60 });
  } catch (err) {
    next(err);
  }
});

// the child's trades: who with, what they gave and what they got
router.get("/trades", requireParent, async (req, res, next) => {
  try {
    const id = req.child._id;
    const rows = await TradeLog.find({ $or: [{ "a.userId": id }, { "b.userId": id }] }).sort({ at: -1 }).limit(60).lean();
    const name = (itemId) => ITEMS.get(itemId)?.name || itemId;
    res.set("Cache-Control", "no-store");
    res.json({
      list: rows.map((t) => {
        const mine = String(t.a?.userId) === String(id) ? t.a : t.b, theirs = mine === t.a ? t.b : t.a;
        return { at: new Date(t.at).getTime(), with: theirs?.username || "?", gave: (mine?.items || []).map(name), got: (theirs?.items || []).map(name) };
      }),
    });
  } catch (err) {
    next(err);
  }
});

// quiet hours + chat lock; the game follows right away
router.post("/settings", requireJson, requireParent, async (req, res, next) => {
  try {
    if (!canSet(String(req.child._id))) return fail(res, 429, "Slow down a little.", { code: "busy" });
    const clean = cleanParental(req.body);
    if (!clean) return fail(res, 400, "Some of the times aren't right. Check the days and hours.", { code: "times" });
    await User.updateOne({ _id: req.child._id }, { $set: { parental: { ...clean, updatedAt: new Date() } } });
    logQuietly(AdminLog, { adminId: req.child._id, admin: "parent", action: "parent-settings", targetId: req.child._id, target: req.child.username, details: `chat ${clean.chatLock ? "locked" : "open"} · ${clean.quiet.length} quiet rule(s)`, via: "parents", ip: req.ip || "" });
    const { parentalChanged } = await import("../realtime/plaza.js");
    parentalChanged(String(req.child._id), clean);
    res.json({ ok: true, settings: clean, quietNow: !!quietNow(clean) });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", requireJson, async (req, res, next) => {
  try {
    await revokeToken(req.cookies?.[COOKIE], "parent");
    res.clearCookie(COOKIE, cookieOpts(res));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
export const _test = { ipKey, mongooseReady: () => mongoose.connection.readyState };
