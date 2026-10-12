import express from "express";
import mongoose from "mongoose";
import { randomBytes, createHash } from "node:crypto";
import { User } from "../models/User.js";
import { Order } from "../models/Order.js";
import { requireJson, checkPassword, storeLoginLimiter } from "./auth.js";
import { requireUser } from "./shop.js";
import { notifyCoins, notifyMember, emitToUser } from "../realtime/plaza.js";
import { PRODUCTS, PRODUCT_BY_ID, STORE_OPEN } from "../public/shared/store.js";
import { ITEMS } from "../catalog.js";
import { hyp } from "../payments/hyp.js";

/*
  The Jumpi Store (real money). Prices and what each product gives come only from
  public/shared/store.js on the server. Payments go through HYP's payment page (payments/hyp.js),
  switched on by HYP_MASOF + HYP_KEY + HYP_PASSP in .env.

  Buying on the website (public/site/store-page.js):
  1. The cart lives in the page. To pay, the grown-up logs in to the player's account IN THE STORE
     (POST /store/login). This is separate from the game: no cookie, nothing saved. It gives a "buy token"
     that lives 20 minutes in the server's memory and only in the page's memory, and ends with the checkout.
  2. POST /store/checkout with the token + the cart + the agreement → a "pending" order → HYP's payment page.
  3. HYP sends the buyer back to /store/hyp/return; we ask HYP to verify, check the amount, and give everything once.

  While the store is closed (STORE_OPEN = false) ADMINS can still buy, to test real payments before opening.
  Without HYP settings: STORE_TEST=1 in .env lets ADMINS "pay" with a pretend payment (nobody else can).
*/
const router = express.Router();
const DAY = 86_400_000;
const testMode = () => process.env.STORE_TEST === "1";
// back to the store page after paying (while the store is closed, admins buy on /store?preview)
const back = (q) => (STORE_OPEN ? "/store?" : "/store?preview&") + q;
const MAX_LINES = 12, MAX_QTY = 10;

// make sure every product only gives things that exist
for (const p of PRODUCTS) for (const id of p.give.items || []) if (!ITEMS.has(id)) throw new Error(`store: ${p.id} gives unknown item ${id}`);

/* ---------- buy tokens: the store's own short login ---------- */
const BUY_MINUTES = 20;
const buyTokens = new Map();   // token -> { uid, v (tokenVersion), exp }
const testPays = new Map();    // pretend payments: order id -> { uid, exp }
function sweep(map) { const now = Date.now(); if (map.size > 5000) for (const [k, x] of map) if (x.exp < now) map.delete(k); }
async function buyer(req) {
  const t = String(req.body?.token || req.get("x-jumpi-buy") || "");
  const s = t && buyTokens.get(t);
  if (!s || s.exp < Date.now()) { if (s) buyTokens.delete(t); return null; }
  const user = await User.findById(s.uid);
  if (!user || (user.tokenVersion || 0) !== s.v || user.isBanned()) { buyTokens.delete(t); return null; }
  return { user, token: t };
}
// one-time bundles this account already paid for (also inside carts)
async function ownedBundles(uid) {
  const [a, b] = await Promise.all([
    Order.distinct("product", { user: uid, status: "paid" }),
    Order.distinct("items.product", { user: uid, status: "paid" }),
  ]);
  return [...new Set([...a, ...b])].filter((id) => PRODUCT_BY_ID[id]?.once);
}
async function storeMe(user) {
  return {
    username: user.username,
    coins: user.coins || 0,
    member: user.isMember(),
    memberUntil: user.toPublic().memberUntil,
    owned: await ownedBundles(user._id),
    payments: hyp.ready() ? "on" : "soon",
    test: testMode() && user.role === "admin",
    open: STORE_OPEN,
    admin: user.role === "admin",
  };
}

