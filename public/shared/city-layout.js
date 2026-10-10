/*
  The big world: where every district, road, parking lot and dock is. Plain data, shared by the game
  (public/world/city.js builds it in 3D, the map paints it) and the server (bounds, parking for vehicles,
  the secret cave). Units are the game's steps; x goes east, z goes south (the sea is north, z < -21).

  The old heart of the world keeps its place: the Plaza (0,0), the Beach (north), the Park (south) and the
  Water Park (east). Everything else is around it, joined by roads with sidewalks.
*/

// roads: asphalt 8 wide with a 2.5 sidewalk on each side (ROAD_HALF = half the whole corridor)
export const ROAD_W = 8, WALK_W = 2.5, ROAD_HALF = ROAD_W / 2 + WALK_W;
export const ROADS = [
  { id: "harbor", name: "Harbor Road", z: -14, x0: -172, x1: -26 },
  { id: "ocean", name: "Ocean Drive", z: -12, x0: 100, x1: 284 },
  { id: "south", name: "Sunset Avenue", z: 80, x0: -172, x1: 190 },
  { id: "far", name: "Hillside Road", z: 154, x0: -172, x1: 190 },
  { id: "west", name: "Maple Street", x: -32, z0: -14, z1: 154 },
  { id: "west2", name: "Station Road", x: -100, z0: -14, z1: 154 },
  { id: "lane", name: "Park Lane", x: 36, z0: 44, z1: 154 },
  { id: "east", name: "Coral Avenue", x: 106, z0: -12, z1: 154 },
  { id: "air", name: "Airport Road", x: 182, z0: -12, z1: 154 },
];
export const roadRect = (r) => (r.z !== undefined ? [r.x0, r.z - ROAD_HALF, r.x1, r.z + ROAD_HALF] : [r.x - ROAD_HALF, r.z0, r.x + ROAD_HALF, r.z1]);

// districts: [x0, z0, x1, z1]; col = colour on the map / name banner
export const DISTRICTS = [
  { id: "harbor", name: "HARBOR & MARINA", short: "Harbor", rect: [-172, -82, -66, -20], col: "#1f7fd6", spawn: [-110, -28] },
  { id: "industrial", name: "WAREHOUSE DISTRICT", short: "Warehouses", rect: [-172, -8, -106, 74], col: "#7a8597", spawn: [-118, 30] },
  { id: "station", name: "JUMPI STATION", short: "Station", rect: [-94, -8, -38, 20], col: "#d9534f", spawn: [-66, 16] },
  { id: "shopping", name: "SHOPPING STREET", short: "Shopping", rect: [-94, 20, -38, 74], col: "#ff5fa8", spawn: [-66, 47] },
  { id: "residential", name: "MAPLE NEIGHBORHOOD", short: "Neighborhood", rect: [-94, 86, -38, 148], col: "#f2a33a", spawn: [-66, 117] },
  { id: "suburbs", name: "SUNNY HILLS SUBURBS", short: "Suburbs", rect: [-172, 86, -106, 148], col: "#e8c13a", spawn: [-139, 117] },
  { id: "centralpark", name: "CENTRAL PARK", short: "Central Park", rect: [-26, 86, 30, 148], col: "#2fb04e", spawn: [2, 96] },
  { id: "food", name: "FOOD STREET", short: "Food Street", rect: [42, 44, 100, 74], col: "#ff7a2f", spawn: [71, 68] },
  { id: "fun", name: "FUN DISTRICT", short: "Fun District", rect: [112, 44, 176, 74], col: "#9b5cff", spawn: [144, 68] },
  { id: "police", name: "POLICE STATION", short: "Police", rect: [112, -6, 176, 42], col: "#2f5bff", spawn: [144, 0] },
  { id: "school", name: "JUMPI SCHOOL", short: "School", rect: [42, 86, 100, 148], col: "#ffb21f", spawn: [71, 92] },
  { id: "hospital", name: "JUMPI HOSPITAL", short: "Hospital", rect: [112, 86, 176, 148], col: "#ff4f6d", spawn: [144, 92] },
  { id: "airport", name: "JUMPI AIRPORT", short: "Airport", rect: [188, -6, 284, 160], col: "#5aa0ff", spawn: [200, 40] },
  { id: "boardwalk", name: "THE BOARDWALK", short: "Boardwalk", rect: [28, -64, 284, -20], col: "#1fa3e8", spawn: [70, -24] },
  { id: "hills", name: "WHISPER HILLS", short: "Hills", rect: [-172, 160, 64, 244], col: "#3f8a3a", spawn: [-40, 166] },
  { id: "camp", name: "PINE LAKE CAMP", short: "Campground", rect: [64, 160, 190, 244], col: "#2f8f6a", spawn: [80, 168] },
];
export const DISTRICT_BY_ID = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));

