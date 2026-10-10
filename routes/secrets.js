import express from "express";
import { User } from "../models/User.js";
import { requireJson } from "./auth.js";
import { requireUser } from "./shop.js";
import { notifyCoins, worldPos } from "../realtime/plaza.js";
import { OUTFITS } from "../public/shared/outfits.js";
import { CAVE } from "../public/shared/city-layout.js";

/*
  Secret places of the big world. The treasure chest in the secret cave (behind the waterfall in Whisper Hills)
  gives coins and the Crystal crown, once per player. The server checks that the player really stands next to the
  chest (their live position in the Plaza room), so it can't be claimed from anywhere else.
*/
const router = express.Router();
export const CAVE_COINS = 1500;
const CHEST_REACH = 5;
const CROWN = (() => { const i = OUTFITS.hat.findIndex((o) => o.gift === "cave"); return i >= 0 ? `hat:${i}` : null; })();

router.post("/secret/cave", requireJson, requireUser, async (req, res, next) => {
  try {
    const pos = worldPos(req.user._id.toString());
    if (!pos || Math.hypot(pos.x - CAVE.chest[0], pos.z - CAVE.chest[1]) > CHEST_REACH) return res.status(400).json({ error: "Walk up to the treasure chest first." });
    if ((req.user.secrets || []).includes("cave")) return res.json({ already: true, user: req.user.toPublic() });
    const hasCrown = CROWN && (req.user.inventory || []).includes(CROWN);
    const update = { $addToSet: { secrets: "cave" }, $inc: { coins: CAVE_COINS } };
    if (CROWN && !hasCrown) update.$push = { inventory: CROWN };
    // only one claim wins if two arrive together
    const ok = await User.findOneAndUpdate({ _id: req.user._id, secrets: { $ne: "cave" } }, update, { new: true });
    if (!ok) return res.json({ already: true, user: req.user.toPublic() });
    notifyCoins(ok._id.toString(), ok.coins);
    res.json({ coins: CAVE_COINS, item: CROWN && !hasCrown ? CROWN : null, user: ok.toPublic() });
  } catch (err) {
    next(err);
  }
});

export default router;