const recent = new Map();
function slowDown(key, res) {
  const now = Date.now(), list = (recent.get(key) || []).filter((t) => now - t < 60_000);
  if (recent.size > 20000) for (const [k, l] of recent) if (!l.some((t) => now - t < 60_000)) recent.delete(k);
  if (list.length >= 10) { res.status(429).json({ error: "Slow down a little and try again." }); return true; }
  list.push(now); recent.set(key, list); return false;
}

// the game's offers window: what the player who is playing already has (uses the game's login)
router.get("/store/me", requireUser, async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await storeMe(req.user));
  } catch (err) {
    next(err);
  }
});

// the store's login, only for this purchase: no cookie, the token is kept only in the page's memory
router.post("/store/login", requireJson, storeLoginLimiter, async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const r = await checkPassword(req.body.username, req.body.password, req.ip);
    if (!r.user) return res.status(r.status).json({ error: r.error });
    sweep(buyTokens);
    const token = randomBytes(24).toString("base64url");
    buyTokens.set(token, { uid: r.user._id.toString(), v: r.user.tokenVersion || 0, exp: Date.now() + BUY_MINUTES * 60_000 });
    res.json({ token, minutes: BUY_MINUTES, me: await storeMe(r.user) });
  } catch (err) {
    next(err);
  }
});
router.post("/store/logout", requireJson, (req, res) => { buyTokens.delete(String(req.body.token || "")); res.json({ ok: true }); });

// check a cart: [{ id, qty }] → the lines, the total and what it gives, or an error
function readCart(raw, owned) {
  if (!Array.isArray(raw) || !raw.length) return { error: "Your cart is empty." };
  if (raw.length > MAX_LINES) return { error: "That's a lot! Please buy at most 12 different things at a time." };
  const lines = [], seen = new Set();
  for (const l of raw) {
    const id = String(l?.id || ""), P = Object.hasOwn(PRODUCT_BY_ID, id) ? PRODUCT_BY_ID[id] : null;
    if (!P) return { error: "Something in your cart isn't in the store any more. Please remove it." };
    if (seen.has(id)) return { error: "The same thing is in the cart twice." };
    seen.add(id);
    const qty = P.once ? 1 : Math.floor(Number(l.qty));
    if (!(qty >= 1 && qty <= MAX_QTY)) return { error: `You can buy up to ${MAX_QTY} of each.` };
    if (P.once && owned.includes(id)) return { error: `This account already has the ${P.name.en} bundle. Please remove it from the cart.`, owned: id };
    lines.push({ product: id, qty, price: P.price });
  }
  const amount = Math.round(lines.reduce((a, l) => a + l.price * 100 * l.qty, 0)) / 100;
  // items: added only if the account doesn't have them (one-time bundles); extra: always added, one set per costume bought
  const give = { coins: 0, items: [], extra: [], memberDays: 0 };
  for (const l of lines) {
    const P = PRODUCT_BY_ID[l.product], g = P.give;
    give.coins += (g.coins || 0) * l.qty; give.memberDays += (g.memberDays || 0) * l.qty;
    if (P.kind === "costume") for (let k = 0; k < l.qty; k++) give.extra.push(...(g.items || []));
    else for (const it of g.items || []) if (!give.items.includes(it)) give.items.push(it);
  }
  return { lines, amount, give };
}

