import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, LOOK_LIMITS } from "../models/User.js";
import { lookItems } from "../catalog.js";
import { checkName } from "../public/shared/profanity.js";
import crypto from "node:crypto";
import { EMAIL_ON, sendMail } from "../mail/send.js";
import { welcomeEmail } from "../mail/welcome.js";
import { resetEmail } from "../mail/reset.js";
import { PUBLIC_URL } from "../mail/send.js";

const router = express.Router();

const COOKIE = "jumpi_token";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;
// used when a username doesn't exist, so a failed login takes the same time either way
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

/* ---------- helpers ---------- */
export function banMessage(user) {
  const until = user.bannedUntil;
  const permanent = until && until.getFullYear() >= 9000;
  const when = permanent ? "permanently" : `until ${until.toUTCString()}`;
  return `This account is banned ${when}.${user.banReason ? " Reason: " + user.banReason : ""}`;
}
function clearAuthCookie(res) {
  res.clearCookie(COOKIE, { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production", httpOnly: true });
}
const clean = (v) => (typeof v === "string" ? v.trim() : "");

function validateAccount({ username, email, password }) {
  if (!USERNAME_RE.test(username)) return { field: "username", error: "Username must be 3–16 letters, numbers or _." };
  if (!checkName(username).ok) return { field: "username", error: "Please pick a friendlier username." };
  if (!EMAIL_RE.test(email) || email.length > 254) return { field: "email", error: "That email doesn't look right." };
  if (typeof password !== "string" || password.length < MIN_PASSWORD)
    return { field: "password", error: `Password needs at least ${MIN_PASSWORD} characters.` };
  if (password.length > MAX_PASSWORD) return { field: "password", error: "That password is too long." };
  return null;
}

function cleanLook(look) {
  const out = {};
  for (const [key, [min, max]] of Object.entries(LOOK_LIMITS)) {
    const v = Number(look?.[key]);
    out[key] = Number.isInteger(v) && v >= min && v <= max ? v : min === 0 ? 0 : -1;
  }
  return out;
}

function setAuthCookie(res, userId, remember, version = 0) {
  const token = jwt.sign({ sub: userId, v: version }, process.env.JWT_SECRET, { expiresIn: "30d" });
  res.cookie(COOKIE, token, {
    httpOnly: true, // page scripts can't read it
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: THIRTY_DAYS } : {}), // without maxAge it ends when the browser closes
  });
}

// Only accept JSON bodies: blocks plain HTML form posts from other sites
export function requireJson(req, res, next) {
  if (!req.is("application/json")) return res.status(415).json({ error: "Send JSON." });
  next();
}

// Small in-memory limiter: enough for one server on one computer
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    if (++entry.count > max) {
      res.set("Retry-After", Math.ceil((entry.reset - now) / 1000));
      return res.status(429).json({ error: "Too many attempts. Please wait a few minutes and try again." });
    }
    next();
  };
}
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 });
const checkLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

/* Tab tokens: one browser has one login cookie, but every game tab keeps its own account. The game gets a
   token for its tab on login / switch / me and sends it back (x-jumpi-tab, kept in the tab's sessionStorage);
   when it is there it decides who you are, so two tabs can play two accounts side by side. */
export const tabToken = (user) => jwt.sign({ sub: user._id.toString(), v: user.tokenVersion || 0, tab: 1 }, process.env.JWT_SECRET, { expiresIn: "30d" });
export async function currentUser(req) {
  const tab = req.get?.("x-jumpi-tab");
  const token = tab || req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    const { sub, v, tab: isTab } = jwt.verify(token, process.env.JWT_SECRET);
    if (tab && !isTab) return null;
    const user = await User.findById(sub);
    if (!user || (v || 0) !== (user.tokenVersion || 0)) return null;   // logged out everywhere by an admin
    return user;
  } catch {
    return null;
  }
}
export { setAuthCookie, clearAuthCookie, COOKIE as AUTH_COOKIE };

