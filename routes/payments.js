import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createHash, timingSafeEqual, randomBytes } from "node:crypto";
import { isHttps } from "./ip.js";
import { User } from "../models/User.js";
import { Order } from "../models/Order.js";
import { AdminLog, logQuietly } from "../models/Logs.js";
import { fulfillOrder } from "./store.js";
import { hyp } from "../payments/hyp.js";
import { PRODUCT_BY_ID, STORE_OPEN } from "../public/shared/store.js";
import { ITEMS, LOOK_SLOTS } from "../catalog.js";
import { moderation, notifyCoins, notifyMember } from "../realtime/plaza.js";

/*
  The payments panel inside /admin (mounted at /api/admin/pay, after every admin layer in routes/admin.js,
  so only senior admins who unlocked the panel with their password ever get here).
  One more lock on top: the payments code, PAYMENTS_CODE in .env (typed in by Ilan on the server, never in git).
  - The code opens the payments for 15 minutes (renewed while working), in its own HttpOnly + SameSite=Strict cookie
    that only works on /api/admin/pay. Changing PAYMENTS_CODE, or the admin's password, closes every open payments session.
  - 5 wrong codes in 15 minutes = wait. Every try and every money action goes to the admin log (never to Discord).
  - No PAYMENTS_CODE on the server = the payments panel stays closed.
  What it does: every transaction, totals, receipts (Hyp's own PDF), full / partial refunds through Hyp
  (same-day cancel when possible: no fee), taking back what was given, notes, a CSV export, and a membership
  refund for everyone by the time they have left (if the game ever closes).
*/
const DAY = 86400000;
const COOKIE = "jumpi_pay";
const OPEN_MS = 15 * 60 * 1000;
const MONEY_IN = ["paid", "partial", "refunded", "duplicate"];   // orders where money really came in
const STATUSES = ["pending", "paid", "failed", "cancelled", "duplicate", "partial", "refunded"];
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const clean = (v, max = 200) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fail = (res, code, error, extra) => res.status(code).json({ error, ...extra });
const sha = (s) => createHash("sha256").update(String(s)).digest();

function limiter(max, ms) {
  const hits = new Map();
  return (key) => {
    const now = Date.now(), list = (hits.get(key) || []).filter((t) => now - t < ms);
    if (list.length >= max) return false;
    list.push(now); hits.set(key, list);
    if (hits.size > 2000) hits.clear();
    return true;
  };
}
const canTry = limiter(5, 15 * 60 * 1000);
const canMove = limiter(30, 60 * 1000);   // refunds / cancels / grants per minute

const codeSet = () => (process.env.PAYMENTS_CODE || "").length >= 6;
const codeTag = () => sha("tag|" + (process.env.PAYMENTS_CODE || "")).toString("hex").slice(0, 12);
function codeOk(typed) {
  if (!codeSet() || typeof typed !== "string" || !typed || typed.length > 200) return false;
  return timingSafeEqual(sha(typed), sha(process.env.PAYMENTS_CODE));
}
function log(req, action, details = "", target) {
  logQuietly(AdminLog, { adminId: req.admin._id, admin: req.admin.username, action, targetId: target?._id, target: target?.username || "", details: clean(details, 300), via: "payments", ip: req.ip || "" });
}

const router = express.Router();
router.use((req, res, next) => { res.set({ "Cache-Control": "no-store" }); next(); });

