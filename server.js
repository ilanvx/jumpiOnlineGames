import "dotenv/config";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { Server } from "socket.io";
import authRoutes from "./routes/auth.js";
import shopRoutes from "./routes/shop.js";
import rewardRoutes from "./routes/rewards.js";
import homeRoutes from "./routes/home.js";
import socialRoutes from "./routes/social.js";
import contactRoutes from "./routes/contact.js";
import teamRoutes from "./routes/team.js";
import adminRoutes from "./routes/admin.js";
import needsRoutes from "./routes/needs.js";
import petRoutes from "./routes/pets.js";
import storeRoutes from "./routes/store.js";
import jobRoutes from "./routes/jobs.js";
import seasonRoutes from "./routes/season.js";
import secretRoutes from "./routes/secrets.js";
import codeRoutes from "./routes/codes.js";
import tutorialRoutes from "./routes/tutorial.js";
import questRoutes from "./routes/quests.js";
import parentRoutes from "./routes/parents.js";
import { STORE_OPEN } from "./public/shared/store.js";
import { LAUNCH_AT, LAUNCH_HOSTS } from "./public/shared/launch.js";
import { saveAllNeeds } from "./realtime/needs.js";
import { currentUser, loadRevoked } from "./routes/auth.js";
import "./models/Report.js";
import "./models/Revoked.js";
import "./models/Logs.js";
import { attachPlaza, onlinePlayers } from "./realtime/plaza.js";
import { startDiscordStats } from "./discord/pip.js";
import { discordInteractions } from "./discord/interactions.js";
import { loadEvent, eventInfo } from "./realtime/events.js";
import { reqIp, isHttps, viaCloudflare } from "./routes/ip.js";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { MONGODB_URI, MONGODB_DB = "jumpi", JWT_SECRET, PORT = 3000 } = process.env;

/* ---------- check settings before starting ---------- */
if (!MONGODB_URI || MONGODB_URI.includes("USERNAME:PASSWORD")) {
  console.error("✗ MONGODB_URI is missing. Copy .env.example to .env and paste your Atlas connection string.");
  process.exit(1);
}
if (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET.startsWith("change-me")) {
  console.error("✗ JWT_SECRET must be a random string of at least 32 characters. See .env.example for how to make one.");
  process.exit(1);
}

// a mistake somewhere is logged and the game keeps running for everyone (it used to stop the whole server)
process.on("unhandledRejection", (err) => console.error("[unhandled promise]", err));

// a request from the internet to the real domain (through Cloudflare), not someone testing on this computer
const isPublic = (req) => viaCloudflare(req) || LAUNCH_HOSTS.includes(String(req.headers.host || "").split(":")[0].toLowerCase());

/* ---------- app ---------- */
const app = express();
app.disable("x-powered-by");
// the player's real address (behind Cloudflare: see routes/ip.js); every "too many tries" limit and the admin log use req.ip
app.use((req, res, next) => {
  Object.defineProperty(req, "ip", { value: reqIp(req), configurable: true, enumerable: true });
  next();
});
// basic safety headers on every response (HSTS: browsers only ever use https on the real domain)
app.use((req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "SAMEORIGIN" });
  if (isHttps(req) && isPublic(req)) res.set("Strict-Transport-Security", "max-age=15552000");
  next();
});
// Discord buttons (the ✅ in #rules): signed by Discord, so this needs the raw body, before express.json
app.post("/api/discord/interactions", express.raw({ type: "*/*", limit: "100kb" }), (req, res, next) => discordInteractions(req, res).catch(next));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api", shopRoutes);
app.use("/api", rewardRoutes);
app.use("/api", homeRoutes);
app.use("/api", socialRoutes);
app.use("/api", contactRoutes);
app.use("/api", teamRoutes);
app.use("/api", needsRoutes);
app.use("/api", petRoutes);
app.use("/api", storeRoutes);
app.use("/api", jobRoutes);
app.use("/api", seasonRoutes);
app.use("/api", secretRoutes);
app.use("/api", codeRoutes);
app.use("/api", tutorialRoutes);
app.use("/api", questRoutes);
app.use("/api/parents", parentRoutes);   // parental controls (the /parents page)
// which holiday event is on (public/shared/events.js); the game asks on start, then the socket tells it about changes
app.get("/api/event", (req, res) => { res.set("Cache-Control", "no-store"); const { event } = eventInfo(); res.json({ event }); });
app.use("/api/admin", adminRoutes);
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));
// pages: the website is the home page, the game lives at /play
const PUBLIC_DIR = path.join(__dirname, "public");
/* Content-Security-Policy for our pages: scripts only from this site, plus the page's own inline scripts (allowed by their
   sha256, worked out from the file itself), fonts from Google Fonts, and nothing can be framed or posted elsewhere.
   A script someone manages to sneak into a page (XSS) wouldn't run. */
