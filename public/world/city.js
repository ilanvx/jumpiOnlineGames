/*
  THE CITY: every district around the old Plaza / Beach / Park / Water Park, built in 3D.
  Layout (where things are) lives in /shared/city-layout.js (shared with the server); this file only builds and animates.

  Built to stay fast on phones:
  - static pieces are not separate meshes: they are painted into an accumulator (Acc) and merged into ONE mesh per
    material per district, so a whole district is a few dozen draw calls;
  - trees, lamps, bulbs and halos are InstancedMesh / Points (one draw call each per district);
  - every district is its own group and is hidden when it is further than VIEW from the camera (city.update).
  index.html calls: buildCity(layout, host) once, city.update(t, dt) every frame, city.night(k) from weatherTick,
  and asks city.walk(x,z) / city.ground(x,z) / city.deck(x,z) / city.zoneAt(x,z) / city.spotNear(x,z).
*/
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { buildBike } from "./bikes.js";
import { VEHICLES } from "../shared/vehicles.js";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, k) => a + (b - a) * k;
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// smooth value noise + fractal sum (deterministic, the same on every computer)
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash2(ix, iz), hash2(ix + 1, iz), ux), lerp(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), ux), uz); }
function fbm(x, z) { return vnoise(x, z) * 0.55 + vnoise(x * 2.1 + 5.2, z * 2.1 - 1.3) * 0.3 + vnoise(x * 4.3 - 2.7, z * 4.3 + 8.1) * 0.15; }

/* =====================================================================
   TERRAIN: Whisper Hills (west) and Pine Lake Camp (east) south of Hillside Road
   ===================================================================== */
export const HILL_Z0 = 160;
const FALLS = { x: -60, edge: 214.6, top: 7.2, pond: 0.05 };     // the cliff with the waterfall (and the secret cave behind it)
export function hillHeight(x, z) {
  if (z <= HILL_Z0) return 0;
  const t = smooth(HILL_Z0, 236, z), west = 1 - smooth(48, 72, x);
  let h = west * (t * t * 11 + t * (fbm(x * 0.035, z * 0.035) - 0.35) * 7 + 7 * Math.exp(-((x - 18) ** 2 + (z - 232) ** 2) / 260) * t);
  // the camp: a gentle valley
  h += (1 - west) * smooth(HILL_Z0, 176, z) * (0.6 + fbm(x * 0.05, z * 0.05) * 1.3);
  // the waterfall plateau: flat-ish top behind a steep cliff
  const band = smooth(-104, -94, x) * (1 - smooth(-28, -18, x));
  const plateau = smooth(FALLS.edge - 0.4, FALLS.edge + 2.2, z) * band;
  h = h * (1 - band * smooth(196, 212, z) * 0.9) + plateau * FALLS.top;
  // bowls for the lakes
  h -= 2.6 * Math.exp(-(((x + 60) / 9.5) ** 2 + ((z - 204) / 7.5) ** 2));
  h -= 2.2 * Math.exp(-(((x - 148) / 25) ** 2 + ((z - 206) / 17) ** 2) * 1.4);
  // far away (outside the play area) the land rises into big green hills that close the world
  h += smooth(246, 300, z) * (26 + fbm(x * 0.02, z * 0.02) * 18) + smooth(-176, -230, x) * 22 + smooth(192, 240, x) * smooth(150, 200, z) * 20;
  // the waterfall pond: a real bowl under its water (FALLS.pond), with a low lip around it so the water never leaks into the grass
  const pr = Math.sqrt(((x + 60) / 8) ** 2 + ((z - 204) / 6) ** 2);
  if (pr < 1) h = Math.min(h, FALLS.pond - 0.2 - 1.1 * (1 - pr));
  else if (pr < 1.4) h = Math.max(h, lerp(FALLS.pond + 0.12, h, smooth(1, 1.4, pr)));
  return Math.max(-2.4, h);
}
// how steep the ground is (rise per step) — too steep = you can't walk there
function hillSlope(x, z) { const e = 0.6; return Math.hypot(hillHeight(x + e, z) - hillHeight(x - e, z), hillHeight(x, z + e) - hillHeight(x, z - e)) / (2 * e); }

/* =====================================================================
   TEXTURES (painted once on canvases)
   ===================================================================== */
const TEX = new Map();
function canvasTex(key, w, h, draw, { repeat = true, srgb = true } = {}) {
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; TEX.set(key, t); return t;
}
const grain = (x, w, h, n, a, seed = 1, size = 2) => { const R = rng(seed); for (let i = 0; i < n; i++) { x.fillStyle = R() < 0.5 ? `rgba(0,0,0,${a * R()})` : `rgba(255,255,255,${a * R()})`; x.fillRect(R() * w, R() * h, size, size); } };
const shade = (hex, k) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return "#" + c.getHexString(); };
function rr(x, X, Y, W, H, r) { x.beginPath(); x.roundRect(X, Y, W, H, r); }

// asphalt (8 x 8 steps per tile)
const asphaltTex = () => canvasTex("asphalt", 512, 512, (x, w, h) => {
  x.fillStyle = "#4b5059"; x.fillRect(0, 0, w, h); grain(x, w, h, 9000, 0.22, 3, 2);
  const R = rng(9); for (let i = 0; i < 18; i++) { x.fillStyle = `rgba(${R() < 0.5 ? "30,32,38" : "90,95,104"},${0.08 + R() * 0.1})`; x.beginPath(); x.ellipse(R() * w, R() * h, 20 + R() * 60, 10 + R() * 40, R() * 3, 0, TAU); x.fill(); }
  x.strokeStyle = "rgba(25,27,32,.35)"; x.lineWidth = 1.5; for (let i = 0; i < 6; i++) { x.beginPath(); let px = R() * w, py = R() * h; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (R() - 0.5) * 40; py += (R() - 0.5) * 40; x.lineTo(px, py); } x.stroke(); }
});
// a road tile: 8 wide (u) × 8 long (v) with white edge lines and a yellow dashed centre line
const roadTex = () => canvasTex("road", 512, 512, (x, w, h) => {
  x.drawImage(asphaltTex().image, 0, 0);
  x.fillStyle = "rgba(245,245,240,.92)"; x.fillRect(w * 0.045, 0, 10, h); x.fillRect(w * 0.955 - 10, 0, 10, h);
  x.fillStyle = "#f2c230"; x.fillRect(w / 2 - 9, 0, 7, h * 0.5); x.fillRect(w / 2 + 2, 0, 7, h * 0.5);
  grain(x, w, h, 1500, 0.15, 5, 2);
});
const sidewalkTex = () => canvasTex("sidewalk", 256, 256, (x, w, h) => {
  const R = rng(4); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 205 + R() * 22; x.fillStyle = `rgb(${v},${v - 3},${v - 9})`; x.fillRect(i * 64, j * 64, 64, 64); }
  x.strokeStyle = "rgba(120,110,100,.45)"; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); }
  grain(x, w, h, 2500, 0.12, 6, 2);
});
const paversTex = () => canvasTex("pavers", 512, 512, (x, w, h) => {   // herringbone-ish warm pavers (pedestrian streets)
  x.fillStyle = "#c9a984"; x.fillRect(0, 0, w, h); const R = rng(8), cols = ["#d8b892", "#c79f78", "#e0c4a0", "#b98f6a", "#d2ae86"];
  for (let j = 0; j < 16; j++) for (let i = 0; i < 8; i++) { const off = j % 2 ? 32 : 0; x.fillStyle = cols[Math.floor(R() * cols.length)]; rr(x, i * 64 + off + 2, j * 32 + 2, 60, 28, 4); x.fill(); x.fillStyle = cols[Math.floor(R() * cols.length)]; rr(x, i * 64 + off - 62, j * 32 + 2, 60, 28, 4); x.fill(); }
  grain(x, w, h, 4000, 0.12, 9, 2);
});
const concreteTex = () => canvasTex("concrete", 256, 256, (x, w, h) => { x.fillStyle = "#b9bcc2"; x.fillRect(0, 0, w, h); grain(x, w, h, 5000, 0.14, 11, 2); x.strokeStyle = "rgba(90,95,105,.4)"; x.lineWidth = 2; x.strokeRect(1, 1, w - 2, h - 2); });
const planksTex = () => canvasTex("planks", 256, 256, (x, w, h) => {
  const R = rng(12); for (let i = 0; i < 8; i++) { x.fillStyle = ["#b07a48", "#a26d3e", "#bb8653", "#9a663a"][i % 4]; x.fillRect(0, i * 32, w, 32); x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(0, i * 32, w, 3);
    for (let k = 0; k < 3; k++) { x.fillStyle = "rgba(60,35,15,.25)"; x.fillRect(R() * w, i * 32 + 8 + R() * 16, 30 + R() * 40, 1.5); } x.fillStyle = "#5a3a1e"; x.fillRect((i * 97) % w, i * 32 + 12, 4, 4); x.fillRect(((i * 97) % w) + 6, i * 32 + 20, 4, 4); }
  grain(x, w, h, 1500, 0.1, 13, 2);
});
const dirtTex = () => canvasTex("dirt", 256, 256, (x, w, h) => { x.fillStyle = "#b8916a"; x.fillRect(0, 0, w, h); grain(x, w, h, 6000, 0.22, 14, 3); const R = rng(15); for (let i = 0; i < 40; i++) { x.fillStyle = "rgba(120,95,70,.5)"; x.beginPath(); x.arc(R() * w, R() * h, 2 + R() * 3, 0, TAU); x.fill(); } });
const roofTileTex = (col) => canvasTex("roof" + col, 256, 256, (x, w, h) => {
  x.fillStyle = shade(col, -0.12); x.fillRect(0, 0, w, h);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 9; i++) { const ox = (j % 2) * 16; x.fillStyle = shade(col, (hash2(i, j) - 0.5) * 0.1); rr(x, i * 32 - ox, j * 32 + 2, 30, 30, [0, 0, 12, 12]); x.fill(); x.fillStyle = "rgba(0,0,0,.18)"; x.fillRect(i * 32 - ox, j * 32 + 26, 30, 5); }
});
const gravelRoofTex = () => canvasTex("gravelroof", 256, 256, (x, w, h) => { x.fillStyle = "#8e9299"; x.fillRect(0, 0, w, h); grain(x, w, h, 8000, 0.25, 16, 2); });
const metalRibTex = (col) => canvasTex("metal" + col, 256, 256, (x, w, h) => {
  x.fillStyle = col; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 16; i++) { const g = x.createLinearGradient(i * 16, 0, i * 16 + 16, 0); g.addColorStop(0, "rgba(255,255,255,.22)"); g.addColorStop(0.5, "rgba(0,0,0,.0)"); g.addColorStop(1, "rgba(0,0,0,.25)"); x.fillStyle = g; x.fillRect(i * 16, 0, 16, h); }
  grain(x, w, h, 1200, 0.08, 17, 2);
});
const stripeTex = (a, b, n = 8) => canvasTex("stripe" + a + b + n, 256, 64, (x, w, h) => { for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect((i * w) / n, 0, w / n + 1, h); } }, { repeat: true });
function textCanvas(key, text, { bg = "#fff", fg = "#1d2b4f", w = 512, h = 128, size = 80, font = "Lilita One", stroke = null, radius = 18, border = null, glow = null } = {}) {
  return canvasTex("txt:" + key, w, h, (x) => {
    x.clearRect(0, 0, w, h); if (bg) { x.fillStyle = bg; rr(x, 3, 3, w - 6, h - 6, radius); x.fill(); }
    if (border) { x.lineWidth = 8; x.strokeStyle = border; rr(x, 7, 7, w - 14, h - 14, radius); x.stroke(); }
    let s = size; x.font = `${s}px "${font}", "Arial Rounded MT Bold", sans-serif`; while (x.measureText(text).width > w - 40 && s > 20) { s -= 4; x.font = `${s}px "${font}", "Arial Rounded MT Bold", sans-serif`; }
    x.textAlign = "center"; x.textBaseline = "middle";
    if (glow) { x.shadowColor = glow; x.shadowBlur = 22; }
    if (stroke) { x.lineWidth = Math.max(6, s / 9); x.strokeStyle = stroke; x.strokeText(text, w / 2, h / 2 + s * 0.06); }
    x.fillStyle = fg; x.fillText(text, w / 2, h / 2 + s * 0.06);
  }, { repeat: false });
}

/* ---------- building faces: a 4-bay × 4-floor tile so lit windows at night look random ---------- */
const BAY = 3, FLOOR = 3.2, GROUND = 4;
const FACADE_STYLES = {};
function windowPaint(x, X, Y, W, H, { frame = "#f4f1ea", glass = ["#3f6f8f", "#9ed4ef"], sill = true, shutter = null, arch = false } = {}) {
  if (shutter) { x.fillStyle = shutter; x.fillRect(X - W * 0.42, Y, W * 0.38, H); x.fillRect(X + W * 1.04, Y, W * 0.38, H); x.fillStyle = "rgba(0,0,0,.18)"; for (let k = 1; k < 6; k++) { x.fillRect(X - W * 0.42, Y + (k * H) / 6, W * 0.38, 2); x.fillRect(X + W * 1.04, Y + (k * H) / 6, W * 0.38, 2); } }
  x.fillStyle = "rgba(0,0,0,.22)"; x.fillRect(X - 3, Y - 3, W + 10, H + 10);
  x.fillStyle = frame; if (arch) { x.beginPath(); x.moveTo(X - 6, Y + H + 6); x.lineTo(X - 6, Y + W / 2); x.arc(X + W / 2, Y + W / 2, W / 2 + 6, Math.PI, 0); x.lineTo(X + W + 6, Y + H + 6); x.fill(); } else x.fillRect(X - 6, Y - 6, W + 12, H + 12);
  const g = x.createLinearGradient(X, Y + H, X + W, Y); g.addColorStop(0, glass[0]); g.addColorStop(0.55, shade(glass[0], 0.08)); g.addColorStop(0.62, glass[1]); g.addColorStop(1, shade(glass[1], 0.06)); x.fillStyle = g;
  if (arch) { x.beginPath(); x.moveTo(X, Y + H); x.lineTo(X, Y + W / 2); x.arc(X + W / 2, Y + W / 2, W / 2, Math.PI, 0); x.lineTo(X + W, Y + H); x.fill(); } else x.fillRect(X, Y, W, H);
  x.fillStyle = frame; x.fillRect(X + W / 2 - 3, Y, 6, H); x.fillRect(X, Y + H * 0.45, W, 5);
  if (sill) { x.fillStyle = shade(frame, -0.1); x.fillRect(X - 10, Y + H + 6, W + 20, 8); x.fillStyle = "rgba(0,0,0,.2)"; x.fillRect(X - 10, Y + H + 14, W + 20, 4); }
}
// returns {map, emissiveMap} for a wall style; a tile = 4 bays wide × 4 floors high
function facadeTex(style, wall, opt = {}) {
  const key = "fac:" + style + wall + JSON.stringify(opt);
  if (FACADE_STYLES[key]) return FACADE_STYLES[key];
  const S = 512, cw = S / 4, ch = S / 4, R = rng(style.length * 31 + wall.length);
  const lit = []; for (let i = 0; i < 16; i++) lit.push(R() < (opt.litRate ?? 0.55));
  const map = canvasTex(key, S, S, (x) => {
    x.fillStyle = wall; x.fillRect(0, 0, S, S);
    if (style === "brick") {
      for (let j = 0; j < 64; j++) for (let i = 0; i < 17; i++) { const ox = (j % 2) * 16; x.fillStyle = shade(wall, (hash2(i, j * 3) - 0.5) * 0.12); x.fillRect(i * 32 - ox + 1, j * 8 + 1, 30, 6); }
      x.fillStyle = "rgba(255,255,255,.08)"; for (let j = 0; j < 64; j++) x.fillRect(0, j * 8, S, 1);
    } else if (style === "siding") {
      for (let j = 0; j < 32; j++) { x.fillStyle = shade(wall, (j % 2 ? -0.02 : 0.02)); x.fillRect(0, j * 16, S, 16); x.fillStyle = "rgba(0,0,0,.16)"; x.fillRect(0, j * 16 + 13, S, 3); }
    } else if (style === "concrete") {
      grain(x, S, S, 9000, 0.12, 21, 2); x.strokeStyle = "rgba(0,0,0,.15)"; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * ch); x.lineTo(S, i * ch); x.stroke(); }
    } else if (style === "metal") {
      for (let i = 0; i < 32; i++) { const g = x.createLinearGradient(i * 16, 0, i * 16 + 16, 0); g.addColorStop(0, "rgba(255,255,255,.2)"); g.addColorStop(1, "rgba(0,0,0,.22)"); x.fillStyle = g; x.fillRect(i * 16, 0, 16, S); }
    } else if (style === "modern") {
      x.fillStyle = shade(wall, -0.05); x.fillRect(0, 0, S, S);
    } else grain(x, S, S, 7000, 0.07, 22, 2);   // plaster
    for (let fy = 0; fy < 4; fy++) for (let bx = 0; bx < 4; bx++) {
      const X0 = bx * cw, Y0 = fy * ch;
      if (style === "modern") {
        const g = x.createLinearGradient(X0, Y0 + ch, X0 + cw, Y0); g.addColorStop(0, opt.glass || "#2f5d7c"); g.addColorStop(0.6, shade(opt.glass || "#2f5d7c", 0.12)); g.addColorStop(0.7, "#bfe6fa"); g.addColorStop(1, shade(opt.glass || "#2f5d7c", 0.18));
        x.fillStyle = g; x.fillRect(X0 + 4, Y0 + 18, cw - 8, ch - 22); x.fillStyle = wall; x.fillRect(X0, Y0, cw, 18); x.fillRect(X0, Y0, 4, ch); x.fillRect(X0 + cw / 2 - 2, Y0 + 18, 4, ch - 22);
      } else if (style === "metal") {
        if (fy === 0 && bx % 2 === 0) { x.fillStyle = "#2c3e52"; x.fillRect(X0 + 20, Y0 + 30, cw - 40, 22); x.fillStyle = "#9cc7e2"; x.fillRect(X0 + 24, Y0 + 33, cw - 48, 6); }
      } else if (style === "concrete") {
        x.fillStyle = "#334b5e"; x.fillRect(X0 + 8, Y0 + 40, cw - 16, 40); x.fillStyle = "rgba(190,225,245,.55)"; x.fillRect(X0 + 10, Y0 + 42, cw - 20, 10); x.fillStyle = "#e3e6ea"; x.fillRect(X0 + 4, Y0 + 82, cw - 8, 6);
      } else {
        windowPaint(x, X0 + cw * 0.3, Y0 + ch * 0.22, cw * 0.4, ch * 0.52, { frame: opt.frame || "#f4f1ea", shutter: opt.shutter, arch: opt.arch && fy === 0 });
        if (opt.balcony && fy < 3 && bx % 2 === 1) { x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(X0 + 10, Y0 + ch * 0.82, cw - 20, 6); x.strokeStyle = opt.frame || "#f4f1ea"; x.lineWidth = 3; for (let k = 0; k < 9; k++) { x.beginPath(); x.moveTo(X0 + 12 + k * ((cw - 24) / 8), Y0 + ch * 0.66); x.lineTo(X0 + 12 + k * ((cw - 24) / 8), Y0 + ch * 0.82); x.stroke(); } x.fillStyle = opt.frame || "#f4f1ea"; x.fillRect(X0 + 10, Y0 + ch * 0.64, cw - 20, 5); }
      }
      if (opt.trim) { x.fillStyle = opt.trim; x.fillRect(X0, Y0 + ch - 8, cw, 8); }
    }
  });
  const emissiveMap = canvasTex(key + ":e", S / 2, S / 2, (x) => {
    x.fillStyle = "#000"; x.fillRect(0, 0, S / 2, S / 2); const c2 = cw / 2, h2 = ch / 2;
    for (let fy = 0; fy < 4; fy++) for (let bx = 0; bx < 4; bx++) {
      const on = lit[fy * 4 + bx]; if (style === "metal" || !on) continue;
      const warm = ["#ffd38a", "#ffe6b5", "#fff1d0", "#ffc670", "#bfe3ff"][(fy * 7 + bx * 3) % 5];
      x.fillStyle = warm;
      if (style === "modern") x.fillRect(bx * c2 + 2, fy * h2 + 9, c2 - 4, h2 - 11);
      else if (style === "concrete") x.fillRect(bx * c2 + 4, fy * h2 + 20, c2 - 8, 20);
      else x.fillRect(bx * c2 + c2 * 0.3, fy * h2 + h2 * 0.22, c2 * 0.4, h2 * 0.52);
    }
  }, { repeat: true });
  return (FACADE_STYLES[key] = { map, emissiveMap });
}
// shop fronts: one tile = 8 steps wide × GROUND high; big windows, a door in the middle, goods in the window
function shopfrontTex(key, { wall = "#ffffff", frame = "#2b2f3a", goods = ["#ff5fa8", "#ffd23a", "#1fb6ff"], kind = "boxes" } = {}) {
  return canvasTex("shop:" + key, 512, 256, (x, w, h) => {
    x.fillStyle = wall; x.fillRect(0, 0, w, h); grain(x, w, h, 2500, 0.06, 31, 2);
    const glassG = (X, Y, W, H) => { const g = x.createLinearGradient(X, Y + H, X + W, Y); g.addColorStop(0, "#21384a"); g.addColorStop(0.5, "#35576e"); g.addColorStop(0.62, "#a9d8ef"); g.addColorStop(1, "#4f7c96"); return g; };
    // two display windows and a door
    [[24, 196], [w - 220, 196]].forEach(([X, W]) => {
      x.fillStyle = frame; x.fillRect(X - 8, 40, W + 16, 196); x.fillStyle = glassG(X, 48, W, 170); x.fillRect(X, 48, W, 170);
      const R = rng(key.length + X);
      for (let k = 0; k < 4; k++) {   // goods on display
        const gx = X + 18 + k * (W - 36) / 4, col = goods[k % goods.length];
        x.fillStyle = col;
        if (kind === "clothes") { x.beginPath(); x.moveTo(gx + 6, 120); x.lineTo(gx + 34, 120); x.lineTo(gx + 40, 136); x.lineTo(gx + 32, 140); x.lineTo(gx + 32, 196); x.lineTo(gx + 8, 196); x.lineTo(gx + 8, 140); x.lineTo(gx, 136); x.closePath(); x.fill(); x.fillStyle = "#e6e9ef"; x.fillRect(gx + 18, 100, 4, 20); }
        else if (kind === "food") { x.beginPath(); x.ellipse(gx + 20, 170, 20, 12, 0, 0, TAU); x.fill(); x.fillStyle = "#fff"; x.fillRect(gx - 4, 182, 48, 6); }
        else if (kind === "toys") { x.beginPath(); x.arc(gx + 20, 160 - R() * 30, 16, 0, TAU); x.fill(); x.fillStyle = shade(col, -0.2); x.fillRect(gx + 4, 176, 32, 20); }
        else if (kind === "plants") { x.fillStyle = "#3f9a45"; x.beginPath(); x.arc(gx + 20, 150, 22, 0, TAU); x.fill(); x.fillStyle = col; for (let q = 0; q < 5; q++) { x.beginPath(); x.arc(gx + 8 + q * 6, 140 + (q % 2) * 12, 5, 0, TAU); x.fill(); } x.fillStyle = "#b5653a"; x.fillRect(gx + 8, 168, 24, 28); }
        else { x.fillRect(gx, 150 - (k % 2) * 20, 36, 46 + (k % 2) * 20); x.fillStyle = "rgba(255,255,255,.35)"; x.fillRect(gx + 4, 154 - (k % 2) * 20, 8, 30); }
      }
      x.fillStyle = "rgba(255,255,255,.18)"; x.beginPath(); x.moveTo(X + W * 0.15, 48); x.lineTo(X + W * 0.35, 48); x.lineTo(X + W * 0.05, 218); x.lineTo(X, 218); x.lineTo(X, 110); x.fill();
    });
    // door
    x.fillStyle = frame; x.fillRect(w / 2 - 44, 52, 88, 204); x.fillStyle = glassG(w / 2 - 36, 60, 72, 196); x.fillRect(w / 2 - 36, 60, 72, 196);
    x.fillStyle = "#d9b45a"; x.fillRect(w / 2 + 22, 150, 6, 30);
    x.fillStyle = shade(wall, -0.25); x.fillRect(0, h - 22, w, 22);   // plinth
  });
}

/* =====================================================================
   MATERIALS (cached: the same look = the same material, so merging works)
   ===================================================================== */
const MATS = new Map();
export function M(color, o = {}) {
  const key = color + JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v));
  if (MATS.has(key)) return MATS.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
  // plain colours (no texture) share one material per finish when painted into an Acc: the colour goes into the vertices,
  // so a whole district of differently coloured boxes is ONE draw call instead of one per colour
  if (!o.map && !o.emissiveMap && !o.vertexColors) m.userData.pal = { k: JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v)), o, c: new THREE.Color(color) };
  MATS.set(key, m); return m;
}
function palMat(k, o) { const key = "pal" + k; if (MATS.has(key)) return MATS.get(key); const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, metalness: 0, ...o, vertexColors: true }); MATS.set(key, m); return m; }
const nightMats = [];   // materials whose emissive glows at night (windows, neon)
function facadeMat(style, wall, opt) {
  const { map, emissiveMap } = facadeTex(style, wall, opt);
  const key = "facade" + map.uuid;
  if (MATS.has(key)) return MATS.get(key);
  const m = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: new THREE.Color("#ffd9a0"), emissiveIntensity: 0, roughness: style === "modern" ? 0.35 : 0.88, metalness: style === "modern" ? 0.15 : 0 });
  m.userData.night = 1.15; nightMats.push(m); MATS.set(key, m); return m;
}
function glowMat(color, power = 1.4) {   // neon / signs: a little glow by day, bright at night
  const key = "glow" + color + power; if (MATS.has(key)) return MATS.get(key);
  const m = new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.35, roughness: 0.4 });
  m.userData.day = 0.35; m.userData.night = power; nightMats.push(m); MATS.set(key, m); return m;
}
function texMat(tex, o = {}) { const key = "tex" + tex.uuid + JSON.stringify(o); if (MATS.has(key)) return MATS.get(key); const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, ...o }); MATS.set(key, m); return m; }
function signMat(key, text, opt) { const k = "sign" + key; if (MATS.has(k)) return MATS.get(k);
  const m = new THREE.MeshStandardMaterial({ map: textCanvas(key, text, opt), roughness: 0.6, emissive: new THREE.Color("#ffffff"), emissiveMap: textCanvas(key, text, opt), emissiveIntensity: 0.05, transparent: !opt?.bg });
  m.userData.day = 0.05; m.userData.night = 0.75; nightMats.push(m); MATS.set(k, m); return m; }

/* =====================================================================
   THE ACCUMULATOR: paint pieces into it, then build() makes one mesh per material
   ===================================================================== */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const GEO = new Map();
