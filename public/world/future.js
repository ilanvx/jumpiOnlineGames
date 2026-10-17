/*
  THE FUTURE WORLD: a neon city on an island (the layout is in /shared/future-layout.js, shared with the server).
  Built like city.js to stay fast on phones:
  - static pieces are painted into an accumulator and merged into one mesh per material per area;
  - flying cars, robots, trees and lights are a few InstancedMesh / Points, moved every frame without new objects;
  - far areas are hidden and far towers keep only their simple body (no antennas, signs or lights): update() does it;
  - lowFx (battery saver / low graphics) keeps fewer flying cars and robots and no hologram sparkles.
  index.html calls buildFuture(host) once (when the player first travels there), then fw.update(t, dt, cam, lowFx)
  every frame and fw.night(k) from the weather, and asks fw.liftAt(x, z) / fw.doorNear(x, z).
*/
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as FL from "../shared/future-layout.js";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const W = (lx, lz) => FL.at(lx, lz);   // local → world

/* ---------- textures ---------- */
const TEX = new Map();
function canvasTex(key, w, h, draw, { repeat = true, srgb = true } = {}) {
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h, c);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; TEX.set(key, t); return t;
}
// floor tiles: dark grey squares with thin glowing seams
const floorTex = () => canvasTex("fw-floor", 256, 256, (x, w, h) => {
  x.fillStyle = "#3a4458"; x.fillRect(0, 0, w, h); const R = rng(4);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = `hsl(220,16%,${30 + R() * 8}%)`; x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
  x.strokeStyle = "rgba(90,220,255,.55)"; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); }
});
const floorGlow = () => canvasTex("fw-floor-e", 256, 256, (x, w, h) => {
  x.fillStyle = "#000"; x.fillRect(0, 0, w, h); x.strokeStyle = "#59e0ff"; x.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); }
});
// tower windows: rows of glass, some lit (emissive map lights them at night)
function windowsTex(key, glass, lit, seed) {
  const map = canvasTex("fw-win" + key, 256, 256, (x, w, h) => {
    x.fillStyle = "#1b2233"; x.fillRect(0, 0, w, h); const R = rng(seed);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { { const g = x.createLinearGradient(0, r * 32 + 5, 0, r * 32 + 27); g.addColorStop(0, R() < 0.55 ? glass : "#3a4a6e"); g.addColorStop(1, "#1d2840"); x.fillStyle = g; x.fillRect(c * 64 + 6, r * 32 + 5, 52, 22); } }
    x.fillStyle = "rgba(255,255,255,.08)"; x.fillRect(0, 0, w, 3);
  });
  const em = canvasTex("fw-wine" + key, 256, 256, (x, w, h) => {
    x.fillStyle = "#000"; x.fillRect(0, 0, w, h); const R = rng(seed + 99);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) if (R() < 0.32) { x.fillStyle = R() < 0.6 ? lit : "#ffd98a"; x.fillRect(c * 64 + 6, r * 32 + 5, 52, 22); }
  });
  return { map, em };
}
function textTex(key, text, { bg = "#0b1230", fg = "#5ff3ff", w = 512, h = 128, size = 76, font = "'HeeboDisplay','Lilita One',sans-serif", glow = fg, border = fg } = {}) {
  const I = typeof window !== "undefined" && window.I18N; if (I && I.lang === "he") text = I.T(text);   // signs in Hebrew too
  return canvasTex("fw-txt" + key + (I ? I.lang : ""), w, h, (x) => {
    x.fillStyle = bg; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 26); x.fill();
    x.lineWidth = 6; x.strokeStyle = border; x.shadowColor = glow; x.shadowBlur = 18; x.stroke();
    let sz = size; x.font = `${sz}px ${font}`; while (sz > 20 && x.measureText(text).width > w - 40) { sz -= 4; x.font = `${sz}px ${font}`; } x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = fg; x.shadowBlur = 24; x.fillText(text, w / 2, h / 2 + 4); x.shadowBlur = 0;
  }, { repeat: false });
}
function glowDot(inner, outer) { return canvasTex("fw-dot" + inner + outer, 128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(0.35, outer); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }, { repeat: false }); }

/* ---------- materials (neon glows more at night: night(k)) ---------- */
const MATS = new Map(), NIGHT = [];
function M(color, o = {}) { const key = color + JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v)); if (MATS.has(key)) return MATS.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2, ...o }); MATS.set(key, m); return m; }
function neon(color, day = 0.8, night = 2.2) { const key = "neon" + color + day + night; if (MATS.has(key)) return MATS.get(key);
  const m = new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: day, roughness: 0.35, metalness: 0.1 }); m.userData.day = day; m.userData.night = night; NIGHT.push(m); MATS.set(key, m); return m; }
function winMat(key, glass, lit, seed) { const k = "win" + key; if (MATS.has(k)) return MATS.get(k);
  const t = windowsTex(key, glass, lit, seed), m = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.em, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.15, roughness: 0.25, metalness: 0.4 });
  m.userData.day = 0.15; m.userData.night = 1.0; NIGHT.push(m); MATS.set(k, m); return m; }
const GLASS = () => M("#9fe8ff", { transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.6, depthWrite: false });
const STEEL = () => M("#c9d2e3", { metalness: 0.75, roughness: 0.3 });
const DARK = () => M("#1d2433", { metalness: 0.5, roughness: 0.45 });
const WHITE = () => M("#eef3fb", { metalness: 0.25, roughness: 0.35 });

/* ---------- accumulator: many pieces → one mesh per material ---------- */
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const GEO = new Map(); const unit = (k, f) => { if (!GEO.has(k)) GEO.set(k, f()); return GEO.get(k); };
const boxG = () => unit("box", () => new THREE.BoxGeometry(1, 1, 1));
const cylG = (seg) => unit("cyl" + seg, () => new THREE.CylinderGeometry(1, 1, 1, seg));
const sphG = () => unit("sph", () => new THREE.SphereGeometry(1, 16, 12));
const torG = () => unit("tor", () => new THREE.TorusGeometry(1, 0.06, 8, 40));
function m4(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) { _e.set(rx, ry, rz, "YXZ"); _q.setFromEuler(_e); return new THREE.Matrix4().compose(_v.set(x, y, z), _q.clone(), _s.set(sx, sy, sz)); }
class Acc {
  constructor() { this.parts = new Map(); }
  add(geo, mat, mx, cast = true) { let g = geo.clone(); g.applyMatrix4(mx);
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (g.index) g = g.toNonIndexed(); g.clearGroups();
    const key = mat.uuid + (cast ? "c" : "n"); let p = this.parts.get(key); if (!p) this.parts.set(key, (p = { mat, cast, geos: [] })); p.geos.push(g); }
  build(group) { for (const p of this.parts.values()) { const g = mergeGeometries(p.geos, false); if (!g) continue; g.computeBoundingSphere();
    const ms = new THREE.Mesh(g, p.mat); ms.castShadow = p.cast && !p.mat.transparent; ms.receiveShadow = true; ms.matrixAutoUpdate = false; group.add(ms); } this.parts.clear(); }
}
class P {   // a painter in world steps
  constructor(acc) { this.acc = acc; }
  box(w, h, d, mat, x, y, z, ry = 0, cast = true) { this.acc.add(boxG(), mat, m4(x, y, z, ry, w, h, d), cast); return this; }
  cyl(r, h, mat, x, y, z, seg = 16, cast = true, r2 = null) { const g = r2 === null ? cylG(seg) : unit(`cyl${seg}-${(r2 / r).toFixed(3)}`, () => new THREE.CylinderGeometry(r2 / r, 1, 1, seg)); this.acc.add(g, mat, m4(x, y, z, 0, r, h, r), cast); return this; }
  sphere(r, mat, x, y, z, sy = 1) { this.acc.add(sphG(), mat, m4(x, y, z, 0, r, r * sy, r)); return this; }
  ring(r, mat, x, y, z, rx = Math.PI / 2, ry = 0, thick = 1) { this.acc.add(torG(), mat, m4(x, y, z, ry, r, r, r * thick, rx), false); return this; }
  geo(g, mat, cast = false) { this.acc.add(g, mat, new THREE.Matrix4(), cast); return this; }
}
function plateGeo(x0, z0, x1, z1, y, tile) { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / tile, uv.getY(i) * (z1 - z0) / tile); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2); return g; }
// tower walls with the window texture repeated by floors
function towerGeo(w, d, h, y0 = 0) { let g = new THREE.BoxGeometry(w, h, d); g.translate(0, y0 + h / 2, 0); const uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) { const side = Math.abs(n.getX(i)) > 0.5 ? d : w; uv.setXY(i, uv.getX(i) * side / 8, uv.getY(i) * h / 8); }
  // drop the top and bottom faces (box faces 2 and 3: 6 indices each); the roof is added with its own material
  const idx = [...g.index.array]; g.setIndex([...idx.slice(0, 12), ...idx.slice(24)]); return g; }
