/*
  THE FUTURE WORLD (public/world/future.js builds it; the server uses the bounds and the places).
  It stands far away from the old world (OX, OZ), so nothing from the old world (stands, doors, the sea) ever reaches it.
  Every place below is in LOCAL steps around the middle of the island; at() turns it into world steps.
  Nothing overlaps in height: the roof of the Sky Tower stands over its own walls, the Sky Bridge over the hover canyon,
  so one spot always has one floor (the ground under them can't be walked on).
*/
export const OX = 3000, OZ = 150;
export const at = (lx, lz) => [OX + lx, OZ + lz];
export const UNLOCK_COST = 70000, START_GIFT = 2000;

// the island (walkable ground inside, the sea outside)
export const ISLAND = { x0: -118, x1: 118, z0: -96, z1: 100 };
export const FUTURE_BOUNDS = { x0: OX - 130, x1: OX + 130, z0: OZ - 110, z1: OZ + 115 };

// buildings you can't walk into (local [x0, z0, x1, z1]); the mall is open inside (MALL.inside)
export const MALL = { rect: [-92, -18, -30, 36], inside: [-88, -14, -34, 32], door: [-34, 4, -28, 16], floors: 4, ceil: 10 };
export const HOTEL = { rect: [34, -18, 92, 36], door: [28, 4, 34, 16], spot: [30, 10] };     // the hotel job starts at its door
export const TOWER = { rect: [-14, -58, 14, -30], roof: [-12, -56, 12, -32], roofY: 48, pad: [0, -26], roofPad: [0, -34] };
export const CANYON = { rect: [-30, -84, 30, -64] };                                          // the hover lane: flying cars pass through
export const BRIDGE = { strip: [-29, -76, 29, -72], y: 26, towers: [[-42, -74], [42, -74]], pads: [[-42, -64], [42, -64]], ends: [[-26, -74], [26, -74]] };   // walkable only over the canyon (a gap to the street below)
export const BLOCKS = [   // more tall buildings around the square (solid)
  [-108, -88, -78, -60], [-70, -92, -42, -62], [42, -92, 70, -62], [78, -88, 108, -60],
  [-110, 48, -84, 74], [84, 48, 110, 74], [-62, 50, -38, 74], [38, 50, 62, 74],
];
export const LANDING = { pad: [0, 82], spawn: [0, 74], r: 9 };           // where the time machine lands (and leaves from)
export const SQUARE = { c: [0, 16], r: 22 };                             // Neon Square in the middle

export const FW_ZONES = [
  { id: "f-landing", col: "#ffd65a", name: "TIME PORT", rect: [-22, 66, 22, 100] },
  { id: "f-square", col: "#59e0ff", name: "NEON SQUARE", rect: [-28, -10, 28, 50] },
  { id: "f-mall", col: "#ff4fd8", name: "SKY MALL", rect: [-96, -22, -28, 40] },
  { id: "f-hotel", col: "#ff9a4a", name: "GRAND HOTEL", rect: [28, -22, 96, 40] },
  { id: "f-tower", col: "#7fa8ff", name: "SKY TOWER", rect: [-30, -62, 30, -26] },
  { id: "f-bridge", col: "#c58bff", name: "SKY BRIDGE", rect: [-50, -96, 50, -62] },
  { id: "f-park", col: "#7dff9b", name: "GLOW PARK", rect: [-118, 40, 118, 100] },
];
export const FW_SPAWNS = { "f-landing": [0, 74], "f-square": [0, 34], "f-mall": [-24, 10], "f-hotel": [24, 10], "f-tower": [0, -22], "f-bridge": [-42, -58], "f-park": [-60, 84] };

// the mini-game stands (the three tech games) and the shops in the mall (local)
export const FW_STATIONS = [
  { id: "drone", x: -14, z: 46 }, { id: "robot", x: 0, z: 50 }, { id: "rooftops", x: 14, z: 46 },
];
export const FW_SHOPS = [
  { id: "f-fashion", kind: "shirt", x: -80, z: -6, title: "NEO FASHION" },
  { id: "f-tech", kind: "glasses", x: -60, z: -10, title: "GADGET LAB" },
  { id: "f-hover", kind: "vehicle", x: -40, z: -6, title: "HOVER MOTORS" },
  { id: "f-style", kind: "hair", x: -80, z: 26, title: "FUTURE STYLE" },
  { id: "f-home", kind: "furniture", x: -48, z: 28, title: "SMART HOME" },
  { id: "f-hats", kind: "hat", x: -64, z: 26, title: "HAT HUB" },
];
// every shop is a real little room against the mall wall that you walk into through a sliding glass door:
// back wall zb, glass front zf (the door in the middle of it), and the spot in front of the counter where you shop
export const SHOP_W = 12, SHOP_D = 12, SHOP_DOOR = 3.4;
export function shopRoom(s) { const back = s.z < 10 ? -1 : 1, zb = back < 0 ? MALL.inside[1] : MALL.inside[3], zf = zb - back * SHOP_D;
  return { back, zb, zf, x0: s.x - SHOP_W / 2, x1: s.x + SHOP_W / 2, spot: [s.x, zb - back * 4.8] }; }

