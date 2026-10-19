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
// floor tiles: big pearl-white stone squares (a hint of blue, each one a touch different), a fine bevel on every
// tile and thin light-blue seams; every second seam carries a light line (the emissive map lights it, more at night)
const floorTex = () => canvasTex("fw-floor", 512, 512, (x, w, h) => {
  x.fillStyle = "#cfe0f2"; x.fillRect(0, 0, w, h); const R = rng(4), T = 128;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const l = 90 + R() * 3.5, X = i * T, Y = j * T;
    const g = x.createLinearGradient(X, Y, X + T, Y + T); g.addColorStop(0, `hsl(212,45%,${l + 1.5}%)`); g.addColorStop(1, `hsl(214,40%,${l - 1.5}%)`); x.fillStyle = g; x.fillRect(X + 3, Y + 3, T - 6, T - 6);
    x.fillStyle = "rgba(255,255,255,.75)"; x.fillRect(X + 3, Y + 3, T - 6, 2); x.fillRect(X + 3, Y + 3, 2, T - 6);   // the lit edge of the bevel
    x.fillStyle = "rgba(90,130,180,.18)"; x.fillRect(X + 3, Y + T - 5, T - 6, 2); x.fillRect(X + T - 5, Y + 3, 2, T - 6);
    for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(${R() < 0.5 ? "255,255,255" : "150,180,215"},${0.12 + R() * 0.15})`; x.fillRect(X + 6 + R() * (T - 12), Y + 6 + R() * (T - 12), 1 + R() * 2, 1 + R() * 2); } }
  x.fillStyle = "#6fbef5"; for (let i = 0; i <= 4; i++) { x.fillRect(i * T - 3, 0, 6, h); x.fillRect(0, i * T - 3, w, 6); }
});
const floorGlow = () => canvasTex("fw-floor-e", 512, 512, (x, w, h) => {
  x.fillStyle = "#000"; x.fillRect(0, 0, w, h); x.fillStyle = "#3fc6ff";
  for (let i = 0; i <= 4; i += 2) { x.fillRect(i * 128 - 2, 0, 4, h); x.fillRect(0, i * 128 - 2, w, 4); }
  x.fillStyle = "#123a52"; for (let i = 1; i <= 3; i += 2) { x.fillRect(i * 128 - 1, 0, 2, h); x.fillRect(0, i * 128 - 1, w, 2); }
});
// the promenade along the shore: warm white boards with darker joints
const boardTex = () => canvasTex("fw-board", 256, 256, (x, w, h) => {
  x.fillStyle = "#e9e1d2"; x.fillRect(0, 0, w, h); const R = rng(12);
  for (let r = 0; r < 8; r++) { const y = r * 32; x.fillStyle = `hsl(36,${22 + R() * 8}%,${85 + R() * 5}%)`; x.fillRect(0, y + 2, w, 28);
    for (let k = 0; k < 30; k++) { x.fillStyle = `rgba(150,120,90,${0.05 + R() * 0.08})`; x.fillRect(R() * w, y + 4 + R() * 24, 10 + R() * 40, 1); }
    x.fillStyle = "rgba(120,95,70,.35)"; x.fillRect(((r * 97) % 256), y + 2, 2, 28); }
});
// the sky line far away: a painted strip of blue towers around the horizon (drawn once; windows on their own strip)
function skylineTex(lit) {
  return canvasTex(lit ? "fw-skyline-lit" : "fw-skyline", 2048, 512, (x, w, h) => {
    const R = rng(lit ? 31 : 31);
    const layers = [[0.62, 0.95, "#bfe2ff", 26, 0.55], [0.48, 0.8, "#94c8fb", 34, 0.8], [0.3, 0.62, "#6aa9f2", 42, 1]];
    for (const [minH, maxH, col, n, alpha] of layers) { let px = -20;
      while (px < w + 20) { const bw = 30 + R() * 70, bh = h * (minH + R() * (maxH - minH)) * 0.86, y0 = h - bh, kind = R();
        if (!lit) { x.globalAlpha = alpha; x.fillStyle = col; x.beginPath();
          if (kind < 0.25) { x.moveTo(px, h); x.lineTo(px, y0 + 18); x.lineTo(px + bw / 2, y0); x.lineTo(px + bw, y0 + 18); x.lineTo(px + bw, h); }       // a pointed top
          else if (kind < 0.45) { x.roundRect(px, y0, bw, bh + 4, [bw / 2, bw / 2, 0, 0]); }                                                    // a round top
          else { x.rect(px, y0, bw, bh); if (R() < 0.5) x.rect(px + bw * 0.42, y0 - 26, 3, 26); }                                                    // flat, maybe an antenna
          x.fill(); x.globalAlpha = 1; x.fillStyle = "rgba(255,255,255,.35)"; x.fillRect(px + 2, y0 + 4, 2, bh - 4); }
        else { for (let yy = y0 + 10; yy < h - 6; yy += 9) for (let xx = px + 5; xx < px + bw - 5; xx += 8) if (R() < 0.42) { x.fillStyle = R() < 0.7 ? "rgba(190,235,255,.95)" : "rgba(255,226,160,.9)"; x.fillRect(xx, yy, 4, 4); }
          if (R() < 0.6) { x.fillStyle = "rgba(120,220,255,.9)"; x.fillRect(px, y0, bw, 2); } }
        px += bw + R() * 14 - 4; } }
  }, { repeat: true });
}
// tower windows: rows of glass, some lit (emissive map lights them at night)
// a glass facade, two floors per tile row: white frames and floor slabs, sky-blue glass that reflects the sky (lighter at
// the top of every pane, a soft diagonal sheen across the tile), now and then a pane with blinds or a plant behind it.
// The emissive map lights most windows at night (cool white, some warm), and a thin light line on every second slab.
function windowsTex(key, glass, lit, seed) {
  const gc = new THREE.Color(glass), hsl = {}; gc.getHSL(hsl); const H = Math.round(hsl.h * 360);
  const map = canvasTex("fw-win" + key, 256, 256, (x, w, h) => {
    x.fillStyle = "#eef4fb"; x.fillRect(0, 0, w, h); const R = rng(seed);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { const X = c * 64 + 4, Y = r * 32 + 5, PW = 56, PH = 23, k = R();
      const g = x.createLinearGradient(0, Y, 0, Y + PH); g.addColorStop(0, `hsl(${H},${70 + k * 15}%,${84 - k * 8}%)`); g.addColorStop(0.55, `hsl(${H},${62 + k * 15}%,${68 - k * 10}%)`); g.addColorStop(1, `hsl(${H + 6},${55 + k * 15}%,${56 - k * 8}%)`);
      x.fillStyle = g; x.fillRect(X, Y, PW, PH);
      if (k > 0.86) { x.fillStyle = "rgba(255,255,255,.55)"; for (let s2 = 0; s2 < 5; s2++) x.fillRect(X, Y + 2 + s2 * 4, PW, 2); }
      else if (k > 0.8) { x.fillStyle = "rgba(60,170,90,.55)"; x.beginPath(); x.arc(X + 14, Y + PH - 3, 7, Math.PI, 0); x.fill(); }
      x.fillStyle = "rgba(255,255,255,.45)"; x.fillRect(X, Y, PW, 2); x.fillStyle = "#dbe6f2"; x.fillRect(X + PW / 2 - 1, Y, 2, PH); }
    x.fillStyle = "#ffffff"; for (let r = 0; r < 8; r++) x.fillRect(0, r * 32, w, 3);
    x.globalCompositeOperation = "lighter"; const sh = x.createLinearGradient(0, 0, w, h); sh.addColorStop(0.3, "rgba(255,255,255,0)"); sh.addColorStop(0.45, "rgba(255,255,255,.18)"); sh.addColorStop(0.55, "rgba(255,255,255,0)");
    x.fillStyle = sh; x.fillRect(0, 0, w, h); x.globalCompositeOperation = "source-over";
  });
  const em = canvasTex("fw-wine" + key, 256, 256, (x, w, h) => {
    x.fillStyle = "#000"; x.fillRect(0, 0, w, h); const R = rng(seed + 99);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { const on = R() < 0.6, warm = R() < 0.28;
      x.fillStyle = on ? (warm ? "#e8c27a" : lit) : "#0e2f66"; x.globalAlpha = on ? 0.62 + R() * 0.3 : 1; x.fillRect(c * 64 + 4, r * 32 + 5, 56, 23); x.globalAlpha = 1; }
    x.fillStyle = "#3fb6ff"; for (let r = 0; r < 8; r += 2) x.fillRect(0, r * 32, w, 2);
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

/* ---------- the sky the glass reflects: a small cube map (blue above, a bright horizon with a band of towers, light ground) ---------- */
let ENV = null;
function envMap() { if (ENV) return ENV; const face = (kind) => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
    if (kind === "py") { x.fillStyle = "#4aa8ff"; x.fillRect(0, 0, 128, 128); }
    else if (kind === "ny") { x.fillStyle = "#dfeefb"; x.fillRect(0, 0, 128, 128); }
    else { const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, "#4aa8ff"); g.addColorStop(0.5, "#bfe6ff"); g.addColorStop(0.62, "#f2f9ff"); g.addColorStop(1, "#cfe3f5"); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      const R = rng(kind.charCodeAt(1) * 7); x.fillStyle = "rgba(120,170,230,.55)"; let px = 0; while (px < 128) { const bw = 6 + R() * 12, bh = 10 + R() * 30; x.fillRect(px, 79 - bh, bw, bh); px += bw + 2; } }
    return c; };
  ENV = new THREE.CubeTexture(["px", "nx", "py", "ny", "pz", "nz"].map(face)); ENV.colorSpace = THREE.SRGBColorSpace; ENV.needsUpdate = true; return ENV; }

/* ---------- materials (neon glows more at night: night(k)) ---------- */
const MATS = new Map(), NIGHT = [], HALOS = [], ENVMATS = [];
function M(color, o = {}) { const key = color + JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v)); if (MATS.has(key)) return MATS.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2, ...o }); if (m.envMap) { m.userData.env = m.envMapIntensity; ENVMATS.push(m); } MATS.set(key, m); return m; }
function neon(color, day = 0.8, night = 2.2) { const key = "neon" + color + day + night; if (MATS.has(key)) return MATS.get(key);
  const m = new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: day, roughness: 0.35, metalness: 0.1 }); m.userData.day = day; m.userData.night = night; NIGHT.push(m); MATS.set(key, m); return m; }
function winMat(key, glass, lit, seed) { const k = "win" + key; if (MATS.has(k)) return MATS.get(k);
  const t = windowsTex(key, glass, lit, seed), m = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.em, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.04, roughness: 0.12, metalness: 0.35, envMap: envMap(), envMapIntensity: 0.85 });
  m.userData.day = 0.04; m.userData.night = 0.95; m.userData.env = m.envMapIntensity; ENVMATS.push(m); NIGHT.push(m); MATS.set(k, m); return m; }
const GLASS = () => M("#9fe8ff", { transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.6, depthWrite: false, envMap: envMap(), envMapIntensity: 1 });
const STEEL = () => M("#dfe6f0", { metalness: 0.75, roughness: 0.28, envMap: envMap(), envMapIntensity: 0.9 });
const DARK = () => M("#5d6f8c", { metalness: 0.45, roughness: 0.4 });
const WHITE = () => M("#f4f8ff", { metalness: 0.1, roughness: 0.35, emissive: new THREE.Color("#dcecff"), emissiveIntensity: 0.22 });

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
// a wood parquet floor laid in a chevron (columns of slanted planks, each column the other way), warm light tones
function parquetTex() { return canvasTex("fw-parquet", 512, 512, (x, w, h) => { const Rr = rng(77), cw = 64, ph = 32, T = ["#e9c49b", "#ddb07f", "#ecceaa", "#d6a576", "#f1d6b2", "#d19f70", "#e4bb8d"];
  for (let c = 0; c < w / cw; c++) { const dir = c % 2 ? 1 : -1, x0 = c * cw, sl = dir * cw * 0.5;
    for (let r = -3; r < h / ph + 3; r++) { const y = r * ph; x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + cw, y + sl); x.lineTo(x0 + cw, y + sl + ph); x.lineTo(x0, y + ph); x.closePath();
      x.fillStyle = T[Math.floor(Rr() * T.length)]; x.fill();
      x.save(); x.clip(); x.strokeStyle = "rgba(150,100,60,.18)"; x.lineWidth = 1; for (let k = 0; k < 4; k++) { const gy = y + 4 + Rr() * (ph - 8); x.beginPath(); x.moveTo(x0, gy); x.bezierCurveTo(x0 + cw * 0.3, gy + sl * 0.3 + (Rr() - 0.5) * 3, x0 + cw * 0.7, gy + sl * 0.7 + (Rr() - 0.5) * 3, x0 + cw, gy + sl); x.stroke(); } x.restore();
      x.strokeStyle = "rgba(110,70,40,.45)"; x.lineWidth = 2; x.stroke(); } }
  x.fillStyle = "rgba(255,255,255,.06)"; x.fillRect(0, 0, w, h); }); }
// the round mosaic in the middle of the mall: rings of colour and a star
function mosaicTex() { return canvasTex("fw-mosaic", 512, 512, (x, w, h) => { const c = w / 2, ring = (r0, r1, col) => { x.beginPath(); x.arc(c, c, r1, 0, TAU); x.arc(c, c, r0, 0, TAU, true); x.fillStyle = col; x.fill(); };
  ring(0, 256, "#ffffff"); ring(236, 252, "#59c8ff"); ring(222, 236, "#ffffff"); ring(206, 222, "#ff7ad9"); ring(196, 206, "#ffd65a");
  for (let k = 0; k < 48; k++) { const a = k / 48 * TAU; x.beginPath(); x.arc(c + Math.cos(a) * 180, c + Math.sin(a) * 180, 9, 0, TAU); x.fillStyle = ["#7dffb0", "#b18cff", "#59c8ff"][k % 3]; x.fill(); }
  x.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * TAU - Math.PI / 2, r = k % 2 ? 70 : 160; x.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); } x.closePath(); x.fillStyle = "#ffd65a"; x.fill(); x.strokeStyle = "#ffffff"; x.lineWidth = 6; x.stroke();
  ring(0, 62, "#59c8ff"); ring(0, 44, "#ffffff"); ring(0, 30, "#ff7ad9"); }, { repeat: false }); }
// colourful wall art for the walls between the shops: a soft gradient with circles and light stripes (three colour sets)
function wallArtTex(k) { const S = [["#ff9fd9", "#c7a6ff", "#8fd8ff"], ["#8fe9ff", "#9ff5c8", "#ffe28a"], ["#ffc29a", "#ff9fc8", "#b79bff"]][k % 3];
  return canvasTex("fw-wallart" + k, 256, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, w * 0.4, h); g.addColorStop(0, S[0]); g.addColorStop(0.5, S[1]); g.addColorStop(1, S[2]); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 10; for (let i = -4; i < 10; i++) { x.beginPath(); x.moveTo(0, i * 70); x.lineTo(w, i * 70 + 120); x.stroke(); }
    const Rr = rng(31 + k); for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(Rr() * w, Rr() * h, 14 + Rr() * 34, 0, TAU); x.fillStyle = `rgba(255,255,255,${0.22 + Rr() * 0.3})`; x.fill(); } }, { repeat: false }); }
// a living wall of plants, with little flowers
function plantWallTex() { return canvasTex("fw-plantwall", 512, 512, (x, w, h) => { const Rr = rng(9); x.fillStyle = "#2f8f5a"; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { const px = Rr() * w, py = Rr() * h, r = 8 + Rr() * 16; x.beginPath(); x.ellipse(px, py, r, r * 0.55, Rr() * Math.PI, 0, TAU); x.fillStyle = ["#3fbf6f", "#56d47f", "#2ea35c", "#7ee08f", "#4cc98a"][Math.floor(Rr() * 5)]; x.fill(); }
  for (let i = 0; i < 70; i++) { x.beginPath(); x.arc(Rr() * w, Rr() * h, 4 + Rr() * 3, 0, TAU); x.fillStyle = ["#ff7ad9", "#ffd65a", "#ffffff", "#b18cff"][i % 4]; x.fill(); } }); }
function plateGeo(x0, z0, x1, z1, y, tile) { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / tile, uv.getY(i) * (z1 - z0) / tile); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2); return g; }
// tower walls with the window texture repeated by floors
function towerGeo(w, d, h, y0 = 0) { let g = new THREE.BoxGeometry(w, h, d); g.translate(0, y0 + h / 2, 0); const uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) { const side = Math.abs(n.getX(i)) > 0.5 ? d : w; uv.setXY(i, uv.getX(i) * side / 8, uv.getY(i) * h / 8); }
  // drop the top and bottom faces (box faces 2 and 3: 6 indices each); the roof is added with its own material
  const idx = [...g.index.array]; g.setIndex([...idx.slice(0, 12), ...idx.slice(24)]); return g; }
function roundGeo(r, h, y0 = 0, seg = 28) { const g = new THREE.CylinderGeometry(r, r, h, seg, 1, true); g.translate(0, y0 + h / 2, 0); const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (TAU * r) / 8, uv.getY(i) * h / 8); return g; }
const ROOF = () => M("#f2f6fb", { metalness: 0.2, roughness: 0.4 });
const LIT_W = () => M("#f7fbff", { roughness: 0.4, metalness: 0.1, emissive: new THREE.Color("#eaf6ff"), emissiveIntensity: 0.25 });
// a tower piece: window walls + a light metal roof with a glowing edge
function tower(p, w, d, h, mat, x, y, z, edge = "#59e0ff") {
  p.acc.add(towerGeo(w, d, h), mat, m4(x, y, z), true);
  const e = neon(edge, 0.6, 2.2), Y = y + h + 0.55, W2 = (w + 0.5) / 2, D2 = (d + 0.5) / 2;
  p.box(w + 0.4, 0.5, d + 0.4, ROOF(), x, y + h + 0.25, z).box(w + 0.5, 0.14, 0.22, e, x, Y, z - D2, 0, false).box(w + 0.5, 0.14, 0.22, e, x, Y, z + D2, 0, false).box(0.22, 0.14, d + 0.5, e, x - W2, Y, z, 0, false).box(0.22, 0.14, d + 0.5, e, x + W2, Y, z, 0, false);
}
function roundTower(p, r, h, mat, x, y, z, edge = "#59e0ff") {
  p.acc.add(roundGeo(r, h), mat, m4(x, y, z), true);
  p.cyl(r + 0.2, 0.5, ROOF(), x, y + h + 0.25, z, 28).ring(r + 0.2, neon(edge, 0.6, 2.2), x, y + h + 0.55, z, Math.PI / 2, 0, 0.6);
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
  const beacon = neon("#ff5a6a", 1.2, 3.2);   // the blinking red lights on top of the towers

  /* ---------- the sea and the island ---------- */
  {
    // the sea: deep blue far out, bright turquoise near the island (a second, lighter sheet over the shallow water)
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#1aa4e6", roughness: 0.08, metalness: 0.35, emissive: new THREE.Color("#0b5fb0"), emissiveIntensity: 0.32 }));
    const [sx, sz] = W(0, 0); sea.position.set(sx, -0.9, sz); sea.receiveShadow = false; root.add(sea);
    const I = FL.ISLAND, [x0, z0] = W(I.x0, I.z0), [x1, z1] = W(I.x1, I.z1);
    { const shallowT = canvasTex("fw-shallow", 256, 256, (x, w, h) => { const g = x.createRadialGradient(128, 128, 60, 128, 128, 128); g.addColorStop(0, "rgba(120,240,240,.85)"); g.addColorStop(0.7, "rgba(60,215,235,.45)"); g.addColorStop(1, "rgba(30,170,230,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h); }, { repeat: false });
      const sh = new THREE.Mesh(new THREE.PlaneGeometry((x1 - x0) * 1.55, (z1 - z0) * 1.55).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shallowT, transparent: true, depthWrite: false, opacity: 0.9 }));
      sh.position.set((x0 + x1) / 2, -0.86, (z0 + z1) / 2); root.add(sh);
      // little light sparkles on the water: a slowly drifting sheet of tiny white dots
      const glintT = canvasTex("fw-glint", 512, 512, (x, w, h) => { const R2 = rng(5); for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,255,255,${0.25 + R2() * 0.6})`; x.fillRect(R2() * w, R2() * h, 2 + R2() * 6, 1); } });
      glintT.repeat.set(30, 30); const gl = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glintT, transparent: true, depthWrite: false, opacity: 0.5, blending: THREE.AdditiveBlending }));
      gl.position.set(sx, -0.84, sz); root.add(gl); anim.push({ fn: (t) => { glintT.offset.set(t * 0.004, t * 0.0025); gl.material.opacity = 0.32 + Math.sin(t * 0.7) * 0.12; } }); }
    const a = area(0, 0), p = new P(a.acc);
    const ft = floorTex(), fe = floorGlow(); [ft, fe].forEach((t) => t.repeat.set(1, 1));
    const floor = new THREE.MeshStandardMaterial({ map: ft, emissiveMap: fe, emissive: new THREE.Color("#59d6ff"), emissiveIntensity: 0.2, roughness: 0.32, metalness: 0.12 }); floor.userData.day = 0.2; floor.userData.night = 1.1; NIGHT.push(floor);
    p.geo(plateGeo(x0, z0, x1, z1, 0, 16), floor);
    // the shore: a white promenade of warm boards along every edge, a white sea wall down to the water and a low
    // glass railing with a light line on top (the edge of the walkable island)
    const PW = 5, boards = M("#ffffff", { map: (() => { const t = boardTex(); t.repeat.set(1, 1); return t; })(), roughness: 0.75, metalness: 0 });
    p.geo(plateGeo(x0, z0, x1, z0 + PW, 0.03, 8), boards).geo(plateGeo(x0, z1 - PW, x1, z1, 0.03, 8), boards).geo(plateGeo(x0, z0 + PW, x0 + PW, z1 - PW, 0.03, 8), boards).geo(plateGeo(x1 - PW, z0 + PW, x1, z1 - PW, 0.03, 8), boards);
    const kerb = M("#f4f8ff", { roughness: 0.4, metalness: 0.1 }), kerbLine = neon("#4fd2ff", 0.7, 2.2);
    p.box(x1 - x0 - 2 * PW, 0.14, 0.4, kerb, (x0 + x1) / 2, 0.07, z0 + PW, 0, false).box(x1 - x0 - 2 * PW, 0.14, 0.4, kerb, (x0 + x1) / 2, 0.07, z1 - PW, 0, false)
     .box(0.4, 0.14, z1 - z0 - 2 * PW, kerb, x0 + PW, 0.07, (z0 + z1) / 2, 0, false).box(0.4, 0.14, z1 - z0 - 2 * PW, kerb, x1 - PW, 0.07, (z0 + z1) / 2, 0, false);
    const wall = M("#eef4fb", { roughness: 0.55, metalness: 0.05 });
    p.box(x1 - x0 + 1.2, 3, 0.6, wall, (x0 + x1) / 2, -1.5, z0 - 0.3).box(x1 - x0 + 1.2, 3, 0.6, wall, (x0 + x1) / 2, -1.5, z1 + 0.3).box(0.6, 3, z1 - z0, wall, x0 - 0.3, -1.5, (z0 + z1) / 2).box(0.6, 3, z1 - z0, wall, x1 + 0.3, -1.5, (z0 + z1) / 2);
    p.box(x1 - x0 + 1.4, 0.1, 0.12, kerbLine, (x0 + x1) / 2, -0.55, z0 - 0.62, 0, false).box(x1 - x0 + 1.4, 0.1, 0.12, kerbLine, (x0 + x1) / 2, -0.55, z1 + 0.62, 0, false).box(0.12, 0.1, z1 - z0, kerbLine, x0 - 0.62, -0.55, (z0 + z1) / 2, 0, false).box(0.12, 0.1, z1 - z0, kerbLine, x1 + 0.62, -0.55, (z0 + z1) / 2, 0, false);
    const rail = M("#c9f1ff", { transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.5, depthWrite: false }), railTop = neon("#7fe3ff", 0.8, 2.4), post = M("#e9f0f9", { metalness: 0.6, roughness: 0.25 });
    [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]].forEach(([ax, az, bx, bz]) => { const L = Math.hypot(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2, along = az === bz;
      p.box(along ? L : 0.06, 1, along ? 0.06 : L, rail, mx, 0.55, mz, 0, false).box(along ? L : 0.1, 0.07, along ? 0.1 : L, railTop, mx, 1.06, mz, 0, false);
      for (let s = 0; s <= L; s += 6) p.box(0.12, 1.05, 0.12, post, along ? ax + s : ax, 0.53, along ? az : az + s, 0, false); });
    // glowing walkways that cross the island
    const lane = neon("#8a7bff", 0.55, 2), lane2 = neon("#4fd2ff", 0.6, 2);
    [[0, 66, 0, 40], [-28, 16, -24, 16], [28, 16, 24, 16]].forEach(([ax, az, bx, bz]) => { const [wx, wz] = W((ax + bx) / 2, (az + bz) / 2), L = Math.hypot(bx - ax, bz - az) || 1, vert = ax === bx; p.box(vert ? 0.18 : L, 0.03, vert ? L : 0.18, lane, wx - (vert ? 3 : 0), 0.02, wz - (vert ? 0 : 3), 0, false).box(vert ? 0.18 : L, 0.03, vert ? L : 0.18, lane2, wx + (vert ? 3 : 0), 0.02, wz + (vert ? 0 : 3), 0, false); });
    a.acc.build(a.g);
  }

  /* ---------- Neon Square: a white two-tier fountain with water jets, the hologram globe over it,
     hover benches, round planters and lines of light that run out to the edge ---------- */
  {
    const a = area(...FL.SQUARE.c), p = new P(a.acc), [cx, cz] = W(...FL.SQUARE.c);
    p.cyl(FL.SQUARE.r, 0.12, M("#e8f1fb", { metalness: 0.15, roughness: 0.3 }), cx, 0.06, cz, 48, false);
    p.cyl(10.6, 0.03, M("#d5ebfd", { metalness: 0.2, roughness: 0.25 }), cx, 0.135, cz, 48, false);   // the inner circle in a soft blue
    { const band = (r0, r1, col, y) => { const g = new THREE.RingGeometry(r0, r1, 96); g.rotateX(-Math.PI / 2); p.acc.add(g, neon(col, 0.8, 2.4), m4(cx, y, cz), false); };
      band(FL.SQUARE.r - 0.9, FL.SQUARE.r - 0.4, "#59e0ff", 0.13); band(10.35, 10.75, "#ff4fd8", 0.16); band(13.9, 14.05, "#8a7bff", 0.13); band(17.0, 17.15, "#8a7bff", 0.13); }
    const pearl = M("#f7fbff", { metalness: 0.25, roughness: 0.22, envMap: envMap(), envMapIntensity: 0.6 });
    const water = M("#3fc4ff", { transparent: true, opacity: 0.8, roughness: 0.04, metalness: 0.3, emissive: new THREE.Color("#0b8ae6"), emissiveIntensity: 0.55 });
    // the fountain: a wide low basin, a smaller one above it, a slim column with a light dish on top
    p.cyl(6.6, 0.8, pearl, cx, 0.4, cz, 48).ring(6.6, neon("#59e0ff", 0.9, 2.6), cx, 0.82, cz, Math.PI / 2, 0, 0.3).cyl(6.15, 0.08, water, cx, 0.74, cz, 48, false);
    p.cyl(3.2, 1.2, pearl, cx, 1.2, cz, 40).ring(3.2, neon("#ff7af0", 0.9, 2.6), cx, 1.82, cz, Math.PI / 2, 0, 0.4).cyl(2.9, 0.08, water, cx, 1.76, cz, 40, false);
    p.cyl(0.55, 1.6, pearl, cx, 2.6, cz, 16, true, 0.35).cyl(1.1, 0.25, pearl, cx, 3.45, cz, 24).ring(1.1, neon("#59e0ff", 1, 2.8), cx, 3.58, cz, Math.PI / 2, 0, 1);
    colliders.push({ c: [cx, cz], r: 7 });
    // lines of light from the inner circle out between the benches, ending at a planter
    const spoke = neon("#59e0ff", 0.7, 2.2);
    for (let i = 0; i < 8; i++) { const an = i / 8 * TAU + 0.2 + TAU / 16, rr = 12.4; p.box(3.6, 0.02, 0.16, spoke, cx + Math.cos(an) * rr, 0.135, cz + Math.sin(an) * rr, -an, false); }
    // hover benches: a white seat that floats over a glow on the floor, a coloured cushion, rounded ends
    const seatM = M("#ffffff", { metalness: 0.15, roughness: 0.25, envMap: envMap(), envMapIntensity: 0.5 }), CUSH = ["#59c8ff", "#ff7ad9", "#7dffb0", "#ffd65a"];
    const leaf = M("#4fd08a", { roughness: 0.75, metalness: 0 }), tip = neon("#7ff6ff", 0.5, 1.8);
    for (let i = 0; i < 8; i++) { const a2 = i / 8 * TAU + 0.2, bx = cx + Math.cos(a2) * 15.5, bz = cz + Math.sin(a2) * 15.5, ry = -a2 + Math.PI / 2;
      p.box(3.2, 0.22, 0.95, seatM, bx, 0.52, bz, ry).box(3.0, 0.05, 0.8, M(CUSH[i % 4], { roughness: 0.6, metalness: 0 }), bx, 0.65, bz, ry)
       .box(3.2, 0.72, 0.16, seatM, bx + Math.cos(a2) * 0.44, 0.98, bz + Math.sin(a2) * 0.44, ry).box(3.0, 0.08, 0.06, neon(CUSH[i % 4], 0.8, 2.4), bx + Math.cos(a2) * 0.53, 1.3, bz + Math.sin(a2) * 0.53, ry, false)
       .box(3.0, 0.05, 0.06, neon("#59e0ff", 1, 2.6), bx, 0.39, bz, ry, false).box(2.9, 0.02, 0.85, neon("#59e0ff", 0.3, 1.2), bx, 0.135, bz, ry, false);
      [-1, 1].forEach((sd) => p.box(0.16, 0.3, 0.95, seatM, bx + Math.cos(ry) * sd * 1.62, 0.76, bz - Math.sin(ry) * sd * 1.62, ry));
      seats.push({ x: bx - Math.cos(a2) * 0.05, z: bz - Math.sin(a2) * 0.05, f: Math.atan2(cx - bx, cz - bz), y: 0.66, k: "sit" }); colliders.push({ c: [bx, bz], r: 1.2 });
      // the planter between this bench and the next
      const a3 = a2 + TAU / 16, px = cx + Math.cos(a3) * 15.5, pz = cz + Math.sin(a3) * 15.5;
      p.cyl(0.85, 0.8, pearl, px, 0.4, pz, 24).ring(0.85, neon(CUSH[(i + 1) % 4], 0.8, 2.4), px, 0.82, pz, Math.PI / 2, 0, 1.2).cyl(0.75, 0.05, M("#7a5a3c", { roughness: 1, metalness: 0 }), px, 0.8, pz, 20, false)
       .cyl(0.09, 1.2, M("#e8dccb", { roughness: 0.8, metalness: 0 }), px, 1.4, pz, 6).sphere(0.95, leaf, px, 2.35, pz, 0.9).sphere(0.32, tip, px + 0.3, 2.95, pz - 0.2);
      colliders.push({ c: [px, pz], r: 1 }); }
    // the hologram globe: rings of light, glowing land, a little moon going round, in a soft beam from the fountain
    const holo = new THREE.Group(); holo.position.set(cx, 3.6, cz); a.far.add(holo);
    const hm = new THREE.MeshBasicMaterial({ color: "#4fd8ff", transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false });
    const globe = new THREE.Group(); globe.position.y = 3; holo.add(globe); const GR = 2.3;
    for (let i = 1; i < 6; i++) { const la = (i / 6 - 0.5) * Math.PI, t = new THREE.Mesh(new THREE.TorusGeometry(Math.cos(la) * GR, 0.03, 6, 48), hm); t.rotation.x = Math.PI / 2; t.position.y = Math.sin(la) * GR; globe.add(t); }
    for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(GR, 0.03, 6, 48), hm); t.rotation.y = i / 6 * Math.PI; globe.add(t); }
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(GR * 0.97, 32, 20), new THREE.MeshBasicMaterial({ color: "#1d7fff", transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })));
    { const land = []; const N = 1400; for (let i = 0; i < N; i++) { const y = 1 - (i + 0.5) / N * 2, rr = Math.sqrt(1 - y * y), th = i * 2.39996, x = Math.cos(th) * rr, z = Math.sin(th) * rr;
        if (Math.sin(x * 3.1 + 0.4) * Math.cos(y * 2.6) + Math.sin(z * 2.2 + 1.3) * 0.8 > 0.55) land.push(x * GR * 1.01, y * GR * 1.01, z * GR * 1.01); }
      const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(land, 3));
      globe.add(new THREE.Points(lg, new THREE.PointsMaterial({ color: "#6dffb8", size: 0.16, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }))); }
    const orbit = new THREE.Group(); orbit.position.y = 3; orbit.rotation.set(0.35, 0, 0.2); holo.add(orbit);
    { const t = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.025, 6, 64), new THREE.MeshBasicMaterial({ color: "#ff9cf0", transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); t.rotation.x = Math.PI / 2; orbit.add(t); }
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), new THREE.MeshBasicMaterial({ color: "#ffb8f4" })); orbit.add(moon);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 0.9, 3.2, 32, 1, true), new THREE.MeshBasicMaterial({ color: "#59e0ff", transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 1.5; holo.add(beam);
    const spN = 140, sp = new Float32Array(spN * 3), spd = []; for (let i = 0; i < spN; i++) spd.push([R() * TAU, R() * 5.6, 0.4 + R() * 2.6, 0.4 + R()]);
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    const spark = new THREE.Points(sg, new THREE.PointsMaterial({ color: "#bffcff", size: 0.14, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); spark.frustumCulled = false; holo.add(spark);
    // the water: 12 jets from the big basin into the small one, and a little crown of water on top (one Points draw)
    const JN = 12, JD = 16, CN = 36, wp = new Float32Array((JN * JD + CN) * 3), wg = new THREE.BufferGeometry(); wg.setAttribute("position", new THREE.BufferAttribute(wp, 3));
    const drops = new THREE.Points(wg, new THREE.PointsMaterial({ color: "#5cc4ff", size: 0.2, transparent: true, opacity: 0.85, depthWrite: false })); drops.position.set(cx, 0, cz); drops.frustumCulled = false; a.far.add(drops);
    anim.push({ a, fn: (t, dt, low) => { globe.rotation.y = t * 0.3; orbit.rotation.y = t * 0.7; const ma = t * 1.1; moon.position.set(Math.cos(ma) * 3.3, 0, Math.sin(ma) * 3.3);
      beam.material.opacity = 0.11 + Math.sin(t * 2.2) * 0.03;
      spark.visible = drops.visible = !low; if (low) return;
      for (let i = 0; i < spN; i++) { const d = spd[i], y = (d[1] + t * d[3]) % 5.8; sp[i * 3] = Math.cos(d[0] + t * 0.6) * d[2] * 0.6; sp[i * 3 + 1] = y; sp[i * 3 + 2] = Math.sin(d[0] + t * 0.6) * d[2] * 0.6; } sg.attributes.position.needsUpdate = true;
      let k = 0; for (let j = 0; j < JN; j++) { const an = j / JN * TAU; for (let q = 0; q < JD; q++) { const u = ((q / JD) + t * 0.9) % 1, rr = 5.6 - 2.5 * u, y = 0.82 + 1.0 * u + 4 * 1.7 * u * (1 - u);
          wp[k++] = Math.cos(an) * rr; wp[k++] = y; wp[k++] = Math.sin(an) * rr; } }
      for (let q = 0; q < CN; q++) { const an = q / CN * TAU * 3, u = ((q % 12) / 12 + t * 1.2) % 1, rr = 0.2 + u * 1.0; wp[k++] = Math.cos(an) * rr; wp[k++] = 3.6 + 4 * 0.9 * u * (1 - u); wp[k++] = Math.sin(an) * rr; }
      wg.attributes.position.needsUpdate = true; } });
    a.acc.build(a.g);
  }

  /* ---------- billboards that change their picture (Jumpi's own news, never real brands) ---------- */
  const ADS = [
    ["JUMPI NEWS", "#0b1230", "#5ff3ff"], ["HOVER MOTORS", "#1a0b30", "#ff7af0"], ["NEO FASHION", "#08201a", "#5bffb0"], ["GLOW PARK", "#201808", "#ffd65a"],
    ["SKY TOWER", "#0b1230", "#7fa8ff"], ["GADGET LAB", "#1a0b30", "#c58bff"], ["GRAND HOTEL", "#200b0b", "#ff8a5a"], ["WELCOME!", "#0b1230", "#5ff3ff"],
    ["GAME ZONE", "#0b1230", "#ffd65a"], ["EVENT TODAY!", "#1a0b30", "#ff7af0"], ["DAILY QUESTS", "#08201a", "#5bffb0"], ["NEW UPDATE!", "#0b1230", "#5ff3ff"],
  ];
  function billboard(a, lx, lz, ry, w, h, y, start) {
    const [x, z] = W(lx, lz), mats = ADS.map(([t, bg, fg], i) => { const m = new THREE.MeshBasicMaterial({ map: textTex("ad" + i, t, { bg, fg, w: 512, h: 256, size: t.length > 10 ? 64 : 84 }), transparent: true, opacity: 1 }); return m; });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats[start % mats.length]); scr.position.set(x, y, z); scr.rotation.y = ry; a.far.add(scr);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, h + 0.7, 0.4), WHITE()); back.position.set(x - Math.sin(ry) * 0.25, y, z - Math.cos(ry) * 0.25); back.rotation.y = ry; a.g.add(back);
    const fr = neon("#59e0ff", 0.9, 2.6), fx = Math.sin(ry) * 0.02, fz = Math.cos(ry) * 0.02;
    [[0, h / 2 + 0.22, w + 0.5, 0.1], [0, -h / 2 - 0.22, w + 0.5, 0.1], [-w / 2 - 0.22, 0, 0.1, h + 0.5], [w / 2 + 0.22, 0, 0.1, h + 0.5]].forEach(([ox, oy, bw, bh]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.1), fr); m.position.set(x + Math.cos(ry) * ox + fx, y + oy, z - Math.sin(ry) * ox + fz); m.rotation.y = ry; a.g.add(m); });
    let k = start; anim.push({ a, fn: (t) => { const i = Math.floor(t / 6 + start) % mats.length; if (i !== k) { k = i; scr.material = mats[i]; } scr.scale.y = 1 - Math.max(0, 1 - ((t / 6 + start) % 1) * 12) * 0.9; } });
  }

  /* ---------- the Sky Mall: glass floors, lifts that go up and down, shops inside ---------- */
  {
    const r = FL.MALL.rect, a = area((r[0] + r[2]) / 2, (r[1] + r[3]) / 2), p = new P(a.acc);
    // a tall ground floor (10 high) and three shop floors above it, around a big open atrium in the middle
    const [x0, z0] = W(r[0], r[1]), [x1, z1] = W(r[2], r[3]), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, FH = 6, G0 = FL.MALL.ceil, TOP = G0 + FH * (FL.MALL.floors - 2), H = TOP + FH;
    const ax0 = x0 + 14, ax1 = x1 - 14, az0 = z0 + 12, az1 = z1 - 12;   // the atrium hole
    const slab = M("#d9e3f2", { metalness: 0.3, roughness: 0.35 }), rail = M("#bff1ff", { transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.5, depthWrite: false });
    const FLOORCOL = ["#ffd3ec", "#cdefff", "#e2d8ff"];
    for (let f = 0; f < FL.MALL.floors - 1; f++) { const y = G0 + f * FH, glow = neon(f % 2 ? "#ff4fd8" : "#59e0ff", 0.8, 2.4), slab = M(FLOORCOL[f % 3], { metalness: 0.2, roughness: 0.35, emissive: new THREE.Color(FLOORCOL[f % 3]), emissiveIntensity: 0.25 });
      p.box(w, 0.5, az0 - z0, slab, cx, y, (z0 + az0) / 2, 0, false).box(w, 0.5, z1 - az1, slab, cx, y, (az1 + z1) / 2, 0, false).box(ax0 - x0, 0.5, az1 - az0, slab, (x0 + ax0) / 2, y, (az0 + az1) / 2, 0, false).box(x1 - ax1, 0.5, az1 - az0, slab, (ax1 + x1) / 2, y, (az0 + az1) / 2, 0, false);
      // glass balcony around the atrium with a glowing line
      p.box(ax1 - ax0, 1.1, 0.08, rail, (ax0 + ax1) / 2, y + 0.8, az0, 0, false).box(ax1 - ax0, 1.1, 0.08, rail, (ax0 + ax1) / 2, y + 0.8, az1, 0, false).box(0.08, 1.1, az1 - az0, rail, ax0, y + 0.8, (az0 + az1) / 2, 0, false).box(0.08, 1.1, az1 - az0, rail, ax1, y + 0.8, (az0 + az1) / 2, 0, false);
      p.box(ax1 - ax0, 0.1, 0.16, glow, (ax0 + ax1) / 2, y + 1.38, az0, 0, false).box(ax1 - ax0, 0.1, 0.16, glow, (ax0 + ax1) / 2, y + 1.38, az1, 0, false).box(0.16, 0.1, az1 - az0, glow, ax0, y + 1.38, (az0 + az1) / 2, 0, false).box(0.16, 0.1, az1 - az0, glow, ax1, y + 1.38, (az0 + az1) / 2, 0, false);
      { const cc = new THREE.Color("#ffffff").lerp(new THREE.Color(FLOORCOL[f % 3]), 0.45), cm = M("#" + cc.getHexString(), { roughness: 0.6, metalness: 0, emissive: cc, emissiveIntensity: 0.55 }), cy = y - 0.27;   // a light ceiling under every floor
        p.box(w, 0.04, az0 - z0, cm, cx, cy, (z0 + az0) / 2, 0, false).box(w, 0.04, z1 - az1, cm, cx, cy, (az1 + z1) / 2, 0, false).box(ax0 - x0, 0.04, az1 - az0, cm, (x0 + ax0) / 2, cy, (az0 + az1) / 2, 0, false).box(x1 - ax1, 0.04, az1 - az0, cm, (ax1 + x1) / 2, cy, (az0 + az1) / 2, 0, false); }
      p.box(w + 0.2, 0.18, 0.3, glow, cx, y - 0.2, z0, 0, false).box(w + 0.2, 0.18, 0.3, glow, cx, y - 0.2, z1, 0, false).box(0.3, 0.18, d + 0.2, glow, x0, y - 0.2, cz, 0, false).box(0.3, 0.18, d + 0.2, glow, x1, y - 0.2, cz, 0, false);
      // ceiling lights under each floor
      for (let i = 0; i < 5; i++) { const lx = x0 + 4 + i * (w - 8) / 4; [z0 + 6, z1 - 6].forEach((lz) => p.box(5, 0.08, 1.2, neon("#e9fbff", 0.9, 1.8), lx, y - 0.34, lz, 0, false)); }
      // the shops upstairs: glowing fronts along the back walls
      p.box(w - 4, FH - 0.8, 2, winMat("mallshop" + (f % 3), "#9c7bff", "#ffd6ff", 30 + f), cx, y + FH / 2, z0 + 2.2).box(w - 4, FH - 0.8, 2, winMat("mallshop" + ((f + 1) % 3), "#5fd6ff", "#c9fbff", 40 + f), cx, y + FH / 2, z1 - 2.2); }
    p.box(w, 0.5, d, slab, cx, H, cz, 0, false).box(ax1 - ax0, 0.12, az1 - az0, GLASS(), (ax0 + ax1) / 2, H + 0.3, (az0 + az1) / 2, 0, false);   // the roof with a glass skylight
    // columns and glass walls (the front has a wide door)
    const COLC = ["#ff7ad9", "#59c8ff", "#ffd65a", "#7dffb0", "#b18cff"], colM = (i) => M(COLC[i % 5], { metalness: 0.3, roughness: 0.3, emissive: new THREE.Color(COLC[i % 5]), emissiveIntensity: 0.18 });
    for (let i = 0; i <= 6; i++) { const x = x0 + i * w / 6; [z0, z1].forEach((zz, k) => p.box(0.7, H, 0.7, colM(i + k * 2), x, H / 2, zz)); }
    for (let i = 0; i <= 5; i++) { const z = z0 + i * d / 5; [x0, x1].forEach((xx, k) => p.box(0.7, H, 0.7, colM(i + 1 + k * 3), xx, H / 2, z)); }
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
    const parquet = M("#ffffff", { map: parquetTex(), roughness: 0.35, metalness: 0.05, envMap: envMap(), envMapIntensity: 0.25 });
    p.geo(plateGeo(ix0, iz0, ix1, iz1, 0.04, 6), parquet);
    { const bd = (x0b, z0b, x1b, z1b, c, y) => p.box(x1b - x0b, 0.02, z1b - z0b, M(c, { roughness: 0.4, metalness: 0.1, emissive: new THREE.Color(c), emissiveIntensity: 0.3 }), (x0b + x1b) / 2, y, (z0b + z1b) / 2, 0, false);
      [[0.6, "#59c8ff"], [1.0, "#ff7ad9"]].forEach(([o, c]) => { bd(ix0 + o, iz0 + o, ix1 - o, iz0 + o + 0.18, c, 0.05); bd(ix0 + o, iz1 - o - 0.18, ix1 - o, iz1 - o, c, 0.05); bd(ix0 + o, iz0 + o, ix0 + o + 0.18, iz1 - o, c, 0.05); bd(ix1 - o - 0.18, iz0 + o, ix1 - o, iz1 - o, c, 0.05); }); }
    { const [mx2, mz2] = W(-55, 10), mo = new THREE.Mesh(new THREE.CircleGeometry(6, 64).rotateX(-Math.PI / 2), M("#ffffff", { map: mosaicTex(), roughness: 0.3, metalness: 0.05, emissive: new THREE.Color("#ffffff"), emissiveMap: mosaicTex(), emissiveIntensity: 0.12 }));
      mo.position.set(mx2, 0.055, mz2); mo.receiveShadow = true; a.g.add(mo); }
    // colourful wall art in the gaps between the shops (to the ceiling), and a living wall of plants on the west side
    { const wall = (lx0, lx1, lz, face, k) => { const [wx0, wz] = W(lx0, lz), [wx1] = W(lx1, lz), wd = wx1 - wx0; if (wd < 1) return;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, G0 - 0.4), M("#ffffff", { map: wallArtTex(k), roughness: 0.6, metalness: 0, emissive: new THREE.Color("#ffffff"), emissiveMap: wallArtTex(k), emissiveIntensity: 0.25 }));
        m.position.set((wx0 + wx1) / 2, (G0 - 0.4) / 2, wz + face * 0.05); m.rotation.y = face > 0 ? 0 : Math.PI; a.g.add(m); };
      const zN = FL.MALL.inside[1], zS = FL.MALL.inside[3], N = FL.FW_SHOPS.filter((q) => q.z < 10).map((q) => q.x).sort((p1, p2) => p1 - p2), Sx = FL.FW_SHOPS.filter((q) => q.z >= 10).map((q) => q.x).sort((p1, p2) => p1 - p2), hw2 = FL.SHOP_W / 2;
      const gaps = (xs) => { const out = [], L0 = FL.MALL.inside[0], L1 = FL.MALL.inside[2]; let cur = L0; xs.forEach((sx2) => { out.push([cur, sx2 - hw2]); cur = sx2 + hw2; }); out.push([cur, L1]); return out; };
      gaps(N).forEach(([g0, g1], k) => wall(g0, g1, zN, 1, k)); gaps(Sx).forEach(([g0, g1], k) => wall(g0, g1, zS, -1, k + 1));
      const [wx, wz0] = W(FL.MALL.inside[0], -2), [, wz1] = W(0, 20), pw2 = new THREE.Mesh(new THREE.PlaneGeometry(wz1 - wz0, G0 - 0.4), M("#ffffff", { map: plantWallTex(), roughness: 0.9, metalness: 0 }));
      pw2.position.set(wx + 0.05, (G0 - 0.4) / 2, (wz0 + wz1) / 2); pw2.rotation.y = Math.PI / 2; a.g.add(pw2);
      p.box(0.3, 0.6, wz1 - wz0, M("#f4f8ff", { roughness: 0.4, metalness: 0.1 }), wx + 0.3, 0.3, (wz0 + wz1) / 2).box(0.32, 0.06, wz1 - wz0, neon("#7dffb0", 0.9, 2.4), wx + 0.3, 0.62, (wz0 + wz1) / 2, 0, false); }
    // the shops: real little rooms you walk into. A glass front with a door that slides open when you come near,
    // the name over the door, a window display on each side, a counter with a robot shop assistant, shelves on the
    // back wall, a light ring hanging from above, and the things the shop sells along both side walls.
    const SHOPLOOK = { "f-fashion": ["#ff4fd8", "#ffe3f5", "#fbeefa"], "f-tech": ["#36c8ff", "#dff4ff", "#eef8ff"], "f-hover": ["#ffa53d", "#ffefd8", "#fff6ea"],
      "f-style": ["#a77bff", "#ede4ff", "#f5f0ff"], "f-home": ["#3fc97f", "#dff6e8", "#eefaf2"], "f-hats": ["#ff6f5a", "#ffe5de", "#fff2ee"] };
    const PAL = ["#ff4fd8", "#59c8ff", "#ffd65a", "#7dffb0", "#b18cff", "#ff7a59", "#ffffff"];
    const LIT = (c, k = 0.32) => M(c, { roughness: 0.55, metalness: 0.05, emissive: new THREE.Color(c), emissiveIntensity: k });
    const frost = M("#e9f7ff", { transparent: true, opacity: 0.38, roughness: 0.05, metalness: 0.4, depthWrite: false }), white = LIT("#ffffff", 0.3), navy = M("#13224a", { metalness: 0.5, roughness: 0.15 });
    const robotAt = (x, z, dir, band) => { const y = 0.2;   // a helper robot behind the counter, floating a little
      p.cyl(0.42, 0.95, white, x, y + 1.0, z, 18).sphere(0.42, white, x, y + 0.55, z, 0.7).sphere(0.38, white, x, y + 1.85, z)
       .box(0.58, 0.2, 0.14, navy, x, y + 1.88, z + dir * 0.3, 0, false).box(0.09, 0.09, 0.05, neon("#7ff6ff", 1.4, 3), x - 0.12, y + 1.89, z + dir * 0.38, 0, false).box(0.09, 0.09, 0.05, neon("#7ff6ff", 1.4, 3), x + 0.12, y + 1.89, z + dir * 0.38, 0, false)
       .ring(0.43, neon(band, 1, 2.6), x, y + 1.15, z, Math.PI / 2, 0, 1.4).ring(0.34, neon("#59e0ff", 1.2, 3), x, 0.12, z, Math.PI / 2, 0, 1.4); };
    // what each shop sells, drawn small: one item at (x, z), standing on the floor (y0), facing dir (+1 / -1 along z)
    const ITEM = {
      shirt: (x, z, c, y0 = 0) => p.box(0.06, 0.06, 1.0, STEEL(), x, y0 + 1.95, z, 0, false).box(0.9, 1.0, 0.14, M(c, { roughness: 0.7, metalness: 0 }), x, y0 + 1.38, z).box(0.3, 0.08, 0.16, M(c, { roughness: 0.7, metalness: 0 }), x - 0.5, y0 + 1.78, z).box(0.3, 0.08, 0.16, M(c, { roughness: 0.7, metalness: 0 }), x + 0.5, y0 + 1.78, z),
      glasses: (x, z, c, y0 = 0) => p.ring(0.13, M(c, { metalness: 0.4, roughness: 0.3 }), x - 0.16, y0 + 0.04, z, Math.PI / 2, 0, 3).ring(0.13, M(c, { metalness: 0.4, roughness: 0.3 }), x + 0.16, y0 + 0.04, z, Math.PI / 2, 0, 3).box(0.1, 0.03, 0.03, M(c), x, y0 + 0.04, z, 0, false).box(0.22, 0.01, 0.22, M("#bff1ff", { transparent: true, opacity: 0.5, roughness: 0.05, depthWrite: false }), x - 0.16, y0 + 0.04, z, 0, false).box(0.22, 0.01, 0.22, M("#bff1ff", { transparent: true, opacity: 0.5, roughness: 0.05, depthWrite: false }), x + 0.16, y0 + 0.04, z, 0, false),
      vehicle: (x, z, c, y0 = 0) => p.box(0.75, 0.38, 2.0, M(c, { metalness: 0.5, roughness: 0.25, envMap: envMap(), envMapIntensity: 0.7 }), x, y0 + 0.95, z).sphere(0.4, M(c, { metalness: 0.5, roughness: 0.25 }), x, y0 + 0.98, z + 1.0, 0.8).box(0.55, 0.16, 0.8, navy, x, y0 + 1.2, z - 0.3).box(0.6, 0.3, 0.06, M("#bff1ff", { transparent: true, opacity: 0.55, roughness: 0.05, depthWrite: false }), x, y0 + 1.3, z + 0.55, 0, false)
        .ring(0.42, neon("#59e0ff", 1.2, 3), x, y0 + 0.55, z + 0.6, Math.PI / 2, 0, 2).ring(0.42, neon("#59e0ff", 1.2, 3), x, y0 + 0.55, z - 0.6, Math.PI / 2, 0, 2),
      hair: (x, z, c, y0 = 0) => p.cyl(0.08, 0.5, STEEL(), x, y0 + 0.25, z, 8).sphere(0.32, M("#f3e6da", { roughness: 0.6, metalness: 0 }), x, y0 + 0.78, z).sphere(0.36, M(c, { roughness: 0.75, metalness: 0 }), x, y0 + 0.92, z - 0.05, 0.8).sphere(0.16, M(c, { roughness: 0.75, metalness: 0 }), x + 0.22, y0 + 1.15, z - 0.1),
      hat: (x, z, c, y0 = 0, k = 0) => { const m = M(c, { roughness: 0.6, metalness: 0.05 });
        if (k % 3 === 0) p.cyl(0.42, 0.05, m, x, y0 + 0.03, z, 20).cyl(0.26, 0.45, m, x, y0 + 0.28, z, 20).cyl(0.27, 0.08, neon("#ffffff", 0.6, 1.8), x, y0 + 0.12, z, 20, false);
        else if (k % 3 === 1) p.sphere(0.3, m, x, y0 + 0.02, z, 0.65).box(0.42, 0.04, 0.32, m, x, y0 + 0.04, z + 0.36);
        else p.cyl(0.3, 0.6, m, x, y0 + 0.3, z, 18, true, 0.001).sphere(0.08, neon("#ffffff", 0.8, 2), x, y0 + 0.62, z); },
      furniture: (x, z, c, y0 = 0) => { const m = M(c, { roughness: 0.8, metalness: 0 }); p.box(1.6, 0.45, 0.8, m, x, y0 + 0.32, z).box(1.6, 0.6, 0.22, m, x, y0 + 0.75, z - 0.32).box(0.2, 0.55, 0.8, m, x - 0.8, y0 + 0.45, z).box(0.2, 0.55, 0.8, m, x + 0.8, y0 + 0.45, z).box(1.5, 0.06, 0.08, neon("#ffffff", 0.5, 1.6), x, y0 + 0.08, z + 0.42, 0, false); },
    };
    // the real things each shop sells, made by the game the way the store makes them (host.shopItems); if the game
    // can't give them yet, the simple stand-ins above are used. put(): stand one on (x, y, z), turned ry, as wide as size
    const REAL = (kind) => { try { return (host.shopItems && host.shopItems(kind)) || []; } catch (e) { return []; } };
    const put = (obj, x, y, z, ry = 0, size = 0, top = false) => { if (!obj) return null; const h = new THREE.Group(); h.add(obj); h.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(h); if (bb.isEmpty()) return null; const sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
      obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= top ? bb.max.y : bb.min.y;
      h.scale.setScalar(size ? size / Math.max(sz.x, sz.z, 0.001) : 1); h.position.set(x, y, z); h.rotation.y = ry; a.far.add(h); return h; };
    const make = (L, k, mode) => { if (!L.length) return null; try { return L[k % L.length](mode); } catch (e) { return null; } };
    FL.FW_SHOPS.forEach((s, si) => { const S = FL.shopRoom(s), [col, soft, fl] = SHOPLOOK[s.id] || ["#59e0ff", "#e2f7ff", "#eef9ff"], dir = -S.back;   // dir: from the back wall towards the door
      const [sx, sb] = W(s.x, S.zb), [, sf] = W(0, S.zf), hw = FL.SHOP_W / 2, x0 = sx - hw, x1 = sx + hw, zc = (sb + sf) / 2, D = FL.SHOP_D, HH = 7, dh = FL.SHOP_DOOR / 2, glow = neon(col, 0.9, 2.6);
      const Z = (k) => sb + dir * k, out = dir > 0 ? 0 : Math.PI, L = REAL(s.kind); let n = 0; const next = (mode) => make(L, n++, mode);
      // floor, back wall in the shop colour, side walls white below and frosted glass above
      p.box(FL.SHOP_W - 0.3, 0.05, D - 0.3, M(fl, { map: parquetTex(), roughness: 0.35, metalness: 0.05, emissive: new THREE.Color(fl), emissiveIntensity: 0.08 }), sx, 0.07, zc, 0, false).box(FL.SHOP_W - 1.2, 0.02, 0.1, glow, sx, 0.1, Z(D - 0.6), 0, false);
      p.box(FL.SHOP_W, HH, 0.3, LIT(soft, 0.45), sx, HH / 2, Z(0.15));
      const tintW = LIT(soft, 0.35), postM = M(col, { metalness: 0.3, roughness: 0.3, emissive: new THREE.Color(col), emissiveIntensity: 0.25 });
      [x0, x1].forEach((wx) => { p.box(0.3, 3.4, D, tintW, wx, 1.7, zc).box(0.3, HH - 3.4, D, frost, wx, 3.4 + (HH - 3.4) / 2, zc, 0, false).box(0.34, 0.1, D, glow, wx, 3.42, zc, 0, false).box(0.34, 0.14, D, white, wx, HH, zc, 0, false);
        colliders.push({ box: [wx - 0.3, Math.min(sb, sf), wx + 0.3, Math.max(sb, sf)] }); });
      // the glass front: two panes, white posts, a white band over the door with the name on it, a light round the door
      const pw = hw - dh, gl = GLASS();
      [-1, 1].forEach((sd) => { const px = sx + sd * (dh + pw / 2); p.box(pw, 5, 0.1, gl, px, 2.5, sf, 0, false).box(pw, 0.18, 0.3, white, px, 0.09, sf);
        colliders.push({ box: [sd < 0 ? x0 : sx + dh, sf - 0.25, sd < 0 ? sx - dh : x1, sf + 0.25] }); });
      [x0, sx - dh, sx + dh, x1].forEach((px) => p.box(0.24, 5, 0.34, postM, px, 2.5, sf));
      p.box(FL.SHOP_W + 0.3, HH - 5, 0.5, tintW, sx, 5 + (HH - 5) / 2, sf).box(FL.SHOP_W + 0.3, 0.1, 0.56, glow, sx, 5.02, sf, 0, false).box(FL.SHOP_DOOR, 0.1, 0.4, glow, sx, 4.75, sf, 0, false)
       .box(0.1, 4.7, 0.4, glow, sx - dh + 0.1, 2.35, sf, 0, false).box(0.1, 4.7, 0.4, glow, sx + dh - 0.1, 2.35, sf, 0, false);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 1.5), new THREE.MeshBasicMaterial({ map: textTex("shop" + s.id, s.title, { bg: "#0b1230", fg: col, w: 768, h: 140, size: 84 }), transparent: true }));
      sign.position.set(sx, 6, sf + dir * 0.27); sign.rotation.y = out; a.far.add(sign);
      // the door: two glass halves that slide behind the panes
      const dmat = M("#c9f3ff", { transparent: true, opacity: 0.4, roughness: 0.05, metalness: 0.5, depthWrite: false }), dl = new THREE.Mesh(new THREE.BoxGeometry(dh, 4.6, 0.08), dmat), dr = dl.clone(); a.g.add(dl, dr);
      [dl, dr].forEach((d) => { const h = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.14), glow); h.position.set(d === dl ? dh / 2 - 0.15 : -dh / 2 + 0.15, 0, 0); d.add(h); });
      doors.push({ x: sx, z: sf, open: 0, fn: (k) => { const zz = sf - dir * 0.16; dl.position.set(sx - dh / 2 - k * (dh - 0.1), 2.3, zz); dr.position.set(sx + dh / 2 + k * (dh - 0.1), 2.3, zz); } });

      // the window displays just inside the glass, one on each side of the door: a white Jumpi dummy wearing the
      // shop's things (clothes and hats), a big pair of glasses, a head with a hairstyle, a vehicle, a piece of furniture
      [-1, 1].forEach((sd, k) => { const wx = sx + sd * (dh + pw / 2), wz = sf - dir * 1.4; p.cyl(1.05, 0.4, white, wx, 0.2, wz, 28).ring(1.05, glow, wx, 0.41, wz, Math.PI / 2, 0, 1.2);
        colliders.push({ c: [wx, wz], r: 1.25 });
        let ok = null;
        if (s.kind === "shirt" || s.kind === "hat") ok = put(next("dummy"), wx, 0.4, wz, out + sd * 0.35);
        else if (s.kind === "glasses") { p.cyl(0.1, 1.1, STEEL(), wx, 0.95, wz, 8); ok = put(next("alone"), wx, 1.5, wz, out, 1.5); }
        else if (s.kind === "hair") { p.cyl(0.1, 0.9, STEEL(), wx, 0.85, wz, 8); ok = put(next("bust"), wx, 1.3, wz, out + sd * 0.3, 1.4); }
        else if (s.kind === "vehicle") ok = put(next("alone"), wx, 0.42, wz, out + Math.PI / 2 + sd * 0.5, 0);
        else ok = put(next("alone"), wx, 0.42, wz, out, 1.7);
        if (ok) return;
        // stand-ins
        if (s.kind === "shirt") { p.cyl(0.08, 1.1, STEEL(), wx, 0.95, wz, 8).cyl(0.36, 1.1, M(PAL[k + si], { roughness: 0.7, metalness: 0 }), wx, 1.95, wz, 16, true, 0.3).sphere(0.28, white, wx, 2.8, wz); }
        else if (s.kind === "glasses") { const m = M(PAL[k + 1], { metalness: 0.4, roughness: 0.3 }); p.ring(0.42, m, wx - 0.5, 1.9, wz, 0, 0, 3).ring(0.42, m, wx + 0.5, 1.9, wz, 0, 0, 3).box(0.3, 0.09, 0.09, m, wx, 2.0, wz, 0, false); }
        else if (s.kind === "vehicle") ITEM.vehicle(wx, wz, PAL[k * 2 + 1], 0.1);
        else if (s.kind === "hair") ITEM.hair(wx, wz, PAL[k * 3], 1.2);
        else if (s.kind === "hat") { p.cyl(0.1, 1.1, STEEL(), wx, 0.95, wz, 8).sphere(0.36, white, wx, 1.8, wz); ITEM.hat(wx, wz, PAL[k + 4], 2.05, k); }
        else ITEM.furniture(wx, wz, PAL[k + 1], 0.4); });

      // the counter and the robot behind it, and a screen with the shop's name on the back wall
      p.box(5, 1.1, 1.1, white, sx, 0.55, Z(3)).box(5.1, 0.08, 1.2, glow, sx, 1.14, Z(3), 0, false).box(4.6, 0.7, 0.04, LIT(soft, 0.4), sx, 0.55, Z(3) + dir * 0.56, 0, false)
       .box(0.7, 0.5, 0.5, M("#2a3042", { metalness: 0.4, roughness: 0.3 }), sx + 1.4, 1.43, Z(3), 0, true).box(0.6, 0.38, 0.04, neon(col, 1, 2.6), sx + 1.4, 1.45, Z(3) + dir * 0.26, 0, false);
      colliders.push({ box: [sx - 2.6, Math.min(Z(2.4), Z(3.6)), sx + 2.6, Math.max(Z(2.4), Z(3.6))] });
      robotAt(sx, Z(1.6), dir, col); colliders.push({ c: [sx, Z(1.6)], r: 0.7 });
      // one thing for sale on the counter too
      if (s.kind === "glasses" || s.kind === "hat") put(next(s.kind === "hat" ? "bust" : "alone"), sx - 1.3, 1.18, Z(3), out + 0.3, s.kind === "hat" ? 0.6 : 0.6);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.7), new THREE.MeshBasicMaterial({ map: textTex("shopb" + s.id, s.title, { bg: "#0b1230", fg: col, w: 768, h: 240, size: 92 }) }));
      scr.position.set(sx, 4.4, Z(0.32)); scr.rotation.y = out; a.far.add(scr);

      // shelves on the back wall on both sides of the screen, with the shop's things on them
      [-1, 1].forEach((sd) => { const bx = sx + sd * 4.2; for (let k = 0; k < 3; k++) { const y = 1.3 + k * 1.15; p.box(2.6, 0.08, 0.6, white, bx, y, Z(0.6)).box(2.6, 0.04, 0.05, glow, bx, y + 0.05, Z(0.92), 0, false);
        const per = s.kind === "hair" || s.kind === "furniture" || s.kind === "vehicle" ? 2 : 3;
        for (let q = 0; q < per; q++) { const ix = bx - 0.8 * (per - 1) / 2 * 2 / (per - 1 || 1) + q * (1.6 / (per - 1 || 1)), c = PAL[(k + q + si) % 6]; let ok = null;
          if (s.kind === "glasses") ok = put(next("alone"), ix, y + 0.05, Z(0.62), out, 0.68);
          else if (s.kind === "hat") ok = put(next("bust"), ix, y + 0.05, Z(0.62), out, 0.62);
          else if (s.kind === "hair") ok = put(next("bust"), ix, y + 0.05, Z(0.62), out, 0.62);
          else if (s.kind === "furniture") ok = put(next("alone"), ix, y + 0.05, Z(0.62), out, 0.7);
          else if (s.kind === "shirt") { const m = LIT(c, 0.25); for (let f = 0; f < 3; f++) p.box(0.6, 0.09, 0.42, m, ix, y + 0.1 + f * 0.1, Z(0.6)); ok = true; }   // folded shirts
          if (ok) continue;
          if (s.kind === "glasses") ITEM.glasses(ix, Z(0.6), c, y + 0.05); else if (s.kind === "hat") ITEM.hat(ix, Z(0.6), c, y + 0.05, k + q);
          else if (s.kind === "hair") { p.sphere(0.22, M("#f3e6da", { roughness: 0.6, metalness: 0 }), ix, y + 0.27, Z(0.6)).sphere(0.25, M(c, { roughness: 0.75, metalness: 0 }), ix, y + 0.38, Z(0.6), 0.75); }
          else p.box(0.5, 0.4 + ((k + q) % 2) * 0.2, 0.4, LIT(c, 0.25), ix, y + 0.25 + ((k + q) % 2) * 0.1, Z(0.6)); } } });
      // a ring of light hanging from above
      p.ring(1.8, glow, sx, 6.4, zc, Math.PI / 2, 0, 1.2).box(0.04, 0.6, 0.04, STEEL(), sx, 6.75, zc, 0, false);

      // along both side walls: what the shop sells
      const zA = 4.6, zB = D - 2.9, face = (sd) => (sd < 0 ? Math.PI / 2 : -Math.PI / 2);   // things on the walls face the middle of the shop
      [-1, 1].forEach((sd) => { const wx = sd < 0 ? x0 + 1.0 : x1 - 1.0;
        colliders.push({ box: [sd < 0 ? x0 : x1 - 2.0, Math.min(Z(zA - 0.8), Z(zB + 0.8)), sd < 0 ? x0 + 2.0 : x1, Math.max(Z(zA - 0.8), Z(zB + 0.8))] });
        if (s.kind === "shirt") { // three white Jumpi dummies on round stands, each wearing a different outfit from the shop
          for (let q = 0; q < 3; q++) { const z = Z(zA - 0.2 + q * (zB - zA + 0.4) / 2); p.cyl(0.7, 0.2, white, wx, 0.1, z, 24).ring(0.7, glow, wx, 0.21, z, Math.PI / 2, 0, 1.2);
            if (!put(next("dummy"), wx, 0.2, z, face(sd) + (q - 1) * 0.35)) { const c = LIT(PAL[(q + si) % 6], 0.22); p.box(0.12, 1.0, 0.9, c, wx, 1.38, z); } } }
        else if (s.kind === "glasses") { for (let q = 0; q < 2; q++) { const z = Z(zA + 0.4 + q * (zB - zA - 0.8)); p.box(1.4, 0.9, 1.6, white, wx, 0.45, z).box(1.5, 0.06, 1.7, glow, wx, 0.92, z, 0, false).box(1.3, 0.55, 1.5, M("#bff1ff", { transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false }), wx, 1.22, z, 0, false);
            for (let g = 0; g < 3; g++) if (!put(next("alone"), wx, 0.96, z - 0.5 + g * 0.5, face(sd), 0.5)) ITEM.glasses(wx, z - 0.5 + g * 0.5, PAL[(g + q + si) % 6], 0.95); } }
        else if (s.kind === "vehicle") { const z = Z((zA + zB) / 2); p.cyl(1.4, 0.25, white, wx, 0.13, z, 32).ring(1.4, glow, wx, 0.27, z, Math.PI / 2, 0, 1.2);
          if (!put(next("alone"), wx, 0.26, z, sd * 0.6, 0)) ITEM.vehicle(wx, z, PAL[(si + (sd > 0 ? 2 : 4)) % 6], 0.1); }
        else if (s.kind === "hair") { for (let q = 0; q < 2; q++) { const z = Z(zA + 0.4 + q * (zB - zA - 0.8)), mx = sd < 0 ? x0 + 0.2 : x1 - 0.2;
            p.box(0.06, 1.6, 1.2, M("#dff6ff", { metalness: 0.9, roughness: 0.05, envMap: envMap(), envMapIntensity: 1 }), mx, 1.9, z, 0, false).box(0.08, 1.7, 0.06, glow, mx, 1.9, z - 0.62, 0, false).box(0.08, 1.7, 0.06, glow, mx, 1.9, z + 0.62, 0, false);
            p.cyl(0.12, 1.0, STEEL(), wx, 0.5, z, 8).cyl(0.35, 0.06, white, wx, 1.0, z, 18);   // a stand by the mirror with a head showing a hairstyle
            if (!put(next("bust"), wx, 1.03, z, face(sd), 0.9)) ITEM.hair(wx, z, PAL[(q + si) % 6], 0.55); } }
        else if (s.kind === "hat") { for (let q = 0; q < 3; q++) { const z = Z(zA + q * (zB - zA) / 2), h = 0.8 + q * 0.25; p.cyl(0.4, h, white, wx, h / 2, z, 18).ring(0.4, glow, wx, h, z, Math.PI / 2, 0, 1.2);
            if (!put(next("bust"), wx, h, z, face(sd), 0.85)) ITEM.hat(wx, z, PAL[(q + si + (sd > 0 ? 3 : 0)) % 6], h, q + (sd > 0 ? 1 : 0)); } }
        else { for (let q = 0; q < 2; q++) { const z = Z(zA + 0.3 + q * (zB - zA - 0.6)); p.cyl(1.0, 0.03, LIT(PAL[(si + q + (sd > 0 ? 1 : 3)) % 6], 0.2), wx, 0.11, z, 28, false);
            if (!put(next("alone"), wx, 0.13, z, face(sd), 1.35)) ITEM.furniture(wx, z, PAL[(si + q + (sd > 0 ? 4 : 1)) % 6], 0.05); } } });
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
    // a wide podium of warm glass, and on it the "sail": a tower with a flat back and a big curved glass front that
    // faces the square, gold light lines running up the curve, white balcony rings with little trees every few floors
    const gold = "#ffcf6a", hotelGlass = winMat("hoteltop", "#9fdcff", "#fff4d8", 8);
    tower(p, w, d, 14, winMat("hotelbase", "#ffe2b0", "#fff0cf", 7), cx, 0, cz, gold);
    const sx = cx + 8, rx = 16, rz = 21, TH = H - 14, by = 14.5;
    { const g = new THREE.CylinderGeometry(1, 1, TH, 40, 1, true, Math.PI, Math.PI); g.translate(0, by + TH / 2, 0); g.scale(rx, 1, rz);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (Math.PI * (rx + rz) / 2) / 8, uv.getY(i) * TH / 8); p.acc.add(g, hotelGlass, m4(sx, 0, cz), true); }
    p.acc.add(towerGeo(13, rz * 2, TH), hotelGlass, m4(sx + 6.5, by, cz), true);
    { const cap = new THREE.CylinderGeometry(1, 1, 0.6, 40, 1, false, Math.PI, Math.PI); cap.scale(rx + 0.3, 1, rz + 0.3); p.acc.add(cap, ROOF(), m4(sx, by + TH + 0.3, cz), true); }
    p.box(13.4, 0.6, rz * 2 + 0.6, ROOF(), sx + 6.5, by + TH + 0.3, cz);
    for (let k = 0; k <= 8; k++) { const an = Math.PI + (k / 8) * Math.PI, gx = sx + Math.sin(an) * (rx + 0.15), gz = cz + Math.cos(an) * (rz + 0.15);
      if (k > 0 && k < 8) p.box(0.32, TH, 0.32, neon(gold, 0.55, 2), gx, by + TH / 2, gz, 0, false); }
    { const fp = new P(a.facc); for (let y = by + 10; y < by + TH - 4; y += 10) { const ring = new THREE.CylinderGeometry(1, 1, 0.35, 40, 1, false, Math.PI, Math.PI); ring.scale(rx + 1.4, 1, rz + 1.4); fp.acc.add(ring, WHITE(), m4(sx, y, cz), true);
        const line = new THREE.CylinderGeometry(1, 1, 0.1, 40, 1, true, Math.PI, Math.PI); line.scale(rx + 1.45, 1, rz + 1.45); fp.acc.add(line, neon(gold, 0.6, 2.2), m4(sx, y + 0.2, cz), false);
        for (let k = 1; k < 8; k += 2) { const an = Math.PI + (k / 8) * Math.PI; fp.sphere(0.6, M("#3fcf7a", { roughness: 0.85, metalness: 0 }), sx + Math.sin(an) * (rx + 0.8), y + 0.75, cz + Math.cos(an) * (rz + 0.8), 0.85); } }
      // the crown: a gold fin that rises from the roof with a light on top, and the helipad behind it
      fp.box(1.2, 16, 6, M("#e6c26a", { metalness: 0.8, roughness: 0.25, envMap: envMap(), envMapIntensity: 0.9 }), sx - 4, by + TH + 8, cz).box(1.3, 16, 0.25, neon(gold, 0.8, 2.6), sx - 4, by + TH + 8, cz + 3.05, 0, false).sphere(0.5, beacon, sx - 4, by + TH + 16.4, cz);
      roofTop(fp, "pad", sx + 6.5, by + TH + 0.6, cz, 12, 18, gold, R); }

    // the entrance: a gold canopy, a red carpet, automatic doors
    const [ex, ez] = W(FL.HOTEL.door[0], (FL.HOTEL.door[1] + FL.HOTEL.door[3]) / 2);
    const gm = M("#e6c26a", { metalness: 0.8, roughness: 0.25, envMap: envMap(), envMapIntensity: 0.9 }), gl = neon(gold, 0.9, 2.6);
    p.box(7, 0.35, 12, WHITE(), ex - 2, 5.4, ez).box(6.4, 0.06, 11.4, GLASS(), ex - 2, 5.62, ez, 0, false)
     .box(7.2, 0.12, 0.18, gl, ex - 2, 5.25, ez - 6.05, 0, false).box(7.2, 0.12, 0.18, gl, ex - 2, 5.25, ez + 6.05, 0, false).box(0.18, 0.12, 12.2, gl, ex - 5.55, 5.25, ez, 0, false);
    [-4, 0, 4].forEach((k) => p.box(0.9, 0.04, 0.9, neon("#fff4d8", 1, 2.6), ex - 2, 5.2, ez + k, 0, false));
    p.box(8, 0.04, 10, M("#d8323c", { roughness: 0.9, metalness: 0 }), ex - 2, 0.05, ez, 0, false).box(8, 0.05, 0.14, gl, ex - 2, 0.06, ez - 5.05, 0, false).box(8, 0.05, 0.14, gl, ex - 2, 0.06, ez + 5.05, 0, false);
    [-5, 5].forEach((s) => p.cyl(0.22, 5.2, gm, ex - 5, 2.6, ez + s, 12).ring(0.32, gl, ex - 5, 4.6, ez + s, Math.PI / 2, 0, 3));
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
    p.acc.add(towerGeo(w, d, Y), winMat("tower", "#8fd0ff", "#d6f0ff", 12), m4(cx, 0, cz), true);
    for (let f = 8; f < Y; f += 8) p.box(w + 0.4, 0.25, d + 0.4, neon("#59e0ff", 0.5, 1.8), cx, f, cz, 0, false);
    // white fins on the four corners, and a light line that winds up round the tower to the roof
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => p.box(1.1, Y + 2, 1.1, WHITE(), cx + sx * (w / 2 + 0.2), (Y + 2) / 2, cz + sz * (d / 2 + 0.2)));
    { const per = 2 * (w + d), steps = 150, spiral = neon("#5fd8ff", 1.5, 2.8);
      for (let k = 0; k < steps; k++) { const u = (k / steps) * per * 2.2, y = 4 + (k / steps) * (Y - 6), q = u % per; let px, pz, ry;
        if (q < w) { px = x0 + q; pz = z1 + 0.25; ry = 0; } else if (q < w + d) { px = x1 + 0.25; pz = z1 - (q - w); ry = Math.PI / 2; } else if (q < 2 * w + d) { px = x1 - (q - w - d); pz = z0 - 0.25; ry = 0; } else { px = x0 - 0.25; pz = z0 + (q - 2 * w - d); ry = Math.PI / 2; }
        p.box(per * 2.2 / steps + 0.05, 0.6, 0.2, spiral, px, y, pz, ry, false); } }
    // a halo of light floating high over the roof lounge
    { const halo = new THREE.Mesh(new THREE.TorusGeometry(15, 0.35, 10, 64), neon("#7fe3ff", 1, 2.8)); halo.rotation.x = Math.PI / 2; halo.position.set(cx, Y + 14, cz); a.far.add(halo);
      anim.push({ a, fn: (t) => { halo.position.y = Y + 14 + Math.sin(t * 0.6) * 0.8; halo.rotation.z = t * 0.15; } }); }
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

  /* ---------- skyscrapers all around: six kinds of tower, each with a glass lobby at the street, light bands every few
     floors, glowing corner lines, a crown and a blinking beacon (the far ones keep only their body) ---------- */
  const BEACON_MAT = beacon; anim.push({ fn: (t) => { const on = (t % 1.6) < 0.18; BEACON_MAT.emissiveIntensity = on ? 3.4 : 0.35; } });
  // the lobby behind the glass: a bright room (warm light, a counter, plants, a couple of people), painted once
  const lobbyMat = (() => { const t = canvasTex("fw-lobby", 512, 128, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#fff7e6"); g.addColorStop(0.7, "#ffe9c8"); g.addColorStop(1, "#d9c3a0"); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = "rgba(255,255,255,.9)"; for (let i = 0; i < 6; i++) x.fillRect(20 + i * 84, 6, 50, 6);                         // ceiling lights
      x.fillStyle = "#e2e8f0"; x.fillRect(180, 78, 150, 34); x.fillStyle = "#4fd2ff"; x.fillRect(180, 78, 150, 4);                 // a counter
      x.fillStyle = "#3fae6a"; [[40, 96], [470, 96], [120, 100]].forEach(([px, py]) => { x.beginPath(); x.arc(px, py, 16, 0, TAU); x.fill(); });
      x.fillStyle = "#6b7fa8"; [[260, 70], [380, 82], [90, 84]].forEach(([px, py]) => { x.beginPath(); x.arc(px, py - 16, 6, 0, TAU); x.fill(); x.fillRect(px - 6, py - 10, 12, 22); });
      x.fillStyle = "rgba(255,255,255,.85)"; for (let i = 0; i <= 8; i++) x.fillRect(i * 64 - 2, 0, 4, h);                        // the glass frames
    }); const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.1 }); m.userData.day = 0.35; m.userData.night = 0.95; NIGHT.push(m); return m; })();
  function lobbyGeo(w, d) { const g = new THREE.BoxGeometry(w, 6, d); g.translate(0, 3, 0); const uv = g.attributes.uv, n = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) { const side = Math.abs(n.getX(i)) > 0.5 ? d : w; uv.setXY(i, uv.getX(i) * side / 24, uv.getY(i)); } const idx = [...g.index.array]; g.setIndex([...idx.slice(0, 12), ...idx.slice(24)]); return g; }
  function lobby(p, w, d, cx, cz, edge, front) {     // a glass ground floor 6 high, a white canopy over the front, planters
    p.acc.add(lobbyGeo(w - 0.6, d - 0.6), lobbyMat, m4(cx, 0, cz), true);
    p.box(w + 0.6, 0.4, d + 0.6, WHITE(), cx, 6.2, cz).box(w + 0.7, 0.12, d + 0.7, neon(edge, 0.7, 2.4), cx, 6.48, cz, 0, false);
    const f = front, fx = cx, fz = cz + f * (d / 2 + 1.6);
    p.box(Math.min(16, w * 0.7), 0.25, 3.2, WHITE(), fx, 4.6, fz).box(Math.min(16, w * 0.7), 0.08, 0.12, neon(edge, 0.8, 2.6), fx, 4.5, fz + f * 1.6, 0, false);
    [-1, 1].forEach((sg) => { const px = fx + sg * (Math.min(16, w * 0.7) / 2 + 2); p.box(2.2, 0.9, 2.2, WHITE(), px, 0.45, fz).sphere(1.05, M("#3fcf7a", { roughness: 0.85, metalness: 0 }), px, 1.55, fz, 0.85).sphere(0.55, M("#ff9ad9", { roughness: 0.8, metalness: 0 }), px + 0.5, 1.95, fz + 0.4, 0.9); colliders.push({ c: [px, fz], r: 1.3 }); });
  }
  function bands(fp, w, d, h0, h1, cx, cz, edge, round) { for (let y = h0 + 10; y < h1 - 3; y += 10) { if (round) fp.cyl(round + 0.22, 0.28, neon(edge, 0.55, 2.1), cx, y, cz, 32, false); else fp.box(w + 0.35, 0.28, d + 0.35, neon(edge, 0.55, 2.1), cx, y, cz, 0, false); } }
  function crown(fp, kind, cx, y, cz, w, d, edge) {
    if (kind === "spire") { fp.cyl(0.9, 9, STEEL(), cx, y + 4.5, cz, 12, true, 0.12).sphere(0.45, beacon, cx, y + 9.3, cz); }
    else if (kind === "halo") { fp.ring(Math.min(w, d) * 0.42, neon(edge, 1, 2.8), cx, y + 2.5, cz, Math.PI / 2, 0, 0.5).cyl(0.25, 5, STEEL(), cx, y + 2.5, cz, 8).sphere(0.4, beacon, cx, y + 5.3, cz); }
    else if (kind === "pad") { roofTop(fp, "pad", cx, y, cz, w, d, edge, R); fp.cyl(0.15, 4, STEEL(), cx + w * 0.38, y + 2, cz + d * 0.38, 6).sphere(0.35, beacon, cx + w * 0.38, y + 4.2, cz + d * 0.38); }
    else if (kind === "garden") { roofTop(fp, "garden", cx, y, cz, w, d, edge, R); fp.cyl(0.15, 4, STEEL(), cx - w * 0.38, y + 2, cz - d * 0.38, 6).sphere(0.35, beacon, cx - w * 0.38, y + 4.2, cz - d * 0.38); }
  }
  // a tapered glass tower (4 sides, turned 45 degrees) with the window texture wrapped round it
  function frustumGeo(r0, r1, h, seg = 4, y0 = 0) { const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1, true); g.rotateY(Math.PI / seg); g.translate(0, y0 + h / 2, 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (seg * 2 * Math.sin(Math.PI / seg) * (r0 + r1) / 2) / 8, uv.getY(i) * h / 8); return g; }
  const STYLE = [0, 1, 2, 3, 4, 5, 1, 2];
  FL.BLOCKS.forEach((b, i) => {
    const a = area((b[0] + b[2]) / 2, (b[1] + b[3]) / 2), p = new P(a.acc), fp = new P(a.facc);
    const [x0, z0] = W(b[0], b[1]), [x1, z1] = W(b[2], b[3]), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    const H = 52 + R() * 38, PAL = [["#5fc8ff", "#3fc6ff"], ["#8fb6ff", "#7f9cff"], ["#6fe0ff", "#4fe0ff"], ["#a08cff", "#a06bff"], ["#62d0ff", "#3fb0ff"], ["#7fd8f0", "#4fd2ff"]];
    const style = STYLE[i % STYLE.length], [glass, edge] = PAL[style], mat = winMat("blk" + style, glass, "#e9fbff", 50 + style), front = b[1] < 0 ? 1 : -1;
    lobby(p, w, d, cx, cz, edge, front);
    if (style === 0) {          // crystal: a tapered glass tower with a pointed top
      const r0 = Math.min(w, d) * 0.66, r1 = r0 * 0.42; p.acc.add(frustumGeo(r0, r1, H - 6, 4, 6.5), mat, m4(cx, 0, cz), true);
      p.acc.add(new THREE.ConeGeometry(r1, 9, 4, 1).rotateY(Math.PI / 4).translate(0, H + 5, 0), GLASS(), m4(cx, 0, cz), false);
      for (let y = 16; y < H - 6; y += 10) { const k = (y - 6.5) / (H - 6), r = r0 + (r1 - r0) * k; fp.cyl(r * Math.SQRT1_2 * 1.42 + 0.1, 0.25, neon(edge, 0.55, 2.1), cx, y, cz, 4, false); }
      crown(fp, "spire", cx, H + 9, cz, r1, r1, edge);
    } else if (style === 1) {   // twist: every few floors turn a little
      const n = Math.floor((H - 6) / 4), tw = w * 0.74, td = d * 0.74;
      for (let k = 0; k < n; k++) { p.acc.add(towerGeo(tw, td, 4), mat, m4(cx, 6.5 + k * 4, cz, k * 0.045), true); if (k % 3 === 2) fp.box(tw + 0.4, 0.22, td + 0.4, neon(edge, 0.55, 2.1), cx, 6.5 + (k + 1) * 4, cz, k * 0.045, false); }
      p.box(tw + 0.4, 0.5, td + 0.4, ROOF(), cx, 6.5 + n * 4 + 0.25, cz, n * 0.045); crown(fp, "halo", cx, 6.5 + n * 4 + 0.5, cz, tw, td, edge);
    } else if (style === 2) {   // cloud: a round tower with garden terraces all the way up
      const r = Math.min(w, d) * 0.4; roundTower(p, r, H - 6, mat, cx, 6.5, cz, edge);
      for (let y = 18; y < H - 4; y += 12) { fp.cyl(r + 1.6, 0.5, WHITE(), cx, y, cz, 28).cyl(r + 1.7, 0.12, neon(edge, 0.6, 2.2), cx, y + 0.3, cz, 28, false);
        for (let k = 0; k < 6; k++) { const an = k / 6 * TAU + y; fp.sphere(0.9, M("#3fcf7a", { roughness: 0.85, metalness: 0 }), cx + Math.cos(an) * (r + 0.9), y + 1, cz + Math.sin(an) * (r + 0.9), 0.8); } }
      crown(fp, "garden", cx, H + 1, cz, r * 1.4, r * 1.4, edge);
    } else if (style === 3) {   // twins joined by a glass sky bridge
      const tw = w * 0.38; [-1, 1].forEach((sg) => tower(p, tw, d * 0.8, H * (sg > 0 ? 1 : 0.84) - 6, mat, cx + sg * w * 0.29, 6.5, cz, edge));
      const by = H * 0.58; p.box(w * 0.22 + 1, 3, 5, GLASS(), cx, by, cz, 0, false).box(w * 0.22 + 1, 0.4, 5.4, WHITE(), cx, by - 1.6, cz).box(w * 0.22 + 1, 0.15, 5.6, neon(edge, 0.8, 2.6), cx, by + 1.6, cz, 0, false);
      [-1, 1].forEach((sg) => bands(fp, tw, d * 0.8, 6, H * (sg > 0 ? 1 : 0.84), cx + sg * w * 0.29, cz, edge));
      crown(fp, "pad", cx + w * 0.29, H + 1, cz, tw, d * 0.8, edge); crown(fp, "spire", cx - w * 0.29, H * 0.84 + 1, cz, tw, tw, edge);
    } else if (style === 4) {   // rings: a slim round core wrapped by glowing rings, a wide glass disc on top
      const r = Math.min(w, d) * 0.3; roundTower(p, r, H - 6, mat, cx, 6.5, cz, edge);
      for (let k = 0; k < 5; k++) { const y = 14 + k * (H - 22) / 4; fp.ring(r + 2.2, neon(k % 2 ? "#a06bff" : edge, 0.8, 2.6), cx, y, cz, Math.PI / 2, 0, 1.6); }
      p.cyl(r * 1.9, 2.2, GLASS(), cx, H + 1.6, cz, 32, false).cyl(r * 1.9 + 0.1, 0.25, neon(edge, 0.8, 2.6), cx, H + 2.7, cz, 32, false); crown(fp, "spire", cx, H + 2.8, cz, r, r, edge);
    } else {                    // stepped: three tiers, a garden on every step
      tower(p, w, d, H * 0.42, mat, cx, 6.5, cz, edge); tower(p, w * 0.76, d * 0.76, H * 0.3, mat, cx, H * 0.42 + 7, cz, edge); tower(p, w * 0.5, d * 0.5, H * 0.22, mat, cx, H * 0.72 + 7.5, cz, edge);
      roofTop(fp, "garden", cx, H * 0.42 + 7, cz + d * 0.43, w * 0.9, d * 0.08, edge, R); crown(fp, "spire", cx, H * 0.94 + 8, cz, w * 0.5, d * 0.5, edge);
    }
    if (style !== 0 && style !== 1 && style !== 2 && style !== 4) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => fp.box(0.3, H * 0.42, 0.3, neon(edge, 0.6, 2.2), cx + sx * (w / 2 + 0.05), 6.5 + H * 0.21, cz + sz * (d / 2 + 0.05), 0, false));
    if (style === 5 || style === 3) bands(fp, w, d, 6, H * 0.42, cx, cz, edge);
    if (i % 2 === 0) billboard(a, (b[0] + b[2]) / 2, front > 0 ? b[3] + 0.6 : b[1] - 0.6, front > 0 ? 0 : Math.PI, Math.min(14, w - 4), 6, Math.min(26, H * 0.3), i);
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
  /* ---------- the horizon: a painted ring of blue towers just inside the view distance, so the city never ends in
     empty haze (it follows the camera like the sky; its windows light up at night) ---------- */
  const HORIZON = (() => {
    const g = new THREE.Group(), geo = new THREE.CylinderGeometry(1, 1, 1, 64, 1, true); geo.translate(0, 0.5, 0);
    const base = skylineTex(false), lit = skylineTex(true); base.repeat.set(3, 1); lit.repeat.set(3, 1);
    const mBase = new THREE.MeshBasicMaterial({ map: base, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false, color: "#ffffff" });
    const mLit = new THREE.MeshBasicMaterial({ map: lit, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const a = new THREE.Mesh(geo, mBase), b = new THREE.Mesh(geo, mLit); a.renderOrder = b.renderOrder = -2; a.frustumCulled = b.frustumCulled = false; g.add(a, b); root.add(g);
    return { g, mBase, mLit };
  })();


  /* ---------- the Time Port: where the time machine lands ---------- */
  {
    const a = area(...FL.LANDING.pad), p = new P(a.acc), [lx, lz] = W(...FL.LANDING.pad);
    p.cyl(FL.LANDING.r, 0.4, M("#2a3042", { metalness: 0.5, roughness: 0.3 }), lx, 0.2, lz, 48).ring(FL.LANDING.r - 0.4, neon("#ffd65a", 1, 2.8), lx, 0.45, lz, Math.PI / 2, 0, 0.3).ring(FL.LANDING.r - 2.6, neon("#59e0ff", 1, 2.8), lx, 0.45, lz, Math.PI / 2, 0, 0.3);
    for (let i = 0; i < 8; i++) { const an = i / 8 * TAU; p.box(0.5, 0.06, 2.4, neon("#ffd65a", 0.8, 2.4), lx + Math.cos(an) * 5, 0.46, lz + Math.sin(an) * 5, -an, false); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6, 0.18, 10, 60), neon("#59e0ff", 1.2, 3)); ring.rotation.x = Math.PI / 2; ring.position.set(lx, 6, lz); a.far.add(ring);
    anim.push({ a, fn: (t) => { ring.position.y = 5 + Math.sin(t * 1.5) * 0.8; ring.rotation.z = t * 0.6; } });
    a.acc.build(a.g);
  }

  /* ---------- the Park of Light (south): bright grass, white paths with light lines, three kinds of tree, flower beds,
     a little turquoise lake with hovering stepping stones ---------- */
  {
    const a = area(0, 84), p = new P(a.acc);
    const grassT = canvasTex("fw-grass", 256, 256, (x, w, h) => { x.fillStyle = "#58d283"; x.fillRect(0, 0, w, h); const Rg = rng(9); for (let i = 0; i < 2200; i++) { x.fillStyle = `hsl(${118 + Rg() * 30},${55 + Rg() * 20}%,${48 + Rg() * 16}%)`; x.fillRect(Rg() * w, Rg() * h, 2, 3 + Rg() * 3); }
      for (let i = 0; i < 40; i++) { x.fillStyle = Rg() < 0.5 ? "rgba(255,255,255,.8)" : "rgba(255,220,90,.85)"; x.beginPath(); x.arc(Rg() * w, Rg() * h, 1.6, 0, TAU); x.fill(); } });
    const grass = M("#ffffff", { map: grassT, roughness: 0.95, metalness: 0 }), path = M("#f6f9ff", { roughness: 0.45, metalness: 0.05 }), pathLine = neon("#4fd2ff", 0.7, 2.2);
    const LAKE = { c: [-62, 86], rx: 9, rz: 6 };   // clear of every quest spot and path
    const inLake = (lx, lz, pad = 0) => ((lx - LAKE.c[0]) / (LAKE.rx + pad)) ** 2 + ((lz - LAKE.c[1]) / (LAKE.rz + pad)) ** 2 < 1;
    [[-113, 44, -27, 95], [FL.ARCADE.rect[2] + 1.5, 44, 113, 95]].forEach(([ax, az, bx, bz]) => { const [x0, z0] = W(ax, az), [x1, z1] = W(bx, bz); p.geo(plateGeo(x0, z0, x1, z1, 0.03, 10), grass);
      for (let k = 0; k < 3; k++) { const [px] = W(ax + (bx - ax) * (k + 0.5) / 3, 0); p.box(2.6, 0.06, z1 - z0, path, px, 0.05, (z0 + z1) / 2, 0, false).box(0.1, 0.07, z1 - z0, pathLine, px - 1.35, 0.06, (z0 + z1) / 2, 0, false).box(0.1, 0.07, z1 - z0, pathLine, px + 1.35, 0.06, (z0 + z1) / 2, 0, false); }
      const [, pz] = W(0, 72); p.box(x1 - x0, 0.06, 2.6, path, (x0 + x1) / 2, 0.05, pz, 0, false).box(x1 - x0, 0.07, 0.1, pathLine, (x0 + x1) / 2, 0.06, pz - 1.35, 0, false).box(x1 - x0, 0.07, 0.1, pathLine, (x0 + x1) / 2, 0.06, pz + 1.35, 0, false);
      // white low edges round the lawns
      p.box(x1 - x0, 0.3, 0.3, WHITE(), (x0 + x1) / 2, 0.15, z0).box(0.3, 0.3, z1 - z0, WHITE(), ax < 0 ? x1 : x0, 0.15, (z0 + z1) / 2); });
    // the lake: a white rim, turquoise water that shimmers, hovering stepping stones across it
    { const [lx, lz] = W(...LAKE.c), rimG = new THREE.CylinderGeometry(1, 1, 0.4, 48); rimG.scale(LAKE.rx + 0.8, 1, LAKE.rz + 0.8); p.acc.add(rimG, WHITE(), m4(lx, 0.12, lz), false);
      const waterT = canvasTex("fw-lake", 256, 256, (x, w, h) => { const g = x.createRadialGradient(128, 128, 20, 128, 128, 128); g.addColorStop(0, "#5ff0f0"); g.addColorStop(1, "#1fb3e6"); x.fillStyle = g; x.fillRect(0, 0, w, h); const R2 = rng(3); for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(255,255,255,${0.2 + R2() * 0.4})`; x.fillRect(R2() * w, R2() * h, 6 + R2() * 14, 1.5); } });
      const wg = new THREE.CircleGeometry(1, 48); wg.rotateX(-Math.PI / 2); wg.scale(LAKE.rx, 1, LAKE.rz); const water = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ map: waterT, roughness: 0.05, metalness: 0.3, emissive: new THREE.Color("#0b8fbf"), emissiveIntensity: 0.25, envMap: envMap(), envMapIntensity: 0.7 }));
      water.position.set(lx, 0.36, lz); a.g.add(water); anim.push({ a, fn: (t) => { waterT.offset.set(Math.sin(t * 0.2) * 0.02, t * 0.01); } });
      const stones = []; for (let k = 0; k < 6; k++) { const sx2 = lx - LAKE.rx + 3 + k * ((LAKE.rx * 2 - 6) / 5), sz2 = lz + Math.sin(k * 1.3) * 2.5, st = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.9, 0.3, 20), WHITE()); st.position.set(sx2, 0.7, sz2); a.g.add(st);
        const gl = new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#7fe9ff", transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })); gl.position.set(sx2, 0.54, sz2); a.g.add(gl); stones.push(st); }
      anim.push({ a, fn: (t) => stones.forEach((st, k) => { st.position.y = 0.7 + Math.sin(t * 1.4 + k) * 0.12; }) });
      colliders.push({ box: [lx - LAKE.rx - 0.8, lz - LAKE.rz * 0.72, lx + LAKE.rx + 0.8, lz + LAKE.rz * 0.72] }); }
    // three kinds of tree, all instanced: round green crowns with light-blue tips, pink blossom trees, tall spiral trees
    const spots = []; for (let i = 0; i < 90; i++) { const lx = -110 + R() * 220, lz = 46 + R() * 46; if (Math.abs(lx) < 26 && lz > 62) continue; if (lx > FL.ARCADE.rect[0] - 3 && lx < FL.ARCADE.rect[2] + 3 && lz > FL.ARCADE.rect[1] - 3 && lz < FL.ARCADE.rect[3] + 3) continue; if (FL.BLOCKS.some((b) => lx > b[0] - 3 && lx < b[2] + 3 && lz > b[1] - 3 && lz < b[3] + 3)) continue; if (Math.abs(lx) < 30 && lz < 56) continue;
      if (inLake(lx, lz, 3)) continue; if ([-73.3, -36.7, 36.7, 73.3].some((px) => Math.abs(lx - px) < 2.5) || Math.abs(lz - 72) < 2.5) continue; spots.push([lx, lz]); }
    const trunkG = new THREE.CylinderGeometry(0.16, 0.3, 2.6, 7); trunkG.translate(0, 1.3, 0);
    const ballG = mergeGeometries([new THREE.IcosahedronGeometry(1.5, 2).translate(0, 3.5, 0), new THREE.IcosahedronGeometry(1.05, 2).translate(0.9, 3.0, 0.4), new THREE.IcosahedronGeometry(1.0, 2).translate(-0.8, 3.1, -0.5)].map((g) => g.toNonIndexed()), false);
    const tipG = new THREE.IcosahedronGeometry(0.55, 1); tipG.translate(0.2, 4.85, 0.1);
    const blossomG = mergeGeometries([new THREE.IcosahedronGeometry(1.6, 2).translate(0, 3.3, 0), new THREE.IcosahedronGeometry(1.1, 2).translate(1.1, 2.9, 0), new THREE.IcosahedronGeometry(1.1, 2).translate(-1, 3.0, 0.4)].map((g) => g.toNonIndexed()), false);
    const coneG = mergeGeometries([new THREE.ConeGeometry(1.6, 2.4, 10).translate(0, 2.6, 0), new THREE.ConeGeometry(1.25, 2.1, 10).translate(0, 3.9, 0), new THREE.ConeGeometry(0.9, 1.8, 10).translate(0, 5.1, 0)].map((g) => g.toNonIndexed()), false);
    const ringG = new THREE.TorusGeometry(0.6, 0.06, 6, 24); ringG.rotateX(Math.PI / 2); ringG.translate(0, 1.4, 0);
    const n = spots.length, trunks = new THREE.InstancedMesh(trunkG, M("#e8dccb", { roughness: 0.8, metalness: 0 }), n);
    const balls = new THREE.InstancedMesh(ballG, M("#3ccf7a", { roughness: 0.75, metalness: 0 }), n), tips = new THREE.InstancedMesh(tipG, neon("#7fe9ff", 0.6, 2), n);
    const blos = new THREE.InstancedMesh(blossomG, M("#ff9ad9", { roughness: 0.7, metalness: 0, emissive: new THREE.Color("#ff6fc8"), emissiveIntensity: 0.12 }), n);
    const cones = new THREE.InstancedMesh(coneG, M("#2fbf6e", { roughness: 0.75, metalness: 0 }), n), rings = new THREE.InstancedMesh(ringG, neon("#4fd2ff", 0.8, 2.6), n);
    const cnt = { b: 0, p: 0, c: 0 }, mx = new THREE.Matrix4();
    spots.forEach(([lx, lz], i) => { const [x, z] = W(lx, lz), s = 0.85 + R() * 0.5, kind = R(); mx.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * TAU, 0)), new THREE.Vector3(s, s, s)); trunks.setMatrixAt(i, mx);
      if (kind < 0.45) { balls.setMatrixAt(cnt.b, mx); tips.setMatrixAt(cnt.b++, mx); } else if (kind < 0.72) blos.setMatrixAt(cnt.p++, mx); else { cones.setMatrixAt(cnt.c, mx); rings.setMatrixAt(cnt.c++, mx); }
      colliders.push({ c: [x, z], r: 0.6 * s }); });
    balls.count = tips.count = cnt.b; blos.count = cnt.p; cones.count = rings.count = cnt.c;
    [trunks, balls, blos, cones].forEach((m) => { m.castShadow = true; a.g.add(m); }); a.g.add(tips, rings);
    // round flower beds along the main path: a white ring of stone and a carpet of little flowers
    const flowerG = new THREE.IcosahedronGeometry(0.16, 0); const fcols = ["#ff7ab8", "#ffd23a", "#a07bff", "#ffffff", "#ff9a5a"], fl = fcols.map((c) => new THREE.InstancedMesh(flowerG, M(c, { roughness: 0.6, metalness: 0, emissive: new THREE.Color(c), emissiveIntensity: 0.15 }), 400)), fc = fcols.map(() => 0);
    for (const lx of [-96, -56, -16, 16, 56, 96]) { const lz = lx < -50 ? 86 : 64, [bx, bz] = W(lx, lz); if (inLake(lx, lz, 4) || (Math.abs(lx) < 26 && lz > 62)) continue; p.cyl(3.2, 0.35, WHITE(), bx, 0.17, bz, 32).cyl(3.0, 0.37, M("#6a4a32", { roughness: 1, metalness: 0 }), bx, 0.19, bz, 32, false);
      for (let k = 0; k < 110; k++) { const an = R() * TAU, rr = Math.sqrt(R()) * 2.8, c = Math.floor(R() * fcols.length); if (fc[c] >= 400) continue; mx.compose(new THREE.Vector3(bx + Math.cos(an) * rr, 0.45 + R() * 0.12, bz + Math.sin(an) * rr), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); fl[c].setMatrixAt(fc[c]++, mx); }
      colliders.push({ c: [bx, bz], r: 3.2 }); }
    fl.forEach((m, k) => { m.count = fc[k]; a.g.add(m); });
    a.acc.build(a.g);
  }

  /* ---------- the mini-game stands and the lift pads ---------- */
  const STATION_COL = { drone: "#59e0ff", robot: "#ffd65a", rooftops: "#ff7af0" };
  const STATION_TITLE = { drone: "DRONE RACE", robot: "ROBO FIX", rooftops: "ROOF HOP" };
  /* ---------- the GAME ZONE: the arcade south of the square. Outside: white walls with stripes of light, a glass
     front with a sliding door, the big sign with running bulbs, a giant joystick on the roof. Inside: a dark carpet
     with glowing shapes, pixel art on the walls, the three game machines (normal size) along the back wall, an air
     hockey table, a claw machine and the prize counter. ---------- */
  {
    const A = FL.ARCADE, a = area((A.rect[0] + A.rect[2]) / 2, (A.rect[1] + A.rect[3]) / 2), p = new P(a.acc);
    const [x0, z0] = W(A.rect[0], A.rect[1]), [x1, z1] = W(A.rect[2], A.rect[3]), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, H = A.H, T = 0.5;
    const [dx0] = W(A.door[0], 0), [dx1] = W(A.door[2], 0), dcx = (dx0 + dx1) / 2, dw = dx1 - dx0;
    const outW = M("#f6f2ff", { roughness: 0.4, metalness: 0.1, emissive: new THREE.Color("#efe6ff"), emissiveIntensity: 0.15 }), inW = M("#2a1f5c", { roughness: 0.6, metalness: 0.1, emissive: new THREE.Color("#2a1f5c"), emissiveIntensity: 0.35 });
    const NC = ["#ff4fd8", "#59e0ff", "#ffd65a", "#7dff9b", "#b18cff"];
    // the carpet inside: dark blue with little glowing stars, squares and zig-zags
    const carpet = canvasTex("fw-arcade-carpet", 256, 256, (x, cw, ch) => { const Rr = rng(5); x.fillStyle = "#141a3a"; x.fillRect(0, 0, cw, ch);
      for (let i = 0; i < 26; i++) { const px = Rr() * cw, py = Rr() * ch, c = NC[i % 5]; x.strokeStyle = c; x.fillStyle = c; x.lineWidth = 3;
        if (i % 3 === 0) { x.beginPath(); for (let k = 0; k < 10; k++) { const an = k / 10 * TAU, r = k % 2 ? 4 : 10; x.lineTo(px + Math.cos(an) * r, py + Math.sin(an) * r); } x.closePath(); x.fill(); }
        else if (i % 3 === 1) x.strokeRect(px - 6, py - 6, 12, 12); else { x.beginPath(); x.moveTo(px - 10, py); x.lineTo(px - 4, py - 6); x.lineTo(px + 2, py); x.lineTo(px + 8, py - 6); x.stroke(); } } });
    p.geo(plateGeo(x0 + T, z0 + T, x1 - T, z1 - T, 0.06, 4), M("#ffffff", { map: carpet, roughness: 0.9, metalness: 0, emissive: new THREE.Color("#ffffff"), emissiveMap: carpet, emissiveIntensity: 0.35 }));
    // walls: white outside, deep purple inside; the front is glass with the door in the middle
    const wallBox = (lx0, lz0, lx1, lz1, mOut, mIn, inward) => { const ww = Math.abs(lx1 - lx0) || T, dd = Math.abs(lz1 - lz0) || T, mx = (lx0 + lx1) / 2, mz = (lz0 + lz1) / 2;
      p.box(ww, H, dd, mOut, mx, H / 2, mz); const [ix, iz] = inward; p.box(ww === T ? 0.04 : ww - 2 * T, H - 0.4, dd === T ? 0.04 : dd - 2 * T, mIn, mx + ix * (T / 2 + 0.03), (H - 0.4) / 2, mz + iz * (T / 2 + 0.03), 0, false);
      colliders.push({ box: [Math.min(lx0, lx1) - T / 2, Math.min(lz0, lz1) - T / 2, Math.max(lx0, lx1) + T / 2, Math.max(lz0, lz1) + T / 2] }); };
    wallBox(x0, z0, x0, z1, outW, inW, [1, 0]); wallBox(x1, z0, x1, z1, outW, inW, [-1, 0]); wallBox(x0, z1, x1, z1, outW, inW, [0, -1]);
    // stripes of light running round the outside, in five colours
    NC.forEach((c, k) => { const y = 1.4 + k * 0.5, m = neon(c, 0.9, 2.6); p.box(0.08, 0.14, d, m, x0 - T / 2 - 0.04, y, cz, 0, false).box(0.08, 0.14, d, m, x1 + T / 2 + 0.04, y, cz, 0, false).box(w, 0.14, 0.08, m, cx, y, z1 + T / 2 + 0.04, 0, false); });
    // the glass front, posts in colours, the band over the door
    const gl = GLASS(), postM = (k) => M(NC[k % 5], { metalness: 0.3, roughness: 0.3, emissive: new THREE.Color(NC[k % 5]), emissiveIntensity: 0.3 });
    p.box(dx0 - x0, 6, 0.12, gl, (x0 + dx0) / 2, 3, z0, 0, false).box(x1 - dx1, 6, 0.12, gl, (dx1 + x1) / 2, 3, z0, 0, false).box(w, H - 6, T, outW, cx, 6 + (H - 6) / 2, z0);
    colliders.push({ box: [x0, z0 - 0.3, dx0, z0 + 0.3] }, { box: [dx1, z0 - 0.3, x1, z0 + 0.3] });
    for (let k = 0; k <= 6; k++) { const px = x0 + k * w / 6; if (Math.abs(px - dcx) < dw / 2 + 0.2) continue; p.box(0.3, 6, 0.4, postM(k), px, 3, z0); }
    [dx0, dx1].forEach((px, k) => p.box(0.35, 4.8, 0.45, postM(k + 2), px, 2.4, z0)); p.box(dw + 0.4, 0.35, 0.45, postM(4), dcx, 4.8, z0).box(dw - 0.2, 1.2, 0.12, gl, dcx, 5.4, z0, 0, false);
    // the door: two glass halves that slide open
    const dm = M("#d9f6ff", { transparent: true, opacity: 0.4, roughness: 0.05, metalness: 0.5, depthWrite: false }), dl = new THREE.Mesh(new THREE.BoxGeometry(dw / 2, 4.6, 0.08), dm), dr = dl.clone(); a.g.add(dl, dr);
    doors.push({ x: dcx, z: z0, open: 0, fn: (k) => { dl.position.set(dcx - dw / 4 - k * (dw / 2 - 0.1), 2.3, z0 + 0.15); dr.position.set(dcx + dw / 4 + k * (dw / 2 - 0.1), 2.3, z0 + 0.15); } });
    // the big sign with running bulbs round it
    { const sg = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.6), new THREE.MeshBasicMaterial({ map: textTex("arcsign", "GAME ZONE", { bg: "#1a0b30", fg: "#ffd65a", w: 1024, h: 205, size: 150, border: "#ff4fd8" }), transparent: true }));
      sg.position.set(cx, 7.9, z0 - T / 2 - 0.05); sg.rotation.y = Math.PI; a.far.add(sg);
      const bA = neon("#ffffff", 1.4, 3), bB = neon("#ffd65a", 0.3, 0.8), bulbs = [[], []];
      for (let k = 0; k < 44; k++) { const u = k / 44, per = 2 * (13.6 + 3.2); let t2 = u * per, bx2, by2; if (t2 < 13.6) { bx2 = -6.8 + t2; by2 = 1.6; } else if ((t2 -= 13.6) < 3.2) { bx2 = 6.8; by2 = 1.6 - t2; } else if ((t2 -= 3.2) < 13.6) { bx2 = 6.8 - t2; by2 = -1.6; } else { t2 -= 13.6; bx2 = -6.8; by2 = -1.6 + t2; }
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), k % 2 ? bA : bB); m.position.set(cx - bx2, 7.9 + by2, z0 - T / 2 - 0.12); a.far.add(m); bulbs[k % 2].push(m); }
      anim.push({ a, fn: (t) => { const on = Math.floor(t * 4) % 2; bulbs[0].forEach((m) => { m.material = on ? bA : bB; }); bulbs[1].forEach((m) => { m.material = on ? bB : bA; }); } }); }
    // the roof with a glowing edge, and the giant joystick on it
    p.box(w + 0.6, 0.5, d + 0.6, ROOF(), cx, H + 0.25, cz).box(w + 0.7, 0.14, 0.2, neon("#ff4fd8", 0.8, 2.4), cx, H + 0.55, z0 - 0.3, 0, false).box(w + 0.7, 0.14, 0.2, neon("#59e0ff", 0.8, 2.4), cx, H + 0.55, z1 + 0.3, 0, false);
    { const jx = cx, jz = cz + 2, y = H + 0.5; p.box(6, 1.4, 4, M("#2a1f5c", { metalness: 0.3, roughness: 0.3 }), jx, y + 0.7, jz).box(6.1, 0.12, 4.1, neon("#59e0ff", 1, 2.6), jx, y + 1.42, jz, 0, false)
        .cyl(0.25, 3.0, STEEL(), jx - 1.2, y + 2.9, jz, 12).sphere(0.9, M("#ff4f6d", { metalness: 0.3, roughness: 0.25, emissive: new THREE.Color("#ff4f6d"), emissiveIntensity: 0.35 }), jx - 1.2, y + 4.6, jz)
        .cyl(0.5, 0.35, M("#ffd65a", { emissive: new THREE.Color("#ffd65a"), emissiveIntensity: 0.4 }), jx + 1.2, y + 1.6, jz - 0.8, 20).cyl(0.5, 0.35, M("#59e0ff", { emissive: new THREE.Color("#59e0ff"), emissiveIntensity: 0.4 }), jx + 2.4, y + 1.6, jz + 0.4, 20); }
    // inside: pixel art on the walls in glowing frames
    { const PIX = [["X..X..X", "XX.X.XX", "XXXXXXX", "XXXXXXX", "X.X.X.X", "XXXXXXX"], ["..X..", ".XXX.", "XXXXX", ".XXX.", ".X.X."], [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."], ["...XX", "..XX.", ".XXXX", "XXXX.", "..XX.", ".XX.."]];
      const art = (k) => canvasTex("fw-pix" + k, 128, 128, (x, cw, ch) => { x.fillStyle = "#120a2e"; x.fillRect(0, 0, cw, ch); const P0 = PIX[k % 4], cs = Math.floor(96 / Math.max(P0.length, P0[0].length));
        const ox = (cw - P0[0].length * cs) / 2, oy = (ch - P0.length * cs) / 2; x.fillStyle = NC[k % 5]; P0.forEach((row, r) => [...row].forEach((ch2, c) => { if (ch2 === "X") x.fillRect(ox + c * cs + 1, oy + r * cs + 1, cs - 2, cs - 2); })); }, { repeat: false });
      const hang = (px, pz, ry, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: art(k) })); m.position.set(px, 5.6, pz); m.rotation.y = ry; a.far.add(m);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), new THREE.MeshBasicMaterial({ color: NC[(k + 2) % 5] })); f.position.set(px - Math.sin(ry) * 0.01, 5.6, pz - Math.cos(ry) * 0.01); f.rotation.y = ry; a.far.add(f); };
      [z0 + 4, z0 + 9.5].forEach((z, k) => { hang(x0 + T + 0.06, z, Math.PI / 2, k); hang(x1 - T - 0.06, z, -Math.PI / 2, k + 2); });
      [-7.5, 7.5].forEach((o, k) => hang(cx + o, z1 - T - 0.06, Math.PI, k + 1)); }
    // the ceiling inside: dark, with lines of coloured light
    p.box(w - 2 * T, 0.1, d - 2 * T, M("#1a1438", { roughness: 0.8, metalness: 0 }), cx, H - 0.1, cz, 0, false);
    for (let k = 0; k < 5; k++) p.box(w - 3, 0.08, 0.25, neon(NC[k], 0.9, 2.4), cx, H - 0.2, z0 + 2.2 + k * (d - 4.4) / 4, 0, false);
    // the three game machines: a cabinet in the game's colour, the title lit up on top, the screen, the controls
    const GAMEART = { drone: (x, cw, ch) => { const g2 = x.createRadialGradient(cw / 2, ch / 2, 10, cw / 2, ch / 2, cw / 2); g2.addColorStop(0, "#1a4a9a"); g2.addColorStop(1, "#060c24"); x.fillStyle = g2; x.fillRect(0, 0, cw, ch);
        for (let k = 0; k < 6; k++) { x.strokeStyle = k % 2 ? "#59e0ff" : "#ff4fd8"; x.lineWidth = 4; x.beginPath(); x.ellipse(cw / 2, ch / 2, 20 + k * 22, 14 + k * 16, 0, 0, TAU); x.stroke(); }
        x.fillStyle = "#ffffff"; x.fillRect(cw / 2 - 16, ch / 2 - 4, 32, 8); x.fillRect(cw / 2 - 4, ch / 2 - 12, 8, 24); },
      robot: (x, cw, ch) => { x.fillStyle = "#1a1408"; x.fillRect(0, 0, cw, ch); x.fillStyle = "#ffd65a"; x.fillRect(cw / 2 - 40, ch / 2 - 46, 80, 70); x.fillStyle = "#1a1408"; x.fillRect(cw / 2 - 26, ch / 2 - 26, 16, 16); x.fillRect(cw / 2 + 10, ch / 2 - 26, 16, 16);
        x.fillStyle = "#59e0ff"; x.fillRect(cw / 2 - 20, ch / 2 + 2, 40, 8); x.fillStyle = "#ffd65a"; x.fillRect(cw / 2 - 4, ch / 2 - 66, 8, 20); x.beginPath(); x.arc(cw / 2, ch / 2 - 70, 8, 0, TAU); x.fill();
        x.strokeStyle = "#ff4fd8"; x.lineWidth = 8; x.beginPath(); x.moveTo(cw / 2 + 50, ch / 2 + 50); x.lineTo(cw / 2 + 80, ch / 2 + 20); x.stroke(); },
      rooftops: (x, cw, ch) => { const g2 = x.createLinearGradient(0, 0, 0, ch); g2.addColorStop(0, "#ff9ad9"); g2.addColorStop(1, "#5a2a8a"); x.fillStyle = g2; x.fillRect(0, 0, cw, ch);
        [[10, 150, 50], [70, 120, 60], [140, 160, 50], [196, 130, 60]].forEach(([bx2, by2, bw2]) => { x.fillStyle = "#2a1f5c"; x.fillRect(bx2, by2, bw2, ch - by2); x.fillStyle = "#ffd65a"; for (let y = by2 + 10; y < ch; y += 18) for (let xx = bx2 + 6; xx < bx2 + bw2 - 6; xx += 14) x.fillRect(xx, y, 6, 8); });
        x.fillStyle = "#ffffff"; x.beginPath(); x.arc(118, 80, 14, 0, TAU); x.fill(); x.strokeStyle = "#ffffff"; x.lineWidth = 3; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(60, 115); x.quadraticCurveTo(90, 50, 118, 80); x.stroke(); } };
    FL.FW_STATIONS.forEach((s2, k) => { const [mx, mz] = W(s2.x, s2.z), col = STATION_COL[s2.id], body = M("#1d1840", { metalness: 0.4, roughness: 0.3 }), side = M(col, { metalness: 0.2, roughness: 0.35, emissive: new THREE.Color(col), emissiveIntensity: 0.35 });
      // the cabinet: two coloured sides, a dark middle, a slanted control desk; screen and title face the door (-z)
      p.box(1.5, 2.3, 1.15, body, mx, 1.15, mz).box(0.08, 2.4, 1.2, side, mx - 0.78, 1.2, mz).box(0.08, 2.4, 1.2, side, mx + 0.78, 1.2, mz);
      p.box(1.5, 0.5, 0.7, body, mx, 1.0, mz - 0.85).box(1.52, 0.06, 0.74, side, mx, 1.27, mz - 0.85).box(1.6, 0.1, 0.14, neon(col, 1, 2.6), mx, 0.06, mz - 0.6, 0, false);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.95), new THREE.MeshBasicMaterial({ map: canvasTex("fw-game-" + s2.id, 256, 200, GAMEART[s2.id] || GAMEART.drone, { repeat: false }) }));
      scr.position.set(mx, 1.85, mz - 0.6); scr.rotation.set(-0.18, Math.PI, 0, "YXZ"); a.far.add(scr);
      const mq = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.42), new THREE.MeshBasicMaterial({ map: textTex("st" + s2.id, STATION_TITLE[s2.id], { fg: col, w: 512, h: 150, size: 70 }) }));
      mq.position.set(mx, 2.55, mz - 0.6); mq.rotation.y = Math.PI; a.far.add(mq); p.box(1.5, 0.5, 0.2, body, mx, 2.55, mz - 0.48);
      // the joystick and three buttons, a coin slot that glows
      p.cyl(0.1, 0.06, STEEL(), mx - 0.35, 1.32, mz - 0.95, 10).cyl(0.04, 0.3, STEEL(), mx - 0.35, 1.45, mz - 0.95, 8).sphere(0.1, M("#ff4f6d", { roughness: 0.3, metalness: 0.2 }), mx - 0.35, 1.62, mz - 0.95);
      ["#59e0ff", "#ffd65a", "#7dff9b"].forEach((bc, q) => p.cyl(0.07, 0.05, neon(bc, 1, 2.6), mx + 0.05 + q * 0.2, 1.32, mz - 0.92 + (q % 2) * 0.08, 12, false));
      p.box(0.25, 0.12, 0.04, neon("#ff4f6d", 1, 2.6), mx, 0.55, mz - 0.59, 0, false);
      // a ring of light on the floor where you stand to play
      p.ring(0.75, neon(col, 1, 2.8), mx, 0.1, mz + (s2.sz ?? 2), Math.PI / 2, 0, 0.6);
      colliders.push({ box: [mx - 0.85, mz - 1.25, mx + 0.85, mz + 0.6] }); });
    // the air hockey table, the claw machine, the prize counter with prizes on shelves, some round stools
    { const [hx, hz] = W(17.5, 50.5); p.box(2.2, 0.8, 3.6, M("#2a1f5c", { metalness: 0.3, roughness: 0.3 }), hx, 0.4, hz).box(2.0, 0.05, 3.4, M("#bff1ff", { roughness: 0.1, metalness: 0.2, emissive: new THREE.Color("#59e0ff"), emissiveIntensity: 0.4 }), hx, 0.83, hz, 0, false)
        .box(2.2, 0.12, 0.1, neon("#ff4fd8", 1, 2.6), hx, 0.9, hz - 1.8, 0, false).box(2.2, 0.12, 0.1, neon("#ff4fd8", 1, 2.6), hx, 0.9, hz + 1.8, 0, false).box(0.1, 0.12, 3.6, neon("#59e0ff", 1, 2.6), hx - 1.1, 0.9, hz, 0, false).box(0.1, 0.12, 3.6, neon("#59e0ff", 1, 2.6), hx + 1.1, 0.9, hz, 0, false)
        .cyl(0.12, 0.03, M("#111111"), hx + 0.3, 0.87, hz + 0.4, 14, false).cyl(0.16, 0.08, M("#ffd65a"), hx, 0.92, hz - 1.2, 14).cyl(0.16, 0.08, M("#7dff9b"), hx, 0.92, hz + 1.2, 14); colliders.push({ box: [hx - 1.2, hz - 1.9, hx + 1.2, hz + 1.9] }); }
    { const [cx2, cz2] = W(31.4, 47.6), cm = M("#ff4fd8", { metalness: 0.3, roughness: 0.3, emissive: new THREE.Color("#ff4fd8"), emissiveIntensity: 0.3 });
      p.box(1.8, 1.1, 1.8, cm, cx2, 0.55, cz2).box(1.7, 1.6, 1.7, GLASS(), cx2, 1.9, cz2, 0, false).box(1.8, 0.3, 1.8, cm, cx2, 2.85, cz2).box(1.6, 0.12, 1.6, neon("#ffd65a", 1, 2.6), cx2, 3.05, cz2, 0, false);
      for (let k = 0; k < 14; k++) p.sphere(0.2, M(NC[k % 5], { roughness: 0.6, metalness: 0 }), cx2 - 0.6 + (k % 4) * 0.4, 1.25 + Math.floor(k / 4) * 0.12, cz2 - 0.5 + ((k * 7) % 4) * 0.3);
      p.cyl(0.02, 0.8, STEEL(), cx2 + 0.2, 2.3, cz2, 6).cyl(0.18, 0.12, STEEL(), cx2 + 0.2, 1.85, cz2, 10); colliders.push({ c: [cx2, cz2], r: 1.3 }); }
    { const [px2, pz0] = W(13.4, 47), [, pz1] = W(0, 54.5), pc = (pz0 + pz1) / 2, pl = pz1 - pz0, top = M("#ffd65a", { metalness: 0.3, roughness: 0.3, emissive: new THREE.Color("#ffd65a"), emissiveIntensity: 0.25 });
      p.box(0.9, 1.05, pl, M("#ffffff", { roughness: 0.4, metalness: 0.1 }), px2 + 0.6, 0.53, pc).box(1.0, 0.08, pl + 0.1, top, px2 + 0.6, 1.08, pc).box(0.06, 0.6, pl - 0.4, neon("#ff4fd8", 1, 2.6), px2 + 1.08, 0.55, pc, 0, false);
      colliders.push({ box: [px2, pz0, px2 + 1.1, pz1] });
      for (let r = 0; r < 3; r++) { p.box(0.5, 0.08, pl, M("#ffffff", { roughness: 0.4 }), x0 + T + 0.25, 1.6 + r * 1.0, pc);
        for (let q = 0; q < 6; q++) { const pzq = pz0 + 0.6 + q * (pl - 1.2) / 5, c = NC[(q + r) % 5], m = M(c, { roughness: 0.7, metalness: 0 }); if ((q + r) % 2) { p.sphere(0.22, m, x0 + T + 0.3, 1.86 + r, pzq).sphere(0.1, m, x0 + T + 0.3, 2.1 + r, pzq - 0.15).sphere(0.1, m, x0 + T + 0.3, 2.1 + r, pzq + 0.15); }
          else p.box(0.3, 0.4, 0.3, m, x0 + T + 0.3, 1.84 + r, pzq).box(0.32, 0.12, 0.2, neon("#ffffff", 0.6, 1.8), x0 + T + 0.3, 1.86 + r, pzq, 0, false); } }
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.8), new THREE.MeshBasicMaterial({ map: textTex("arcprize", "PRIZES", { bg: "#1a0b30", fg: "#ff7af0", w: 512, h: 120, size: 80 }), transparent: true })); sg.position.set(x0 + T + 0.08, 4.6, pc); sg.rotation.y = Math.PI / 2; a.far.add(sg); }
    [[26, 49], [28.5, 51], [25, 52.5]].forEach(([lx, lz], k) => { const [sx2, sz2] = W(lx, lz); p.cyl(0.08, 0.6, STEEL(), sx2, 0.3, sz2, 8).cyl(0.38, 0.14, M(NC[k + 1], { roughness: 0.5, metalness: 0.1 }), sx2, 0.67, sz2, 18).ring(0.38, neon(NC[k + 2], 1, 2.6), sx2, 0.75, sz2, Math.PI / 2, 0, 1);
      seats.push({ x: sx2, z: sz2, f: 0, y: 0.75, k: "sit" }); colliders.push({ c: [sx2, sz2], r: 0.45 }); });
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

  /* ---------- flying cars: six kinds on three heights (InstancedMesh, moved every frame) ----------
     low (8-11 up): two rings round Neon Square, delivery drones over the middle of the city, and the hover canyon;
     middle (16-22): two big loops over the sea round the island; high (88-96): express lanes straight across the sky,
     through glowing lane gates. Each kind: a body (coloured per car), glass, its lights (white in front, red behind)
     and the glow under it. carPos keeps where every car is, for the whoosh when one passes close. */
  const CARS = [], carPos = [];
  {
    const capX = (r, len, seg = 12) => { const g = new THREE.CapsuleGeometry(r, len, 4, seg); g.rotateZ(Math.PI / 2); return g; };
    const T = (g, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
    const col = (g, c) => { const n = g.attributes.position.count, arr = new Float32Array(n * 3), C = new THREE.Color(c); for (let i = 0; i < n; i++) { arr[i * 3] = C.r; arr[i * 3 + 1] = C.g; arr[i * 3 + 2] = C.b; } g.setAttribute("color", new THREE.BufferAttribute(arr, 3)); return g; };
    const mg = (L) => mergeGeometries(L.map((g) => { g = g.index ? g.toNonIndexed() : g; if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }), false);
    const sph = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h), bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const WHITE_L = "#fdfbe8", RED_L = "#ff3355", CY = "#59e0ff";
    const head = (x, y, zz, r = 0.13) => [-1, 1].map((sg) => col(T(sph(r, 8, 6), x, y, sg * zz), WHITE_L));
    const glowDisk = (r, sx, sz, y) => { const g = new THREE.CircleGeometry(r, 24); g.rotateX(Math.PI / 2); g.scale(sx, 1, sz); g.translate(0, y, 0); return g; };
    const TYPES = [
      { id: "coupe", cols: ["#f2f6ff", "#ff5f7a", "#1f6bff", "#ffd65a", "#2a3042", "#7dff9b", "#c58bff"],
        body: mg([T(sph(1, 20, 12), 0, 0, 0, 1.9, 0.5, 0.95), ...[-1, 1].map((sg) => T(capX(0.28, 1.6, 10), -0.2, -0.15, sg * 0.98)), T(bx(0.6, 0.55, 0.08), -1.55, 0.45, 0)]),
        glass: T(new THREE.SphereGeometry(0.75, 16, 10, 0, TAU, 0, Math.PI / 2), -0.15, 0.3, 0, 1.3, 0.75, 0.9),
        lights: mg([...head(1.82, 0.02, 0.42), col(T(bx(0.08, 0.12, 1.3), -1.9, 0.08, 0), RED_L), ...[-1, 1].map((sg) => col(T(bx(1.4, 0.05, 0.05), -0.2, -0.38, sg * 1.22), CY))]),
        glow: glowDisk(1.5, 1.3, 0.75, -0.55) },
      { id: "taxi", cols: ["#ffd23a", "#ffc21a", "#ffdf5a"],
        body: mg([T(capX(0.62, 2.2, 14), 0, 0, 0, 1, 1, 1.25), T(bx(3.2, 0.25, 1.7), 0, -0.4, 0)]),
        glass: T(bx(1.7, 0.42, 1.66), -0.1, 0.32, 0),
        lights: mg([...head(1.78, 0, 0.45, 0.14), col(T(bx(0.08, 0.14, 1.2), -1.82, 0.05, 0), RED_L), col(T(bx(0.75, 0.24, 0.42), -0.1, 0.72, 0), "#fff6c2"), col(T(bx(3.0, 0.06, 0.05), 0, -0.2, 0.79), "#1d2433"), col(T(bx(3.0, 0.06, 0.05), 0, -0.2, -0.79), "#1d2433")]),
        glow: glowDisk(1.6, 1.25, 0.7, -0.62) },
      { id: "bus", cols: ["#f4f8ff", "#e6f4ff"],
        body: mg([T(capX(1.0, 6.0, 16), 0, 0.2, 0, 1, 1, 1.15)]),
        glass: T(bx(6.0, 0.62, 2.36), 0.2, 0.5, 0),
        lights: mg([col(T(bx(0.1, 0.22, 1.5), 3.95, 0.1, 0), WHITE_L), col(T(bx(0.1, 0.2, 1.6), -3.98, 0.25, 0), RED_L), ...[-1, 1].map((sg) => col(T(bx(6.6, 0.12, 0.03), 0, -0.3, sg * 1.16), CY)), col(T(bx(1.2, 0.3, 0.04), 2.4, 0.95, 0), "#7ff6ff")]),
        glow: glowDisk(1.8, 2.5, 0.75, -0.95) },
      { id: "drone", cols: ["#f4f8ff", "#ffffff"],
        body: mg([T(bx(0.9, 0.32, 0.9)), T(bx(2.0, 0.08, 0.12).rotateY(Math.PI / 4)), T(bx(2.0, 0.08, 0.12).rotateY(-Math.PI / 4)), T(bx(0.62, 0.5, 0.62), 0, -0.48, 0)]),
        glass: T(new THREE.SphereGeometry(0.3, 12, 8, 0, TAU, 0, Math.PI / 2), 0, 0.16, 0),
        lights: mg([...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a2, b2]) => col(T(new THREE.TorusGeometry(0.32, 0.04, 6, 18).rotateX(Math.PI / 2), a2 * 0.7, 0.08, b2 * 0.7), CY)), col(T(sph(0.07, 6, 4), 0.46, 0, 0), WHITE_L), col(T(sph(0.07, 6, 4), -0.46, 0, 0), RED_L)]),
        glow: glowDisk(0.6, 1, 1, -0.85) },
      { id: "pod", cols: ["#ffffff", "#bff6ff", "#ffd1f3", "#d9ffe9"],
        body: mg([T(new THREE.SphereGeometry(0.96, 18, 8, 0, TAU, Math.PI / 2, Math.PI / 2), 0, -0.05, 0), T(new THREE.TorusGeometry(0.96, 0.14, 8, 28).rotateX(Math.PI / 2), 0, -0.05, 0)]),
        glass: T(new THREE.SphereGeometry(0.92, 18, 10, 0, TAU, 0, Math.PI / 2), 0, -0.05, 0),
        lights: mg([...head(0.95, -0.1, 0.3, 0.1), col(T(bx(0.06, 0.08, 0.7), -1.0, -0.12, 0), RED_L), col(T(new THREE.TorusGeometry(0.7, 0.05, 6, 24).rotateX(Math.PI / 2), 0, -0.55, 0), CY)]),
        glow: glowDisk(1.0, 1, 1, -0.75) },
      { id: "bike", cols: ["#ff4fd8", "#59e0ff", "#2a3042", "#ffd65a", "#7dff9b"],
        body: mg([T(capX(0.28, 1.7, 10)), T(sph(0.4, 12, 8), 0.85, 0.08, 0, 1.2, 0.7, 0.8), T(bx(0.7, 0.12, 0.36), -0.35, 0.32, 0)]),
        glass: T(bx(0.32, 0.26, 0.5), 0.78, 0.42, 0),
        lights: mg([col(T(sph(0.12, 8, 6), 1.3, 0.08, 0), WHITE_L), col(T(bx(0.06, 0.1, 0.4), -1.15, 0.1, 0), RED_L), ...[-1, 1].map((sg) => col(T(new THREE.TorusGeometry(0.34, 0.05, 6, 20).rotateX(Math.PI / 2), sg * 0.62, -0.32, 0), CY))]),
        glow: glowDisk(0.9, 1.4, 0.6, -0.5) },
    ];
    const TI = Object.fromEntries(TYPES.map((t, i) => [t.id, i]));
    // the routes (local steps): [kind, how many of each type]
    const add = (type, route) => { CARS.push({ type: TI[type], ...route, k: TYPES[TI[type]].cols[CARS.length % TYPES[TI[type]].cols.length] }); };
    const mix = (list, fn) => list.forEach(([type, n]) => { for (let i = 0; i < n; i++) add(type, fn(i, n)); });
    mix([["coupe", 5], ["bike", 3], ["taxi", 2]], (i) => ({ kind: "canyon", lane: i % 4, off: R() * 140, speed: 14 + R() * 10, dir: i % 2 ? 1 : -1 }));
    mix([["taxi", 4], ["pod", 5], ["coupe", 3], ["bike", 2]], (i) => i % 2 ? { kind: "loop", cz: FL.SQUARE.c[1], rx: 25.5, rz: 25.5, y: 8.5, off: R() * TAU, w: 0.11 } : { kind: "loop", cz: FL.SQUARE.c[1], rx: 28, rz: 28, y: 11, off: R() * TAU, w: -0.09 });
    mix([["coupe", 7], ["taxi", 4], ["bus", 3], ["pod", 2], ["bike", 2]], (i) => i % 2 ? { kind: "loop", cz: 2, rx: 128, rz: 112, y: 16, off: R() * TAU, w: 0.045 } : { kind: "loop", cz: 2, rx: 134, rz: 118, y: 22, off: R() * TAU, w: -0.04 });
    mix([["coupe", 6], ["bike", 4], ["taxi", 2]], (i) => ({ kind: "line", axis: i % 2 ? "x" : "z", c: (i % 4 < 2 ? 1 : -1) * 3 + (i % 2 ? FL.SQUARE.c[1] : 0), dir: i % 4 < 2 ? 1 : -1, y: i % 2 ? 88 : 96, L: 460, off: R() * 460, speed: 26 + R() * 10 }));
    mix([["drone", 8]], () => ({ kind: "drone", cx: 0, cz: 40, ax: 18 + R() * 8, az: 36 + R() * 14, y: 12 + R() * 5, w: 0.05 + R() * 0.05, p: R() * TAU, p2: R() * TAU }));
    CARS.forEach((c, i) => { c.lowKeep = i % 3 === 0; carPos.push({ x: 0, y: -99, z: 0, near: false }); });
    // one InstancedMesh per part per kind
    const bodyM = M("#ffffff", { metalness: 0.7, roughness: 0.22, envMap: envMap(), envMapIntensity: 0.8 }), glassM = M("#6fd8ff", { metalness: 0.4, roughness: 0.05, transparent: true, opacity: 0.7 });
    const lightM = new THREE.MeshBasicMaterial({ vertexColors: true }), glowM = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const TINT = ["#59e0ff", "#ff4fd8", "#ffd65a", "#7dff9b", "#c58bff"], tmpC = new THREE.Color();
    TYPES.forEach((T0, ti) => { const mine = CARS.map((c, i) => (c.type === ti ? i : -1)).filter((i) => i >= 0), n = mine.length; T0.ids = mine;
      T0.parts = [new THREE.InstancedMesh(T0.body, bodyM, n), new THREE.InstancedMesh(T0.glass, glassM, n), new THREE.InstancedMesh(T0.lights, lightM, n), new THREE.InstancedMesh(T0.glow, glowM, n)];
      mine.forEach((ci, j) => { T0.parts[0].setColorAt(j, tmpC.set(CARS[ci].k)); T0.parts[3].setColorAt(j, tmpC.set(T0.id === "taxi" ? "#ffd65a" : TINT[ci % 5])); });
      T0.parts.forEach((m) => { m.frustumCulled = false; root.add(m); }); T0.parts[0].castShadow = true; });
    // the lane gates on the express lanes: big glowing hoops the cars fly through
    { const p = new P(new Acc()); [[-70, 0], [70, 0]].forEach(([lx], k) => { const [x, z] = W(lx, FL.SQUARE.c[1]); p.ring(7.5, neon(k ? "#ff4fd8" : "#59e0ff", 1, 2.8), x, 88, z, 0, Math.PI / 2, 1.2).ring(8.3, neon("#ffffff", 0.5, 1.6), x, 88, z, 0, Math.PI / 2, 0.6); });
      [[0, -110], [0, 120]].forEach(([, lz], k) => { const [x, z] = W(0, lz); p.ring(7.5, neon(k ? "#ffd65a" : "#7dff9b", 1, 2.8), x, 96, z, 0, 0, 1.2).ring(8.3, neon("#ffffff", 0.5, 1.6), x, 96, z, 0, 0, 0.6); }); p.acc.build(root); }
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, "YXZ"), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    const pose = (c, t) => { let x, y, z, ry, roll = 0;
      if (c.kind === "canyon") { const L = 140, sN = ((c.off + t * c.speed) % L) - L / 2; [x, z] = W(sN * c.dir, FL.CANYON.rect[1] + 4 + c.lane * 3.6); y = -7 + c.lane * 2.2; ry = c.dir > 0 ? 0 : Math.PI; }
      else if (c.kind === "loop") { const a2 = c.off + t * c.w; [x, z] = W(Math.cos(a2) * c.rx, Math.sin(a2) * c.rz + c.cz); y = c.y + Math.sin(t * 0.8 + c.off) * 0.5; ry = -a2 + (c.w > 0 ? -Math.PI / 2 : Math.PI / 2); roll = c.w > 0 ? -0.14 : 0.14; }
      else if (c.kind === "line") { const sN = ((c.off + t * c.speed) % c.L) - c.L / 2, d = sN * c.dir; if (c.axis === "x") { [x, z] = W(d, c.c); ry = c.dir > 0 ? 0 : Math.PI; } else { [x, z] = W(c.c, d); ry = c.dir > 0 ? -Math.PI / 2 : Math.PI / 2; } y = c.y; }
      else { const f = (tt) => [c.cx + Math.sin(c.p + tt * c.w) * c.ax, c.cz + Math.sin(c.p2 + tt * c.w * 2) * c.az * 0.5]; const [ax2, az2] = f(t), [bx2, bz2] = f(t + 0.2); [x, z] = W(ax2, az2); y = c.y + Math.sin(t * 2 + c.p) * 0.3; ry = Math.atan2(-(bz2 - az2), bx2 - ax2); roll = 0; }
      return [x, y, z, ry, roll]; };
    anim.push({ fn: (t, dt, low) => { for (const T0 of TYPES) { T0.ids.forEach((ci, j) => { const c = CARS[ci], P0 = carPos[ci];
        if (low && !c.lowKeep) { for (const m of T0.parts) m.setMatrixAt(j, hidden); P0.y = -99; return; }
        const [x, y, z, ry, roll] = pose(c, t); P0.x = x; P0.y = y; P0.z = z;
        e.set(roll, ry, 0); q.setFromEuler(e); mx.compose(pos.set(x, y, z), q, one); for (const m of T0.parts) m.setMatrixAt(j, mx); });
      for (const m of T0.parts) m.instanceMatrix.needsUpdate = true; } } });
  }

  /* ---------- the hover bus: a bus that flies low over the sea round the island and stops at three stops on the
     promenade (east by the hotel, south by the park, west by the mall), with a chime when it arrives ---------- */
  const BUS = { x: 0, y: -99, z: 0, atStop: -1 };
  {
    const I = FL.ISLAND, E = 4, RX = I.x1 + E, LX = I.x0 - E, TZ = I.z1 + E, NZ = I.z0 - E, rc = 10;
    // the route: a rounded rectangle over the water, clockwise from the east stop
    const pts = []; const corner = (cx2, cz2, a0) => { for (let k = 0; k <= 8; k++) { const an = a0 + (k / 8) * (Math.PI / 2); pts.push([cx2 + Math.cos(an) * rc, cz2 + Math.sin(an) * rc]); } };
    pts.push([RX, -20]); corner(RX - rc, TZ - rc, 0); corner(LX + rc, TZ - rc, Math.PI / 2); corner(LX + rc, NZ + rc, Math.PI); corner(RX - rc, NZ + rc, Math.PI * 1.5); pts.push([RX, -20]);
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const LEN = cum[cum.length - 1];
    const at = (sN) => { sN = ((sN % LEN) + LEN) % LEN; let i = 1; while (i < cum.length - 1 && cum[i] < sN) i++; const k = (sN - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]; };
    const near = (lx, lz) => { let best = 0, bd = 1e9; for (let sN = 0; sN < LEN; sN += 0.5) { const [x, z] = at(sN), d = Math.hypot(x - lx, z - lz); if (d < bd) { bd = d; best = sN; } } return best; };
    const STOPS = [{ name: "HOTEL", at: [I.x1 - 2.4, -20], n: [1, 0] }, { name: "GLOW PARK", at: [60, I.z1 - 2.4], n: [0, 1] }, { name: "SKY MALL", at: [I.x0 + 2.4, -30], n: [-1, 0] }];
    STOPS.forEach((S) => { S.s = near(S.at[0] + S.n[0] * (E + 2.4), S.at[1] + S.n[1] * (E + 2.4)); }); STOPS.sort((a2, b2) => a2.s - b2.s);
    const V = 11, DWELL = 6, legs = STOPS.map((S, i) => { const nx = STOPS[(i + 1) % STOPS.length], d = ((nx.s - S.s) + LEN) % LEN || LEN; return { s0: S.s, d, T: d / V }; });
    const CYCLE = legs.reduce((acc, L0) => acc + L0.T + DWELL, 0);
    // the bus itself (one, so plain meshes): white with a glass band, lights, the route number on the side
    const g = new THREE.Group(); g.name = "hoverBus"; root.add(g);
    { const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.0, 6.0, 4, 16).rotateZ(Math.PI / 2).scale(1, 1, 1.15).translate(0, 0.2, 0), M("#f4f8ff", { metalness: 0.6, roughness: 0.22, envMap: envMap(), envMapIntensity: 0.8 })); body.castShadow = true; g.add(body);
      const band = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.62, 2.36).translate(0.2, 0.5, 0), GLASS()); g.add(band);
      const stripe = new THREE.MeshBasicMaterial({ color: "#59e0ff" }); [-1, 1].forEach((sg) => { const m = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.14, 0.03).translate(0, -0.3, sg * 1.16), stripe); g.add(m);
        const num = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), new THREE.MeshBasicMaterial({ map: textTex("busnum", "BUS 7", { bg: "#0b1230", fg: "#59e0ff", w: 256, h: 84, size: 54 }), transparent: true })); num.position.set(-1.8, -0.02, sg * 1.17); num.rotation.y = sg > 0 ? 0 : Math.PI; g.add(num); });
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 1.5).translate(3.95, 0.1, 0), new THREE.MeshBasicMaterial({ color: "#fdfbe8" })), new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 1.6).translate(-3.98, 0.25, 0), new THREE.MeshBasicMaterial({ color: "#ff3355" })));
      const gl = new THREE.Mesh(new THREE.CircleGeometry(1.8, 24).rotateX(Math.PI / 2).scale(2.4, 1, 0.7).translate(0, -1.05, 0), new THREE.MeshBasicMaterial({ color: "#59e0ff", transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); g.add(gl);
      // windows down both sides with white frames, a door on each side, a dark curved windscreen, a light on the roof, two hover skids
      const win = M("#173a7a", { metalness: 0.5, roughness: 0.08, emissive: new THREE.Color("#2a6fd6"), emissiveIntensity: 0.35, envMap: envMap(), envMapIntensity: 0.9 }), fr = M("#ffffff", { metalness: 0.3, roughness: 0.3 });
      [-1, 1].forEach((sg) => { for (let k = 0; k < 5; k++) { const wx = -2.3 + k * 1.05; if (k === 4) continue; const w = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.5, 0.05), win); w.position.set(wx, 0.6, sg * 1.09); g.add(w); }
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.05), win); door.position.set(1.9, 0.32, sg * 1.1); g.add(door);
        const dl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 0.06), stripe); dl.position.set(1.9, 0.32, sg * 1.13); g.add(dl);
        const skid = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 5.2, 4, 10).rotateZ(Math.PI / 2), M("#c9d2e3", { metalness: 0.6, roughness: 0.25, envMap: envMap(), envMapIntensity: 0.7 })); skid.position.set(0, -0.82, sg * 0.75); g.add(skid);
        const sl = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.05, 0.05), stripe); sl.position.set(0, -0.98, sg * 0.75); g.add(sl); });
      const ws = new THREE.Mesh(new THREE.SphereGeometry(1.025, 18, 10, Math.PI - 0.95, 1.9, 0.85, 0.75).scale(1, 1, 1.15).translate(3.0, 0.2, 0), win); g.add(ws);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 0.55), stripe); roof.position.set(-0.4, 1.24, 0); g.add(roof); }
    anim.push({ fn: (t) => { let u = t % CYCLE, li = 0; while (u > legs[li].T + DWELL) { u -= legs[li].T + DWELL; li = (li + 1) % legs.length; }
      const L0 = legs[li]; let sN, stop = -1; if (u < DWELL) { sN = L0.s0; stop = li; } else { const k = (u - DWELL) / L0.T; sN = L0.s0 + L0.d * (1 - Math.cos(Math.PI * k)) / 2; }
      const [lx, lz] = at(sN), [lx2, lz2] = at(sN + 0.6), [x, z] = W(lx, lz); const y = (stop >= 0 ? 1.1 : 1.5) + Math.sin(t * 1.6) * 0.06;
      g.position.set(x, y, z); g.rotation.y = Math.atan2(-(lz2 - lz), lx2 - lx); BUS.x = x; BUS.y = y; BUS.z = z;
      if (stop !== BUS.atStop) { BUS.atStop = stop; if (stop >= 0) BUS.arrived = t; } } });
    // the stops: a glass shelter with a white roof, a bench, a screen with the stop's name, a BUS sign on a pole, a
    // glowing ring where you'd get on. u: along the shore, v: out towards the sea
    const p = new P(new Acc()), roofM = WHITE(), seatM = M("#ffffff", { metalness: 0.15, roughness: 0.25 });
    STOPS.forEach((S, si) => { const [nx, nz] = S.n, tx = -nz, tz = nx, ry = Math.atan2(-tz, tx), [cx0, cz0] = S.at;
      const Pt = (u, v) => W(cx0 + tx * u + nx * v, cz0 + tz * u + nz * v), B = (w, h, d, m, u, y, v, cast = true) => { const [x, z] = Pt(u, v); p.box(w, h, d, m, x, y, z, ry, cast); };
      const box = (u0, u1, v0, v1) => { const [ax2, az2] = Pt(u0, v0), [bx2, bz2] = Pt(u1, v1); colliders.push({ box: [Math.min(ax2, bx2), Math.min(az2, bz2), Math.max(ax2, bx2), Math.max(az2, bz2)] }); };
      B(7.4, 0.06, 3.6, LIT_W(), 0, 0.05, -0.1, false); B(7.4, 0.04, 0.12, neon("#59e0ff", 1, 2.6), 0, 0.09, 1.7, false);
      B(6.8, 2.6, 0.08, GLASS(), 0, 1.5, -1.5, false); B(6.9, 0.12, 0.14, roofM, 0, 2.82, -1.5); box(-3.5, 3.5, -1.65, -1.35);
      [-1, 1].forEach((sd) => { B(0.08, 2.6, 2.6, GLASS(), sd * 3.45, 1.5, -0.3, false); box(sd * 3.45 - 0.15, sd * 3.45 + 0.15, -1.6, 1.0); B(0.14, 2.9, 0.14, roofM, sd * 3.45, 1.45, -1.5); B(0.14, 2.9, 0.14, roofM, sd * 3.45, 1.45, 1.0); });
      B(7.6, 0.2, 3.9, roofM, 0, 2.98, -0.25); B(7.6, 0.08, 0.1, neon("#59e0ff", 1, 2.8), 0, 2.9, 1.72, false); B(6.6, 0.03, 3.0, neon("#e9fbff", 0.8, 2), 0, 2.87, -0.3, false);
      // the bench (two seats) with a coloured cushion and the glow under it
      B(4.0, 0.18, 0.75, seatM, 0, 0.52, -0.95); B(3.8, 0.05, 0.62, M(["#59c8ff", "#7dffb0", "#ff7ad9"][si], { roughness: 0.6, metalness: 0 }), 0, 0.63, -0.95); B(3.8, 0.04, 0.05, neon("#59e0ff", 1, 2.6), 0, 0.4, -0.6, false); box(-2, 2, -1.35, -0.55);
      [-1, 1].forEach((sd) => { const [x, z] = Pt(sd * 1.0, -0.9); seats.push({ x, z, f: Math.atan2(nx, nz), y: 0.64, k: "sit" }); });
      // the screen on the back glass and the BUS sign on its pole by the edge
      { const [x, z] = Pt(0, -1.56), scr = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.9), new THREE.MeshBasicMaterial({ map: textTex("busstop" + si, "BUS 7 · " + S.name, { bg: "#0b1230", fg: "#59e0ff", w: 768, h: 200, size: 70 }) }));
        scr.position.set(x, 2.15, z); scr.rotation.y = Math.atan2(-nx, -nz); root.add(scr); }
      { const [x, z] = Pt(4.4, 1.2); p.cyl(0.08, 3.6, M("#f4f8ff", { metalness: 0.3, roughness: 0.3 }), x, 1.8, z, 8); colliders.push({ c: [x, z], r: 0.35 });
        const sg = new THREE.Mesh(new THREE.CircleGeometry(0.6, 28), new THREE.MeshBasicMaterial({ map: textTex("busdisc", "BUS", { bg: "#1f6bff", fg: "#ffffff", w: 256, h: 256, size: 110, border: "#ffffff" }), side: THREE.DoubleSide })); sg.position.set(x, 3.4, z); sg.rotation.y = ry; root.add(sg);
        p.ring(0.62, neon("#59e0ff", 1, 2.6), x, 3.4, z, 0, ry, 0.8); }
      { const [x, z] = Pt(0, 1.1); p.ring(1.1, neon("#59e0ff", 0.8, 2.4), x, 0.1, z, Math.PI / 2, 0, 0.5); }
    });
    p.acc.build(root);
  }

  /* ---------- helper robots hovering around the square: white and glossy, a dark visor with two eyes,
     a colour band round the middle and a ring of light under them ---------- */
  {
    const bodyG = new THREE.CapsuleGeometry(0.42, 0.6, 4, 12); bodyG.translate(0, 0.95, 0); const headG = new THREE.SphereGeometry(0.38, 16, 12); headG.translate(0, 1.85, 0);
    const visG = new THREE.SphereGeometry(0.39, 16, 8, -0.9, 1.8, 1.2, 0.7); visG.rotateY(Math.PI / 2); visG.translate(0, 1.85, 0);
    const eyeG = mergeGeometries([new THREE.SphereGeometry(0.065, 8, 6).translate(-0.12, 1.88, 0.375), new THREE.SphereGeometry(0.065, 8, 6).translate(0.12, 1.88, 0.375)]);
    const bandG = new THREE.TorusGeometry(0.44, 0.06, 6, 24); bandG.rotateX(Math.PI / 2); bandG.translate(0, 1.0, 0);
    const ringG = new THREE.TorusGeometry(0.36, 0.05, 6, 24); ringG.rotateX(Math.PI / 2); ringG.translate(0, 0.08, 0);
    const N = 10, white = M("#f6f9ff", { metalness: 0.15, roughness: 0.28, envMap: envMap(), envMapIntensity: 0.6 });
    const bm = new THREE.InstancedMesh(bodyG, white, N), hm = new THREE.InstancedMesh(headG, white, N), vm = new THREE.InstancedMesh(visG, M("#13224a", { metalness: 0.5, roughness: 0.15 }), N),
      em = new THREE.InstancedMesh(eyeG, new THREE.MeshBasicMaterial({ color: "#7ff6ff" }), N), cm = new THREE.InstancedMesh(bandG, new THREE.MeshBasicMaterial({ color: "#ffffff" }), N), rm = new THREE.InstancedMesh(ringG, neon("#59e0ff", 1.2, 3), N);
    const BAND = ["#59c8ff", "#ff7ad9", "#7dffb0", "#ffd65a", "#b18cff"], col = new THREE.Color(); for (let i = 0; i < N; i++) cm.setColorAt(i, col.set(BAND[i % BAND.length]));
    const all = [bm, hm, vm, em, cm, rm]; all.forEach((m) => { m.frustumCulled = false; root.add(m); }); bm.castShadow = hm.castShadow = true;
    const bots = []; for (let i = 0; i < N; i++) bots.push({ r: i < 6 ? 19 + R() * 2 : 30 + R() * 6, a: R() * TAU, s: (0.12 + R() * 0.1) * (i % 2 ? 1 : -1), cx: i < 6 ? 0 : (i % 2 ? -40 : 40), cz: i < 6 ? 16 : 40 });
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    anim.push({ fn: (t, dt, low) => { const n = low ? 4 : N; all.forEach((m) => { m.count = n; });
      for (let i = 0; i < n; i++) { const b = bots[i], an = b.a + t * b.s, [x, z] = W(b.cx + Math.cos(an) * b.r, b.cz + Math.sin(an) * b.r);
        e.set(0.06 * Math.sign(b.s), -an + (b.s > 0 ? Math.PI : 0), Math.sin(t * 1.7 + i) * 0.04); q.setFromEuler(e); mx.compose(v.set(x, 0.22 + Math.sin(t * 2.4 + i) * 0.07, z), q, one);
        for (const m of all) m.setMatrixAt(i, mx); }
      for (const m of all) m.instanceMatrix.needsUpdate = true; } });
  }

  /* ---------- lights along the walkways (Points: one draw call) ---------- */
  {
    const SQ = FL.SQUARE, AR = FL.ARCADE.rect, inSq = (lx, lz) => Math.hypot(lx - SQ.c[0], lz - SQ.c[1]) < SQ.r + 1.5 || (lx > AR[0] - 1.5 && lx < AR[2] + 1.5 && lz > AR[1] - 1.5 && lz < AR[3] + 1.5);
    const pts = []; for (let lz = -20; lz <= 64; lz += 6) [-4, 4].forEach((lx) => { if (!inSq(lx, lz)) pts.push(W(lx, lz)); }); for (let lx = -26; lx <= 26; lx += 6) [-14, 46].forEach((lz) => { if (!inSq(lx, lz)) pts.push(W(lx, lz)); });
    for (let i = 0; i < 12; i++) { const an = i / 12 * TAU + TAU / 24; pts.push(W(SQ.c[0] + Math.cos(an) * (SQ.r - 1.6), SQ.c[1] + Math.sin(an) * (SQ.r - 1.6))); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts.flatMap(([x, z]) => [x, 3.2, z]), 3));
    const halo = new THREE.Points(g, new THREE.PointsMaterial({ map: glowDot("rgba(255,255,255,1)", "rgba(89,224,255,.6)"), size: 3.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: "#bff6ff" }));
    halo.frustumCulled = false; root.add(halo); HALOS.push(halo);
    const p = new P(new Acc()), pole = M("#f4f8ff", { metalness: 0.3, roughness: 0.3 });
    pts.forEach(([x, z]) => { p.cyl(0.3, 0.12, pole, x, 0.06, z, 12).cyl(0.07, 3.1, pole, x, 1.6, z, 8, true, 0.05).ring(0.42, neon("#59e0ff", 1, 2.8), x, 3.15, z, Math.PI / 2, 0, 1.4).sphere(0.2, neon("#e9fdff", 1.2, 3.2), x, 3.2, z); colliders.push({ c: [x, z], r: 0.35 }); }); p.acc.build(root);
  }

  /* ---------- the game asks ---------- */
  let VIEW = 220, lastCull = -1;
  function update(t, dt, cam, low = false) {
    { const R0 = Math.max(80, (cam.far || 185) * 0.9); HORIZON.g.position.set(cam.position.x, -4, cam.position.z); HORIZON.g.scale.set(R0, R0 * 0.3, R0); }
    if (t - lastCull > 0.3) { lastCull = t; for (const a of areas) { const d = Math.hypot(cam.position.x - a.cx, cam.position.z - a.cz); a.g.visible = d < VIEW + 60; a.far.visible = d < Math.min(VIEW, 150); } }
    for (const A of anim) if (!A.a || A.a.g.visible) A.fn(t, dt, low);
    // automatic doors open when someone is near (the player, as host.me tells)
    const me = host.me && host.me(), sfx = (k, v) => { try { host.sfx && host.sfx(k, v); } catch (e) {} };
    for (const D of doors) { const near = me && Math.hypot(me.x - D.x, me.z - D.z) < 7; if (near && !D.was) sfx("doorSlide"); D.was = near; D.open += ((near ? 1 : 0) - D.open) * Math.min(1, dt * 6); D.fn(D.open); }
    // a whoosh when a flying car passes close by, and a chime when the hover bus stops near you
    if (me && !low) { const my = (me.y || 0) + 1.2; for (const P0 of carPos) { const d = Math.hypot(P0.x - me.x, P0.y - my, P0.z - me.z);
        if (d < 11 && !P0.near) { P0.near = true; if (t - (update.lastW || 0) > 0.3) { update.lastW = t; sfx("whoosh", Math.max(0.25, 1 - d / 11)); } } else if (d > 15) P0.near = false; }
      if (BUS.arrived && BUS.arrived !== update.lastBus) { update.lastBus = BUS.arrived; if (Math.hypot(BUS.x - me.x, BUS.z - me.z) < 30) sfx("busChime"); } }
  }
  function night(k) { for (const m of NIGHT) m.emissiveIntensity = m.userData.day + (m.userData.night - m.userData.day) * k;
    HORIZON.mBase.color.set("#ffffff").lerp(new THREE.Color("#2f57b8"), k * 0.85); HORIZON.mLit.opacity = Math.max(0, k * 1.2 - 0.15);
    for (const hm of HALOS) { hm.material.opacity = 0.18 + 0.82 * k; hm.material.size = 2 + 1.4 * k; }
    for (const m of ENVMATS) m.envMapIntensity = m.userData.env * (1 - 0.82 * k); }
  night(0.5);
  for (const D of doors) D.fn(0);
  const liftAt = (x, z) => lifts.find((L) => Math.hypot(x - L.x, z - L.z) < 1.8 && Math.abs(FL.futureGround(x, z) - L.y) < 1) || null;
  return { root, colliders, seats, update, night, setView: (v) => { VIEW = v; lastCull = -1; }, liftAt, lifts, ground: FL.futureGround, walk: FL.futureWalk, zoneAt: FL.futureZone, stations: FL.FW_STATIONS.map((s) => ({ ...s, wx: W(s.x, s.z)[0], wz: W(s.x, s.z)[1], color: STATION_COL[s.id], title: STATION_TITLE[s.id] })) };
}
