/*
  Everything a player can own, with prices in coins.
  An item id is "<category>:<index>". The index matches the lists in public/index.html
  (COLORS, EYE_COLORS, OUTFIT_PARTS, TAGS), so keep both in the same order.
  "starter" items are the ones offered for free at sign-up; they're cheaper in the shop.
*/
import { OUTFITS, OUTFIT_SLOTS } from "./public/shared/outfits.js";
import { spotProblem } from "./public/shared/houses.js";
import { VEHICLES } from "./public/shared/vehicles.js";

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
// the Big World collection (rarity shows in the Shop)
[["Rose Gold", 1600, "epic"], ["Pearl", 800, "rare"], ["Lava Glow", 1800, "epic"], ["Frost Mint", 700, "rare"], ["Royal Velvet", 750, "rare"], ["Electric Blue", 1800, "epic"]]
  .forEach(([n, p, r], k) => { add("color", 16 + k, n, p); items[items.length - 1].rarity = r; });

// eyes (12+ have a different colour in each eye)
["Brown", "Blue", "Green", "Hazel", "Gray", "Purple", "Amber", "Pink"].forEach((n, i) => add("eyes", i, n, 80, true));
add("eyes", 8, "Ocean & Forest", 400);
add("eyes", 9, "Coffee & Sky", 400);
add("eyes", 10, "Candy & Mint", 450);
add("eyes", 11, "Fire & Ice", 550);
add("eyes", 12, "Royal & Gold", 600);
add("eyes", 13, "Galaxy", 700);
[["Sunset", 600, "rare"], ["Emerald & Gold", 600, "rare"], ["Ice", 900, "epic"], ["Lava", 900, "epic"]].forEach(([n, p, r], k) => { add("eyes", 14 + k, n, p); items[items.length - 1].rarity = r; });

// hair, shirts, pants, glasses, hats, necklaces: the list lives in public/shared/outfits.js
// (shared with the game, so the item numbers always match)
for (const slot of OUTFIT_SLOTS)
  OUTFITS[slot].forEach((o, i) => {
    add(slot, i, o.name.replace(/ \((boy|girl)\)/, ""), o.price, !!o.starter);
    if (o.gift) Object.assign(items[items.length - 1], { gift: true, rarity: "legendary" });   // work uniforms: only as a job prize
    if (o.event) items[items.length - 1].event = o.event;   // holiday items: sold only while that event is on (public/shared/events.js)
    if (o.rarity) items[items.length - 1].rarity = o.rarity;
    if (o.member) items[items.length - 1].member = true;   // the Members Club collection: only members can buy it
  });

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
// Halloween tags (sold only during the Halloween event)
[["Pumpkin", 800], ["Bat", 800], ["Ghost", 1000]].forEach(([n, p], k) => { add("tag", 9 + k, n, p); items[items.length - 1].event = "halloween"; });
// the Big World collection: 12+
[["Rocket", 600, "rare"], ["Paw", 300, "common"], ["Rainbow", 700, "rare"], ["Planet", 800, "rare"], ["Moon", 400, "common"], ["Sun", 450, "common"]]
  .forEach(([n, p, r], k) => { add("tag", 12 + k, n, p); items[items.length - 1].rarity = r; });

