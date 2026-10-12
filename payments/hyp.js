/*
  HYP (Yaad Sarig) card payments, "Hyp Pay" payment page: https://developers.hyp.co.il/pay

  Settings (only in .env, typed in by Ilan, never in a file in git):
    HYP_MASOF=...      terminal number (מסוף). Test terminals start with 00100.
    HYP_KEY=...        API key       (Hyp portal → Settings → API / Payment Page → Verification)
    HYP_PASSP=...      API password  (same place; not the portal login password)

  In the Hyp portal (Settings → API / Payment Page), once per terminal:
    - Post-transaction address → Successful transaction → custom link:
        https://jumpigames.com/api/store/hyp/return
    - Failed transaction: leave the default (Hyp shows the error on its own page, the player can try again).
    - "Verify by signature in the payment page" ON (usually on by default).

  The flow:
  1. paymentUrl(): our server asks Hyp to sign the payment (action=APISign, What=SIGN, Sign=True). The answer is a
     query string with action=pay and a signature; the player is sent to https://pay.hyp.co.il/p/?<that answer>.
     The amount and our order id are inside the signed string, so the player can't change them.
  2. The player pays on Hyp's page (we never see the card) and comes back to /api/store/hyp/return with
     Id, CCode, Amount, ACode, Order, ... and Sign.
  3. verify(): our server sends ALL those parameters, in the same order, back to Hyp (action=APISign, What=VERIFY).
     Only when Hyp answers CCode=0 (the signature is real) AND the payment's own CCode is 0 is the order paid.
     routes/store.js then also checks the amount against the order, and gives the goods only once.
*/
import { PRODUCT_BY_ID } from "../public/shared/store.js";

const PAY = "https://pay.hyp.co.il/p/";
const env = () => ({ masof: process.env.HYP_MASOF || "", key: process.env.HYP_KEY || "", passp: process.env.HYP_PASSP || "" });

// Hyp answers with a query string (HTTP 200 even on errors): read its CCode
const ccodeOf = (text) => new URLSearchParams(String(text).trim().replace(/^\?/, "")).get("CCode");

async function call(params) {
  const r = await fetch(PAY + "?" + params.toString(), { method: "GET", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "JumpiStore/1.0" } });
  const text = await r.text();
  if (!r.ok) throw new Error(`Hyp answered HTTP ${r.status}`);
  return text.trim();
}