function cspFor(html, req) {
  const hashes = new Set();
  for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    if (/\ssrc\s*=/i.test(m[1] || "") || !m[2]) continue;
    // the browser reads CRLF line ends as LF before hashing (a Windows checkout may have CRLF)
    hashes.add(`'sha256-${crypto.createHash("sha256").update(m[2].replace(/\r\n?/g, "\n"), "utf8").digest("base64")}'`);
  }
  const host = String(req.headers.host || "").replace(/[^a-z0-9.:\-[\]]/gi, "");
  return [
    "default-src 'self'", `script-src 'self' ${[...hashes].join(" ")}`, "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:", "img-src 'self' data: blob:", "media-src 'self' data: blob:",
    `connect-src 'self'${host ? ` wss://${host} ws://${host}` : ""}`, "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'",
  ].join("; ");
}
// a page from public/ with its CSP (read again only when the file changes)
const pageCache = new Map();
function sendPage(req, res, file, status = 200) {
  const full = path.join(PUBLIC_DIR, file);
  const t = statSync(full).mtimeMs;
  let c = pageCache.get(full);
  if (!c || c.t !== t) { const html = readFileSync(full, "utf8"); c = { t, html, scripts: html }; pageCache.set(full, c); }
  res.set("Content-Security-Policy", cspFor(c.html, req));
  res.status(status).type("html").send(c.html);
}
const page = (file) => (req, res, next) => { try { sendPage(req, res, file); } catch (err) { next(err); } };
app.get("/", page("site/index.html"));
// before the grand opening (LAUNCH_AT in public/shared/launch.js) the game on jumpigames.com shows the countdown page instead;
// localhost / other hosts always get the game, and admins who are already logged in can play
const gameGate = async (req, res, next) => {
  const inApp = /JumpiApp\//.test(String(req.headers["user-agent"] || ""));   // the Android app always gets the game itself
  if (isPublic(req) && Date.now() < LAUNCH_AT && !inApp) {
    let admin = false;
    try { admin = (await currentUser(req))?.role === "admin"; } catch {}
    res.set("Cache-Control", "no-store");
    // "?staff" opens the game anyway so an admin can log in (players who log in there are refused by the socket)
    // "?soon" shows the countdown page to anyone (so an admin can see it too)
    if ((!admin && !("staff" in req.query)) || "soon" in req.query) return sendPage(req, res, "site/game-soon.html");
  }
  res.set("Cache-Control", "no-cache");   // the Android app opens this page: always check for the newest version
  sendGame(res, next);
};
// the game page with a version on its own scripts (/shared/*.js?v=…): phones and the app (and Cloudflare's browser cache
// time) may keep old copies of those files for hours, which made new items "not exist" after an update. A new version
// number on every deploy (the page's file time) makes every device fetch the new files right away.
let gameHtml = { at: 0, html: "" };
// the newest file time among the page and its own scripts (/shared and /world), checked at most every 5 s
let newest = { t: 0, at: 0 };
function gameFilesTime() {
  if (Date.now() - newest.t < 5000) return newest.at;
  let at = statSync(path.join(PUBLIC_DIR, "index.html")).mtimeMs;
  for (const dir of ["shared", "world"]) {
    try { for (const f of readdirSync(path.join(PUBLIC_DIR, dir))) if (f.endsWith(".js")) at = Math.max(at, statSync(path.join(PUBLIC_DIR, dir, f)).mtimeMs); } catch {}
  }
  newest = { t: Date.now(), at };
  return at;
}
function sendGame(res, next) {
  try {
    const at = gameFilesTime();
    if (at !== gameHtml.at) {
      const v = Math.round(at).toString(36);
      gameHtml = { at, html: readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8").replace(/(["'])\/(shared|world)\/([\w.-]+\.js)\1/g, `$1/$2/$3?v=${v}$1`) };
    }
    res.set("Content-Security-Policy", cspFor(gameHtml.html, res.req));
    res.type("html").send(gameHtml.html);
  } catch (err) {
    next(err);
  }
}
app.get(["/play", "/play/"], gameGate);
app.get(["/studio", "/studio/"], gameGate);   // image studio (pictures made in code, see STUDIO_SCENES in index.html)
app.get("/terms", page("site/terms.html"));
app.get("/privacy", page("site/privacy.html"));
app.get(["/accessibility", "/accessibility-statement", "/negishut"], page("site/accessibility.html"));   // accessibility statement (Israeli regulations 2013, IS 5568)
app.get("/delete-account", page("site/delete-account.html"));   // Google Play: how to delete a JUMPI account
app.get("/contact", page("site/contact.html"));
app.get(["/parents", "/parent", "/horim"], (req, res, next) => { res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }); page("site/parents.html")(req, res, next); });   // parental controls
app.get(["/for-parents", "/parents-guide", "/lehorim"], page("site/for-parents.html"));   // Jumpi for parents: what kids learn, safety, controls, purchases
app.get(["/help", "/faq", "/ezra"], page("site/help.html"));   // the help center: guides with pictures (help.js, help-data.js)
app.get(["/team", "/join-the-team", "/careers"], page("site/team.html"));   // join the first Community Team (routes/team.js)
app.get("/trailer", page("site/trailer.html"));
// the Windows app: the newest installer from GitHub Releases (built by the "Windows app" workflow, branch android-app)
app.get(["/download/windows", "/download/pc"], (req, res) => { res.set("Cache-Control", "no-store"); res.redirect(302, "https://github.com/ilanvx/jumpiOnlineGames/releases/latest/download/Jumpi-Games-Setup.exe"); });
// the Android app: the APK built on GitHub (branch android-build), copied to public/download/jumpi-games.apk
app.get("/download/android", (req, res, next) => {
  const f = path.join(PUBLIC_DIR, "download", "jumpi-games.apk");
  if (!existsSync(f)) return next();
  res.set({ "Content-Type": "application/vnd.android.package-archive", "Content-Disposition": 'attachment; filename="Jumpi Games.apk"', "Cache-Control": "no-cache" });
  res.sendFile(f);
});
app.get(["/forgot-password", "/reset-password"], (req, res, next) => { res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }); page("site/reset.html")(req, res, next); });   // forgot password (routes/auth.js /forgot, /reset)   // the trailer video (public/site/trailer/)
// while the store is closed (STORE_OPEN in public/shared/store.js) /store shows the "under renovation" page
app.get("/store", (req, res, next) => page(STORE_OPEN ? "site/store.html" : "site/store-soon.html")(req, res, next));
app.get("/site/store.html", (req, res) => res.redirect(302, "/store"));
// the admin panel: signed-in players who aren't admins get "Not found"; the page itself checks the rest with the server
app.get(["/admin", "/admin/"], async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (user && user.role !== "admin") return notFound(req, res);
    res.set({
      "Cache-Control": "no-store", "X-Frame-Options": "DENY", "X-Robots-Tag": "noindex",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    });
    res.sendFile(path.join(PUBLIC_DIR, "admin", "index.html"));
  } catch (err) {
    next(err);
  }
});
// old addresses still work
const moved = { "/admin/index.html": "/admin", "/site": "/", "/site/": "/", "/site/index.html": "/", "/index.html": "/play", "/site/terms.html": "/terms", "/site/privacy.html": "/privacy", "/site/contact.html": "/contact", "/site/trailer.html": "/trailer" };
// the pages that have their own address (with the launch gate, the admin checks and the CSP) are never sent as plain files,
// whatever way the address is written (/INDEX.HTML, /%69ndex.html, /admin/index.html…)
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  let p;
  try { p = decodeURIComponent(req.path).replace(/\\/g, "/").replace(/\/{2,}/g, "/").toLowerCase(); } catch { return notFound(req, res); }
  if (moved[p]) return res.redirect(301, moved[p] + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""));
  if (/\.html?$/.test(p) && (p === "/index.html" || p.startsWith("/admin/") || p.startsWith("/site/"))) return notFound(req, res);
  next();
});
// scripts, styles and pages: the browser may keep them but must check for a newer one each time (cheap: 304 when unchanged)
app.use(express.static(PUBLIC_DIR, { index: false, setHeaders: (res, file) => { if (/\.(js|mjs|css|html|json)$/i.test(file)) res.set("Cache-Control", "no-cache"); } }));

