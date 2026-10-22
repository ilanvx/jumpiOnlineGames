/*
  THE FUTURE CITY collection: how its clothes look (items in public/shared/items/future.js).
  Same shape as wear-clothes.js / wear-heads.js, and index.html merges these into those registries:
    SHIRT / SLEEVE / PANTS prints (ctx, w, h, item, H); shirt3D(item, H, own) / pants3D(item, mat, H) add glow;
    HAT_STYLES[id](o, C, H), GLASSES_STYLES[id](o, g, C, H), NECK_STYLES[id](o, C, H) build the 3D pieces.
  Glow: emissive maps painted like the cloth (black = no glow), pulsing through H.anim (shared, so every copy pulses).
*/
const TAU = Math.PI * 2;
let T = null;
const glowM = (H, c, e = 1, extra = {}) => H.solid(c, .3, { emissive: c, emissiveIntensity: e, ...extra });
const mesh = (geo, m, x = 0, y = 0, z = 0) => { const s = new T.Mesh(geo, m); s.position.set(x, y, z); return s; };

/* ======================= prints ======================= */
const neonLine = (x, col, lw, pts, blur = 10) => { x.save(); x.strokeStyle = col; x.lineWidth = lw; x.lineCap = x.lineJoin = "round"; x.shadowColor = col; x.shadowBlur = blur; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke(); x.restore(); };
function circuitArt(x, w, h, col, H, seed = 3, y0 = 30, y1 = h - 28) {
  const R = H.rng(seed);
  for (let k = 0; k < 26; k++) { let u = R() * w, v = y0 + R() * (y1 - y0); const pts = [[u, v]];
    for (let s = 0; s < 4; s++) { if (R() < .5) u += (R() < .5 ? -1 : 1) * (20 + R() * 50); else v += (R() < .5 ? -1 : 1) * (14 + R() * 30); v = Math.max(y0, Math.min(y1, v)); pts.push([u, v]); }
    neonLine(x, col, 3, pts, 6); const [eu, ev] = pts[pts.length - 1]; x.fillStyle = col; x.beginPath(); x.arc(eu, ev, 5, 0, TAU); x.fill(); x.fillStyle = "#000"; x.beginPath(); x.arc(eu, ev, 2, 0, TAU); x.fill(); }
}
function holoArt(x, w, h, a, b) {
  const g = x.createLinearGradient(0, 0, w, h); const cols = [a, b, "#ffffff", a, b, "#ffffff", a];
  cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c)); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.globalAlpha = .25; for (let k = 0; k < 14; k++) { x.fillStyle = k % 2 ? "#ffffff" : b; x.beginPath(); x.moveTo(k * w / 7 - 200, 0); x.lineTo(k * w / 7 - 120, 0); x.lineTo(k * w / 7 + 40, h); x.lineTo(k * w / 7 - 40, h); x.fill(); } x.globalAlpha = 1;
}
const SP = {}, SL = {}, PP = {};
SP.neonsuit = (x, w, h, p) => { const cx = w * .25, a = p.acc;
  neonLine(x, a, 6, [[cx - 92, 40], [cx, 160], [cx + 92, 40]]); neonLine(x, a, 4, [[cx, 160], [cx, h - 26]]);
  [w * .5, 0, w].forEach((u) => neonLine(x, a, 5, [[u, 0], [u, h]]));
  neonLine(x, a, 4, [[w * .75 - 120, 120], [w * .75, 70], [w * .75 + 120, 120]]); neonLine(x, a, 3, [[w * .75 - 70, 170], [w * .75 + 70, 170]]); };
