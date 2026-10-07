import express from "express";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Order } from "../models/Order.js";
import { requireJson } from "./auth.js";
import { requireUser } from "./shop.js";
import { notifyCoins, notifyMember, emitToUser } from "../realtime/plaza.js";
import { PRODUCTS, PRODUCT_BY_ID, STORE_OPEN } from "../public/shared/store.js";
import { ITEMS } from "../catalog.js";
import { hyp } from "../payments/hyp.js";

/*
  The Jumpi Store (real money). Prices and what each product gives come only from
  public/shared/store.js on the server. Payments go through HYP (payments/hyp.js, not connected yet).
  For trying the whole flow before HYP is connected: STORE_TEST=1 in .env lets ADMINS
  "pay" with a pretend payment (nobody else can).
*/
const router = express.Router();
const DAY = 86_400_000;
const testMode = () => process.env.STORE_TEST === "1";

// make sure every product only gives things that exist
for (const p of PRODUCTS) for (const id of p.give.items || []) if (!ITEMS.has(id)) throw new Error(`store: ${p.id} gives unknown item ${id}`);

const recent = new Map();
function slowDown(req, res, next) {
  const key = req.user._id.toString(), now = Date.now();
  const list = (recent.get(key) || []).filter((t) => now - t < 60_000);
  if (list.length >= 10) return res.status(429).json({ error: "Slow down a little and try again." });
  list.push(now);
  recent.set(key, list);
  next();
}

// what the store page needs to know about the signed-in player
router.get("/store/me", requireUser, async (req, res, next) => {
  try {
    const owned = await Order.distinct("product", { user: req.user._id, status: "paid" });
    res.set("Cache-Control", "no-store");
    res.json({
      username: req.user.username,
      coins: req.user.coins || 0,
      member: req.user.isMember(),
      memberUntil: req.user.toPublic().memberUntil,
      owned: owned.filter((id) => PRODUCT_BY_ID[id]?.once),
      payments: hyp.ready() ? "on" : "soon",
      test: testMode() && req.user.role === "admin",
    });
  } catch (err) {
    next(err);
  }
});

// start buying: makes a "pending" order and sends the player to pay
router.post("/store/checkout", requireJson, requireUser, slowDown, async (req, res, next) => {
  try {
    if (!STORE_OPEN) return res.status(503).json({ error: "The store is closed for now.", comingSoon: true });
    const P = PRODUCT_BY_ID[String(req.body.product || "")];
    if (!P) return res.status(400).json({ error: "That isn't in the store." });
    if (req.user.isBanned()) return res.status(403).json({ error: "This account is banned." });
    if (P.once && (await Order.exists({ user: req.user._id, product: P.id, status: "paid" })))
      return res.status(409).json({ error: "You already have this bundle!" });
    const live = hyp.ready(), test = !live && testMode() && req.user.role === "admin";
    if (!live && !test) return res.status(503).json({ error: "The store opens soon! Payments aren't switched on yet.", comingSoon: true });
    const order = await Order.create({
      user: req.user._id, username: req.user.username, product: P.id, kind: P.kind, amount: P.price,
      provider: live ? "hyp" : "test", give: P.give,
    });
    if (test) return res.json({ orderId: order._id.toString(), test: true });
    res.json({ orderId: order._id.toString(), url: await hyp.paymentUrl(order, req.user, P) });
  } catch (err) {
    next(err);
  }
});

// pretend payment (STORE_TEST=1, admins only, their own test orders only)
router.post("/store/test-pay", requireJson, requireUser, async (req, res, next) => {
  try {
    if (!STORE_OPEN || !testMode() || req.user.role !== "admin") return res.status(404).json({ error: "Not found." });
    const id = String(req.body.orderId || "");
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad order." });
    const order = await Order.findOne({ _id: id, user: req.user._id, provider: "test" });
    if (!order) return res.status(404).json({ error: "Order not found." });
    const r = await fulfillOrder(order._id, "test-" + Date.now());
    res.json(r);
  } catch (err) {
    next(err);
  }
});

// HYP sends the player back here after paying
router.get("/store/hyp/return", async (req, res, next) => {
  try {
    if (!hyp.ready()) return res.status(404).type("text").send("Not found");
    const v = await hyp.verify(req.query);
    if (!v.ok || !mongoose.isValidObjectId(v.orderId)) return res.redirect("/store?payment=failed");
    const order = await Order.findById(v.orderId);
    if (!order || Math.abs(order.amount - Number(v.amount)) > 0.001) return res.redirect("/store?payment=failed");
    await fulfillOrder(order._id, String(v.ref || ""));
    res.redirect("/store?payment=ok&product=" + encodeURIComponent(order.product));
  } catch (err) {
    next(err);
  }
});

/*
  Give the player what they paid for. Safe to call twice: only the call that moves the order
  from "pending" to "paid" gives anything.
*/
export async function fulfillOrder(orderId, ref) {
  const order = await Order.findOneAndUpdate({ _id: orderId, status: "pending" }, { $set: { status: "paid", paidAt: new Date(), providerRef: ref } }, { new: true });
  if (!order) return { ok: true, already: true };
  const P = PRODUCT_BY_ID[order.product], give = order.give || P?.give || {};
  // a one-time bundle that was somehow paid twice: keep the money record, give nothing, refund by hand
  if (P?.once && (await Order.exists({ _id: { $ne: order._id }, user: order.user, product: order.product, status: "paid" }))) {
    await Order.updateOne({ _id: order._id }, { $set: { status: "duplicate" } });
    return { ok: false, duplicate: true };
  }
  const now = new Date(), inv = { $ifNull: ["$inventory", []] };
  const set = {
    coins: { $add: [{ $ifNull: ["$coins", 0] }, give.coins || 0] },
    inventory: { $concatArrays: [inv, { $filter: { input: give.items || [], as: "it", cond: { $not: [{ $in: ["$$it", inv] }] } } }] },
  };
  if (give.memberDays) set.memberUntil = { $add: [{ $cond: [{ $gt: [{ $ifNull: ["$memberUntil", now] }, now] }, "$memberUntil", now] }, give.memberDays * DAY] };
  const user = await User.findOneAndUpdate({ _id: order.user }, [{ $set: set }], { new: true });
  await Order.updateOne({ _id: order._id }, { $set: { grantedAt: new Date() } });
  if (user) {
    const id = user._id.toString(), pub = user.toPublic();
    notifyCoins(id, user.coins);
    if (give.memberDays) notifyMember(id, true);
    emitToUser(id, "store:granted", { product: order.product, user: pub });
  }
  console.log(`[store] order ${order._id} paid: ${order.product} for ${order.username} (₪${order.amount})`);
  return { ok: true, product: order.product, user: user?.toPublic() };
}

export default router;
