/*
  TikTok follower counter for the Jumpi City page (/city).

  Only the owner of the Jumpi Games TikTok account connects, once, from the /admin website (TikTok → "Connect TikTok").
  TikTok sends him back to /api/tiktok/callback with a one-time code; we swap it for tokens and from then on the
  server reads the account's follower_count every few minutes (scopes user.info.basic + user.info.stats; nothing
  about other TikTok users is ever read).

  .env (typed by Ilan on the server, never in a file in the repo):
    TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET  (from developers.tiktok.com → the app "Jumpi City", Sandbox or Production)
  The redirect address set in the TikTok app must be exactly REDIRECT below.

  Saved in the database (Setting "tiktok"): the account name, the last count and when, and the tokens,
  encrypted (AES-256-GCM, key made from TIKTOK_CLIENT_SECRET), so a database copy alone can't use them.
  A manual number (admin panel) wins over the live one while it is set: a fallback until TikTok is connected.
*/
import crypto from "node:crypto";
import express from "express";
import { Setting } from "../realtime/events.js";
import { AdminLog, logQuietly } from "../models/Logs.js";
import { currentUser } from "./auth.js";

const KEY = "tiktok";
const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const INFO_URL = "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,follower_count";
const SCOPES = "user.info.basic,user.info.stats";
const POLL_MS = 5 * 60 * 1000;   // how often we read the count
const base = () => (process.env.PUBLIC_URL || "https://jumpigames.com").replace(/\/+$/, "");
export const REDIRECT_PATH = "/api/tiktok/callback";
const redirectUri = () => base() + REDIRECT_PATH;
export const tiktokReady = () => !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);

/* ---------- the saved state ---------- */
let state = { account: "", openId: "", followers: null, at: null, manual: null, error: "", connectedAt: null, tok: null };
let loaded = false;

async function load() {
  if (loaded) return state;
  try {
    const s = await Setting.findOne({ key: KEY }).lean();
    if (s && s.value) state = { ...state, ...s.value };
  } catch (err) {
    console.warn("[tiktok] couldn't read the saved state:", err.message);
  }
  loaded = true;
  return state;
}
async function save(by = "") {
  await Setting.updateOne({ key: KEY }, { $set: { value: state, by } }, { upsert: true });
}

/* ---------- tokens are kept encrypted ---------- */
const cipherKey = () => crypto.createHash("sha256").update("jumpi-tiktok|" + (process.env.TIKTOK_CLIENT_SECRET || "")).digest();
function seal(obj) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", cipherKey(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}
function unseal(s) {
  try {
    const [iv, tag, data] = String(s || "").split(".").map((x) => Buffer.from(x, "base64"));
    const d = crypto.createDecipheriv("aes-256-gcm", cipherKey(), iv);
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString("utf8"));
  } catch {
    return null;   // the secret changed, or nothing saved
  }
}

/* ---------- talking to TikTok ---------- */
async function tokenCall(params) {
  const body = new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET, ...params });
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" }, body, signal: AbortSignal.timeout(15_000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error(d.error_description || d.error || `TikTok answered ${r.status}`);
  const now = Date.now();
  return { access: d.access_token, refresh: d.refresh_token, accessUntil: now + (Number(d.expires_in) || 86400) * 1000 - 60_000,
    refreshUntil: now + (Number(d.refresh_expires_in) || 31536000) * 1000, openId: d.open_id || "", scope: d.scope || "" };
}