// furniture for the player's home (can be bought more than once)
export const PET_FURNITURE_FROM = 16, HALLOWEEN_FURNITURE_FROM = 25, HALLOWEEN_FURNITURE_END = 31;
[
  ["Cozy Sofa", 300], ["Armchair", 180], ["Round Table", 150], ["Wooden Chair", 80],
  ["Comfy Bed", 400], ["Floor Lamp", 120], ["Potted Plant", 90], ["Bookshelf", 250],
  ["Big TV", 500], ["Round Rug", 140], ["Beanbag", 160], ["Fish Tank", 450],
  ["Arcade Machine", 800], ["Piano", 900], ["Gold Trophy", 1000], ["Toy Box", 110],
  // 16+: pet things, sold at the Pet Center (pets at home really use them: sleep, eat, drink, play)
  ["Pet Bed", 180], ["Food Bowl", 60], ["Water Bowl", 60], ["Bouncy Ball", 40], ["Chew Bone", 50],
  ["Yarn Ball", 45], ["Squeaky Duck", 55], ["Cat Tree", 350], ["Dog House", 450],
  // 25+: Halloween furniture (sold only during the Halloween event)
  ["Jack-o'-lantern", 450], ["Witch's Cauldron", 1200], ["Spooky Tombstone", 350], ["Haunted Tree", 900], ["Candy Bowl", 300], ["Ghost Lamp", 700],
  // 31+: the Big World collection (with a rarity)
  ["Lava Lamp", 400, "common"], ["Disco Ball", 1200, "rare"], ["Gaming Chair", 900, "rare"], ["Bunk Bed", 1300, "rare"], ["Telescope", 1100, "rare"],
  ["Jukebox", 2200, "epic"], ["Treasure Chest", 1000, "rare"], ["Royal Throne", 6000, "legendary"], ["Rocket Lamp", 700, "rare"], ["Bike Display", 3500, "epic"],
].forEach(([n, p, r], i) => {
  add("furniture", i, n, p);
  if (i >= PET_FURNITURE_FROM && i < HALLOWEEN_FURNITURE_FROM) items[items.length - 1].pet = true;
  if (i >= HALLOWEEN_FURNITURE_FROM && i < HALLOWEEN_FURNITURE_END) items[items.length - 1].event = "halloween";
  if (r) items[items.length - 1].rarity = r;
});
export const FURNITURE_COUNT = 41;

// emotes (the big faces above your head). Same order as EMOTES in public/index.html.
// Free ones belong to everybody; the rest are bought once in the shop or from the chat bar.
export const EMOTE_LIST = ["happy", "laugh", "love", "wow", "cool", "wink", "silly", "party", "shy", "sad", "angry", "sleepy"];
export const FREE_EMOTES = new Set(["happy", "wow", "sad"]);
const EMOTE_PRICE = { laugh: 150, love: 200, cool: 300, wink: 150, silly: 200, party: 400, shy: 150, angry: 250, sleepy: 150 };
const EMOTE_NAME = { happy: "Happy", laugh: "LOL", love: "Love", wow: "Wow", cool: "Cool", wink: "Wink", silly: "Silly", party: "Party", shy: "Shy", sad: "Sad", angry: "Angry", sleepy: "Sleepy" };
EMOTE_LIST.forEach((e, i) => {
  add("emote", i, EMOTE_NAME[e], FREE_EMOTES.has(e) ? 0 : EMOTE_PRICE[e]);
  if (FREE_EMOTES.has(e)) items[items.length - 1].free = true;
});
// can this player use this emote?
export function hasEmote(inventory, e) {
  if (FREE_EMOTES.has(e)) return true;
  const i = EMOTE_LIST.indexOf(e);
  return i >= 0 && (inventory || []).includes(`emote:${i}`);
}
export const MAX_FURNITURE = 60;

// auras: wild LEGENDARY effects all around the character. Same order as AURA_LIST in public/index.html.
[
  ["Flame Aura", 3000], ["Frost Storm", 3500], ["Heart Swirl", 3000], ["Thunder Storm", 4500],
  ["Rainbow Burst", 5000], ["Galaxy Orbit", 6000], ["Shadow Void", 7000], ["Golden Glory", 10000],
].forEach(([n, p], i) => {
  add("aura", i, n, p);
  items[items.length - 1].rarity = "legendary";
});
// store-only auras: they come in the special bundles of the Jumpi Store and can't be bought with coins
[["Sakura Breeze"], ["Crown of Stars"]].forEach(([n], k) => {
  add("aura", 8 + k, n, 0);
  Object.assign(items[items.length - 1], { rarity: "legendary", exclusive: true });
});
// the Big World collection
[["Butterfly Garden", 7000], ["Neon Beats", 8000]].forEach(([n, p], k) => { add("aura", 10 + k, n, p); items[items.length - 1].rarity = "legendary"; });

// vehicles (public/shared/vehicles.js): bought once, summoned from the phone's Garage, ridden in the open world
VEHICLES.forEach((v, i) => {
  add("vehicle", i, v.name, v.price);
  items[items.length - 1].rarity = v.rarity;
  if (v.member) items[items.length - 1].member = true;
});

export const CATALOG = items;
export const ITEMS = new Map(items.map((it) => [it.id, it]));
// the moderator set (shirt, pants, cap): moderators always have it while they are moderators
export const MOD_ITEMS = OUTFIT_SLOTS.flatMap((slot) => OUTFITS[slot].map((o, i) => (o.gift === "mod" ? `${slot}:${i}` : null)).filter(Boolean));

