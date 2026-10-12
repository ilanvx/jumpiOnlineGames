import express from "express";
import { createHmac, randomUUID } from "node:crypto";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
import { requireJson } from "./auth.js";
import { requireUser } from "./shop.js";
import { fulfillOrder } from "./store.js";
import { PRODUCT_BY_ID, STORE_OPEN, MS_STORE_OPEN, MS_PRODUCTS } from "../public/shared/store.js";

/*
  Buying coins and memberships inside the Microsoft Store version of the computer program (Microsoft's own payment:
  the Store rules say games must sell their digital things through it; Microsoft keeps 12%).

  Each product is an "add-on" in Partner Center, of type "Developer-managed consumable", whose Product ID is our
  own product id (coins-800 … member-365, MS_PRODUCTS in public/shared/store.js). Prices are set in Partner Center.

  The program never decides what was paid. The flow:
  1. The game asks the program to buy (StoreContext.RequestPurchaseAsync, Microsoft's own purchase window).
  2. The game asks us for a ticket: POST /api/msstore/ticket → an Entra ID token for
     "https://onestore.microsoft.com/b2b/keys/create/collections" + a publisher user id made from the account.
  3. The program turns the ticket into a "Microsoft Store ID key" (GetCustomerCollectionsIdAsync) and the game sends
     it to POST /api/msstore/claim.
  4. We ask Microsoft (collections/query, with our own token) which add-ons this Microsoft account has bought and not
     used yet, write an Order for each (provider "msstore", providerRef = Microsoft's transaction id, once only),
     tell Microsoft it was used (collections/consume, safe to repeat with the same trackingId), and only then give it
     to the Jumpi account that is logged in (fulfillOrder, given once).
  Something bought and not claimed (the program was closed, no internet) is picked up by the next claim: the game
  claims every time the coins window opens.

  .env (typed in by Ilan, never in git): MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET (an Entra ID app, "Web",
  with a client secret; its client id entered in Partner Center → the game → Services → Product collections and purchases).
*/
const router = express.Router();
const ONESTORE = "https://onestore.microsoft.com";
const KEYS_AUD = "https://onestore.microsoft.com/b2b/keys/create/collections";
const COLLECTIONS = "https://collections.mp.microsoft.com/v6.0/collections";
const env = () => ({ tenant: process.env.MS_TENANT_ID || "", id: process.env.MS_CLIENT_ID || "", secret: process.env.MS_CLIENT_SECRET || "" });
export const msReady = () => { const e = env(); return Boolean(e.tenant && e.id && e.secret); };

// Entra ID tokens (60 minutes), one per audience, kept in memory
const tokens = new Map();
async function token(resource) {
  const t = tokens.get(resource);
  if (t && t.exp > Date.now() + 5 * 60_000) return t.value;
  const e = env();
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: e.id, client_secret: e.secret, resource });
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(e.tenant)}/oauth2/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(15_000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error(`Entra ID refused the token (${r.status} ${d.error || ""})`);
  tokens.set(resource, { value: d.access_token, exp: Date.now() + (Number(d.expires_in) || 3600) * 1000 });
  return d.access_token;
}
async function collections(path, body) {
  const r = await fetch(`${COLLECTIONS}/${path}`, {
    method: "POST", headers: { Authorization: "Bearer " + (await token(ONESTORE)), "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
  });
  const text = await r.text();
  if (!r.ok) throw Object.assign(new Error(`Microsoft collections/${path} answered ${r.status}`), { status: r.status, body: text.slice(0, 300) });
  return text ? JSON.parse(text) : {};
}

// the id Microsoft keeps with the key for this Jumpi account (not the database id itself)
const publisherId = (user) => createHmac("sha256", process.env.JWT_SECRET || "jumpi").update("ms|" + user._id.toString()).digest("hex").slice(0, 32);
// the key's own claims (Microsoft checks the signature when we use it)
function keyClaims(key) {
  try {
    const p = JSON.parse(Buffer.from(String(key).split(".")[1] || "", "base64url").toString("utf8"));
    const get = (end) => { const k = Object.keys(p).find((x) => x.endsWith(end)); return k ? p[k] : undefined; };
    return { userId: get("/claims/key/userId"), exp: Number(p.exp) || 0 };
  } catch {
    return null;
  }
}

const canBuy = (user) => (STORE_OPEN && MS_STORE_OPEN) || user.role === "admin";
const hits = new Map();
function slow(key, max = 12) {
  const now = Date.now(), list = (hits.get(key) || []).filter((t) => now - t < 60_000);
  if (list.length >= max) return true;
  list.push(now); hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

// is buying through Microsoft switched on, and for this account?
router.get("/msstore/status", requireUser, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ on: msReady() && canBuy(req.user), products: MS_PRODUCTS, coins: req.user.coins || 0, username: req.user.username, memberUntil: req.user.toPublic().memberUntil });
});