function unitGeo(key, make) { if (!GEO.has(key)) GEO.set(key, make()); return GEO.get(key); }
const boxG = () => unitGeo("box", () => new THREE.BoxGeometry(1, 1, 1));
const cylG = (rt, rb, seg) => unitGeo(`cyl${rt.toFixed(3)},${rb.toFixed(3)},${seg}`, () => new THREE.CylinderGeometry(rt, rb, 1, seg));
const sphG = (ws, hs) => unitGeo(`sph${ws},${hs}`, () => new THREE.SphereGeometry(1, ws, hs));
const coneG = (seg) => unitGeo("cone" + seg, () => new THREE.ConeGeometry(1, 1, seg));
const planeG = () => unitGeo("plane", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
function mat4(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) { _e.set(rx, ry, rz, "YXZ"); _q.setFromEuler(_e); return new THREE.Matrix4().compose(_v.set(x, y, z), _q.clone(), _s.set(sx, sy, sz)); }

class Acc {
  constructor() { this.parts = new Map(); }
  add(geo, mat, m4, cast = true) {
    let g = geo.clone(); g.applyMatrix4(m4);
    const pal = mat.userData && mat.userData.pal; if (pal) mat = palMat(pal.k, pal.o);
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv" && !(k === "color" && mat.vertexColors && !pal)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (g.index) g = g.toNonIndexed();
    g.clearGroups();
    if (pal) { const n = g.attributes.position.count, a = new Float32Array(n * 3), { r, g: gg, b } = pal.c; for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; } g.setAttribute("color", new THREE.Float32BufferAttribute(a, 3)); }
    const key = mat.uuid + (cast ? "c" : "n");
    let p = this.parts.get(key); if (!p) this.parts.set(key, (p = { mat, cast, geos: [], verts: 0 }));
    p.geos.push(g); p.verts += g.attributes.position.count;
  }
  build(group) {
    for (const p of this.parts.values()) {
      // split huge sets so no single mesh is too big for old phones
      for (let i = 0; i < p.geos.length; ) {
        const batch = []; let n = 0; while (i < p.geos.length && (n < 180000 || !batch.length)) { batch.push(p.geos[i]); n += p.geos[i].attributes.position.count; i++; }
        const g = mergeGeometries(batch, false); if (!g) continue;
        g.computeBoundingSphere(); const ms = new THREE.Mesh(g, p.mat); ms.castShadow = p.cast; ms.receiveShadow = true; ms.matrixAutoUpdate = false; group.add(ms);
      }
    }
    this.parts.clear();
  }
}
// paint a ready-made object (e.g. a bike from bikes.js) into an accumulator, so it costs no extra draw calls
function paintObject(acc, obj, x, y, z, ry = 0) {
  obj.position.set(x, y, z); obj.rotation.set(0, ry, 0); obj.updateMatrixWorld(true);
  obj.traverse((o) => { if (o.isMesh && o.visible && !(o.material && o.material.blending === THREE.AdditiveBlending)) acc.add(o.geometry, o.material, o.matrixWorld.clone(), true); });
}
// a painter: pieces relative to a frame (position + turn) inside an accumulator
class Painter {
  constructor(acc, base = new THREE.Matrix4()) { this.acc = acc; this.base = base; }
  at(x, z, ry = 0, y = 0) { return new Painter(this.acc, this.base.clone().multiply(mat4(x, y, z, ry))); }
  put(geo, mat, x, y, z, ry, sx, sy, sz, rx, rz, cast = true) { this.acc.add(geo, mat, this.base.clone().multiply(mat4(x, y, z, ry, sx, sy, sz, rx, rz)), cast); return this; }
  box(w, h, d, mat, x, y, z, ry = 0, o = {}) { return this.put(boxG(), mat, x, y, z, ry, w, h, d, o.rx || 0, o.rz || 0, o.cast !== false); }
  cyl(rt, rb, h, mat, x, y, z, seg = 12, o = {}) { const r = Math.max(rt, rb); return this.put(cylG(rt / r, rb / r, seg), mat, x, y, z, o.ry || 0, r, h, r, o.rx || 0, o.rz || 0, o.cast !== false); }
  sphere(r, mat, x, y, z, sx = 1, sy = 1, sz = 1, seg = [14, 10]) { return this.put(sphG(seg[0], seg[1]), mat, x, y, z, 0, r * sx, r * sy, r * sz); }
  cone(r, h, mat, x, y, z, seg = 10, o = {}) { return this.put(coneG(seg), mat, x, y, z, o.ry || 0, r, h, r, o.rx || 0, o.rz || 0, o.cast !== false); }
  plane(w, d, mat, x, y, z, ry = 0) { return this.put(planeG(), mat, x, y, z, ry, w, 1, d, 0, 0, false); }
  geo(g, mat, x = 0, y = 0, z = 0, ry = 0, cast = true) { return this.put(g, mat, x, y, z, ry, 1, 1, 1, 0, 0, cast); }
  // something you can't walk through: a box (local corners) or a round post, kept in world space for the game
  colBox(x0, z0, x1, z1) { const a = new THREE.Vector3(x0, 0, z0).applyMatrix4(this.base), b = new THREE.Vector3(x1, 0, z1).applyMatrix4(this.base);
    COLS.push({ box: [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)] }); return this; }
  colCircle(x, z, r) { const a = new THREE.Vector3(x, 0, z).applyMatrix4(this.base); COLS.push({ c: [a.x, a.z], r }); return this; }
  world(x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(this.base); }
}
let COLS = [];   // filled while building; buildCity hands them to the game
// a flat strip on the ground with UVs in world steps / tile (for roads, paths, docks)
function stripGeo(w, d, tileU, tileV, y = 0) {
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tileU), uv.getY(i) * (d / tileV));
  g.translate(0, y, 0); return g;
}
// building walls with UVs in bays / floors (so one facade texture fits every building)
function wallsGeo(w, h, d, y0, tileW, tileH) {
  const pos = [], nor = [], uv = [], idx = [];
  const quad = (ax, az, bx, bz, nx, nz, len) => { const b = pos.length / 3;
    pos.push(ax, y0, az, bx, y0, bz, bx, y0 + h, bz, ax, y0 + h, az); for (let i = 0; i < 4; i++) nor.push(nx, 0, nz);
    uv.push(0, 0, len / tileW, 0, len / tileW, h / tileH, 0, h / tileH); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  const X = w / 2, Z = d / 2;
  quad(-X, Z, X, Z, 0, 1, w); quad(X, -Z, -X, -Z, 0, -1, w); quad(X, Z, X, -Z, 1, 0, d); quad(-X, -Z, -X, Z, -1, 0, d);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}
// one wall face (front only, +z), used for shop fronts
function faceGeo(w, h, tileW, tileH, y0 = 0) { const g = new THREE.PlaneGeometry(w, h); g.translate(0, y0 + h / 2, 0); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tileW), uv.getY(i) * (h / tileH)); return g; }
// a gable roof (ridge along x): the two sloped sides (tile UVs) and the two triangle ends (wall)
function gableGeo(w, d, rise, over = 0.45) {
  const X = w / 2 + over, Z = d / 2 + over, slope = Math.hypot(Z, rise * Z / (d / 2));
  const top = rise * Z / (d / 2);   // the ridge height including the overhang slope
  const make = (pos, uv, idx) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  const sp = [], su = [], si = [];
  const quad = (a, b, c, e) => { const s0 = sp.length / 3; sp.push(...a, ...b, ...c, ...e); su.push(0, 0, (2 * X) / 2, 0, (2 * X) / 2, slope / 2, 0, slope / 2); si.push(s0, s0 + 1, s0 + 2, s0, s0 + 2, s0 + 3); };
  const y0 = -over * (rise / (d / 2));
  quad([-X, y0, Z], [X, y0, Z], [X, rise, 0], [-X, rise, 0]);
  quad([X, y0, -Z], [-X, y0, -Z], [-X, rise, 0], [X, rise, 0]);
  // the slab thickness under the eaves (so the roof isn't paper thin)
  const ep = [], eu = [], ei = [];
  const tri = (a, b, c) => { const s0 = ep.length / 3; ep.push(...a, ...b, ...c); eu.push(0, 0, 1, 0, 0.5, 1); ei.push(s0, s0 + 1, s0 + 2); };
  tri([-w / 2, 0, d / 2], [-w / 2, rise, 0], [-w / 2, 0, -d / 2]); tri([w / 2, 0, -d / 2], [w / 2, rise, 0], [w / 2, 0, d / 2]);
  return { slopes: make(sp, su, si), ends: make(ep, eu, ei), top };
}

/* =====================================================================
   THE KIT: buildings, houses, cars and street things, painted into an accumulator
   ===================================================================== */
const STONE = () => M("#c9c2b4"), WHITE = () => M("#f4f1ea"), DARK = () => M("#2b2f3a", { roughness: 0.6 }), GLASS = () => M("#5f8fae", { roughness: 0.15, metalness: 0.3 });
// a building on a w×d footprint centred in the frame, front = +z. Returns its total height.
function building(p, o) {
  const { w, d, floors = 2, style = "plaster", wall = "#f2e3c6", opt = {}, roof = "flat", roofCol = "#b5533a", shop = null, sign = null, awning = null, trim = "#f4f1ea", base = 0 } = o;
  const gh = shop ? GROUND : 0, H = base + gh + floors * FLOOR;
  if (base) p.box(w + 0.3, base, d + 0.3, STONE(), 0, base / 2, 0);
  if (shop) {
    p.box(w, gh, d, M(shade(wall, -0.03)), 0, base + gh / 2, 0);
    p.geo(faceGeo(w - 0.2, gh, 8, gh, base), texMat(shopfrontTex(shop.key, { wall: shop.wall || "#ffffff", frame: shop.frame || "#2b2f3a", goods: shop.goods, kind: shop.kind }), { roughness: 0.5 }), 0, 0, d / 2 + 0.02, 0, false);
    p.box(w + 0.35, 0.32, d + 0.35, M(trim), 0, base + gh, 0);
  }
  if (floors > 0) p.geo(wallsGeo(w, floors * FLOOR, d, base + gh, BAY * 4, FLOOR * 4), facadeMat(style, wall, opt));
  if (roof === "flat") {
    p.geo(stripGeo(w, d, 6, 6, H + 0.01), texMat(gravelRoofTex()), 0, 0, 0, 0, false);
    const pc = M(trim), t = 0.3, ph = 0.7;
    p.box(w + 0.3, ph, t, pc, 0, H + ph / 2, d / 2); p.box(w + 0.3, ph, t, pc, 0, H + ph / 2, -d / 2);
    p.box(t, ph, d, pc, w / 2, H + ph / 2, 0); p.box(t, ph, d, pc, -w / 2, H + ph / 2, 0);
    const R = rng(Math.round(w * 13 + d * 7 + floors));
    if (o.roofStuff !== false) { const n = 1 + Math.floor(R() * 3); for (let i = 0; i < n; i++) { const ax = (R() - 0.5) * (w - 3), az = (R() - 0.5) * (d - 3); p.box(1.4, 0.9, 1.0, M("#c8ccd2", { metalness: 0.3, roughness: 0.5 }), ax, H + 0.45, az); p.cyl(0.35, 0.35, 0.12, DARK(), ax, H + 0.96, az, 10); }
      if (R() < 0.35 && w > 9) { p.cyl(1.0, 1.0, 1.8, M("#a7744a"), w / 2 - 2, H + 1.9, -d / 2 + 2, 12); p.cone(1.15, 0.7, M("#5a3a22"), w / 2 - 2, H + 3.15, -d / 2 + 2, 12); [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].forEach(([a, b]) => p.cyl(0.07, 0.07, 1.0, DARK(), w / 2 - 2 + a, H + 0.5, -d / 2 + 2 + b, 6)); } }
  } else if (roof === "gable" || roof === "gableZ") {
    const along = roof === "gable", rise = Math.min(3.2, (along ? d : w) * 0.32), g = gableGeo(along ? w : d, along ? d : w, rise);
    p.geo(g.slopes, texMat(roofTileTex(roofCol)), 0, H, 0, along ? 0 : Math.PI / 2); p.geo(g.ends, facadeMat(style, wall, opt), 0, H, 0, along ? 0 : Math.PI / 2);
    p.box(along ? w + 0.95 : 0.22, 0.2, along ? 0.22 : d + 0.95, M(shade(roofCol, -0.15)), 0, H + rise + 0.02, 0);
  }
  if (sign) {
    const sw = Math.min(w - 1, sign.w || w * 0.72), sh = sign.h || 1.1, sy = base + gh + (gh ? 0.62 : -1.2);
    p.box(sw + 0.3, sh + 0.3, 0.16, M(sign.frame || "#2b2f3a"), 0, sy, d / 2 + 0.2);
    p.geo(new THREE.PlaneGeometry(sw, sh), signMat(sign.key || sign.text, sign.text, { bg: sign.bg || "#ffffff", fg: sign.fg || "#1d2b4f", w: 1024, h: Math.round(1024 * sh / sw), size: Math.round(1024 * sh / sw * 0.62), stroke: sign.stroke }), 0, sy, d / 2 + 0.29, 0, false);
  }
  if (awning) {
    const aw = Math.min(w - 0.6, awning.w || w * 0.8), ad = 1.6, ay = base + gh - 0.55;
    p.box(aw, 0.07, ad, texMat(stripeTex(awning.a, awning.b, Math.max(4, Math.round(aw)))), 0, ay, d / 2 + ad / 2, 0, { rx: 0.38 });
    p.box(aw, 0.32, 0.05, texMat(stripeTex(awning.a, awning.b, Math.max(4, Math.round(aw)))), 0, ay - 0.42, d / 2 + ad * 0.95);
  }
  p.colBox(-w / 2 - 0.1, -d / 2 - 0.1, w / 2 + 0.1, d / 2 + 0.1); COLS[COLS.length - 1].tall = H;
  return H;
}
// a family house: foundation, two floors, gable roof, porch with steps, chimney
function house(p, o) {
  const { w = 9, d = 7.5, floors = 2, style = "siding", wall = "#f6e7c8", roofCol = "#b5533a", door = "#c8483d", shutter = null, chimney = true, porch = true, garage = false } = o;
  const base = 0.45, H = base + floors * FLOOR;
  p.box(w + 0.25, base, d + 0.25, STONE(), 0, base / 2, 0);
  p.geo(wallsGeo(w, floors * FLOOR, d, base, BAY * 4, FLOOR * 4), facadeMat(style, wall, { shutter, frame: "#ffffff", litRate: 0.5 }));
  const rise = Math.min(3, d * 0.36), g = gableGeo(w, d, rise, 0.55);
  p.geo(g.slopes, texMat(roofTileTex(roofCol)), 0, H, 0); p.geo(g.ends, facadeMat(style, wall, { shutter, frame: "#ffffff" }), 0, H, 0);
  p.box(w + 1.2, 0.22, 0.24, M(shade(roofCol, -0.18)), 0, H + rise + 0.02, 0);
  if (chimney) p.box(0.8, 2.2, 0.8, M("#a5523f"), w * 0.28, H + rise * 0.6 + 0.6, -d * 0.2);
  // front door with a frame, steps and a little porch roof
  p.box(1.3, 2.3, 0.12, M(door), 0, base + 1.15, d / 2 + 0.03); p.box(1.6, 2.55, 0.08, WHITE(), 0, base + 1.25, d / 2 + 0.01);
  p.sphere(0.06, M("#d9b45a", { metalness: 0.6, roughness: 0.3 }), 0.42, base + 1.15, d / 2 + 0.12);
  if (porch) { p.box(3.2, 0.18, 1.8, M("#d8d2c4"), 0, base - 0.09, d / 2 + 0.9); p.box(2.6, 0.16, 0.5, STONE(), 0, 0.08, d / 2 + 2.05);
    p.box(3.4, 0.14, 1.9, M(shade(roofCol, -0.05)), 0, base + 2.9, d / 2 + 0.85, 0, { rx: -0.18 }); [-1.4, 1.4].forEach((x) => p.box(0.16, 2.8, 0.16, WHITE(), x, base + 1.4, d / 2 + 1.65)); }
  if (garage) { p.box(4.2, 3.0, 5.5, M(shade(wall, -0.04)), w / 2 + 2.2, 1.5, d / 2 - 2.75); p.box(3.4, 2.4, 0.08, M("#e9e6df"), w / 2 + 2.2, 1.25, d / 2 + 0.03);
    for (let k = 0; k < 5; k++) p.box(3.4, 0.03, 0.1, M("#c9c5bc"), w / 2 + 2.2, 0.3 + k * 0.48, d / 2 + 0.07); p.box(4.6, 0.25, 5.9, M(shade(roofCol, -0.1)), w / 2 + 2.2, 3.1, d / 2 - 2.75);
    p.colBox(w / 2 + 0.1, -d / 2 + 0.6, w / 2 + 4.3, d / 2 + 0.1); }
  p.colBox(-w / 2 - 0.15, -d / 2 - 0.15, w / 2 + 0.15, d / 2 + 0.15); COLS[COLS.length - 1].tall = H + rise;
  return H + rise;
}
// cars (parked, for decoration); kind: sedan / hatch / van / pickup / taxi / police / ambulance / bus
const CAR_COLS = ["#e8423b", "#1f6bff", "#f2f2f2", "#2b2f3a", "#ffd23a", "#2fb04e", "#9b5cff", "#ff8a1c", "#8fa3b8", "#1fb6c9"];
function car(p, x, z, ry, color, kind = "sedan") {
  const q = p.at(x, z, ry), paint = M(color, { roughness: 0.32, metalness: 0.35 }), glass = M("#23323f", { roughness: 0.1, metalness: 0.5 }), rub = M("#1b1d22", { roughness: 0.9 }), hub = M("#c8ccd2", { metalness: 0.7, roughness: 0.3 });
  const L = kind === "bus" ? 9.5 : kind === "van" || kind === "ambulance" ? 4.6 : kind === "hatch" ? 3.7 : 4.3, W = kind === "bus" ? 2.5 : 1.9;
  const wheel = (wx, wz, r = 0.36) => { q.cyl(r, r, 0.3, rub, wx, r, wz, 14, { rz: Math.PI / 2 }); q.cyl(r * 0.55, r * 0.55, 0.32, hub, wx, r, wz, 10, { rz: Math.PI / 2 }); };
  if (kind === "bus") {
    q.box(W, 2.6, L, paint, 0, 1.75, 0); q.box(W + 0.02, 1.0, L - 1.2, glass, 0, 2.2, 0.2); q.box(W - 0.2, 0.9, 0.05, glass, 0, 2.1, L / 2 + 0.01);
    q.box(W + 0.04, 0.3, L, M("#ffffff"), 0, 1.45, 0); [-L / 2 + 1.6, L / 2 - 1.8].forEach((wz) => [-W / 2 + 0.1, W / 2 - 0.1].forEach((wx) => wheel(wx, wz, 0.5)));
  } else {
    const tall = kind === "van" || kind === "ambulance", bodyH = tall ? 1.35 : 0.65;
    q.box(W, bodyH, L, paint, 0, 0.42 + bodyH / 2, 0);
    if (!tall) { const cl = kind === "pickup" ? L * 0.36 : L * 0.5, cz = kind === "pickup" ? 0.5 : -0.1; q.box(W - 0.14, 0.6, cl, glass, 0, 1.04 + 0.3, cz); q.box(W - 0.16, 0.08, cl - 0.25, paint, 0, 1.68, cz);
      [-1, 1].forEach((sd) => q.box(0.06, 0.6, 0.12, paint, sd * (W / 2 - 0.08), 1.34, cz + cl / 2 - 0.08)); }
    else { q.box(W - 0.1, 0.55, 0.06, glass, 0, 1.45, L / 2 + 0.01); q.box(W + 0.02, 0.45, 1.6, glass, 0, 1.5, L / 2 - 1.0); }
    q.box(W + 0.02, 0.14, L + 0.1, M("#2b2f3a"), 0, 0.45, 0);
    [-1, 1].forEach((sd) => { q.box(0.4, 0.16, 0.05, glowMat("#fff4d0", 0.9), sd * 0.62, 0.78, L / 2 + 0.02); q.box(0.4, 0.14, 0.05, glowMat("#ff3b30", 0.9), sd * 0.62, 0.8, -L / 2 - 0.02); });
    [-L / 2 + 0.85, L / 2 - 0.85].forEach((wz) => [-W / 2 + 0.06, W / 2 - 0.06].forEach((wx) => wheel(wx, wz)));
    if (kind === "taxi") { q.box(0.7, 0.24, 0.3, glowMat("#ffe27a", 1.2), 0, 1.84, -0.1); }
    if (kind === "police") { q.box(W + 0.03, 0.22, L * 0.55, M("#1f4fd6"), 0, 0.82, 0.1); q.box(1.1, 0.16, 0.3, glowMat("#3d7bff", 1.6), -0.3, 1.8, -0.1); q.box(0.5, 0.16, 0.3, glowMat("#ff3b30", 1.6), 0.45, 1.8, -0.1); }
    if (kind === "ambulance") { q.box(W + 0.03, 0.2, L, M("#ff4545"), 0, 1.0, 0); q.box(0.6, 0.18, 0.3, glowMat("#ff3b30", 1.6), 0, 1.86, L / 2 - 0.4); }
    if (kind === "pickup") { q.box(W - 0.1, 0.08, L * 0.42, M("#3b3f4a"), 0, 1.02, -L * 0.27); }
  }
  q.colBox(-W / 2 - 0.15, -L / 2 - 0.15, W / 2 + 0.15, L / 2 + 0.15);
}
const WOOD = () => M("#b07a48"), IRON = () => M("#3b3f4a", { roughness: 0.5, metalness: 0.45 });
function bench(p, x, z, ry, col = "#c27a3e") { const q = p.at(x, z, ry), wd = M(col), ir = IRON();
  for (let i = 0; i < 3; i++) q.box(2.2, 0.08, 0.2, wd, 0, 0.58, -0.22 + i * 0.22); for (let i = 0; i < 2; i++) q.box(2.2, 0.1, 0.08, wd, 0, 0.88 + i * 0.22, -0.4);
  [-0.95, 0.95].forEach((s) => { q.box(0.07, 0.58, 0.62, ir, s, 0.29, -0.05); q.box(0.07, 0.66, 0.07, ir, s, 0.88, -0.42); }); q.colCircle(0, 0, 0.9); }
function bin(p, x, z) { const q = p.at(x, z); q.cyl(0.32, 0.27, 0.95, M("#2f7d4f", { metalness: 0.3, roughness: 0.5 }), 0, 0.48, 0, 12); q.cyl(0.35, 0.35, 0.07, M("#235f3c"), 0, 0.98, 0, 12); q.colCircle(0, 0, 0.35); }
function hydrant(p, x, z) { const q = p.at(x, z), r = M("#e8423b", { roughness: 0.45 }); q.cyl(0.17, 0.2, 0.62, r, 0, 0.31, 0, 10); q.sphere(0.17, r, 0, 0.66, 0, 1, 0.8, 1); q.cyl(0.07, 0.07, 0.5, r, 0, 0.42, 0, 8, { rz: Math.PI / 2 }); q.colCircle(0, 0, 0.25); }
function planter(p, x, z, kind = "round", flowers = true) { const q = p.at(x, z); q.box(1.6, 0.6, 1.6, M("#d8d2c4"), 0, 0.3, 0); q.box(1.4, 0.05, 1.4, M("#5a3f2a"), 0, 0.6, 0);
  q.put(sphG(10, 8), M("#3f9a3d", { flatShading: true }), 0, 1.05, 0, 0, 0.7, 0.6, 0.7); if (flowers) [[0.4, 0.3], [-0.35, 0.4], [0.1, -0.45], [-0.4, -0.25]].forEach(([a, b], i) => q.sphere(0.13, M(["#ff5fb4", "#ffd23a", "#ffffff", "#ff8a1c"][i]), a, 1.25, b, 1, 1, 1, [6, 5])); q.colCircle(0, 0, 0.95); }
function flowerBed(p, x, z, w, d, seed = 1) { const q = p.at(x, z), R = rng(seed); q.box(w, 0.22, d, M("#d8d2c4"), 0, 0.11, 0); q.box(w - 0.24, 0.04, d - 0.24, M("#5a3f2a"), 0, 0.23, 0);
  const cols = ["#ff5fb4", "#ffd23a", "#ffffff", "#9b5cff", "#ff8a1c", "#ff4545"]; const n = Math.round(w * d * 2.2);
  for (let i = 0; i < n; i++) { const fx = (R() - 0.5) * (w - 0.5), fz = (R() - 0.5) * (d - 0.5); q.cyl(0.02, 0.02, 0.3, M("#3f9a3d"), fx, 0.38, fz, 4); q.sphere(0.11, M(cols[Math.floor(R() * cols.length)]), fx, 0.55, fz, 1, 0.8, 1, [6, 4]); } }
function hedge(p, x, z, w, d, h = 1.1) { p.box(w, h, d, M("#3a8f3e", { roughness: 1 }), x, h / 2, z); p.box(w - 0.1, 0.12, d - 0.1, M("#4aa34a", { roughness: 1 }), x, h + 0.04, z); p.colBox(x - w / 2, z - d / 2, x + w / 2, z + d / 2); }
function picketFence(p, x0, z0, x1, z1, col = "#ffffff", gap = null) { const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2, q = p.at(x0, z0, -ry), wm = M(col);
  for (let t = 0; t <= L; t += 0.32) { if (gap && t > gap[0] && t < gap[1]) continue; q.box(0.08, 0.95, 0.06, wm, t, 0.48, 0); q.cone(0.06, 0.12, wm, t, 1.0, 0, 4); }
  const rail = (a, b) => { if (b - a > 0.1) { q.box(b - a, 0.08, 0.05, wm, (a + b) / 2, 0.35, -0.04); q.box(b - a, 0.08, 0.05, wm, (a + b) / 2, 0.75, -0.04); } };
  if (gap) { rail(0, gap[0]); rail(gap[1], L); } else rail(0, L);
  // walls for the game (straight runs only, axis-aligned)
  const seg = (a, b) => { if (b - a < 0.2) return; const A = q.world(a, 0, 0), B = q.world(b, 0, 0); COLS.push({ box: [Math.min(A.x, B.x) - 0.12, Math.min(A.z, B.z) - 0.12, Math.max(A.x, B.x) + 0.12, Math.max(A.z, B.z) + 0.12] }); };
  if (gap) { seg(0, gap[0]); seg(gap[1], L); } else seg(0, L); }
function metalFence(p, x0, z0, x1, z1, h = 2.2) { const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2, q = p.at(x0, z0, -ry), m = M("#9aa3ad", { metalness: 0.6, roughness: 0.35 });
  for (let t = 0; t <= L; t += 3) q.cyl(0.06, 0.06, h, m, t, h / 2, 0, 6); q.box(L, 0.06, 0.06, m, L / 2, h - 0.05, 0); q.box(L, 0.06, 0.06, m, L / 2, 0.15, 0);
  q.put(planeG(), M("#c5ccd4", { transparent: true, opacity: 0.35, metalness: 0.5, side: THREE.DoubleSide, depthWrite: false }), L / 2, h / 2, 0, 0, L, 1, h - 0.2, Math.PI / 2, 0, false);
  const A = q.world(0, 0, 0), B = q.world(L, 0, 0); COLS.push({ box: [Math.min(A.x, B.x) - 0.15, Math.min(A.z, B.z) - 0.15, Math.max(A.x, B.x) + 0.15, Math.max(A.z, B.z) + 0.15] }); }
