import express from "express";
import mongoose from "mongoose";
import { Drawing } from "../models/Drawing.js";
import { requireUser } from "./shop.js";
import { clubAge } from "./club.js";

/*
  The Jumpi Club colouring book (public/club/draw): every player keeps their own pictures. Just for fun: no coins.
  - GET  /api/club/drawings              my pictures (newest first)
  - GET  /api/club/drawings/:id.png      one of MY pictures (nobody else's: they're never shown to other players)
  - POST /api/club/drawings?page=…&id=…   save (image/png body): a new picture, or my picture with that id again
  - POST /api/club/drawings/:id/delete
*/
const router = express.Router();
const MAX = 60;
const PAGE = /^[a-z0-9_-]{1,40}$/;
const okId = (v) => mongoose.isValidObjectId(String(v || ""));
const isPng = (b) => Buffer.isBuffer(b) && b.length > 100 && b[0] === 0x89 && b.toString("latin1", 1, 4) === "PNG" && b.toString("latin1", 12, 16) === "IHDR";
const view = (d) => ({ id: String(d._id), page: d.page, at: d.at.getTime(), updatedAt: (d.updatedAt || d.at).getTime() });

router.get("/club/drawings", requireUser, clubAge, async (req, res, next) => {
  try {
    const list = await Drawing.find({ user: req.user._id }).select("page at updatedAt").sort({ updatedAt: -1 }).limit(MAX).lean();
    res.set("Cache-Control", "no-store");
    res.json({ drawings: list.map(view), max: MAX });
  } catch (err) { next(err); }
});
router.get("/club/drawings/:id.png", requireUser, clubAge, async (req, res, next) => {
  try {
    if (!okId(req.params.id)) return res.status(404).end();
    const d = await Drawing.findOne({ _id: req.params.id, user: req.user._id }).lean();
    if (!d) return res.status(404).end();
    res.set("Cache-Control", "private, no-cache");
    res.type("png").send(Buffer.from(d.png.buffer || d.png));
  } catch (err) { next(err); }
});
const recent = new Map();
router.post("/club/drawings", express.raw({ type: "image/png", limit: "3mb" }), requireUser, clubAge, async (req, res, next) => {
  try {
    const me = req.user, b = req.body, page = String(req.query.page || "blank");
    if (!isPng(b)) return res.status(400).json({ error: "That isn't a picture." });
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
    if (w > 2400 || h > 2400) return res.status(400).json({ error: "That picture is too big." });
    if (!PAGE.test(page)) return res.status(400).json({ error: "Unknown page." });
    const now = Date.now(), t = (recent.get(String(me._id)) || []).filter((x) => now - x < 60_000);
    if (t.length >= 20) return res.status(429).json({ error: "Slow down a little." });
    t.push(now); recent.set(String(me._id), t);
    if (req.query.id) {
      if (!okId(req.query.id)) return res.status(404).json({ error: "There's no such picture." });
      const d = await Drawing.findOneAndUpdate({ _id: req.query.id, user: me._id }, { $set: { png: b, page, updatedAt: new Date() } }, { new: true }).select("page at updatedAt").lean();
      if (!d) return res.status(404).json({ error: "There's no such picture." });
      return res.json({ drawing: view(d) });
    }
    if ((await Drawing.countDocuments({ user: me._id })) >= MAX) return res.status(400).json({ error: `You have ${MAX} pictures. Delete one to save a new one.`, code: "full" });
    const d = await Drawing.create({ user: me._id, page, png: b });
    res.json({ drawing: view(d) });
  } catch (err) { next(err); }
});
router.post("/club/drawings/:id/delete", requireUser, clubAge, async (req, res, next) => {
  try {
    if (!okId(req.params.id)) return res.status(404).json({ error: "There's no such picture." });
    await Drawing.deleteOne({ _id: req.params.id, user: req.user._id });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