// highest index in each look slot (and whether it can be empty)
export const LOOK_SLOTS = {
  color: { max: 21, optional: false },
  eyes: { max: 17, optional: false },
  hair: { max: OUTFITS.hair.length - 1, optional: true },
  shirt: { max: OUTFITS.shirt.length - 1, optional: true },
  pants: { max: OUTFITS.pants.length - 1, optional: true },
  glasses: { max: OUTFITS.glasses.length - 1, optional: true },
  hat: { max: OUTFITS.hat.length - 1, optional: true },
  neck: { max: OUTFITS.neck.length - 1, optional: true },
  tag: { max: 17, optional: true },
  aura: { max: 11, optional: true },
};
// what sign-up may choose for free
export const STARTER_MAX = { color: 7, eyes: 7, hair: 3, shirt: 3, pants: 3, glasses: 3, hat: -1, neck: -1, tag: -1, aura: -1 };

// the item ids a look is wearing
export function lookItems(look = {}) {
  const out = [];
  for (const slot of Object.keys(LOOK_SLOTS)) {
    const i = look[slot];
    if (Number.isInteger(i) && i >= 0) out.push(`${slot}:${i}`);
  }
  return out;
}

// floor space of each furniture piece: [width, depth, depth offset] when not turned. Piece 9 (the rug) lies flat: things can stand on it.
export const FURN_FOOTPRINT = [[3.1,1.25,0],[1.45,1.25,0],[1.9,1.9,0],[.85,.85,0],[2.1,3.1,-.05],[.6,.6,0],[.7,.7,0],[2,.6,0],[2.4,.6,0],[3.2,3.2,0],[1.5,1.5,0],[1.8,.8,0],[1,.95,0],[2.4,1.95,.6],[.8,.8,0],[1.2,.9,0],
  [1.3,1.3,0],[.6,.6,0],[.6,.6,0],[.45,.45,0],[.6,.35,0],[.45,.45,0],[.45,.45,0],[1,1,0],[1.4,1.5,0],
  [.8,.8,0],[1.2,1.2,0],[.9,.4,0],[1.4,1.4,0],[.6,.6,0],[.6,.6,0],
  [.5,.5,0],[1,1,0],[.95,.95,0],[2.1,3.1,-.05],[1,1,0],[1.2,.8,0],[1.2,.8,0],[1.5,1.3,0],[.7,.7,0],[1.6,2.8,0]];
export const FLAT_FURNITURE = new Set([9]);
// the rectangle a placed piece covers on the floor
export function footprint({ f, x, z, r }) {
  const [w, d, oz] = FURN_FOOTPRINT[f], turned = r % 2 === 1, a = (r * Math.PI) / 2;
  const cx = x + oz * Math.sin(a), cz = z + oz * Math.cos(a), hw = (turned ? d : w) / 2, hd = (turned ? w : d) / 2;
  return [cx - hw, cz - hd, cx + hw, cz + hd];
}
export const HOME_BOUNDS = { halfW: 7.4, halfD: 5.6, door: [2.5, -5.6, 4.3, -4.2] };
const hits = (a, b) => a[0] < b[2] - 0.02 && a[2] > b[0] + 0.02 && a[1] < b[3] - 0.02 && a[3] > b[1] + 0.02;
// why this piece can't go there (given the pieces already placed), or null
// shape: houseShape(user.house) from public/shared/houses.js (bigger rooms, garden, second floor); none = the starter room
export function placeProblem(it, others, shape) {
  const fp = footprint(it), B = HOME_BOUNDS;
  if (shape) {
    const why = spotProblem(shape, fp);
    if (why) return why;
  } else {
    if (fp[0] < -B.halfW - 0.01 || fp[2] > B.halfW + 0.01 || fp[1] < -B.halfD - 0.01 || fp[3] > B.halfD + 0.01) return "Keep the furniture inside the room.";
    if (hits(fp, B.door)) return "Keep the door free so you can get out!";
  }
  const flat = FLAT_FURNITURE.has(it.f);
  for (const o of others) if (FLAT_FURNITURE.has(o.f) === flat && hits(fp, footprint(o))) return "There's already something there.";
  return null;
}