function cafeTable(p, x, z, col = "#ff5f5f") { const q = p.at(x, z), white = M("#f4f1ea"), dk = DARK();
  q.cyl(0.5, 0.5, 0.06, white, 0, 0.76, 0, 16); q.cyl(0.05, 0.05, 0.76, dk, 0, 0.38, 0, 8); q.cyl(0.28, 0.28, 0.04, dk, 0, 0.02, 0, 10);
  [0, Math.PI].forEach((a) => { const c = q.at(Math.sin(a) * 0.85, Math.cos(a) * 0.85, a + Math.PI); c.box(0.46, 0.05, 0.46, white, 0, 0.47, 0); c.box(0.46, 0.46, 0.05, white, 0, 0.72, -0.22); [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(([a2, b2]) => c.box(0.04, 0.46, 0.04, dk, a2, 0.23, b2)); });
  q.cyl(0.03, 0.03, 2.3, dk, 0, 1.15, 0, 6); q.put(coneG(8), texMat(stripeTex(col, "#ffffff", 8), { side: THREE.DoubleSide }), 0, 2.32, 0, 0, 1.35, 0.5, 1.35); q.colCircle(0, 0, 1.2); }
function stall(p, x, z, ry, col, sign) { const q = p.at(x, z, ry), wd = M("#c99a63");
  q.box(3.6, 1.0, 1.2, wd, 0, 0.5, 0); q.box(3.8, 0.08, 1.4, M("#f4f1ea"), 0, 1.04, 0); [-1.7, 1.7].forEach((sx) => [-0.5, 0.5].forEach((sz) => q.cyl(0.06, 0.06, 2.4, wd, sx, 1.2, sz, 6)));
  q.box(4.0, 0.08, 1.9, texMat(stripeTex(col, "#ffffff", 10)), 0, 2.45, 0.1, 0, { rx: -0.25 });
  if (sign) { q.box(2.6, 0.55, 0.1, M("#2b2f3a"), 0, 2.95, 0.6); q.geo(new THREE.PlaneGeometry(2.4, 0.45), signMat(sign, sign, { bg: "#ffffff", fg: col, w: 512, h: 96, size: 64 }), 0, 2.95, 0.66, 0, false); }
  q.colBox(-1.9, -0.7, 1.9, 0.7); }
function busStop(p, x, z, ry) { const q = p.at(x, z, ry), m = M("#3b4a5c", { metalness: 0.5, roughness: 0.4 }), g = M("#bfe3f5", { transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false });
  q.box(3.6, 0.1, 1.6, m, 0, 2.6, 0); [-1.7, 1.7].forEach((sx) => q.box(0.08, 2.6, 0.08, m, sx, 1.3, -0.7)); q.put(boxG(), g, 0, 1.4, -0.75, 0, 3.4, 2.2, 0.04, 0, 0, false); q.put(boxG(), g, -1.75, 1.4, 0, 0, 0.04, 2.2, 1.4, 0, 0, false);
  q.box(2.4, 0.08, 0.45, M("#c27a3e"), 0, 0.55, -0.45); q.cyl(0.05, 0.05, 2.8, m, 2.2, 1.4, 0.4, 6); q.cyl(0.32, 0.32, 0.06, glowMat("#1f6bff", 1), 2.2, 2.75, 0.4, 16, { rx: Math.PI / 2 });
  q.colBox(-1.85, -0.85, 1.85, -0.6); }
function trafficLight(p, x, z, ry) { const q = p.at(x, z, ry), m = M("#2f3542", { metalness: 0.5, roughness: 0.4 });
  q.cyl(0.09, 0.11, 4.2, m, 0, 2.1, 0, 8); q.box(0.42, 1.15, 0.32, M("#1d2027"), 0, 3.9, 0.12);
  q.sphere(0.12, glowMat("#ff3b30", 0.6), 0, 4.25, 0.3, 1, 1, 0.5, [8, 6]); q.sphere(0.12, glowMat("#ffb21f", 0.6), 0, 3.9, 0.3, 1, 1, 0.5, [8, 6]); q.sphere(0.12, glowMat("#2fd36b", 1.6), 0, 3.55, 0.3, 1, 1, 0.5, [8, 6]); q.colCircle(0, 0, 0.2); }
function streetSign(p, x, z, ry, text) { const q = p.at(x, z, ry), m = M("#2f3542", { metalness: 0.5 }); q.cyl(0.05, 0.05, 3, m, 0, 1.5, 0, 6);
  q.geo(new THREE.PlaneGeometry(2.0, 0.42), signMat("st:" + text, text, { bg: "#2f7d4f", fg: "#ffffff", w: 512, h: 108, size: 62, border: "#ffffff" }), 0.9, 2.85, 0.03, 0, false);
  q.geo(new THREE.PlaneGeometry(2.0, 0.42).rotateY(Math.PI), signMat("st:" + text, text, { bg: "#2f7d4f", fg: "#ffffff", w: 512, h: 108, size: 62, border: "#ffffff" }), 0.9, 2.85, -0.03, 0, false); }
function crate(p, x, z, s = 1, ry = 0) { const q = p.at(x, z, ry); q.box(s, s, s, M("#b9894f"), 0, s / 2, 0); [-1, 1].forEach((k) => { q.box(s + 0.02, 0.1, 0.1, M("#8a5f30"), 0, s / 2 + k * s * 0.35, s / 2); q.box(s + 0.02, 0.1, 0.1, M("#8a5f30"), 0, s / 2 + k * s * 0.35, -s / 2); }); }
function container(p, x, z, ry, col, y = 0) { const q = p.at(x, z, ry, y); q.put(boxG(), texMat(metalRibTex(col)), 0, 1.3, 0, 0, 2.4, 2.6, 6.0); q.box(2.44, 0.1, 6.04, M(shade(col, -0.15)), 0, 2.62, 0); q.box(2.3, 2.4, 0.05, M(shade(col, -0.1)), 0, 1.3, 3.02); }
function barrel(p, x, z, col = "#2f6fd6") { p.cyl(0.36, 0.36, 1.0, M(col, { metalness: 0.3, roughness: 0.5 }), x, 0.5, z, 12); p.cyl(0.37, 0.37, 0.05, M(shade(col, -0.2)), x, 0.25, z, 12); p.cyl(0.37, 0.37, 0.05, M(shade(col, -0.2)), x, 0.75, z, 12); p.colCircle(x, z, 0.4); }
function flagpole(B, x, z, col = "#1f6bff", h = 8, art = null) { const p = B.P(x, z), group = B.live(x, z);
  p.cyl(0.08, 0.11, h, M("#d9dde3", { metalness: 0.6, roughness: 0.3 }), 0, h / 2, 0, 8); p.sphere(0.14, M("#ffd23a", { metalness: 0.6 }), 0, h + 0.1, 0); p.colCircle(0, 0, 0.2);
  const g = new THREE.PlaneGeometry(2.4, 1.5, 12, 4); g.translate(1.2, 0, 0); const base = g.attributes.position.array.slice();
  const tex = art || canvasTex("flag" + col, 256, 160, (c, w, h2) => { c.fillStyle = col; c.fillRect(0, 0, w, h2); c.fillStyle = "#fff"; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 22 : 52; c.lineTo(w / 2 + Math.cos(a) * r, h2 / 2 + Math.sin(a) * r); } c.fill(); }, { repeat: false });
  const f = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 })); f.position.set(x + 0.06, h - 0.9, z); f.castShadow = true; group.add(f);
  anim((t) => { const a = g.attributes.position; for (let i = 0; i < a.count; i++) { const bx = base[i * 3], by = base[i * 3 + 1]; a.setZ(i, Math.sin(bx * 2.2 - t * 5 + by) * 0.12 * (bx / 2.4)); } a.needsUpdate = true; }, group); }
/* =====================================================================
   TREES: a handful of shapes as InstancedMesh, swaying in the wind (on the graphics card)
   ===================================================================== */
