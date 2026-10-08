import crypto from "crypto";
import { User } from "../models/User.js";
import { FOOD_SLOTS, foodOf, bitesOf, biteNeeds } from "../public/shared/food.js";
import { bumpNeeds } from "./needs.js";

/*
  The food bar (User.snacks): up to FOOD_SLOTS things to eat or drink, each { id, k, i, b }
  (k = menu, i = item number, b = bites left). The page only asks; every change is checked here
  and done in one database write (coins and the free slot are checked in the same write).
*/
const tidy = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .filter((s) => s && typeof s.id === "string" && foodOf(s.k, s.i) && s.b > 0)
    .slice(0, FOOD_SLOTS)
    .map((s) => ({ id: s.id, k: s.k, i: s.i, b: s.b, n: bitesOf(foodOf(s.k, s.i)) }));

export async function foodBag(userId) {
  const u = await User.findById(userId, { snacks: 1 }).lean();
  return tidy(u?.snacks);
}

// get something (price 0 = free). Refused when all the slots are full or there aren't enough coins.
export async function addFood(userId, k, i, price) {
  const it = foodOf(k, i);
  if (!it) return { error: "That isn't on the menu." };
  // the leftovers of finished food are cleaned out first, so they don't take a slot
  await User.updateOne({ _id: userId }, { $pull: { snacks: { b: { $lte: 0 } } } });
  const snack = { id: crypto.randomBytes(6).toString("hex"), k, i, b: bitesOf(it) };
  const q = { _id: userId, $expr: { $lt: [{ $size: { $ifNull: ["$snacks", []] } }, FOOD_SLOTS] } };
  const upd = { $push: { snacks: snack } };
  if (price > 0) {
    q.coins = { $gte: price };
    upd.$inc = { coins: -price };
  }
  const u = await User.findOneAndUpdate(q, upd, { new: true, projection: { snacks: 1, coins: 1 } }).lean();
  if (!u) {
    const cur = await User.findById(userId, { snacks: 1 }).lean();
    if (tidy(cur?.snacks).length >= FOOD_SLOTS) return { error: "Your food bar is full! Finish something first, or throw one away." };
    return { error: `You need ${price} coins for that.` };
  }
  return { ok: true, coins: u.coins, bag: tidy(u.snacks), id: snack.id };
}

// one bite / one sip: takes one off and gives that share of the needs
export async function biteFood(userId, id) {
  if (typeof id !== "string") return { error: "Nothing to eat." };
  const u = await User.findOneAndUpdate(
    { _id: userId, snacks: { $elemMatch: { id, b: { $gt: 0 } } } },
    { $inc: { "snacks.$.b": -1 } },
    { new: true, projection: { snacks: 1 } }
  ).lean();
  if (!u) return { error: "That's all gone." };
  const s = u.snacks.find((x) => x && x.id === id), it = foodOf(s.k, s.i);
  if (it) bumpNeeds(userId, biteNeeds(it));
  let bag = u.snacks;
  if (s.b <= 0) {
    await User.updateOne({ _id: userId }, { $pull: { snacks: { id } } });
    bag = bag.filter((x) => x && x.id !== id);
  }
  return { ok: true, bag: tidy(bag), left: Math.max(0, s.b), n: bitesOf(it), k: s.k, i: s.i };
}

export async function dropFood(userId, id) {
  if (typeof id !== "string") return { error: "Nothing to throw away." };
  const u = await User.findOneAndUpdate({ _id: userId }, { $pull: { snacks: { id } } }, { new: true, projection: { snacks: 1 } }).lean();
  return { ok: true, bag: tidy(u?.snacks) };
}
