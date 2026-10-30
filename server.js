import "dotenv/config";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, statSync } from "node:fs";
import express from "express";
import { APP_DOWNLOADS_OPEN } from "./public/shared/app.js";
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
import adminRoutes, { isSenior } from "./routes/admin.js";
import needsRoutes from "./routes/needs.js";
import petRoutes from "./routes/pets.js";
import storeRoutes, { hypReturn } from "./routes/store.js";
import jobRoutes from "./routes/jobs.js";
import seasonRoutes from "./routes/season.js";
import secretRoutes from "./routes/secrets.js";
import codeRoutes from "./routes/codes.js";
import tutorialRoutes from "./routes/tutorial.js";
import questRoutes from "./routes/quests.js";
import parentRoutes from "./routes/parents.js";
import pollRoutes from "./routes/poll.js";
import perfRoutes from "./routes/perf.js";
import clubRoutes from "./routes/club.js";
import { makeFresh, versioned } from "./routes/fresh.js";
import blogRoutes from "./routes/blog.js";
import drawingRoutes from "./routes/drawings.js";
import memberRoutes from "./routes/member.js";
import { STORE_OPEN } from "./public/shared/store.js";
import { LAUNCH_AT, LAUNCH_HOSTS } from "./public/shared/launch.js";
import { saveAllNeeds } from "./realtime/needs.js";
import { currentUser, loadRevoked } from "./routes/auth.js";
import "./models/Report.js";
import "./models/Revoked.js";
import "./models/Logs.js";
import { attachPlaza, onlinePlayers, announceUpdate } from "./realtime/plaza.js";
import { startDiscordStats } from "./discord/pip.js";
import { discordInteractions } from "./discord/interactions.js";
import { loadEvent, eventInfo } from "./realtime/events.js";
import { reqIp, isHttps, viaCloudflare } from "./routes/ip.js";
import crypto from "node:crypto";
import { loadCustom, customJs, customRev } from "./routes/items.js";

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
  if (process.env.STAGING === "1") res.set("X-Robots-Tag", "noindex, nofollow");   // the private test copy (hetzner/staging.sh): never in search results
  next();
});
// Discord buttons (the ✅ in #rules): signed by Discord, so this needs the raw body, before express.json
app.post("/api/discord/interactions", express.raw({ type: "*/*", limit: "100kb" }), (req, res, next) => discordInteractions(req, res).catch(next));
app.use("/api/blog", express.json({ limit: "64kb" }));   // a blog post can be longer than everything else (admins only write them)
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
app.use("/api", pollRoutes);   // the weekly poll on the home page
app.use("/api", memberRoutes);   // members: the monthly gift, a membership that ran out
app.use("/api", perfRoutes);   // anonymous frames-a-second reports from the game (admin panel → Performance)
app.use("/api", clubRoutes);   // Jumpi Club: my level and coins, who is online, my Jumpi picture
app.use("/api", drawingRoutes);   // Jumpi Club colouring book: my own pictures
app.use("/api", blogRoutes);   // Jumpi Club blog: posts by admins, comments approved by admins
app.use("/api/parents", parentRoutes);   // parental controls (the /parents page)
// which holiday event is on (public/shared/events.js); the game asks on start, then the socket tells it about changes
app.get("/api/event", (req, res) => { res.set("Cache-Control", "no-store"); const { event } = eventInfo(); res.json({ event }); });
app.use("/api/admin", adminRoutes);
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));
// pages: the website is the home page, the game lives at /play
const PUBLIC_DIR = path.join(__dirname, "public");
const freshPage = makeFresh(PUBLIC_DIR, { "/shared/items/custom.js": customRev });   // (the Item studio's items: their version changes with every change, routes/items.js)   // every page: its own files with a version (?v=…), so everyone always gets the newest (routes/fresh.js)
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
    `connect-src 'self' blob:${host ? ` wss://${host} ws://${host}` : ""}`, "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'",
  ].join("; ");
}
// a page from public/ with its CSP (read again only when the file changes), its files versioned, never kept by the browser
const pageCache = new Map();
function rawPage(file) {
  const full = path.join(PUBLIC_DIR, file), t = statSync(full).mtimeMs;
  let c = pageCache.get(full);
  if (!c || c.t !== t) { c = { t, html: readFileSync(full, "utf8") }; pageCache.set(full, c); }
  return c.html;
}
function sendPage(req, res, file, status = 200) {
  const html = freshPage(file, rawPage(file));
  res.set("Content-Security-Policy", cspFor(html, req));
  if (!res.get("Cache-Control")) res.set("Cache-Control", "no-cache");
  res.status(status).type("html").send(html);
}
const page = (file) => (req, res, next) => { try { sendPage(req, res, file); } catch (err) { next(err); } };
// Jumpi Club (club.jumpigames.com, the same server through Cloudflare): its home is the Club's page; /club shows it anywhere
const CLUB_HOSTS = ["club.jumpigames.com"];
const isClub = (req) => CLUB_HOSTS.includes(String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().split(":")[0].toLowerCase());
// the Club's page (its files get versions like every page: routes/fresh.js)
function clubPage(req, res, next) { try { res.set("Cache-Control", "no-cache"); sendPage(req, res, "club/index.html"); } catch (err) { next(err); } }
app.get("/", (req, res, next) => (isClub(req) ? clubPage(req, res, next) : page("site/index.html")(req, res, next)));
app.get(["/club", "/club/"], clubPage);
// the Club's arcade window: the game's own mini-games on a page of their own (tools/club/build-arcade.mjs makes it), opened in a frame
app.get("/club/draw", (req, res, next) => { res.set("Cache-Control", "no-cache"); page("club/draw/draw.html")(req, res, next); });
app.get("/club/learn", (req, res, next) => { res.set("Cache-Control", "no-cache"); page("club/learn/learn.html")(req, res, next); });   // learning games (just for fun)
app.get("/club/puzzle", (req, res, next) => { res.set("Cache-Control", "no-cache"); page("club/puzzle/puzzle.html")(req, res, next); });   // the Club's puzzles (coin rounds: routes/puzzles.js)
app.get("/club/pool", (req, res, next) => { res.set("Cache-Control", "no-cache"); page("club/pool/pool.html")(req, res, next); });   // billiards (8-ball) against Jumpi Bot (just for fun)
app.get("/club/arcade", (req, res, next) => { res.set("Cache-Control", "no-cache"); page("club/arcade/play.html")(req, res, next); });
// /play on the website (a browser, not one of our apps) is a page with the site's top bar and the game in a frame in the
// middle (site/play.html + play.js); the frame opens /play?game. Phones go straight to /play?game (play.js), and the apps
// ("JumpiApp/" = Android/iPhone, "JumpiDesktop/" = the computer program) and /studio always get the game itself.
// Before the grand opening (LAUNCH_AT in public/shared/launch.js) players on jumpigames.com get the game with "?soon": its
// loading screen ends in a "testers only" note instead of the game (and the socket refuses non-admins anyway).
// localhost / other hosts are never gated, nor are admins who are already logged in, nor the Android app.
const gameGate = async (req, res, next) => {
  const ua = String(req.headers["user-agent"] || "");
  const inApp = /JumpiApp\//.test(ua), inDesk = /JumpiDesktop\//.test(ua);
  if (req.path.startsWith("/play") && !inApp && !inDesk && !("game" in req.query)) {
    res.set("Cache-Control", "no-cache");
    return sendPage(req, res, "site/play.html");
  }
  // "?soon": the game in "closed" mode, on any server and at any time (also a preview for the team)
  if ("soon" in req.query) {
    // after the opening an old "?soon" address (a bookmark, a shortcut) would still end in the "testers only" note: drop it
    if (isPublic(req) && Date.now() >= LAUNCH_AT) { const q = new URLSearchParams(req.query); q.delete("soon"); const qs = q.toString().replace(/=(&|$)/g, "$1"); return res.redirect(302, req.path + (qs ? "?" + qs : "")); }
    res.set("Cache-Control", "no-store"); return sendGame(res, next);
  }
  if (isPublic(req) && Date.now() < LAUNCH_AT && !inApp) {
    let admin = false;
    try { admin = (await currentUser(req))?.role === "admin"; } catch {}
    res.set("Cache-Control", "no-store");
    // "?staff" opens the game anyway so an admin can log in (players who log in there are refused by the socket)
    if (!admin && !("staff" in req.query)) {
      const q = new URLSearchParams(req.query); q.set("soon", "");
      return res.redirect(302, `${req.path}?${q.toString().replace(/=(&|$)/g, "$1")}`);
    }
  }
  res.set("Cache-Control", "no-cache");   // the Android app opens this page: always check for the newest version
  sendGame(res, next);
};
// the game page: its scripts (/shared, /world… and everything they import) get versions like every page (routes/fresh.js):
// phones and the app (and Cloudflare's browser cache time) may keep old copies of files for hours, which made new items
// "not exist" after an update. A changed file gets a new address, so every device fetches it right away.
function sendGame(res, next) {
  try {
    const html = freshPage("index.html", rawPage("index.html"));
    res.set("Content-Security-Policy", cspFor(html, res.req));
    res.type("html").send(html);
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
app.get(["/for-parents", "/parents-guide", "/lehorim"], page("site/for-parents.html"));
app.get(["/safety", "/online-safety", "/betihut"], page("site/safety.html"));   // online safety tips for kids
app.get(["/about", "/about-us", "/odot", "/company", "/who-we-are", "/mi-anachnu"], page("site/about.html"));   // about Jumpi Games: the studio, our games, the numbers, safety, the team (linked from the footer)
app.get(["/partners", "/partnerships", "/shutafim"], page("site/partners.html"));   // the businesses and projects we work with (footer)   // Jumpi for parents: what kids learn, safety, controls, purchases
app.get(["/help", "/faq", "/ezra"], page("site/help.html"));   // the help center: guides with pictures (help.js, help-data.js)
app.get(["/team", "/join-the-team", "/careers"], page("site/team.html"));   // join the first Community Team (routes/team.js)
app.get(["/links", "/link", "/bio"], page("site/links.html"));   // all our links in one place (the link in our TikTok / YouTube bios)
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
// the Jumpi Store (STORE_OPEN in public/shared/store.js decides who can buy; while it's false only admins can check out)
app.get("/store", page("site/store.html"));
app.get("/site/store.html", (req, res) => res.redirect(302, "/store"));
// after paying: the pages set in the Hyp portal (success → /success, failed → /fail). Coming from Hyp (with its parameters)
// both first go through the same check as /api/store/hyp/return (routes/store.js), then land on the clean page:
// /success?p=<product> (given), /success?check (Hyp didn't confirm yet), /fail (not paid)
const payTo = (r, product) => (r === "ok" ? "/success?p=" + encodeURIComponent(product || "") : r === "check" ? "/success?check" : "/fail");
const fromHyp = (q) => "Id" in q || "CCode" in q || "Sign" in q || "Order" in q;
const payPage = (file) => (req, res, next) => {
  if (fromHyp(req.query)) return hypReturn(payTo)(req, res, next);
  res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" });
  page(file)(req, res, next);
};
app.get("/success", payPage("site/pay-success.html"));
app.get("/fail", payPage("site/pay-fail.html"));
// the admin panel: only senior admins (SENIOR_ADMINS in routes/admin.js). Anyone signed in who isn't one, other admins too,
// gets "Not found"; the page itself checks the rest with the server
app.get(["/admin", "/admin/"], async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (user && !isSenior(user)) return notFound(req, res);
    res.set({
      "Cache-Control": "no-store", "X-Frame-Options": "DENY", "X-Robots-Tag": "noindex",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    });
    // its own files get versions like every page (routes/fresh.js), so a new admin.js reaches everyone at once
    res.type("html").send(freshPage("admin/index.html", rawPage("admin/index.html"), { guard: false }));
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
  if (/\.html?$/.test(p) && (p === "/index.html" || p.startsWith("/admin/") || p.startsWith("/site/") || p.startsWith("/club/"))) return notFound(req, res);
  next();
});
// scripts, styles and pages: the browser may keep them but must check for a newer one each time (cheap: 304 when unchanged)
// the app downloads are closed for now (APP_DOWNLOADS_OPEN in public/shared/app.js): the APK doesn't download, people go to the home page
app.use("/download", (req, res, next) => {
  if (!APP_DOWNLOADS_OPEN && (req.path === "/android" || /\.apk$/i.test(req.path))) { res.set("Cache-Control", "no-store"); return res.redirect(302, "/"); }
  next();
});
// 3D models: send the compressed copy (file.glb.gz, made next to it) when the browser takes gzip and the copy is up to date
app.get(/\.glb$/i, (req, res, next) => {
  try {
    if (!/\bgzip\b/.test(String(req.headers["accept-encoding"] || ""))) return next();
    const file = path.join(PUBLIC_DIR, decodeURIComponent(req.path));
    if (!file.startsWith(PUBLIC_DIR + path.sep) || !existsSync(file + ".gz") || statSync(file + ".gz").mtimeMs < statSync(file).mtimeMs - 10000) return next();   // (a fresh checkout writes both within seconds)
    res.set({ "Content-Type": "model/gltf-binary", "Content-Encoding": "gzip", Vary: "Accept-Encoding", "Cache-Control": "public, max-age=86400" });
    res.sendFile(file + ".gz");
  } catch (err) { next(); }
});
// a file asked for with its version (?v=…, from routes/fresh.js) never changes at that address: keep it a year. The rest: always ask
app.get("/shared/items/custom.js", customJs);   // the Item studio's items and fixes, from the database (routes/items.js)
app.use(express.static(PUBLIC_DIR, { index: false, setHeaders: (res, file) => { if (versioned(res.req)) res.set("Cache-Control", "public, max-age=31536000, immutable"); else if (/\.(js|mjs|css|html|json)$/i.test(file)) res.set("Cache-Control", "no-cache"); } }));

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
  await loadCustom();   // the Item studio's items and fixes (routes/items.js)
} catch (err) {
  console.error("✗ Could not connect to MongoDB:", err.message);
  console.error("  Check the connection string and password in .env, and that Atlas → Network Access allows your IP address.");
  process.exit(1);
}

// one server for the website and the real-time Plaza.
// The game's live connection only takes pages from this site (another website can't open it with a player's login).
const server = http.createServer(app);
const okOrigins = new Set([...LAUNCH_HOSTS, ...CLUB_HOSTS, "localhost", "127.0.0.1"]);
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
// "pm2 sendSignal SIGUSR2 jumpi" (update.sh, a minute before the restart): every game window says an update is coming
process.on("SIGUSR2", () => announceUpdate(60));
// Ctrl+C / restart: tell the game windows (they reconnect by themselves and come straight back), save everyone's needs
for (const sig of ["SIGINT", "SIGTERM"])
  process.once(sig, async () => {
    announceUpdate(0);
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
