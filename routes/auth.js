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

export async function currentUser(req) {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    const { sub, v } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(sub);
    if (!user || (v || 0) !== (user.tokenVersion || 0)) return null;   // logged out everywhere by an admin
    return user;
  } catch {
    return null;
  }
}
export { setAuthCookie, clearAuthCookie, COOKIE as AUTH_COOKIE };

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

    setAuthCookie(res, user._id.toString(), true);
    res.status(201).json({ user: user.toPublic() });
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
    setAuthCookie(res, user._id.toString(), req.body.remember === true, user.tokenVersion || 0);
    res.json({ user: user.toPublic() });
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
    res.json({ user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

export default router;
