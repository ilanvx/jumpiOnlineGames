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
  // the Members Club garage: only members can buy these (member: true)
  { kind: "vespa", name: "Royal Vespa", rarity: "epic", price: 4000, col: "#4a1670", col2: "#ffd23a", speed: 15, glow: "#ffd23a", member: true },
  { kind: "cruiser", name: "Platinum Cruiser", rarity: "epic", price: 4500, col: "#dfe7f5", col2: "#1f6bff", speed: 16, metal: true, glow: "#7fd6ff", member: true },
  { kind: "sport", name: "Galaxy Racer", rarity: "legendary", price: 10000, col: "#2a1f5c", col2: "#5fe0ff", speed: 20, glow: "#9b5cff", trail: "stars", member: true },
  { kind: "hover", name: "Members Hover", rarity: "legendary", price: 12000, col: "#ffc21a", col2: "#4a1670", speed: 21, metal: true, glow: "#ffd23a", trail: "sparkle", member: true },
  // the second garage: bicycles, boards and skates, carts and cars, and things that fly
  // (he = the Hebrew name; stand = the rider stands; every kind is built in public/world/bikes.js buildMore)
  { kind: "bicycle", name: "Picnic Basket Bike", he: "אופניים עם סל", rarity: "common", price: 700, col: "#5fc8b0", col2: "#fff3e0", speed: 11 },
  { kind: "bmx", name: "Stunt BMX", he: "אופני BMX", rarity: "common", price: 1100, col: "#ff4f8a", col2: "#1fb6ff", speed: 12.5 },
  { kind: "skate", name: "Street Skateboard", he: "סקייטבורד", rarity: "common", price: 800, col: "#ff8a1c", col2: "#ffd23a", speed: 11 },
  { kind: "blades", name: "Glow Rollerblades", he: "רולרבליידס זוהרים", rarity: "rare", price: 1800, col: "#2a2f4a", col2: "#5fe0ff", speed: 11.5, glow: "#5fe0ff" },
  { kind: "kick", name: "Kick Scooter", he: "טרוטינט", rarity: "common", price: 600, col: "#2fd36b", col2: "#1d1f26", speed: 10.5 },
  { kind: "kidscooter", name: "Rainbow Kiddie Scooter", he: "קורקינט צבעוני", rarity: "common", price: 650, col: "#9b5cff", col2: "#ffd23a", speed: 10, glow: "#ff7ac8" },
  { kind: "golf", name: "Sunny Golf Cart", he: "רכב גולף קטן", rarity: "rare", price: 2400, col: "#f4f6fa", col2: "#2fb36b", speed: 13 },
  { kind: "quad", name: "Mud Quad", he: "טרקטורון", rarity: "rare", price: 3000, col: "#e8423b", col2: "#2a2d36", speed: 16 },
  { kind: "bubblecar", name: "Bubble Car", he: "מכונית עגולה קטנה", rarity: "epic", price: 4000, col: "#7fd0ff", col2: "#fff3fa", speed: 15, member: true },
  { kind: "jeep", name: "Safari Jeep", he: "ג'יפ פתוח", rarity: "rare", price: 3400, col: "#6f8f3a", col2: "#2a2d36", speed: 16 },
  { kind: "tandem", name: "Buddy Tandem", he: "אופני טנדם", rarity: "rare", price: 1600, col: "#ffb21f", col2: "#2f6bff", speed: 12 },
  { kind: "sofa", name: "Flying Sofa", he: "ספה מעופפת", rarity: "epic", price: 5200, col: "#e86a8f", col2: "#ffe1ea", speed: 14, glow: "#ffb3cf" },
  { kind: "snowmobile", name: "Zoomy Snowmobile", he: "אופנוע שלג", rarity: "epic", price: 5000, col: "#1f6bff", col2: "#ffffff", speed: 16 },
  { kind: "jetski", name: "Splash Jet Ski", he: "אופנוע ים", rarity: "epic", price: 5400, col: "#ffd23a", col2: "#1fb6ff", speed: 17 },
  { kind: "cloud", name: "Fluffy Cloud", he: "ענן מעופף", rarity: "epic", price: 4500, col: "#ffffff", col2: "#dfeaff", speed: 17, glow: "#bfe0ff", trail: "rainbow", member: true },
  { kind: "carpet", name: "Magic Carpet", he: "שטיח מעופף", rarity: "legendary", price: 10000, col: "#8a1f6b", col2: "#ffc21a", speed: 18, glow: "#ffb3f0", trail: "sparkle", member: true },
  { kind: "sleigh", name: "Snowy Sleigh", he: "מזחלת איילים", rarity: "legendary", price: 11000, col: "#c8102e", col2: "#ffc21a", speed: 19, glow: "#ffe27a", trail: "stars", member: true },
  { kind: "ship", name: "Mini Spaceship", he: "חללית קטנה", rarity: "legendary", price: 12000, col: "#cfd8e6", col2: "#5fe0ff", speed: 21, glow: "#5fe0ff", trail: "stars", member: true },
  { kind: "supercar", name: "Golden Supercar", he: "מכונית ספורט זהב", rarity: "legendary", price: 12000, col: "#ffc21a", col2: "#1d1d24", speed: 21, metal: true, glow: "#ffd23a", trail: "sparkle", member: true },
  { kind: "airtrain", name: "Sky Train", he: "רכבת אוויר", rarity: "legendary", price: 10000, col: "#e8423b", col2: "#ffc21a", speed: 18, glow: "#7fd6ff", trail: "sparkle", member: true },
  // coin skateboards (a round coin deck with an embossed star)
  { kind: "coinboard", coin: "silver", name: "Silver Coin Board", he: "סקייטבורד מטבע כסף", rarity: "common", price: 1200, col: "#dfe6ee", col2: "#ffffff", speed: 12 },
  { kind: "coinboard", coin: "gold", name: "Gold Coin Board", he: "סקייטבורד מטבע זהב", rarity: "rare", price: 2600, col: "#ffc21a", col2: "#ffffff", speed: 12.5, glow: "#ffd23a" },
  { kind: "coinboard", coin: "rose", name: "Rose Gold Coin Board", he: "סקייטבורד מטבע זהב ורוד", rarity: "rare", price: 2600, col: "#f2a58e", col2: "#ffffff", speed: 12.5, glow: "#ffb3a0" },
  { kind: "coinboard", coin: "rainbow", name: "Rainbow Coin Board", he: "סקייטבורד מטבע קשת", rarity: "epic", price: 4800, col: "#ffffff", col2: "#ffffff", speed: 13, glow: "#ff9ccc", trail: "rainbow" },
  // the Future City garage (Hover Motors in the Sky Mall; world: "future"): they float above the ground
  { kind: "hover", name: "Neon Glider", he: "רחפת ניאון", rarity: "rare", price: 2800, col: "#14162a", col2: "#59e0ff", speed: 17, glow: "#59e0ff", world: "future" },
  { kind: "hover", name: "Pink Pulse Hover", he: "רחפת פולס ורודה", rarity: "rare", price: 2800, col: "#f2f6ff", col2: "#ff4fd8", speed: 17, glow: "#ff4fd8", world: "future" },
  { kind: "hover", name: "Sky Cruiser", he: "שייטת שמיים", rarity: "epic", price: 4200, col: "#ffd65a", col2: "#1d2433", speed: 18, glow: "#ffd65a", trail: "sparkle", world: "future" },
  { kind: "bubblecar", name: "Bubble Pod", he: "פוד בועה", rarity: "rare", price: 3200, col: "#9fe8ff", col2: "#ffffff", speed: 15, glow: "#9fe8ff", world: "future" },
  { kind: "bubblecar", name: "Robo Pod", he: "פוד רובוט", rarity: "epic", price: 4600, col: "#c9d2e3", col2: "#7dff9b", speed: 16, glow: "#7dff9b", metal: true, world: "future" },
  { kind: "sofa", name: "Hover Couch 3000", he: "ספת ריחוף 3000", rarity: "epic", price: 5200, col: "#7d5cff", col2: "#59e0ff", speed: 15, glow: "#59e0ff", world: "future" },
  { kind: "cloud", name: "Data Cloud", he: "ענן נתונים", rarity: "epic", price: 5600, col: "#bff6ff", col2: "#59e0ff", speed: 17, glow: "#59e0ff", trail: "stars", world: "future" },
  { kind: "hover", name: "Star Racer", he: "מרוצת כוכבים", rarity: "legendary", price: 6000, col: "#1b1446", col2: "#ffd65a", speed: 20, glow: "#c58bff", trail: "stars", world: "future" },
];

export const VEH_SUMMON_GAP_MS = 5000;     // one summon every few seconds
export const VEH_REACH = 3.2;              // how close you must be to get on
export const vehicleOf = (i) => (Number.isInteger(i) && i >= 0 && i < VEHICLES.length ? VEHICLES[i] : null);
