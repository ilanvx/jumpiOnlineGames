import express from "express";
import crypto from "node:crypto";
import { User } from "../models/User.js";
import { requireJson } from "./auth.js";
import { requireUser } from "./shop.js";
import { notifyCoins } from "../realtime/plaza.js";
import { addSeasonXp } from "./season.js";
import { SEASON_XP } from "../public/shared/season.js";
import { JOBS, JOB_LIST, SHIFT_SECONDS, MIN_SECONDS_PER_ORDER, JOB_DAILY_CAP, jobView, jobLevel, maxLevel, payPerOrder, tipFor, JOB_GIFTS, shiftSecs } from "../public/shared/jobs.js";

/*
  Jobs: get hired, then work shifts (the game runs the restaurant; the server decides the pay).
  A shift has to be started here first; at the end the page says how many orders it served and how many
  were fast. Both are checked against the time the shift really took, and the pay is capped per day.
*/
const router = express.Router();
const TZ = "Asia/Jerusalem";
const dayKey = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
// matches a field that still has its empty value or doesn't exist yet (older accounts)
const sameAs = (v, empty) => (v === empty || v == null ? { $in: [empty, null] } : v);
const capOf = (user) => JOB_DAILY_CAP * (user.isMember() ? 2 : 1);
const todayEarned = (user) => (user.jobsDay === dayKey() ? user.jobsEarned || 0 : 0);
const recOf = (user, job) => (user.jobs && (user.jobs.get ? user.jobs.get(job) : user.jobs[job])) || null;
const view = (user) => ({
  jobs: JOB_LIST.map((J) => jobView(J.id, recOf(user, J.id))),
  todayEarned: todayEarned(user),
  dailyCap: capOf(user),
});

// one shift at a time per player, kept in memory
const shifts = new Map();
setInterval(() => {
  const old = Date.now() - (Math.max(...JOB_LIST.map((J) => shiftSecs(J.id))) + 600) * 1000;
  for (const [id, s] of shifts) if (s.t0 < old) shifts.delete(id);
}, 60_000).unref?.();

router.get("/jobs", requireUser, (req, res) => res.json(view(req.user)));

router.post("/jobs/hire", requireJson, requireUser, async (req, res, next) => {
  try {
    const job = String(req.body?.job || "");
    if (!JOBS[job]) return res.status(400).json({ error: "Unknown job." });
    if (recOf(req.user, job)?.hired) return res.json({ ...view(req.user), hired: false });
    const updated = await User.findByIdAndUpdate(req.user._id, { $set: { [`jobs.${job}.hired`]: true, [`jobs.${job}.since`]: new Date() } }, { new: true });
    res.json({ ...view(updated), hired: true });
  } catch (err) {
    next(err);
  }
});

router.post("/jobs/start", requireJson, requireUser, (req, res) => {
  const job = String(req.body?.job || "");
  if (!JOBS[job]) return res.status(400).json({ error: "Unknown job." });
  const rec = recOf(req.user, job);
  if (!rec?.hired) return res.status(403).json({ error: "You need to get the job first." });
  const uid = req.user._id.toString();
  for (const [id, s] of shifts) if (s.userId === uid) shifts.delete(id);   // a new shift replaces an old unfinished one
  const id = crypto.randomUUID();
  shifts.set(id, { id, userId: uid, job, t0: Date.now() });
  const level = jobLevel(job, rec.xp || 0);
  res.json({ shiftId: id, job, seconds: shiftSecs(job), level, pay: payPerOrder(level, job), tip: tipFor(level, job), todayEarned: todayEarned(req.user), dailyCap: capOf(req.user) });
});

router.post("/jobs/finish", requireJson, requireUser, async (req, res, next) => {
  try {
    const s = shifts.get(String(req.body?.shiftId || ""));
    if (!s || s.userId !== req.user._id.toString()) return res.status(404).json({ error: "That shift is over." });
    shifts.delete(s.id);   // before any await: finishing twice pays once
    const secs = (Date.now() - s.t0) / 1000;
    const most = Math.max(0, Math.floor(Math.min(secs, shiftSecs(s.job) + 5) / (JOBS[s.job].minSecs || MIN_SECONDS_PER_ORDER)));
    const served = Math.max(0, Math.min(most, Math.floor(Number(req.body?.served) || 0)));
    const fast = Math.max(0, Math.min(served, Math.floor(Number(req.body?.fast) || 0)));
    for (let attempt = 0; attempt < 3; attempt++) {
      const user = await User.findById(req.user._id);
      if (!user) return res.status(401).json({ error: "Please log in first." });
      const rec = recOf(user, s.job) || {};
      const level = jobLevel(s.job, rec.xp || 0);
      const earnedToday = todayEarned(user), cap = capOf(user);
      const pay = served * payPerOrder(level, s.job), tips = fast * tipFor(level, s.job);
      const coins = Math.max(0, Math.min(pay + tips, cap - earnedToday));
      const updated = await User.findOneAndUpdate(
        { _id: user._id, jobsDay: sameAs(user.jobsDay, ""), jobsEarned: sameAs(user.jobsEarned, 0) },
        {
          $set: { jobsDay: dayKey(), jobsEarned: earnedToday + coins },
          $inc: { coins, [`jobs.${s.job}.xp`]: served, [`jobs.${s.job}.served`]: served, [`jobs.${s.job}.shifts`]: 1, [`jobs.${s.job}.earned`]: coins },
        },
        { new: true }
      );
      if (!updated) continue;
      if (coins) notifyCoins(updated._id.toString(), updated.coins);
      if (served) addSeasonXp(updated._id, served * SEASON_XP.jobTask);
      let after = jobView(s.job, recOf(updated, s.job)), gift = null, owner = updated;
      // top level reached: every piece of the job's uniform goes into the inventory as a gift (only once)
      const missing = after.level >= maxLevel(s.job) ? (JOB_GIFTS[s.job] || []).filter((id) => !(updated.inventory || []).includes(id)) : [];
      if (missing.length) {
        const got = await User.findOneAndUpdate({ _id: updated._id, inventory: { $nin: missing } }, { $push: { inventory: { $each: missing } } }, { new: true });
        if (got) { gift = missing; owner = got; }
      }
      return res.json({
        served, fast, pay, tips, coins, capped: coins < pay + tips,
        total: updated.coins, levelBefore: level, job: after, levelUp: after.level > level, gift, inventory: owner.toPublic().inventory, ...view(updated),
      });
    }
    res.status(409).json({ error: "Something got in the way. Try again." });
  } catch (err) {
    next(err);
  }
});

export default router;
