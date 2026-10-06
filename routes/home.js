import express from "express";
import { User } from "../models/User.js";
import { requireJson } from "./auth.js";
import { requireUser } from "./shop.js";
import { FURNITURE_COUNT, placeProblem } from "../catalog.js";
import { notifyHome } from "../realtime/plaza.js";

/*
  The player's home. Only furniture the player owns can be placed (doubles count),
  everything has to stand inside the room, and anyone can look at anyone's home.
*/
const router = express.Router();
export const HOME = { walls: 8, floors: 6, halfW: 7.4, halfD: 5.6, maxItems: 60 };

export function homeView(user) {
  const h = user.home || {};
  return { wall: h.wall || 0, floor: h.floor || 0, items: (h.items || []).map(({ f, x, z, r }) => ({ f, x, z, r })) };
}
// drop placed pieces the player doesn't own any more (after a trade, for example)
export function pruneHome(user) {
  if (!user.home) return;
  const left = new Map();
  for (const id of user.inventory || []) if (id.startsWith("furniture:")) left.set(id, (left.get(id) || 0) + 1);
  user.home.items = (user.home.items || []).filter((it) => {
    const key = "furniture:" + it.f, n = left.get(key) || 0;
    if (n <= 0) return false;
    left.set(key, n - 1);
    return true;
  });
  user.markModified("home");
}

router.get("/home", requireUser, (req, res) => res.json({ home: homeView(req.user), owner: req.user.username, mine: true }));

router.get("/home/of/:username", requireUser, async (req, res, next) => {
  try {
    const name = String(req.params.username || "").toLowerCase().slice(0, 32);
    const user = await User.findOne({ usernameLower: name });
    if (!user) return res.status(404).json({ error: "That player doesn't exist." });
    res.json({ home: homeView(user), owner: user.username, mine: user._id.equals(req.user._id) });
  } catch (err) {
    next(err);
  }
});

const recent = new Map();
router.post("/home", requireJson, requireUser, async (req, res, next) => {
  try {
    const key = req.user._id.toString(), now = Date.now();
    const list = (recent.get(key) || []).filter((t) => now - t < 10_000);
    if (list.length >= 30) return res.status(429).json({ error: "Slow down a little." });
    list.push(now);
    recent.set(key, list);

    const wall = Number(req.body.wall), floor = Number(req.body.floor);
    if (!Number.isInteger(wall) || wall < 0 || wall >= HOME.walls) return res.status(400).json({ error: "Pick a wallpaper." });
    if (!Number.isInteger(floor) || floor < 0 || floor >= HOME.floors) return res.status(400).json({ error: "Pick a floor." });
    const raw = Array.isArray(req.body.items) ? req.body.items : [];
    if (raw.length > HOME.maxItems) return res.status(400).json({ error: "That's too much furniture for one room." });
    const owned = new Map();
    for (const id of req.user.inventory || []) if (id.startsWith("furniture:")) owned.set(id, (owned.get(id) || 0) + 1);
    const used = new Map(), items = [];
    for (const it of raw) {
      const f = Number(it?.f), x = Number(it?.x), z = Number(it?.z), r = Number(it?.r);
      if (!Number.isInteger(f) || f < 0 || f >= FURNITURE_COUNT) return res.status(400).json({ error: "Unknown furniture." });
      if (![x, z].every(Number.isFinite) || Math.abs(x) > HOME.halfW || Math.abs(z) > HOME.halfD) return res.status(400).json({ error: "Keep the furniture inside the room." });
      if (!Number.isInteger(r) || r < 0 || r > 3) return res.status(400).json({ error: "Bad rotation." });
      const k = "furniture:" + f, n = (used.get(k) || 0) + 1;
      if (n > (owned.get(k) || 0)) return res.status(403).json({ error: "You can only place furniture you own." });
      used.set(k, n);
      const piece = { f, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, r };
      const problem = placeProblem(piece, items);
      if (problem) return res.status(400).json({ error: problem });
      items.push(piece);
    }
    req.user.home = { wall, floor, items };
    req.user.markModified("home");
    await req.user.save();
    res.json({ home: homeView(req.user) });
    notifyHome(req.user.usernameLower, homeView(req.user));
  } catch (err) {
    next(err);
  }
});

export default router;
