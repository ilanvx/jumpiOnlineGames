import express from "express";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Message } from "../models/Message.js";
import { requireJson } from "./auth.js";
import { requireUser } from "./shop.js";
import { onlineWhere, onlinePlayers, emitToUser, strike, phoneBits } from "../realtime/plaza.js";
import { checkText, FRIENDLY_MESSAGE, splitPhone, PRIVATE_MESSAGE } from "../public/shared/profanity.js";
import { ChatLog, logQuietly } from "../models/Logs.js";

/*
  The in-game phone: friends, who is online, and JumpiChat (private messages).
  - Private messages only go between friends: both players agreed to it.
  - Muted players can't send messages, and sending is rate-limited.
*/
const router = express.Router();
const MAX_FRIENDS = 100;
const MAX_REQUESTS = 50;
const MAX_TEXT = 300;
const PAGE = 60;

const idStr = (id) => String(id);
const nameOf = (v) => String(v ?? "").trim().toLowerCase().slice(0, 32);
const fail = (res, code, error) => res.status(code).json({ error });
const isFriend = (user, otherId) => (user.friends || []).some((f) => idStr(f) === idStr(otherId));
const cleanText = (t) =>
  String(t ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT);
const msgView = (m, names) => ({ id: idStr(m._id), from: names.get(idStr(m.from)), to: names.get(idStr(m.to)), text: m.text, at: m.at.getTime(), read: !!m.read });

// small per-player rate limit: `max` calls per `ms`
function limit(max, ms) {
  const seen = new Map();
  return (key) => {
    const now = Date.now(), list = (seen.get(key) || []).filter((t) => now - t < ms);
    if (list.length >= max) return false;
    list.push(now);
    seen.set(key, list);
    return true;
  };
}
const canSend = limit(10, 10_000);
const canAsk = limit(10, 60_000);

