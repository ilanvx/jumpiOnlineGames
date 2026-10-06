import express from "express";
import crypto from "node:crypto";
import { PollVote } from "../models/PollVote.js";
import { currentUser, requireJson } from "./auth.js";
import { weekInfo, pollFor } from "../polls.js";

/* The weekly poll on the website: anyone can vote once a week (players by account, visitors by a browser cookie). */
const router = express.Router();
const VOTER_COOKIE = "jumpi_voter";

async function voterOf(req, res, create) {
  const user = await currentUser(req).catch(() => null);
  if (user && !user.isBanned()) return "u:" + user._id.toString();
  let id = req.cookies?.[VOTER_COOKIE];
  if (!/^[a-f0-9]{32}$/.test(id || "")) {
    if (!create) return null;
    id = crypto.randomBytes(16).toString("hex");
    res.cookie(VOTER_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: req.secure, maxAge: 365 * 864e5 });
  }
  return "a:" + id;
}

// counts are cached for a few seconds so a busy page doesn't hammer the database
let cache = { key: "", at: 0, counts: null };
async function countsFor(key, n) {
  if (cache.key === key && Date.now() - cache.at < 5000) return cache.counts;
  const rows = await PollVote.aggregate([{ $match: { week: key } }, { $group: { _id: "$option", n: { $sum: 1 } } }]);
  const counts = Array(n).fill(0);
  for (const r of rows) if (r._id >= 0 && r._id < n) counts[r._id] = r.n;
  cache = { key, at: Date.now(), counts };
  return counts;
}

async function view(req, res, myVote) {
  const info = weekInfo(), poll = pollFor(info);
  if (myVote === undefined) {
    const voter = await voterOf(req, res, false);
    const v = voter ? await PollVote.findOne({ week: info.key, voter }).select("option") : null;
    myVote = v ? v.option : null;
  }
  const counts = await countsFor(info.key, poll.options.length);
  return { week: info.key, endsAt: info.endsAt, question: poll.question, options: poll.options.map(([label, icon]) => ({ label, icon })), counts, total: counts.reduce((a, b) => a + b, 0), myVote };
}

router.get("/poll", async (req, res, next) => {
  try { res.json(await view(req, res)); } catch (err) { next(err); }
});

const recent = new Map();
router.post("/poll/vote", requireJson, async (req, res, next) => {
  try {
    const ip = req.ip || "?", now = Date.now(), list = (recent.get(ip) || []).filter((t) => now - t < 60_000);
    if (list.length >= 10) return res.status(429).json({ error: "Slow down a little and try again." });
    list.push(now); recent.set(ip, list);
    const info = weekInfo(), poll = pollFor(info), option = Number(req.body.option);
    if (!Number.isInteger(option) || option < 0 || option >= poll.options.length) return res.status(400).json({ error: "Pick one of the answers." });
    const voter = await voterOf(req, res, true);
    try {
      await PollVote.create({ week: info.key, option, voter });
    } catch (err) {
      if (err.code !== 11000) throw err;
      const had = await PollVote.findOne({ week: info.key, voter }).select("option");
      return res.status(409).json({ error: "You already voted this week! Come back next week for a new poll.", poll: await view(req, res, had ? had.option : null) });
    }
    cache.at = 0;
    res.json({ ok: true, poll: await view(req, res, option) });
  } catch (err) {
    next(err);
  }
});

export default router;
