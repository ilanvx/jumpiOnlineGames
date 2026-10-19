import express from "express";
import { User } from "../models/User.js";
import { portraitFor, lookKey } from "./portraits.js";
import { requireUser } from "./shop.js";
import { onlinePlayers } from "../realtime/plaza.js";
import { levelProgress } from "../public/shared/levels.js";

/*
  Jumpi Club (club.jumpigames.com, public/club/): what the Club page needs on top of the game's own routes
  (friends, JumpiChat, block and report are the same routes as the in-game phone: routes/social.js).
  - GET  /api/club/me        my coins, level and XP (and "I'm on the Club page now")
  - GET  /api/club/online    everyone online: in the game, or on the Club page
  - GET  /api/club/pic/:username   a picture of that Jumpi in the clothes they wear now (made by the server: routes/portraits.js)
*/
const router = express.Router();
const S = (v) => String(v);

/* Jumpi Club is for ages 13 and up (the birthday from sign-up). The Jumpi team can always come in.
   Accounts made before we asked for the birthday: the game asks once, then the Club knows. */
export const CLUB_AGE = 13;
function ageYears(bd, now = new Date()) {
  if (!bd) return NaN;
  const d = new Date(bd); let a = now.getUTCFullYear() - d.getUTCFullYear();
  if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) a--;
  return a;
}
function clubAge(req, res, next) {
  const u = req.user;
  if (u.role === "admin" || u.role === "mod") return next();
  if (!u.birthDate) return res.status(403).json({ code: "birthday", error: "Open the Jumpi game once: it will ask for your birthday, then you can come into Jumpi Club." });
  if (ageYears(u.birthDate) < CLUB_AGE) return res.status(403).json({ code: "age", error: `Jumpi Club is for ages ${CLUB_AGE} and up.` });
  next();
}

// who has the Club page open (it asks /api/club/me every few seconds); gone after 45 seconds without a call
const HERE_MS = 45_000;
const here = new Map();   // userId -> { t, username, look, role, blocked:Set }
const mark = (u) => here.set(S(u._id), { t: Date.now(), username: u.username, look: u.publicLook(), role: u.role, blocked: new Set((u.blocked || []).map(S)) });
setInterval(() => { const old = Date.now() - HERE_MS; for (const [k, v] of here) if (v.t < old) here.delete(k); }, 30_000).unref?.();

router.get("/club/me", requireUser, clubAge, (req, res) => {
  const u = req.user;
  mark(u);
  const p = levelProgress(u.levelXp || 0);
  res.set("Cache-Control", "no-store");
  res.json({ username: u.username, coins: u.coins || 0, levelXp: u.levelXp || 0, level: p.level, into: p.into, need: p.need, pct: p.pct,
    member: typeof u.isMember === "function" ? !!u.isMember() : false, role: u.role, look: u.publicLook(), pic: lookKey(u.publicLook()), chatLock: u.parental?.chatLock === true });
});

router.get("/club/online", requireUser, clubAge, async (req, res, next) => {
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
    const list = [...all.values()].slice(0, 400).map((p) => ({ username: p.username, look: p.look, pic: lookKey(p.look || {}), role: p.role, at: p.at, me: p.id === myId,
      friend: mine.has(p.id), askedMe: askedMe.has(p.id), sent: sent.has(p.id) }))
      .sort((a, b) => b.me - a.me || b.friend - a.friend || a.username.localeCompare(b.username));
    res.set("Cache-Control", "no-store");
    res.json({ players: list, count: list.length });
  } catch (err) { next(err); }
});

// a Jumpi in the clothes they wear now. Only real players (and not someone who blocked me, or I blocked); ?v= is the look's
// key from the list, so the browser can keep the picture until the clothes change
const canDraw = new Map();
router.get("/club/pic/:username", requireUser, clubAge, async (req, res, next) => {
  try {
    const me = req.user, name = String(req.params.username || "").trim().toLowerCase().slice(0, 32);
    const u = name === me.usernameLower ? me : await User.findOne({ usernameLower: name });
    if (!u || (u !== me && me.role !== "admin" && (u.blocked || []).some((b) => S(b) === S(me._id)) || (me.blocked || []).some((b) => S(b) === S(u._id))))
      return res.status(404).json({ error: "No picture." });
    const look = u.publicLook(), key = lookKey(look);
    // drawing a new picture takes a second: a few per player per minute (the ones already made are free)
    const id = S(me._id), now = Date.now(), list = (canDraw.get(id) || []).filter((t) => now - t < 60_000);
    const got = await portraitFor(look, () => { if (list.length >= 40) return false; list.push(now); canDraw.set(id, list); return true; });
    if (!got) return res.status(404).json({ error: "No picture." });
    res.set("Cache-Control", req.query.v === key ? "private, max-age=86400" : "private, max-age=120");
    res.type("png").send(got.png);
  } catch (err) { next(err); }
});

export default router;
