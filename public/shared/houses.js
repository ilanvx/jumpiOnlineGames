/*
  Houses: every player starts with the Cozy Room, then buys upgrades with coins.
  Used by the game (to build and walk the house) and by the server (prices, where furniture may stand,
  where players may walk). Everything is on the ground (y = 0): the second floor is a room of its own
  further along x, reached by the stairs.

  Shapes (x across, z towards the camera):
    room:     -W..W  x  -D..D          (the exit door is on the back wall at x = 3.4)
    garden:   -W..W  x   D..D+GD       (in front of the room, open to it)
    pool:     inside the garden
    upstairs: UX-W..UX+W  x  -D..D     (same size as the room)
*/
export const HOUSE_UPGRADES = [
  { id: "big", name: "Bigger Room", price: 2500, about: "Knock the walls out: a much bigger room for more furniture and more friends." },
  { id: "garden", name: "Garden", price: 4000, about: "Grass, flowers, trees and a fence in front of your house. Furniture can go outside too!" },
  { id: "pool", name: "Swimming Pool", price: 6000, needs: "garden", about: "A pool built into your garden. Jump in and swim with your friends!" },
  { id: "upstairs", name: "Second Floor", price: 8000, about: "Stairs up to a whole second room, all yours to decorate." },
];
export const UPGRADE_BY_ID = Object.fromEntries(HOUSE_UPGRADES.map((u) => [u.id, u]));
export const UX = 60;   // where the second floor is
export const GD = 9;    // how deep the garden is

export function cleanHouse(h) {
  h = h || {};
  return { big: !!h.big, garden: !!h.garden, pool: !!h.garden && !!h.pool, upstairs: !!h.upstairs };
}
// all the measurements of one house
export function houseShape(h) {
  h = cleanHouse(h);
  const W = h.big ? 10.4 : 7.4, D = h.big ? 7.6 : 5.6;
  const s = { W, D, house: h, regions: [], blocked: [] };
  s.room = [-W, -D, W, D];
  s.regions.push(s.room);
  s.door = [2.5, -D, 4.3, -D + 1.4];                    // keep the exit door free
  s.blocked.push(s.door);
  if (h.garden) {
    s.garden = [-W, D, W, D + GD];
    s.regions[0] = [-W, -D, W, D + GD];   // the room is open to the garden: one floor space
    if (h.pool) { s.pool = [1.2, D + 1.8, Math.min(W - 1.2, 8.2), D + 6.8]; s.blocked.push(s.pool); }
  }
  if (h.upstairs) {
    s.up = [UX - W, -D, UX + W, D];
    s.regions.push(s.up);
    s.stairs = [-W, -D, -W + 2.4, -D + 3.4];           // the stairs up (in the room, back left corner)
    s.stairsUp = [UX - W, -D, UX - W + 2.4, -D + 3.4];  // the way down (upstairs, same corner)
    s.blocked.push(s.stairs, s.stairsUp);
  }
  // the box everything fits in (players can't move outside it)
  s.bounds = { x0: -W, x1: h.upstairs ? UX + W : W, z0: -D, z1: h.garden ? D + GD : D };
  return s;
}
const inside = (fp, r) => fp[0] >= r[0] - 0.01 && fp[2] <= r[2] + 0.01 && fp[1] >= r[1] - 0.01 && fp[3] <= r[3] + 0.01;
const hits = (a, b) => a[0] < b[2] - 0.02 && a[2] > b[0] + 0.02 && a[1] < b[3] - 0.02 && a[3] > b[1] + 0.02;
// why a piece with this floor space [x0, z0, x1, z1] can't stand there, or null
export function spotProblem(shape, fp) {
  if (!shape.regions.some((r) => inside(fp, r))) return "Keep the furniture inside your house.";
  if (hits(fp, shape.door)) return "Keep the door free so you can get out!";
  if (shape.pool && hits(fp, shape.pool)) return "That would fall in the pool!";
  if (shape.stairs && (hits(fp, shape.stairs) || hits(fp, shape.stairsUp))) return "Keep the stairs free!";
  return null;
}
// the region a point is in (or the nearest one), for keeping dragged furniture inside
export function regionAt(shape, x, z) {
  let best = shape.regions[0], bd = Infinity;
  for (const r of shape.regions) {
    const dx = Math.max(r[0] - x, 0, x - r[2]), dz = Math.max(r[1] - z, 0, z - r[3]), d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}
