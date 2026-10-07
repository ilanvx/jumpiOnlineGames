import express from "express";
import { requireJson } from "./auth.js";
import { requireUser } from "./shop.js";
import { notifyCoins } from "../realtime/plaza.js";
import { fillNeed } from "../realtime/needs.js";

const router = express.Router();

// fill one of the needs bars right up with coins (price worked out here, never trusted from the page)
const recent = new Map();
router.post("/needs/fill", requireJson, requireUser, async (req, res, next) => {
  try {
    const id = req.user._id.toString(),
      now = Date.now();
    const list = (recent.get(id) || []).filter((t) => now - t < 10_000);
    if (list.length >= 8) return res.status(429).json({ error: "Slow down a little and try again." });
    list.push(now);
    recent.set(id, list);
    const r = await fillNeed(id, String(req.body.need || ""));
    if (r.status !== 200) return res.status(r.status).json({ error: r.error, cost: r.cost });
    notifyCoins(id, r.coins);
    res.json({ coins: r.coins, cost: r.cost, need: r.need });
  } catch (err) {
    next(err);
  }
});

export default router;