const WIND = { value: 0 };
function swayMat(color, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, ...o });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = WIND;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uWind;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
#ifdef USE_INSTANCING
vec3 ip=vec3(instanceMatrix[3][0],instanceMatrix[3][1],instanceMatrix[3][2]);
#else
vec3 ip=vec3(0.);
#endif
float hk=max(0.,position.y-0.6);float ph=ip.x*.13+ip.z*.17;
transformed.x+=sin(uWind*1.3+ph)*.045*hk+sin(uWind*3.1+ph*2.)*.012*hk;transformed.z+=cos(uWind*1.1+ph)*.035*hk;`);
  };
  m.customProgramCacheKey = () => "sway";
  return m;
}
function treeParts() {
  if (GEO.has("trees")) return GEO.get("trees");
  const lobes = (list, detail = 1) => mergeGeometries(list.map(([x, y, z, r, sy = 1]) => { const g = new THREE.IcosahedronGeometry(r, detail); g.scale(1, sy, 1); g.translate(x, y, z); return g.toNonIndexed(); }));
  const trunk = (h, r0, r1) => new THREE.CylinderGeometry(r1, r0, h, 8).translate(0, h / 2, 0);
  const pine = () => mergeGeometries([[0, 2.0, 1.6, 2.3], [0, 3.2, 1.25, 2.0], [0, 4.3, 0.9, 1.7], [0, 5.2, 0.55, 1.3]].map(([x, y, r, h]) => new THREE.ConeGeometry(r, h, 9).translate(x, y, 0).toNonIndexed()));
  const v = {
    round: { trunk: trunk(2.2, 0.3, 0.2), crown: lobes([[0, 2.9, 0, 1.25], [0.7, 2.5, 0.3, 0.9], [-0.65, 2.55, -0.25, 0.95], [0.1, 3.5, -0.2, 0.95], [-0.2, 2.6, 0.75, 0.8]]), colors: ["#4fa83f", "#5dbb48", "#3f9a3d", "#6bc24f", "#4a9e3a"] },
    tall: { trunk: trunk(3.2, 0.28, 0.18), crown: lobes([[0, 3.6, 0, 1.0, 1.5], [0.4, 4.6, 0.1, 0.75, 1.3], [-0.3, 3.0, 0.2, 0.8, 1.2]]), colors: ["#3f9a3d", "#55ad43", "#2f8a3a"] },
    pine: { trunk: trunk(1.4, 0.26, 0.18), crown: pine(), colors: ["#2f7d45", "#3a8a4c", "#276b3c", "#3f915a"] },
    bush: { trunk: null, crown: lobes([[0, 0.5, 0, 0.75, 0.8], [0.55, 0.42, 0.2, 0.55, 0.8], [-0.5, 0.45, -0.1, 0.6, 0.8]], 1), colors: ["#3f9a3d", "#4caf45", "#2f8a3a", "#5aa84a"] },
    blossom: { trunk: trunk(2.0, 0.26, 0.16), crown: lobes([[0, 2.7, 0, 1.15], [0.7, 2.4, 0.3, 0.85], [-0.6, 2.5, -0.2, 0.9], [0.1, 3.3, -0.1, 0.85]]), colors: ["#ffb3d1", "#ffc6dc", "#f7a1c4", "#ffd2e4"] },
    autumn: { trunk: trunk(2.2, 0.3, 0.2), crown: lobes([[0, 2.9, 0, 1.25], [0.7, 2.5, 0.3, 0.9], [-0.65, 2.55, -0.25, 0.95], [0.1, 3.5, -0.2, 0.95]]), colors: ["#e8a33a", "#d9752f", "#f2c14a", "#c95a2a"] },
    palm: null,
  };
  GEO.set("trees", v); return v;
}
class TreeField {
  constructor() { this.list = {}; }
  add(kind, x, z, s = 1, y = 0) { (this.list[kind] || (this.list[kind] = [])).push([x, y, z, s]); }
  build(group) {
    const P = treeParts(), trunkM = swayMat("#7a5236"), dummy = new THREE.Object3D(), c = new THREE.Color();
    for (const kind in this.list) {
      const L = this.list[kind], V = P[kind]; if (!V || !L.length) continue;
      const crownM = swayMat("#ffffff", { flatShading: true });
      const crown = new THREE.InstancedMesh(V.crown, crownM, L.length); crown.castShadow = true; crown.receiveShadow = true;
      const trunk = V.trunk ? new THREE.InstancedMesh(V.trunk, trunkM, L.length) : null; if (trunk) { trunk.castShadow = true; trunk.receiveShadow = true; }
      const R = rng(L.length * 17 + kind.length);
      L.forEach(([x, y, z, s], i) => {
        dummy.position.set(x, y, z); dummy.rotation.set(0, R() * TAU, 0); dummy.scale.setScalar(s * (0.85 + R() * 0.3)); dummy.updateMatrix();
        crown.setMatrixAt(i, dummy.matrix); c.set(V.colors[Math.floor(R() * V.colors.length)]); c.offsetHSL((R() - 0.5) * 0.02, 0, (R() - 0.5) * 0.06); crown.setColorAt(i, c);
        if (trunk) trunk.setMatrixAt(i, dummy.matrix);
      });
      crown.computeBoundingSphere(); group.add(crown); if (trunk) { trunk.computeBoundingSphere(); group.add(trunk); }
    }
  }
}

/* =====================================================================
   LAMPS: posts merged, bulbs instanced, halos as one Points cloud, light pools instanced
   ===================================================================== */
const LAMP_BULB = new THREE.MeshStandardMaterial({ color: "#fff6d0", emissive: new THREE.Color("#ffd97a"), emissiveIntensity: 0.6 });
let haloTex = null, poolTex = null;
const LAMP_FX = [];   // {halo: Points material, pool: Mesh material}
function glowCanvas(inner, outer) { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(0.3, inner); g.addColorStop(0.55, outer); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
class LampField {
  constructor() { this.list = []; }
  // style: "street" (tall, arm over the road), "park" (short, round), "harbor" (lantern)
  add(P, x, z, ry = 0, style = "street", y = 0) { this.list.push({ P, x, z, ry, style, y }); }
  build(group, acc) {
    if (!this.list.length) return;
    const iron = M("#2f3542", { roughness: 0.45, metalness: 0.55 }), dark = M("#22262e", { roughness: 0.5, metalness: 0.5 });
    const pts = [];
    for (const L of this.list) {
      const p = new Painter(acc).at(L.x, L.z, L.ry, L.y || 0);
      if (L.style === "street") {
        p.cyl(0.11, 0.16, 6.2, iron, 0, 3.1, 0, 10); p.cyl(0.3, 0.34, 0.4, dark, 0, 0.2, 0, 10);
        p.box(0.12, 0.12, 2.0, iron, 0, 6.15, 0.95); p.box(0.55, 0.16, 0.9, dark, 0, 6.12, 1.85);
        pts.push(new THREE.Vector3(...new THREE.Vector3(0, 5.95, 1.85).applyMatrix4(p.base).toArray()));
      } else if (L.style === "harbor") {
        p.cyl(0.09, 0.12, 3.2, dark, 0, 1.6, 0, 8); p.box(0.42, 0.55, 0.42, dark, 0, 3.4, 0); p.cone(0.36, 0.3, dark, 0, 3.82, 0, 4, { ry: Math.PI / 4 });
        pts.push(new THREE.Vector3(0, 3.4, 0).applyMatrix4(p.base));
      } else {
        p.cyl(0.08, 0.12, 3.4, iron, 0, 1.7, 0, 8); p.cyl(0.24, 0.28, 0.2, iron, 0, 0.1, 0, 10); p.cyl(0.3, 0.16, 0.14, iron, 0, 3.86, 0, 10);
        pts.push(new THREE.Vector3(0, 3.6, 0).applyMatrix4(p.base));
      }
    }
    const bulbs = new THREE.InstancedMesh(sphG(14, 10), LAMP_BULB, pts.length), d = new THREE.Object3D();
    pts.forEach((v, i) => { d.position.copy(v); d.scale.setScalar(0.26); d.updateMatrix(); bulbs.setMatrixAt(i, d.matrix); });
    bulbs.computeBoundingSphere(); group.add(bulbs);
    haloTex = haloTex || glowCanvas("rgba(255,228,160,.95)", "rgba(255,200,110,.22)");
    poolTex = poolTex || glowCanvas("rgba(255,214,140,.6)", "rgba(255,214,140,.12)");
    const hg = new THREE.BufferGeometry().setFromPoints(pts), hm = new THREE.PointsMaterial({ map: haloTex, size: 3.0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, sizeAttenuation: true });
    const halos = new THREE.Points(hg, hm); halos.frustumCulled = false; group.add(halos);
    const pm = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const pools = new THREE.InstancedMesh(planeG(), pm, pts.length);
    pts.forEach((v, i) => { d.position.set(v.x, (this.list[i].y || 0) + 0.06, v.z); d.scale.set(7.5, 1, 7.5); d.updateMatrix(); pools.setMatrixAt(i, d.matrix); });
    pools.computeBoundingSphere(); group.add(pools);
    LAMP_FX.push({ hm, pm });
  }
}

/* =====================================================================
   WATER for lakes and ponds: gentle ripples, a fresnel sky tint, see-through at the edges
   ===================================================================== */
const WATER_T = { value: 0 };
function waterMat(deep = "#1a7fb8", shallow = "#4fd0e0") {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.88 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = WATER_T; sh.uniforms.uDeep = { value: new THREE.Color(deep) }; sh.uniforms.uShal = { value: new THREE.Color(shallow) };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWW;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWW=(modelMatrix*vec4(transformed,1.)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
uniform float uT;uniform vec3 uDeep,uShal;varying vec3 vWW;
float wn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5),b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5),c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5),d=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5);return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}`)
      .replace("#include <color_fragment>", `#include <color_fragment>
vec2 q1=mat2(.8,-.6,.6,.8)*vWW.xz,q2=mat2(.5,.87,-.87,.5)*vWW.xz;float n1=wn(q1*.55+vec2(uT*.25,uT*.18)),n2=.5*(wn(q1*1.7-vec2(uT*.4,uT*.3))+wn(q2*2.3+vec2(uT*.35,-uT*.2)));
vec3 vdir=normalize(cameraPosition-vWW);float fres=pow(1.-clamp(vdir.y,0.,1.),2.2);
vec3 col=mix(uDeep,uShal,.35+.3*n1);col=mix(col,vec3(.75,.9,1.),fres*.35);col+=vec3(1.)*smoothstep(.72,.95,n2)*.55;
diffuseColor.rgb=col;diffuseColor.a=.9+fres*.1;`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
normal=normalize(normal+vec3(wn(vWW.xz*1.3+uT*.5)-.5,0.,wn(vWW.xz*1.3-uT*.45)-.5)*.35);`);
  };
  m.customProgramCacheKey = () => "lakewater" + deep + shallow;
  return m;
}

/* =====================================================================
   THINGS TO MOVE (animated): boats, the plane, the train, the ferris wheel, flags, smoke…
   ===================================================================== */
const ANIM = [];   // {fn, g}: only runs while its group can be seen
let ANIM_G = null;
const anim = (fn, g = ANIM_G) => ANIM.push({ fn, g });


/* =====================================================================
   BUILDING THE CITY
   ===================================================================== */
const CELL = 80; let VIEW = 175;   // the world is cut into CELL×CELL squares; squares further than VIEW are hidden
export function buildCity(L, host) {
  COLS = []; nightMats.length = 0; ANIM.length = 0; LAMP_FX.length = 0;
  const root = new THREE.Group(); root.name = "city"; host.world.add(root);
  const cells = new Map();
  const cell = (x, z) => { const i = Math.floor(x / CELL), j = Math.floor(z / CELL), k = i + "," + j;
    let c = cells.get(k); if (!c) { c = { i, j, cx: (i + 0.5) * CELL, cz: (j + 0.5) * CELL, group: new THREE.Group(), acc: new Acc(), trees: new TreeField(), lamps: new LampField() }; root.add(c.group); cells.set(k, c); } return c; };
  const P = (x, z, ry = 0) => new Painter(cell(x, z).acc).at(x, z, ry);
  const tree = (kind, x, z, s = 1, y = null) => cell(x, z).trees.add(kind, x, z, s, y === null ? ground(x, z) : y);
  const lamp = (x, z, ry = 0, style = "street") => { cell(x, z).lamps.add(null, x, z, ry, style); };
  const live = (x, z) => { const c = cell(x, z); ANIM_G = c.group; return c.group; };   // animated things go straight into their square
  const ground = (x, z) => (z > HILL_Z0 ? hillHeight(x, z) : 0);
  const B = { L, P, tree, lamp, live, cell, ground, host };

  roads(B);
  parkingLots(B);
  for (const f of DISTRICT_BUILDERS) { try { f(B); } catch (err) { console.warn("[city] a district failed to build:", err); } }

  for (const c of cells.values()) { c.acc.build(c.group); c.trees.build(c.group); c.lamps.build(c.group, c.acc); c.acc.build(c.group); }
  ANIM_G = null;
  const colliders = COLS; COLS = [];

  /* ---------- what the game asks ---------- */
  const { ROADS, roadRect, CONNECTORS, DECKS, BLOCKED, BRIDGES, DISTRICTS, inRect, inLake, CAVE } = L;
  const roadRects = ROADS.map(roadRect);
  const harbor = L.DISTRICT_BY_ID.harbor.rect;
  function walk(x, z) {
    if (inRect(x, z, harbor)) return L.onDeck(x, z) || roadRects.some((r) => inRect(x, z, r));
    if (L.inCave(x, z)) return caveWalk(x, z);
    if (roadRects.some((r) => inRect(x, z, r)) || CONNECTORS.some((r) => inRect(x, z, r)) || DECKS.some((r) => inRect(x, z, r))) return !BLOCKED.some((r) => inRect(x, z, r)) || roadRects.some((r) => inRect(x, z, r));
    if (BLOCKED.some((r) => inRect(x, z, r))) return false;
    if (inLake(x, z)) return BRIDGES.some((r) => inRect(x, z, r));
    if (!DISTRICTS.some((d) => inRect(x, z, d.rect))) return false;
    if (z > HILL_Z0) return hillSlope(x, z) < 1.15;
    return true;
  }
  function caveWalk(x, z) { const dx = (x - (CAVE.x0 + CAVE.x1) / 2) / 13.5, dz = (z - (CAVE.z0 + CAVE.z1) / 2) / 13; return dx * dx + dz * dz < 1 || (Math.abs(x - CAVE.exit[0]) < 1.6 && z > CAVE.z1 - 4 && z < CAVE.z1); }
  const campDock = DECKS[DECKS.length - 1];
  function groundAt(x, z) {
    if (L.inCave(x, z)) return 0;
    if (inRect(x, z, campDock)) return CAMP_DOCK_Y;
    if (L.onDeck(x, z)) return 0.05;
    if (BRIDGES.some((r) => inRect(x, z, r))) return 0.45;
    if (z > HILL_Z0) return hillHeight(x, z);
    return null;   // the old world decides (Plaza 0, Beach sand…)
  }
  const ZONE_OF = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));
  function zoneAt(x, z) { if (L.inCave(x, z)) return "cave"; const d = DISTRICTS.find((q) => inRect(x, z, q.rect)); return d ? d.id : null; }

  let last = 0;
  function update(t, dt, cam) {
    WIND.value = t; WATER_T.value = t;
    // hide squares that are too far (every few frames is enough)
    if (t - last > 0.25) { last = t; for (const c of cells.values()) { const dx = Math.max(0, Math.abs(cam.position.x - c.cx) - CELL / 2), dz = Math.max(0, Math.abs(cam.position.z - c.cz) - CELL / 2); c.group.visible = dx * dx + dz * dz < VIEW * VIEW; } }
    for (const a of ANIM) if (!a.g || a.g.visible) a.fn(t, dt);
    // the secret cave: in behind the waterfall, out through the bright tunnel
    const G = host.G, me = G && G.pos;
    if (me && host.teleport && !host.busy?.()) {
      if (inRect(me.x, me.z, CAVE.door)) host.teleport(CAVE.enter[0], CAVE.enter[1], Math.PI, "cave");
      else if (L.inCave(me.x, me.z) && me.z > CAVE.z1 - 1.3 && Math.abs(me.x - CAVE.exit[0]) < 1.7) host.teleport(CAVE.out[0], CAVE.out[1], 0.6, "hills");
    }
    // inside the cave it's dark and purple, lit by the crystals
    if (me && L.inCave(me.x, me.z) && G.sun && G.hemi) { G.sun.intensity *= 0.04; G.hemi.intensity = 1.05; G.hemi.color.set("#a99cff"); G.hemi.groundColor.set("#4a3a70"); }
  }
  // the camera never leaves the cave's dome: how far along me→camera it may go (0..1)
  function camClamp(px, pz, cx, cz) {
    if (!L.inCave(px, pz)) return 1;
    const ox = (CAVE.x0 + CAVE.x1) / 2, oz = (CAVE.z0 + CAVE.z1) / 2, rx = 12.5, rz = 12;
    let lo = 0, hi = 1; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2, x = px + (cx - px) * m, z = pz + (cz - pz) * m; if (((x - ox) / rx) ** 2 + ((z - oz) / rz) ** 2 < 1) lo = m; else hi = m; }
    return Math.max(0.15, lo);
  }
  function night(k) {
    for (const m of nightMats) m.emissiveIntensity = lerp(m.userData.day || 0, m.userData.night || 1, k);
    LAMP_BULB.emissiveIntensity = 0.6 + k * 2.6;
    for (const f of LAMP_FX) { f.hm.opacity = k * 0.9; f.pm.opacity = k * 0.8; }
    for (const b of BEAMS) b.opacity = k * 0.16;
  }
  return { setView: (v) => { VIEW = v; last = -1; }, root, colliders, walk, camClamp, chest: CHEST, ground: groundAt, deck: (x, z) => L.onDeck(x, z) || BRIDGES.some((r) => inRect(x, z, r)), zoneAt, zones: ZONE_OF, update, night, spots: SPOTS, cells };
}
const SPOTS = [];      // places with an action key (E): {id, x, z, r, label, icon}
const DISTRICT_BUILDERS = [];

/* ---------- roads: asphalt with lines, sidewalks with curbs, crossings with zebra stripes, street lamps ---------- */
function roads(B) {
  const { ROADS, ROAD_W, WALK_W, ROAD_HALF } = B.L;
  const H = ROADS.filter((r) => r.z !== undefined), V = ROADS.filter((r) => r.x !== undefined);
  const X = [];
  for (const h of H) for (const v of V) if (v.x >= h.x0 - 1 && v.x <= h.x1 + 1 && h.z >= v.z0 - 1 && h.z <= v.z1 + 1) X.push({ x: v.x, z: h.z, h, v });
  const roadM = texMat(roadTex(), { roughness: 0.92 }), asphM = texMat(asphaltTex(), { roughness: 0.95 }), walkM = texMat(sidewalkTex(), { roughness: 0.9 }), curbM = M("#c9c5bc"), zebra = M("#f4f4ef", { roughness: 0.7 });
  const piece = (along, a, b, fixed, horizontal, mat, width, y, tile, offset = 0) => {   // a strip from a to b along the road
    if (b - a < 0.05) return; const len = b - a, mid = (a + b) / 2;
    for (let s = a; s < b - 0.01; s += 40) { const e = Math.min(b, s + 40), l = e - s, m2 = (s + e) / 2;
      const g = stripGeo(width, l, tile[0], tile[1], y); if (horizontal) g.rotateY(Math.PI / 2);
      const [x, z] = horizontal ? [m2, fixed + offset] : [fixed + offset, m2];
      new Painter(B.cell(x, z).acc).geo(g, mat, x, 0, z, 0, false); }
  };
  for (const r of ROADS) {
    const hz = r.z !== undefined, a0 = hz ? r.x0 : r.z0, a1 = hz ? r.x1 : r.z1, fixed = hz ? r.z : r.x;
    const cuts = X.filter((c) => (hz ? c.h === r : c.v === r)).map((c) => (hz ? c.x : c.z)).sort((a, b) => a - b);
    // asphalt with markings between crossings; plain asphalt in the crossings
    let s = a0; for (const c of cuts) { piece(0, s, c - ROAD_W / 2, fixed, hz, roadM, ROAD_W, 0.02, [ROAD_W, ROAD_W]); s = c + ROAD_W / 2; } piece(0, s, a1, fixed, hz, roadM, ROAD_W, 0.02, [ROAD_W, ROAD_W]);
    // sidewalks + curbs on both sides, broken at crossings
    [-1, 1].forEach((side) => {
      let s2 = a0; const segs = []; for (const c of cuts) { segs.push([s2, c - ROAD_HALF]); s2 = c + ROAD_HALF; } segs.push([s2, a1]);
      for (const [a, b] of segs) { if (b - a < 0.3) continue;
        piece(0, a, b, fixed, hz, walkM, WALK_W, 0.05, [2, 2], side * (ROAD_W / 2 + WALK_W / 2));
        for (let q = a; q < b - 0.01; q += 40) { const e = Math.min(b, q + 40), m2 = (q + e) / 2, off = side * (ROAD_W / 2 + 0.07); const [x, z] = hz ? [m2, fixed + off] : [fixed + off, m2];
          new Painter(B.cell(x, z).acc).box(hz ? e - q : 0.16, 0.1, hz ? 0.16 : e - q, curbM, x, 0.05, z, 0, { cast: false }); }
        // street lamps along the sidewalk
        for (let q = a + 7; q < b - 4; q += 22) { const off = side * (ROAD_W / 2 + 0.55), [x, z] = hz ? [q, fixed + off] : [fixed + off, q];
          B.lamp(x, z, hz ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2)); B.cell(x, z); COLS.push({ c: [x, z], r: 0.25 }); }
      }
    });
  }
  // the crossings: plain asphalt square, corner sidewalks, zebra stripes on every side that has a road
  for (const c of X) {
    const p = new Painter(B.cell(c.x, c.z).acc);
    p.geo(stripGeo(ROAD_W, ROAD_W, ROAD_W, ROAD_W, 0.022), asphM, c.x, 0, c.z, 0, false);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => p.geo(stripGeo(WALK_W, WALK_W, 2, 2, 0.05), walkM, c.x + sx * (ROAD_W / 2 + WALK_W / 2), 0, c.z + sz * (ROAD_W / 2 + WALK_W / 2), 0, false));
    const arms = [[c.h.x0 < c.x - 1, -1, 0], [c.h.x1 > c.x + 1, 1, 0], [c.v.z0 < c.z - 1, 0, -1], [c.v.z1 > c.z + 1, 0, 1]];
    for (const [has, ax, az] of arms) { if (!has) continue;
      for (let k = -3; k <= 3; k++) { const along = ROAD_W / 2 + 1.3, across = k * 1.05;
        const x = c.x + ax * along + (az ? across : 0), z = c.z + az * along + (ax ? across : 0);
        p.box(ax ? 1.8 : 0.55, 0.012, ax ? 0.55 : 1.8, zebra, x, 0.032, z, 0, { cast: false }); } }
    trafficLight(p, c.x + ROAD_W / 2 + 0.8, c.z + ROAD_W / 2 + 0.8, Math.PI * 0.75);
    trafficLight(p, c.x - ROAD_W / 2 - 0.8, c.z - ROAD_W / 2 - 0.8, -Math.PI * 0.25);
  }
  // street name signs at a few crossings
  for (const c of X) { if (((c.x * 7 + c.z * 3) | 0) % 2) continue; streetSign(new Painter(B.cell(c.x, c.z).acc), c.x - ROAD_W / 2 - 0.8, c.z + ROAD_W / 2 + 0.8, 0, c.h.name.toUpperCase()); }
}

/* ---------- parking lots: asphalt, white bays, a blue P sign ---------- */
function parkingLots(B) {
  const asph = texMat(asphaltTex(), { roughness: 0.95 }), line = M("#f4f4ef", { roughness: 0.7 }), blue = M("#1f6bff", { roughness: 0.5 });
  for (const pk of B.L.PARKING) {
    const [x0, z0, x1, z1] = pk.rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, p = new Painter(B.cell(cx, cz).acc);
    p.geo(stripGeo(w, d, 8, 8, 0.025), asph, cx, 0, cz, 0, false);
    // a white border and bays along the two long sides
    const along = w >= d, len = along ? w : d;
    for (let t = 1.2; t <= len - 1.2; t += 2.7) for (const side of [-1, 1]) {
      const bx = along ? x0 + t : cx + side * (w / 2 - 2.6), bz = along ? cz + side * (d / 2 - 2.6) : z0 + t;
      p.box(along ? 0.12 : 5.0, 0.01, along ? 5.0 : 0.12, line, bx, 0.034, bz, 0, { cast: false });
    }
    p.box(w, 0.01, 0.14, line, cx, 0.034, z0 + 0.1, 0, { cast: false }); p.box(w, 0.01, 0.14, line, cx, 0.034, z1 - 0.1, 0, { cast: false });
    // the P sign
    const sx = x0 + 0.6, sz = z0 + 0.6; p.cyl(0.06, 0.06, 3.0, M("#9aa3ad", { metalness: 0.6 }), sx, 1.5, sz, 8); p.box(0.9, 0.9, 0.08, blue, sx, 3.0, sz);
    p.geo(new THREE.PlaneGeometry(0.8, 0.8), signMat("parkP", "P", { bg: "#1f6bff", fg: "#ffffff", w: 128, h: 128, size: 104, radius: 14 }), sx, 3.0, sz + 0.05, 0, false);
    p.geo(new THREE.PlaneGeometry(0.8, 0.8).rotateY(Math.PI), signMat("parkP", "P", { bg: "#1f6bff", fg: "#ffffff", w: 128, h: 128, size: 104, radius: 14 }), sx, 3.0, sz - 0.05, 0, false);
    COLS.push({ c: [sx, sz], r: 0.2 });
  }
}

/* =====================================================================
   DISTRICT HELPERS
   ===================================================================== */
// a paved area (axis-aligned rect) with a tiled texture; split into squares so each part culls with its square
function pave(B, x0, z0, x1, z1, mat, tile = [4, 4], y = 0.03) {
  for (let x = x0; x < x1 - 0.01; x += 40) for (let z = z0; z < z1 - 0.01; z += 40) {
    const a = Math.min(x1, x + 40), b = Math.min(z1, z + 40), cx = (x + a) / 2, cz = (z + b) / 2;
    new Painter(B.cell(cx, cz).acc).geo(stripGeo(a - x, b - z, tile[0], tile[1], y), mat, cx, 0, cz, 0, false);
  }
}
const spot = (id, x, z, label, icon = "shop", r = 2.2) => SPOTS.push({ id, x, z, r, label, icon });
const sideSign = (p, text, x, y, z, w = 3, h = 0.8, opt = {}) => { p.box(w + 0.2, h + 0.2, 0.12, M(opt.frame || "#2b2f3a"), x, y, z); p.geo(new THREE.PlaneGeometry(w, h), signMat(text + (opt.bg || ""), text, { bg: opt.bg || "#ffffff", fg: opt.fg || "#1d2b4f", w: 512, h: Math.round(512 * h / w), size: Math.round(512 * h / w * 0.6), stroke: opt.stroke }), x, y, z + 0.07, 0, false); };

/* =====================================================================
   WEST: the railway, Jumpi Station, Shopping Street, the Harbor, the Warehouses
   ===================================================================== */
const RAIL_Z = -4;
DISTRICT_BUILDERS.push(function railway(B) {
  const ballast = M("#8d8a84", { roughness: 1 }), sleeper = M("#6b4a2f"), steel = M("#aeb4bd", { metalness: 0.8, roughness: 0.3 });
  for (let x = -172; x < -40; x += 20) {
    const p = B.P(x + 10, RAIL_Z);
    p.box(20, 0.18, 3.6, ballast, 0, 0.09, 0, 0, { cast: false });
    for (let k = 0.35; k < 20; k += 0.7) p.box(0.28, 0.1, 2.6, sleeper, -10 + k, 0.22, 0, 0, { cast: false });
    [-0.75, 0.75].forEach((z) => p.box(20, 0.14, 0.12, steel, 0, 0.33, z));
  }
  // buffer stop at the end of the line, and the tunnel the trains come out of in the west
  const e = B.P(-41, RAIL_Z); e.box(0.6, 1.0, 3.0, M("#c8102e"), 0, 0.7, 0); e.box(0.7, 0.4, 3.2, M("#ffd23a"), -0.1, 1.0, 0);
  const t = B.P(-170.5, RAIL_Z), rock = M("#8a8478", { roughness: 1 });
  t.box(3, 9, 16, rock, 0, 4.5, 0); t.box(3.2, 5.2, 5.4, M("#14161a"), 0.1, 2.6, 0); t.box(3.4, 0.8, 7.4, M("#b8b0a2"), 0.15, 5.5, 0);
  [-3.3, 3.3].forEach((z) => t.box(3.4, 5.4, 1.0, M("#b8b0a2"), 0.15, 2.7, z));
  // the level crossing on Station Road: barriers that drop when the train passes
  const g = B.live(-100, RAIL_Z), arms = [];
  [[-106.6, RAIL_Z - 2.6, 1], [-93.4, RAIL_Z + 2.6, -1]].forEach(([x, z, s]) => {
    const post = B.P(x, z); post.cyl(0.14, 0.16, 1.4, M("#f4f1ea"), 0, 0.7, 0, 10); post.box(0.4, 0.4, 0.3, M("#2b2f3a"), 0, 1.5, 0); post.sphere(0.12, glowMat("#ff3b30", 1.4), 0, 1.75, 0.2);
    COLS.push({ c: [x, z], r: 0.3 });
    const pivot = new THREE.Group(); pivot.position.set(x, 1.35, z); g.add(pivot);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.16, 0.16), new THREE.MeshStandardMaterial({ map: stripeTex("#ff3b30", "#ffffff", 14), roughness: 0.6 })); arm.position.set(6.3 * s, 0, 0); arm.castShadow = true; pivot.add(arm); arms.push({ pivot, s });
  });
  TRAIN.arms = arms;
  // the train itself
  buildTrain(B);
});
const TRAIN = { x: -66, state: "wait", t0: 0, arms: [] };
function buildTrain(B) {
  const g = B.live(-66, RAIL_Z), train = new THREE.Group(); train.position.set(-66, 0, RAIL_Z); g.add(train);
  const acc = new Acc(), p = new Painter(acc), red = M("#e8423b", { roughness: 0.35, metalness: 0.2 }), white = M("#f6f6f2", { roughness: 0.4 }), win = M("#2a3c4c", { roughness: 0.1, metalness: 0.5 }), dark = M("#24272e");
  const car = (x, loco) => {
    const L = loco ? 9.5 : 10.5, q = p.at(x, 0);
    q.box(L, 2.7, 2.9, white, 0, 2.05, 0); q.box(L, 0.55, 2.94, red, 0, 1.0, 0); q.box(L, 0.18, 2.94, red, 0, 2.6, 0);
    q.box(L - 0.6, 0.9, 2.96, win, 0, 2.15, 0); q.box(L + 0.05, 0.3, 2.6, M("#cfd3d9"), 0, 3.5, 0);
    for (let k = -L / 2 + 1.2; k < L / 2 - 0.8; k += 1.5) q.box(0.12, 0.9, 2.98, white, k, 2.15, 0);
    if (!loco) [-L / 4, L / 4].forEach((dx) => [-1.48, 1.48].forEach((dz) => q.box(1.1, 2.1, 0.04, M("#ffd23a"), dx, 1.75, dz)));
    if (loco) { q.sphere(1.45, red, -L / 2, 2.0, 0, 0.9, 0.95, 1.0, [16, 12]); q.box(0.1, 0.8, 2.0, win, -L / 2 - 1.15, 2.55, 0); q.sphere(0.2, glowMat("#fff4d0", 2), -L / 2 - 1.25, 1.3, 0.8); q.sphere(0.2, glowMat("#fff4d0", 2), -L / 2 - 1.25, 1.3, -0.8); }
    [-L / 2 + 1.6, L / 2 - 1.6].forEach((wx) => { q.box(2.4, 0.5, 2.4, dark, wx, 0.55, 0); [-0.75, 0.75].forEach((wz) => [-0.55, 0.55].forEach((ox) => q.cyl(0.38, 0.38, 0.18, dark, wx + ox, 0.45, wz, 12, { rx: Math.PI / 2 }))); });
    return L;
  };
  let x = -11.5; [true, false, false, false].forEach((loco, i) => { const L = car(x + (loco ? 4.75 : 5.25), loco); x += L + 0.5; });
  acc.build(train); train.traverse((o) => { o.matrixAutoUpdate = true; });
  // drive: wait at the platform, leave into the west tunnel, come back
  const STOP = -60, AWAY = -215;
  anim((t, dt) => {
    const cyc = t % 150; let xx;
    if (cyc < 45) xx = STOP;                                                           // at the platform
    else if (cyc < 80) { const k = (cyc - 45) / 35; xx = STOP + (AWAY - STOP) * (k * k); } // leaving (speeding up)
    else if (cyc < 112) xx = AWAY;                                                     // far away
    else { const k = (cyc - 112) / 38; xx = AWAY + (STOP - AWAY) * (1 - (1 - k) * (1 - k)); } // coming back (slowing down)
    train.position.x = xx; TRAIN.x = xx;
    const near = Math.abs(xx - -100) < 40 && xx !== STOP && xx !== AWAY;
    for (const a of TRAIN.arms) { const want = near ? 0 : (a.s > 0 ? 1.45 : -1.45); a.pivot.rotation.z = lerp(a.pivot.rotation.z, want, Math.min(1, dt * 2)); }
  });
}

DISTRICT_BUILDERS.push(function station(B) {
  const pav = texMat(paversTex()), walkM = texMat(sidewalkTex());
  // the platform along the track, with a yellow safety line and a long canopy
  pave(B, -92, -1.8, -42, 3.6, walkM, [2, 2], 0.06);
  for (let x = -92; x < -42; x += 25) B.P(x + 12.5, -1.65).box(25, 0.012, 0.18, M("#ffd23a"), 0, 0.075, 0, 0, { cast: false });
  for (let x = -88; x <= -46; x += 7) { const p = B.P(x, 1.6); p.cyl(0.12, 0.14, 4.2, M("#3b4a5c", { metalness: 0.5 }), 0, 2.1, 0, 8); p.colCircle(0, 0, 0.25); }
  { const p = B.P(-67, 1.2); p.box(46, 0.18, 5.2, M("#3b4a5c", { metalness: 0.5, roughness: 0.4 }), 0, 4.3, 0, 0, { rx: 0.06 }); p.box(46, 0.06, 4.6, M("#bfe3f5", { transparent: true, opacity: 0.5, depthWrite: false }), 0, 4.42, 0, 0, { rx: 0.06, cast: false });
    for (let x = -18; x <= 18; x += 12) { p.box(1.8, 0.5, 0.08, M("#1d2b4f"), x, 3.6, 0.6); p.geo(new THREE.PlaneGeometry(1.6, 0.36), signMat("plat" + x, x < 0 ? "PLATFORM 1" : "TRAINS ↔ CITY", { bg: "#1d2b4f", fg: "#ffd23a", w: 512, h: 116, size: 60 }), x, 3.6, 0.65, 0, false); }
    [-20, -6, 8, 20].forEach((x) => bench(p, x, 2.6, Math.PI, "#c27a3e")); }
  // the station building: brick, arched windows, a clock tower in the middle
  { const p = B.P(-59, 9);
    building(p, { w: 30, d: 10, floors: 2, style: "brick", wall: "#b4563f", opt: { arch: true, frame: "#f4ead6" }, roof: "flat", trim: "#efe3c8", roofStuff: false });
    const tw = B.P(-59, 9); tw.box(5.2, 15, 5.2, facadeMat("brick", "#a84d38", { arch: true, frame: "#f4ead6" }), 0, 7.5, 0); tw.box(5.8, 0.5, 5.8, M("#efe3c8"), 0, 15.2, 0); tw.cone(4.2, 4, M("#2f5d6b", { roughness: 0.5 }), 0, 17.4, 0, 4, { ry: Math.PI / 4 }); tw.sphere(0.25, M("#ffd23a", { metalness: 0.6 }), 0, 19.5, 0);
    // a big clock on the front (it shows the real time: see the anim below)
    tw.cyl(1.7, 1.7, 0.2, M("#f6f2e6"), 0, 12, 2.7, 32, { rx: Math.PI / 2 }); tw.cyl(1.85, 1.85, 0.12, M("#2b2f3a"), 0, 12, 2.66, 32, { rx: Math.PI / 2 });
    const g = B.live(-59, 9), mk = (len, w) => { const h = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.06), new THREE.MeshStandardMaterial({ color: "#1d2027" })); h.geometry.translate(0, len / 2, 0); h.position.set(-59, 12, 11.85); g.add(h); return h; };
    const hh = mk(1.0, 0.16), mh = mk(1.45, 0.1);
    anim(() => { const d = new Date(); const m = d.getMinutes() + d.getSeconds() / 60, hr = (d.getHours() % 12) + m / 60; mh.rotation.z = -(m / 60) * TAU; hh.rotation.z = -(hr / 12) * TAU; }, g);
    // sign over the doors
    p.box(16.4, 1.7, 0.2, M("#1d2b4f"), 0, 7.4, 5.1); p.geo(new THREE.PlaneGeometry(16, 1.4), signMat("jstation", "JUMPI STATION", { bg: "#1d2b4f", fg: "#ffd23a", w: 1024, h: 90, size: 70 }), 0, 7.4, 5.22, 0, false);
    // big glass doors
    [-4, 0, 4].forEach((x) => { p.box(2.6, 3.4, 0.1, M("#2a3c4c", { roughness: 0.1, metalness: 0.5 }), x, 1.7, 5.04); p.box(2.9, 3.7, 0.06, M("#efe3c8"), x, 1.85, 5.0); });
  }
  // the square in front: pavers, a round flower bed, benches, taxis and a bus stop
  pave(B, -74, 14, -38, 20.5, pav, [4, 4], 0.04);
  flowerBed(B.P(-59, 17.4), 0, 0, 8, 2.4, 51);
  [-70, -48].forEach((x) => bench(B.P(x, 16.4), 0, 0, Math.PI));
  [-72, -46].forEach((x) => B.lamp(x, 18.6, 0, "park"));
  car(B.P(-42, 6), 0, 0, 0, "#ffd23a", "taxi"); car(B.P(-42, -0.8 + 12), 0, 0, 0, "#ffd23a", "taxi");
  busStop(B.P(-90, 19.6), 0, 0, Math.PI);
  car(B.P(-104, 30), 0, 0, Math.PI, "#1f6bff", "bus");
  // parking cars
  [[-89.4, 5.2], [-84, 5.2], [-78.6, 15]].forEach(([x, z], i) => car(B.P(x, z), 0, 0, i < 2 ? 0 : Math.PI, CAR_COLS[i + 2]));
  for (let x = -90; x < -40; x += 12) B.tree("round", x, -9.5 + 0, 0.8);
});

DISTRICT_BUILDERS.push(function shopping(B) {
  const pav = texMat(paversTex());
  // the pedestrian street
  pave(B, -94, 39.5, -38, 54.5, pav, [5, 5], 0.035);
  // shops, north side (doors face the street, south) — [x, width, sign, colours, goods, kind, action]
  const north = [
    [-87, 10, "BOUTIQUE", "#ff5fa8", "#ffe4f0", ["#ff5fa8", "#ffd23a", "#9b5cff", "#1fb6ff"], "clothes", "store:shop:shirt", "BROWSE CLOTHES"],
    [-76, 10, "TOY TOWN", "#2fb04e", "#e9fbe9", ["#ff4545", "#ffd23a", "#1fb6ff", "#2fd36b"], "toys", null, null],
    [-65, 10, "JUMPI HOME", "#1f6bff", "#e6f0ff", ["#c27a3e", "#2e8bff", "#ffd23a"], "boxes", "store:shop:furniture", "BROWSE FURNITURE"],
    [-54, 10, "PAWS & CLAWS", "#ff8a1c", "#fff1e0", ["#ff8a1c", "#c27a3e", "#ffd23a"], "boxes", "store:pets", "PET SHOP"],
    [-43.5, 9, "HAIR SALON", "#9b5cff", "#f1e9ff", ["#9b5cff", "#ff5fa8", "#ffd23a"], "boxes", "store:inventory:hair", "NEW HAIRSTYLE"],
  ];
  const styles = [["plaster", "#f6dcc4"], ["brick", "#b8644d"], ["plaster", "#cfe6f2"], ["siding", "#f2e6b8"], ["plaster", "#e4d4f2"]];
  north.forEach(([x, w, name, col, wall, goods, kind, act, label], i) => {
    const [st, wc] = styles[i % styles.length];
    building(B.P(x, 33, 0), { w, d: 12, floors: 1 + (i % 3 === 1 ? 2 : 1), style: st, wall: wc, opt: { shutter: i % 2 ? "#2f7d4f" : null, balcony: i === 2 }, roof: i % 2 ? "flat" : "gable", roofCol: ["#b5533a", "#4b5a6e", "#8a4a3a"][i % 3], shop: { key: "n" + i, wall, frame: shade(col, -0.25), goods, kind }, sign: { text: name, bg: col, fg: "#ffffff", stroke: "rgba(0,0,0,.25)" }, awning: { a: col, b: "#ffffff" } });
    if (act) spot("city:" + act, x, 40.6, label, act.startsWith("store:inventory") ? "dress" : "shop");
    if (name === "TOY TOWN") { const p = B.P(x, 39.1); p.box(4.2, 0.9, 0.06, M("#ffd23a"), 0, 2.6, 0.08); p.geo(new THREE.PlaneGeometry(4, 0.7), signMat("toysoon", "OPENING SOON!", { bg: "#ffd23a", fg: "#c8102e", w: 512, h: 90, size: 60 }), 0, 2.6, 0.12, 0, false); }
  });
  // shops, south side (doors face north)
  const south = [
    [-86, 12, "PASTA PALACE", "#d94a3a", "#fff1d6", ["#ffd23a", "#ff8a1c", "#d94a3a"], "food"],
    [-73, 10, "BOOK NOOK", "#2f7d4f", "#eef7e9", ["#1f6bff", "#d94a3a", "#ffd23a", "#2fb04e"], "boxes"],
    [-64, 8, "SCOOPS", "#ff5fa8", "#ffeef6", ["#ffb3d1", "#fff1c4", "#bfe3ff", "#c9a6ff"], "food"],
  ];
  south.forEach(([x, w, name, col, wall, goods, kind], i) => {
    building(B.P(x, 61, Math.PI), { w, d: 12, floors: 2 - (i % 2), style: i === 1 ? "brick" : "plaster", wall: ["#f2d0a8", "#a85a45", "#f6e4ee"][i], opt: { shutter: i === 0 ? "#8a2e22" : null }, roof: "flat", shop: { key: "s" + i, wall, frame: shade(col, -0.25), goods, kind }, sign: { text: name, bg: col, fg: "#ffffff", stroke: "rgba(0,0,0,.25)" }, awning: { a: col, b: "#ffffff" } });
  });
  [[-89, 51.2], [-83, 51.2], [-66, 51.4]].forEach(([x, z], i) => cafeTable(B.P(x, z), 0, 0, i < 2 ? "#d94a3a" : "#ff5fa8"));
  // down the middle: planters with trees, benches, lamps and a little fountain
  for (let x = -90; x <= -42; x += 12) { if (Math.abs(x - -66) < 4) continue; B.tree("blossom", x, 47, 0.75); const p = B.P(x, 47); p.cyl(1.05, 1.15, 0.5, M("#d8d2c4"), 0, 0.25, 0, 16); p.cyl(0.95, 0.95, 0.05, M("#5a3f2a"), 0, 0.5, 0, 16); p.colCircle(0, 0, 1.15);
    bench(B.P(x + 3.6, 44.2), 0, 0, 0); bench(B.P(x + 3.6, 49.8), 0, 0, Math.PI); }
  for (let x = -91; x <= -41; x += 10) { B.lamp(x, 41, 0, "park"); B.lamp(x + 5, 53, 0, "park"); COLS.push({ c: [x, 41], r: 0.25 }, { c: [x + 5, 53], r: 0.25 }); }
  { const p = B.P(-66, 47); p.cyl(2.4, 2.6, 0.6, M("#e9e2d6"), 0, 0.3, 0, 24); p.cyl(2.1, 2.1, 0.05, waterMat(), 0, 0.58, 0, 24); p.cyl(0.3, 0.4, 1.4, M("#e9e2d6"), 0, 1.0, 0, 12); p.cyl(0.9, 0.5, 0.25, M("#e9e2d6"), 0, 1.75, 0, 16); p.colCircle(0, 0, 2.7); }
  // the back of the north shops: a quiet lane with trees
  for (let x = -90; x < -40; x += 9) B.tree(x % 2 ? "round" : "tall", x, 23.5, 0.85);
  // cars in the shopping parking
  [[-55.2, 61], [-49.8, 61], [-44.4, 69]].forEach(([x, z], i) => car(B.P(x, z), 0, 0, i < 2 ? 0 : Math.PI, CAR_COLS[(i * 3 + 1) % CAR_COLS.length], i === 1 ? "hatch" : "sedan"));
  // the gateway arch over the street at both ends
  [-92.5, -39.5].forEach((x) => { const p = B.P(x, 47); [-6.6, 6.6].forEach((z) => { p.box(0.7, 6, 0.7, M("#ff5fa8"), 0, 3, z); p.colCircle(0, z, 0.5); }); p.box(0.8, 1.4, 14, M("#ff5fa8"), 0, 6.4, 0);
    p.geo(new THREE.PlaneGeometry(12, 1.1).rotateY(Math.sign(x + 66) * Math.PI / 2), signMat("shopst", "SHOPPING STREET", { bg: "#ff5fa8", fg: "#ffffff", w: 1024, h: 94, size: 70 }), Math.sign(x + 66) * 0.42, 6.4, 0, 0, false); });
});

DISTRICT_BUILDERS.push(function harbor(B) {
  const conc = texMat(concreteTex()), planks = texMat(planksTex()), stone = M("#9b968c", { roughness: 1 }), rock = M("#8a857b", { roughness: 1, flatShading: true });
  // the quay: concrete deck, a stone edge down into the water, bollards
  pave(B, -172, -46, -66, -20, conc, [6, 6], 0.05);
  for (let x = -172; x < -66; x += 20) { const p = B.P(x + 10, -46); p.box(20, 2.2, 0.8, stone, 0, -1.05, 0.2, 0, { cast: false }); p.box(20, 0.25, 1.0, M("#d6d2c8"), 0, 0.12, 0.3); }
  for (let x = -170; x < -68; x += 6) { if ([-152, -130, -108, -86].some((px) => Math.abs(px - x) < 3)) continue; const p = B.P(x, -45.2); p.cyl(0.22, 0.26, 0.6, M("#2b2f3a"), 0, 0.35, 0, 10); p.sphere(0.24, M("#2b2f3a"), 0, 0.68, 0, 1, 0.6, 1); p.colCircle(0, 0, 0.3); }
  // four wooden piers on posts, with boats
  const boatG = B.live(-120, -60), boats = [];
  [-152, -130, -108, -86].forEach((px, i) => {
    for (let z = -74; z < -46; z += 14) { const p = B.P(px, z + 7); p.geo(stripGeo(3.2, 14, 2, 2, 0.06), planks, 0, 0, 0, 0, false); p.box(3.4, 0.25, 14, M("#7a5232"), 0, -0.08, 0, 0, { cast: false });
      for (let k = -6; k <= 6; k += 4) [-1.4, 1.4].forEach((sx) => p.cyl(0.16, 0.16, 3.4, M("#5e3f25"), sx, -1.6, k, 8)); }
    for (let z = -72; z <= -50; z += 7) { const p = B.P(px, z); [-1.45, 1.45].forEach((sx) => { p.cyl(0.12, 0.14, 0.7, M("#5e3f25"), sx, 0.4, 0, 8); }); }
    // the boats on each side of the pier
    [-1, 1].forEach((side, k) => { const bz = -58 - k * 8 + (i % 2) * 4; boats.push(makeBoat(boatG, px + side * 4.2, bz, side > 0 ? Math.PI : 0, (i + k) % 3)); });
  });
  anim((t) => boats.forEach((b, i) => { b.position.y = -0.9 + Math.sin(t * 1.3 + i) * 0.08; b.rotation.z = Math.sin(t * 1.1 + i * 2) * 0.04; b.rotation.x = Math.sin(t * 0.9 + i) * 0.025; }), boatG);
  // the breakwater (big rocks) out to the lighthouse
  { const R = rng(77); for (let z = -84; z < -46; z += 1.6) [-1, 1].forEach((s) => { const p = B.P(-168 + s * 4.6, z); p.put(unitGeo("dodeca", () => new THREE.DodecahedronGeometry(1, 0)), rock, 0, -0.4, 0, R() * 3, 1.4 + R() * 0.6, 1 + R() * 0.5, 1.3 + R() * 0.5); });
    pave(B, -172, -84, -164, -46, conc, [6, 6], 0.05); }
  lighthouse(B, -168, -80);
  // sheds, crates and containers on the quay
  building(B.P(-161, -33, 0), { w: 20, d: 14, floors: 2, style: "metal", wall: "#5d7fa3", roof: "flat", roofStuff: false, trim: "#3e5b7a", sign: { text: "HARBOR STORAGE", bg: "#1d2b4f", fg: "#ffffff" } });
  [[-148, -40, "#e8423b"], [-148, -32.4, "#1f6bff"], [-148, -36.2, "#2fb04e", 2.6]].forEach(([x, z, c, y = 0]) => { container(B.P(x, z), 0, 0, Math.PI / 2, c, y); B.cell(x, z); COLS.push({ box: [x - 3, z - 1.2, x + 3, z + 1.2] }); });
  for (let i = 0; i < 7; i++) crate(B.P(-140 + (i % 3) * 1.2, -42 + Math.floor(i / 3) * 1.2), 0, 0, 1, i * 0.3);
  COLS.push({ box: [-140.7, -42.7, -137.4, -38.9] });
  gantryCrane(B, -120, -41);
  // the fish market and the marina office
  stall(B.P(-90, -30), 0, 0, Math.PI, "#1f7fd6", "FISH MARKET");
  building(B.P(-76, -30, Math.PI), { w: 10, d: 8, floors: 1, style: "siding", wall: "#e9f2fa", opt: { shutter: "#1f7fd6" }, roof: "gable", roofCol: "#1f7fd6", shop: { key: "marina", wall: "#ffffff", frame: "#1f7fd6", goods: ["#ffffff", "#1fb6ff", "#ffd23a"] }, sign: { text: "MARINA", bg: "#1f7fd6", fg: "#ffffff" } });
  // the entrance arch from Harbor Road
  { const p = B.P(-118, -21.5); [-5, 5].forEach((x) => { p.box(0.6, 6, 0.6, M("#1f7fd6"), x, 3, 0); p.colCircle(x, 0, 0.45); }); p.box(11, 1.3, 0.5, M("#1f7fd6"), 0, 6.2, 0); p.geo(new THREE.PlaneGeometry(10, 1).rotateY(Math.PI), signMat("jmarina", "JUMPI MARINA", { bg: "#1f7fd6", fg: "#ffffff", w: 1024, h: 102, size: 74 }), 0, 6.2, -0.27, 0, false); p.geo(new THREE.PlaneGeometry(10, 1), signMat("jmarina", "JUMPI MARINA", { bg: "#1f7fd6", fg: "#ffffff", w: 1024, h: 102, size: 74 }), 0, 6.2, 0.27, 0, false); }
  for (let x = -166; x <= -70; x += 12) B.lamp(x, -24, 0, "harbor"), COLS.push({ c: [x, -24], r: 0.25 });
  for (let x = -160; x <= -72; x += 16) bench(B.P(x + 6, -43.6), 0, 0, Math.PI, "#7a5232");
  [[-104.6, -36], [-110, -36], [-115.4, -28]].forEach(([x, z], i) => car(B.P(x, z), 0, 0, i < 2 ? 0 : Math.PI, CAR_COLS[(i * 5 + 2) % CAR_COLS.length], i === 2 ? "pickup" : "sedan"));
});
function makeBoat(g, x, z, ry, kind) {
  const b = new THREE.Group(); b.position.set(x, -0.9, z); b.rotation.y = ry; g.add(b);
  const acc = new Acc(), p = new Painter(acc), hullC = ["#ffffff", "#1f6bff", "#e8423b"][kind];
  const hull = new THREE.LatheGeometry([[0, 0], [0.9, 0.05], [1.25, 0.6], [1.3, 1.2]].map(([a, c]) => new THREE.Vector2(a, c)), 16); hull.scale(1, 1, 3.0);
  p.geo(hull, M(hullC, { roughness: 0.4 }), 0, 0, 0); p.box(2.3, 0.08, 5.6, M("#c99a63"), 0, 1.15, 0, 0, { cast: false }); p.box(2.62, 0.14, 7.6, M(shade(hullC, -0.15)), 0, 1.2, 0, 0, { cast: false });
  if (kind === 0) { p.cyl(0.08, 0.1, 8, M("#d9dde3", { metalness: 0.6 }), 0, 5, 0.4, 8); p.put(unitGeo("sail", () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0, 6.2); s.lineTo(3, 0.2); s.closePath(); return new THREE.ShapeGeometry(s); }), M("#fffaf0", { side: THREE.DoubleSide, roughness: 0.8 }), 0.05, 1.5, 0.5, -Math.PI / 2); }
  else { p.box(1.9, 1.0, 2.4, M("#f6f6f2"), 0, 1.7, -0.6); p.box(1.95, 0.5, 2.0, M("#2a3c4c", { roughness: 0.1, metalness: 0.5 }), 0, 1.9, -0.5); p.box(2.1, 0.12, 2.6, M(shade(hullC, -0.2)), 0, 2.25, -0.6); }
  acc.build(b); b.traverse((o) => (o.matrixAutoUpdate = true));
  return b;
}
function lighthouse(B, x, z) {
  const p = B.P(x, z), R = M("#e8423b"), W = M("#f6f6f2");
  p.cyl(2.6, 3.0, 1.2, M("#9b968c"), 0, 0.6, 0, 16);
  for (let k = 0; k < 5; k++) p.cyl(1.9 - k * 0.16, 2.06 - k * 0.16, 2.4, k % 2 ? W : R, 0, 1.2 + 1.2 + k * 2.4, 0, 20);
  p.cyl(1.7, 1.7, 0.3, M("#2b2f3a"), 0, 13.4, 0, 20); p.cyl(1.2, 1.2, 1.6, glowMat("#fff4c0", 2.4), 0, 14.4, 0, 16); p.cone(1.5, 1.4, M("#2b2f3a"), 0, 15.9, 0, 16); p.sphere(0.25, M("#ffd23a", { metalness: 0.6 }), 0, 16.7, 0);
  for (let a = 0; a < 16; a++) p.box(0.06, 0.8, 0.06, M("#2b2f3a"), Math.cos((a / 16) * TAU) * 1.65, 14.0, Math.sin((a / 16) * TAU) * 1.65);
  p.colCircle(0, 0, 2.6);
  // the turning beam (only at night)
  const g = B.live(x, z), beam = new THREE.Mesh(new THREE.ConeGeometry(4, 30, 20, 1, true), new THREE.MeshBasicMaterial({ color: "#fff4c0", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.geometry.translate(0, -15, 0); beam.geometry.rotateZ(Math.PI / 2); const piv = new THREE.Group(); piv.position.set(x, 14.4, z); piv.add(beam); g.add(piv); BEAMS.push(beam.material);
  anim((t) => { piv.rotation.y = t * 0.6; }, g);
}
const BEAMS = [];
function gantryCrane(B, x, z) {
  const p = B.P(x, z), Y = M("#ffb21f", { roughness: 0.5, metalness: 0.3 });
  [[-5, -3], [5, -3], [-5, 3], [5, 3]].forEach(([a, b]) => { p.box(0.6, 14, 0.6, Y, a, 7, b); p.colCircle(a, b, 0.5); });
  p.box(11, 0.8, 0.8, Y, 0, 14, -3); p.box(11, 0.8, 0.8, Y, 0, 14, 3); p.box(1.2, 1.2, 22, Y, 0, 15, -6); p.box(2.6, 2.2, 2.6, M("#e8423b"), 0, 13.6, -9); p.box(2.4, 1.0, 2.4, M("#2a3c4c", { roughness: 0.1 }), 0, 13.9, -9);
  p.cyl(0.04, 0.04, 8, M("#2b2f3a"), 0, 9.2, -12, 6); container(p, 0, -12, Math.PI / 2, "#9b5cff", 2.6);
}

DISTRICT_BUILDERS.push(function industrial(B) {
  const conc = texMat(concreteTex());
  pave(B, -172, 0, -106, 74, conc, [6, 6], 0.03);
  building(B.P(-154, 13), { w: 28, d: 18, floors: 3, style: "metal", wall: "#7a8fa6", roof: "flat", trim: "#5b6f86", roofStuff: false, sign: { text: "JUMPI LOGISTICS", bg: "#1d2b4f", fg: "#ffd23a" } });
  // JUMPI MOTORS: the vehicle showroom (its door opens the Shop on Vehicles), three bikes on turntables out front
  building(B.P(-123, 12), { w: 22, d: 16, floors: 1, style: "modern", wall: "#20242e", opt: { glass: "#3d6f99", litRate: 0.9 }, roof: "flat", trim: "#ff6a1c", roofStuff: true,
    shop: { key: "motors", wall: "#ffffff", frame: "#ff6a1c", goods: ["#ff6a1c", "#1fb6ff", "#ffd23a", "#e8423b"] }, sign: { text: "JUMPI MOTORS", bg: "#ff6a1c", fg: "#ffffff" } });
  spot("city:store:shop:vehicle", -123, 21.6, "BUY A VEHICLE", "bike", 2.4);
  pave(B, -134, 20.4, -112, 27, texMat(paversTex()), [2, 2], 0.05);
  [[-130, 24, 13], [-123, 24.6, 15], [-116, 24, 11]].forEach(([x, z, vi], k) => { const p = B.P(x, z); p.cyl(1.9, 2.0, 0.22, M("#e9eef4", { metalness: 0.3, roughness: 0.35 }), 0, 0.11, 0, 28); p.put(unitGeo("tturn", () => new THREE.TorusGeometry(1.92, 0.06, 6, 40).rotateX(Math.PI / 2)), glowMat("#ff6a1c", 1.8), 0, 0.22, 0, 0); p.colCircle(0, 0, 2.0);
    paintObject(B.cell(x, z).acc, buildBike(VEHICLES[vi]), x, 0.24 + (vi === 15 ? 0.25 : 0), z, -0.6 + k * 0.6); });
  // loading doors
  [[-160, 22.1], [-148, 22.1]].forEach(([x, z]) => { const p = B.P(x, z); p.box(4, 4.4, 0.08, M("#d8dde3", { metalness: 0.4, roughness: 0.4 }), 0, 2.2, 0); for (let k = 0; k < 9; k++) p.box(4, 0.04, 0.1, M("#a9b0b8"), 0, 0.3 + k * 0.48, 0.04); p.box(4.4, 0.4, 1.6, M("#3b3f4a"), 0, 4.7, 0.8); });
  // the toy factory with two chimneys (puffing smoke)
  building(B.P(-155, 44), { w: 26, d: 22, floors: 3, style: "brick", wall: "#a04a36", opt: { frame: "#e9e0cc" }, roof: "gable", roofCol: "#5a6270", sign: { text: "TOY FACTORY", bg: "#ffd23a", fg: "#c8102e" } });
  const smoke = [];
  [[-162, 36], [-150, 36]].forEach(([x, z]) => { const p = B.P(x, z); p.cyl(1.1, 1.4, 22, M("#9b4a38"), 0, 11, 0, 14); p.cyl(1.25, 1.25, 0.6, M("#2b2f3a"), 0, 22, 0, 14); [6, 12, 18].forEach((y) => p.cyl(1.32, 1.32, 0.4, M("#f4f1ea"), 0, y, 0, 14)); smoke.push([x, 22.6, z]); });
  puffs(B, smoke);
  // the container yard
  const cols = ["#e8423b", "#1f6bff", "#2fb04e", "#ff8a1c", "#9b5cff", "#1fb6c9", "#ffd23a"];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const x = -132 + i * 6.5, z = 34 + j * 7.2, h = 1 + ((i * 7 + j * 3) % 3); for (let k = 0; k < h; k++) container(B.P(x, z), 0, 0, 0, cols[(i * 3 + j + k * 2) % cols.length], k * 2.62); COLS.push({ box: [x - 1.3, z - 3.1, x + 1.3, z + 3.1] }); }
  metalFence(B.P(-136, 28), 0, 0, 28, 0); metalFence(B.P(-108, 28), 0, 0, 0, 28);
  // the water tower
  { const p = B.P(-120, 64), I = M("#6b7787", { metalness: 0.5, roughness: 0.4 }); [[-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(([a, b]) => { p.cyl(0.18, 0.18, 12, I, a, 6, b, 8); p.colCircle(a, b, 0.3); }); p.cyl(3.6, 3.6, 5, M("#9fb3c8", { metalness: 0.4, roughness: 0.4 }), 0, 14.5, 0, 24); p.cone(3.9, 2, M("#7d8fa3", { metalness: 0.4 }), 0, 18, 0, 24);
    p.geo(new THREE.PlaneGeometry(5, 1.4), signMat("wtjumpi", "JUMPI", { bg: null, fg: "#ffffff", w: 512, h: 140, size: 120, stroke: "#1d2b4f" }), 0, 14.6, 3.62, 0, false); }
  // trucks and a forklift
  car(B.P(-140, 26), 0, 0, Math.PI / 2, "#ffffff", "van"); car(B.P(-112, 28), 0, 0, 0, "#ff8a1c", "van");
  { const p = B.P(-118, 46, 0.5); p.box(1.4, 1.2, 2.2, M("#ffb21f"), 0, 0.9, 0); p.box(1.3, 1.2, 0.06, M("#2a3c4c"), 0, 2.0, -0.3); p.box(1.4, 0.08, 1.4, M("#2b2f3a"), 0, 2.6, -0.2); p.box(0.1, 2.4, 0.1, M("#2b2f3a"), -0.5, 1.3, 1.25); p.box(0.1, 2.4, 0.1, M("#2b2f3a"), 0.5, 1.3, 1.25); p.box(1.0, 0.08, 1.0, M("#2b2f3a"), 0, 0.3, 1.8); p.colCircle(0, 0.4, 1.4); }
  for (let i = 0; i < 6; i++) barrel(B.P(-111, 60), (i % 3) * 0.85, Math.floor(i / 3) * 0.85, ["#2f6fd6", "#e8423b", "#2fb04e"][i % 3]);
  for (let x = -168; x < -108; x += 16) B.lamp(x, 30, 0, "street"), COLS.push({ c: [x, 30], r: 0.25 });
});
// smoke puffs that rise from chimneys (a few spheres each, recycled)
function puffs(B, sources) {
  const g = B.live(sources[0][0], sources[0][2]), m = new THREE.MeshStandardMaterial({ color: "#e8eaee", transparent: true, opacity: 0.6, roughness: 1, depthWrite: false }), list = [];
  sources.forEach(([x, y, z], si) => { for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(sphG(10, 8), m.clone()); s.userData = { x, y, z, ph: i / 7 + si * 0.13 }; g.add(s); list.push(s); } });
  anim((t) => list.forEach((s) => { const k = (t * 0.12 + s.userData.ph) % 1; s.position.set(s.userData.x + k * 4 + Math.sin(t + s.userData.ph * 9) * 0.4, s.userData.y + k * 9, s.userData.z + k * 1.5); s.scale.setScalar(0.8 + k * 2.6); s.material.opacity = 0.55 * (1 - k); }), g);
}

/* =====================================================================
   HOMES: Maple Neighborhood and Sunny Hills Suburbs
   ===================================================================== */
// a quiet lane (narrow road with sidewalks) along x
function lane(B, x0, x1, z, w = 6) {
  const roadM = texMat(asphaltTex(), { roughness: 0.95 }), walkM = texMat(sidewalkTex());
  pave(B, x0, z - w / 2, x1, z + w / 2, roadM, [8, 8], 0.02);
  pave(B, x0, z - w / 2 - 1.8, x1, z - w / 2, walkM, [2, 2], 0.05); pave(B, x0, z + w / 2, x1, z + w / 2 + 1.8, walkM, [2, 2], 0.05);
  for (let x = x0; x < x1; x += 20) { const e = Math.min(x1, x + 20), p = B.P((x + e) / 2, z); [-1, 1].forEach((s) => p.box(e - x, 0.1, 0.14, M("#c9c5bc"), 0, 0.05, s * (w / 2 + 0.07), 0, { cast: false })); for (let k = x + 2; k < e - 1; k += 6) p.box(2.2, 0.012, 0.14, M("#f4f4ef"), k - (x + e) / 2, 0.028, 0, 0, { cast: false }); }
}
const HOUSE_LOOKS = [
  { style: "siding", wall: "#f6e7c8", roofCol: "#b5533a", door: "#c8483d", shutter: "#2f7d4f" },
  { style: "siding", wall: "#cfe6f2", roofCol: "#4b5a6e", door: "#1f6bff", shutter: "#ffffff" },
  { style: "plaster", wall: "#fbe1d0", roofCol: "#8a4a3a", door: "#2f7d4f", shutter: "#8a4a3a" },
  { style: "brick", wall: "#b8644d", roofCol: "#3f4a5a", door: "#ffd23a", shutter: null },
  { style: "siding", wall: "#e4f2d6", roofCol: "#a5523f", door: "#9b5cff", shutter: "#ffffff" },
  { style: "plaster", wall: "#fff3c4", roofCol: "#4f7a5a", door: "#e8423b", shutter: "#4f7a5a" },
  { style: "siding", wall: "#f2d9e8", roofCol: "#5a4a6e", door: "#1fb6c9", shutter: "#ffffff" },
];
function homePlot(B, x, z, facing, look, o = {}) {
  // facing = +1: the front looks south (+z); -1: north
  const ry = facing > 0 ? 0 : Math.PI, d = o.d || 8, front = z + facing * (d / 2);
  house(B.P(x, z, ry), { ...look, w: o.w || 9, d, garage: o.garage !== false, porch: true, floors: o.floors || 2 });
  // front garden: a path to the door, a fence with a gate, flowers, a mailbox
  const gz = front + facing * 3.6, fz = front + facing * 6.4, wd = (o.w || 9) / 2 + 5;
  pave(B, x - 0.7, Math.min(front + facing * 2.4, fz), x + 0.7, Math.max(front + facing * 2.4, fz), texMat(sidewalkTex()), [2, 2], 0.04);
  picketFence(B.P(x - wd, fz), 0, 0, wd * 2, 0, "#ffffff", [wd - 1.0, wd + 1.0]);
  flowerBed(B.P(x - 3.4, gz), 0, 0, 3.2, 1.2, x * 7 + z); flowerBed(B.P(x + 3.4 - (o.garage !== false ? 0 : 0), gz), 0, 0, 2.2, 1.2, x * 3 + z);
  { const p = B.P(x + 1.6, fz + facing * 0.5); p.cyl(0.05, 0.05, 1.1, M("#5e3f25"), 0, 0.55, 0, 6); p.box(0.36, 0.3, 0.5, M(look.door), 0, 1.2, 0); p.box(0.04, 0.14, 0.18, M("#e8423b"), 0.2, 1.38, 0.08); p.colCircle(0, 0, 0.2); }
  // driveway + a car by the garage
  if (o.garage !== false) { const gx = x + (facing > 0 ? 1 : -1) * ((o.w || 9) / 2 + 2.2);
    pave(B, gx - 1.9, Math.min(front, fz + facing * 1.5), gx + 1.9, Math.max(front, fz + facing * 1.5), texMat(concreteTex()), [4, 4], 0.04);
    if (o.car !== false) car(B.P(gx, front + facing * 3.4), 0, 0, facing > 0 ? 0 : Math.PI, CAR_COLS[Math.abs(Math.round(x + z)) % CAR_COLS.length], ["sedan", "hatch", "pickup", "van"][Math.abs(Math.round(x)) % 4]); }
  // backyard trees
  B.tree(Math.abs(x) % 2 ? "round" : "tall", x - 3, z - facing * (d / 2 + 4), 0.9); B.tree("bush", x + 3.5, z - facing * (d / 2 + 2.2), 0.9);
}
DISTRICT_BUILDERS.push(function residential(B) {
  lane(B, -94, -38, 117);
  [-84, -66, -48].forEach((x, i) => homePlot(B, x, 102.6, 1, HOUSE_LOOKS[i]));
  [-84, -66].forEach((x, i) => homePlot(B, x, 131.4, -1, HOUSE_LOOKS[i + 3]));
  playground(B, -48, 134);
  for (let x = -90; x <= -42; x += 12) { B.lamp(x, 112.2, 0, "park"); COLS.push({ c: [x, 112.2], r: 0.25 }); B.tree("round", x + 6, 121.8, 0.75); }
  sideSignPost(B, -92, 113.4, "MAPLE LANE");
  // cars in the neighborhood parking
  [[-89.4, 142], [-84, 142]].forEach(([x, z], i) => car(B.P(x, z), 0, 0, 0, CAR_COLS[(i * 4 + 3) % CAR_COLS.length]));
});
function sideSignPost(B, x, z, text) { streetSign(B.P(x, z), 0, 0, 0, text); }
function playground(B, x, z) {
  const p = B.P(x, z), sand = texMat(canvasTex("sandbox", 128, 128, (c, w, h) => { c.fillStyle = "#f2d9a0"; c.fillRect(0, 0, w, h); grain(c, w, h, 1500, 0.2, 41, 2); }));
  p.geo(stripGeo(14, 14, 4, 4, 0.04), sand, 0, 0, 0, 0, false);
  // a slide tower
  const Y = M("#ffd23a"), R = M("#ff4545"), Bl = M("#1f6bff");
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => p.cyl(0.1, 0.1, 2.6, Bl, -3 + a, 1.3, -2 + b, 8)); p.box(2.4, 0.15, 2.4, M("#c27a3e"), -3, 1.6, -2); p.cone(1.8, 1.2, R, -3, 3.2, -2, 4, { ry: Math.PI / 4 });
  p.box(0.9, 0.08, 4.2, Y, -3, 0.85, 1.2, 0, { rx: 0.38 }); p.colBox(-4.3, -3.3, -1.7, -0.7);
  // swings
  [[2.5, 2.5]].forEach(([sx, sz]) => { [-1.8, 1.8].forEach((dx) => { p.cyl(0.07, 0.07, 3, Bl, sx + dx, 1.4, sz - 0.6, 6, { rx: 0.2 }); p.cyl(0.07, 0.07, 3, Bl, sx + dx, 1.4, sz + 0.6, 6, { rx: -0.2 }); }); p.cyl(0.08, 0.08, 3.8, Bl, sx, 2.85, sz, 8, { rz: Math.PI / 2 }); p.colBox(sx - 2, sz - 0.9, sx + 2, sz + 0.9); });
  const g = B.live(x, z), seats = [];
  [-0.8, 0.8].forEach((dx, i) => { const piv = new THREE.Group(); piv.position.set(x + 2.5 + dx, 2.85, z + 2.5); g.add(piv); const acc = new Acc(), q = new Painter(acc); q.cyl(0.015, 0.015, 2.1, M("#9aa3ad"), -0.25, -1.05, 0, 4); q.cyl(0.015, 0.015, 2.1, M("#9aa3ad"), 0.25, -1.05, 0, 4); q.box(0.65, 0.06, 0.3, R, 0, -2.1, 0); acc.build(piv); piv.traverse((o) => (o.matrixAutoUpdate = true)); seats.push(piv); });
  anim((t) => seats.forEach((s, i) => (s.rotation.x = Math.sin(t * 1.7 + i * 1.3) * 0.45)), g);
  // a seesaw and benches for the grown-ups
  p.box(3.6, 0.12, 0.3, Bl, 2.5, 0.55, -3, 0, { rz: 0.18 }); p.cone(0.35, 0.5, Y, 2.5, 0.25, -3, 4); p.colBox(0.6, -3.3, 4.4, -2.7);
  bench(p, -5.6, 5.4, Math.PI / 2); bench(p, 5.6, 5.4, -Math.PI / 2);
  B.tree("round", x - 6, z - 6, 0.9); B.tree("blossom", x + 6, z - 6.5, 0.8);
}
DISTRICT_BUILDERS.push(function suburbs(B) {
  lane(B, -172, -106, 117, 7);
  [[-158, 1, 0], [-126, 1, 1], [-158, -1, 2], [-126, -1, 6]].forEach(([x, f, li]) => {
    const z = f > 0 ? 101.5 : 132.5;
    homePlot(B, x, z, f, HOUSE_LOOKS[li], { w: 12, d: 9.5 });
    // a big backyard with a pool behind a hedge
    const bz = z - f * 12.5, p = B.P(x, bz);
    p.box(9.4, 0.3, 5.4, M("#f4f1ea"), 0, 0.15, 0); p.geo(new THREE.PlaneGeometry(8.4, 4.4).rotateX(-Math.PI / 2), waterMat("#1aa3d8", "#7fe8ff"), 0, 0.28, 0, 0, false); p.colBox(-4.8, -2.8, 4.8, 2.8);
    [-3.4, -1.6].forEach((lx) => { p.box(0.7, 0.1, 1.8, M("#ffffff"), lx + 9, 0.4, 0, 0, {}); p.box(0.7, 0.5, 0.1, M("#ffffff"), lx + 9, 0.6, -0.85, 0, { rx: 0.5 }); });
    hedge(B.P(x, bz - f * 4.6), 0, 0, 22, 1.1); 
    B.tree("pine", x - 9, bz, 1.0); B.tree("tall", x + 10, bz + f * 2, 1.0); B.tree("round", x + 9, z + f * 1, 0.8);
  });
  for (let x = -166; x <= -112; x += 14) { B.lamp(x, 112.5, 0, "park"); COLS.push({ c: [x, 112.5], r: 0.25 }); }
  sideSignPost(B, -108, 112.2, "SUNNY HILLS DRIVE");
  // the cul-de-sac end: a round turning circle with a tree in the middle
  { const p = B.P(-169, 117); p.cyl(1.6, 1.6, 0.4, M("#d8d2c4"), 0, 0.2, 0, 20); p.colCircle(0, 0, 1.6); } B.tree("round", -169, 117, 1.1);
});

/* =====================================================================
   CENTRAL PARK: the lake with a bridge, a fountain, a gazebo, a picnic meadow and ducks
   ===================================================================== */
// a flat elliptical ring (path) with pavers along it
function ellipseRing(cx, cz, rx, rz, w, seg = 96) {
  const pos = [], uv = [], idx = []; let len = 0, px = cx + rx, pz = cz;
  for (let i = 0; i <= seg; i++) { const a = (i / seg) * TAU, c = Math.cos(a), s = Math.sin(a), x = cx + rx * c, z = cz + rz * s;
    len += Math.hypot(x - px, z - pz); px = x; pz = z; const nx = c / rx, nz = s / rz, nl = Math.hypot(nx, nz);
    pos.push(x - (nx / nl) * (w / 2), 0, z - (nz / nl) * (w / 2), x + (nx / nl) * (w / 2), 0, z + (nz / nl) * (w / 2)); uv.push(len / 4, 0, len / 4, w / 4);
    if (i) { const b = (i - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
DISTRICT_BUILDERS.push(function centralPark(B) {
  const L = B.L.LAKES.find((l) => l.id === "central"), pav = texMat(paversTex()), stone = M("#d9d2c4", { roughness: 0.9 });
  const lx = L.x, lz = L.z;
  // the lake: stone rim, water, lily pads, a reed corner
  new Painter(B.cell(lx, lz).acc).geo(ellipseRing(lx, lz, L.rx + 0.4, L.rz + 0.4, 1.2), stone, 0, 0.09, 0, 0, false);
  new Painter(B.cell(lx, lz).acc).geo(ellipseRing(lx, lz, L.rx + 6, L.rz + 6, 3.2), pav, 0, 0.04, 0, 0, false);
  { const g = new THREE.CircleGeometry(1, 64); g.rotateX(-Math.PI / 2); g.scale(L.rx, 1, L.rz); new Painter(B.cell(lx, lz).acc).geo(g, waterMat("#1677a8", "#47c6d6"), lx, 0.07, lz, 0, false); }
  { const R = rng(5); for (let i = 0; i < 18; i++) { const a = R() * TAU, r = 0.55 + R() * 0.35, x = lx + Math.cos(a) * L.rx * r, z = lz + Math.sin(a) * L.rz * r; if (Math.abs(z - lz) < 2.2) continue; const p = B.P(x, z); p.cyl(0.5 + R() * 0.3, 0.5, 0.02, M("#3f9a3d"), 0, 0.11, 0, 10); if (R() < 0.3) p.sphere(0.12, M("#ff9ccf"), 0.15, 0.18, 0.1, 1, 0.6, 1, [8, 6]); } }
  // the bridge across the middle (walk on it: BRIDGES in the layout)
  { const [bx0, bz0, bx1, bz1] = B.L.BRIDGES[0], cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2, len = bx1 - bx0, p = B.P(cx, cz);
    p.geo(stripGeo(len, bz1 - bz0, 2, 2, 0.45), texMat(planksTex()), 0, 0, 0, 0, false); p.box(len, 0.35, bz1 - bz0, M("#8a5a34"), 0, 0.26, 0, 0, { cast: false });
    [-1, 1].forEach((s) => { for (let x = -len / 2; x <= len / 2; x += 2) p.box(0.14, 1.0, 0.14, M("#8a5a34"), x, 0.95, s * 1.3); p.box(len, 0.12, 0.16, M("#a87545"), 0, 1.4, s * 1.3); COLS.push({ box: [bx0, cz + s * 1.3 - 0.12, bx1, cz + s * 1.3 + 0.12] }); });
    for (let x = -12; x <= 12; x += 6) p.box(0.5, 1.2, 2.6, stone, x, -0.4, 0); }
  // paths: from each entrance to the lake path
  pave(B, lx - 1.6, 86, lx + 1.6, lz - L.rz - 7.6, pav, [4, 4], 0.04);
  pave(B, -26, lz - 1.6, lx - L.rx - 7.6, lz + 1.6, pav, [4, 4], 0.04);
  pave(B, lx + L.rx + 7.6, lz - 1.6, 30, lz + 1.6, pav, [4, 4], 0.04);
  pave(B, lx - 1.6, lz + L.rz + 7.6, lx + 1.6, 148, pav, [4, 4], 0.04);
  // the welcome arch and a fountain at the north entrance
  { const p = B.P(lx, 88); [-4.5, 4.5].forEach((x) => { p.box(0.9, 5, 0.9, stone, x, 2.5, 0); p.colCircle(x, 0, 0.6); p.put(unitGeo("ico1", () => new THREE.IcosahedronGeometry(1, 1)), M("#3f9a3d", { flatShading: true }), x, 5.6, 0, 0, 0.8, 0.8, 0.8); });
    p.box(9.6, 1.2, 0.4, M("#2f9a43"), 0, 4.4, 0); p.geo(new THREE.PlaneGeometry(9, 1).rotateY(Math.PI), signMat("cpark", "CENTRAL PARK", { bg: "#2f9a43", fg: "#ffffff", w: 1024, h: 114, size: 82 }), 0, 4.4, -0.22, 0, false); }
  { const p = B.P(lx, 97); p.cyl(3.4, 3.6, 0.7, stone, 0, 0.35, 0, 28); p.geo(new THREE.CircleGeometry(3.1, 28).rotateX(-Math.PI / 2), waterMat("#1aa3d8", "#7fe8ff"), 0, 0.66, 0, 0, false); p.cyl(0.4, 0.55, 1.8, stone, 0, 1.2, 0, 14); p.cyl(1.4, 0.6, 0.35, stone, 0, 2.2, 0, 18); p.cyl(0.25, 0.3, 0.9, stone, 0, 2.8, 0, 12); p.colCircle(0, 0, 3.7); fountainJets(B, lx, 97, 3.3); }
  flowerBed(B.P(lx - 8, 97), 0, 0, 4, 6, 71); flowerBed(B.P(lx + 8, 97), 0, 0, 4, 6, 72);
  // a white gazebo
  { const gx = -17, gz = 139, p = B.P(gx, gz), w = M("#f6f4ee");
    p.cyl(4.2, 4.4, 0.25, M("#e9e2d6"), 0, 0.12, 0, 8); for (let a = 0; a < 8; a++) { const x = Math.cos((a / 8) * TAU + Math.PI / 8) * 3.8, z = Math.sin((a / 8) * TAU + Math.PI / 8) * 3.8; p.cyl(0.14, 0.16, 3.2, w, x, 1.85, z, 8); COLS.push({ c: [gx + x, gz + z], r: 0.25 }); }
    p.cone(4.9, 2.2, M("#2f7d6b"), 0, 4.55, 0, 8); p.cyl(4.3, 4.3, 0.25, w, 0, 3.45, 0, 8); p.sphere(0.25, M("#ffd23a", { metalness: 0.6 }), 0, 5.8, 0); bench(p, 0, -2.4, 0, "#ffffff"); }
  // the picnic meadow
  { const R = rng(23), cols = [["#e8423b", "#ffffff"], ["#1f6bff", "#ffffff"], ["#ffd23a", "#ff8a1c"], ["#2fb04e", "#ffffff"]];
    for (let i = 0; i < 4; i++) { const x = 16 + (i % 2) * 7, z = 130 + Math.floor(i / 2) * 8, p = B.P(x, z, R() * 0.6);
      const tex = canvasTex("blanket" + i, 128, 128, (c, w, h) => { c.fillStyle = cols[i][1]; c.fillRect(0, 0, w, h); c.fillStyle = cols[i][0]; for (let k = 0; k < 8; k++) { c.globalAlpha = 0.7; c.fillRect(k * 16, 0, 8, h); c.fillRect(0, k * 16, w, 8); } }, { repeat: false });
      p.geo(new THREE.PlaneGeometry(3, 2.4).rotateX(-Math.PI / 2), texMat(tex), 0, 0.05, 0, 0, false);
      p.box(0.6, 0.35, 0.4, M("#c99a63"), 0.8, 0.2, 0.5); p.cyl(0.3, 0.3, 0.04, M("#ffffff"), -0.6, 0.08, -0.3, 14); p.sphere(0.12, M("#e8423b"), -0.6, 0.18, -0.3, 1, 1, 1, [8, 6]); }
    [[24, 141], [14, 143]].forEach(([x, z]) => { const p = B.P(x, z); p.box(2.6, 0.1, 1.0, WOOD(), 0, 0.78, 0); [-1, 1].forEach((s) => { p.box(2.6, 0.08, 0.35, WOOD(), 0, 0.45, s * 0.75); p.box(0.1, 0.78, 1.6, WOOD(), s * 1.1, 0.39, 0); }); p.colBox(-1.4, -1.0, 1.4, 1.0); }); }
  // benches around the lake, facing the water
  for (let a = 0; a < TAU - 0.01; a += TAU / 10) { if (Math.abs(Math.sin(a)) < 0.25) continue; const x = lx + Math.cos(a) * (L.rx + 4.2), z = lz + Math.sin(a) * (L.rz + 4.2); bench(B.P(x, z), 0, 0, -a - Math.PI / 2); }
  for (let a = 0.3; a < TAU; a += TAU / 8) { const x = lx + Math.cos(a) * (L.rx + 8.6), z = lz + Math.sin(a) * (L.rz + 8.6); B.lamp(x, z, 0, "park"); COLS.push({ c: [x, z], r: 0.25 }); }
  // trees everywhere else
  { const R = rng(91); let n = 0; for (let i = 0; i < 400 && n < 90; i++) { const x = -24 + R() * 52, z = 88 + R() * 58;
      if (((x - lx) / (L.rx + 9.5)) ** 2 + ((z - lz) / (L.rz + 9.5)) ** 2 < 1) continue; if (Math.abs(x - lx) < 4 || Math.abs(z - lz) < 3.5) continue;
      if (x > 11 && z > 125) continue; if (Math.hypot(x + 17, z - 139) < 7) continue; if (x > 12 && z < 102) continue; if (Math.abs(x - lx) < 13 && z < 102) continue;
      B.tree(["round", "round", "tall", "blossom", "pine", "autumn"][Math.floor(R() * 6)], x, z, 0.9 + R() * 0.35); COLS.push({ c: [x, z], r: 0.55 }); n++; } }
  // ducks on the lake
  const g = B.live(lx, lz), ducks = [];
  for (let i = 0; i < 5; i++) { const d = new THREE.Group(), acc = new Acc(), q = new Painter(acc), white = i % 2 ? M("#ffffff") : M("#8a6a4a");
    q.sphere(0.32, white, 0, 0.15, 0, 1, 0.75, 1.35); q.sphere(0.2, i % 2 ? M("#ffffff") : M("#2f7d4f"), 0, 0.45, 0.32); q.cone(0.08, 0.2, M("#ff9a1f"), 0, 0.42, 0.55, 6, { rx: Math.PI / 2 }); q.sphere(0.035, M("#111"), 0.09, 0.5, 0.45); q.sphere(0.035, M("#111"), -0.09, 0.5, 0.45);
    acc.build(d); d.traverse((o) => (o.matrixAutoUpdate = true)); g.add(d); ducks.push({ d, r: 0.35 + i * 0.1, sp: 0.06 + i * 0.012, ph: i * 1.3 }); }
  anim((t) => ducks.forEach((u) => { const a = t * u.sp + u.ph; u.d.position.set(lx + Math.cos(a) * L.rx * u.r, 0.08 + Math.sin(t * 3 + u.ph) * 0.02, lz + Math.sin(a) * L.rz * u.r); u.d.rotation.y = -a + Math.PI; }), g);
  [[17.2, 90], [22.6, 90], [25.2, 98]].forEach(([x, z], i) => car(B.P(x, z), 0, 0, i < 2 ? 0 : Math.PI, CAR_COLS[(i * 2 + 5) % CAR_COLS.length], "hatch"));
});
// little water jets (a few droplets going up and falling back), for fountains
function fountainJets(B, x, z, top) {
  const g = B.live(x, z), n = 120, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: "#dff6ff", size: 0.16, transparent: true, opacity: 0.85, depthWrite: false })); pts.frustumCulled = false; g.add(pts);
  const seed = Array.from({ length: n }, (_, i) => [Math.random(), Math.random() * TAU, 0.6 + Math.random() * 0.8]);
  anim((t) => { for (let i = 0; i < n; i++) { const [ph, a, s] = seed[i], k = (t * 0.9 + ph) % 1, r = k * s; pos[i * 3] = x + Math.cos(a) * r; pos[i * 3 + 1] = top + k * 2.2 - k * k * 2.6; pos[i * 3 + 2] = z + Math.sin(a) * r; } geo.attributes.position.needsUpdate = true; }, g);
}

/* =====================================================================
   EAST: Food Street, Fun District, Police, School, Hospital, Airport, the Boardwalk
   ===================================================================== */
// string lights between two points (a sagging line of glowing bulbs)
function stringLights(B, a, b, n = 14, sag = 0.9) {
  const p = B.P((a[0] + b[0]) / 2, (a[2] + b[2]) / 2), cols = ["#ffd23a", "#ff5fa8", "#1fb6ff", "#2fd36b", "#ff8a1c"];
  for (let i = 0; i <= n; i++) { const k = i / n, x = lerp(a[0], b[0], k) - (a[0] + b[0]) / 2, z = lerp(a[2], b[2], k) - (a[2] + b[2]) / 2, y = lerp(a[1], b[1], k) - Math.sin(k * Math.PI) * sag;
    p.sphere(0.11, glowMat(cols[i % cols.length], 2.2), x, y, z, 1, 1.2, 1, [6, 5]); }
}
function bigFood(p, kind, x, y, z) {   // giant food signs on the roofs
  if (kind === "pizza") { p.put(unitGeo("pizzaWedge", () => new THREE.CylinderGeometry(2.4, 2.4, 0.3, 24, 1, false, -0.5, 1.0)), M("#ffcf5a"), x, y, z, 0, 1, 1, 1, Math.PI / 2 - 0.2); p.put(unitGeo("pizzaCrust", () => new THREE.CylinderGeometry(2.45, 2.45, 0.5, 24, 1, true, -0.5, 1.0)), M("#d58a3a"), x, y, z - 0.05, 0, 1, 1, 1, Math.PI / 2 - 0.2);
    [[0.6, 1.2], [-0.4, 1.6], [0.1, 0.6]].forEach(([a, b]) => p.cyl(0.3, 0.3, 0.1, M("#d9312b"), x + a, y + b * 0.95, z + 0.2, 12, { rx: Math.PI / 2 - 0.2 })); }
  if (kind === "burger") { p.sphere(1.6, M("#e8a24a"), x, y + 0.2, z, 1, 0.5, 1); p.cyl(1.7, 1.7, 0.45, M("#6b3a1e"), x, y + 0.75, z, 20); p.cyl(1.82, 1.8, 0.12, M("#ffd23a"), x, y + 1.05, z, 6); p.cyl(1.78, 1.78, 0.14, M("#4fc04a"), x, y + 1.17, z, 18); p.sphere(1.65, M("#f0a94a"), x, y + 1.3, z, 1, 0.62, 1); }
  if (kind === "cup") { p.cyl(1.1, 0.8, 1.8, M("#ffffff"), x, y + 0.9, z, 20); p.cyl(1.0, 1.0, 0.1, M("#6b3a1e"), x, y + 1.78, z, 20); p.put(unitGeo("torusH", () => new THREE.TorusGeometry(0.5, 0.14, 8, 16)), M("#ffffff"), x + 1.1, y + 0.95, z, 0); [0, 1].forEach((k) => p.sphere(0.25 + k * 0.08, M("#ffffff", { transparent: true, opacity: 0.6 }), x - 0.2 + k * 0.4, y + 2.4 + k * 0.6, z)); }
  if (kind === "popcorn") { p.cyl(1.1, 0.85, 2, texMat(stripeTex("#e8423b", "#ffffff", 12)), x, y + 1, z, 16); for (let i = 0; i < 9; i++) p.sphere(0.4, M("#fff6dc"), x + Math.cos(i) * 0.6, y + 2.1 + (i % 3) * 0.2, z + Math.sin(i) * 0.6); }
  if (kind === "pin") { p.put(unitGeo("pin", () => new THREE.LatheGeometry([[0, 0], [0.55, 0.05], [0.75, 0.8], [0.6, 1.6], [0.32, 2.1], [0.42, 2.6], [0.38, 3.0], [0, 3.15]].map(([a, b]) => new THREE.Vector2(a, b)), 18)), M("#ffffff", { roughness: 0.3 }), x, y, z, 0, 1.3, 1.3, 1.3); p.cyl(0.36, 0.42, 0.25, M("#e8423b"), x, y + 2.65 * 1.3, z, 18); }
}
DISTRICT_BUILDERS.push(function foodStreet(B) {
  const pav = texMat(paversTex());
  pave(B, 42, 56, 80, 74, pav, [5, 5], 0.035);
  const shops = [
    [49, 12, "JUMPI PIZZA", "#2f9a43", "#e8423b", "#fff6e6", "pizza", "plaster", "#fff1d6", "BUY PIZZA", "pizza"],
    [62.5, 11, "BURGER BARN", "#d94a3a", "#ffd23a", "#fff1e0", "burger", "siding", "#c24a3a", "BUY A BURGER", "burger"],
    [75, 10, "CLOUD CAFE", "#5aa0ff", "#ffffff", "#eef6ff", "cup", "plaster", "#d8ecff", "BUY A TREAT", "cafe"],
  ];
  shops.forEach(([x, w, name, c1, c2, wall, big, st, wc, label, stand], i) => {
    const H = building(B.P(x, 50, 0), { w, d: 12, floors: 1, style: st, wall: wc, opt: { shutter: i === 0 ? "#2f9a43" : null }, roof: "flat", roofStuff: false, shop: { key: "f" + i, wall, frame: shade(c1, -0.2), goods: [c1, c2, "#ffffff"], kind: "food" }, sign: { text: name, bg: c1, fg: "#ffffff", stroke: "rgba(0,0,0,.25)" }, awning: { a: c1, b: c2 } });
    bigFood(B.P(x, 50), big, 0, H + 0.6, 2);
    spot("city:stand:" + stand, x, 57.6, label, "stand");
  });
  // tables with umbrellas, a taco truck and an ice cream truck, string lights over it all
  [[46, 63], [52, 66], [58, 63], [64, 66], [70, 63], [76, 66]].forEach(([x, z], i) => cafeTable(B.P(x, z), 0, 0, ["#e8423b", "#ffd23a", "#5aa0ff"][i % 3]));
  car(B.P(86, 68), 0, 0, Math.PI / 2, "#ff8a1c", "van"); { const p = B.P(86, 68, Math.PI / 2); p.box(3.0, 0.08, 1.4, texMat(stripeTex("#ff8a1c", "#ffd23a", 8)), 0, 2.4, -1.6, 0, { rx: -0.3 }); sideSign(p, "TACO TRUCK", 0, 2.1, 1.0, 3.0, 0.6, { bg: "#ffd23a", fg: "#c8102e" }); }
  spot("city:stand:taco", 86, 70.6, "BUY TACOS", "stand");
  car(B.P(95, 66), 0, 0, Math.PI / 2, "#ff9ccf", "van");
  for (let x = 44; x <= 80; x += 9) { const p = B.P(x, 72.6); p.cyl(0.08, 0.1, 5, M("#3b3f4a", { metalness: 0.5 }), 0, 2.5, 0, 8); p.colCircle(0, 0, 0.2); }
  for (let x = 44; x < 80; x += 9) stringLights(B, [x, 4.8, 72.6], [x + 9, 4.8, 72.6], 12, 0.7);
  for (let x = 44; x <= 80; x += 18) stringLights(B, [x, 4.8, 72.6], [x, 4.0, 56.4], 14, 1.0);
  [[84.6, 48], [90, 48], [95.4, 58]].forEach(([x, z], i) => car(B.P(x, z), 0, 0, i < 2 ? 0 : Math.PI, CAR_COLS[(i * 3 + 4) % CAR_COLS.length]));
});

DISTRICT_BUILDERS.push(function funDistrict(B) {
  const pav = texMat(paversTex());
  pave(B, 112, 56, 156, 62, pav, [5, 5], 0.035);
  // the arcade: dark walls, neon
  const ah = building(B.P(121, 50), { w: 14, d: 12, floors: 1, style: "concrete", wall: "#3a2a6e", roof: "flat", trim: "#9b5cff", shop: { key: "arcade", wall: "#2a1f50", frame: "#9b5cff", goods: ["#ff2fa0", "#1fb6ff", "#ffd23a", "#2fd36b"], kind: "toys" }, sign: { text: "GAME ZONE", bg: "#1a1240", fg: "#ff5fe8", stroke: "#ffffff" } });
  { const p = B.P(121, 56.2); [-5.2, 5.2].forEach((x) => p.box(0.18, 3.6, 0.1, glowMat("#ff2fa0", 2.4), x, 2.0, 0)); p.box(10.6, 0.16, 0.1, glowMat("#1fb6ff", 2.4), 0, 3.85, 0); }
  spot("city:act:arcade", 121, 57.8, "PLAY GAMES", "game");
  // the cinema: a marquee with bulbs and posters
  const ch = building(B.P(140, 51), { w: 20, d: 14, floors: 2, style: "plaster", wall: "#d94a3a", opt: { frame: "#ffd23a" }, roof: "flat", trim: "#ffd23a", shop: { key: "cinema", wall: "#fff1d6", frame: "#8a1c1c", goods: ["#1d2b4f", "#ffd23a", "#d94a3a"] } });
  { const p = B.P(140, 58.4); p.box(14, 1.8, 1.6, M("#1d2b4f"), 0, 5.2, 0); p.geo(new THREE.PlaneGeometry(13, 1.2), signMat("cinema", "JUMPI CINEMA", { bg: "#1d2b4f", fg: "#ffd23a", w: 1024, h: 94, size: 72 }), 0, 5.2, 0.81, 0, false);
    for (let x = -6.8; x <= 6.8; x += 0.7) { p.sphere(0.09, glowMat("#fff1b0", 2.4), x, 6.15, 0.8); p.sphere(0.09, glowMat("#fff1b0", 2.4), x, 4.25, 0.8); }
    const posters = [["#ff5fa8", "SPACE JUMP"], ["#1fb6ff", "OCEAN PALS"], ["#2fb04e", "DINO DAY"]];
    posters.forEach(([c, t], i) => { const x = -6 + i * 6; p.box(2.2, 3.0, 0.1, M("#ffd23a"), x, 2.0, -0.6); p.geo(new THREE.PlaneGeometry(2, 2.8), signMat("poster" + i, t, { bg: c, fg: "#ffffff", w: 256, h: 360, size: 52, stroke: "rgba(0,0,0,.3)" }), x, 2.0, -0.53, 0, false); }); }
  bigFood(B.P(149, 51), "popcorn", 0, ch + 0.4, -3);
  spot("city:stand:popcorn", 133, 59.4, "BUY POPCORN", "stand");
  // the Ferris wheel (it turns; the cabins stay upright)
  { const cx = 165, cz = 60, R = 10.5, H = 12.5, p = B.P(cx, cz), steel = M("#e8eef6", { metalness: 0.6, roughness: 0.3 });
    [-1, 1].forEach((s) => { p.box(0.5, H + 1, 0.5, steel, -4.5, H / 2, s * 2.2, 0, { rz: -0.35 }); p.box(0.5, H + 1, 0.5, steel, 4.5, H / 2, s * 2.2, 0, { rz: 0.35 }); });
    p.box(10, 0.6, 6, M("#d8d2c4"), 0, 0.3, 0); p.colBox(-5.5, -3.2, 5.5, 3.2);
    p.cyl(0.5, 0.5, 5, steel, 0, H, 0, 14, { rx: Math.PI / 2 });
    const g = B.live(cx, cz), wheel = new THREE.Group(); wheel.position.set(cx, H, cz); g.add(wheel);
    const acc = new Acc(), q = new Painter(acc), rimM = M("#ff5fa8", { metalness: 0.3, roughness: 0.4 });
    [-1.6, 1.6].forEach((z) => { q.put(unitGeo("fwRim", () => new THREE.TorusGeometry(1, 0.025, 8, 64)), rimM, 0, 0, z, 0, R, R, R); for (let a = 0; a < 16; a++) q.box(0.12, R, 0.12, steel, Math.cos((a / 16) * TAU) * R / 2, Math.sin((a / 16) * TAU) * R / 2, z, 0, { rz: (a / 16) * TAU - Math.PI / 2 }); });
    for (let a = 0; a < 32; a++) q.sphere(0.12, glowMat(["#ffd23a", "#1fb6ff", "#ff5fa8"][a % 3], 2.6), Math.cos((a / 32) * TAU) * R, Math.sin((a / 32) * TAU) * R, 1.75, 1, 1, 1, [6, 5]);
    acc.build(wheel); wheel.traverse((o) => (o.matrixAutoUpdate = true));
    const cabins = [], cols = ["#ffd23a", "#1fb6ff", "#2fd36b", "#ff8a1c", "#9b5cff", "#e8423b", "#ff5fa8", "#12b8a0"];
    for (let i = 0; i < 8; i++) { const c = new THREE.Group(), a2 = new Acc(), r = new Painter(a2); r.cyl(0.04, 0.04, 1.0, steel, 0, -0.5, 0, 6); r.box(1.6, 1.1, 1.6, M(cols[i], { roughness: 0.4 }), 0, -1.5, 0); r.box(1.7, 0.6, 1.7, M("#2a3c4c", { roughness: 0.1 }), 0, -1.25, 0); r.box(1.8, 0.15, 1.8, M(cols[i]), 0, -0.9, 0);
      a2.build(c); c.traverse((o) => (o.matrixAutoUpdate = true)); g.add(c); cabins.push(c); }
    anim((t) => { const rot = t * 0.08; wheel.rotation.z = rot; cabins.forEach((c, i) => { const a = rot + (i / 8) * TAU; c.position.set(cx + Math.cos(a) * R, H + Math.sin(a) * R, cz); }); }, g); }
  // a ticket kiosk, benches, lamps and cars
  stall(B.P(156, 66), 0, 0, Math.PI, "#9b5cff", "TICKETS");
  for (let x = 114; x <= 154; x += 10) B.lamp(x, 62.5, 0, "park"), COLS.push({ c: [x, 62.5], r: 0.25 });
  [116, 128].forEach((x) => bench(B.P(x, 59), 0, 0, Math.PI));
  [[116.4, 64], [121.8, 64], [127.2, 70]].forEach(([x, z], i) => car(B.P(x, z), 0, 0, i < 2 ? 0 : Math.PI, CAR_COLS[(i + 6) % CAR_COLS.length]));
});

DISTRICT_BUILDERS.push(function police(B) {
  const pav = texMat(paversTex()), conc = texMat(concreteTex());
  // the station: blue and white, POLICE in big letters, a light bar
  const H = building(B.P(127, 12), { w: 26, d: 18, floors: 3, style: "modern", wall: "#e9eef6", opt: { glass: "#244a8a" }, roof: "flat", trim: "#1f4fd6", shop: { key: "police", wall: "#e9eef6", frame: "#1f4fd6", goods: ["#1f4fd6", "#ffffff"] } });
  { const p = B.P(127, 21.3); p.box(14, 1.6, 0.3, M("#1f4fd6"), 0, 5.0, 0); p.geo(new THREE.PlaneGeometry(13.4, 1.3), signMat("policeS", "POLICE", { bg: "#1f4fd6", fg: "#ffffff", w: 1024, h: 100, size: 80 }), 0, 5.0, 0.16, 0, false);
    p.box(3.4, 0.4, 0.4, M("#2b2f3a"), 0, H + 1.0, -9); p.box(1.5, 0.3, 0.3, glowMat("#3d7bff", 3), -0.8, H + 1.35, -9); p.box(1.5, 0.3, 0.3, glowMat("#ff3b30", 3), 0.8, H + 1.35, -9);
    // a police shield badge on the wall
    p.put(unitGeo("badge", () => { const s = new THREE.Shape(); s.moveTo(0, 1.2); s.lineTo(1, 0.8); s.lineTo(0.9, -0.2); s.quadraticCurveTo(0.6, -1, 0, -1.3); s.quadraticCurveTo(-0.6, -1, -0.9, -0.2); s.lineTo(-1, 0.8); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.15, bevelEnabled: false }); }), M("#ffd23a", { metalness: 0.6, roughness: 0.3 }), 0, 8.4, -0.1, 0, 1, 1, 1); }
  pave(B, 112, 21.5, 146, 42, pav, [5, 5], 0.035);
  flagpole(B, 118, 26, "#1f4fd6"); flagpole(B, 136, 26, "#2fb04e");
  [[124, 34], [130, 34]].forEach(([x, z]) => B.tree("round", x, z, 0.9));
  [[121, 38], [133, 38]].forEach(([x, z]) => bench(B.P(x, z), 0, 0, Math.PI));
  for (let x = 114; x <= 144; x += 10) { B.lamp(x, 40.5, 0, "park"); COLS.push({ c: [x, 40.5], r: 0.25 }); }
  // city flats with shops at the bottom
  building(B.P(152, 4), { w: 14, d: 14, floors: 4, style: "brick", wall: "#b8644d", opt: { balcony: true }, roof: "flat", shop: { key: "market", wall: "#f2fbe9", frame: "#2f9a43", goods: ["#e8423b", "#ffd23a", "#2fb04e", "#ff8a1c"], kind: "food" }, sign: { text: "MINI MARKET", bg: "#2f9a43", fg: "#ffffff" }, awning: { a: "#2f9a43", b: "#ffffff" } });
  building(B.P(168, 4), { w: 13, d: 14, floors: 5, style: "plaster", wall: "#e4d4f2", opt: { shutter: "#5a4a6e", balcony: true }, roof: "flat", shop: { key: "laundry", wall: "#ffffff", frame: "#1fb6c9", goods: ["#ffffff", "#bfe3ff"] }, sign: { text: "BUBBLE WASH", bg: "#1fb6c9", fg: "#ffffff" }, awning: { a: "#1fb6c9", b: "#ffffff" } });
  pave(B, 145, 11.2, 176, 17, texMat(sidewalkTex()), [2, 2], 0.05);
  // police cars in the parking
  [[152.6, 21], [158, 21], [163.4, 21], [168.8, 21], [155.3, 37], [160.7, 37]].forEach(([x, z], i) => car(B.P(x, z), 0, 0, i < 4 ? 0 : Math.PI, "#f6f6f2", "police"));
});

DISTRICT_BUILDERS.push(function school(B) {
  const asph = texMat(asphaltTex(), { roughness: 0.95 }), line = M("#f4f4ef");
  // the school: brick, three floors, a clock, its name
  building(B.P(66, 95, Math.PI), { w: 40, d: 14, floors: 3, style: "brick", wall: "#b45a3f", opt: { frame: "#f4ead6" }, roof: "flat", trim: "#efe3c8", sign: { text: "JUMPI SCHOOL", bg: "#ffb21f", fg: "#1d2b4f" } });
  building(B.P(52, 112), { w: 12, d: 20, floors: 2, style: "brick", wall: "#b45a3f", opt: { frame: "#f4ead6" }, roof: "flat", trim: "#efe3c8" });
  { const p = B.P(66, 88); p.cyl(1.4, 1.4, 0.2, M("#f6f2e6"), 0, 9.6, -0.15, 28, { rx: Math.PI / 2 }); p.cyl(1.55, 1.55, 0.12, M("#2b2f3a"), 0, 9.6, -0.1, 28, { rx: Math.PI / 2 }); p.box(0.08, 1.0, 0.08, M("#1d2027"), 0, 9.95, -0.32); p.box(0.7, 0.08, 0.08, M("#1d2027"), 0.3, 9.6, -0.32); }
  flagpole(B, 56, 86.5, "#ffb21f");
  // the community center next door
  building(B.P(93, 94, Math.PI), { w: 10, d: 12, floors: 1, style: "plaster", wall: "#cfe6c4", opt: { shutter: "#2f7d4f" }, roof: "gable", roofCol: "#2f7d4f", shop: { key: "community", wall: "#ffffff", frame: "#2f7d4f", goods: ["#2fb04e", "#ffd23a", "#1fb6ff"], kind: "plants" }, sign: { text: "COMMUNITY CENTER", bg: "#2f7d4f", fg: "#ffffff" } });
  // the yard: a basketball court and a football pitch
  pave(B, 62, 106, 86, 121, asph, [8, 8], 0.03);
  { const p = B.P(74, 113.5); p.box(23, 0.01, 0.1, line, 0, 0.04, -7.3, 0, { cast: false }); p.box(23, 0.01, 0.1, line, 0, 0.04, 7.3, 0, { cast: false }); p.box(0.1, 0.01, 14.6, line, -11.5, 0.04, 0, 0, { cast: false }); p.box(0.1, 0.01, 14.6, line, 11.5, 0.04, 0, 0, { cast: false }); p.box(0.1, 0.01, 14.6, line, 0, 0.04, 0, 0, { cast: false });
    p.put(unitGeo("ring2", () => new THREE.TorusGeometry(1, 0.03, 6, 40).rotateX(Math.PI / 2)), line, 0, 0.04, 0, 0, 2, 1, 2, 0, 0, false);
    [-1, 1].forEach((s) => { p.cyl(0.1, 0.1, 3.4, M("#2b2f3a"), s * 12.4, 1.7, 0, 8); p.box(0.1, 1.2, 1.8, M("#ffffff"), s * 12.1, 3.3, 0); p.put(unitGeo("hoop", () => new THREE.TorusGeometry(0.24, 0.03, 6, 16).rotateX(Math.PI / 2)), M("#ff8a1c"), s * 11.7, 3.0, 0); COLS.push({ c: [74 + s * 12.4, 113.5], r: 0.25 }); }); }
  const turf = texMat(canvasTex("turf", 256, 256, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#3fae4a" : "#4cbc55"; c.fillRect(0, (i * h) / 8, w, h / 8); } grain(c, w, h, 2000, 0.08, 61, 2); }));
  pave(B, 60, 124, 98, 146, turf, [38, 22], 0.03);
  { const p = B.P(79, 135), W = 36, D = 20; p.box(W, 0.01, 0.12, line, 0, 0.045, -D / 2, 0, { cast: false }); p.box(W, 0.01, 0.12, line, 0, 0.045, D / 2, 0, { cast: false }); p.box(0.12, 0.01, D, line, -W / 2, 0.045, 0, 0, { cast: false }); p.box(0.12, 0.01, D, line, W / 2, 0.045, 0, 0, { cast: false }); p.box(0.12, 0.01, D, line, 0, 0.045, 0, 0, { cast: false });
    p.put(unitGeo("ring3", () => new THREE.TorusGeometry(1, 0.03, 6, 40).rotateX(Math.PI / 2)), line, 0, 0.045, 0, 0, 3, 1, 3, 0, 0, false);
    [-1, 1].forEach((s) => { const gx = s * (W / 2); p.box(0.12, 2.0, 0.12, M("#ffffff"), gx, 1.0, -2.4); p.box(0.12, 2.0, 0.12, M("#ffffff"), gx, 1.0, 2.4); p.box(0.12, 0.12, 4.9, M("#ffffff"), gx, 2.0, 0);
      p.put(planeG(), M("#ffffff", { transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }), gx + s * 0.8, 1.0, 0, 0, 1.6, 1, 4.8, Math.PI / 2 - s * 0.4, 0, false); COLS.push({ box: [79 + gx - 0.9, 135 - 2.6, 79 + gx + 0.9, 135 + 2.6] }); }); }
  // a ball on the pitch and a playground by the wing
  { const p = B.P(82, 133); p.sphere(0.32, texMat(canvasTex("ball", 128, 64, (c, w, h) => { c.fillStyle = "#fff"; c.fillRect(0, 0, w, h); c.fillStyle = "#1d2b4f"; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(i * 24 + 10, (i % 2) * 30 + 16, 8, 0, TAU); c.fill(); } }, { repeat: false })), 0, 0.32, 0); }
  playground(B, 48, 136);
  car(B.P(44, 128), 0, 0, 0, "#ffc21a", "bus");
  for (let x = 46; x <= 96; x += 12) { B.lamp(x, 86.6, 0, "park"); COLS.push({ c: [x, 86.6], r: 0.25 }); }
  [[90.6, 108], [96, 108]].forEach(([x, z], i) => car(B.P(x, z), 0, 0, 0, CAR_COLS[(i * 5) % CAR_COLS.length]));
  for (let z = 104; z <= 146; z += 7) B.tree("round", 58.5, z, 0.75);
});

DISTRICT_BUILDERS.push(function hospital(B) {
  const pav = texMat(paversTex());
  const H = building(B.P(136, 101, Math.PI), { w: 40, d: 20, floors: 4, style: "modern", wall: "#f4f8fb", opt: { glass: "#3a8fa8" }, roof: "flat", trim: "#ff4f6d", roofStuff: false });
  { const p = B.P(136, 91); // the entrance canopy and the sign with a heart
    p.box(14, 0.4, 4, M("#ffffff"), 0, 4.2, -1.8); [-6, 6].forEach((x) => { p.cyl(0.18, 0.18, 4.2, M("#dfe6ec"), x, 2.1, -3.4, 10); p.colCircle(x, -3.4, 0.3); });
    p.box(16, 1.8, 0.3, M("#ffffff"), 0, 9.2, 0.1, 0, {}); p.geo(new THREE.PlaneGeometry(15.4, 1.5).rotateY(Math.PI), signMat("hosp", "JUMPI HOSPITAL", { bg: "#ffffff", fg: "#ff4f6d", w: 1024, h: 100, size: 76 }), 0, 9.2, -0.06, 0, false);
    p.put(unitGeo("heart", () => { const s = new THREE.Shape(); s.moveTo(0, -1); s.bezierCurveTo(-0.2, -0.75, -1.1, -0.2, -1.05, 0.35); s.bezierCurveTo(-1.0, 0.95, -0.25, 1.05, 0, 0.55); s.bezierCurveTo(0.25, 1.05, 1.0, 0.95, 1.05, 0.35); s.bezierCurveTo(1.1, -0.2, 0.2, -0.75, 0, -1); return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 }); }), glowMat("#ff4f6d", 1.6), 0, 12.6, -0.6, Math.PI, 1.3, 1.3, 1.3); }
  // the helipad on the roof
  { const p = B.P(146, 104); p.cyl(5, 5, 0.12, M("#3b3f4a"), 0, H + 0.08, 0, 32); p.put(unitGeo("ring5", () => new THREE.TorusGeometry(1, 0.06, 6, 48).rotateX(Math.PI / 2)), M("#ffd23a"), 0, H + 0.15, 0, 0, 4.2, 1, 4.2, 0, 0, false);
    p.geo(new THREE.PlaneGeometry(4, 4).rotateX(-Math.PI / 2), signMat("helipadH", "H", { bg: null, fg: "#ffffff", w: 256, h: 256, size: 220 }), 0, H + 0.16, 0, 0, false); }
  // ambulances by the side door
  [[164, 96], [170, 96]].forEach(([x, z]) => car(B.P(x, z), 0, 0, Math.PI, "#ffffff", "ambulance"));
  // the clinic and the healing garden
  building(B.P(126, 130), { w: 18, d: 14, floors: 2, style: "plaster", wall: "#e9f6f2", opt: { shutter: "#3aa58a" }, roof: "gable", roofCol: "#3aa58a", sign: { text: "CLINIC", bg: "#3aa58a", fg: "#ffffff" } });
  pave(B, 138, 118, 148, 146, pav, [5, 5], 0.035);
  { const p = B.P(143, 130); p.cyl(2.2, 2.4, 0.6, M("#e9e2d6"), 0, 0.3, 0, 24); p.geo(new THREE.CircleGeometry(2, 24).rotateX(-Math.PI / 2), waterMat("#1aa3d8", "#7fe8ff"), 0, 0.57, 0, 0, false); p.colCircle(0, 0, 2.5); }
  [[143, 122], [143, 138]].forEach(([x, z]) => flowerBed(B.P(x, z), 0, 0, 6, 2.2, x + z));
  [[140, 126], [146, 134]].forEach(([x, z], i) => bench(B.P(x, z), 0, 0, i ? -Math.PI / 2 : Math.PI / 2));
  for (let z = 120; z <= 146; z += 8) B.tree("blossom", 149, z, 0.8);
  [[152.6, 124], [158, 124], [163.4, 124], [158, 144]].forEach(([x, z], i) => car(B.P(x, z), 0, 0, i < 3 ? 0 : Math.PI, CAR_COLS[(i * 7 + 1) % CAR_COLS.length]));
  for (let x = 116; x <= 172; x += 14) { B.lamp(x, 86.6, 0, "park"); COLS.push({ c: [x, 86.6], r: 0.25 }); }
});

DISTRICT_BUILDERS.push(function airport(B) {
  const asph = texMat(asphaltTex(), { roughness: 0.95 }), conc = texMat(concreteTex()), white = M("#f4f4ef", { roughness: 0.7 }), yellow = M("#ffd23a");
  // the terminal: glass, a wavy roof, its name
  { const p = B.P(204, 40, -Math.PI / 2);
    building(p, { w: 44, d: 22, floors: 2, style: "modern", wall: "#dfe8f1", opt: { glass: "#3d6f99", litRate: 0.8 }, roof: "flat", trim: "#5aa0ff", roofStuff: false });
    // three shallow barrel vaults (ribbed metal) with glass skylights along their tops, over a thin white canopy edge
    const vault = unitGeo("vault", () => { const g = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true, -0.62, 1.24); g.rotateZ(Math.PI / 2); g.rotateX(-Math.PI / 2); return g; });
    const ribs = texMat(metalRibTex("#e9eef4"), { side: THREE.DoubleSide, roughness: 0.45, metalness: 0.25 }), sky = M("#7fb6e0", { roughness: 0.08, metalness: 0.6 });
    p.box(48, 0.35, 26, M("#ffffff", { roughness: 0.4 }), 0, 7.1, 0);
    [-8.6, 0, 8.6].forEach((z) => { p.put(vault, ribs, 0, 7.27 - 7.2 * Math.cos(0.62), z, 0, 47.6, 7.2, 7.2); p.box(46, 0.12, 1.3, sky, 0, 7.27 - 7.2 * Math.cos(0.62) + 7.2 - 0.02, z); });
    for (let x = -22; x <= 22; x += 5.5) p.cyl(0.2, 0.2, 7, M("#dfe6ec"), x, 3.5, 12.5, 10);
    p.box(20, 1.6, 0.3, M("#1d2b4f"), 0, 8.1, 13.2); p.geo(new THREE.PlaneGeometry(19.4, 1.3), signMat("airport", "JUMPI AIRPORT", { bg: "#1d2b4f", fg: "#ffffff", w: 1024, h: 70, size: 56 }), 0, 8.1, 13.36, 0, false); }
  pave(B, 188.5, 14, 192, 66, texMat(sidewalkTex()), [2, 2], 0.05);
  [[190.5, 22], [190.5, 30], [190.5, 50], [190.5, 58]].forEach(([x, z]) => car(B.P(x, z), 0, 0, 0, "#ffd23a", "taxi"));
  // the control tower
  { const p = B.P(220, 78); p.cyl(1.8, 2.4, 22, M("#e9eef6"), 0, 11, 0, 18); p.cyl(3.6, 2.6, 1.2, M("#dfe6ec"), 0, 22.6, 0, 18); p.cyl(3.4, 3.4, 2.6, M("#2a4a68", { roughness: 0.1, metalness: 0.5 }), 0, 24.5, 0, 18); p.cyl(3.8, 3.6, 0.6, M("#ffffff"), 0, 26.1, 0, 18); p.cyl(0.08, 0.08, 3, M("#2b2f3a"), 0, 27.9, 0, 6); p.sphere(0.2, glowMat("#ff3b30", 3), 0, 29.5, 0); p.colCircle(0, 0, 2.5); }
  // the hangar (open, a little plane inside)
  { const p = B.P(208, 100); const arch = unitGeo("hangar", () => { const g = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true, -Math.PI / 2, Math.PI); g.rotateZ(Math.PI / 2); return g; });
    p.put(arch, texMat(metalRibTex("#8a99ab"), { side: THREE.DoubleSide }), 0, 0, 0, 0, 22, 9, 11); p.box(0.3, 9, 22, M("#7d8b9c"), -11, 4.5, 0); p.colBox(-11.3, -11, 11, -10); p.colBox(-11.3, 10, 11, 11); p.colBox(-11.3, -11, -10.4, 11);
    sideSign(p, "HANGAR 1", -10.7, 7, 0, 5, 1.2, { bg: "#ffd23a", fg: "#1d2b4f" }); }
  // the fence along the runway
  for (let z = -4; z < 158; z += 18) metalFence(B.P(225.6, z), 0, 0, 0, Math.min(18, 158 - z), 2.6);
  // apron, taxiway and runway
  pave(B, 226, -4, 236, 158, conc, [8, 8], 0.03);
  pave(B, 238, 0, 256, 156, asph, [8, 8], 0.035);
  for (let z = 6; z < 150; z += 9) B.P(247, z).box(0.6, 0.01, 4.5, white, 0, 0.05, 0, 0, { cast: false });
  [4, 152].forEach((z) => { for (let x = 240; x <= 254; x += 2) B.P(x, z).box(1.1, 0.01, 4.0, white, 0, 0.05, 0, 0, { cast: false }); });
  for (let z = 0; z < 156; z += 6) { B.P(238.6, z).sphere(0.12, glowMat("#9be8ff", 2.2), 0, 0.12, 0); B.P(255.4, z).sphere(0.12, glowMat("#9be8ff", 2.2), 0, 0.12, 0); }
  for (let z = 2; z < 156; z += 22) B.P(231, z).box(0.25, 0.01, 10, yellow, 0, 0.045, 0, 0, { cast: false });
  // planes: two parked at the terminal, one that takes off and lands
  [[231, 26], [231, 54]].forEach(([x, z], i) => { const g = B.live(x, z); const pl = makePlane(i ? "#1f6bff" : "#ff8a1c"); pl.position.set(x, 0, z); pl.rotation.y = -Math.PI / 2; g.add(pl); });
  { const g = B.live(247, 80), pl = makePlane("#e8423b"); g.add(pl);
    anim((t) => { const c = (t % 110) / 110; let z = 150, y = 0, ry = Math.PI, pitch = 0, seen = true;
      if (c < 0.12) { ry = lerp(0, Math.PI, smooth(0, 1, c / 0.12)); }                                   // turning round at the end of the runway
      else if (c < 0.42) { const k = (c - 0.12) / 0.3; z = 150 - 150 * k * k; y = k > 0.6 ? ((k - 0.6) / 0.4) ** 2 * 12 : 0; pitch = k > 0.6 ? 0.16 : 0; }   // taking off
      else if (c < 0.6) { const k = (c - 0.42) / 0.18; z = -170 * k; y = 12 + k * 62; pitch = 0.16; }       // climbing out over the sea
      else if (c < 0.74) { seen = false; }
      else { const k = (c - 0.74) / 0.26, e = 1 - (1 - k) * (1 - k); z = lerp(-260, 150, e); y = Math.max(0, ((20 - z) / 280) * 60); ry = 0; pitch = y > 0.5 ? -0.05 : 0; }   // landing
      pl.visible = seen; pl.position.set(247, y, z); pl.rotation.set(0, 0, 0); pl.rotateY(ry); pl.rotateX(-pitch); }, g); }
  [[193.4, 128], [198.8, 128], [204.2, 128], [209.6, 128], [198.8, 144], [204.2, 144]].forEach(([x, z], i) => car(B.P(x, z), 0, 0, i < 4 ? 0 : Math.PI, CAR_COLS[(i * 3 + 2) % CAR_COLS.length], i === 2 ? "van" : "sedan"));
  for (let z = 4; z <= 150; z += 16) { B.lamp(193.6, z, -Math.PI / 2, "street"); COLS.push({ c: [193.6, z], r: 0.25 }); }
});
function makePlane(col) {
  const g = new THREE.Group(), acc = new Acc(), p = new Painter(acc), white = M("#f6f6f2", { roughness: 0.35 }), c = M(col, { roughness: 0.4 });
  p.cyl(1.4, 1.4, 16, white, 0, 2.6, 0, 18, { rx: Math.PI / 2 }); p.sphere(1.4, white, 0, 2.6, 8, 1, 1, 1.6); p.cone(1.4, 4, white, 0, 2.9, -10, 18, { rx: -Math.PI / 2 });
  p.box(19, 0.3, 3.2, white, 0, 2.2, 0.5); p.box(0.3, 3.6, 2.6, c, 0, 5.0, -10.5); p.box(7, 0.25, 2, white, 0, 3.2, -10.6);
  p.box(2.84, 0.4, 14, c, 0, 2.0, 0); for (let z = -6; z <= 6; z += 1.2) [-1.38, 1.38].forEach((x) => p.box(0.05, 0.3, 0.5, M("#2a3c4c"), x, 3.0, z));
  p.box(2.4, 0.6, 0.06, M("#2a3c4c"), 0, 3.2, 10.0, 0, { rx: -0.6 });
  [-5, 5].forEach((x) => { p.cyl(0.65, 0.65, 2.4, M("#c9d0d8", { metalness: 0.5 }), x, 1.5, 1.3, 14, { rx: Math.PI / 2 }); });
  [[0, 6.5], [-1.6, -0.5], [1.6, -0.5]].forEach(([x, z]) => { p.cyl(0.06, 0.06, 1.2, M("#2b2f3a"), x, 0.9, z, 6); p.cyl(0.3, 0.3, 0.25, M("#1b1d22"), x, 0.3, z, 12, { rz: Math.PI / 2 }); });
  acc.build(g); g.traverse((o) => (o.matrixAutoUpdate = true)); return g;
}

DISTRICT_BUILDERS.push(function boardwalk(B) {
  const planks = texMat(planksTex());
  // the long promenade (planks) with a white railing on the beach side and steps down every so often
  pave(B, 28, -26, 284, -19.6, planks, [2, 6], 0.06);
  for (let x = 28; x < 284; x += 24) { const p = B.P(x + 12, -26.1); p.box(24, 0.42, 0.4, M("#8a5a34"), 0, -0.1, 0, 0, { cast: false });
    for (let k = 0; k < 24; k += 1.5) { if (k > 9 && k < 14) continue; p.cyl(0.06, 0.06, 1.0, M("#ffffff"), k - 12, 0.55, 0, 6); }
    p.box(9.5, 0.1, 0.12, M("#ffffff"), -7.25, 1.05, 0); p.box(9.5, 0.1, 0.12, M("#ffffff"), 7.25, 1.05, 0); }
  // stalls, benches facing the sea, palms and lamps
  const stalls = [[60, "#ffd23a", "LEMONADE", "lemon"], [100, "#1fb6ff", "SURF SHOP", null], [140, "#ff5fa8", "ICE CREAM", "beachice"], [190, "#9b5cff", "SOUVENIRS", null], [240, "#2fb04e", "FRESH FRUIT", "fruit"]];
  stalls.forEach(([x, col, name, stand]) => { stall(B.P(x, -21.4), 0, 0, Math.PI, col, name); if (stand) spot("city:stand:" + stand, x, -23.8, "BUY " + (stand === "lemon" ? "LEMONADE" : stand === "fruit" ? "FRUIT" : "ICE CREAM"), "stand"); });
  for (let x = 36; x < 284; x += 16) { if (stalls.some(([sx]) => Math.abs(sx - x) < 6)) continue; bench(B.P(x, -24.6), 0, 0, Math.PI, "#ffffff"); }
  for (let x = 32; x < 284; x += 16) { B.lamp(x + 8, -20.2, 0, "harbor"); COLS.push({ c: [x + 8, -20.2], r: 0.25 }); }
  // palms are the game's own (makePalm) — added by index.html? no: here as simple trees on the sand edge
  for (let x = 44; x < 284; x += 20) B.tree("tall", x, -17.8, 0.8);
  // umbrellas and towels on the sand
  { const R = rng(31); for (let i = 0; i < 26; i++) { const x = 50 + R() * 225, z = -32 - R() * 12; if (Math.abs(x - 150) < 6) continue; const p = B.P(x, z), col = ["#ff5f5f", "#1fb6ff", "#ffd23a", "#2fd36b", "#9b5cff", "#ff9a1f"][i % 6], y = -0.35 - (Math.abs(z) - 32) * 0.012;
      p.cyl(0.05, 0.05, 2.6, M("#ffffff"), 0, y + 1.3, 0, 6); p.put(coneG(10), texMat(stripeTex(col, "#ffffff", 10), { side: THREE.DoubleSide }), 0, y + 2.6, 0, 0, 1.6, 0.6, 1.6);
      const tex = canvasTex("towel" + (i % 4), 64, 128, (c, w, h) => { c.fillStyle = col; c.fillRect(0, 0, w, h); c.fillStyle = "#ffffff"; for (let k = 0; k < 4; k++) c.fillRect(0, k * 32 + 12, w, 8); }, { repeat: false });
      p.geo(new THREE.PlaneGeometry(1.1, 2.1).rotateX(-Math.PI / 2), texMat(tex), 1.2, y + 0.06, 0.4, R(), false); } }
  // the fishing pier and a lifeguard tower
  { for (let z = -74; z < -26; z += 12) { const p = B.P(150, z + 6); p.geo(stripGeo(3.2, 12, 2, 2, 0.06), planks, 0, 0, 0, 0, false); p.box(3.4, 0.25, 12, M("#7a5232"), 0, -0.08, 0, 0, { cast: false }); for (let k = -5; k <= 5; k += 4) [-1.4, 1.4].forEach((sx) => p.cyl(0.16, 0.16, 3.4, M("#5e3f25"), sx, -1.6, k, 8)); }
    const p = B.P(150, -72); [-1.5, 1.5].forEach((x) => { p.cyl(0.05, 0.05, 1, M("#ffffff"), x, 0.55, 0, 6); }); p.box(3.2, 0.1, 0.1, M("#ffffff"), 0, 1.05, 0); bench(B.P(150, -66), 0, 0, Math.PI, "#7a5232"); }
  { const p = B.P(118, -38), y = -0.45; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => p.cyl(0.1, 0.1, 3.2, M("#ffffff"), a * 0.9, y + 1.6, b * 0.9, 8)); p.box(2.4, 1.4, 2.4, M("#ff4545"), 0, y + 3.8, 0); p.box(2.8, 0.15, 2.8, M("#ffffff"), 0, y + 4.6, 0); p.box(0.8, 3.4, 0.08, M("#c99a63"), 0, y + 1.7, 1.6, 0, { rx: -0.35 }); p.colBox(-1.1, -1.1, 1.1, 1.1); }
  lighthouse(B, 274, -60);
  { const R = rng(13); for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; B.P(274 + Math.cos(a) * 5, -60 + Math.sin(a) * 5).put(unitGeo("dodeca", () => new THREE.DodecahedronGeometry(1, 0)), M("#8a857b", { roughness: 1, flatShading: true }), 0, -0.6, 0, R() * 3, 2 + R(), 1.4 + R(), 2 + R()); } }
});

/* =====================================================================
   NATURE: Whisper Hills, the waterfall, Pine Lake Camp, and the secret cave
   ===================================================================== */
// trails (dirt paths painted into the ground colours); the same lines are drawn on the map
export const TRAILS = [
  [[-40, 160], [-44, 176], [-52, 190], [-48, 199], [-50, 210.5], [-56, 211.6]],                   // from Hillside Road to the waterfall (and the cave…)
  [[-40, 160], [-30, 178], [-12, 192], [4, 206], [12, 220], [18, 230]],                            // up to Whisper Peak
  [[-52, 190], [-80, 188], [-104, 196], [-110, 212], [-104, 226], [-84, 232], [-62, 236]],        // round the plateau to the top of the falls
  [[-104, 196], [-122, 206], [-130, 220]],                                                          // to the windmill
  [[12, 220], [40, 214], [66, 196], [84, 182], [80, 166]],                                          // over the hill to the camp
];
function nearTrail(x, z) { let best = 99; for (const T of TRAILS) for (let i = 1; i < T.length; i++) { const [ax, az] = T[i - 1], [bx, bz] = T[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, k = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1); best = Math.min(best, Math.hypot(x - ax - dx * k, z - az - dz * k)); } return best; }
let CAMP_DOCK_Y = 0.05;
DISTRICT_BUILDERS.push(function terrain(B) {
  const grassTex = canvasTex("hillgrass", 256, 256, (c, w, h) => { c.fillStyle = "#ffffff"; c.fillRect(0, 0, w, h); const R = rng(71); for (let i = 0; i < 2600; i++) { c.fillStyle = R() < 0.5 ? "rgba(0,40,0,.10)" : "rgba(255,255,220,.14)"; c.fillRect(R() * w, R() * h, 2, 3); } });
  const m = new THREE.MeshStandardMaterial({ map: grassTex, vertexColors: true, roughness: 1 });
  const cGrass = new THREE.Color("#68bf52"), cGrass2 = new THREE.Color("#4f9f40"), cDry = new THREE.Color("#a9c25a"), cRock = new THREE.Color("#8d8678"), cDirt = new THREE.Color("#c29a6a"), cSand = new THREE.Color("#d8c48e"), tmp = new THREE.Color();
  const TILE = 40, SEG = 20;
  for (let x0 = -260; x0 < 340; x0 += TILE) for (let z0 = 160; z0 < 330; z0 += TILE) {
    const g = new THREE.PlaneGeometry(TILE, TILE, SEG, SEG); g.rotateX(-Math.PI / 2); g.translate(x0 + TILE / 2, 0, z0 + TILE / 2);
    const pos = g.attributes.position, cols = [], uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = hillHeight(x, z); pos.setY(i, h); uv.setXY(i, x / 6, z / 6);
      const sl = hillSlope(x, z), n = fbm(x * 0.06, z * 0.06);
      tmp.copy(cGrass).lerp(cGrass2, n).lerp(cDry, smooth(8, 24, h) * 0.5);
      if (h < -0.4) tmp.lerp(cSand, smooth(-0.4, -1.4, h));
      tmp.lerp(cRock, smooth(0.75, 1.3, sl));
      const tr = nearTrail(x, z); if (tr < 2.2) tmp.lerp(cDirt, (1 - smooth(1.2, 2.2, tr)) * 0.9);
      cols.push(tmp.r, tmp.g, tmp.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
    const ms = new THREE.Mesh(g, m); ms.receiveShadow = true; ms.castShadow = false; B.cell(x0 + TILE / 2, z0 + TILE / 2).group.add(ms);
  }
});
DISTRICT_BUILDERS.push(function hills(B) {
  const rock = M("#8d877b", { roughness: 1, flatShading: true }), dodec = unitGeo("dodeca", () => new THREE.DodecahedronGeometry(1, 0));
  const R = rng(1234), lakes = B.L.LAKES;
  // trees: pines up high, round trees lower, none on trails, lakes or the cliff
  let n = 0;
  for (let i = 0; i < 2600 && n < 520; i++) {
    const x = -250 + R() * 520, z = 162 + R() * 150, h = hillHeight(x, z);
    if (x > 60 && x < 192 && z < 246) { if (R() < 0.55) continue; }   // the camp has its own spacing
    if (nearTrail(x, z) < 3.5 || lakes.some((L) => ((x - L.x) / (L.rx + 3)) ** 2 + ((z - L.z) / (L.rz + 3)) ** 2 < 1)) continue;
    if (hillSlope(x, z) > 1.0) continue;
    if (Math.abs(x + 60) < 9 && z > 196 && z < 246) continue;         // the falls, the stream
    if (Math.hypot(x - 18, z - 232) < 8 || Math.hypot(x + 130, z - 222) < 8) continue;
    if (x > 64 && x < 190 && z > 160 && z < 246 && (Math.hypot(x - 118, z - 190) < 22 || (x < 96 && z < 180))) continue;   // camp clearing + parking
    const kind = h > 9 || R() < 0.45 ? "pine" : R() < 0.15 ? "autumn" : "round";
    B.tree(kind, x, z, 0.9 + R() * 0.6, h - 0.1); n++;
    if (x > -172 && x < 190 && z < 244) COLS.push({ c: [x, z], r: 0.55 });
  }
  // rocks scattered about
  for (let i = 0; i < 120; i++) { const x = -170 + R() * 230, z = 164 + R() * 78; if (nearTrail(x, z) < 2.5 || Math.abs(x + 60) < 8) continue; const h = hillHeight(x, z), s = 0.5 + R() * 1.3;
    B.P(x, z).put(dodec, rock, 0, h + s * 0.2, 0, R() * 3, s * (1 + R() * 0.6), s * 0.7, s); if (s > 0.9) COLS.push({ c: [x, z], r: s * 0.9 }); }
  // signposts where the trails meet
  [[-42, 166, "WATERFALL", "WHISPER PEAK"], [-50, 192, "WATERFALL", "WINDMILL"], [12, 218, "WHISPER PEAK", "PINE LAKE CAMP"]].forEach(([x, z, a, b]) => {
    const h = hillHeight(x, z), p = B.P(x, z); p.cyl(0.08, 0.1, 2.6, M("#7a5232"), 0, h + 1.3, 0, 6);
    [[a, 0.4, 2.3], [b, -0.5, 1.8]].forEach(([t, ry, y]) => { const q = p.at(0, 0, ry, h); q.box(2.2, 0.45, 0.1, M("#a87545"), 1.0, y, 0); q.geo(new THREE.PlaneGeometry(2.0, 0.36), signMat("trail" + t, t + " →", { bg: "#a87545", fg: "#ffffff", w: 512, h: 92, size: 56 }), 1.0, y, 0.06, 0, false); }); COLS.push({ c: [x, z], r: 0.2 }); });
  // the windmill on its hill
  { const x = -130, z = 222, h = hillHeight(x, z), p = B.P(x, z); p.cyl(2.2, 3.2, 9, facadeMat("plaster", "#f4efe4", { frame: "#8a5a34" }), 0, h + 4.5, 0, 12); p.cone(2.8, 3, M("#8a3a2a"), 0, h + 10.4, 0, 12); p.box(1.4, 2.2, 0.2, M("#8a5a34"), 0, h + 1.1, 3.05); p.colCircle(0, 0, 3.3);
    const g = B.live(x, z), hub = new THREE.Group(); hub.position.set(x, h + 8.4, z + 3.1); g.add(hub); const acc = new Acc(), q = new Painter(acc);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU; q.box(0.3, 8, 0.12, M("#7a5232"), Math.cos(a + Math.PI / 2) * 4, Math.sin(a + Math.PI / 2) * 4, 0, 0, { rz: a }); q.box(1.4, 6.5, 0.05, M("#f4efe4"), Math.cos(a + Math.PI / 2) * 4.2 + Math.cos(a) * 0.8, Math.sin(a + Math.PI / 2) * 4.2 + Math.sin(a) * 0.8, 0.08, 0, { rz: a }); }
    q.sphere(0.5, M("#5a3a22"), 0, 0, 0); acc.build(hub); hub.traverse((o) => (o.matrixAutoUpdate = true)); anim((t) => (hub.rotation.z = t * 0.6), g); }
  // Whisper Peak: a lookout deck with a telescope
  { const x = 18, z = 232, h = hillHeight(x, z), p = B.P(x, z);
    p.geo(stripGeo(7, 7, 2, 2, h + 0.06), texMat(planksTex()), 0, 0, 0, 0, false); p.box(7.2, 0.4, 7.2, M("#7a5232"), 0, h - 0.15, 0, 0, { cast: false });
    for (let k = -3.4; k <= 3.4; k += 0.85) { p.cyl(0.05, 0.05, 1.0, M("#7a5232"), k, h + 0.55, -3.5, 6); p.cyl(0.05, 0.05, 1.0, M("#7a5232"), -3.5, h + 0.55, k, 6); p.cyl(0.05, 0.05, 1.0, M("#7a5232"), 3.5, h + 0.55, k, 6); }
    p.box(7, 0.1, 0.12, M("#a87545"), 0, h + 1.05, -3.5); p.box(0.12, 0.1, 7, M("#a87545"), -3.5, h + 1.05, 0); p.box(0.12, 0.1, 7, M("#a87545"), 3.5, h + 1.05, 0);
    COLS.push({ box: [x - 3.7, z - 3.7, x + 3.7, z - 3.3] }, { box: [x - 3.7, z - 3.7, x - 3.3, z + 3.7] }, { box: [x + 3.3, z - 3.7, x + 3.7, z + 3.7] });
    p.cyl(0.06, 0.08, 1.2, M("#2b2f3a"), 0, h + 0.6, -1.5, 8); p.cyl(0.12, 0.16, 0.9, M("#ffd23a", { metalness: 0.6 }), 0, h + 1.3, -1.6, 12, { rx: 1.2 }); COLS.push({ c: [x, z - 1.5], r: 0.3 });
    bench(p.at(0, 0, 0, h), 1.8, 1.8, Math.PI); sideSign(p.at(0, 0, 0, h), "WHISPER PEAK", 0, 1.6, 3.4, 3.4, 0.7, { bg: "#3f8a3a", fg: "#ffffff" }); COLS.push({ c: [x, z + 3.4], r: 0.3 }); }
});
DISTRICT_BUILDERS.push(function waterfall(B) {
  const x = FALLS.x, top = hillHeight(x, FALLS.edge + 2.4) + 0.05, L = B.L.LAKES.find((l) => l.id === "falls");
  const level = FALLS.pond, curtainZ = 212.9, rock = M("#7f796e", { roughness: 1, flatShading: true }), dodec = unitGeo("dodeca", () => new THREE.DodecahedronGeometry(1, 0));
  // the pond
  { const g = new THREE.CircleGeometry(1, 48); g.rotateX(-Math.PI / 2); g.scale(L.rx + 1.2, 1, L.rz + 1.2); new Painter(B.cell(L.x, L.z).acc).geo(g, waterMat("#14628c", "#56d2e0"), L.x, level, L.z, 0, false); }
  const R = rng(5); for (let a = 0; a < TAU; a += 0.32) { const rx = L.x + Math.cos(a) * (L.rx + 1.4), rz = L.z + Math.sin(a) * (L.rz + 1.4); if (rz > 209.5 && Math.abs(rx - x) < 5.5) continue; const s = 0.5 + R() * 0.8; B.P(rx, rz).put(dodec, rock, 0, hillHeight(rx, rz) + s * 0.1, 0, R() * 3, s * 1.4, s * 0.7, s); }
  // the rock lip the water pours over, and the dark cave mouth hidden behind the curtain
  B.P(x, curtainZ + 0.9).put(dodec, rock, 0, top - 0.5, 0, 0.3, 4.2, 1.2, 1.8);
  [-1, 1].forEach((s) => B.P(x + s * 4.6, curtainZ + 1.2).put(dodec, rock, 0, top * 0.5, 0, s, 2.2, top * 0.55, 2.4));
  { const p = B.P(x, 214.25); p.put(unitGeo("caveMouth", () => { const sh = new THREE.Shape(); sh.moveTo(-1.6, 0); sh.lineTo(-1.6, 1.8); sh.absarc(0, 1.8, 1.6, Math.PI, 0, true); sh.lineTo(1.6, 0); sh.closePath(); return new THREE.ShapeGeometry(sh, 16); }), M("#07080a", { roughness: 1 }), 0, hillHeight(x, 213) + 0.02, 0, 0); }
  // the curtain of water (its texture runs downwards) + foam at the bottom + mist
  const h = top - level, tex = canvasTex("falls", 128, 256, (c, w, hh) => { c.fillStyle = "rgba(170,225,255,.55)"; c.fillRect(0, 0, w, hh); const Q = rng(9); for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + Q() * 0.6})`; c.fillRect(Q() * w, Q() * hh, 1 + Q() * 3, 10 + Q() * 40); } });
  const tex2 = tex.clone(); tex2.needsUpdate = true; tex2.wrapS = tex2.wrapT = THREE.RepeatWrapping; tex2.repeat.set(1.5, Math.max(1, h / 4));
  const wm = new THREE.MeshStandardMaterial({ map: tex2, transparent: true, opacity: 0.92, roughness: 0.15, emissive: new THREE.Color("#7fc8ff"), emissiveIntensity: 0.18, side: THREE.DoubleSide, depthWrite: false });
  const g = B.live(x, curtainZ), curtain = new THREE.Mesh(new THREE.PlaneGeometry(6.2, h, 1, 6), wm); curtain.position.set(x, level + h / 2, curtainZ); g.add(curtain);
  const foamG = new THREE.BufferGeometry(), N = 140, fp = new Float32Array(N * 3), seeds = Array.from({ length: N }, () => [Math.random(), Math.random() * 6 - 3, Math.random()]); foamG.setAttribute("position", new THREE.BufferAttribute(fp, 3));
  const foam = new THREE.Points(foamG, new THREE.PointsMaterial({ color: "#ffffff", size: 0.32, transparent: true, opacity: 0.8, depthWrite: false })); foam.frustumCulled = false; g.add(foam);
  anim((t, dt) => { tex2.offset.y += dt * 0.9; for (let i = 0; i < N; i++) { const [ph, ox, sp] = seeds[i], k = (t * (0.8 + sp * 0.6) + ph) % 1; fp[i * 3] = x + ox * (1 + k * 0.6); fp[i * 3 + 1] = level + 0.1 + Math.sin(k * Math.PI) * (0.8 + sp * 1.4); fp[i * 3 + 2] = curtainZ - 0.2 - k * 2.6; } foamG.attributes.position.needsUpdate = true; }, g);
  // the stream on the plateau feeding the falls
  { const pts = [[x, 244], [x + 3, 236], [x - 2, 228], [x + 1, 220], [x, FALLS.edge + 1.6]], W = 2.8, pos = [], uv = [], idx = [];
    for (let i = 0; i < pts.length; i++) { const [px, pz] = pts[i], [qx, qz] = pts[Math.min(pts.length - 1, i + 1)], [ox, oz] = pts[Math.max(0, i - 1)], dx = qx - ox, dz = qz - oz, l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l, y = hillHeight(px, pz) + 0.12;
      pos.push(px - nx * W, y, pz - nz * W, px + nx * W, y, pz + nz * W); uv.push(0, i, 1, i); if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); sg.setIndex(idx); sg.computeVertexNormals();
    new Painter(B.cell(x, 230).acc).geo(sg, waterMat("#1b7fb0", "#6fdcf0"), 0, 0, 0, 0, false); }
  // nobody walks into the falls from the front (the cave is reached along the cliff from the side)
  COLS.push({ box: [x - 3.1, curtainZ - 0.25, x + 3.1, curtainZ + 0.05] });
});