/* ---------- saved accounts: up to 3 players on one device (switch on the start screen without typing passwords) ----------
   A second httpOnly cookie holds a signed list of { s: user id, v: token version }. Page scripts can't read it.
   Changing the password / "log out everywhere" (tokenVersion) also removes the account from every device's list. */
const ACC_COOKIE = "jumpi_accounts";
export const MAX_SAVED = 3;
function readSaved(req) {
  const raw = req.cookies?.[ACC_COOKIE];
  if (!raw) return [];
  try {
    const { a } = jwt.verify(raw, process.env.JWT_SECRET);
    return Array.isArray(a) ? a.filter((x) => x && typeof x.s === "string").slice(0, MAX_SAVED) : [];
  } catch {
    return [];
  }
}
function writeSaved(res, list) {
  const opts = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" };
  if (!list.length) return res.clearCookie(ACC_COOKIE, opts);
  res.cookie(ACC_COOKIE, jwt.sign({ a: list.map(({ s, v }) => ({ s, v })) }, process.env.JWT_SECRET, { expiresIn: "30d" }), { ...opts, maxAge: THIRTY_DAYS });
}
// add (or refresh) accounts; new ones go at the end, and the oldest other one drops off when there are too many
function saveAccounts(req, res, users) {
  const list = readSaved(req), keep = users.map((u) => u._id.toString());
  for (const user of users) {
    const id = user._id.toString(), at = list.findIndex((x) => x.s === id);
    if (at >= 0) list[at] = { s: id, v: user.tokenVersion || 0 };
    else list.push({ s: id, v: user.tokenVersion || 0 });
  }
  while (list.length > MAX_SAVED) { const i = list.findIndex((x) => !keep.includes(x.s)); list.splice(i >= 0 ? i : 0, 1); }
  writeSaved(res, list);
}
// the saved accounts that still work (not banned, not signed out everywhere, not deleted)
async function savedUsers(req) {
  const list = readSaved(req);
  if (!list.length) return { list, users: [] };
  const found = await User.find({ _id: { $in: list.map((x) => x.s) } });
  const byId = new Map(found.map((u) => [u._id.toString(), u]));
  const users = list.map((x) => ({ x, u: byId.get(x.s) })).filter(({ x, u }) => u && (x.v || 0) === (u.tokenVersion || 0) && !u.isBanned());
  return { list, users };
}

/* ---------- email check (6-digit code with Resend) ----------
   Only when RESEND_API_KEY is set. An account can't log in (no cookie, no game, no API) until emailVerified is true.
   Between the password and the code the page holds a short "pending" token instead of a login cookie. */