export const hyp = {
  // true only when all three settings are in .env
  ready() {
    const e = env();
    return Boolean(e.masof && e.key && e.passp);
  },

  // the address of Hyp's payment page for this order
  // payer = { first, last, phone } typed by the grown-up in the store just before paying (not saved by us); the email is the account's
  async paymentUrl(order, user, product, lang = "en", payer = null) {
    const e = env();
    const p = new URLSearchParams();
    p.set("action", "APISign"); p.set("What", "SIGN");
    p.set("KEY", e.key); p.set("PassP", e.passp); p.set("Masof", e.masof);
    p.set("Order", order._id.toString());                       // comes back to us on the return address
    p.set("Info", `Jumpi Games - ${product.name.en}`);          // what the payment is for (shown on the page and the receipt)
    p.set("Amount", Number(order.amount).toFixed(2));
    p.set("Coin", "1");                                         // 1 = shekels
    p.set("Tash", "1"); p.set("FixTash", "True");               // one payment, no installments
    p.set("PageLang", lang === "he" ? "HEB" : "ENG");
    p.set("UTF8", "True"); p.set("UTF8out", "True");
    p.set("Sign", "True");                                      // the return address gets a signature we can verify
    // no MoreData: the return address then carries no card digits or buyer details (nothing personal in our logs)
    // the payer's name and mobile (asked in the store right before paying) and the account's email: Hyp fills them in on its page
    // and uses them for the receipt, so the grown-up doesn't type them again
    if (payer?.first) p.set("ClientName", payer.first);
    if (payer?.last) p.set("ClientLName", payer.last);
    if (payer?.phone) p.set("cell", payer.phone);
    const email = user?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) ? user.email : "";
    if (email) p.set("email", email);
    // the receipt (Hyp Invoice, made by Hyp for every payment; the document type, e.g. "קבלה" for an exempt dealer, is set in
    // the Hyp portal → Settings → default document). Hyp emails it only when asked: SendHesh=True + email.
    if (email) p.set("SendHesh", "True");
    p.set("EZ.lang", lang === "he" ? "he" : "en");
    const he = lang === "he";
    const lines = (order.items?.length ? order.items : [{ product: order.product, qty: 1, price: order.amount }]).map((l) => {
      const P = PRODUCT_BY_ID[l.product], name = P ? (he ? P.name.he : P.name.en) + (P.variant ? ` - ${he ? P.variant.he : P.variant.en}` : "") : "Jumpi Games";
      return { name: `Jumpi Games - ${name}`.replace(/[\[\]~]/g, " ").slice(0, 80), qty: Math.max(1, Number(l.qty) || 1), price: Number(l.price) || 0 };
    });
    // the receipt lists every line: [code~description~quantity~price]; the lines must add up to Amount exactly (or Hyp refuses)
    const cents = lines.reduce((a, l) => a + Math.round(l.price * 100) * l.qty, 0);
    if (cents === Math.round(Number(order.amount) * 100)) {
      p.set("Pritim", "True");
      p.set("heshDesc", lines.map((l) => `[0~${l.name}~${l.qty}~${l.price.toFixed(2)}]`).join(""));
    } else p.set("heshDesc", `Jumpi Games - ${product.name.en}`.slice(0, 80));
    const signed = await call(p);
    const cc = ccodeOf(signed);
    if (cc !== null && cc !== "0") throw new Error(`Hyp refused to sign the payment (CCode ${cc})`);
    if (!/(^|&)action=pay(&|$)/.test(signed) || !/signature=/.test(signed)) throw new Error("Hyp's answer has no signature");
    return PAY + "?" + signed;
  },

  // checks what Hyp sent back to the return address; `raw` = the query string exactly as it arrived
  // returns { ok, orderId, ref, amount, code }
  async verify(raw) {
    const e = env();
    const back = new URLSearchParams(String(raw || "").replace(/^\?/, ""));
    if (!back.get("Sign") || !back.get("Order")) return { ok: false, code: "nosign" };
    const p = new URLSearchParams();
    p.set("action", "APISign"); p.set("What", "VERIFY");
    p.set("KEY", e.key); p.set("PassP", e.passp); p.set("Masof", e.masof);
    for (const [k, v] of back) if (!["action", "What", "KEY", "PassP", "Masof"].includes(k)) p.append(k, v);   // every return parameter, same order
    const answer = await call(p);
    const signOk = ccodeOf(answer) === "0";
    const paid = back.get("CCode") === "0";
    return { ok: signOk && paid, orderId: back.get("Order"), ref: back.get("Id") || "", amount: back.get("Amount"), code: signOk ? back.get("CCode") : "badsign" };
  },
  /* ---------- for the admin payments panel (routes/payments.js) ---------- */
  // cancel a payment the same day, before Hyp sends it to the card company (until 22:00 Israel time): no fee
  async cancel(transId) {
    const e = env(), p = new URLSearchParams();
    p.set("action", "CancelTrans"); p.set("Masof", e.masof); p.set("PassP", e.passp); p.set("TransId", String(transId));
    const a = new URLSearchParams(await call(p));
    return { ok: a.get("CCode") === "0", code: a.get("CCode"), raw: { ReversalStatus: a.get("ReversalStatus"), Hesh: a.get("Hesh") } };
  },
  // refund all or part of a payment that was already sent to the card company; makes a new Hyp transaction (and a credit document)
  async refund(transId, amount) {
    const e = env(), p = new URLSearchParams();
    p.set("action", "zikoyAPI"); p.set("Masof", e.masof); p.set("PassP", e.passp); p.set("TransId", String(transId)); p.set("Amount", Number(amount).toFixed(2));
    const a = new URLSearchParams(await call(p));
    return { ok: a.get("CCode") === "0", code: a.get("CCode"), id: a.get("Id") || "", raw: { ACode: a.get("ACode"), HeshASM: a.get("HeshASM") } };
  },
  // a link that opens the receipt (Hyp Invoice / EZcount) of a transaction as a PDF; signed by Hyp, holds no password
  async receiptUrl(transId) {
    const e = env(), p = new URLSearchParams();
    p.set("action", "APISign"); p.set("What", "SIGN"); p.set("ACTION", "PrintHesh"); p.set("type", "EZCOUNT");
    p.set("KEY", e.key); p.set("PassP", e.passp); p.set("Masof", e.masof); p.set("TransId", String(transId));
    const signed = await call(p);
    const cc = ccodeOf(signed);
    if ((cc !== null && cc !== "0") || !/signature=/.test(signed)) throw new Error(`Hyp didn't give a receipt link (CCode ${cc ?? "?"})`);
    return PAY + "?" + signed;
  },
};