/* ---------- the payments code ---------- */
function openUntil(req) {
  try {
    const p = jwt.verify(req.cookies?.[COOKIE] || "", process.env.JWT_SECRET);
    if (p.k !== "pay" || p.sub !== req.admin._id.toString() || (p.v || 0) !== (req.admin.tokenVersion || 0) || p.c !== codeTag() || !codeSet()) return 0;
    return p.exp * 1000;
  } catch {
    return 0;
  }
}
function setOpen(req, res) {
  const token = jwt.sign({ sub: req.admin._id.toString(), v: req.admin.tokenVersion || 0, c: codeTag(), k: "pay" }, process.env.JWT_SECRET, { expiresIn: OPEN_MS / 1000 });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "strict", secure: isHttps(req), path: "/api/admin/pay", maxAge: OPEN_MS });
  return Date.now() + OPEN_MS;
}
router.get("/session", (req, res) => {
  const until = openUntil(req);
  res.json({ codeSet: codeSet(), open: until > Date.now(), until });
});
router.post("/unlock", (req, res) => {
  if (!codeSet()) return fail(res, 503, "The payments code isn't set on the server yet (PAYMENTS_CODE in .env, at least 6 characters).");
  if (!canTry(req.admin._id.toString() + "|" + req.ip)) return fail(res, 429, "Too many tries. Wait 15 minutes.");
  const ok = codeOk(req.body.code);
  log(req, ok ? "payments-open" : "payments-code-wrong");
  if (!ok) return fail(res, 401, "Wrong code.");
  res.json({ ok: true, until: setOpen(req, res) });
});
router.post("/lock", (req, res) => {
  res.clearCookie(COOKIE, { path: "/api/admin/pay", sameSite: "strict", httpOnly: true, secure: isHttps(req) });
  res.json({ ok: true });
});
router.use((req, res, next) => {
  const until = openUntil(req);
  if (until <= Date.now()) return fail(res, 401, "Type the payments code.", { payLocked: true });
  if (until - Date.now() < OPEN_MS - 3 * 60 * 1000) setOpen(req, res);
  next();
});

/* ---------- helpers ---------- */
// the lines of an order (old single-product orders have no items list)
const linesOf = (o) => (o.items?.length ? o.items : [{ product: o.product, qty: 1, price: o.amount }]);
const nameOf = (id) => PRODUCT_BY_ID[id]?.name?.en || id;
const whatOf = (o) => linesOf(o).map((l) => (l.qty > 1 ? l.qty + "× " : "") + nameOf(l.product)).join(", ");
const left = (o) => r2((o.amount || 0) - (o.refunded || 0));
// Israel date, "2026-10-12"
const ilDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
// the start of today in Israel
function ilMidnight(now = Date.now()) {
  const guess = Date.parse(ilDay(now) + "T00:00:00Z");
  const offset = Date.parse(new Date(guess).toLocaleString("sv-SE", { timeZone: "Asia/Jerusalem" }).replace(" ", "T") + "Z") - guess;
  return new Date(guess - offset);
}
const ilHour = (d) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", hourCycle: "h23" }).format(new Date(d)));
// a full refund of a payment made today before 22:00 can be a free same-day cancel at Hyp
const canCancelToday = (o) => o.provider === "hyp" && o.paidAt && !o.refunds?.length && ilDay(o.paidAt) === ilDay(Date.now()) && ilHour(Date.now()) < 22;

// membership days of an order that can still be refunded, and what one day is worth
// member packs: their price / days. Costumes: the 1-week membership's price per day (the rest of the costume is clothes and coins)
const WEEK = PRODUCT_BY_ID["member-7"];
const WEEK_DAY = WEEK ? WEEK.price / WEEK.give.memberDays : 1;
function memberParts(o) {
  const parts = [];
  for (const l of linesOf(o)) {
    const P = PRODUCT_BY_ID[l.product], d = (P?.give?.memberDays || 0) * (l.qty || 1);
    if (!d) continue;
    const linePrice = (l.price || 0) * (l.qty || 1);
    const perDay = P.kind === "member" ? linePrice / d : Math.min(WEEK_DAY, linePrice / d);
    parts.push({ days: d, perDay });
  }
  return parts;
}
const takenDays = (o) => (o.refunds || []).reduce((a, x) => a + (x.days || 0), 0);