function roundGeo(r, h, y0 = 0, seg = 28) { const g = new THREE.CylinderGeometry(r, r, h, seg, 1, true); g.translate(0, y0 + h / 2, 0); const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (TAU * r) / 8, uv.getY(i) * h / 8); return g; }
const ROOF = () => M("#b9c3d3", { metalness: 0.5, roughness: 0.45 });
// a tower piece: window walls + a light metal roof with a glowing edge
function tower(p, w, d, h, mat, x, y, z, edge = "#59e0ff") {
  p.acc.add(towerGeo(w, d, h), mat, m4(x, y, z), true);
  p.box(w + 0.4, 0.5, d + 0.4, ROOF(), x, y + h + 0.25, z).box(w + 0.5, 0.14, d + 0.5, neon(edge, 0.6, 2.2), x, y + h + 0.55, z, 0, false);
}
function roundTower(p, r, h, mat, x, y, z, edge = "#59e0ff") {
  p.acc.add(roundGeo(r, h), mat, m4(x, y, z), true);
  p.cyl(r + 0.2, 0.5, ROOF(), x, y + h + 0.25, z, 28).cyl(r + 0.3, 0.14, neon(edge, 0.6, 2.2), x, y + h + 0.55, z, 28, false);
}
// the bits on a roof (only drawn close by): air boxes, a helipad, a garden or a spire
function roofTop(fp, kind, x, y, z, w, d, col, R) {
  if (kind === "pad") { const r = Math.min(w, d) * 0.36; fp.cyl(r, 0.12, DARK(), x, y + 0.08, z, 32, false).ring(r - 0.3, neon("#ffd65a", 0.8, 2.6), x, y + 0.2, z, Math.PI / 2, 0, 0.25).box(r * 0.9, 0.04, 0.35, WHITE(), x, y + 0.2, z, 0, false).box(0.35, 0.04, r * 0.9, WHITE(), x - r * 0.3, y + 0.2, z, 0, false).box(0.35, 0.04, r * 0.9, WHITE(), x + r * 0.3, y + 0.2, z, 0, false); return; }
  if (kind === "garden") { fp.box(w * 0.8, 0.4, d * 0.8, M("#5fbf62", { roughness: 0.9, metalness: 0 }), x, y + 0.2, z, 0, false); for (let k = 0; k < 4; k++) fp.sphere(1.2 + R() * 0.6, neon(["#7dff9b", "#59e0ff", "#ff7af0"][k % 3], 0.3, 1.3), x + (R() - 0.5) * w * 0.6, y + 1.6, z + (R() - 0.5) * d * 0.6, 1.1); return; }
  if (kind === "spire") { fp.cyl(0.9, 10, STEEL(), x, y + 5, z, 12, true, 0.15).sphere(0.5, neon(col, 1.2, 3), x, y + 10.4, z); return; }
  for (let k = 0; k < 3; k++) fp.box(2 + R() * 2, 1.2 + R(), 1.6 + R() * 2, M("#8e98aa", { metalness: 0.6, roughness: 0.4 }), x + (R() - 0.5) * w * 0.5, y + 0.8, z + (R() - 0.5) * d * 0.5);
  fp.cyl(0.18, 6, STEEL(), x + w * 0.3, y + 3, z - d * 0.3, 6).sphere(0.35, neon("#ff5f5f", 1.2, 3), x + w * 0.3, y + 6.2, z - d * 0.3);
}

/* =====================================================================
   BUILD
   ===================================================================== */