export const needsVerify = (user) => EMAIL_ON() && user && user.emailVerified !== true;
const CODE_MIN = 15, SEND_GAP = 55_000, SENDS_PER_HOUR = 6, MAX_TRIES = 5;
const codeHash = (user, code) => crypto.createHmac("sha256", process.env.JWT_SECRET).update(user._id.toString() + ":" + code).digest("hex");
const pendingToken = (user, remember) => jwt.sign({ sub: user._id.toString(), v: user.tokenVersion || 0, p: "verify", r: !!remember }, process.env.JWT_SECRET, { expiresIn: "2h" });
const maskEmail = (e) => { const [a, d] = String(e).split("@"); return (a.length <= 2 ? a[0] + "•" : a.slice(0, 2) + "•".repeat(Math.min(6, a.length - 2))) + "@" + d; };
async function pendingUser(token) {
  try {
    const { sub, v, p, r } = jwt.verify(String(token || ""), process.env.JWT_SECRET);
    if (p !== "verify") return null;
    const user = await User.findById(sub);
    return user && (v || 0) === (user.tokenVersion || 0) ? { user, remember: !!r } : null;
  } catch { return null; }
}
// make a new code, save its hash and email it
async function sendCode(user, again) {
  const now = Date.now(), old = user.verify || {};
  const sends = (old.sends || []).filter((t) => now - t < 3600_000);
  if (old.sentAt && now - old.sentAt < SEND_GAP) return { ok: false, status: 429, error: "We just sent a code. Check your inbox (and the spam folder) or try again in a minute.", wait: Math.ceil((SEND_GAP - (now - old.sentAt)) / 1000) };
  if (sends.length >= SENDS_PER_HOUR) return { ok: false, status: 429, error: "That's a lot of codes! Please wait a while and try again." };
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  user.verify = { hash: codeHash(user, code), expires: now + CODE_MIN * 60_000, tries: 0, sentAt: now, sends: [...sends, now] };
  user.markModified("verify");
  await user.save();
  const mail = welcomeEmail({ username: user.username, code, minutes: CODE_MIN, again: !!again });
  const sent = await sendMail({ to: user.email, ...mail });
  if (!sent.ok) return { ok: false, status: 502, error: sent.error };
  return { ok: true, email: maskEmail(user.email), wait: Math.ceil(SEND_GAP / 1000) };
}
// log in for real (cookie + this tab's token + the saved accounts of this device)
async function finishLogin(req, res, user, remember) {
  const prev = req.body.addAccount === true ? await currentUser(req) : null;
  setAuthCookie(res, user._id.toString(), remember || !!prev, user.tokenVersion || 0);
  if (remember || prev) saveAccounts(req, res, prev && !prev._id.equals(user._id) ? [prev, user] : [user]);
}
const verifyLimiter = (() => { const hits = new Map(); return (req, res, next) => { const now = Date.now(), k = req.ip, e = hits.get(k);
  if (!e || e.reset < now) { hits.set(k, { n: 1, reset: now + 15 * 60_000 }); return next(); }
  if (++e.n > 40) return res.status(429).json({ error: "Too many tries. Please wait a few minutes." }); next(); }; })();

/* ---------- routes ---------- */

// Is this username / email free? (used by sign-up step 1)
router.post("/check", requireJson, checkLimiter, async (req, res, next) => {
  try {
    const username = clean(req.body.username);
    const email = clean(req.body.email).toLowerCase();
    const [u, e] = await Promise.all([
      USERNAME_RE.test(username) ? User.exists({ usernameLower: username.toLowerCase() }) : null,
      EMAIL_RE.test(email) ? User.exists({ email }) : null,
    ]);
    res.json({ usernameTaken: !!u, emailTaken: !!e, usernameNotAllowed: USERNAME_RE.test(username) && !checkName(username).ok });
  } catch (err) {
    next(err);
  }
});

router.post("/register", requireJson, signupLimiter, async (req, res, next) => {
  try {
    const username = clean(req.body.username);
    const email = clean(req.body.email).toLowerCase();
    const password = req.body.password;

    const invalid = validateAccount({ username, email, password });
    if (invalid) return res.status(400).json(invalid);
    if (req.body.acceptedTerms !== true || req.body.ageConfirmed !== true)
      return res.status(400).json({ field: "terms", error: "Please accept both statements to continue." });

    const bd = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.birthDate || "")) ? new Date(req.body.birthDate + "T12:00:00Z") : null;
    const ageYears = bd ? (Date.now() - bd.getTime()) / (365.25 * 86_400_000) : NaN;
    if (!bd || isNaN(ageYears) || ageYears < 3 || ageYears > 120) return res.status(400).json({ field: "birthDate", error: "Please enter your real date of birth." });
    const look = cleanLook(req.body.look);
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    const user = await User.create({
      username,
      usernameLower: username.toLowerCase(),
      email,
      passwordHash,
      look,
      inventory: lookItems(look),   // the starter items picked at sign-up are theirs
      acceptedTermsAt: now,
      ageConfirmedAt: now,
      lastLoginAt: now,
      birthDate: bd,
      ...(EMAIL_ON() ? { emailVerified: false } : {}),
    });
    // with email checks on: no login yet, a code goes to the email first
    if (needsVerify(user)) {
      const sent = await sendCode(user, false);
      return res.status(201).json({ needVerify: true, pending: pendingToken(user, true), email: maskEmail(user.email), sent: sent.ok, error: sent.ok ? undefined : sent.error });
    }

    // adding a second account from the start screen ("+") keeps the one that was playing on the list too
    const prev = req.body.addAccount === true ? await currentUser(req) : null;
    setAuthCookie(res, user._id.toString(), true);
    saveAccounts(req, res, prev && !prev._id.equals(user._id) ? [prev, user] : [user]);
    res.status(201).json({ user: user.toPublic(), tab: tabToken(user) });
  } catch (err) {
    if (err?.code === 11000) {
      const field = err.keyPattern?.email ? "email" : "username";
      return res
        .status(409)
        .json({ field, error: field === "email" ? "That email already has an account." : "That username is taken." });
    }
    next(err);
  }
});