router.post("/msstore/ticket", requireJson, requireUser, async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    if (slow("t" + req.user._id)) return res.status(429).json({ error: "Too many tries. Wait a minute." });
    if (!msReady() || !canBuy(req.user)) return res.status(503).json({ error: "Buying isn't open yet.", soon: true });
    res.json({ ticket: await token(KEYS_AUD), uid: publisherId(req.user) });
  } catch (err) {
    console.error("[msstore] ticket:", err.message);
    res.status(502).json({ error: "Couldn't reach Microsoft. Try again in a moment." });
  }
});

// give one Microsoft purchase (an unused add-on) to this account
const claiming = new Map();   // user id -> promise (one claim at a time per account)
async function claimItem(user, item, key, uid) {
  const id = String(item.inAppOfferToken || ""), P = MS_PRODUCTS.includes(id) ? PRODUCT_BY_ID[id] : null;
  const tx = String(item.transactionId || "");
  if (!P || !tx || !item.itemId) return null;
  // one order per Microsoft transaction, ever (unique index: provider + providerRef)
  let order = await Order.findOne({ provider: "msstore", providerRef: tx });
  if (!order) {
    try {
      order = await Order.create({
        user: user._id, username: user.username, product: P.id, kind: P.kind, items: [{ product: P.id, qty: 1, price: P.price }],
        amount: P.price, provider: "msstore", providerRef: tx, give: { coins: P.give.coins || 0, items: [], extra: [], memberDays: P.give.memberDays || 0 },
        ms: { itemId: String(item.itemId), trackingId: randomUUID(), country: item.purchasedCountry || "", orderId: item.orderId || "" },
      });
    } catch (e) {
      if (e?.code !== 11000) throw e;
      order = await Order.findOne({ provider: "msstore", providerRef: tx });
    }
  }
  if (order.status !== "pending") return null;   // already given (or refunded by hand)
  // tell Microsoft it's used: after this it's gone from their list, so it's never given twice
  await collections("consume", {
    beneficiary: { identityType: "b2b", identityValue: key, localTicketReference: uid },
    itemId: order.ms?.itemId || String(item.itemId), trackingId: order.ms?.trackingId,
  });
  const r = await fulfillOrder(order._id, tx);
  return r.ok && !r.already ? P.id : null;
}

router.post("/msstore/claim", requireJson, requireUser, async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const user = req.user, uidStr = user._id.toString();
    if (slow("c" + uidStr, 20)) return res.status(429).json({ error: "Too many tries. Wait a minute." });
    if (!msReady()) return res.status(503).json({ error: "Buying isn't open yet.", soon: true });
    const key = String(req.body.key || "");
    const claims = keyClaims(key), uid = publisherId(user);
    if (!claims || key.length > 8000) return res.status(400).json({ error: "Bad Microsoft key." });
    if (claims.userId !== uid) return res.status(403).json({ error: "This Microsoft key was made for another account. Please try again." });
    if (claiming.has(uidStr)) await claiming.get(uidStr).catch(() => {});
    const run = (async () => {
      const ids = [];
      let cont;
      do {
        const d = await collections("query", {
          beneficiaries: [{ identityType: "b2b", identityValue: key, localTicketReference: uid }],
          productTypes: ["UnmanagedConsumable"], validityType: "Valid", maxPageSize: 100, ...(cont ? { continuationToken: cont } : {}),
        });
        for (const item of d.items || []) {
          if (item.status && item.status !== "Active") continue;
          try { const got = await claimItem(user, item, key, uid); if (got) ids.push(got); }
          catch (e) { console.error(`[msstore] claim of ${item.inAppOfferToken} (${item.transactionId}) for ${user.username}:`, e.message, e.body || ""); }
        }
        cont = d.continuationToken;
      } while (cont);
      return ids;
    })();
    claiming.set(uidStr, run);
    let got;
    try { got = await run; } finally { if (claiming.get(uidStr) === run) claiming.delete(uidStr); }
    if (got.length) console.log(`[msstore] gave ${got.join(", ")} to ${user.username}`);
    const fresh = await User.findById(user._id);
    res.json({ ok: true, given: got, user: fresh ? fresh.toPublic() : null });
  } catch (err) {
    console.error("[msstore] claim:", err.message, err.body || "");
    res.status(502).json({ error: "Couldn't check the purchase with Microsoft. Don't worry: it's saved, and it will arrive the next time you open the coins window." });
  }
});

export default router;
