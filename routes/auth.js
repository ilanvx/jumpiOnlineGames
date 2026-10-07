import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, LOOK_LIMITS } from "../models/User.js";
import { lookItems } from "../catalog.js";
import { checkName } from "../public/shared/profanity.js";

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
    });

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

export default router;