// pay: makes a "pending" order for the whole cart and sends the buyer to HYP
router.post("/store/checkout", requireJson, async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const b = await buyer(req);
    if (!b) return res.status(401).json({ error: "Please log in again to buy.", login: true });
    const { user } = b;
    if (slowDown(user._id.toString(), res)) return;
    if (!STORE_OPEN && user.role !== "admin") return res.status(503).json({ error: "The store is closed for now.", comingSoon: true });
    if (req.body.agree !== true) return res.status(400).json({ error: "Please tick the box to agree." });
    const cart = readCart(req.body.cart, await ownedBundles(user._id));
    if (cart.error) return res.status(409).json({ error: cart.error, owned: cart.owned });
    const live = hyp.ready(), test = !live && testMode() && user.role === "admin";
    if (!live && !test) return res.status(503).json({ error: "The store opens soon! Payments aren't switched on yet.", comingSoon: true });
    const one = cart.lines.length === 1 && cart.lines[0].qty === 1 ? PRODUCT_BY_ID[cart.lines[0].product] : null;
    const cartKey = createHash("sha256").update(JSON.stringify(cart.lines)).digest("hex").slice(0, 24);
    // a double click (or a second tab) uses the same waiting order instead of making a second one (no paying twice)
    const order = (await Order.findOne({ user: user._id, cartKey, status: "pending", provider: live ? "hyp" : "test", createdAt: { $gt: new Date(Date.now() - 15 * 60_000) } }).sort({ createdAt: -1 }))
      || (await Order.create({
        user: user._id, username: user.username, product: one ? one.id : "cart", kind: one ? one.kind : "cart",
        items: cart.lines, cartKey, amount: cart.amount, provider: live ? "hyp" : "test", give: cart.give,
      }));
    const info = one ? one.name.en : `${cart.lines.reduce((a, l) => a + l.qty, 0)} items`;
    if (test) {
      sweep(testPays); testPays.set(order._id.toString(), { uid: user._id.toString(), exp: Date.now() + 15 * 60_000 });
      buyTokens.delete(b.token);
      return res.json({ orderId: order._id.toString(), test: true, amount: cart.amount });
    }
    let url;
    try { url = await hyp.paymentUrl(order, user, { name: { en: info } }, req.body.lang === "he" ? "he" : "en"); }
    catch (e) {
      console.error(`[store] HYP payment page for order ${order._id} failed: ${e.message}`);
      return res.status(502).json({ error: "The payment page didn't open. Nothing was charged. Please try again in a minute." });
    }
    buyTokens.delete(b.token);   // the login was for this purchase only
    res.json({ orderId: order._id.toString(), url });
  } catch (err) {
    next(err);
  }
});

// pretend payment (STORE_TEST=1, admins only, only the order just made in the store)
router.post("/store/test-pay", requireJson, async (req, res, next) => {
  try {
    if (!testMode()) return res.status(404).json({ error: "Not found." });
    const id = String(req.body.orderId || ""), t = testPays.get(id);
    if (!t || t.exp < Date.now() || !mongoose.isValidObjectId(id)) return res.status(404).json({ error: "Order not found." });
    const order = await Order.findOne({ _id: id, user: t.uid, provider: "test" });
    const who = order && (await User.findById(t.uid).select("role"));
    if (!order || who?.role !== "admin") return res.status(404).json({ error: "Order not found." });
    testPays.delete(id);
    res.json(await fulfillOrder(order._id, "test-" + Date.now()));
  } catch (err) {
    next(err);
  }
});

// HYP sends the buyer back here after paying
router.get("/store/hyp/return", async (req, res, next) => {
  try {
    if (!hyp.ready()) return res.status(404).type("text").send("Not found");
    res.set("Cache-Control", "no-store");
    const raw = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?") + 1) : "";
    let v;
    try { v = await hyp.verify(raw); }
    catch (e) {   // Hyp didn't answer: nothing is given now; the order stays "pending" and can be checked by hand
      console.error(`[store] HYP verify failed (order ${req.query.Order}, Hyp id ${req.query.Id}): ${e.message}`);
      return res.redirect(back("payment=check"));
    }
    if (!v.ok || !mongoose.isValidObjectId(v.orderId)) {
      console.warn(`[store] HYP return not accepted: order ${v.orderId} code ${v.code}`);
      if (!["badsign", "nosign"].includes(v.code) && mongoose.isValidObjectId(v.orderId)) await Order.updateOne({ _id: v.orderId, status: "pending", provider: "hyp" }, { $set: { status: "failed", providerRef: String(v.ref || "") } });
      return res.redirect(back("payment=failed"));
    }
    const order = await Order.findOne({ _id: v.orderId, provider: "hyp" });
    if (!order || Math.abs(order.amount - Number(v.amount)) > 0.001) {
      console.error(`[store] HYP paid amount ${v.amount} doesn't match order ${v.orderId} (Hyp id ${v.ref})`);
      return res.redirect(back("payment=check"));
    }
    const r = await fulfillOrder(order._id, String(v.ref || ""));
    if (r.duplicate) return res.redirect(back("payment=check"));
    res.redirect(back("payment=ok&product=" + encodeURIComponent(order.product)));
  } catch (err) {
    next(err);
  }
});

