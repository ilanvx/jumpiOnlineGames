/*
  The Jumpi Store: things bought with real money (prices in shekels).
  Used by the store page, the game (special offers) and the server, which is the only
  one that decides prices and what each product gives.

  give:  coins      coins added to the account
         items      item ids from catalog.js (only ones the player doesn't own yet are added)
         memberDays membership days (memberships never renew by themselves:
                    buying again simply adds the days on top of what's left)
  once:  can be bought one time per account (old bundles; costumes can be bought again and again)
*/
import { OUTFITS } from "./outfits.js";
// The real-money store on the website is open: true shows it everywhere (website page, game offers button, checkout);
// false hides it again (only admins can buy then, on /store?preview).
export const STORE_OPEN = true;
export const CURRENCY = "ILS";

// a costume product (the outfit's items are found by their names in outfits.js, so their numbers never go out of date)
const COSTUME_COST = 24.9;
const pieceId = (name) => { for (const slot of ["hat", "shirt", "pants"]) { const i = OUTFITS[slot].findIndex((o) => o.name === name && o.costume); if (i >= 0) return `${slot}:${i}`; } throw new Error(`store: no costume piece "${name}"`); };
function costume(id, group, color, name, variant, pieces, blurb) {
  return { id, kind: "costume", group, color, price: COSTUME_COST, name, variant, blurb, give: { coins: 1800, memberDays: 7, items: pieces.map(pieceId) } };
}

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

  // costumes: a whole outfit (made for the store: outfits.js COS, tradable, for everyone) + 1,800 coins + a week of membership.
  // They can be bought again and again: every purchase adds another set. The police costume comes in two colours (variant).
  costume("costume-police-black", "police", "#2a2d36", { en: "Police Costume", he: "תחפושת שוטר" }, { en: "Black", he: "שחור" },
    ["Black police cap", "Black police shirt", "Black police pants"],
    { en: "Peaked cap with a star, a uniform shirt with a badge and belt, and uniform pants.", he: "כובע שוטר עם כוכב, חולצת מדים עם תג וחגורה, ומכנסי מדים." }),
  costume("costume-police-pink", "police", "#ff6fb5", { en: "Police Costume", he: "תחפושת שוטר" }, { en: "Pink", he: "ורוד" },
    ["Pink police cap", "Pink police shirt", "Pink police pants"],
    { en: "Peaked cap with a star, a uniform shirt with a badge and belt, and uniform pants.", he: "כובע שוטר עם כוכב, חולצת מדים עם תג וחגורה, ומכנסי מדים." }),
  costume("costume-rapper", "rapper", "#ffb000", { en: "Rapper Costume", he: "תחפושת ראפר" }, null,
    ["Backwards rapper cap", "Rapper tee", "Rapper jeans"],
    { en: "A backwards cap, a black tee with a gold chain and a big JUMPI on the back, and jeans with gold stripes.", he: "כובע הפוך, חולצה שחורה עם שרשרת זהב ו־JUMPI גדול על הגב, וג'ינס עם פסי זהב." }),
  costume("costume-emoji", "emoji", "#ff8a1c", { en: "Emoji Costume", he: "תחפושת אימוג'י" }, null,
    ["Emoji cap", "Emoji tee", "Emoji pants"],
    { en: "An orange cap with a smiley, and a tee and pants covered in happy, cool, laughing and heart-eyed faces.", he: "כובע כתום עם סמיילי, וחולצה ומכנסיים מלאים בפרצופים שמחים, מגניבים, צוחקים ומאוהבים." }),
];
export const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

// what members get (shown on the store page and in the game; "ic" = the little picture in the game's members window)
export const MEMBER_PERKS = [
  { ic: "gift", en: "A members-only gift every month, yours to keep", he: "מתנה רק למנויים בכל חודש, שנשארת שלך" },
  { ic: "shirt", en: "Members-only outfits, vehicles and pets", he: "בגדים, כלי רכב וחיות מחמד רק למנויים" },
  { ic: "spark", en: "The Members Sparkle aura and a crown by your name", he: "הילת המנויים המנצנצת וכתר ליד השם" },
  { ic: "coins", en: "Double daily gift, and twice the coins from mini-games and jobs", he: "מתנה יומית כפולה, ופי שניים מטבעות ממיני־משחקים ומעבודות" },
  { ic: "tag", en: "10% off everything in the Shop", he: "10% הנחה על כל מה שבחנות" },
  { ic: "home", en: "A bigger home: room for 90 pieces of furniture", he: "בית גדול יותר: מקום ל־90 רהיטים" },
  { ic: "paw", en: "Room for 7 pets", he: "מקום ל־7 חיות מחמד" },
  { ic: "star", en: "The Season track goes 50% faster", he: "מסלול העונה מתקדם מהר ב־50%" },
  { ic: "door", en: "The Members Lounge on the Plaza", he: "טרקלין המנויים בכיכר" },
  { ic: "dance", en: "Members-only emotes", he: "אימוג'ים רק למנויים" },
];
// members pay less in the Shop (coins): 10% off, rounded
export const MEMBER_DISCOUNT = 0.1;
export const memberPrice = (price) => (price > 0 ? Math.max(1, Math.round(price * (1 - MEMBER_DISCOUNT))) : price);
// a month's key ("2026-10") for the monthly members gift
export const monthKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 7);

// the weekly special offer in the game: a costume that changes every Sunday (one colour of each)
export function weeklyOffer(now = Date.now()) {
  const list = PRODUCTS.filter((p) => p.kind === "costume" && p.id !== "costume-police-pink");
  const week = Math.floor((now / 86400000 + 4) / 7); // weeks start on Sunday
  const end = (week + 1) * 7 * 86400000 - 4 * 86400000;
  return { product: list[week % list.length], endsAt: end };
}

export const priceText = (p, lang = "en") => (lang === "he" ? `₪${p.price.toFixed(2)}` : `₪${p.price.toFixed(2)}`);