// docks you walk on over the water (height 0.05): the quay and the piers of the marina
export const DECKS = [
  [-172, -46, -66, -20],                       // the quay
  ...[-152, -130, -108, -86].map((x) => [x - 1.6, -74, x + 1.6, -46]),   // four wooden piers
  [-172, -84, -164, -46],                      // the breakwater to the lighthouse
  [148.4, -74, 151.6, -26],                    // the fishing pier on the east beach
  [146.6, 188, 149.4, 199],                    // the canoe dock on Pine Lake
];
// small bridges, roads over water, etc. are part of the walk rects below

// joining the old areas to the new roads
export const CONNECTORS = [
  [-26.5, -19.5, -21, 24],      // Plaza west side → Maple Street (between and around the two shops)
  [-26, 59, -7.6, 74],          // behind the Pet Center, left → Sunset Avenue
  [7.6, 59, 26, 74],            // behind the Pet Center, right
  [28, -26, 284, -19.6],        // the long boardwalk promenade along the east beach
  [99, -17, 101, 42],           // Water Park east gate → Coral Avenue
  [26, 42.5, 29.6, 74],         // the grass strip along Park Lane, behind the Water Park
  [112, 41.5, 176, 44.5],       // between the Police Station square and the Fun District
  [100, -20, 284, -18],         // from the boardwalk straight onto Ocean Drive's sidewalk
];
// open land outside the named districts that you can still walk on (the far side of Whisper Hills, behind the airport)
export const OPEN_LAND = [
  [188, 150, 284, 244],
];

// water you can't walk into: lakes and ponds (ellipses) — bridges cross some of them
export const LAKES = [
  { id: "central", x: 2, z: 120, rx: 15, rz: 11 },
  { id: "camp", x: 148, z: 206, rx: 22, rz: 15 },
  { id: "falls", x: -60, z: 204, rx: 8, rz: 6 },
];
export const BRIDGES = [
  [-16, 118.6, 20, 121.4],      // Central Park: the wooden bridge across the lake
];
// places that are fenced off inside districts (the runway, rail tracks…)
export const BLOCKED = [
  [226, -6, 262, 160],          // airport runway + taxiway (behind the fence)
  [-172, -6.2, -106.5, -1.8],   // the rail tracks (Station Road crosses them at a level crossing)
  [-93.5, -6.2, -40, -1.8],
];

// parking lots: a vehicle left here stays; anywhere else it is towed after PARK_FREE_MS
export const PARK_FREE_MS = 5 * 60 * 1000;
export const PARKING = [
  { id: "station", name: "Station Parking", rect: [-92, 2, -74, 18] },
  { id: "shopping", name: "Shopping Parking", rect: [-58, 58, -40, 72] },
  { id: "harbor", name: "Marina Parking", rect: [-124, -40, -98, -24] },
  { id: "police", name: "Police Parking", rect: [150, 18, 174, 40] },
  { id: "hospital", name: "Hospital Parking", rect: [150, 122, 174, 146] },
  { id: "school", name: "School Parking", rect: [88, 104, 98, 122] },
  { id: "food", name: "Food Street Parking", rect: [82, 46, 98, 60] },
  { id: "fun", name: "Fun District Parking", rect: [114, 62, 130, 72] },
  { id: "airport", name: "Airport Parking", rect: [190, 122, 220, 150] },
  { id: "camp", name: "Camp Parking", rect: [70, 162, 94, 178] },
  { id: "park", name: "Central Park Parking", rect: [14, 88, 28, 100] },
  { id: "residential", name: "Neighborhood Parking", rect: [-92, 137, -78, 147] },
];

// the secret cave: its door is behind the waterfall in Whisper Hills; inside, it is its own little world far away
export const CAVE = {
  door: [-62, 212.4, -58, 214],               // walk into this (behind the waterfall, against the cliff) to go in
  out: [-54.6, 211.6],                        // where you come out, next to the pond
  x0: 300, x1: 330, z0: 262, z1: 292,         // the cave room
  enter: [315, 289], exit: [315, 291.2],      // arrive here; walk into the exit to leave
  chest: [315, 268],                          // the treasure chest
};

// the whole open world (the server keeps every player inside this box)
export const WORLD_BOUNDS = { x0: -172, x1: 335, z0: -84, z1: 295 };

export const inRect = (x, z, r, pad = 0) => x >= r[0] - pad && x <= r[2] + pad && z >= r[1] - pad && z <= r[3] + pad;
export const inLake = (x, z, pad = 0) => LAKES.some((L) => ((x - L.x) / (L.rx + pad)) ** 2 + ((z - L.z) / (L.rz + pad)) ** 2 < 1);
export const parkingAt = (x, z) => PARKING.find((p) => inRect(x, z, p.rect)) || null;
export const districtAt = (x, z) => DISTRICTS.find((d) => inRect(x, z, d.rect)) || null;
export const onDeck = (x, z) => DECKS.some((r) => inRect(x, z, r));
export const inCave = (x, z) => x >= CAVE.x0 && x <= CAVE.x1 && z >= CAVE.z0 && z <= CAVE.z1;
