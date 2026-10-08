import { BAR_MENU } from "./bar.js";

/*
  Food and drinks you carry with you (used by the game and the server).
  Whatever you get (the free Restaurant, the Dance Club bar, the Water Park stands) goes into your
  food bar: FOOD_SLOTS slots at the bottom left. Press 1-4 (or click a slot) to hold it, click the
  screen to take a bite / a sip. Every bite gives a share of the item's needs, so the hunger meter
  goes up a little each time. Half-eaten things stay half-eaten (saved in User.snacks).
  Only add menu items at the END of a list (the place in the list is the item number).
*/
export const FOOD_SLOTS = 4;

// the Restaurant on the Plaza (free)
export const DINER_MENU = [
  { name: "Pizza", type: "meal", c: "#e8423b", price: 0, needs: { hunger: 40, stamina: 5 } },
  { name: "Burger", type: "meal", c: "#ff8a1c", price: 0, needs: { hunger: 40, stamina: 5 } },
  { name: "Sushi", type: "meal", c: "#2f6fd6", price: 0, needs: { hunger: 35, stamina: 8 } },
  { name: "Ice cream", type: "snack", c: "#ff5fa8", price: 0, needs: { hunger: 22, fun: 8 } },
];

// the Water Park stands (cheap, coins only; no alcohol, ever)
export const PARK_STANDS = [
  // f: which way the counter faces (-1 = towards the sea / -z, 1 = towards the Park / +z)
  { id: "ice", name: "ICE CREAM", c: "#ff5fa8", x: 44, z: 6, f: -1 },
  { id: "snack", name: "SNACK SHACK", c: "#ff8a1c", x: 62, z: 20, f: -1 },
  { id: "drink", name: "SMOOTHIE BAR", c: "#1fb6ff", x: 72, z: -8, f: 1 },
];
export const PARK_MENU = [
  { stand: "ice", name: "Ice Pop", type: "snack", c: "#ff4f8a", price: 6, needs: { hunger: 10, fun: 6 } },
  { stand: "ice", name: "Ice Cream Cone", type: "snack", c: "#ffd1e3", price: 10, needs: { hunger: 18, fun: 8 } },
  { stand: "ice", name: "Sundae Cup", type: "snack", c: "#7a4a2a", price: 14, needs: { hunger: 24, fun: 10 } },
  { stand: "ice", name: "Cotton Candy", type: "snack", c: "#ff9ed8", price: 8, needs: { hunger: 10, fun: 12 } },
  { stand: "snack", name: "Hot Dog", type: "meal", c: "#e8423b", price: 14, needs: { hunger: 35, stamina: 5 } },
  { stand: "snack", name: "Corn on the Cob", type: "snack", c: "#ffd23a", price: 10, needs: { hunger: 22, stamina: 6 } },
  { stand: "snack", name: "Big Pretzel", type: "snack", c: "#b46a2a", price: 10, needs: { hunger: 22, stamina: 4 } },
  { stand: "snack", name: "Pizza Slice", type: "meal", c: "#ffb84a", price: 12, needs: { hunger: 30, stamina: 4 } },
  { stand: "snack", name: "Watermelon", type: "snack", c: "#4fc04a", price: 6, needs: { hunger: 12, stamina: 10 } },
  { stand: "drink", name: "Lemonade", type: "drink", c: "#f4ff6a", price: 8, needs: { stamina: 20, hunger: 8 } },
  { stand: "drink", name: "Coconut Water", type: "drink", c: "#f4f1ea", price: 10, needs: { stamina: 25, hunger: 8 } },
  { stand: "drink", name: "Rainbow Slushie", type: "drink", c: "#9b5cff", price: 12, needs: { stamina: 22, hunger: 8, fun: 10 } },
  { stand: "drink", name: "Pineapple Smoothie", type: "drink", c: "#ffc21a", price: 12, needs: { stamina: 25, hunger: 12 } },
  { stand: "drink", name: "Bubble Tea", type: "drink", c: "#c9a27a", price: 14, needs: { stamina: 25, hunger: 15, fun: 6 } },
];

export const MENUS = { diner: DINER_MENU, club: BAR_MENU, park: PARK_MENU };
const BITES = { meal: 6, snack: 5, drink: 6 };

export function foodOf(k, i) {
  const m = MENUS[k];
  return m && Number.isInteger(i) ? m[i] || null : null;
}
export const bitesOf = (it) => BITES[it?.type] || 5;
// what one bite / sip gives (every bite moves the hunger meter at least a little)
export function biteNeeds(it) {
  const n = bitesOf(it), o = {};
  for (const k in it.needs || {}) o[k] = it.needs[k] / n;
  o.hunger = Math.max(o.hunger || 0, 2);
  return o;
}
// how far from a Water Park stand you can still buy
export const STAND_REACH = 6;