const inR = (x, z, r, pad = 0) => x >= r[0] - pad && x <= r[2] + pad && z >= r[1] - pad && z <= r[3] + pad;
export const toLocal = (x, z) => [x - OX, z - OZ];
export const inFuture = (x, z) => inR(x - OX, z - OZ, [ISLAND.x0 - 12, ISLAND.z0 - 12, ISLAND.x1 + 12, ISLAND.z1 + 12]);

// one floor everywhere: the height of the ground (null = not walkable)
export function futureGround(x, z) {
  const [lx, lz] = toLocal(x, z);
  if (inR(lx, lz, TOWER.roof)) return TOWER.roofY;
  if (inR(lx, lz, BRIDGE.strip)) return BRIDGE.y;
  return 0;
}
export function futureWalk(x, z) {
  const [lx, lz] = toLocal(x, z);
  if (inR(lx, lz, TOWER.roof)) return true;                       // up on the roof (got there by the lift)
  if (inR(lx, lz, BRIDGE.strip)) return true;                     // on the bridge
  if (!inR(lx, lz, [ISLAND.x0, ISLAND.z0, ISLAND.x1, ISLAND.z1])) return false;
  if (inR(lx, lz, TOWER.rect, 1.2) || inR(lx, lz, CANYON.rect, 1.2)) return false;
  for (const t of BRIDGE.towers) if (Math.abs(lx - t[0]) < 7 && Math.abs(lz - t[1]) < 7) return false;
  if (inR(lx, lz, MALL.inside) || inR(lx, lz, MALL.door)) return true;
  if (inR(lx, lz, MALL.rect, 0.8) || inR(lx, lz, HOTEL.rect, 0.8)) return false;
  for (const b of BLOCKS) if (inR(lx, lz, b, 0.8)) return false;
  return true;
}
// is there a building here taller than the floor you stand on (the camera shouldn't go inside it)
export function futureSolid(x, z, standY = 0) {
  const [lx, lz] = toLocal(x, z);
  if (inR(lx, lz, TOWER.rect)) return standY < TOWER.roofY - 1 || !inR(lx, lz, TOWER.roof, 0.5);
  for (const t of BRIDGE.towers) if (Math.abs(lx - t[0]) < 7 && Math.abs(lz - t[1]) < 7) return true;
  if (inR(lx, lz, HOTEL.rect)) return true;
  if (inR(lx, lz, MALL.rect) && !inR(lx, lz, MALL.inside)) return standY < 20;
  for (const b of BLOCKS) if (inR(lx, lz, b)) return true;
  return false;
}
export function futureZone(x, z) {
  const [lx, lz] = toLocal(x, z);
  if (inR(lx, lz, TOWER.roof)) return "f-tower";
  if (inR(lx, lz, BRIDGE.strip)) return "f-bridge";
  for (const Z of FW_ZONES) if (inR(lx, lz, Z.rect)) return Z.id;
  return "f-square";
}
// the lifts: stand on a pad and press E (or tap) to go up / down: [from local, to local, label]
export const LIFTS = [
  { id: "tower-up", at: TOWER.pad, to: TOWER.roofPad, name: "Sky Tower roof" },
  { id: "tower-down", at: TOWER.roofPad, to: [TOWER.pad[0], TOWER.pad[1] + 2], name: "Down to the street" },
  { id: "bridge-w-up", at: BRIDGE.pads[0], to: BRIDGE.ends[0], name: "Sky Bridge" },
  { id: "bridge-e-up", at: BRIDGE.pads[1], to: BRIDGE.ends[1], name: "Sky Bridge" },
  { id: "bridge-w-down", at: BRIDGE.ends[0], to: [BRIDGE.pads[0][0], BRIDGE.pads[0][1] + 2], name: "Down to the street" },
  { id: "bridge-e-down", at: BRIDGE.ends[1], to: [BRIDGE.pads[1][0], BRIDGE.pads[1][1] + 2], name: "Down to the street" },
];
