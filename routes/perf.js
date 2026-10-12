import express from "express";
import { PerfDay } from "../models/PerfDay.js";
import { currentUser, requireJson } from "./auth.js";

/*
  POST /api/perf: a game tab's short performance report (frames a second, stutters) for the daily report in the
  admin panel. Only logged-in players send it, at most once every 4 minutes each, and nothing about the player is
  kept: the numbers are added to that day's total for the kind of device.
*/
const router = express.Router();
const last = new Map();   // user id → when their last report counted (this server run)
const DEVICES = new Set(["web-computer", "web-phone", "android-app", "computer-app"]);
const TIERS = new Set(["low", "mid", "high"]);
const num = (v, max) => (Number.isFinite(+v) ? Math.max(0, Math.min(max, +v)) : 0);
const israelDay = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

router.post("/perf", requireJson, async (req, res, next) => {
  try {
    const user = await currentUser(req).catch(() => null);
    if (!user) return res.json({ ok: true });
    const id = user._id.toString(), t = Date.now();
    if (t - (last.get(id) || 0) < 4 * 60 * 1000) return res.json({ ok: true });
    const b = req.body || {}, device = String(b.device || ""), tier = String(b.tier || "");
    const minutes = num(b.minutes, 15);
    if (!DEVICES.has(device) || !TIERS.has(tier) || minutes < 0.5) return res.json({ ok: true });
    last.set(id, t);
    if (last.size > 50000) last.clear();
    const fps = num(b.fps, 240);
    await PerfDay.updateOne(
      { day: israelDay(), device, tier },
      { $inc: { reports: 1, minutes, fpsMinutes: fps * minutes, slowMinutes: Math.min(minutes, num(b.slowMinutes, 15)), longFrames: Math.round(num(b.longFrames, 100000)) } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