async function userInfo(access) {
  const r = await fetch(INFO_URL, { headers: { Authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(15_000) });
  const d = await r.json().catch(() => ({}));
  const code = d?.error?.code;
  if (!r.ok || (code && code !== "ok")) throw Object.assign(new Error(d?.error?.message || code || `TikTok answered ${r.status}`), { code });
  return d?.data?.user || {};
}

// a token that works: refreshes it when it ran out (TikTok gives a new refresh token each time, so it is saved again)
async function accessToken() {
  const tok = unseal(state.tok);
  if (!tok) throw new Error("not-connected");
  if (Date.now() < tok.accessUntil) return tok.access;
  if (Date.now() > tok.refreshUntil) throw new Error("The TikTok connection ran out. Connect it again.");
  const next = await tokenCall({ grant_type: "refresh_token", refresh_token: tok.refresh });
  state.tok = seal(next);
  await save();
  return next.access;
}

let busy = false;
export async function readFollowers() {
  await load();
  if (busy || !tiktokReady() || !state.tok) return state;
  busy = true;
  try {
    const u = await userInfo(await accessToken());
    if (Number.isFinite(Number(u.follower_count))) {
      state.followers = Number(u.follower_count);
      state.at = new Date();
    }
    state.account = u.display_name || state.account;   // (username needs another permission, user.info.profile: not asked)
    state.error = "";
  } catch (err) {
    state.error = String(err.message || err).slice(0, 200);
    if (err.code === "access_token_invalid") state.tok = null;   // revoked on TikTok's side: connect again
    console.warn("[tiktok] couldn't read the followers:", state.error);
  } finally {
    busy = false;
    await save().catch(() => {});
  }
  return state;
}

export function startTiktok() {
  load().then(() => {
    readFollowers();
    setInterval(readFollowers, POLL_MS).unref();
  });
}

/* ---------- what the city page gets ---------- */
export async function cityFollowers() {
  await load();
  const manual = Number.isFinite(state.manual) && state.manual !== null;
  return { followers: manual ? state.manual : state.followers, at: manual ? null : state.at, live: !manual && state.followers !== null };
}

/* ---------- public: the callback TikTok sends the owner back to ---------- */
const pending = new Map();   // state → { admin id, until }

export const tiktokPublic = express.Router();
tiktokPublic.get("/tiktok/callback", async (req, res) => {
  res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
  const back = (msg) => res.redirect(302, "/admin#tiktok" + (msg ? "/" + encodeURIComponent(msg) : ""));   // the panel shows it (VIEWS.tiktok(arg))
  try {
    const user = await currentUser(req, { cookieOnly: true });
    const { isSenior } = await import("./admin.js");   // (loaded here, not at the top: admin.js imports this file)
    const p = pending.get(String(req.query.state || ""));
    pending.delete(String(req.query.state || ""));
    if (!user || !isSenior(user) || !p || p.admin !== user._id.toString() || p.until < Date.now()) return back("expired");
    if (req.query.error) return back(String(req.query.error_description || req.query.error).slice(0, 120));
    const code = String(req.query.code || "");
    if (!code || !tiktokReady()) return back("no-code");
    await load();
    const tok = await tokenCall({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
    if (!/user\.info\.stats/.test(tok.scope)) return back("The follower-count permission was not given. Connect again and allow it.");
    state.tok = seal(tok);
    state.openId = tok.openId;
    state.connectedAt = new Date();
    state.error = "";
    await save(user.username);
    logQuietly(AdminLog, { adminId: user._id, admin: user.username, action: "tiktok-connect", details: "", via: "panel", ip: req.ip || "" });
    await readFollowers();
    back("ok");
  } catch (err) {
    console.warn("[tiktok] connect failed:", err.message);
    back(String(err.message || "failed").slice(0, 120));
  }
});

/* ---------- /api/admin/tiktok (the admin router checks the senior admin + unlock first) ---------- */
export const tiktokAdmin = express.Router();
const view = () => ({
  ready: tiktokReady(), connected: !!state.tok, account: state.account, followers: state.followers, at: state.at,
  manual: state.manual, error: state.error, connectedAt: state.connectedAt, redirect: redirectUri(),
});
tiktokAdmin.get("/", async (req, res) => { await load(); res.json(view()); });
tiktokAdmin.post("/connect", (req, res) => {
  if (!tiktokReady()) return res.status(400).json({ error: "TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET aren't in .env yet." });
  const st = crypto.randomBytes(18).toString("base64url");
  pending.set(st, { admin: req.admin._id.toString(), until: Date.now() + 10 * 60 * 1000 });
  if (pending.size > 50) pending.delete(pending.keys().next().value);
  const q = new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY, scope: SCOPES, response_type: "code", redirect_uri: redirectUri(), state: st });
  res.json({ url: AUTH_URL + "?" + q.toString() });
});
tiktokAdmin.post("/refresh", async (req, res) => { await readFollowers(); res.json(view()); });
tiktokAdmin.post("/manual", async (req, res) => {
  await load();
  const v = req.body.followers;
  state.manual = v === null || v === "" || v === undefined ? null : Math.max(0, Math.min(1e9, Math.round(Number(v) || 0)));
  await save(req.admin.username);
  logQuietly(AdminLog, { adminId: req.admin._id, admin: req.admin.username, action: "tiktok-manual", details: state.manual === null ? "off" : String(state.manual), via: "panel", ip: req.ip || "" });
  res.json(view());
});
tiktokAdmin.post("/disconnect", async (req, res) => {
  await load();
  state.tok = null;
  state.connectedAt = null;
  await save(req.admin.username);
  logQuietly(AdminLog, { adminId: req.admin._id, admin: req.admin.username, action: "tiktok-disconnect", details: "", via: "panel", ip: req.ip || "" });
  res.json(view());
});
