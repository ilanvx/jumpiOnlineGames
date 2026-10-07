import express from "express";
import { User } from "../models/User.js";
import { requireJson } from "./auth.js";
import { requireUser } from "./shop.js";
import { notifyCoins, notifyUser } from "../realtime/plaza.js";
import { TIERS, TIER_XP, SEASON_DAY_XP, currentSeason, seasonRewards, tierOf, WHEEL, WHEEL_MS, wheelItem } from "../public/shared/season.js";

/*
  The Season (free 30-tier track) and the daily Lucky Wheel (public/shared/season.js).
  The server keeps the XP, decides every prize and spin, and only lets each tier be claimed once.
*/
const router = express.Router();
const TZ = "Asia/Jerusalem";
const dayKey = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

// this player's record for the season running now (a new season starts from zero)
function seasonRec(user, S = currentSeason()) {
  const r = user.season || {};
  return r.id === S.id ? { id: S.id, xp: r.xp || 0, claimed: Array.isArray(r.claimed) ? r.claimed : [] } : { id: S.id, xp: 0, claimed: [] };
}
const dayXpOf = (user) => (user.seasonDay === dayKey() ? user.seasonDayXp || 0 : 0);

// add season XP (mini-games, jobs, daily gift, wheel). capped: counts toward the daily limit. Never throws.
export async function addSeasonXp(userId, amount, { capped = true } = {}) {
  try {
    amount = Math.max(0, Math.floor(amount));
    if (!amount) return null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const user = await User.findById(userId);
      if (!user) return null;
      const S = currentSeason(), rec = seasonRec(user, S), day = dayKey(), dayXp = dayXpOf(user);
      const gain = capped ? Math.max(0, Math.min(amount, SEASON_DAY_XP - dayXp)) : amount;
      if (!gain) return { gained: 0, xp: rec.xp, capped: true };
      const before = tierOf(rec.xp), xp = Math.min(rec.xp + gain, TIERS * TIER_XP + 999);
      const ok = await User.updateOne(
        { _id: user._id, __v: user.__v },
        { $set: { season: { id: S.id, xp, claimed: rec.claimed }, seasonDay: day, seasonDayXp: capped ? dayXp + gain : dayXp }, $inc: { __v: 1 } }
      );
      if (!ok.modifiedCount) continue;
      const out = { gained: gain, xp, tier: tierOf(xp), tierUp: tierOf(xp) > before };
      notifyUser(user._id.toString(), "season:xp", out);
      return out;
    }
  } catch (err) {
    console.error("season xp", err.message);
  }
  return null;
}

function view(user) {
  const S = currentSeason(), rec = seasonRec(user, S);
  return {
    season: { id: S.id, name: S.name, about: S.about, colors: S.colors, endsAt: S.endsAt, bonus: S.bonus },
    xp: rec.xp, tier: tierOf(rec.xp), claimed: rec.claimed, rewards: seasonRewards(S),
    tiers: TIERS, tierXp: TIER_XP, dayXp: dayXpOf(user), dayCap: SEASON_DAY_XP,
  };
}

router.get("/season", requireUser, (req, res) => res.json(view(req.user)));

router.post("/season/claim", requireJson, requireUser, async (req, res, next) => {
  try {
    const tier = Number(req.body?.tier);
    const S = currentSeason(), rec = seasonRec(req.user, S);
    if (!Number.isInteger(tier) || tier < 1 || tier > TIERS) return res.status(400).json({ error: "Unknown tier." });
    if (tier > tierOf(rec.xp)) return res.status(403).json({ error: "Keep playing to reach this tier!" });
    if (rec.claimed.includes(tier)) return res.status(409).json({ error: "You already took this prize." });
    const prize = seasonRewards(S)[tier - 1];
    const owns = prize.item && (req.user.inventory || []).includes(prize.item);
    const coins = prize.coins || (owns ? 200 : 0);   // already have the item (shouldn't happen): coins instead
    const update = { $set: { season: { id: S.id, xp: rec.xp, claimed: [...rec.claimed, tier] } }, $inc: { coins, __v: 1 } };
    if (prize.item && !owns) update.$push = { inventory: prize.item };
    const ok = await User.findOneAndUpdate({ _id: req.user._id, __v: req.user.__v }, update, { new: true });
    if (!ok) return res.status(409).json({ error: "Something got in the way. Try again." });
    if (coins) notifyCoins(ok._id.toString(), ok.coins);
    res.json({ ...view(ok), prize: { tier, coins, item: prize.item && !owns ? prize.item : null }, user: ok.toPublic() });
  } catch (err) {
    next(err);
  }
});

/* ---------- Lucky Wheel ---------- */
const nextSpinAt = (user) => (user.wheelAt ? new Date(user.wheelAt).getTime() + WHEEL_MS : 0);
router.get("/wheel", requireUser, (req, res) => res.json({ nextAt: nextSpinAt(req.user), now: Date.now() }));

router.post("/wheel/spin", requireJson, requireUser, async (req, res, next) => {
  try {
    const now = Date.now();
    if (nextSpinAt(req.user) > now) return res.status(429).json({ error: "Your next free spin isn't ready yet.", nextAt: nextSpinAt(req.user) });
    // pick the slice here: the page only animates it
    const total = WHEEL.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * total, slice = 0;
    for (; slice < WHEEL.length - 1; slice++) { r -= WHEEL[slice].weight; if (r < 0) break; }
    const W = WHEEL[slice], item = W.kind === "item" ? wheelItem() : null;
    const hasItem = item && (req.user.inventory || []).includes(item);
    const coins = W.kind === "coins" ? W.amount : W.kind === "item" && (hasItem || !item) ? 500 : 0;
    const update = { $set: { wheelAt: new Date(now) }, $inc: { coins } };
    if (item && !hasItem) update.$push = { inventory: item };
    // only one spin wins if two arrive together ({wheelAt: null} also matches accounts that never spun)
    const filter = { _id: req.user._id, wheelAt: req.user.wheelAt || null };
    const ok = await User.findOneAndUpdate(filter, update, { new: true });
    if (!ok) return res.status(429).json({ error: "You already spun today!" });
    if (coins) notifyCoins(ok._id.toString(), ok.coins);
    let xp = null;
    if (W.kind === "xp") xp = await addSeasonXp(ok._id, W.amount, { capped: false });
    else await addSeasonXp(ok._id, 20);
    res.json({ slice, prize: { kind: W.kind, coins, xp: W.kind === "xp" ? W.amount : 0, item: item && !hasItem ? item : null }, nextAt: now + WHEEL_MS, user: (await User.findById(ok._id)).toPublic() });
  } catch (err) {
    next(err);
  }
});

export default router;