export function buildFuture(host = {}) {
  const root = new THREE.Group(); root.name = "future";
  const areas = [];   // { group, cx, cz, far: detail group hidden when far }
  const area = (lx, lz) => { const g = new THREE.Group(), far = new THREE.Group(); g.add(far); root.add(g); const [cx, cz] = W(lx, lz); const a = { g, far, cx, cz, acc: new Acc(), facc: new Acc() }; areas.push(a); return a; };
  const anim = [], seats = [], colliders = [], doors = [], lifts = [];
  const R = rng(2077);

  /* ---------- the sea and the island ---------- */
  {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#2386d8", roughness: 0.12, metalness: 0.3, emissive: new THREE.Color("#073a75"), emissiveIntensity: 0.35 }));
    const [sx, sz] = W(0, 0); sea.position.set(sx, -0.9, sz); sea.receiveShadow = false; root.add(sea);
    const a = area(0, 0), p = new P(a.acc);
    const I = FL.ISLAND, [x0, z0] = W(I.x0, I.z0), [x1, z1] = W(I.x1, I.z1);
    const ft = floorTex(), fe = floorGlow(); [ft, fe].forEach((t) => t.repeat.set(1, 1));
    const floor = new THREE.MeshStandardMaterial({ map: ft, emissiveMap: fe, emissive: new THREE.Color("#59e0ff"), emissiveIntensity: 0.25, roughness: 0.55, metalness: 0.35 }); floor.userData.day = 0.25; floor.userData.night = 0.9; NIGHT.push(floor);
    p.geo(plateGeo(x0, z0, x1, z1, 0, 16), floor);
    // the island edge: a thick glowing rim above the water
    p.box(x1 - x0 + 2, 2, 2, DARK(), (x0 + x1) / 2, -0.95, z0 - 1).box(x1 - x0 + 2, 2, 2, DARK(), (x0 + x1) / 2, -0.95, z1 + 1).box(2, 2, z1 - z0, DARK(), x0 - 1, -0.95, (z0 + z1) / 2).box(2, 2, z1 - z0, DARK(), x1 + 1, -0.95, (z0 + z1) / 2);
    const rim = neon("#38e1ff", 0.9, 2.4);
    p.box(x1 - x0 + 2, 0.12, 0.25, rim, (x0 + x1) / 2, 0.06, z0 - 0.2, 0, false).box(x1 - x0 + 2, 0.12, 0.25, rim, (x0 + x1) / 2, 0.06, z1 + 0.2, 0, false).box(0.25, 0.12, z1 - z0, rim, x0 - 0.2, 0.06, (z0 + z1) / 2, 0, false).box(0.25, 0.12, z1 - z0, rim, x1 + 0.2, 0.06, (z0 + z1) / 2, 0, false);
    // glowing walkways that cross the island
    const lane = neon("#ff4fd8", 0.6, 2), lane2 = neon("#59e0ff", 0.6, 2);
    [[0, 66, 0, 40], [-28, 16, -24, 16], [28, 16, 24, 16]].forEach(([ax, az, bx, bz]) => { const [wx, wz] = W((ax + bx) / 2, (az + bz) / 2), L = Math.hypot(bx - ax, bz - az) || 1, vert = ax === bx; p.box(vert ? 0.18 : L, 0.03, vert ? L : 0.18, lane, wx - (vert ? 3 : 0), 0.02, wz - (vert ? 0 : 3), 0, false).box(vert ? 0.18 : L, 0.03, vert ? L : 0.18, lane2, wx + (vert ? 3 : 0), 0.02, wz + (vert ? 0 : 3), 0, false); });
    a.acc.build(a.g);
  }

  /* ---------- Neon Square: the hologram fountain, benches, the big screens ---------- */
  {
    const a = area(...FL.SQUARE.c), p = new P(a.acc), [cx, cz] = W(...FL.SQUARE.c);
    p.cyl(FL.SQUARE.r, 0.12, M("#3a4560", { metalness: 0.4, roughness: 0.4 }), cx, 0.06, cz, 48, false);
    p.ring(FL.SQUARE.r - 0.3, neon("#59e0ff", 0.8, 2.4), cx, 0.14, cz, Math.PI / 2, 0, 0.2);
    p.ring(8, neon("#ff4fd8", 0.8, 2.4), cx, 0.14, cz, Math.PI / 2, 0, 0.2);
    p.cyl(6.4, 0.7, STEEL(), cx, 0.35, cz, 40).cyl(5.9, 0.08, M("#1fb6ff", { transparent: true, opacity: 0.75, roughness: 0.05, metalness: 0.3, emissive: new THREE.Color("#0b6fd6"), emissiveIntensity: 0.6 }), cx, 0.72, cz, 40, false);
    p.cyl(0.8, 3.2, STEEL(), cx, 1.6, cz, 16);
    colliders.push({ c: [cx, cz], r: 6.8 });
    // benches around
    for (let i = 0; i < 8; i++) { const a2 = i / 8 * TAU + 0.2, bx = cx + Math.cos(a2) * 15.5, bz = cz + Math.sin(a2) * 15.5, ry = -a2 + Math.PI / 2;
      p.box(3, 0.18, 0.9, WHITE(), bx, 0.55, bz, ry).box(3, 0.7, 0.14, WHITE(), bx + Math.cos(a2) * 0.42, 0.9, bz + Math.sin(a2) * 0.42, ry).box(2.8, 0.06, 0.06, neon("#59e0ff"), bx, 0.44, bz, ry, false);
      [-1, 1].forEach((s) => p.box(0.12, 0.5, 0.7, DARK(), bx + Math.cos(ry) * s * 1.3, 0.25, bz - Math.sin(ry) * s * 1.3, ry));
      seats.push({ x: bx - Math.cos(a2) * 0.05, z: bz - Math.sin(a2) * 0.05, f: Math.atan2(cx - bx, cz - bz), y: 0.62, k: "sit" }); colliders.push({ c: [bx, bz], r: 1.2 }); }
    // the hologram: a slowly turning Jumpi made of light rings + sparkles
    const holo = new THREE.Group(); holo.position.set(cx, 3.4, cz); a.far.add(holo);
    const hm = new THREE.MeshBasicMaterial({ color: "#7ff6ff", transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 7; i++) { const r = Math.sin((i + 0.5) / 7 * Math.PI) * 2.1 + 0.2, t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 6, 40), hm); t.rotation.x = Math.PI / 2; t.position.y = i * 0.55; holo.add(t); }
    const eyeM = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    [-0.6, 0.6].forEach((s) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), eyeM); e.position.set(s, 2.4, 1.85); holo.add(e); });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 0.9, 4.6, 32, 1, true), new THREE.MeshBasicMaterial({ color: "#59e0ff", transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 1.5; holo.add(beam);
    const spN = 160, sp = new Float32Array(spN * 3), spd = []; for (let i = 0; i < spN; i++) { spd.push([R() * TAU, R() * 4.4, 0.6 + R() * 1.8, 0.4 + R()]); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    const spark = new THREE.Points(sg, new THREE.PointsMaterial({ color: "#bffcff", size: 0.16, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); spark.frustumCulled = false; holo.add(spark);
    anim.push({ a, fn: (t, dt, low) => { holo.rotation.y = t * 0.5; holo.children.forEach((c, i) => { if (c.geometry.type === "TorusGeometry") c.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.04); });
      spark.visible = !low; if (low) return; for (let i = 0; i < spN; i++) { const d = spd[i], y = (d[1] + t * d[3]) % 4.6; sp[i * 3] = Math.cos(d[0] + t * 0.6) * d[2]; sp[i * 3 + 1] = y; sp[i * 3 + 2] = Math.sin(d[0] + t * 0.6) * d[2]; } sg.attributes.position.needsUpdate = true; } });
    a.acc.build(a.g);
  }

  /* ---------- billboards that change their picture (Jumpi's own news, never real brands) ---------- */
  const ADS = [
    ["JUMPI NEWS", "#0b1230", "#5ff3ff"], ["HOVER MOTORS", "#1a0b30", "#ff7af0"], ["NEO FASHION", "#08201a", "#5bffb0"], ["GLOW PARK", "#201808", "#ffd65a"],
    ["SKY TOWER", "#0b1230", "#7fa8ff"], ["GADGET LAB", "#1a0b30", "#c58bff"], ["GRAND HOTEL", "#200b0b", "#ff8a5a"], ["WELCOME!", "#0b1230", "#5ff3ff"],
  ];
  function billboard(a, lx, lz, ry, w, h, y, start) {
    const [x, z] = W(lx, lz), mats = ADS.map(([t, bg, fg], i) => { const m = new THREE.MeshBasicMaterial({ map: textTex("ad" + i, t, { bg, fg, w: 512, h: 256, size: t.length > 10 ? 64 : 84 }), transparent: true, opacity: 1 }); return m; });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats[start % mats.length]); scr.position.set(x, y, z); scr.rotation.y = ry; a.far.add(scr);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.4), DARK()); back.position.set(x - Math.sin(ry) * 0.25, y, z - Math.cos(ry) * 0.25); back.rotation.y = ry; a.g.add(back);
    let k = start; anim.push({ a, fn: (t) => { const i = Math.floor(t / 6 + start) % mats.length; if (i !== k) { k = i; scr.material = mats[i]; } scr.scale.y = 1 - Math.max(0, 1 - ((t / 6 + start) % 1) * 12) * 0.9; } });
  }

  /* ---------- the Sky Mall: glass floors, lifts that go up and down, shops inside ---------- */
  {
    const r = FL.MALL.rect, a = area((r[0] + r[2]) / 2, (r[1] + r[3]) / 2), p = new P(a.acc);
    // a tall ground floor (10 high) and three shop floors above it, around a big open atrium in the middle
    const [x0, z0] = W(r[0], r[1]), [x1, z1] = W(r[2], r[3]), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, FH = 6, G0 = FL.MALL.ceil, TOP = G0 + FH * (FL.MALL.floors - 2), H = TOP + FH;
    const ax0 = x0 + 14, ax1 = x1 - 14, az0 = z0 + 12, az1 = z1 - 12;   // the atrium hole
    const slab = M("#d9e3f2", { metalness: 0.3, roughness: 0.35 }), rail = M("#bff1ff", { transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.5, depthWrite: false });
    for (let f = 0; f < FL.MALL.floors - 1; f++) { const y = G0 + f * FH, glow = neon(f % 2 ? "#ff4fd8" : "#59e0ff", 0.8, 2.4);
      p.box(w, 0.5, az0 - z0, slab, cx, y, (z0 + az0) / 2).box(w, 0.5, z1 - az1, slab, cx, y, (az1 + z1) / 2).box(ax0 - x0, 0.5, az1 - az0, slab, (x0 + ax0) / 2, y, (az0 + az1) / 2).box(x1 - ax1, 0.5, az1 - az0, slab, (ax1 + x1) / 2, y, (az0 + az1) / 2);
      // glass balcony around the atrium with a glowing line
      p.box(ax1 - ax0, 1.1, 0.08, rail, (ax0 + ax1) / 2, y + 0.8, az0, 0, false).box(ax1 - ax0, 1.1, 0.08, rail, (ax0 + ax1) / 2, y + 0.8, az1, 0, false).box(0.08, 1.1, az1 - az0, rail, ax0, y + 0.8, (az0 + az1) / 2, 0, false).box(0.08, 1.1, az1 - az0, rail, ax1, y + 0.8, (az0 + az1) / 2, 0, false);
      p.box(ax1 - ax0, 0.1, 0.16, glow, (ax0 + ax1) / 2, y + 1.38, az0, 0, false).box(ax1 - ax0, 0.1, 0.16, glow, (ax0 + ax1) / 2, y + 1.38, az1, 0, false).box(0.16, 0.1, az1 - az0, glow, ax0, y + 1.38, (az0 + az1) / 2, 0, false).box(0.16, 0.1, az1 - az0, glow, ax1, y + 1.38, (az0 + az1) / 2, 0, false);
      p.box(w + 0.2, 0.18, d + 0.2, glow, cx, y - 0.2, cz, 0, false);
      // ceiling lights under each floor
      for (let i = 0; i < 5; i++) { const lx = x0 + 4 + i * (w - 8) / 4; [z0 + 6, z1 - 6].forEach((lz) => p.box(5, 0.08, 1.2, neon("#e9fbff", 0.9, 1.8), lx, y - 0.3, lz, 0, false)); }
      // the shops upstairs: glowing fronts along the back walls
      p.box(w - 4, FH - 0.8, 2, winMat("mallshop" + (f % 3), "#9c7bff", "#ffd6ff", 30 + f), cx, y + FH / 2, z0 + 2.2).box(w - 4, FH - 0.8, 2, winMat("mallshop" + ((f + 1) % 3), "#5fd6ff", "#c9fbff", 40 + f), cx, y + FH / 2, z1 - 2.2); }
    p.box(w, 0.5, d, slab, cx, H, cz).box(ax1 - ax0, 0.12, az1 - az0, GLASS(), (ax0 + ax1) / 2, H + 0.3, (az0 + az1) / 2, 0, false);   // the roof with a glass skylight
    // columns and glass walls (the front has a wide door)
    for (let i = 0; i <= 6; i++) { const x = x0 + i * w / 6; [z0, z1].forEach((zz) => p.box(0.6, H, 0.6, STEEL(), x, H / 2, zz)); }
    for (let i = 0; i <= 5; i++) { const z = z0 + i * d / 5; [x0, x1].forEach((xx) => p.box(0.6, H, 0.6, STEEL(), xx, H / 2, z)); }
    const gl = GLASS(); p.box(w, H, 0.1, gl, cx, H / 2, z0, 0, false).box(w, H, 0.1, gl, cx, H / 2, z1, 0, false).box(0.1, H, d, gl, x0, H / 2, cz, 0, false);
    const [, dz0] = W(0, FL.MALL.door[1]), [, dz1] = W(0, FL.MALL.door[3]);
    p.box(0.1, H, dz0 - z0, gl, x1, H / 2, (z0 + dz0) / 2, 0, false).box(0.1, H, z1 - dz1, gl, x1, H / 2, (dz1 + z1) / 2, 0, false).box(0.1, H - 5, dz1 - dz0, gl, x1, 5 + (H - 5) / 2, (dz0 + dz1) / 2, 0, false);
    p.box(1.4, 0.6, dz1 - dz0 + 2, neon("#59e0ff", 0.9, 2.6), x1 + 0.3, 5.2, (dz0 + dz1) / 2, 0, false);
    // the roof crown and the big sign
    p.box(w + 1, 0.8, 1, DARK(), cx, H + 0.6, z0).box(w + 1, 0.8, 1, DARK(), cx, H + 0.6, z1).box(1, 0.8, d, DARK(), x0, H + 0.6, cz).box(1, 0.8, d, DARK(), x1, H + 0.6, cz);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(22, 5), new THREE.MeshBasicMaterial({ map: textTex("mallsign", "SKY MALL", { bg: "#120a2e", fg: "#ff7af0", w: 1024, h: 232, size: 150 }), transparent: true }));
    sign.position.set(x1 + 0.6, H - 4, cz); sign.rotation.y = Math.PI / 2; a.far.add(sign);
    // the ground floor inside: shops along the walls, sofas in the middle, plants
    const [ix0, iz0] = W(FL.MALL.inside[0], FL.MALL.inside[1]), [ix1, iz1] = W(FL.MALL.inside[2], FL.MALL.inside[3]);
    p.geo(plateGeo(ix0, iz0, ix1, iz1, 0.04, 6), M("#eef3fb", { roughness: 0.15, metalness: 0.2 }));
    FL.FW_SHOPS.forEach((s, i) => { const [sx, sz] = W(s.x, s.z), back = s.z < 10 ? -1 : 1, col = ["#ff4fd8", "#59e0ff", "#ffd65a", "#7dff9b", "#c58bff"][i];
      p.box(10, 0.15, 6, M("#2a3042"), sx, 0.1, sz + back * 1).box(9, 1.1, 1.2, WHITE(), sx, 0.55, sz - back * 1.6).box(9.2, 0.12, 1.4, neon(col), sx, 1.16, sz - back * 1.6, 0, false);
      p.box(10, 4.6, 0.3, DARK(), sx, 2.3, sz + back * 3.6);
      for (let k = -1; k <= 1; k++) p.box(1.8, 1.6, 0.5, M(col, { metalness: 0.4, roughness: 0.3 }), sx + k * 3, 2.2, sz + back * 3.2);
      const t = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 1.8), new THREE.MeshBasicMaterial({ map: textTex("shop" + s.id, s.title, { bg: "#0b1230", fg: col, w: 768, h: 160, size: 92 }), transparent: true }));
      t.position.set(sx, 4.1, sz + back * 3.42); t.rotation.y = back > 0 ? Math.PI : 0; a.far.add(t);
      colliders.push({ box: [sx - 4.5, sz - back * 1.6 - 0.6, sx + 4.5, sz - back * 1.6 + 0.6] });
    });
    // lounge: round sofas around a glowing table
    [[-62, 8], [-48, 12]].forEach(([lx, lz], i) => { const [sx, sz] = W(lx, lz); p.cyl(1.2, 0.6, neon(i ? "#59e0ff" : "#ff4fd8", 0.5, 1.6), sx, 0.3, sz, 24);
      for (let k = 0; k < 4; k++) { const an = k / 4 * TAU, bx = sx + Math.cos(an) * 3, bz = sz + Math.sin(an) * 3; p.box(2.2, 0.55, 1.1, M("#7d5cff", { roughness: 0.8, metalness: 0 }), bx, 0.28, bz, -an + Math.PI / 2).box(2.2, 0.8, 0.3, M("#6a48ee", { roughness: 0.8, metalness: 0 }), bx + Math.cos(an) * 0.55, 0.7, bz + Math.sin(an) * 0.55, -an + Math.PI / 2);
        seats.push({ x: bx, z: bz, f: Math.atan2(sx - bx, sz - bz), y: 0.55, k: "sit" }); colliders.push({ c: [bx, bz], r: 1 }); } colliders.push({ c: [sx, sz], r: 1.3 }); });
    // the glass lifts going up and down (just to look at; the shops upstairs are behind glass)
    [[-70, 16], [-56, 16]].forEach(([lx, lz], i) => { const [sx, sz] = W(lx, lz); p.box(0.25, H, 0.25, STEEL(), sx - 1.3, H / 2, sz - 1.3).box(0.25, H, 0.25, STEEL(), sx + 1.3, H / 2, sz - 1.3).box(0.25, H, 0.25, STEEL(), sx - 1.3, H / 2, sz + 1.3).box(0.25, H, 0.25, STEEL(), sx + 1.3, H / 2, sz + 1.3);
      const cab = new THREE.Group(); const glass = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 2.4), GLASS()); glass.position.y = 1.3; cab.add(glass);
      const floor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 2.4), STEEL()); cab.add(floor); const glow = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 2.5), neon("#59e0ff", 1, 2.6)); glow.position.y = 2.65; cab.add(glow);
      cab.position.set(sx, 0, sz); a.g.add(cab); colliders.push({ c: [sx, sz], r: 1.9 });
      anim.push({ a, fn: (t) => { const k = (Math.sin(t * 0.32 + i * 2.1) + 1) / 2; cab.position.y = k * TOP; } }); });
    // automatic doors at the entrance
    const [dx] = W(FL.MALL.door[2], 0), dzc = (dz0 + dz1) / 2, dm = M("#bff1ff", { transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.5, depthWrite: false });
    const dl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.6, (dz1 - dz0) / 2), dm), dr = dl.clone(); a.g.add(dl, dr);
    doors.push({ x: dx - 6 + 0.3, z: dzc, open: 0, fn: (k) => { const s = (dz1 - dz0) / 4; dl.position.set(x1, 2.3, dzc - s - k * s * 1.8); dr.position.set(x1, 2.3, dzc + s + k * s * 1.8); } });
    a.acc.build(a.g);
  }

  /* ---------- the Grand Hotel ---------- */
  {
    const r = FL.HOTEL.rect, a = area((r[0] + r[2]) / 2, (r[1] + r[3]) / 2), p = new P(a.acc);
    const [x0, z0] = W(r[0], r[1]), [x1, z1] = W(r[2], r[3]), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, H = 58;
    tower(p, w, d, 14, winMat("hotelbase", "#ffb27a", "#ffe0a8", 7), cx, 0, cz, "#ffb27a");
    tower(p, w - 18, d - 12, H - 14, winMat("hoteltop", "#ffcf8a", "#fff0c2", 8), cx + 4, 14, cz, "#ffb27a");
    for (let k = 0; k < 3; k++) p.box(0.5, H - 15, 0.5, neon("#ffcf6a", 0.5, 1.8), cx + 4 + (k - 1) * (w - 18) / 2.2, 14.5 + (H - 15) / 2, z0 + 6 - 0.3, 0, false);   // gold light lines up the front
    { const fp = new P(a.facc); roofTop(fp, "pad", cx + 4, H + 0.5, cz, w - 18, d - 12, "#ffb27a", R); }

    // the entrance: a gold canopy, a red carpet, automatic doors
    const [ex, ez] = W(FL.HOTEL.door[0], (FL.HOTEL.door[1] + FL.HOTEL.door[3]) / 2);
    p.box(7, 0.4, 12, M("#d4a73a", { metalness: 0.8, roughness: 0.25 }), ex - 2, 5.4, ez).box(8, 0.04, 10, M("#c4222a", { roughness: 0.9, metalness: 0 }), ex - 2, 0.05, ez, 0, false);
    [-5, 5].forEach((s) => p.cyl(0.25, 5.2, M("#d4a73a", { metalness: 0.8, roughness: 0.25 }), ex - 5, 2.6, ez + s, 10));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(26, 5), new THREE.MeshBasicMaterial({ map: textTex("hotelsign", "GRAND HOTEL", { bg: "#2a0f05", fg: "#ffcf6a", w: 1024, h: 200, size: 132, border: "#ffb27a" }), transparent: true }));
    sign.position.set(x0 - 0.6, 10.5, cz); sign.rotation.y = -Math.PI / 2; a.far.add(sign);
    const dm = M("#ffe9c2", { transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.5, depthWrite: false }), dl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.4, 3), dm), dr = dl.clone(); a.g.add(dl, dr);
    doors.push({ x: x0 - 3, z: ez, open: 0, fn: (k) => { dl.position.set(x0, 2.2, ez - 1.5 - k * 2.6); dr.position.set(x0, 2.2, ez + 1.5 + k * 2.6); } });
    a.acc.build(a.g); a.facc.build(a.far);
  }

  /* ---------- the Sky Tower and its roof (seats, music, the view) ---------- */
  {
    const r = FL.TOWER.rect, a = area((r[0] + r[2]) / 2, (r[1] + r[3]) / 2), p = new P(a.acc);
    const [x0, z0] = W(r[0], r[1]), [x1, z1] = W(r[2], r[3]), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, Y = FL.TOWER.roofY;
    p.acc.add(towerGeo(w, d, Y), winMat("tower", "#7fa8ff", "#d6e4ff", 12), m4(cx, 0, cz), true);
    for (let f = 8; f < Y; f += 8) p.box(w + 0.4, 0.25, d + 0.4, neon("#59e0ff", 0.5, 1.8), cx, f, cz, 0, false);
    // the roof deck
    p.box(w + 0.6, 0.5, d + 0.6, M("#3a4560", { metalness: 0.4, roughness: 0.4 }), cx, Y - 0.2, cz);
    p.geo(plateGeo(x0 + 0.5, z0 + 0.5, x1 - 0.5, z1 - 0.5, Y + 0.06, 4), neon("#c99a63", 0.12, 0.45));
    for (let i = 0; i < 6; i++) p.box(0.2, 0.04, d - 2, neon("#59e0ff", 0.7, 2.2), x0 + 2 + i * (w - 4) / 5, Y + 0.09, cz, 0, false);
    const rail = M("#bff1ff", { transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.5, depthWrite: false });
    p.box(w, 1.2, 0.1, rail, cx, Y + 0.6, z0 + 0.3, 0, false).box(w, 1.2, 0.1, rail, cx, Y + 0.6, z1 - 0.3, 0, false).box(0.1, 1.2, d, rail, x0 + 0.3, Y + 0.6, cz, 0, false).box(0.1, 1.2, d, rail, x1 - 0.3, Y + 0.6, cz, 0, false);
    p.box(w, 0.1, 0.2, neon("#ff4fd8"), cx, Y + 1.25, z0 + 0.3, 0, false).box(w, 0.1, 0.2, neon("#ff4fd8"), cx, Y + 1.25, z1 - 0.3, 0, false).box(0.2, 0.1, d, neon("#ff4fd8"), x0 + 0.3, Y + 1.25, cz, 0, false).box(0.2, 0.1, d, neon("#ff4fd8"), x1 - 0.3, Y + 1.25, cz, 0, false);
    // DJ booth with lights
    p.box(5, 1.2, 2, DARK(), cx, Y + 0.6, z0 + 3).box(5.2, 0.12, 2.2, neon("#59e0ff", 1, 2.6), cx, Y + 1.25, z0 + 3, 0, false); colliders.push({ box: [cx - 2.6, z0 + 1.8, cx + 2.6, z0 + 4.2] });
    const lights = []; for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7, 16, 1, true), new THREE.MeshBasicMaterial({ color: ["#ff4fd8", "#59e0ff", "#ffd65a", "#7dff9b"][i], transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      l.position.set(cx - 6 + i * 4, Y + 4.5, z0 + 1.5); a.far.add(l); lights.push(l); }
    anim.push({ a, fn: (t) => lights.forEach((l, i) => { l.rotation.z = Math.sin(t * 1.3 + i) * 0.5; l.rotation.x = Math.cos(t * 1.1 + i * 2) * 0.35; }) });
    // sofas looking at the city
    for (let i = 0; i < 4; i++) { const sx = x0 + 4 + i * 6.5, sz = z1 - 4; p.box(4, 0.5, 1.4, M("#ff7a3a", { roughness: 0.85, metalness: 0 }), sx, Y + 0.3, sz).box(4, 0.8, 0.35, M("#e8632a", { roughness: 0.85, metalness: 0 }), sx, Y + 0.75, sz - 0.6);
      seats.push({ x: sx - 1, z: sz, f: 0, y: Y + 0.55, k: "sit" }, { x: sx + 1, z: sz, f: 0, y: Y + 0.55, k: "sit" }); colliders.push({ box: [sx - 2.1, sz - 0.9, sx + 2.1, sz + 0.8] }); }
    // planters with glowing trees
    [[x0 + 2.5, z0 + 2.5], [x1 - 2.5, z0 + 2.5], [x0 + 2.5, cz], [x1 - 2.5, cz]].forEach(([px, pz]) => { p.box(2, 0.8, 2, WHITE(), px, Y + 0.4, pz).sphere(1.3, neon("#7dff9b", 0.4, 1.4), px, Y + 2, pz, 1.1).cyl(0.15, 1, M("#6b4a2a"), px, Y + 1.1, pz, 6); colliders.push({ c: [px, pz], r: 1.3 }); });
    a.acc.build(a.g);
  }

  /* ---------- the hover canyon, the Sky Bridge and its two towers ---------- */
  {
    const c = FL.CANYON.rect, a = area(0, (c[1] + c[3]) / 2), p = new P(a.acc), [cx0, cz0] = W(c[0], c[1]), [cx1, cz1] = W(c[2], c[3]);
    // the canyon: a deep glowing gap
    p.box(cx1 - cx0, 0.3, cz1 - cz0, M("#05070d", { roughness: 1, metalness: 0 }), (cx0 + cx1) / 2, -12, (cz0 + cz1) / 2);
    [cz0, cz1].forEach((zz) => p.box(cx1 - cx0, 12, 0.5, DARK(), (cx0 + cx1) / 2, -6, zz).box(cx1 - cx0, 0.12, 0.6, neon("#ff4fd8", 1, 2.6), (cx0 + cx1) / 2, 0.08, zz, 0, false));
    [cx0, cx1].forEach((xx) => p.box(0.5, 12, cz1 - cz0, DARK(), xx, -6, (cz0 + cz1) / 2));
    for (let i = 0; i < 6; i++) p.box(cx1 - cx0, 0.08, 0.4, neon("#59e0ff", 0.8, 2.4), (cx0 + cx1) / 2, -11.8, cz0 + 2 + i * (cz1 - cz0 - 4) / 5, 0, false);
    // the two bridge towers
    FL.BRIDGE.towers.forEach(([lx, lz], i) => { const [tx, tz] = W(lx, lz); tower(p, 14, 14, 40, winMat("bt" + i, i ? "#c58bff" : "#5fd6ff", "#f3e2ff", 20 + i), tx, 0, tz, i ? "#c58bff" : "#59e0ff");
      roundTower(p, 4.5, 10, winMat("bt" + i, i ? "#c58bff" : "#5fd6ff", "#f3e2ff", 20 + i), tx, 40.5, tz, i ? "#c58bff" : "#59e0ff");
      p.cyl(0.6, 9, STEEL(), tx, 55.5, tz, 10, true, 0.12).sphere(0.5, neon(i ? "#c58bff" : "#59e0ff", 1.2, 3), tx, 60.2, tz); });
    // the bridge: a glass deck with glowing rails
    const [bx0, bz0] = W(-35, FL.BRIDGE.strip[1]), [bx1, bz1] = W(35, FL.BRIDGE.strip[3]), by = FL.BRIDGE.y;
    p.box(bx1 - bx0, 0.5, bz1 - bz0 + 0.6, M("#cfe9ff", { metalness: 0.4, roughness: 0.25 }), (bx0 + bx1) / 2, by - 0.25, (bz0 + bz1) / 2);
    const rail = M("#bff1ff", { transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.5, depthWrite: false });
    [bz0 - 0.2, bz1 + 0.2].forEach((zz) => p.box(bx1 - bx0, 1.2, 0.1, rail, (bx0 + bx1) / 2, by + 0.6, zz, 0, false).box(bx1 - bx0, 0.12, 0.2, neon("#59e0ff", 1, 2.6), (bx0 + bx1) / 2, by + 1.25, zz, 0, false));
    for (let i = 0; i <= 8; i++) { const x = bx0 + i * (bx1 - bx0) / 8; p.cyl(0.08, 7, STEEL(), x, by + 3.5, (bz0 + bz1) / 2 - 2.6, 6).cyl(0.08, 7, STEEL(), x, by + 3.5, (bz0 + bz1) / 2 + 2.6, 6); }
    p.box(bx1 - bx0, 0.3, 0.3, STEEL(), (bx0 + bx1) / 2, by + 7, (bz0 + bz1) / 2 - 2.6).box(bx1 - bx0, 0.3, 0.3, STEEL(), (bx0 + bx1) / 2, by + 7, (bz0 + bz1) / 2 + 2.6);
    // a photo spot in the middle: a glowing frame
    const [fx, fz] = W(0, -74); p.ring(2.2, neon("#ffd65a", 1, 2.8), fx, by + 2.4, fz, 0, Math.PI / 2, 0.6);
    a.acc.build(a.g);
  }

  /* ---------- skyscrapers all around (far ones are only the body) ---------- */
  FL.BLOCKS.forEach((b, i) => {
    const a = area((b[0] + b[2]) / 2, (b[1] + b[3]) / 2), p = new P(a.acc), fp = new P(a.facc);
    const [x0, z0] = W(b[0], b[1]), [x1, z1] = W(b[2], b[3]), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    const H = 46 + R() * 40, PAL = [["#5fd6ff", "#59e0ff"], ["#9c7bff", "#c58bff"], ["#7fa8ff", "#7fa8ff"], ["#5bffb0", "#7dff9b"], ["#ff9ce6", "#ff4fd8"]], [glass, edge] = PAL[i % 5], mat = winMat("blk" + (i % 5), glass, "#e9fbff", 50 + i);
    const style = i % 4;
    if (style === 0) {   // stacked: a wide base and a slimmer top
      tower(p, w, d, H * 0.55, mat, cx, 0, cz, edge); tower(p, w * 0.68, d * 0.68, H * 0.45, mat, cx, H * 0.55 + 0.5, cz, edge);
      roofTop(fp, "pad", cx, H + 1, cz, w * 0.68, d * 0.68, edge, R);
    } else if (style === 1) {   // round glass tower on a podium
      tower(p, w, d, 8, mat, cx, 0, cz, edge); const r = Math.min(w, d) * 0.42; roundTower(p, r, H - 8, mat, cx, 8.5, cz, edge);
      for (let y = 20; y < H - 4; y += 12) fp.cyl(r + 0.25, 0.25, neon(edge, 0.5, 2), cx, y, cz, 28, false);
      roofTop(fp, "spire", cx, H + 1, cz, r, r, edge, R);
    } else if (style === 2) {   // twin towers with a sky bridge
      const tw = w * 0.4; [-1, 1].forEach((sgn) => tower(p, tw, d * 0.8, H * (sgn > 0 ? 1 : 0.86), mat, cx + sgn * w * 0.28, 0, cz, edge));
      p.box(w * 0.2 + 1, 3, 5, GLASS(), cx, H * 0.6, cz, 0, false).box(w * 0.2 + 1, 0.4, 5.4, STEEL(), cx, H * 0.6 - 1.6, cz).box(w * 0.2 + 1, 0.15, 5.6, neon(edge, 0.8, 2.6), cx, H * 0.6 + 1.6, cz, 0, false);
      roofTop(fp, "boxes", cx + w * 0.28, H + 1, cz, tw, d * 0.8, edge, R); roofTop(fp, "garden", cx - w * 0.28, H * 0.86 + 1, cz, tw, d * 0.8, edge, R);
    } else {   // stepped: three tiers
      tower(p, w, d, H * 0.45, mat, cx, 0, cz, edge); tower(p, w * 0.78, d * 0.78, H * 0.3, mat, cx, H * 0.45 + 0.5, cz, edge); tower(p, w * 0.52, d * 0.52, H * 0.25, mat, cx, H * 0.75 + 1, cz, edge);
      roofTop(fp, "garden", cx, H * 0.45 + 1, cz + d * 0.36, w, d * 0.08, edge, R); roofTop(fp, "spire", cx, H + 1.5, cz, w * 0.52, d * 0.52, edge, R);
    }
    // glowing lines up the corners
    if (style !== 1) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => fp.box(0.3, H * (style === 0 ? 0.55 : 0.45), 0.3, neon(edge, 0.6, 2.2), cx + sx * (w / 2 + 0.05), H * (style === 0 ? 0.275 : 0.225), cz + sz * (d / 2 + 0.05), 0, false));
    if (i % 2 === 0) billboard(a, (b[0] + b[2]) / 2, b[3] + 0.6, 0, Math.min(14, w - 4), 6, Math.min(26, H * 0.3), i);
    a.acc.build(a.g); a.facc.build(a.far);
  });

  /* ---------- the skyline far away: more of the city on the other islands (very simple: one mesh, always the low detail) ---------- */
  {
    const acc = new Acc(), p = new P(acc), [ox, oz] = W(0, 0), mats = [0, 1, 2, 3].map((k) => winMat("far" + k, ["#5fd6ff", "#9c7bff", "#7fa8ff", "#ff9ce6"][k], "#e9fbff", 80 + k));
    for (let k = 0; k < 64; k++) { const an = k / 64 * TAU + R() * 0.05, dist = 210 + R() * 120, x = ox + Math.cos(an) * dist, z = oz + Math.sin(an) * dist * 0.9, w = 12 + R() * 16, h = 40 + R() * 110;
      p.acc.add(towerGeo(w, w * (0.7 + R() * 0.5), h), mats[k % 4], m4(x, -1, z, R() * TAU), false); p.box(w + 0.3, 0.5, w + 0.3, ROOF(), x, h - 0.7, z, 0, false); }
    for (let k = 0; k < 6; k++) { const an = k / 6 * TAU + 0.3, x = ox + Math.cos(an) * 260, z = oz + Math.sin(an) * 240; p.cyl(60 + R() * 20, 1.4, M("#46516a", { metalness: 0.4, roughness: 0.5 }), x, -0.6, z, 32, false).cyl(62 + R() * 4, 0.2, neon("#38e1ff", 0.8, 2.2), x, 0.05, z, 32, false); }
    const g = new THREE.Group(); acc.build(g); g.children.forEach((m) => { m.castShadow = false; m.receiveShadow = false; }); root.add(g);
  }


  /* ---------- the Time Port: where the time machine lands ---------- */
  {
    const a = area(...FL.LANDING.pad), p = new P(a.acc), [lx, lz] = W(...FL.LANDING.pad);
    p.cyl(FL.LANDING.r, 0.4, M("#2a3042", { metalness: 0.5, roughness: 0.3 }), lx, 0.2, lz, 48).ring(FL.LANDING.r - 0.4, neon("#ffd65a", 1, 2.8), lx, 0.45, lz, Math.PI / 2, 0, 0.3).ring(FL.LANDING.r - 2.6, neon("#59e0ff", 1, 2.8), lx, 0.45, lz, Math.PI / 2, 0, 0.3);
    for (let i = 0; i < 8; i++) { const an = i / 8 * TAU; p.box(0.5, 0.06, 2.4, neon("#ffd65a", 0.8, 2.4), lx + Math.cos(an) * 5, 0.46, lz + Math.sin(an) * 5, -an, false); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6, 0.18, 10, 60), neon("#59e0ff", 1.2, 3)); ring.rotation.x = Math.PI / 2; ring.position.set(lx, 6, lz); a.far.add(ring);
    anim.push({ a, fn: (t) => { ring.position.y = 5 + Math.sin(t * 1.5) * 0.8; ring.rotation.z = t * 0.6; } });
    a.acc.build(a.g);
  }

  /* ---------- Glow Park: glowing trees and paths in the south ---------- */
  {
    const a = area(0, 84), p = new P(a.acc);
    const grassT = canvasTex("fw-grass", 256, 256, (x, w, h) => { x.fillStyle = "#4fae55"; x.fillRect(0, 0, w, h); const Rg = rng(9); for (let i = 0; i < 1400; i++) { x.fillStyle = `hsl(${105 + Rg() * 25},${45 + Rg() * 20}%,${34 + Rg() * 16}%)`; x.fillRect(Rg() * w, Rg() * h, 2, 3 + Rg() * 3); } });
    const grass = M("#ffffff", { map: grassT, roughness: 0.95, metalness: 0 }), path = neon("#bff6ff", 0.25, 1.1);
    [[-118, 44, -27, 100], [27, 44, 118, 100]].forEach(([ax, az, bx, bz]) => { const [x0, z0] = W(ax, az), [x1, z1] = W(bx, bz); p.geo(plateGeo(x0, z0, x1, z1, 0.03, 10), grass);
      for (let k = 0; k < 3; k++) { const [px] = W(ax + (bx - ax) * (k + 0.5) / 3, 0); p.box(2.4, 0.04, z1 - z0, path, px, 0.05, (z0 + z1) / 2, 0, false); }
      const [, pz] = W(0, 72); p.box(x1 - x0, 0.04, 2.4, path, (x0 + x1) / 2, 0.05, pz, 0, false); });
    const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6); trunkG.translate(0, 1.2, 0);
    const crownG = new THREE.IcosahedronGeometry(1.6, 1); crownG.translate(0, 3.4, 0);
    const spots = []; for (let i = 0; i < 70; i++) { const lx = -112 + R() * 224, lz = 42 + R() * 54; if (Math.abs(lx) < 26 && lz > 62) continue; if (FL.BLOCKS.some((b) => lx > b[0] - 2 && lx < b[2] + 2 && lz > b[1] - 2 && lz < b[3] + 2)) continue; if (Math.abs(lx) < 30 && lz < 56) continue; spots.push([lx, lz]); }
    const trunks = new THREE.InstancedMesh(trunkG, M("#5a3f2a", { metalness: 0, roughness: 0.9 }), spots.length);
    const cols = ["#59e0ff", "#ff7af0", "#7dff9b", "#c58bff"], crowns = cols.map((c) => new THREE.InstancedMesh(crownG, neon(c, 0.35, 1.5), spots.length));
    const cnt = [0, 0, 0, 0], mx = new THREE.Matrix4();
    spots.forEach(([lx, lz], i) => { const [x, z] = W(lx, lz), s = 0.8 + R() * 0.6; mx.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * TAU, 0)), new THREE.Vector3(s, s, s)); trunks.setMatrixAt(i, mx); const k = i % 4; crowns[k].setMatrixAt(cnt[k]++, mx); colliders.push({ c: [x, z], r: 0.6 * s }); });
    crowns.forEach((c, k) => { c.count = cnt[k]; c.castShadow = true; a.g.add(c); }); trunks.castShadow = true; a.g.add(trunks);
    a.acc.build(a.g);
  }

  /* ---------- the mini-game stands and the lift pads ---------- */
  const STATION_COL = { drone: "#59e0ff", robot: "#ffd65a", rooftops: "#ff7af0" };
  const STATION_TITLE = { drone: "DRONE RACE", robot: "ROBO FIX", rooftops: "ROOF HOP" };
  {
    const a = area(0, 48), p = new P(a.acc);
    FL.FW_STATIONS.forEach((s) => { const [x, z] = W(s.x, s.z), col = STATION_COL[s.id];
      p.cyl(2.2, 0.3, DARK(), x, 0.15, z, 24).cyl(1.9, 0.06, neon(col, 1, 2.6), x, 0.32, z, 24, false).box(1.6, 2.4, 1, WHITE(), x, 1.5, z - 0.8).box(1.4, 1, 0.1, neon(col, 0.9, 2.2), x, 2, z - 0.28, 0, false);
      const t = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.1), new THREE.MeshBasicMaterial({ map: textTex("st" + s.id, STATION_TITLE[s.id], { fg: col, w: 512, h: 128, size: 70 }), transparent: true })); t.position.set(x, 3.4, z - 0.8); a.far.add(t);
      colliders.push({ c: [x, z - 0.8], r: 1.1 }); });
    a.acc.build(a.g);
  }
  {
    const padM = neon("#7dff9b", 1, 2.8);
    FL.LIFTS.forEach((L) => { const [x, z] = W(...L.at), y = FL.futureGround(x, z), g = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.12, 32), padM); disc.position.y = y + 0.06; g.add(disc);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4), padM); arrow.position.y = y + 1.6; if (/down/.test(L.id)) arrow.rotation.z = Math.PI; g.add(arrow);
      g.position.set(x, 0, z); root.add(g); lifts.push({ ...L, x, z, y, arrow, to: W(...L.to) });
      anim.push({ fn: (t) => { arrow.position.y = y + 1.6 + Math.sin(t * 3) * 0.25; arrow.rotation.y = t * 1.5; } }); });
  }

  /* ---------- flying cars (InstancedMesh, moved every frame) ---------- */
  const CARS = [];
  {
    // a sleek hover car: a long rounded body with two side pods, a glass bubble on top and a glowing ring under it
    const body = new THREE.SphereGeometry(1, 20, 12); body.scale(1.9, 0.5, 0.95);
    const pods = [-1, 1].map((sg) => { const g = new THREE.CapsuleGeometry(0.28, 1.6, 4, 10); g.rotateZ(Math.PI / 2); g.translate(-0.2, -0.15, sg * 0.98); return g; });
    const carG = mergeGeometries([body, ...pods].map((g) => g.toNonIndexed()), false);
    const glassG = new THREE.SphereGeometry(0.75, 16, 10, 0, TAU, 0, Math.PI / 2); glassG.scale(1.3, 0.75, 0.9); glassG.translate(-0.15, 0.3, 0);
    const glowG = new THREE.CircleGeometry(1.5, 24); glowG.rotateX(Math.PI / 2); glowG.scale(1.3, 1, 0.75); glowG.translate(0, -0.55, 0);
    const N = 46, mesh = new THREE.InstancedMesh(carG, M("#f2f6ff", { metalness: 0.75, roughness: 0.22 }), N), glow = new THREE.InstancedMesh(glowG, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), N);
    const cap = new THREE.InstancedMesh(glassG, M("#6fd8ff", { metalness: 0.4, roughness: 0.05, transparent: true, opacity: 0.7 }), N); cap.frustumCulled = false; root.add(cap);
    const tint = ["#59e0ff", "#ff4fd8", "#ffd65a", "#7dff9b", "#c58bff"]; for (let i = 0; i < N; i++) { glow.setColorAt(i, new THREE.Color(tint[i % 5])); mesh.setColorAt(i, new THREE.Color(["#f2f6ff", "#2a3042", "#ff5f5f", "#1f6bff", "#ffd65a"][i % 5])); }
    mesh.frustumCulled = glow.frustumCulled = false; mesh.castShadow = true; root.add(mesh, glow);
    // lanes: loops around the island at different heights, and straight runs through the canyon
    for (let i = 0; i < N; i++) {
      if (i < 10) CARS.push({ kind: "canyon", lane: i % 4, off: R() * 120, speed: 14 + R() * 10, dir: i % 2 ? 1 : -1 });
      else CARS.push({ kind: "loop", rx: 70 + R() * 50, rz: 60 + R() * 40, y: 12 + R() * 34, off: R() * TAU, speed: (0.06 + R() * 0.08) * (i % 2 ? 1 : -1) });
    }
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    anim.push({ fn: (t, dt, low) => { const n = low ? 18 : N; mesh.count = glow.count = n;
      for (let i = 0; i < n; i++) { const c = CARS[i]; let x, y, z, ry;
        if (c.kind === "canyon") { const L = 140, s = ((c.off + t * c.speed) % L) - L / 2; [x, z] = W(s * c.dir, FL.CANYON.rect[1] + 4 + c.lane * 3.6); y = -7 + c.lane * 2.2; ry = c.dir > 0 ? 0 : Math.PI; }
        else { const a2 = c.off + t * c.speed; [x, z] = W(Math.cos(a2) * c.rx, Math.sin(a2) * c.rz + 6); y = c.y + Math.sin(t * 0.8 + c.off) * 0.6; ry = -a2 + (c.speed > 0 ? -Math.PI / 2 : Math.PI / 2); }
        e.set(0, ry, 0); q.setFromEuler(e); mx.compose(pos.set(x, y, z), q, one); mesh.setMatrixAt(i, mx); glow.setMatrixAt(i, mx); cap.setMatrixAt(i, mx); }
      cap.count = n; mesh.instanceMatrix.needsUpdate = glow.instanceMatrix.needsUpdate = cap.instanceMatrix.needsUpdate = true; } });
  }

  /* ---------- robots walking around the square ---------- */
  {
    const bodyG = new THREE.CapsuleGeometry(0.42, 0.6, 4, 10); bodyG.translate(0, 0.95, 0); const headG = new THREE.SphereGeometry(0.36, 14, 10); headG.translate(0, 1.85, 0);
    const eyeG = new THREE.BoxGeometry(0.42, 0.1, 0.06); eyeG.translate(0, 1.88, 0.32);
    const N = 10, bm = new THREE.InstancedMesh(bodyG, M("#e9eef7", { metalness: 0.6, roughness: 0.3 }), N), hm = new THREE.InstancedMesh(headG, M("#cfd8e6", { metalness: 0.6, roughness: 0.3 }), N), em = new THREE.InstancedMesh(eyeG, new THREE.MeshBasicMaterial({ color: "#59e0ff" }), N);
    [bm, hm, em].forEach((m) => { m.frustumCulled = false; root.add(m); }); bm.castShadow = hm.castShadow = true;
    const bots = []; for (let i = 0; i < N; i++) bots.push({ r: i < 6 ? 19 + R() * 3 : 30 + R() * 6, a: R() * TAU, s: (0.12 + R() * 0.1) * (i % 2 ? 1 : -1), cx: i < 6 ? 0 : (i % 2 ? -40 : 40), cz: i < 6 ? 16 : 40 });
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    anim.push({ fn: (t, dt, low) => { const n = low ? 4 : N; bm.count = hm.count = em.count = n;
      for (let i = 0; i < n; i++) { const b = bots[i], an = b.a + t * b.s, [x, z] = W(b.cx + Math.cos(an) * b.r, b.cz + Math.sin(an) * b.r);
        e.set(0, -an + (b.s > 0 ? Math.PI : 0), Math.sin(t * 6 + i) * 0.05); q.setFromEuler(e); mx.compose(v.set(x, Math.abs(Math.sin(t * 6 + i)) * 0.06, z), q, one); bm.setMatrixAt(i, mx); hm.setMatrixAt(i, mx); em.setMatrixAt(i, mx); }
      bm.instanceMatrix.needsUpdate = hm.instanceMatrix.needsUpdate = em.instanceMatrix.needsUpdate = true; } });
  }

  /* ---------- lights along the walkways (Points: one draw call) ---------- */
  {
    const pts = []; for (let lz = -20; lz <= 64; lz += 6) pts.push(W(-4, lz), W(4, lz)); for (let lx = -26; lx <= 26; lx += 6) { pts.push(W(lx, -14), W(lx, 46)); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts.flatMap(([x, z]) => [x, 3.2, z]), 3));
    const halo = new THREE.Points(g, new THREE.PointsMaterial({ map: glowDot("rgba(255,255,255,1)", "rgba(89,224,255,.6)"), size: 3.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: "#bff6ff" }));
    halo.frustumCulled = false; root.add(halo);
    const p = new P(new Acc()); pts.forEach(([x, z]) => p.cyl(0.08, 3.2, STEEL(), x, 1.6, z, 6).sphere(0.22, neon("#bff6ff", 1, 3), x, 3.2, z)); p.acc.build(root);
  }

  /* ---------- the game asks ---------- */
  let VIEW = 220, lastCull = -1;
  function update(t, dt, cam, low = false) {
    if (t - lastCull > 0.3) { lastCull = t; for (const a of areas) { const d = Math.hypot(cam.position.x - a.cx, cam.position.z - a.cz); a.g.visible = d < VIEW + 60; a.far.visible = d < Math.min(VIEW, 150); } }
    for (const A of anim) if (!A.a || A.a.g.visible) A.fn(t, dt, low);
    // automatic doors open when someone is near (the player, as host.me tells)
    const me = host.me && host.me(); for (const D of doors) { const near = me && Math.hypot(me.x - D.x, me.z - D.z) < 7; D.open += ((near ? 1 : 0) - D.open) * Math.min(1, dt * 6); D.fn(D.open); }
  }
  function night(k) { for (const m of NIGHT) m.emissiveIntensity = m.userData.day + (m.userData.night - m.userData.day) * k; }
  night(0.5);
  for (const D of doors) D.fn(0);
  const liftAt = (x, z) => lifts.find((L) => Math.hypot(x - L.x, z - L.z) < 1.8 && Math.abs(FL.futureGround(x, z) - L.y) < 1) || null;
  return { root, colliders, seats, update, night, setView: (v) => { VIEW = v; lastCull = -1; }, liftAt, lifts, ground: FL.futureGround, walk: FL.futureWalk, zoneAt: FL.futureZone, stations: FL.FW_STATIONS.map((s) => ({ ...s, wx: W(s.x, s.z)[0], wz: W(s.x, s.z)[1], color: STATION_COL[s.id], title: STATION_TITLE[s.id] })) };
}