/*
  Membership refunds by the time left. The days still left on a player's membership belong to the newest paid orders
  (buying again adds days at the end), so they're matched newest first. Days given by hand or by gift codes aren't money: 0.
*/
async function memberPlan({ minAmount = 1, onlyUser = null } = {}) {
  const now = Date.now();
  const uq = { memberUntil: { $gt: new Date(now) } };
  if (onlyUser) uq._id = onlyUser;
  const members = await User.find(uq).select("username memberUntil").lean();
  const plan = [];
  for (const u of members) {
    let daysLeft = Math.floor((new Date(u.memberUntil).getTime() - now) / DAY);
    if (daysLeft <= 0) continue;
    const orders = await Order.find({ user: u._id, status: { $in: ["paid", "partial"] }, "give.memberDays": { $gt: 0 } }).sort({ paidAt: -1 }).lean();
    const rows = [];
    for (const o of orders) {
      if (daysLeft <= 0) break;
      let free = memberParts(o).reduce((a, p) => a + p.days, 0) - takenDays(o);
      if (free <= 0) continue;
      const take = Math.min(free, daysLeft);
      // a cart with two membership lines: one day is worth the order's average
      const parts = memberParts(o), total = parts.reduce((a, p) => a + p.days, 0);
      const avg = parts.reduce((a, p) => a + p.days * p.perDay, 0) / total;
      const amount = Math.min(left(o), r2(take * avg));
      daysLeft -= take; free -= take;
      if (amount >= minAmount) rows.push({ orderId: o._id.toString(), provider: o.provider, paidAt: o.paidAt, what: whatOf(o), paid: o.amount, refunded: o.refunded || 0, days: take, amount });
    }
    if (rows.length) plan.push({ userId: u._id.toString(), username: u.username, memberUntil: u.memberUntil, daysLeft: Math.floor((new Date(u.memberUntil).getTime() - now) / DAY), rows, total: r2(rows.reduce((a, r) => a + r.amount, 0)) });
  }
  plan.sort((a, b) => b.total - a.total);
  return { plan, members: members.length, orders: plan.reduce((a, p) => a + p.rows.length, 0), total: r2(plan.reduce((a, p) => a + p.total, 0)) };
}

// take back (part of) what an order gave. share = the part of the order that was refunded (0..1)
async function takeBack(order, how, share, extraDays = null) {
  const out = { coins: 0, days: 0, items: [] };
  if (how === "none" && !extraDays) return out;
  const user = await User.findById(order.user);
  if (!user) return out;
  const give = order.give || {};
  const f = how === "all" ? 1 : how === "share" ? Math.max(0, Math.min(1, share)) : 0;
  // coins: never below 0 (they may have spent some)
  const coins = Math.min(user.coins || 0, Math.round((give.coins || 0) * f));
  if (coins > 0) { await moderation.addCoins(user, -coins); out.coins = coins; }
  // membership days
  const days = extraDays ?? Math.max(0, Math.min(Math.round((give.memberDays || 0) * f), (give.memberDays || 0) - takenDays(order)));
  if (days > 0 && user.memberUntil && user.memberUntil.getTime() > Date.now()) {
    const fresh = await User.findById(order.user).select("memberUntil");
    const until = Math.max(Date.now(), fresh.memberUntil.getTime() - days * DAY);
    await User.updateOne({ _id: order.user }, { $set: { memberUntil: new Date(until) } });
    out.days = days;
    notifyMember(order.user.toString(), until > Date.now());
  }
  // clothes: only when everything is taken back (one of each piece the order gave, taken off if worn)
  if (how === "all") {
    const u = await User.findById(order.user);
    u.normalizeInventory();
    const inv = [...u.inventory];
    for (const id of [...(give.items || []), ...(give.extra || [])]) {
      const at = inv.lastIndexOf(id);
      if (at < 0) continue;
      inv.splice(at, 1); out.items.push(id);
      const [slot, idx] = id.split(":");
      if (LOOK_SLOTS[slot] && u.look?.[slot] === Number(idx) && !inv.includes(id)) {
        if (LOOK_SLOTS[slot].optional) u.look[slot] = -1;
        else { const other = inv.find((x) => x.startsWith(slot + ":")); if (other) u.look[slot] = Number(other.split(":")[1]); }
        u.markModified("look");
      }
    }
    if (out.items.length) { u.inventory = inv; await u.save(); }
  }
  const after = await User.findById(order.user);
  if (after) { notifyCoins(after._id.toString(), after.coins); moderation.refresh(after); }
  return out;
}

