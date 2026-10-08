import express from "express";
import { User } from "../models/User.js";
import { requireJson } from "./auth.js";
import { requireUser } from "./shop.js";
import { notifyCoins } from "../realtime/plaza.js";

/*
  The live tutorial in the game (TL block in index.html). New players get it on their first visit
  until they finish or skip it (User.tutorialAt). Finishing pays TUTORIAL_COINS once (User.tutorialPaid);
  the tour has to have run for a few minutes first, so the prize can't be grabbed with one call.
*/
export const TUTORIAL_COINS = 250;
const MIN_MS = 3 * 60 * 1000;
const started = new Map();   // user id → when the tour started (this server run)

const router = express.Router();
router.post("/tutorial/start", requireJson, requireUser, (req, res) => {
  const id = req.user._id.toString();
  if (!started.has(id)) started.set(id, Date.now());
  if (started.size > 20000) started.clear();
  res.json({ ok: true, coins: req.user.tutorialPaid ? 0 : TUTORIAL_COINS });
});
router.post("/tutorial/done", requireJson, requireUser, async (req, res, next) => {
  try {
    const u = req.user, id = u._id.toString(), skipped = req.body.skipped === true;
    if (!u.tutorialAt) await User.updateOne({ _id: u._id }, { $set: { tutorialAt: new Date() } });
    let coins = 0;
    const t0 = started.get(id);
    if (!skipped && t0 && Date.now() - t0 >= MIN_MS) {
      const r = await User.findOneAndUpdate({ _id: u._id, tutorialPaid: { $ne: true } }, { $set: { tutorialPaid: true }, $inc: { coins: TUTORIAL_COINS } }, { new: true });
      if (r) { coins = TUTORIAL_COINS; notifyCoins(id, r.coins); }
    }
    started.delete(id);
    const fresh = await User.findById(u._id);
    res.json({ ok: true, coins, user: fresh.toPublic() });
  } catch (err) {
    next(err);
  }
});
export default router;
