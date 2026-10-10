/*
  Vehicles you own and ride in the open world (for now: motorcycles and scooters).
  Item id "vehicle:<index>" (the index in VEHICLES), bought once in the Shop (catalog.js reads this list).
  Only add new ones at the END: the index is the item number players own.

  How they work (realtime/vehicles.js on the server, the VEH block in public/index.html):
  - summon your vehicle from the Garage app on the phone: it appears next to you (one at a time);
  - only its owner can ride it;
  - left outside a parking lot (public/shared/city-layout.js PARKING) a timer shows above it, and after
    PARK_FREE_MS it is towed away (summon it again any time from the phone);
  - kind = the model; speed in steps per second (walking is 5.2, running 9.4).
*/
export const RARITY = {
  common: { name: "Common", col: "#7d8da3", rank: 0 },
  rare: { name: "Rare", col: "#2f8bff", rank: 1 },
  epic: { name: "Epic", col: "#9b5cff", rank: 2 },
  legendary: { name: "Legendary", col: "#ffb21f", rank: 3 },
};

// glow: a coloured light under the bike; trail: what it leaves behind when going fast (legendary)
export const VEHICLES = [
  { kind: "scooter", name: "Zippy Scooter", rarity: "common", price: 900, col: "#1fb6ff", col2: "#ffffff", speed: 12 },
  { kind: "scooter", name: "Mint Moped", rarity: "common", price: 900, col: "#5fe0c0", col2: "#fff6e0", speed: 12 },
  { kind: "cruiser", name: "City Cruiser", rarity: "common", price: 1400, col: "#e8423b", col2: "#2a2d36", speed: 14 },
  { kind: "cruiser", name: "Ocean Cruiser", rarity: "common", price: 1400, col: "#2f6bff", col2: "#f2f4f8", speed: 14 },
  { kind: "vespa", name: "Bubblegum Vespa", rarity: "rare", price: 2200, col: "#ff7ac8", col2: "#fff3fa", speed: 13 },
  { kind: "vespa", name: "Lemon Vespa", rarity: "rare", price: 2200, col: "#ffd23a", col2: "#ffffff", speed: 13 },
  { kind: "dirt", name: "Trail Buster", rarity: "rare", price: 2600, col: "#ff8a1c", col2: "#2a2d36", speed: 15 },
  { kind: "chopper", name: "Sunset Chopper", rarity: "rare", price: 2900, col: "#ff5a3c", col2: "#ffd23a", speed: 15 },
  { kind: "sport", name: "Thunder Sport", rarity: "rare", price: 3300, col: "#ffd23a", col2: "#1d1d24", speed: 17 },
  { kind: "dirt", name: "Jungle Ranger", rarity: "epic", price: 4800, col: "#3f8a3a", col2: "#c9a26b", speed: 16 },
  { kind: "chopper", name: "Midnight Chopper", rarity: "epic", price: 5600, col: "#24202c", col2: "#9b5cff", speed: 16, glow: "#9b5cff" },
  { kind: "sport", name: "Neon Racer", rarity: "epic", price: 6400, col: "#14d98c", col2: "#0d1a2a", speed: 18, glow: "#14ffa0" },
  { kind: "sport", name: "Ice Blade", rarity: "epic", price: 6400, col: "#bfe9ff", col2: "#2f6bff", speed: 18, glow: "#7fd6ff" },
  { kind: "sport", name: "Golden Thunder", rarity: "legendary", price: 12000, col: "#ffc21a", col2: "#1d1d24", speed: 20, metal: true, glow: "#ffd23a", trail: "sparkle" },
  { kind: "hover", name: "Phantom Hover", rarity: "legendary", price: 15000, col: "#2a2f4a", col2: "#5fe0ff", speed: 20, glow: "#5fe0ff", trail: "stars" },
  { kind: "sport", name: "Dragon Flame", rarity: "legendary", price: 18000, col: "#c8102e", col2: "#ff8a1c", speed: 21, glow: "#ff5a1c", trail: "fire" },
  { kind: "hover", name: "Rainbow Rocket", rarity: "legendary", price: 20000, col: "#ffffff", col2: "#ff5fa8", speed: 21, glow: "#ff9ccc", trail: "rainbow" },
];

export const VEH_SUMMON_GAP_MS = 5000;     // one summon every few seconds
export const VEH_REACH = 3.2;              // how close you must be to get on
export const vehicleOf = (i) => (Number.isInteger(i) && i >= 0 && i < VEHICLES.length ? VEHICLES[i] : null);