DISTRICT_BUILDERS.push(function camp(B) {
  const L = B.L.LAKES.find((l) => l.id === "camp"), R = rng(808);
  let rim = 99; for (let a = 0; a < TAU; a += 0.15) rim = Math.min(rim, hillHeight(L.x + Math.cos(a) * L.rx, L.z + Math.sin(a) * L.rz)); const level = rim - 0.15;
  { const g = new THREE.CircleGeometry(1, 64); g.rotateX(-Math.PI / 2); g.scale(L.rx + 1.4, 1, L.rz + 1.4); new Painter(B.cell(L.x, L.z).acc).geo(g, waterMat("#145f7a", "#4fc6c9"), L.x, level, L.z, 0, false); }
  // the welcome arch
  { const x = 80, z = 161, p = B.P(x, z), lg = M("#8a5a34"); [-4.5, 4.5].forEach((dx) => { p.cyl(0.4, 0.45, 5.4, lg, dx, 2.7, 0, 10); p.colCircle(dx, 0, 0.5); }); p.cyl(0.35, 0.35, 10.4, lg, 0, 5.3, 0, 10, { rz: Math.PI / 2 });
    p.box(7.6, 1.2, 0.22, M("#a87545"), 0, 4.6, 0); p.geo(new THREE.PlaneGeometry(7.2, 1).rotateY(Math.PI), signMat("pinecamp", "PINE LAKE CAMP", { bg: "#a87545", fg: "#ffffff", w: 1024, h: 142, size: 92 }), 0, 4.6, -0.12, 0, false); p.geo(new THREE.PlaneGeometry(7.2, 1), signMat("pinecamp", "PINE LAKE CAMP", { bg: "#a87545", fg: "#ffffff", w: 1024, h: 142, size: 92 }), 0, 4.6, 0.12, 0, false); }
  // tents around a big campfire
  const fx = 118, fz = 190, fy = hillHeight(fx, fz);
  const tentCols = ["#ff8a1c", "#1f6bff", "#2fb04e", "#e8423b", "#ffd23a", "#9b5cff"];
  for (let i = 0; i < 6; i++) { const a = -0.3 + (i / 6) * 2.4 + Math.PI * 0.55, tx = fx + Math.cos(a) * 13, tz = fz + Math.sin(a) * 11, ty = hillHeight(tx, tz), p = B.P(tx, tz, -a + Math.PI / 2);
    const tg = unitGeo("tent", () => { const g = new THREE.CylinderGeometry(1, 1, 1, 3, 1, false); g.rotateZ(Math.PI / 2); g.rotateX(Math.PI / 6); g.scale(1, 1, 1); return g; });
    p.put(tg, M(tentCols[i], { roughness: 0.8, side: THREE.DoubleSide }), 0, ty + 1.05, 0, 0, 3.2, 2.2, 2.2); p.box(0.05, 1.6, 0.05, M("#2b2f3a"), 1.62, ty + 0.8, 0); p.put(unitGeo("tentdoor", () => new THREE.CircleGeometry(0.7, 3).rotateZ(Math.PI / 2)), M("#2b2f3a"), 1.63, ty + 0.62, 0, Math.PI / 2, 1, 1.1, 1);
    COLS.push({ c: [tx, tz], r: 1.8 }); }
  // the fire: stones, logs, dancing flames, a warm light at night (+ toast marshmallows)
  { const p = B.P(fx, fz); for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; p.put(unitGeo("dodeca", () => new THREE.DodecahedronGeometry(1, 0)), M("#8a857b", { flatShading: true }), Math.cos(a) * 1.3, fy + 0.15, Math.sin(a) * 1.3, a, 0.35, 0.28, 0.35); }
    [0, 1.1, 2.2].forEach((a) => p.cyl(0.13, 0.13, 1.8, M("#6b4226"), 0, fy + 0.25, 0, 8, { rz: Math.PI / 2, ry: a })); p.colCircle(0, 0, 1.6);
    [0, 1.6, 3.2, 4.7].forEach((a) => { const lx = Math.cos(a) * 4.4, lz = Math.sin(a) * 4.4; p.cyl(0.35, 0.35, 2.8, M("#8a5a34"), lx, hillHeight(fx + lx, fz + lz) + 0.35, lz, 10, { rz: Math.PI / 2, ry: -a + Math.PI / 2 }); COLS.push({ c: [fx + lx, fz + lz], r: 0.9 }); });
    const g = B.live(fx, fz), flames = [], fm = new THREE.MeshStandardMaterial({ color: "#ffb02e", emissive: "#ff7a00", emissiveIntensity: 2.2, transparent: true, opacity: 0.9, depthWrite: false });
    [["#ffd23a", 0.45, 1.3], ["#ff8a1c", 0.6, 1.0], ["#ff4f2e", 0.7, 0.7]].forEach(([c, r, hh], i) => { const f = new THREE.Mesh(new THREE.ConeGeometry(r, hh, 8), fm.clone()); f.material.color.set(c); f.material.emissive.set(c); f.position.set(fx, fy + 0.35 + hh / 2, fz); g.add(f); flames.push(f); });
    const sparkG = new THREE.BufferGeometry(), SN = 40, sp = new Float32Array(SN * 3), ss = Array.from({ length: SN }, () => [Math.random(), Math.random() * TAU]); sparkG.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    const sparks = new THREE.Points(sparkG, new THREE.PointsMaterial({ color: "#ffcf5a", size: 0.12, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sparks.frustumCulled = false; g.add(sparks);
    anim((t) => { flames.forEach((f, i) => { const k = 1 + Math.sin(t * (9 + i * 3) + i) * 0.12 + Math.sin(t * 17 + i * 2) * 0.06; f.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k)); f.rotation.y = t * (1 + i); });
      for (let i = 0; i < SN; i++) { const [ph, a] = ss[i], k = (t * 0.6 + ph) % 1; sp[i * 3] = fx + Math.cos(a + t) * 0.3 * (1 + k); sp[i * 3 + 1] = fy + 0.6 + k * 3.2; sp[i * 3 + 2] = fz + Math.sin(a + t) * 0.3 * (1 + k); } sparkG.attributes.position.needsUpdate = true; }, g);
    spot("city:stand:camp", fx + 2.4, fz + 1.2, "TOAST MARSHMALLOWS", "stand", 2.4); }
  // log cabins and the camp store
  [[88, 212, 0], [100, 230, 0.2]].forEach(([x, z, ry], i) => { const y = hillHeight(x, z); building(B.P(x, z, ry), { w: 9, d: 7, floors: 1, style: "siding", wall: "#8a5a34", opt: { shutter: "#2f7d4f", frame: "#e9dcc4" }, roof: "gable", roofCol: "#3f5a3a", base: Math.max(0.3, y + 0.3), roofStuff: false }); });
  { const x = 100, z = 172, y = hillHeight(x, z); building(B.P(x, z, Math.PI), { w: 8, d: 6, floors: 1, style: "siding", wall: "#a06a3e", opt: { frame: "#e9dcc4" }, roof: "gable", roofCol: "#2f5d3a", base: Math.max(0.3, y + 0.3), sign: { text: "CAMP STORE", bg: "#2f7d4f", fg: "#ffffff" } }); }
  // picnic tables
  [[130, 176], [136, 182], [104, 200]].forEach(([x, z], i) => { const y = hillHeight(x, z), p = B.P(x, z, i * 0.4); p.box(2.6, 0.1, 1.0, WOOD(), 0, y + 0.78, 0); [-1, 1].forEach((s) => { p.box(2.6, 0.08, 0.35, WOOD(), 0, y + 0.45, s * 0.75); p.box(0.1, 0.78, 1.6, WOOD(), s * 1.1, y + 0.39, 0); }); p.colBox(-1.4, -1.0, 1.4, 1.0); });
  // the canoe dock on the lake (you can walk out on it) and canoes
  { const [dx0, dz0, dx1, dz1] = B.L.DECKS[B.L.DECKS.length - 1], cx = (dx0 + dx1) / 2; CAMP_DOCK_Y = Math.max(level + 0.35, hillHeight(cx, dz0 - 0.4));
    const p = B.P(cx, (dz0 + dz1) / 2); p.geo(stripGeo(dx1 - dx0, dz1 - dz0, 2, 2, CAMP_DOCK_Y), texMat(planksTex()), 0, 0, 0, 0, false); p.box(dx1 - dx0 + 0.2, 0.3, dz1 - dz0, M("#7a5232"), 0, CAMP_DOCK_Y - 0.17, 0, 0, { cast: false });
    for (let z = -4; z <= 4; z += 4) [-1.3, 1.3].forEach((sx) => p.cyl(0.14, 0.14, 2.6, M("#5e3f25"), sx, CAMP_DOCK_Y - 1.2, z, 8));
    const g = B.live(L.x, L.z), canoes = [];
    [[-3.2, 4, 0.3, "#e8423b"], [3.2, 6, -0.2, "#ffd23a"], [-6, 12, 1.2, "#1f6bff"]].forEach(([ox, oz, ry, c]) => { const cn = new THREE.Group(), a = new Acc(), q = new Painter(a);
      q.put(unitGeo("canoe", () => { const gg = new THREE.SphereGeometry(1, 16, 8, 0, TAU, Math.PI / 2, Math.PI / 2); gg.scale(0.55, 0.45, 2.4); return gg; }), M(c, { roughness: 0.5, side: THREE.DoubleSide }), 0, 0.35, 0, 0); q.box(0.9, 0.06, 0.3, M("#c99a63"), 0, 0.2, 0.6); q.box(0.9, 0.06, 0.3, M("#c99a63"), 0, 0.2, -0.6);
      q.cyl(0.03, 0.03, 1.8, M("#8a5a34"), 0.2, 0.42, 0, 6, { rz: Math.PI / 2 - 0.3 });
      a.build(cn); cn.traverse((o) => (o.matrixAutoUpdate = true)); cn.position.set(cx + ox, level, dz1 + oz - 6); cn.rotation.y = ry; g.add(cn); canoes.push(cn); });
    anim((t) => canoes.forEach((c, i) => { c.position.y = level - 0.25 + Math.sin(t * 1.2 + i) * 0.05; c.rotation.z = Math.sin(t + i * 2) * 0.05; }), g); }
  // lanterns on posts along the camp paths
  [[86, 168], [96, 180], [108, 186], [128, 186], [110, 202], [92, 206]].forEach(([x, z]) => { B.cell(x, z).lamps.add(null, x, z, 0, "harbor", hillHeight(x, z)); COLS.push({ c: [x, z], r: 0.25 }); });
  [[73.4, 164], [78.8, 164], [84.2, 164]].forEach(([x, z], i) => car(B.P(x, z), 0, 0, 0, CAR_COLS[(i * 2 + 7) % CAR_COLS.length], i ? "van" : "pickup"));
});