router.post("/login", requireJson, loginLimiter, async (req, res, next) => {
  try {
    const id = clean(req.body.username);
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!id || !password) return res.status(400).json({ error: "Enter your username and password." });

    // accept either the username or the email address
    const user = await User.findOne(id.includes("@") ? { email: id.toLowerCase() } : { usernameLower: id.toLowerCase() });
    const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !ok) return res.status(401).json({ error: "Wrong username or password." });
    if (user.isBanned()) return res.status(403).json({ error: banMessage(user) });

    if (needsVerify(user))
      return res.status(403).json({ needVerify: true, pending: pendingToken(user, req.body.remember === true), email: maskEmail(user.email), error: "Please check your email first." });
    user.lastLoginAt = new Date();
    await user.save();
    const prev = req.body.addAccount === true ? await currentUser(req) : null;
    setAuthCookie(res, user._id.toString(), req.body.remember === true || !!prev, user.tokenVersion || 0);
    // "Remember me" (or adding an account with "+") keeps it on the start screen
    if (req.body.remember === true || prev) saveAccounts(req, res, prev && !prev._id.equals(user._id) ? [prev, user] : [user]);
    res.json({ user: user.toPublic(), tab: tabToken(user) });
  } catch (err) {
    next(err);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ user: null });
    if (user.isBanned()) {
      clearAuthCookie(res);
      return res.status(403).json({ user: null, error: banMessage(user) });
    }
    res.json({ user: user.toPublic(), tab: tabToken(user) });
  } catch (err) {
    next(err);
  }
});