/*
  Give money back for one order. mode: "auto" (a free same-day cancel when it's the whole amount and still allowed,
  otherwise a refund), "refund". Test orders (pretend payments) never call Hyp.
*/
async function moneyBack(orderIn, { amount, reason, how, by, batch = "", days = null }) {
  amount = r2(amount);
  if (!(amount > 0)) return { ok: false, error: "Type an amount." };
  // one refund at a time per order (a stuck lock frees itself after 2 minutes); the checks run on the order as it is now
  const order = await Order.findOneAndUpdate({ _id: orderIn._id, $or: [{ busy: null }, { busy: { $lt: new Date(Date.now() - 120_000) } }] }, { $set: { busy: new Date() } }, { new: true });
  if (!order) return { ok: false, error: "A refund for this order is already being sent. Wait a moment." };
  let unsure = false;
  try {
    if (!["paid", "partial", "duplicate"].includes(order.status)) return { ok: false, error: `This order is "${order.status}": nothing to refund.` };
    if (amount > left(order) + 0.001) return { ok: false, error: `At most ₪${left(order).toFixed(2)} can still be refunded on this order.` };
    if (order.provider === "hyp" && !order.providerRef) return { ok: false, error: "This order has no Hyp transaction number." };
    if (order.provider === "hyp" && !hyp.ready()) return { ok: false, error: "Hyp isn't set up on the server (HYP_MASOF / HYP_KEY / HYP_PASSP)." };
    let kind = "refund", ref = "", code = "0";
    if (order.provider === "test") ref = "test-" + randomBytes(4).toString("hex");
    else {
      const whole = Math.abs(amount - order.amount) < 0.001;
      unsure = true;   // from here until Hyp answers, we can't know if the money moved
      if (whole && canCancelToday(order)) {
        const c = await hyp.cancel(order.providerRef);
        if (c.ok && (!c.raw.ReversalStatus || c.raw.ReversalStatus === "777")) { kind = "cancel"; ref = order.providerRef; }
        else code = c.code;
      }
      if (kind !== "cancel") {
        const r = await hyp.refund(order.providerRef, amount);
        if (!r.ok) {
          unsure = false;
          const why = { 33: "more than what's left on the payment", 6: "the terminal isn't allowed to refund through the API (ask Hyp to switch it on)", 902: "Hyp's password (HYP_PASSP) is wrong" }[r.code] || "";
          console.error(`[payments] refund of order ${order._id} failed at Hyp, CCode ${r.code}`);
          return { ok: false, error: `Hyp refused the refund (code ${r.code}${why ? ": " + why : ""}). Nothing was changed.`, code: r.code };
        }
        ref = r.id; code = r.code;
      }
      unsure = false;
    }
    const fresh = await Order.findById(order._id);
    const share = amount / fresh.amount;
    // a "paid twice" order never gave anything: nothing to take back
    const back = fresh.grantedAt ? await takeBack(fresh, how, share, days) : { coins: 0, days: 0, items: [] };
    const refunded = r2((fresh.refunded || 0) + amount);
    const status = refunded >= fresh.amount - 0.001 ? "refunded" : "partial";
    await Order.updateOne({ _id: order._id }, {
      $set: { refunded, status },
      $push: { refunds: { kind, amount, at: new Date(), by, ref, reason: clean(reason, 200), takeBack: how, coins: back.coins, days: back.days, items: back.items, batch } },
    });
    return { ok: true, kind, ref, status, back, cancelTried: code !== "0" };
  } catch (err) {
    if (!unsure) throw err;
    // no answer from Hyp (timeout, network): the refund may or may not have happened. Keep the order locked for 2 minutes
    // and write it down, so nobody refunds twice without checking the Hyp portal first.
    console.error(`[payments] no answer from Hyp for the refund of order ${order._id}:`, err.message);
    const note = `[${new Date().toISOString().slice(0, 16)} no answer from Hyp for a ₪${amount.toFixed(2)} refund: check the Hyp portal before trying again] `;
    await Order.updateOne({ _id: order._id }, { $set: { notes: (note + (order.notes || "")).slice(0, 500), busy: new Date() } });
    return { ok: false, error: "Hyp didn't answer, so it's not known if the money went back. Check the transaction in the Hyp portal before trying again (a note was added to the order)." };
  } finally {
    if (!unsure) await Order.updateOne({ _id: order._id }, { $set: { busy: null } });
  }
}

