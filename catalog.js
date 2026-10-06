/*
  Everything a player can own, with prices in coins.
  An item id is "<category>:<index>". The index matches the lists in public/index.html
  (COLORS, EYE_COLORS, OUTFIT_PARTS, TAGS), so keep both in the same order.
  "starter" items are the ones offered for free at sign-up; they're cheaper in the shop.
*/
const items = [];
const add = (category, index, name, price, starter = false) => items.push({ id: `${category}:${index}`, category, index, name, price, starter });

// body colours
["Orange", "Sky", "Mint", "Bubblegum", "Grape", "Sunny", "Cherry", "Snow"].forEach((n, i) => add("color", i, n, 100, true));
add("color", 8, "Chocolate", 250);
add("color", 9, "Caramel", 250);
add("color", 10, "Peach", 250);
add("color", 11, "Mocha", 250);
add("color", 12, "Midnight", 500);
add("color", 13, "Ruby Gloss", 600);
add("color", 14, "Neon Glow", 900);
add("color", 15, "Solid Gold", 1200);

// eyes (12+ have a different colour in each eye)
["Brown", "Blue", "Green", "Hazel", "Gray", "Purple", "Amber", "Pink"].forEach((n, i) => add("eyes", i, n, 80, true));
add("eyes", 8, "Ocean & Forest", 400);
add("eyes", 9, "Coffee & Sky", 400);
add("eyes", 10, "Candy & Mint", 450);
add("eyes", 11, "Fire & Ice", 550);
add("eyes", 12, "Royal & Gold", 600);
add("eyes", 13, "Galaxy", 700);

// hair
["Spiky", "Quiff", "Pigtails", "Long with bow"].forEach((n, i) => add("hair", i, n, 150, true));
add("hair", 4, "Electric Spiky", 450);
add("hair", 5, "Platinum Quiff", 450);
add("hair", 6, "Pink Pigtails", 450);
add("hair", 7, "Violet Waves", 500);

// shirts
["Red tee", "Sailor stripes", "Green hoodie", "Star tee"].forEach((n, i) => add("shirt", i, n, 120, true));
add("shirt", 4, "Jumpi tee", 350);
add("shirt", 5, "Tie-dye", 500);
add("shirt", 6, "Galaxy", 650);
add("shirt", 7, "Tuxedo", 800);

// pants
["Jeans", "Black joggers", "Khaki shorts", "Red plaid"].forEach((n, i) => add("pants", i, n, 120, true));
add("pants", 4, "Pink jeans", 350);
add("pants", 5, "Camo", 450);
add("pants", 6, "Rainbow", 600);
add("pants", 7, "Gold shorts", 750);

// glasses
["Round", "Square", "Star party", "Sunglasses"].forEach((n, i) => add("glasses", i, n, 100, true));
add("glasses", 4, "Heart", 350);
add("glasses", 5, "Neon shades", 450);
add("glasses", 6, "Gold round", 600);
add("glasses", 7, "Monocle", 700);

// name tags (an icon next to the name)
add("tag", 0, "Star", 150);
add("tag", 1, "Heart", 200);
add("tag", 2, "Lightning", 250);
add("tag", 3, "Music", 250);
add("tag", 4, "Clover", 300);
add("tag", 5, "Flame", 400);
add("tag", 6, "Diamond", 600);
add("tag", 7, "Skull", 700);
add("tag", 8, "Crown", 1000);

export const CATALOG = items;
export const ITEMS = new Map(items.map((it) => [it.id, it]));

// highest index in each look slot (and whether it can be empty)
export const LOOK_SLOTS = {
  color: { max: 15, optional: false },
  eyes: { max: 13, optional: false },
  hair: { max: 7, optional: true },
  shirt: { max: 7, optional: true },
  pants: { max: 7, optional: true },
  glasses: { max: 7, optional: true },
  tag: { max: 8, optional: true },
};
// what sign-up may choose for free
export const STARTER_MAX = { color: 7, eyes: 7, hair: 3, shirt: 3, pants: 3, glasses: 3, tag: -1 };

// the item ids a look is wearing
export function lookItems(look = {}) {
  const out = [];
  for (const slot of Object.keys(LOOK_SLOTS)) {
    const i = look[slot];
    if (Number.isInteger(i) && i >= 0) out.push(`${slot}:${i}`);
  }
  return out;
}
