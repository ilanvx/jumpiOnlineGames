import "dotenv/config";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
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
import adminRoutes from "./routes/admin.js";
import needsRoutes from "./routes/needs.js";
import petRoutes from "./routes/pets.js";
import storeRoutes from "./routes/store.js";
import jobRoutes from "./routes/jobs.js";
import seasonRoutes from "./routes/season.js";
import codeRoutes from "./routes/codes.js";
import tutorialRoutes from "./routes/tutorial.js";
import { STORE_OPEN } from "./public/shared/store.js";
import { LAUNCH_AT, LAUNCH_HOSTS } from "./public/shared/launch.js";
import { saveAllNeeds } from "./realtime/needs.js";
import { currentUser } from "./routes/auth.js";
import "./models/Logs.js";
import { attachPlaza, onlinePlayers } from "./realtime/plaza.js";
import { startDiscordStats } from "./discord/pip.js";
import { discordInteractions } from "./discord/interactions.js";

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

/* ---------- app ---------- */
const app = express();
app.disable("x-powered-by");
// basic safety headers on every response
app.use((req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "SAMEORIGIN" });
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
app.use("/api", needsRoutes);
app.use("/api", petRoutes);
app.use("/api", storeRoutes);
app.use("/api", jobRoutes);
app.use("/api", seasonRoutes);
app.use("/api", codeRoutes);
app.use("/api", tutorialRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));
// pages: the website is the home page, the game lives at /play
const PUBLIC_DIR = path.join(__dirname, "public");
const page = (file) => (req, res) => res.sendFile(path.join(PUBLIC_DIR, file));
app.get("/", page("site/index.html"));
// before the grand opening (LAUNCH_AT in public/shared/launch.js) the game on jumpigames.com shows the countdown page instead;
// localhost / other hosts always get the game, and admins who are already logged in can play
const gameGate = async (req, res, next) => {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().split(":")[0].toLowerCase();
  const inApp = /JumpiApp\//.test(String(req.headers["user-agent"] || ""));   // the Android app always gets the game itself
  if (LAUNCH_HOSTS.includes(host) && Date.now() < LAUNCH_AT && !inApp) {
    let admin = false;
    try { admin = (await currentUser(req))?.role === "admin"; } catch {}
    res.set("Cache-Control", "no-store");
    // "?staff" opens the game anyway so an admin can log in (players who log in there are refused by the socket)
    // "?soon" shows the countdown page to anyone (so an admin can see it too)
    if ((!admin && !("staff" in req.query)) || "soon" in req.query) return res.sendFile(path.join(PUBLIC_DIR, "site", "game-soon.html"));
  }
  res.set("Cache-Control", "no-cache");   // the Android app opens this page: always check for the newest version
  page("index.html")(req, res, next);
};
app.get(["/play", "/play/"], gameGate);
app.get(["/studio", "/studio/"], gameGate);   // image studio (pictures made in code, see STUDIO_SCENES in index.html)
app.get("/terms", page("site/terms.html"));
app.get("/privacy", page("site/privacy.html"));
app.get("/contact", page("site/contact.html"));
app.get("/trailer", page("site/trailer.html"));
// the Android app: the APK built on GitHub (branch android-build), copied to public/download/jumpi-games.apk
app.get("/download/android", (req, res, next) => {
  const f = path.join(PUBLIC_DIR, "download", "jumpi-games.apk");
  if (!existsSync(f)) return next();
  res.set({ "Content-Type": "application/vnd.android.package-archive", "Content-Disposition": 'attachment; filename="Jumpi Games.apk"', "Cache-Control": "no-cache" });
  res.sendFile(f);
});
app.get(["/forgot-password", "/reset-password"], (req, res) => { res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }); page("site/reset.html")(req, res); });   // forgot password (routes/auth.js /forgot, /reset)   // the trailer video (public/site/trailer/)
// while the store is closed (STORE_OPEN in public/shared/store.js) /store shows the "under renovation" page
app.get("/store", (req, res, next) => page(STORE_OPEN ? "site/store.html" : "site/store-soon.html")(req, res, next));
app.get("/site/store.html", (req, res, next) => (STORE_OPEN ? next() : res.redirect(302, "/store")));
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
app.get(Object.keys(moved), (req, res) => res.redirect(301, moved[req.path] + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "")));
app.use(express.static(PUBLIC_DIR, { index: false }));

// anything else: the "Jumpi got lost" page for people, a short text for files and scripts
const notFound = (req, res) => {
  const wantsPage = (req.method === "GET" || req.method === "HEAD") && String(req.headers.accept || "").includes("text/html");
  if (wantsPage) return res.status(404).sendFile(path.join(PUBLIC_DIR, "site", "404.html"));
  res.status(404).type("text").send("Not found");
};
app.use(notFound);

// last-resort error handler: log the details, show the player something friendly
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Something went wrong on our side. Please try again." });
});

/* ---------- connect, then listen ---------- */
mongoose.set("strictQuery", true);
try {
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB, serverSelectionTimeoutMS: 10000 });
  await mongoose.model("User").syncIndexes();
  for (const m of ["ChatLog", "TradeLog", "DuelLog", "AdminLog", "ContactMessage", "Order"]) await mongoose.model(m).syncIndexes();
  await mongoose.model("Message").syncIndexes(); // makes sure username/email are unique in the database
  console.log(`✓ Connected to MongoDB (database "${MONGODB_DB}")`);
} catch (err) {
  console.error("✗ Could not connect to MongoDB:", err.message);
  console.error("  Check the connection string and password in .env, and that Atlas → Network Access allows your IP address.");
  process.exit(1);
}

// one server for the website and the real-time Plaza
const server = http.createServer(app);
attachPlaza(new Server(server));
// Ctrl+C: save everyone's needs before stopping
for (const sig of ["SIGINT", "SIGTERM"])
  process.once(sig, async () => {
    await Promise.race([saveAllNeeds(), new Promise((r) => setTimeout(r, 3000))]);
    process.exit(0);
  });
server.listen(PORT, () => console.log(`✓ Jumpi is running: website http://localhost:${PORT}  ·  game http://localhost:${PORT}/play`));
// Pip in the Discord server: the "🎮 Playing now" counter (players you can see, not invisible admins)
startDiscordStats(() => onlinePlayers(false).length);