/*
  Give the buyer what they paid for. Safe to call twice: only the call that moves the order
  from "pending" to "paid" gives anything.
*/
// one order at a time for each player (two paid orders checked at the same moment could both look like "the second one")
const fulfilling = new Map();   // user id -> the promise of the order being given now
export async function fulfillOrder(orderId, ref) {
  const o = await Order.findById(orderId).select("user").lean();
  if (!o) return { ok: false };
  const key = String(o.user), before = fulfilling.get(key) || Promise.resolve();
  const run = before.catch(() => {}).then(() => fulfillOne(orderId, ref));
  fulfilling.set(key, run);
  try { return await run; } finally { if (fulfilling.get(key) === run) fulfilling.delete(key); }
}
async function fulfillOne(orderId, ref) {
  const order = await Order.findOneAndUpdate({ _id: orderId, status: "pending" }, { $set: { status: "paid", paidAt: new Date(), providerRef: ref } }, { new: true });
  if (!order) return { ok: true, already: true };
  const P = PRODUCT_BY_ID[order.product], give = order.give || P?.give || {};
  // a one-time bundle that was somehow paid twice: keep the money record, give nothing, refund by hand
  const ids = order.items?.length ? order.items.map((l) => l.product) : [order.product];
  for (const id of ids.filter((x) => PRODUCT_BY_ID[x]?.once)) {
    if (await Order.exists({ _id: { $ne: order._id }, user: order.user, status: "paid", $or: [{ product: id }, { "items.product": id }] })) {
      await Order.updateOne({ _id: order._id }, { $set: { status: "duplicate" } });
      console.error(`[store] order ${order._id} has bundle ${id} that ${order.username} already bought: nothing given, refund by hand`);
      return { ok: false, duplicate: true };
    }
  }
  const now = new Date(), inv = { $ifNull: ["$inventory", []] };
  const set = {
    coins: { $add: [{ $ifNull: ["$coins", 0] }, give.coins || 0] },
    inventory: { $concatArrays: [inv, { $filter: { input: give.items || [], as: "it", cond: { $not: [{ $in: ["$$it", inv] }] } } }, give.extra || []] },
  };
  set.__v = { $add: [{ $ifNull: ["$__v", 0] }, 1] };   // a stale save() elsewhere can't wipe what was just given
  if (give.memberDays) set.memberUntil = { $add: [{ $cond: [{ $gt: [{ $ifNull: ["$memberUntil", now] }, now] }, "$memberUntil", now] }, give.memberDays * DAY] };
  const user = await User.findOneAndUpdate({ _id: order.user }, [{ $set: set }], { new: true });
  await Order.updateOne({ _id: order._id }, { $set: { grantedAt: new Date() } });
  if (user) {
    const id = user._id.toString(), pub = user.toPublic();
    notifyCoins(id, user.coins);
    if (give.memberDays) notifyMember(id, true);
    emitToUser(id, "store:granted", { product: order.product, user: pub });
  }
  console.log(`[store] order ${order._id} paid: ${ids.join(", ")} for ${order.username} (₪${order.amount})`);
  return { ok: true, product: order.product, user: user?.toPublic() };
}

export default router;