/* ---------- overview ---------- */
router.get("/summary", async (req, res, next) => {
  try {
    const now = Date.now(), since = (d) => new Date(now - d * DAY);
    const sumPaid = async (from) => (await Order.aggregate([{ $match: { status: { $in: MONEY_IN }, ...(from ? { paidAt: { $gte: from } } : {}) } }, { $group: { _id: null, n: { $sum: 1 }, total: { $sum: "$amount" } } }]))[0] || { n: 0, total: 0 };
    const sumBack = async (from) => (await Order.aggregate([{ $unwind: "$refunds" }, ...(from ? [{ $match: { "refunds.at": { $gte: from } } }] : []), { $group: { _id: null, n: { $sum: 1 }, total: { $sum: "$refunds.amount" } } }]))[0] || { n: 0, total: 0 };
    const periods = { today: ilMidnight(now), d7: since(7), d30: since(30), all: null };
    const money = {};
    for (const [k, from] of Object.entries(periods)) {
      const [inn, out] = await Promise.all([sumPaid(from), sumBack(from)]);
      money[k] = { orders: inn.n, gross: r2(inn.total), refunds: r2(out.total), refundsN: out.n, net: r2(inn.total - out.total) };
    }
    // the last 30 days, day by day (Israel time)
    const dayOf = (field) => ({ $dateToString: { format: "%Y-%m-%d", timezone: "Asia/Jerusalem", date: field } });
    const [inDays, outDays, byKind, byStatus, attention, buyers] = await Promise.all([
      Order.aggregate([{ $match: { status: { $in: MONEY_IN }, paidAt: { $gte: since(30) } } }, { $group: { _id: dayOf("$paidAt"), total: { $sum: "$amount" }, n: { $sum: 1 } } }]),
      Order.aggregate([{ $unwind: "$refunds" }, { $match: { "refunds.at": { $gte: since(30) } } }, { $group: { _id: dayOf("$refunds.at"), total: { $sum: "$refunds.amount" } } }]),
      Order.aggregate([{ $match: { status: { $in: MONEY_IN } } }, { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
        { $group: { _id: { $ifNull: ["$items.product", "$product"] }, n: { $sum: { $ifNull: ["$items.qty", 1] } }, total: { $sum: { $ifNull: [{ $multiply: ["$items.price", "$items.qty"] }, "$amount"] } } } }, { $sort: { total: -1 } }]),
      Order.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      Order.find({ $or: [
        { status: "duplicate" },
        { status: { $in: ["pending", "failed"] }, provider: "hyp", createdAt: { $lt: new Date(now - 20 * 60_000), $gt: since(3) } },
        { busy: { $ne: null, $lt: new Date(now - 120_000) } },
      ] }).sort({ createdAt: -1 }).limit(30).lean(),
      Order.distinct("user", { status: { $in: MONEY_IN } }),
    ]);
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const key = ilDay(now - i * DAY);
      days.push({ day: key, in: r2(inDays.find((x) => x._id === key)?.total), out: r2(outDays.find((x) => x._id === key)?.total), n: inDays.find((x) => x._id === key)?.n || 0 });
    }
    const members = await memberPlan({ minAmount: 0 });
    res.json({
      money, days, buyers: buyers.length,
      byKind: byKind.map((k) => ({ product: k._id, name: nameOf(k._id), n: k.n, total: r2(k.total) })),
      byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.n])),
      attention: attention.map(row),
      members: { active: await User.countDocuments({ memberUntil: { $gt: new Date() } }), paidFor: members.plan.length, owed: members.total },
      health: health(),
    });
  } catch (err) {
    next(err);
  }
});
function health() {
  return {
    hyp: hyp.ready(), storeOpen: STORE_OPEN, test: process.env.STORE_TEST === "1" || process.env.STORE_TEST === "true",
    code: codeSet(), returnUrl: "/api/store/hyp/return",
  };
}

