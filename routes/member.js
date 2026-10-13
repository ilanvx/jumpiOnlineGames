import express from "express";
import { User } from "../models/User.js";
import { ITEMS, monthlyGift } from "../catalog.js";
import { monthKey } from "../public/shared/store.js";
import { requireJson } from "./auth.js";
import { requireUser } from "./shop.js";
import { notifyLook, notifyCoins } from "../realtime/plaza.js";

/*
  Members' extras that need the server:
  - the monthly gift: once each calendar month a member gets that month's members-only item (to keep, also after the
    membership ends); one they already own turns into coins instead.
  - a membership that just ran out: the members' things come off the character for everyone (they stay in the inventory).
*/
const router = express.Router();
const OWNED_COINS = 500;

router.get("/member/monthly", requireUser, (req, res) => {
  const key = monthKey(), id = monthlyGift(key), it = ITEMS.get(id);
  res.json({ month: key, item: id, name: it?.name || "", claimed: req.user.memberGift === key, member: req.user.isMember() });
});

router.post("/member/monthly", requireJson, requireUser, async (req, res, next) => {
  try {
    if (!req.user.isMember()) return res.status(403).json({ error: "The monthly gift is for members.", code: "members" });
    const key = monthKey(), id = monthlyGift(key), it = ITEMS.get(id);
    if (!it) return res.status(404).json({ error: "No gift this month." });
    if (req.user.memberGift === key) return res.status(409).json({ error: "You already got this month's gift.", code: "claimed" });
    const owned = req.user.ownedItems().has(id);
    // one write: only the first claim of the month goes through
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, memberGift: { $ne: key } },
      owned ? { $set: { memberGift: key }, $inc: { coins: OWNED_COINS, __v: 1 } } : { $set: { memberGift: key }, $push: { inventory: id }, $inc: { __v: 1 } },
      { new: true }
    );
    if (!user) return res.status(409).json({ error: "You already got this month's gift.", code: "claimed" });
    if (owned) notifyCoins(user._id.toString(), user.coins);
    res.json({ item: owned ? null : id, name: it.name, coins: owned ? OWNED_COINS : 0, user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

// the game noticed the membership is over: save the look without the members' things and tell everyone
router.post("/member/ended", requireJson, requireUser, async (req, res, next) => {
  try {
    const u = req.user;
    if (u.isMember()) return res.json({ user: u.toPublic() });
    const raw = u.rawLook(), pub = u.publicLook();
    if (Object.keys(raw).some((k) => raw[k] !== pub[k])) {
      u.normalizeInventory();   // what they wore stays in the inventory
      u.look = pub;
      try { await u.save(); } catch (err) { if (err.name !== "VersionError") throw err; }
      notifyLook(u._id.toString(), pub);
    }
    res.json({ user: u.toPublic() });
  } catch (err) {
    next(err);
  }
});

export default router;
