import "dotenv/config";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
import { saveAllNeeds } from "./realtime/needs.js";
import { currentUser } from "./routes/auth.js";
import "./models/Logs.js";
import { attachPlaza } from "./realtime/plaza.js";

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
app.use("/api/admin", adminRoutes);
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));
// pages: the website is the home page, the game lives at /play
const PUBLIC_DIR = path.join(__dirname, "public");
const page = (file) => (req, res) => res.sendFile(path.join(PUBLIC_DIR, file));
app.get("/", page("site/index.html"));
app.get(["/play", "/play/"], page("index.html"));
app.get("/terms", page("site/terms.html"));
app.get("/privacy", page("site/privacy.html"));
app.get("/contact", page("site/contact.html"));
// the admin panel: signed-in players who aren't admins get "Not found"; the page itself checks the rest with the server
app.get(["/admin", "/admin/"], async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (user && user.role !== "admin") return res.status(404).type("text").send("Not found");
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
const moved = { "/admin/index.html": "/admin", "/site": "/", "/site/": "/", "/site/index.html": "/", "/index.html": "/play", "/site/terms.html": "/terms", "/site/privacy.html": "/privacy", "/site/contact.html": "/contact" };
app.get(Object.keys(moved), (req, res) => res.redirect(301, moved[req.path] + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "")));
app.use(express.static(PUBLIC_DIR, { index: false }));

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
  for (const m of ["ChatLog", "TradeLog", "DuelLog", "AdminLog", "ContactMessage"]) await mongoose.model(m).syncIndexes();
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