/* ---------- transactions ---------- */
function row(o) {
  return {
    id: o._id.toString(), at: o.createdAt, paidAt: o.paidAt, user: o.user?.toString(), username: o.username, what: whatOf(o),
    amount: o.amount, refunded: o.refunded || 0, status: o.status, provider: o.provider, ref: o.providerRef || "",
    canCancel: o.status === "paid" && canCancelToday(o), notes: o.notes || "", busy: !!o.busy,
    refunds: (o.refunds || []).map((x) => ({ kind: x.kind, amount: x.amount, at: x.at, by: x.by, ref: x.ref, reason: x.reason, coins: x.coins, days: x.days, items: (x.items || []).length, batch: x.batch || "" })),
  };
}
function query(req) {
  const q = {}, and = [];
  const st = String(req.query.status || "");
  if (st === "money") q.status = { $in: MONEY_IN };
  else if (st === "attention") and.push({ $or: [{ status: "duplicate" }, { status: { $in: ["pending", "failed"] }, provider: "hyp", createdAt: { $lt: new Date(Date.now() - 20 * 60_000) } }] });
  else if (STATUSES.includes(st)) q.status = st;
  const name = clean(req.query.q, 40);
  if (/^[0-9a-f]{24}$/i.test(name)) q._id = name;
  else if (/^\d{4,}$/.test(name)) and.push({ $or: [{ providerRef: name }, { "refunds.ref": name }] });
  else if (name) q.username = new RegExp("^" + esc(name), "i");
  if (mongoose.isValidObjectId(req.query.user)) q.user = req.query.user;
  const from = Date.parse(req.query.from), to = Date.parse(req.query.to);
  if (from || to) q.createdAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lt: new Date(to + DAY) } : {}) };
  if (req.query.provider === "hyp" || req.query.provider === "test") q.provider = req.query.provider;
  if (and.length) q.$and = and;
  return q;
}
router.get("/orders", async (req, res, next) => {
  try {
    const q = query(req), per = 50, pageN = Math.max(0, Math.floor(Number(req.query.page) || 0));
    const [list, count, sums] = await Promise.all([
      Order.find(q).sort({ createdAt: -1 }).skip(pageN * per).limit(per).lean(),
      Order.countDocuments(q),
      Order.aggregate([{ $match: { $and: [q, { status: { $in: MONEY_IN } }] } }, { $group: { _id: null, total: { $sum: "$amount" }, back: { $sum: { $ifNull: ["$refunded", 0] } } } }]),
    ]);
    const s = sums[0] || { total: 0, back: 0 };
    res.json({ list: list.map(row), count, page: pageN, pages: Math.ceil(count / per), totals: { paid: r2(s.total), refunded: r2(s.back), net: r2(s.total - s.back) } });
  } catch (err) {
    next(err);
  }
});
// a spreadsheet (opens in Excel) of the same list, up to 20,000 rows
router.get("/orders.csv", async (req, res, next) => {
  try {
    const list = await Order.find(query(req)).sort({ createdAt: -1 }).limit(20000).lean();
    const cell = (v) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = ["Order", "Created (Israel)", "Paid (Israel)", "Player", "What", "Amount ILS", "Refunded ILS", "Net ILS", "Status", "Provider", "Hyp transaction", "Refund transactions", "Notes"];
    const il = (d) => (d ? new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Jerusalem" }) : "");
    const lines = [head.join(",")].concat(list.map((o) => [o._id, il(o.createdAt), il(o.paidAt), o.username, whatOf(o), r2(o.amount).toFixed(2), r2(o.refunded).toFixed(2),
      (MONEY_IN.includes(o.status) ? r2(o.amount - (o.refunded || 0)) : 0).toFixed(2), o.status, o.provider, o.providerRef, (o.refunds || []).map((x) => `${x.kind} ${x.amount} ${x.ref}`).join(" | "), o.notes].map(cell).join(",")));
    log(req, "payments-export", `${list.length} rows`);
    res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="jumpi-payments-${ilDay(Date.now())}.csv"` });
    res.send("﻿" + lines.join("\r\n"));
  } catch (err) {
    next(err);
  }
});
const findOrder = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, "Order not found."), null;
  const o = await Order.findById(req.params.id);
  if (!o) return fail(res, 404, "Order not found."), null;
  return o;
};
router.get("/orders/:id", async (req, res, next) => {
  try {
    const o = await findOrder(req, res); if (!o) return;
    const u = await User.findById(o.user).select("username email coins memberUntil subscriber createdAt").lean();
    const other = await Order.aggregate([{ $match: { user: o.user, status: { $in: MONEY_IN } } }, { $group: { _id: null, n: { $sum: 1 }, total: { $sum: "$amount" }, back: { $sum: { $ifNull: ["$refunded", 0] } } } }]);
    const give = o.give || {};
    const member = await memberPlan({ minAmount: 0, onlyUser: o.user });
    const mine = member.plan[0]?.rows.find((r) => r.orderId === o._id.toString());
    res.json({
      order: { ...row(o), lines: linesOf(o).map((l) => ({ product: l.product, name: nameOf(l.product), qty: l.qty, price: l.price })),
        give: { coins: give.coins || 0, memberDays: give.memberDays || 0, items: [...(give.items || []), ...(give.extra || [])].map((id) => ITEMS.get(id)?.name || id) },
        grantedAt: o.grantedAt, left: left(o), memberValue: mine ? { days: mine.days, amount: mine.amount } : null },
      player: u ? { id: u._id.toString(), username: u.username, email: u.email, coins: u.coins || 0, memberUntil: u.memberUntil && u.memberUntil > new Date() ? u.memberUntil : null, since: u.createdAt,
        spent: r2(other[0]?.total), refunded: r2(other[0]?.back), orders: other[0]?.n || 0 } : null,
    });
  } catch (err) {
    next(err);
  }
});
// Hyp's own receipt (PDF) of the payment, or of one of its refunds (?ref=)
router.get("/orders/:id/receipt", async (req, res, next) => {
  try {
    const o = await findOrder(req, res); if (!o) return;
    if (o.provider !== "hyp") return fail(res, 409, "This was a test (pretend) payment: there's no receipt.");
    const ref = clean(req.query.ref, 40) || o.providerRef;
    if (!ref || (ref !== o.providerRef && !(o.refunds || []).some((x) => x.ref === ref))) return fail(res, 404, "No such transaction on this order.");
    if (!hyp.ready()) return fail(res, 503, "Hyp isn't set up on the server.");
    const url = await hyp.receiptUrl(ref);
    log(req, "payments-receipt", `order ${o._id} · ${ref}`);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});
router.post("/orders/:id/note", async (req, res, next) => {
  try {
    const o = await findOrder(req, res); if (!o) return;
    const notes = clean(String(req.body.notes ?? "").replace(/\r?\n/g, " "), 500);
    await Order.updateOne({ _id: o._id }, { $set: { notes } });
    // saving the note after checking Hyp also clears an old "no answer from Hyp" lock
    await Order.updateOne({ _id: o._id, busy: { $lt: new Date(Date.now() - 120_000) } }, { $set: { busy: null } });
    log(req, "payments-note", `order ${o._id}`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
router.post("/orders/:id/refund", async (req, res, next) => {
  try {
    if (!canMove(req.admin._id.toString())) return fail(res, 429, "Too many refunds in a minute. Wait a little.");
    const o = await findOrder(req, res); if (!o) return;
    const how = ["none", "share", "all"].includes(req.body.takeBack) ? req.body.takeBack : "none";
    const amount = req.body.all === true ? left(o) : Number(req.body.amount);
    const r = await moneyBack(o, { amount, reason: req.body.reason, how, by: req.admin.username });
    const user = await User.findById(o.user).select("username");
    log(req, r.ok ? "payments-refund" : "payments-refund-failed", `order ${o._id} · ₪${r2(amount).toFixed(2)} of ₪${o.amount} · ${r.ok ? r.kind + " " + r.ref : r.error}${req.body.reason ? " · " + clean(req.body.reason, 100) : ""}`, user);
    if (!r.ok) return fail(res, 409, r.error);
    const b = r.back, took = [b.coins && `${b.coins.toLocaleString("en-US")} coins`, b.days && `${b.days} membership days`, b.items.length && `${b.items.length} clothes`].filter(Boolean);
    res.json({ ok: true, message: `${r.kind === "cancel" ? "Cancelled at Hyp (same day, no fee)" : o.provider === "test" ? "Refunded (test order: Hyp wasn't called)" : "Refunded through Hyp"}: ₪${r2(amount).toFixed(2)}.${took.length ? " Took back " + took.join(", ") + "." : ""}` });
  } catch (err) {
    next(err);
  }
});
// a HYP payment that never came back to the site (the buyer closed the page after paying): after checking in the Hyp portal
// that it was really paid, give it by hand with Hyp's transaction number. Only "pending" or "failed" HYP orders.
router.post("/orders/:id/grant", async (req, res, next) => {
  try {
    if (!canMove(req.admin._id.toString())) return fail(res, 429, "Too many in a minute. Wait a little.");
    const ref = clean(req.body.ref, 40);
    if (!/^[0-9A-Za-z-]{3,40}$/.test(ref)) return fail(res, 400, "Type the HYP transaction number (from the Hyp portal).");
    const order = await findOrder(req, res); if (!order) return;
    if (order.provider !== "hyp") return fail(res, 404, "Order not found.");
    if (!["pending", "failed"].includes(order.status)) return fail(res, 409, `This order is already "${order.status}".`);
    if (await Order.exists({ _id: { $ne: order._id }, provider: "hyp", providerRef: ref })) return fail(res, 409, "That HYP number was already used for another order.");
    if (order.status === "failed") await Order.updateOne({ _id: order._id, status: "failed" }, { $set: { status: "pending" } });
    const r = await fulfillOrder(order._id, ref);
    const user = await User.findById(order.user).select("username");
    log(req, "store-grant", `order ${order._id} · ₪${order.amount} · HYP ${ref}`, user);
    res.json({ ok: true, message: r.duplicate ? "A one-time bundle in it was already bought: nothing given, refund it from here." : `Given to ${order.username}.` });
  } catch (err) {
    next(err);
  }
});

/* ---------- membership refunds by the time left (if the game closes) ---------- */
let job = null;   // { id, running, total, done, ok, failed, amount, errors[], startedAt, endedAt, by }
router.get("/members/plan", async (req, res, next) => {
  try {
    const min = Math.max(0, Math.min(50, Number(req.query.min) || 1));
    res.json({ ...(await memberPlan({ minAmount: min })), min, hyp: hyp.ready(), job });
  } catch (err) {
    next(err);
  }
});
router.get("/members/job", (req, res) => res.json({ job }));
router.post("/members/run", async (req, res, next) => {
  try {
    if (job?.running) return fail(res, 409, "A membership refund is already running.");
    // one more check for the biggest action there is: the code again and the words typed by hand
    if (!canTry(req.admin._id.toString() + "|" + req.ip)) return fail(res, 429, "Too many tries. Wait 15 minutes.");
    if (!codeOk(req.body.code)) { log(req, "payments-code-wrong", "membership refund"); return fail(res, 401, "Wrong payments code."); }
    if (String(req.body.confirm || "").trim() !== "REFUND ALL") return fail(res, 400, 'Type REFUND ALL to confirm.');
    const min = Math.max(0, Math.min(50, Number(req.body.min) || 1));
    const endMembership = req.body.endMembership !== false;
    const { plan, orders, total } = await memberPlan({ minAmount: min });
    if (!orders) return fail(res, 409, "Nobody has paid membership time left to refund.");
    if (plan.some((p) => p.rows.some((r) => r.provider === "hyp")) && !hyp.ready()) return fail(res, 503, "Hyp isn't set up on the server.");
    const id = "members-" + ilDay(Date.now()) + "-" + randomBytes(3).toString("hex");
    job = { id, running: true, total: orders, done: 0, ok: 0, failed: 0, amount: 0, planned: total, errors: [], startedAt: new Date(), endedAt: null, by: req.admin.username, endMembership };
    log(req, "payments-members-start", `${id} · ${orders} orders · ₪${total.toFixed(2)} planned`);
    res.json({ ok: true, job });
    const by = req.admin.username, admin = req.admin, ip = req.ip;
    (async () => {
      for (const p of plan) for (const r of p.rows) {
        try {
          const o = await Order.findById(r.orderId);
          const x = o ? await moneyBack(o, { amount: r.amount, reason: "Membership refund by time left", how: "none", by, batch: id, days: endMembership ? r.days : 0 }) : { ok: false, error: "order gone" };
          if (x.ok) { job.ok++; job.amount = r2(job.amount + r.amount); }
          else { job.failed++; job.errors.push({ username: p.username, orderId: r.orderId, amount: r.amount, error: x.error }); }
        } catch (e) {
          job.failed++; job.errors.push({ username: p.username, orderId: r.orderId, amount: r.amount, error: e.message });
        }
        job.done++;
        await new Promise((ok) => setTimeout(ok, 400));   // gently, one at a time
      }
      job.running = false; job.endedAt = new Date();
      logQuietly(AdminLog, { adminId: admin._id, admin: admin.username, action: "payments-members-done", details: `${id} · ${job.ok} ok, ${job.failed} failed · ₪${job.amount.toFixed(2)}`, via: "payments", ip });
    })().catch((e) => { job.running = false; job.endedAt = new Date(); job.errors.push({ error: e.message }); });
  } catch (err) {
    next(err);
  }
});

/* ---------- the log of money actions ---------- */
router.get("/log", async (req, res, next) => {
  try {
    const list = await AdminLog.find({ $or: [{ via: "payments" }, { action: "store-grant" }] }).sort({ at: -1 }).limit(200).lean();
    res.json({ list: list.map((l) => ({ at: l.at, admin: l.admin, action: l.action, target: l.target, details: l.details, ip: l.ip })) });
  } catch (err) {
    next(err);
  }
});

export default router;