/* ---------- friends ---------- */
router.get("/friends", requireUser, async (req, res, next) => {
  try {
    const me = req.user;
    const [friends, reqs] = await Promise.all([
      User.find({ _id: { $in: me.friends || [] } }).select("username look"),
      User.find({ _id: { $in: me.friendReqIn || [] } }).select("username look"),
    ]);
    res.json({
      friends: friends
        .map((u) => ({ username: u.username, look: u.publicLook(), where: onlineWhere(idStr(u._id), me.role === "admin") }))
        .sort((a, b) => (!!b.where - !!a.where) || a.username.localeCompare(b.username)),
      requests: reqs.map((u) => ({ username: u.username, look: u.publicLook() })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/friends/add", requireJson, requireUser, async (req, res, next) => {
  try {
    const me = req.user;
    if (!canAsk(idStr(me._id))) return fail(res, 429, "Slow down a little.");
    const other = await User.findOne({ usernameLower: nameOf(req.body.username) });
    if (!other) return fail(res, 404, "There's no player with that name.");
    if (other._id.equals(me._id)) return fail(res, 400, "You can't add yourself.");
    if (isFriend(me, other._id)) return fail(res, 409, `You and ${other.username} are already friends.`);
    if ((me.friends || []).length >= MAX_FRIENDS) return fail(res, 400, `You can have up to ${MAX_FRIENDS} friends.`);
    // they already asked me: that's a yes from both sides
    if ((me.friendReqIn || []).some((id) => id.equals(other._id))) return accept(res, me, other);
    if ((other.friendReqIn || []).some((id) => id.equals(me._id))) return fail(res, 409, `You already asked ${other.username}. Waiting for an answer!`);
    const r = await User.updateOne(
      { _id: other._id, friendReqIn: { $ne: me._id }, [`friendReqIn.${MAX_REQUESTS - 1}`]: { $exists: false } },
      { $push: { friendReqIn: me._id } }
    );
    if (!r.modifiedCount) return fail(res, 409, `${other.username} can't get more friend requests right now.`);
    emitToUser(idStr(other._id), "friends:request", { username: me.username });
    res.json({ ok: true, message: `Friend request sent to ${other.username}!` });
  } catch (err) {
    next(err);
  }
});

async function accept(res, me, other) {
  if ((other.friends || []).length >= MAX_FRIENDS) return fail(res, 400, `${other.username} already has the most friends.`);
  await Promise.all([
    User.updateOne({ _id: me._id }, { $addToSet: { friends: other._id }, $pull: { friendReqIn: other._id } }),
    User.updateOne({ _id: other._id }, { $addToSet: { friends: me._id }, $pull: { friendReqIn: me._id } }),
  ]);
  emitToUser(idStr(other._id), "friends:accepted", { username: me.username });
  emitToUser(idStr(me._id), "friends:changed", {});
  res.json({ ok: true, message: `You and ${other.username} are friends now!` });
}

router.post("/friends/respond", requireJson, requireUser, async (req, res, next) => {
  try {
    const me = req.user, other = await User.findOne({ usernameLower: nameOf(req.body.username) });
    if (!other || !(me.friendReqIn || []).some((id) => id.equals(other._id))) return fail(res, 404, "That request isn't there any more.");
    if (req.body.accept === true) return accept(res, me, other);
    await User.updateOne({ _id: me._id }, { $pull: { friendReqIn: other._id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/friends/remove", requireJson, requireUser, async (req, res, next) => {
  try {
    const me = req.user, other = await User.findOne({ usernameLower: nameOf(req.body.username) });
    if (!other) return fail(res, 404, "There's no player with that name.");
    await Promise.all([
      User.updateOne({ _id: me._id }, { $pull: { friends: other._id } }),
      User.updateOne({ _id: other._id }, { $pull: { friends: me._id } }),
    ]);
    emitToUser(idStr(other._id), "friends:changed", {});
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ---------- who is online ---------- */
router.get("/online", requireUser, (req, res) => {
  const me = req.user, mine = new Set((me.friends || []).map(idStr)), asked = new Set((me.friendReqIn || []).map(idStr));
  const list = onlinePlayers(me.role === "admin", idStr(me._id))
    .slice(0, 300)
    .map((p) => ({ username: p.username, look: p.look, role: p.role, where: p.where, me: p.userId === idStr(me._id), friend: mine.has(p.userId), askedMe: asked.has(p.userId) }))
    .sort((a, b) => b.me - a.me || b.friend - a.friend || a.username.localeCompare(b.username));
  res.json({ players: list });
});

/* ---------- JumpiChat ---------- */
// all my chats: one per friend, with the last message and how many I haven't read
router.get("/dm", requireUser, async (req, res, next) => {
  try {
    const me = req.user._id;
    const rows = await Message.aggregate([
      { $match: { $or: [{ from: me }, { to: me }] } },
      { $sort: { at: -1 } },
      { $group: { _id: { $cond: [{ $eq: ["$from", me] }, "$to", "$from"] }, last: { $first: "$$ROOT" }, unread: { $sum: { $cond: [{ $and: [{ $eq: ["$to", me] }, { $eq: ["$read", false] }] }, 1, 0] } } } },
      { $sort: { "last.at": -1 } },
      { $limit: 100 },
    ]);
    const friendIds = new Set((req.user.friends || []).map(idStr));
    const users = await User.find({ _id: { $in: [...new Set([...rows.map((r) => r._id), ...(req.user.friends || [])].map(idStr))] } }).select("username look");
    const byId = new Map(users.map((u) => [idStr(u._id), u]));
    const names = new Map([[idStr(me), req.user.username], ...users.map((u) => [idStr(u._id), u.username])]);
    const chats = rows
      .filter((r) => byId.has(idStr(r._id)))
      .map((r) => {
        const u = byId.get(idStr(r._id));
        return { username: u.username, look: u.publicLook(), friend: friendIds.has(idStr(u._id)), where: onlineWhere(idStr(u._id), req.user.role === "admin"), unread: r.unread, last: msgView(r.last, names) };
      });
    // friends you haven't talked to yet, so a new chat is one tap away
    const talked = new Set(rows.map((r) => idStr(r._id)));
    const fresh = [...friendIds].filter((id) => !talked.has(id) && byId.has(id)).map((id) => {
      const u = byId.get(id);
      return { username: u.username, look: u.publicLook(), friend: true, where: onlineWhere(id, req.user.role === "admin"), unread: 0, last: null };
    });
    res.json({ chats: [...chats, ...fresh], unread: chats.reduce((n, c) => n + c.unread, 0) });
  } catch (err) {
    next(err);
  }
});

// the messages with one player (newest PAGE, or older ones with ?before=<ms>); opening a chat marks it read
router.get("/dm/with/:username", requireUser, async (req, res, next) => {
  try {
    const me = req.user, other = await User.findOne({ usernameLower: nameOf(req.params.username) }).select("username look");
    if (!other) return fail(res, 404, "There's no player with that name.");
    const before = Number(req.query.before);
    const q = { $or: [{ from: me._id, to: other._id }, { from: other._id, to: me._id }] };
    if (Number.isFinite(before)) q.at = { $lt: new Date(before) };
    const list = await Message.find(q).sort({ at: -1 }).limit(PAGE);
    const names = new Map([[idStr(me._id), me.username], [idStr(other._id), other.username]]);
    const r = await Message.updateMany({ from: other._id, to: me._id, read: false }, { $set: { read: true } });
    if (r.modifiedCount) emitToUser(idStr(other._id), "dm:read", { by: me.username });
    res.json({
      with: { username: other.username, look: other.publicLook(), friend: isFriend(me, other._id), where: onlineWhere(idStr(other._id), me.role === "admin") },
      messages: list.reverse().map((m) => msgView(m, names)),
      more: list.length === PAGE,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/dm", requireJson, requireUser, async (req, res, next) => {
  try {
    const me = req.user;
    if (me.mutedUntil && me.mutedUntil.getTime() > Date.now()) return fail(res, 403, "You're muted right now, so you can't send messages.");
    if (!canSend(idStr(me._id))) return fail(res, 429, "Slow down a little!");
    const text = cleanText(req.body.text);
    if (!text) return fail(res, 400, "Write a message first.");
    const chk = checkText(text), sp = splitPhone(phoneBits(me._id), text);
    if (chk.kind === "private" || sp.hit) {
      phoneBits(me._id, "");
      logQuietly(ChatLog, { userId: me._id, username: me.username, room: "dm:" + nameOf(req.body.to), text, blocked: true });
      return res.status(400).json({ error: PRIVATE_MESSAGE[chk.info || "phone"], private: chk.info || "phone", blocked: true });
    }
    phoneBits(me._id, sp.digits);
    if (!chk.ok) {
      logQuietly(ChatLog, { userId: me._id, username: me.username, room: "dm:" + nameOf(req.body.to), text, blocked: true });
      const st = await strike(idStr(me._id));
      return res.status(400).json({ error: st.muted ? "You used bad words too many times, so you're muted for 5 minutes." : FRIENDLY_MESSAGE, blocked: true });
    }
    const other = await User.findOne({ usernameLower: nameOf(req.body.to) }).select("username friends");
    if (!other) return fail(res, 404, "There's no player with that name.");
    // both sides must still be friends
    if (!isFriend(me, other._id) || !isFriend(other, me._id)) return fail(res, 403, `You can only chat with friends. Add ${other.username} as a friend first!`);
    const m = await Message.create({ from: me._id, to: other._id, text });
    const view = msgView(m, new Map([[idStr(me._id), me.username], [idStr(other._id), other.username]]));
    emitToUser(idStr(other._id), "dm", view);
    emitToUser(idStr(me._id), "dm", view); // my other windows
    res.json({ message: view });
  } catch (err) {
    next(err);
  }
});

router.post("/dm/read", requireJson, requireUser, async (req, res, next) => {
  try {
    const other = await User.findOne({ usernameLower: nameOf(req.body.username) }).select("_id");
    if (!other) return res.json({ ok: true });
    const r = await Message.updateMany({ from: other._id, to: req.user._id, read: false }, { $set: { read: true } });
    if (r.modifiedCount) emitToUser(idStr(other._id), "dm:read", { by: req.user.username });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
export const _test = { cleanText, mongooseReady: () => mongoose.connection.readyState };