// log out: the account also leaves this device's saved list; if another saved account is left, it takes over
router.post("/logout", async (req, res, next) => {
  try {
    const me = await currentUser(req);
    const { users } = await savedUsers(req);
    const rest = users.filter(({ x }) => !me || x.s !== me._id.toString());
    writeSaved(res, rest.map(({ x }) => x));
    if (rest.length) {
      const next = rest[0].u;
      setAuthCookie(res, next._id.toString(), true, next.tokenVersion || 0);
      return res.json({ ok: true, user: next.toPublic(), tab: tabToken(next) });
    }
    clearAuthCookie(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// the accounts saved on this device, in their saved order, for the start screen
router.get("/accounts", async (req, res, next) => {
  try {
    const me = await currentUser(req);
    const { list, users } = await savedUsers(req);
    if (users.length !== list.length) writeSaved(res, users.map(({ x }) => x));   // tidy up ones that stopped working
    res.json({
      max: MAX_SAVED,
      accounts: users.map(({ u }) => ({ username: u.username, look: u.publicLook(), role: u.role === "admin" ? "admin" : "player",
        member: u.isMember(), current: !!me && u._id.equals(me._id) })),
    });
  } catch (err) {
    next(err);
  }
});

// take a saved account off this device (the X next to its name on the start screen); not the one playing (that's /logout)
router.post("/forget", requireJson, async (req, res, next) => {
  try {
    const name = clean(req.body.username).toLowerCase();
    const me = await currentUser(req);
    const { users } = await savedUsers(req);
    writeSaved(res, users.filter(({ u }) => u.usernameLower !== name || (me && u._id.equals(me._id))).map(({ x }) => x));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// switch to another saved account (no password needed: it was logged in on this device with "remember me")
router.post("/switch", requireJson, async (req, res, next) => {
  try {
    const name = clean(req.body.username).toLowerCase();
    const { users } = await savedUsers(req);
    const hit = users.find(({ u }) => u.usernameLower === name);
    if (!hit) return res.status(404).json({ error: "That account isn't saved on this device any more. Please log in again." });
    const user = hit.u;
    user.lastLoginAt = new Date();
    await user.save();
    setAuthCookie(res, user._id.toString(), true, user.tokenVersion || 0);
    res.json({ user: user.toPublic(), tab: tabToken(user) });
  } catch (err) {
    next(err);
  }
});

// accounts made before sign-up asked for it: set the date of birth once (it can't be changed here afterwards)
router.post("/birthday", requireJson, async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Please log in first." });
    if (user.birthDate) return res.status(409).json({ error: "We already know your birthday!", user: user.toPublic() });
    const raw = String(req.body.birthDate || ""), bd = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(raw + "T12:00:00Z") : null;
    const age = bd ? (Date.now() - bd.getTime()) / (365.25 * 86_400_000) : NaN;
    if (!bd || isNaN(age) || age < 3 || age > 120 || bd.toISOString().slice(0, 10) !== raw) return res.status(400).json({ error: "Please pick your real date of birth." });
    user.birthDate = bd;
    await user.save();
    res.json({ user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

// send (or send again) the email code: for someone between password and code (pending token), or logged in from before
router.post("/verify/send", requireJson, verifyLimiter, async (req, res, next) => {
  try {
    const p = req.body.pending ? await pendingUser(req.body.pending) : null;
    const user = p ? p.user : await currentUser(req);
    if (!user) return res.status(401).json({ error: "Please log in again." });
    if (!needsVerify(user)) return res.json({ ok: true, already: true });
    const r = await sendCode(user, !!(user.verify && user.verify.sentAt));
    if (!r.ok) return res.status(r.status).json({ error: r.error, wait: r.wait });
    res.json(r);
  } catch (err) {
    next(err);
  }
});
// check the code; right: the email is checked and you're logged in
router.post("/verify", requireJson, verifyLimiter, async (req, res, next) => {
  try {
    const p = req.body.pending ? await pendingUser(req.body.pending) : null;
    const user = p ? p.user : await currentUser(req);
    if (!user) return res.status(401).json({ error: "Please log in again." });
    if (user.isBanned()) return res.status(403).json({ error: banMessage(user) });
    if (needsVerify(user)) {
      const code = String(req.body.code || "").replace(/\D/g, "");
      const V = user.verify || {};
      if (!V.hash || Date.now() > V.expires) return res.status(400).json({ error: "That code has run out. Send a new one." , expired: true });
      if ((V.tries || 0) >= MAX_TRIES) return res.status(429).json({ error: "Too many wrong codes. Send a new one.", expired: true });
      const ok = code.length === 6 && crypto.timingSafeEqual(Buffer.from(codeHash(user, code)), Buffer.from(V.hash));
      if (!ok) {
        user.verify = { ...V, tries: (V.tries || 0) + 1 };
        user.markModified("verify");
        await user.save();
        return res.status(400).json({ error: `That code isn't right. ${Math.max(0, MAX_TRIES - user.verify.tries)} tries left.` });
      }
      user.emailVerified = true;
      user.verify = undefined;
    }
    user.lastLoginAt = new Date();
    await user.save();
    if (p) await finishLogin(req, res, user, p.remember);
    res.json({ user: user.toPublic(), tab: tabToken(user) });
  } catch (err) {
    next(err);
  }
});

/* ---------- forgot password: a link by email (/forgot-password → email → /reset-password?token=…) ----------
   The answer never says whether an account exists. The link works for 30 minutes and once; only its hash is saved.
   A new password signs the account out everywhere and also counts as checking the email. */
const RESET_MIN = 30, RESET_GAP = 60_000, RESETS_PER_HOUR = 3;
const resetHash = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 8 });
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
async function resetUser(token) {
  const t = String(token || "");
  if (!/^[A-Za-z0-9_-]{30,80}$/.test(t)) return null;
  const user = await User.findOne({ "reset.hash": resetHash(t) });
  return user && user.reset && Date.now() < user.reset.expires ? user : null;
}
router.post("/forgot", requireJson, forgotLimiter, async (req, res, next) => {
  try {
    if (!EMAIL_ON()) return res.status(503).json({ code: "off", error: "Password reset by email isn't switched on yet. Write to support@jumpigames.com and we'll help." });
    const id = clean(req.body.email).toLowerCase();
    if (!id || id.length > 254) return res.status(400).json({ code: "empty", error: "Type the email of your Jumpi account." });
    const user = await User.findOne(id.includes("@") ? { email: id } : { usernameLower: id });
    const done = () => res.json({ ok: true, wait: Math.ceil(RESET_GAP / 1000) });
    if (!user) return done();   // same answer either way
    const now = Date.now(), old = user.reset || {};
    const sends = (old.sends || []).filter((t) => now - t < 3600_000);
    if ((sends.length && now - sends[sends.length - 1] < RESET_GAP) || sends.length >= RESETS_PER_HOUR) return done();   // quietly: no flood of emails
    const token = crypto.randomBytes(32).toString("base64url");
    user.reset = { hash: resetHash(token), expires: now + RESET_MIN * 60_000, sends: [...sends, now] };
    user.markModified("reset");
    await user.save();
    done();   // answer first (the same speed whether or not the account exists), then send
    sendMail({ to: user.email, ...resetEmail({ username: user.username, link: `${PUBLIC_URL()}/reset-password?token=${token}`, minutes: RESET_MIN }) })
      .then((r) => { if (!r.ok) console.error("reset email failed for", user.username); });
  } catch (err) {
    next(err);
  }
});
// is this link still good? (the page asks before showing the new-password form)
router.post("/reset/check", requireJson, resetLimiter, async (req, res, next) => {
  try {
    const user = await resetUser(req.body.token);
    if (!user) return res.status(400).json({ code: "bad", error: "This link doesn't work any more." });
    res.json({ ok: true, username: user.username });
  } catch (err) {
    next(err);
  }
});
router.post("/reset", requireJson, resetLimiter, async (req, res, next) => {
  try {
    const user = await resetUser(req.body.token);
    if (!user) return res.status(400).json({ code: "bad", error: "This link doesn't work any more." });
    const pw = req.body.password;
    if (typeof pw !== "string" || pw.length < MIN_PASSWORD) return res.status(400).json({ code: "short", error: `Password needs at least ${MIN_PASSWORD} characters.` });
    if (pw.length > MAX_PASSWORD) return res.status(400).json({ code: "long", error: "That password is too long." });
    if (pw.toLowerCase() === user.username.toLowerCase()) return res.status(400).json({ code: "name", error: "Your password can't be your username." });
    user.passwordHash = await bcrypt.hash(pw, 12);
    user.tokenVersion = (user.tokenVersion || 0) + 1;   // signed out on every device
    user.reset = undefined;
    user.emailVerified = true;                            // they opened the email, so it's theirs
    user.verify = undefined;
    await user.save();
    res.json({ ok: true, username: user.username });
  } catch (err) {
    next(err);
  }
});

export default router;