DISTRICT_BUILDERS.push(function cave(B) {
  const C = B.L.CAVE, cx = (C.x0 + C.x1) / 2, cz = (C.z0 + C.z1) / 2;
  // the dome (seen from inside): rough rock with dark and light patches
  const dome = new THREE.SphereGeometry(1, 40, 20, 0, TAU, 0, Math.PI / 2); dome.scale(15, 8.5, 14.5);
  { const pos = dome.attributes.position, cols = [], c = new THREE.Color(); for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), n = fbm(x * 0.25 + 9, z * 0.25 + y * 0.3);
      const k = 1 + (n - 0.5) * 0.35; pos.setXYZ(i, x * k, y * k, z * k); c.set("#6e6288").lerp(new THREE.Color("#3a3150"), n); cols.push(c.r, c.g, c.b); }
    dome.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3)); dome.computeVertexNormals(); }
  const p = B.P(cx, cz), rock = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.BackSide, flatShading: true });
  p.geo(dome, rock, 0, 0, 0, 0, false);
  p.geo(stripGeo(32, 31, 6, 6, 0.02), texMat(canvasTex("cavefloor", 256, 256, (c, w, h) => { c.fillStyle = "#544a66"; c.fillRect(0, 0, w, h); grain(c, w, h, 6000, 0.3, 77, 3); })), 0, 0, 0, 0, false);
  // glowing crystals all around
  const crys = unitGeo("crystal", () => new THREE.OctahedronGeometry(1, 0).scale(0.35, 1, 0.35)), R = rng(4242), cols = ["#4ff3ff", "#b07bff", "#ff6ad5", "#7dffb0"];
  for (let i = 0; i < 46; i++) { const a = R() * TAU, r = 0.72 + R() * 0.2, x = Math.cos(a) * 14 * r, z = Math.sin(a) * 13.5 * r; if (z > 10 && Math.abs(x) < 4) continue; const s = 0.6 + R() * 1.4;
    p.put(crys, glowMat(cols[i % cols.length], 2.6), x, s * 0.7, z, R() * 3, s, s * (1 + R()), s, (R() - 0.5) * 0.8, (R() - 0.5) * 0.8); if (s > 1) COLS.push({ c: [cx + x, cz + z], r: s * 0.45 }); }
  for (let i = 0; i < 18; i++) { const a = R() * TAU, r = R() * 0.6, x = Math.cos(a) * 13 * r, z = Math.sin(a) * 12 * r; p.put(crys, glowMat(cols[(i + 1) % cols.length], 2.6), x, 6 + R() * 1.5, z, R() * 3, 0.5, -1.2 - R(), 0.5); }   // hanging ones
  // soft coloured light on the floor around the crystals (painted glow, no real lights: cheap on phones)
  { const tex = canvasTex("caveglow", 128, 128, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, "rgba(255,255,255,.75)"); gr.addColorStop(0.45, "rgba(255,255,255,.25)"); gr.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    const disc = unitGeo("glowdisc", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), Q = rng(77), GM = new Map();
    const gm = (col, o) => GM.get(col) || GM.set(col, new THREE.MeshBasicMaterial({ map: tex, color: col, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false })).get(col);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + Q() * 0.3, x = Math.cos(a) * 10.5, z = Math.sin(a) * 10, s = 7 + Q() * 4;
      p.put(disc, gm(cols[i % cols.length], 0.55), x, 0.04 + i * 0.002, z, 0, s, 1, s, 0, 0, false); }
    p.put(disc, gm("#ffd88a", 0.6), C.chest[0] - cx, 0.07, C.chest[1] - cz, 0, 8, 1, 8, 0, 0, false); }
  // a little glowing pool
  { const g = new THREE.CircleGeometry(3.2, 32); g.rotateX(-Math.PI / 2); p.geo(g, waterMat("#0b5f7a", "#3ff3ff"), -6, 0.06, 2, 0, false); COLS.push({ c: [cx - 6, cz + 2], r: 3.3 }); }
  // the treasure chest on a rock
  const [chx, chz] = C.chest;
  { const q = B.P(chx, chz); q.put(unitGeo("dodeca", () => new THREE.DodecahedronGeometry(1, 0)), M("#5a5266", { flatShading: true }), 0, 0.2, 0, 0, 2.2, 0.5, 1.8); q.colCircle(0, 0, 1.6); }
  const g = B.live(chx, chz), chest = new THREE.Group(); chest.position.set(chx, 0.6, chz); g.add(chest);
  { const a = new Acc(), q = new Painter(a), wood = M("#8a4a24"), gold = M("#ffc21a", { metalness: 0.7, roughness: 0.3 });
    q.box(1.6, 0.9, 1.0, wood, 0, 0.45, 0); [-0.6, 0.6].forEach((x) => q.box(0.12, 0.92, 1.04, gold, x, 0.45, 0)); q.box(0.3, 0.3, 0.06, gold, 0, 0.62, 0.53); a.build(chest); }
  const lid = new THREE.Group(); lid.position.set(chx, 0.6 + 0.9, chz - 0.5); g.add(lid);
  { const a = new Acc(), q = new Painter(a), wood = M("#9a5428"), gold = M("#ffc21a", { metalness: 0.7, roughness: 0.3 });
    q.put(unitGeo("lidcyl", () => { const c = new THREE.CylinderGeometry(0.5, 0.5, 1.6, 16, 1, false, 0, Math.PI); c.rotateZ(Math.PI / 2); return c; }), wood, 0, 0, 0.5, 0); [-0.6, 0.6].forEach((x) => q.put(unitGeo("lidband", () => { const c = new THREE.CylinderGeometry(0.52, 0.52, 0.12, 16, 1, false, 0, Math.PI); c.rotateZ(Math.PI / 2); return c; }), gold, x, 0, 0.5, 0));
    a.build(lid); lid.traverse((o) => (o.matrixAutoUpdate = true)); }
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), new THREE.MeshBasicMaterial({ color: "#ffe27a", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.set(chx, 1.6, chz); g.add(glow);
  CHEST.lid = lid; CHEST.glow = glow;
  anim((t, dt) => { const want = CHEST.open ? -1.9 : 0; lid.rotation.x += (want - lid.rotation.x) * Math.min(1, dt * 3); glow.material.opacity = CHEST.open ? 0.5 + Math.sin(t * 4) * 0.2 : 0; glow.scale.setScalar(1 + Math.sin(t * 3) * 0.15); }, g);
  spot("city:act:chest", chx, chz + 1.9, "OPEN THE CHEST", "chest", 2.0);
  // the way out: a bright tunnel at the far end
  { const q = B.P(C.exit[0], C.z1 - 1); q.box(3.6, 3.6, 0.2, M("#2a2433"), 0, 1.8, 2.4); q.box(3.0, 3.0, 0.05, new THREE.MeshBasicMaterial({ color: "#fff6dc" }), 0, 1.5, 2.25); q.box(0.3, 3.4, 3.8, M("#2a2433"), -1.75, 1.7, 0.6); q.box(0.3, 3.4, 3.8, M("#2a2433"), 1.75, 1.7, 0.6); }
  // a rocky hill outside, so the cave isn't a floating bubble seen from afar
  B.P(cx, cz).put(sphG(20, 12), M("#6f8a5a", { roughness: 1, flatShading: true }), 0, -2, 0, 0, 17, 10.5, 16.5);
});
const CHEST = { open: false, lid: null, glow: null };