// anything else: the "Jumpi got lost" page for people, a short text for files and scripts
const notFound = (req, res) => {
  const wantsPage = (req.method === "GET" || req.method === "HEAD") && String(req.headers.accept || "").includes("text/html");
  if (wantsPage) { try { return sendPage(req, res, "site/404.html", 404); } catch {} }
  res.status(404).type("text").send("Not found");
};
app.use(notFound);

// last-resort error handler: log the details, show the player something friendly
app.use((err, req, res, next) => {
  if (res.headersSent) { console.error(err); return next(err); }
  if (err && err.name === "VersionError") return res.status(409).json({ error: "Something got in the way. Try again." });   // two changes at the same moment (models/User.js)
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our side. Please try again." });
});

/* ---------- connect, then listen ---------- */
mongoose.set("strictQuery", true);
try {
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB, serverSelectionTimeoutMS: 10000 });
  await mongoose.model("User").syncIndexes();
  for (const m of ["ChatLog", "TradeLog", "DuelLog", "AdminLog", "ContactMessage", "Order"]) await mongoose.model(m).syncIndexes();
  await mongoose.model("Message").syncIndexes(); // makes sure username/email are unique in the database
  for (const m of ["Report", "Revoked"]) await mongoose.model(m).syncIndexes();
  await loadRevoked();   // logins that were ended stay ended after a restart
  console.log(`✓ Connected to MongoDB (database "${MONGODB_DB}")`);
  await loadEvent();
} catch (err) {
  console.error("✗ Could not connect to MongoDB:", err.message);
  console.error("  Check the connection string and password in .env, and that Atlas → Network Access allows your IP address.");
  process.exit(1);
}

