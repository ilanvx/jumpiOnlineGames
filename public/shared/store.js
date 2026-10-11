/*
  The Jumpi Store: things bought with real money (prices in shekels).
  Used by the store page, the game (special offers) and the server, which is the only
  one that decides prices and what each product gives.

  give:  coins      coins added to the account
         items      item ids from catalog.js (only ones the player doesn't own yet are added)
         memberDays membership days (memberships never renew by themselves:
                    buying again simply adds the days on top of what's left)
  once:  can be bought one time per account (bundles)
*/
// The real-money store is closed for now: false hides it everywhere (website page, game offers button, checkout).
export const STORE_OPEN = false;
export const CURRENCY = "ILS";

export const PRODUCTS = [
  // memberships: one payment, no automatic renewal. A free player earns about 250-1,000 coins a day;
  // members get twice the daily gift, mini-game and job caps, so a month is worth far more than its coins.
  { id: "member-7", kind: "member", price: 9.9, days: 7, give: { memberDays: 7, coins: 300 }, name: { en: "1 Week", he: "שבוע" } },
  { id: "member-30", kind: "member", price: 24.9, days: 30, give: { memberDays: 30, coins: 1500 }, name: { en: "1 Month", he: "חודש" } },
  { id: "member-90", kind: "member", price: 59.9, days: 90, save: 20, give: { memberDays: 90, coins: 5000 }, tag: "popular", name: { en: "3 Months", he: "3 חודשים" } },
  { id: "member-365", kind: "member", price: 179.9, days: 365, save: 40, give: { memberDays: 365, coins: 20000 }, tag: "best", name: { en: "1 Year", he: "שנה" } },

  // coin packs (the bigger the pack, the more coins per shekel: 163 → 250)
  { id: "coins-800", kind: "coins", price: 4.9, give: { coins: 800 }, name: { en: "Handful of Coins", he: "חופן מטבעות" } },
  { id: "coins-1800", kind: "coins", price: 9.9, give: { coins: 1800 }, name: { en: "Pocket of Coins", he: "כיס מטבעות" } },
  { id: "coins-4000", kind: "coins", price: 19.9, bonus: 500, give: { coins: 4000 }, tag: "popular", name: { en: "Bag of Coins", he: "שק מטבעות" } },
  { id: "coins-9000", kind: "coins", price: 39.9, bonus: 1500, give: { coins: 9000 }, name: { en: "Chest of Coins", he: "תיבת מטבעות" } },
  { id: "coins-20000", kind: "coins", price: 79.9, bonus: 4000, give: { coins: 20000 }, tag: "best", name: { en: "Mountain of Coins", he: "הר של מטבעות" } },

  // special bundles (one time each)
  {
    id: "bundle-starter", kind: "bundle", price: 14.9, once: true, color: "#1fb6ff",
    give: { coins: 2500, items: ["hair:4", "shirt:4", "glasses:5"] },
    name: { en: "Starter Pack", he: "חבילת פתיחה" },
    blurb: { en: "A fresh new look and a pile of coins to start your adventure.", he: "לוק חדש וערימת מטבעות כדי להתחיל את ההרפתקה." },
  },
  {
    id: "bundle-sakura", kind: "bundle", price: 29.9, once: true, color: "#ff5fa8",
    give: { coins: 1500, items: ["aura:8", "hair:6", "pants:4", "glasses:4"] },
    name: { en: "Sakura Dream", he: "חלום הסאקורה" },
    blurb: { en: "The store-only Sakura Breeze aura with pink petals, plus a matching outfit.", he: "הילת סאקורה עם עלי כותרת ורודים, שיש רק בחנות, ותלבושת מתאימה." },
  },
  {
    id: "bundle-royal", kind: "bundle", price: 49.9, once: true, color: "#ffb21f",
    give: { coins: 4000, items: ["aura:9", "shirt:7", "pants:7", "tag:8"], memberDays: 7 },
    name: { en: "Royal Star", he: "כוכב מלכותי" },
    blurb: { en: "The store-only Crown of Stars aura, a royal outfit, the Crown tag and a week of membership.", he: "הילת כתר הכוכבים שיש רק בחנות, תלבושת מלכותית, תג הכתר ושבוע מנוי." },
  },
];
export const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

// what members get (shown on the store page and in the game)
export const MEMBER_PERKS = [
  { en: "Double daily gift", he: "מתנה יומית כפולה" },
  { en: "Twice as many coins from mini-games and jobs every day", he: "פי שניים מטבעות ממיני־משחקים ומעבודות בכל יום" },
  { en: "Members-only outfits and vehicles", he: "בגדים וכלי רכב רק למנויים" },
  { en: "Welcome coins with every membership", he: "מטבעות מתנה עם כל מנוי" },
  { en: "A golden name everyone can see", he: "שם בצבע זהב שכולם רואים" },
];

// the weekly special offer in the game: a bundle that changes every Sunday
export function weeklyOffer(now = Date.now()) {
  const bundles = PRODUCTS.filter((p) => p.kind === "bundle" && p.id !== "bundle-starter");
  const week = Math.floor((now / 86400000 + 4) / 7); // weeks start on Sunday
  const end = (week + 1) * 7 * 86400000 - 4 * 86400000;
  return { product: bundles[week % bundles.length], endsAt: end };
}

export const priceText = (p, lang = "en") => (lang === "he" ? `₪${p.price.toFixed(2)}` : `₪${p.price.toFixed(2)}`);
