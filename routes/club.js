import express from "express";
import { User } from "../models/User.js";
import { Portrait } from "../models/Portrait.js";
import { requireUser } from "./shop.js";
import { onlinePlayers } from "../realtime/plaza.js";
import { levelProgress } from "../public/shared/levels.js";

/*
  Jumpi Club (club.jumpigames.com, public/club/): what the Club page needs on top of the game's own routes
  (friends, JumpiChat, block and report are the same routes as the in-game phone: routes/social.js).
  - GET  /api/club/me        my coins, level and XP (and "I'm on the Club page now")
  - GET  /api/club/online    everyone online: in the game, or on the Club page
  - POST /api/club/portrait  my game window sends a picture of my Jumpi (image/png, small)
  - GET  /api/club/portrait  my own picture (only mine: never someone else's)
*/
const router = express.Router();
const S = (v) => String(v);

// who has the Club page open (it asks /api/club/me every few seconds); gone after 45 seconds without a call
const HERE_MS = 45_000;
const here = new Map();   // userId -> { t, username, look, role, blocked:Set }
const mark = (u) => here.set(S(u._id), { t: Date.now(), username: u.username, look: u.publicLook(), role: u.role, blocked: new Set((u.blocked || []).map(S)) });
setInterval(() => { const old = Date.now() - HERE_MS; for (const [k, v] of here) if (v.t < old) here.delete(k); }, 30_000).unref?.();

router.get("/club/me", requireUser, (req, res) => {
  const u = req.user;
  mark(u);
  const p = levelProgress(u.levelXp || 0);
  res.set("Cache-Control", "no-store");
  res.json({ username: u.username, coins: u.coins || 0, levelXp: u.levelXp || 0, level: p.level, into: p.into, need: p.need, pct: p.pct,
    member: typeof u.isMember === "function" ? !!u.isMember() : false, role: u.role, look: u.publicLook(), chatLock: u.parental?.chatLock === true });
});

router.get("/club/online", requireUser, async (req, res, next) => {
  try {
    const me = req.user, myId = S(me._id), admin = me.role === "admin";
    mark(me);
    const mine = new Set((me.friends || []).map(S)), askedMe = new Set((me.friendReqIn || []).map(S)), iBlocked = new Set((me.blocked || []).map(S));
    const all = new Map();
    for (const p of onlinePlayers(admin, myId)) all.set(p.userId, { id: p.userId, username: p.username, look: p.look, role: p.role, at: "game" });
    for (const [id, v] of here) if (!all.has(id) && (admin || !v.blocked.has(myId))) all.set(id, { id, username: v.username, look: v.look, role: v.role, at: "club" });
    for (const id of iBlocked) all.delete(id);
    const ids = [...all.keys()].filter((id) => id !== myId).slice(0, 400);
    // the ones who blocked me don't see me and I don't see them; the ones I already asked show "sent"
    const [blockedMe, iAsked] = ids.length ? await Promise.all([
      admin ? [] : User.find({ _id: { $in: ids }, blocked: me._id }).select("_id").lean(),
      User.find({ _id: { $in: ids }, friendReqIn: me._id }).select("_id").lean(),
    ]) : [[], []];
    for (const b of blockedMe) all.delete(S(b._id));
    const sent = new Set(iAsked.map((x) => S(x._id)));
    const list = [...all.values()].slice(0, 400).map((p) => ({ username: p.username, look: p.look, role: p.role, at: p.at, me: p.id === myId,
      friend: mine.has(p.id), askedMe: askedMe.has(p.id), sent: sent.has(p.id) }))
      .sort((a, b) => b.me - a.me || b.friend - a.friend || a.username.localeCompare(b.username));
    res.set("Cache-Control", "no-store");
    res.json({ players: list, count: list.length });
  } catch (err) { next(err); }
});

// the picture of my Jumpi: a real PNG, small, square-ish (the game makes it 192 x 192)
const tooFast = new Map();
router.post("/club/portrait", express.raw({ type: "image/png", limit: "90kb" }), requireUser, async (req, res, next) => {
  try {
    const b = req.body;
    if (!Buffer.isBuffer(b) || b.length < 100) return res.status(400).json({ error: "No picture." });
    const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (!b.subarray(0, 8).equals(PNG) || b.subarray(12, 16).toString("latin1") !== "IHDR") return res.status(400).json({ error: "Not a PNG." });
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
    if (w < 32 || h < 32 || w > 256 || h > 256) return res.status(400).json({ error: "Wrong size." });
    const id = S(req.user._id), last = tooFast.get(id) || 0;
    if (Date.now() - last < 3000) return res.status(429).json({ error: "Too fast." });
    tooFast.set(id, Date.now());
    await Portrait.updateOne({ user: req.user._id }, { $set: { png: b, at: new Date() } }, { upsert: true });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
router.get("/club/portrait", requireUser, async (req, res, next) => {
  try {
    const p = await Portrait.findOne({ user: req.user._id }).lean();
    res.set("Cache-Control", "private, no-store");
    if (!p) return res.status(404).json({ error: "No picture yet." });
    res.type("png").send(Buffer.from(p.png.buffer || p.png));
  } catch (err) { next(err); }
});

export default router;