SL.neonsuit = (x, w, h, p) => { neonLine(x, p.acc, 5, [[0, h * .7], [w, h * .7]]); neonLine(x, p.acc, 3, [[w * .25, 0], [w * .25, h * .7]]); };
SP.holo = (x, w, h, p) => { holoArt(x, w, h, p.fill, p.acc); };
SL.holo = (x, w, h, p) => { holoArt(x, w, h, p.fill, p.acc); };
SP.spacesuit = (x, w, h, p, H) => { const cx = w * .25;
  x.fillStyle = "rgba(0,0,0,.08)"; [w * .5, 0, w].forEach((u) => x.fillRect(u - 14, 0, 28, h));
  x.fillStyle = "#9aa6c2"; x.beginPath(); x.roundRect(cx - 70, 120, 140, 80, 12); x.fill(); x.fillStyle = "#1d2433"; x.beginPath(); x.roundRect(cx - 62, 128, 124, 64, 9); x.fill();
  ["#ff4f6d", "#ffd65a", "#7dff9b", "#59e0ff"].forEach((c, k) => { x.fillStyle = c; x.beginPath(); x.arc(cx - 38 + k * 25, 146, 7, 0, TAU); x.fill(); });
  x.fillStyle = "#59e0ff"; x.fillRect(cx - 50, 166, 100, 12);
  x.fillStyle = p.acc; x.beginPath(); x.arc(cx + 120, 104, 30, 0, TAU); x.fill(); x.fillStyle = "#ffffff"; H.starPath(x, cx + 120, 104, 16, 7); x.fill();
  x.fillStyle = p.acc; x.fillRect(w * .75 - 90, 90, 180, 22); x.font = '40px "Lilita One", sans-serif'; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#1d2433"; x.fillText("JUMPI 3026", w * .75, 170); };
SL.spacesuit = (x, w, h, p) => { x.fillStyle = p.acc; x.fillRect(0, h * .55, w, 14); x.fillStyle = "rgba(0,0,0,.08)"; x.fillRect(0, h * .2, w, 10); };
SP.cyberhood = (x, w, h, p) => { const cx = w * .25, a = p.acc;
  x.fillStyle = "rgba(255,255,255,.06)"; x.beginPath(); x.moveTo(cx - 80, 175); x.lineTo(cx + 80, 175); x.lineTo(cx + 96, h - 30); x.lineTo(cx - 96, h - 30); x.closePath(); x.fill();
  neonLine(x, a, 6, [[cx, 110], [cx + 40, 170], [cx - 40, 170], [cx, 110]]); neonLine(x, a, 3, [[cx, 60], [cx, h - 26]], 6);
  [-1, 1].forEach((s) => neonLine(x, a, 4, [[cx + s * 20, 50], [cx + s * 26, 120]], 6)); neonLine(x, a, 5, [[w * .75 - 100, 60], [w * .75 + 100, 60]]);
  x.font = '64px "Lilita One", sans-serif'; x.textAlign = "center"; x.textBaseline = "middle"; x.save(); x.shadowColor = a; x.shadowBlur = 14; x.fillStyle = a; x.fillText("CYBER", w * .75, 160); x.restore(); };
SL.cyberhood = (x, w, h, p) => { neonLine(x, p.acc, 4, [[0, h * .62], [w, h * .62]]); };
SP.circuit = (x, w, h, p, H) => { circuitArt(x, w, h, p.acc, H, 3); };
SL.circuit = (x, w, h, p, H) => { circuitArt(x, w, h, p.acc, H, 9, 10, h - 20); };
SP.pilot = (x, w, h, p) => { const cx = w * .25, a = p.acc;
  x.fillStyle = "rgba(0,0,0,.18)"; x.fillRect(0, h - 60, w, 34);
  x.fillStyle = "#c9ced8"; x.fillRect(cx - 4, 70, 8, h - 96); for (let y = 76; y < h - 30; y += 10) x.fillRect(cx - 8, y, 16, 3);
  x.fillStyle = a; x.beginPath(); x.moveTo(cx + 40, 132); x.lineTo(cx + 140, 120); x.lineTo(cx + 110, 140); x.lineTo(cx + 140, 150); x.lineTo(cx + 40, 140); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(cx + 40, 132); x.lineTo(cx - 30 + 10, 122); x.lineTo(cx + 40, 146); x.fill(); x.beginPath(); x.arc(cx + 42, 137, 10, 0, TAU); x.fill();
  x.fillStyle = "#ff4f6d"; x.beginPath(); x.arc(w * .75, 120, 46, 0, TAU); x.fill(); x.fillStyle = a; x.beginPath(); x.arc(w * .75, 120, 36, 0, TAU); x.fill();
  x.fillStyle = "#1d2433"; x.font = '30px "Lilita One", sans-serif'; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("SKY", w * .75, 122); };
SL.pilot = (x, w, h, p) => { x.fillStyle = "rgba(0,0,0,.2)"; x.fillRect(0, h - 40, w, 22); x.fillStyle = p.acc; x.beginPath(); x.arc(w * .25, h * .35, 14, 0, TAU); x.fill(); };
SP.glowstripe = (x, w, h, p) => { const cols = p.acc === "#ff4fd8" ? ["#ff4fd8", "#ffd65a", "#59e0ff", "#7dff9b"] : [p.acc];
  for (let k = 0; k < 16; k++) neonLine(x, cols[k % cols.length], 7, [[k * w / 16 + 20, 0], [k * w / 16 + 20, h]], 12); };
SL.glowstripe = (x, w, h, p) => { for (let k = 0; k < 4; k++) neonLine(x, p.acc === "#ff4fd8" ? ["#ff4fd8", "#ffd65a", "#59e0ff", "#7dff9b"][k] : p.acc, 6, [[k * w / 4 + 20, 0], [k * w / 4 + 20, h]], 10); };
SP.robotee = (x, w, h, p) => { const cx = w * .25, a = p.acc;
  x.fillStyle = "#e9eef7"; x.beginPath(); x.roundRect(cx - 70, 104, 140, 104, 22); x.fill(); x.strokeStyle = a; x.lineWidth = 6; x.stroke();
  x.fillStyle = "#1d2433"; x.beginPath(); x.roundRect(cx - 54, 122, 108, 52, 14); x.fill(); x.fillStyle = "#59e0ff"; x.beginPath(); x.arc(cx - 24, 146, 10, 0, TAU); x.arc(cx + 24, 146, 10, 0, TAU); x.fill();
  x.strokeStyle = "#7dff9b"; x.lineWidth = 4; x.beginPath(); x.arc(cx, 186, 16, .2, Math.PI - .2); x.stroke(); x.strokeStyle = a; x.lineWidth = 5; x.beginPath(); x.moveTo(cx, 104); x.lineTo(cx, 82); x.stroke(); x.fillStyle = "#ff4f6d"; x.beginPath(); x.arc(cx, 78, 8, 0, TAU); x.fill();
  x.font = '48px "Lilita One", sans-serif'; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = a; x.fillText("BEEP BOOP", w * .75, 160); };
// pants (512 x 256, waistband = top 30 px)
PP.neonpants = (x, w, h, p) => { [w * .25 - 92, w * .25 + 92, w * .75 - 92, w * .75 + 92, 8, w - 8].forEach((u) => neonLine(x, p.acc, 6, [[u, 30], [u, h]], 10)); neonLine(x, p.acc, 4, [[0, h - 30], [w, h - 30]]); };
PP.spacepants = (x, w, h, p) => { x.fillStyle = "rgba(0,0,0,.08)"; [w * .25, w * .75].forEach((u) => { x.beginPath(); x.roundRect(u - 50, 120, 100, 60, 16); x.fill(); });
  x.fillStyle = "#9aa6c2"; [w * .25, w * .75].forEach((u) => { x.beginPath(); x.roundRect(u - 40, 128, 80, 44, 12); x.fill(); }); x.fillStyle = p.acc; x.fillRect(0, 70, w, 12); x.fillRect(0, h - 40, w, 10); };
PP.circuitpants = (x, w, h, p, H) => { circuitArt(x, w, h, p.acc, H, 5, 40, h - 10); };
PP.holopants = (x, w, h, p) => { holoArt(x, w, h, p.base, p.acc); };

export const SHIRT_PRINTS = {}, SLEEVE_PRINTS = {}, PANTS_PRINTS = {};
const wrap = (f) => (x, w, h, p, H) => { x.save(); f(x, w, h, p, H); x.restore(); };
Object.entries(SP).forEach(([id, f]) => { SHIRT_PRINTS[id] = wrap(f); });
Object.entries(SL).forEach(([id, f]) => { SLEEVE_PRINTS[id] = wrap(f); });
Object.entries(PP).forEach(([id, f]) => { PANTS_PRINTS[id] = wrap(f); });

/* ======================= glow (emissive masks) ======================= */
const mask = (H, w, h, draw, clear) => H.canvasTex(w, h, (x) => { x.fillStyle = "#000"; x.fillRect(0, 0, w, h); draw(x, w, h); if (clear) clear(x, w, h); });
const GLOW_SHIRTS = { neonsuit: 1, cyberhood: 1, circuit: 1, glowstripe: 1 };
export function shirt3D(item, H, own) {
  if (!GLOW_SHIRTS[item.id] || !own) return null; T = H.THREE;
  const p = { ...item, acc: "#ffffff" }, body = mask(H, 1024, 256, (x, w, h) => SP[item.id](x, w, h, p, H), (x, w, h) => { x.fillStyle = "#000"; x.fillRect(0, h - 26, w, 26); });
  const sleeve = SL[item.id] ? mask(H, 256, 129, (x, w, h) => SL[item.id](x, w, h, p, H)) : null, mats = [];
  [["body", body], ["L", sleeve], ["R", sleeve]].forEach(([k, tx]) => { const m = own[k]; if (!m || !tx) return; m.material.emissive = new T.Color(item.acc); m.material.emissiveMap = tx; m.material.emissiveIntensity = 1; m.material.needsUpdate = true; mats.push(m.material); });
  H.anim((t) => { const k = .75 + .25 * Math.sin(t * 2.4); mats.forEach((mm) => (mm.emissiveIntensity = k)); });
  return null;
}
export function pants3D(item, mat, H) {
  if (item.id !== "neonpants" && item.id !== "circuitpants") return null; T = H.THREE;
  const tx = mask(H, 512, 256, (x, w, h) => PP[item.id](x, w, h, { ...item, acc: "#ffffff" }, H), (x, w) => { x.fillStyle = "#000"; x.fillRect(0, 0, w, 30); });
  mat.emissive = new T.Color(item.acc); mat.emissiveMap = tx; mat.emissiveIntensity = 1; mat.needsUpdate = true;
  H.anim((t) => { mat.emissiveIntensity = .7 + .3 * Math.sin(t * 2 + 1); });
  return null;
}

/* ======================= hats ======================= */
const earPt = (H, s, out = 1.06) => H.hp(Math.PI / 2 + .08, s * Math.PI / 2, out);
function band(H, g, m, s = 1.1, r = .035) { const pts = []; for (let t = -1.35; t <= 1.351; t += .15) pts.push(H.hp(t, Math.PI / 2, s)); g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, r, 8), m)); }
export const HAT_STYLES = {
  // a round glass bubble helmet with a coloured neck ring and a little light on top
  spacehelmet(o, C, H) {
    T = H.THREE; const { g } = C, r = Math.max(...H.HR) * 1.17, cy = H.HC.y + .04;
    const glass = new T.MeshStandardMaterial({ color: "#d8f6ff", transparent: true, opacity: .22, roughness: .03, metalness: .2, depthWrite: false, side: T.DoubleSide });
    const bub = mesh(new T.SphereGeometry(r, 40, 28, 0, TAU, 0, Math.PI * .78), glass, 0, cy, 0); bub.userData.keep = true; g.add(bub);
    const ring = mesh(new T.TorusGeometry(r * .7, .06, 12, 48), H.solid(o.col, .35, { metalness: .5 }), 0, cy - r * .7, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
    const shine = mesh(new T.SphereGeometry(r * 1.002, 24, 12, -.9, .6, .35, .5), new T.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: .35, depthWrite: false })); shine.position.y = cy; shine.userData.keep = true; g.add(shine);
    g.add(mesh(new T.CylinderGeometry(.02, .02, .2, 8), H.solid("#c9d2e3", .3, { metalness: .6 }), 0, cy + r + .08, 0));
    const lm = glowM(H, o.col2, 1.4); g.add(mesh(new T.SphereGeometry(.06, 12, 10), lm, 0, cy + r + .2, 0)); H.anim((t) => { lm.emissiveIntensity = 1 + Math.max(0, Math.sin(t * 4)) * 1.2; });
  },
  // small wireless earbuds in both ears, with a glowing tip
  earbuds(o, C, H) {
    T = H.THREE; const { g } = C, body = H.solid(o.col, .25, { metalness: .2 }), tip = glowM(H, o.col2, 1.2);
    [-1, 1].forEach((s) => { const p = earPt(H, s, 1.08); const bud = mesh(new T.SphereGeometry(.095, 16, 12), body, p.x, p.y, p.z); bud.scale.set(.8, 1, 1); g.add(bud);
      const stem = mesh(new T.CapsuleGeometry(.03, .16, 4, 8), body, p.x + s * .01, p.y - .13, p.z + .03); stem.rotation.z = s * .15; g.add(stem);
      g.add(mesh(new T.SphereGeometry(.04, 10, 8), tip, p.x + s * .075, p.y + .01, p.z)); });
  },
  // big headphones over the head: a band, ear cups with glowing rings, a little microphone
  cyberphones(o, C, H) {
    T = H.THREE; const { g } = C, body = H.solid(o.col, .35, { metalness: .4 }), glow = glowM(H, o.col2, 1.2);
    band(H, g, body, 1.12, .04);
    [-1, 1].forEach((s) => { const p = earPt(H, s, 1.08); const cup = mesh(new T.CylinderGeometry(.17, .17, .12, 28), body, p.x, p.y, p.z); cup.rotation.z = Math.PI / 2; g.add(cup);
      const rg = mesh(new T.TorusGeometry(.13, .022, 8, 28), glow, p.x + s * .065, p.y, p.z); rg.rotation.y = Math.PI / 2; g.add(rg); });
    const mic = []; const a = earPt(H, -1, 1.12); for (let k = 0; k <= 6; k++) mic.push(new T.Vector3(a.x + .02 * k, a.y - .06 - k * .035, a.z + .06 * k));
    g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(mic), 16, .014, 6), body)); g.add(mesh(new T.SphereGeometry(.035, 10, 8), glow, mic[6].x, mic[6].y, mic[6].z));
    H.anim((t) => { glow.emissiveIntensity = .9 + .5 * Math.sin(t * 6); });
  },
  // a thin headband with two robot antennas and glowing balls that bob
  antenna(o, C, H) {
    T = H.THREE; const { g } = C, body = H.solid(o.col, .35, { metalness: .5 }), glow = glowM(H, o.col2, 1.3);
    band(H, g, body, 1.07, .03);
    [-1, 1].forEach((s) => { const b = H.hp(.55, s * Math.PI / 2, 1.07); const top = b.clone().add(new T.Vector3(s * .12, .42, 0));
      const rod = mesh(new T.CylinderGeometry(.018, .018, b.distanceTo(top), 8), body); rod.position.copy(b).add(top).multiplyScalar(.5); rod.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), top.clone().sub(b).normalize()); g.add(rod);
      g.add(mesh(new T.SphereGeometry(.07, 14, 10), glow, top.x, top.y, top.z)); });
    H.anim((t) => { glow.emissiveIntensity = .8 + .7 * Math.max(0, Math.sin(t * 5)); });
  },
  // a crown of light: glowing triangles floating and turning round above the head
  holocrown(o, C, H) {
    T = H.THREE; const { g, top } = C, crown = new T.Group(); crown.position.y = top + .22; g.add(crown);
    const a = new T.MeshBasicMaterial({ color: o.col, transparent: true, opacity: .85, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
    const b = new T.MeshBasicMaterial({ color: o.col2, transparent: true, opacity: .7, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
    const tri = new T.ConeGeometry(.07, .22, 3, 1, true);
    for (let k = 0; k < 8; k++) { const an = k / 8 * TAU, m = mesh(tri, k % 2 ? b : a, Math.sin(an) * .5, k % 2 ? .02 : .06, Math.cos(an) * .46); m.rotation.y = an; crown.add(m); }
    const ringG = new T.TorusGeometry(.5, .012, 6, 64), rg = new T.Mesh(ringG, a); rg.rotation.x = Math.PI / 2; rg.scale.z = .92; crown.add(rg);
    H.anim((t) => { crown.rotation.y = t * .8; crown.position.y = top + .22 + Math.sin(t * 2) * .03; });
    return "raw";
  },
  // a cap with a glowing see-through visor
  visorcap(o, C, H) {
    T = H.THREE; const { g, dome, c1, S } = C; dome(0, 1.25, S, c1);
    const vm = new T.MeshStandardMaterial({ color: o.col2, emissive: o.col2, emissiveIntensity: .8, transparent: true, opacity: .7, roughness: .1, side: T.DoubleSide, depthWrite: false });
    const vis = mesh(new T.CylinderGeometry(.7, .78, .04, 40, 1, false, -1.1, 2.2), vm, 0, H.hp(1.25, 0, S).y - .01, .12); vis.scale.z = 1.05; vis.userData.keep = true; g.add(vis);
    const edge = mesh(new T.TorusGeometry(.56, .02, 6, 48, Math.PI), glowM(H, o.col2, 1.2), 0, H.hp(1.2, 0, S).y, 0); edge.rotation.set(Math.PI / 2, 0, Math.PI); g.add(edge);   // (the ring turns, not the whole cap)
    H.anim((t) => { vm.emissiveIntensity = .6 + .3 * Math.sin(t * 3); });
  },
};

/* ======================= glasses ======================= */
export const GLASSES_STYLES = {
  // one wraparound visor across both eyes, glowing
  cybervisor(o, g, C, H) {
    T = H.THREE; const r = .66, vm = new T.MeshStandardMaterial({ color: o.frame, emissive: o.glow || o.frame, emissiveIntensity: .9, transparent: true, opacity: .72, roughness: .1, metalness: .3, side: T.DoubleSide, depthWrite: false });
    const v = mesh(new T.CylinderGeometry(r, r, .2, 40, 1, true, -.95, 1.9), vm, 0, C.Y + .01, C.Z - r + .06); g.add(v);
    const edge = glowM(H, o.frame, 1.4); [-.1, .1].forEach((dy) => { const e = mesh(new T.TorusGeometry(r, .008, 4, 48, 1.9), edge, 0, C.Y + .01 + dy, C.Z - r + .06); e.rotation.set(Math.PI / 2, 0, -Math.PI / 2 - .95); g.add(e); });
    const scan = mesh(new T.BoxGeometry(.04, .17, .01), new T.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: .7, blending: T.AdditiveBlending, depthWrite: false }), 0, C.Y + .01, C.Z + .045); g.add(scan);
    H.anim((t) => { const k = Math.sin(t * 1.8); scan.position.x = k * .45; scan.position.z = C.Z + .045 - Math.abs(k) * .14; vm.emissiveIntensity = .7 + .3 * Math.sin(t * 3); });
  },
  // thin smart glasses: a slim frame and see-through lenses with a little floating screen
  hudglasses(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .25, { metalness: .7 });
    const lens = new T.MeshStandardMaterial({ color: "#dff8ff", emissive: o.col2, emissiveIntensity: .25, transparent: true, opacity: .35, roughness: .05, depthWrite: false });
    [C.eyeL, C.eyeR].forEach((e) => { const s = C.rrect(.44, .26, .06); const l = new T.Mesh(new T.ShapeGeometry(s), lens); l.position.set(e.x, C.Y, C.Z + .01); g.add(l);
      const pts = s.getPoints(24).map((p) => new T.Vector3(e.x + p.x, C.Y + p.y, C.Z + .015)); g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts, true), 48, .012, 6, true), fm)); });
    g.add(C.rod([C.eyeL.x + .22, C.Y + .04, C.Z + .015], [C.eyeR.x - .22, C.Y + .04, C.Z + .015], .012, fm));
    const hud = new T.Mesh(new T.PlaneGeometry(.16, .1), new T.MeshBasicMaterial({ color: o.col2, transparent: true, opacity: .55, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    hud.position.set(C.eyeR.x + .02, C.Y + .02, C.Z + .1); g.add(hud); H.anim((t) => { hud.material.opacity = .35 + .25 * Math.sin(t * 4); });
  },
  // dark shades covered in tiny LED dots that light up in waves
  ledshades(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .3);
    const dots = H.canvasTex(128, 64, (x, w, h) => { x.fillStyle = "#000"; x.fillRect(0, 0, w, h); x.fillStyle = "#fff"; for (let i = 0; i < 16; i++) for (let j = 0; j < 8; j++) { x.beginPath(); x.arc(i * 8 + 4, j * 8 + 4, 2.2, 0, TAU); x.fill(); } });
    dots.wrapS = T.RepeatWrapping;
    const lm = new T.MeshStandardMaterial({ color: "#14161f", emissive: o.col2, emissiveMap: dots, emissiveIntensity: 1.2, roughness: .2 });
    [C.eyeL, C.eyeR].forEach((e) => { const s = C.rrect(.48, .3, .1), l = C.ext(s, fm); l.position.set(e.x, C.Y, C.Z - .005); g.add(l);
      const geo = new T.ShapeGeometry(C.rrect(.42, .24, .08)), uv = geo.attributes.uv, p = geo.attributes.position; for (let k = 0; k < uv.count; k++) uv.setXY(k, p.getX(k) / .42 + .5, p.getY(k) / .24 + .5);
      const lens = new T.Mesh(geo, lm); lens.position.set(e.x, C.Y, C.Z + .03); g.add(lens); });
    g.add(C.rod([C.eyeL.x + .24, C.Y + .03, C.Z + .01], [C.eyeR.x - .24, C.Y + .03, C.Z + .01], .02, fm));
    const cols = o.col2 === "#ff4fd8" ? ["#ff4fd8", "#ffd65a", "#59e0ff", "#7dff9b"] : [o.col2];
    H.anim((t) => { dots.offset.x = (t * .25) % 1; lm.emissive.set(cols[Math.floor(t * 1.5) % cols.length]); lm.emissiveIntensity = .9 + .4 * Math.sin(t * 5); });
  },
};

