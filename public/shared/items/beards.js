// the autumn 2026 wardrobe: beards and moustaches (a new slot, "beard"; how they look: public/world/wear-beard.js)
const NAT = [["Black", "שחור", "#1f1a1a"], ["Dark brown", "חום כהה", "#4a2c1a"], ["Light brown", "חום בהיר", "#8a5a34"], ["Blonde", "בלונד", "#d9b25a"], ["Ginger", "ג'ינג'י", "#c2531f"], ["Grey", "אפור", "#a9adb5"]];
const STYLES = [
  ["full", null, "beard", "זקן עם שפם", 450, "common", NAT],
  ["mustache", "classic", "moustache", "שפם", 250, "common", NAT],
  ["mustache", "handlebar", "handlebar moustache", "שפם מסולסל", 400, "rare", NAT.slice(0, 5)],
  ["mustache", "pencil", "thin moustache", "שפם דק", 250, "common", NAT.slice(0, 4)],
  ["goatee", null, "goatee", "זקנקן", 350, "common", NAT.slice(0, 5)],
  ["chinstrap", null, "chin beard", "זקן בלי שפם", 350, "common", NAT.slice(0, 5)],
  ["stubble", null, "stubble", "זיפים", 200, "common", NAT.slice(0, 3)],
];
export const ITEMS = [];
STYLES.forEach(([id, style, en, he, price, rarity, cols]) => cols.forEach(([cn, ch, col]) =>
  ITEMS.push(["beard", { id, ...(style ? { style } : {}), name: `${cn} ${en}`, he: `${he} ${ch}`, price, rarity, col }])));
ITEMS.push(["beard", { id: "big", name: "Big snowy beard", he: "זקן שלג גדול", price: 1200, rarity: "rare", col: "#f4f4f6" }]);
ITEMS.push(["beard", { id: "mustache", style: "walrus", name: "Big walrus moustache", he: "שפם סוס ים גדול", price: 700, rarity: "rare", col: "#6b4426" }]);
ITEMS.push(["beard", { id: "full", name: "Blue beard", he: "זקן כחול", price: 900, rarity: "rare", col: "#2f7bff" }]);
ITEMS.push(["beard", { id: "full", name: "Pink beard", he: "זקן ורוד", price: 900, rarity: "rare", col: "#ff6fae" }]);
ITEMS.push(["beard", { id: "mustache", style: "handlebar", name: "Green handlebar", he: "שפם מסולסל ירוק", price: 800, rarity: "rare", col: "#2fbf62" }]);
// members only
ITEMS.push(["beard", { id: "full", name: "Rainbow beard", he: "זקן בצבעי הקשת", price: 1800, rarity: "epic", col: "#ff5fa8", rainbow: true, member: true }]);
ITEMS.push(["beard", { id: "mustache", style: "handlebar", name: "Golden glow moustache", he: "שפם זהב זוהר", price: 1500, rarity: "epic", col: "#ffc21a", glow: "#ffb300", member: true }]);
