import express from "express";
import { User } from "../models/User.js";
import { Code, CodeUse, normCode } from "../models/Code.js";
import { requireJson } from "./auth.js";
import { requireUser } from "./shop.js";
import { notifyCoins } from "../realtime/plaza.js";

/*
  Players use gift codes here (the sign in the game's start screen). Codes are made in the admin panel.
  Only coins, once per player. Guessing is slowed down: 8 tries per 10 minutes per player and per address.
*/
const router = express.Router();
const tries = new Map();
function canTry(key) {
  const now = Date.now(), list = (tries.get(key) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (list.length >= 8) return false;
  list.push(now); tries.set(key, list);
  if (tries.size > 5000) tries.clear();
  return true;
}

router.post("/codes/redeem", requireJson, requireUser, async (req, res, next) => {
  try {
    const u = req.user, text = normCode(req.body.code);
    if (text.length < 3) return res.status(400).json({ error: "Type a code first." });
    if (!canTry("u" + u._id) || !canTry("ip" + req.ip)) return res.status(429).json({ error: "Too many tries. Wait a few minutes." });
    const code = await Code.findOne({ code: text });
    if (!code || !code.active) return res.status(404).json({ error: "Hmm, that code doesn't exist." });
    if (code.expiresAt && code.expiresAt.getTime() < Date.now()) return res.status(410).json({ error: "This code has ended." });
    if (code.maxUses && code.uses >= code.maxUses) return res.status(410).json({ error: "This code has been used up." });
    // once per player: the unique index refuses a second row
    try {
      await CodeUse.create({ codeId: code._id, code: code.code, userId: u._id, username: u.username, coins: code.coins });
    } catch (err) {
      if (err?.code === 11000) return res.status(409).json({ error: "You already used this code." });
      throw err;
    }
    // count the use, but only if there's still room (two players at the same moment can't go over the limit)
    const room = code.maxUses ? { $expr: { $lt: ["$uses", "$maxUses"] } } : {};
    const ok = await Code.findOneAndUpdate({ _id: code._id, active: true, ...room }, { $inc: { uses: 1 } });
    if (!ok) {
      await CodeUse.deleteOne({ codeId: code._id, userId: u._id });
      return res.status(410).json({ error: "This code has been used up." });
    }
    const user = await User.findByIdAndUpdate(u._id, { $inc: { coins: code.coins } }, { new: true });
    notifyCoins(user._id.toString(), user.coins);
    res.json({ ok: true, coins: code.coins, total: user.coins, user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

export default router;