/* ======================= neckwear ======================= */
export const NECK_STYLES = {
  // a glowing ring round the neck
  glowcollar(o, C, H) {
    T = H.THREE; const m = glowM(H, o.col, 1.2); C.M(new T.TubeGeometry(C.loop(.08, .6, 1.1), 96, .03, 8, true), m);
    C.M(new T.TubeGeometry(C.loop(.1, .54, 1.11), 96, .012, 6, true), H.solid("#c9d2e3", .3, { metalness: .6 }));
    H.anim((t) => { m.emissiveIntensity = .9 + .5 * Math.sin(t * 3); });
  },
  // a fine chain and a crystal that floats in front of the chest, turning
  holopendant(o, C, H) {
    T = H.THREE; C.chain(.01);
    const gem = new T.Mesh(new T.OctahedronGeometry(.08, 0), new T.MeshStandardMaterial({ color: o.col2, emissive: o.col2, emissiveIntensity: .8, roughness: .05, metalness: .3, flatShading: true }));
    const at = C.front(.12, 1.22); gem.position.copy(at); gem.scale.y = 1.5; C.g.add(gem);
    const halo = new T.Mesh(new T.TorusGeometry(.12, .006, 4, 32), new T.MeshBasicMaterial({ color: o.col2, transparent: true, opacity: .6, blending: T.AdditiveBlending, depthWrite: false })); halo.position.copy(at); C.g.add(halo);
    H.anim((t) => { gem.rotation.y = t * 1.5; gem.position.y = at.y + Math.sin(t * 2.4) * .02; halo.rotation.x = Math.PI / 2 + Math.sin(t) * .3; halo.position.y = gem.position.y; });
    return "raw";
  },
  // a jetpack on the back: two tanks, straps and little flames that flicker
  jetpack(o, C, H) {
    T = H.THREE; const g = C.g, body = H.solid(o.col, .3, { metalness: .6 }), dark = H.solid("#2a3042", .4, { metalness: .4 }), glow = glowM(H, o.col2, 1);
    const back = H.bodyPt(Math.PI, .05, 1.1), pack = new T.Group(); pack.position.copy(back); pack.position.z -= .12; g.add(pack);
    pack.add(mesh(new T.BoxGeometry(.38, .44, .12), dark, 0, 0, .04));
    const flames = [];
    [-1, 1].forEach((s) => { pack.add(mesh(new T.CapsuleGeometry(.1, .32, 6, 14), body, s * .14, 0, -.06)); pack.add(mesh(new T.CylinderGeometry(.06, .09, .1, 14), dark, s * .14, -.3, -.06));
      const ring = mesh(new T.TorusGeometry(.1, .015, 6, 20), glow, s * .14, .12, -.06); ring.rotation.x = Math.PI / 2; pack.add(ring);   // (add() returns the pack: turning its result laid the whole jetpack on its back)
      const f = mesh(new T.ConeGeometry(.07, .26, 12, 1, true), new T.MeshBasicMaterial({ color: o.col2, transparent: true, opacity: .8, blending: T.AdditiveBlending, depthWrite: false }), s * .14, -.47, -.06); f.rotation.x = Math.PI; pack.add(f); flames.push(f); });
    [-1, 1].forEach((s) => { const pts = [H.bodyPt(Math.PI + s * .35, .5, 1.09), H.bodyPt(s * 1.2, .55, 1.12), H.bodyPt(s * .35, .3, 1.1), H.bodyPt(s * .4, -.1, 1.09)]; g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 24, .022, 6), dark)); });
    H.anim((t) => { flames.forEach((f, k) => { const s = .8 + .35 * Math.abs(Math.sin(t * 23 + k * 2)); f.scale.set(1, s, 1); f.position.y = -.47 - (s - 1) * .13; }); glow.emissiveIntensity = .8 + .4 * Math.sin(t * 6); });
    return "raw";
  },
};
