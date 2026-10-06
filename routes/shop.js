import express from "express";
import { User } from "../models/User.js";
import { CATALOG, ITEMS, LOOK_SLOTS, MAX_FURNITURE } from "../catalog.js";
import { currentUser, requireJson } from "./auth.js";
import { notifyLook, notifyCoins } from "../realtime/plaza.js";

const router = express.Router();

// signed-in, non-banned player or a 401/403
export async function requireUser(req, res, next) {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Please log in first." });
    if (user.isBanned()) return res.status(403).json({ error: "This account is banned." });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// small per-account limiter so the buttons can't be hammered
const recent = new Map();
function slowDown(req, res, next) {
  const key = req.user._id.toString();
  const now = Date.now();
  const list = (recent.get(key) || []).filter((t) => now - t < 10_000);
  if (list.length >= 20) return res.status(429).json({ error: "Slow down a little and try again." });
  list.push(now);
  recent.set(key, list);
  next();
}

// the price list (public)
router.get("/shop/catalog", (req, res) => {
  res.set("Cache-Control", "no-cache");
  res.json({ items: CATALOG });
});

// buy one item: price and coins are checked here, never trusted from the page
router.post("/shop/buy", requireJson, requireUser, slowDown, async (req, res, next) => {
  try {
    const item = ITEMS.get(String(req.body.item || ""));
    if (!item) return res.status(400).json({ error: "That item doesn't exist." });
    if (item.free) return res.status(409).json({ error: "Everyone already has this one!" });
    const isFurniture = item.category === "furniture";
    if (!isFurniture && req.user.ownedItems().has(item.id)) return res.status(409).json({ error: "You already own this." });
    if (isFurniture && (req.user.inventory || []).filter((id) => id.startsWith("furniture:")).length >= MAX_FURNITURE)
      return res.status(409).json({ error: `Your home is full! You can have up to ${MAX_FURNITURE} pieces of furniture.` });

    // one atomic update: only succeeds if there are enough coins (and, for clothes, the item isn't owned yet)
    const updated = await User.findOneAndUpdate(
      { _id: req.user._id, coins: { $gte: item.price }, ...(isFurniture ? {} : { inventory: { $ne: item.id } }) },
      { $inc: { coins: -item.price }, $push: { inventory: item.id } },
      { new: true }
    );
    if (!updated) {
      const fresh = await User.findById(req.user._id);
      if (fresh && !isFurniture && fresh.ownedItems().has(item.id)) return res.status(409).json({ error: "You already own this." });
      return res.status(402).json({ error: `You need ${(item.price - (fresh?.coins || 0)).toLocaleString("en-US")} more coins.` });
    }
    notifyCoins(updated._id.toString(), updated.coins);
    res.json({ user: updated.toPublic(), item });
  } catch (err) {
    next(err);
  }
});

// wear an owned item, or take one off (index -1, not for colour or eyes)
router.post("/inventory/equip", requireJson, requireUser, slowDown, async (req, res, next) => {
  try {
    const slot = String(req.body.slot || "");
    const index = Number(req.body.index);
    const info = LOOK_SLOTS[slot];
    if (!info || !Number.isInteger(index) || index < -1 || index > info.max)
      return res.status(400).json({ error: "That isn't something you can wear." });
    if (index === -1 && !info.optional) return res.status(400).json({ error: "You can't take that off." });
    if (index >= 0 && !req.user.ownedItems().has(`${slot}:${index}`))
      return res.status(403).json({ error: "You don't own that yet." });

    // keep what they were wearing in the inventory before swapping it out
    req.user.normalizeInventory();
    req.user.look = { ...req.user.publicLook(), [slot]: index };
    await req.user.save();
    notifyLook(req.user._id.toString(), req.user.publicLook());
    res.json({ user: req.user.toPublic() });
  } catch (err) {
    next(err);
  }
});

export default router;