// one server for the website and the real-time Plaza.
// The game's live connection only takes pages from this site (another website can't open it with a player's login).
const server = http.createServer(app);
const okOrigins = new Set([...LAUNCH_HOSTS, "localhost", "127.0.0.1"]);
attachPlaza(new Server(server, {
  maxHttpBufferSize: 16 * 1024,   // the biggest message a game window may send (they are all small)
  allowRequest: (req, cb) => {
    const origin = req.headers.origin;
    if (!origin) return cb(null, true);   // the apps and tools without a page
    let host = "";
    try { host = new URL(origin).hostname.toLowerCase(); } catch { return cb("bad origin", false); }
    const own = [req.headers.host, req.headers["x-forwarded-host"]].map((h) => String(h || "").split(",")[0].trim().split(":")[0].toLowerCase());
    cb(null, okOrigins.has(host) || own.includes(host));
  },
}));
// Ctrl+C: save everyone's needs before stopping
for (const sig of ["SIGINT", "SIGTERM"])
  process.once(sig, async () => {
    await Promise.race([saveAllNeeds(), new Promise((r) => setTimeout(r, 3000))]);
    process.exit(0);
  });
server.listen(PORT, () => {
  console.log(`✓ Jumpi is running: website http://localhost:${PORT}  ·  game http://localhost:${PORT}/play`);
  // once it's running: an unexpected mistake is logged instead of stopping the game for everyone
  process.on("uncaughtException", (err) => console.error("[uncaught]", err));
});
// Pip in the Discord server: the "🎮 Playing now" counter (players you can see, not invisible admins)
startDiscordStats(() => onlinePlayers(false).length);
