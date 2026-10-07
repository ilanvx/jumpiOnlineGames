import express from "express";
import crypto from "node:crypto";
import { User } from "../models/User.js";
import { requireJson } from "./auth.js";
import { requireUser } from "./shop.js";
import { notifyCoins, notifyPet } from "../realtime/plaza.js";
import { PET_BY_ID, MAX_PETS, petNameProblem, cleanPetName } from "../public/shared/pets.js";
import { checkName } from "../public/shared/profanity.js";

/*
  Pets: adopt one at the Pet Center (price checked here), choose which one walks with you,
  the rest stay at home. Names are seen by other players, so they go through the word filter.
*/
const router = express.Router();
export const petView = (p) => ({ id: p.id, kind: p.kind, color: p.color || 0, name: p.name });
export function petsOf(user) {
  return { pets: (user.pets || []).filter((p) => PET_BY_ID[p.kind]).map(petView), out: user.petOut || "" };
}
// the pet walking with this player (or null)
export function outPet(user) {
  const p = (user.pets || []).find((x) => x.id && x.id === user.petOut);
  return p && PET_BY_ID[p.kind] ? petView(p) : null;
}

const recent = new Map();
function slowDown(req, res, next) {
  const key = req.user._id.toString(), now = Date.now();
  const list = (recent.get(key) || []).filter((t) => now - t < 10_000);
  if (list.length >= 10) return res.status(429).json({ error: "Slow down a little and try again." });
  list.push(now);
  recent.set(key, list);
  next();
}

router.get("/pets", requireUser, (req, res) => res.json(petsOf(req.user)));

router.post("/pets/adopt", requireJson, requireUser, slowDown, async (req, res, next) => {
  try {
    const kind = PET_BY_ID[String(req.body.kind || "")];
    if (!kind) return res.status(400).json({ error: "That pet doesn't exist." });
    const color = Number(req.body.color);
    if (!Number.isInteger(color) || color < 0 || color >= kind.colors.length) return res.status(400).json({ error: "Pick a colour." });
    const name = cleanPetName(req.body.name);
    const bad = petNameProblem(name);
    if (bad) return res.status(400).json({ error: bad });
    if (!checkName(name).ok) return res.status(400).json({ error: "Let's keep Jumpi friendly! Try another name." });
    const id = crypto.randomBytes(5).toString("hex");
    // coins, the pet limit and the new pet all in one write: two clicks can't adopt twice or overspend
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, coins: { $gte: kind.price }, [`pets.${MAX_PETS - 1}`]: { $exists: false } },
      { $inc: { coins: -kind.price }, $push: { pets: { id, kind: kind.id, color, name, at: new Date() } }, $set: { petOut: id } },
      { new: true }
    );
    if (!user) {
      const fresh = await User.findById(req.user._id, { coins: 1, pets: 1 });
      if ((fresh?.pets || []).length >= MAX_PETS) return res.status(409).json({ error: `You already have ${MAX_PETS} pets. That's a full house!` });
      return res.status(402).json({ error: `You need ${kind.price} coins to adopt a ${kind.name.toLowerCase()}.` });
    }
    notifyCoins(user._id.toString(), user.coins);
    notifyPet(user._id.toString(), outPet(user));
    res.json({ ...petsOf(user), coins: user.coins, pet: petView(user.pets.find((p) => p.id === id)) });
  } catch (err) {
    next(err);
  }
});

// which pet walks with you ("" = everyone stays at home)
router.post("/pets/out", requireJson, requireUser, slowDown, async (req, res, next) => {
  try {
    const id = String(req.body.id || "");
    if (id && !(req.user.pets || []).some((p) => p.id === id)) return res.status(404).json({ error: "That pet isn't yours." });
    req.user.petOut = id;
    await req.user.save();
    notifyPet(req.user._id.toString(), outPet(req.user));
    res.json(petsOf(req.user));
  } catch (err) {
    next(err);
  }
});

export default router;
