/*
  3D motorcycles and scooters (public/shared/vehicles.js says which ones exist).
  buildBike(def) → a THREE.Group, front = +z, standing on y = 0, with userData:
    wf / wb   the wheel groups (spin them on x), or null for the hover bike; k = the bike's scale
    seatY     where the rider's feet-root goes (the character is drawn from its feet)
    riderZ    how far back the rider sits
    arm       how far forward the rider reaches (arm angle)
    hover     true = floats (bob it)
    glow      a ground light under it (or null)
    stand / armOut           the rider stands (boards, skates), arms out for balance
    pose(C, t, speed)        moves the rider itself (after the normal pose)
    tick(t, speed, ridden)   moving parts of the vehicle (pedals, carpet ripple, propellers...)
  The newer kinds (bicycles, boards, carts and cars, flying things...) are built in buildMore() below.
  Materials are shared between bikes of the same colours, so many bikes cost little.
*/
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const MATS = new Map();
function m(c, o = {}) {
  const k = c + JSON.stringify(o);
  if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.05, ...o }));
  return MATS.get(k);
}
const CHROME = () => m("#eef3f8", { metalness: 0.55, roughness: 0.22 });   // (no reflections in the world: real chrome would look black)
const DARK = () => m("#1d1f26", { roughness: 0.7 });
const RUBBER = () => m("#202228", { roughness: 0.9 });
const GLASS = () => m("#9fd4ff", { roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.45 });
const LAMP = () => m("#fff8d6", { emissive: "#fff2b0", emissiveIntensity: 1.4, roughness: 0.2 });
const TAIL = () => m("#ff3030", { emissive: "#ff2020", emissiveIntensity: 1.1, roughness: 0.3 });

let GLOW_TEX = null;
function glowTex() {
  if (GLOW_TEX) return GLOW_TEX;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(0.5, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  GLOW_TEX = new THREE.CanvasTexture(c); GLOW_TEX.colorSpace = THREE.SRGBColorSpace; return GLOW_TEX;
}

function add(g, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const ms = new THREE.Mesh(geo, mat); ms.position.set(x, y, z); ms.rotation.set(rx, ry, rz); ms.castShadow = true; g.add(ms); return ms; }
const cylX = (r, len, seg = 18) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);
// a tube between two points
function rod(g, a, b, r, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const ms = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
  ms.position.copy(A).add(B).multiplyScalar(0.5); ms.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); ms.castShadow = true; g.add(ms); return ms;
}
// a wheel: tyre, rim and spokes (style: "spoke" | "star" | "disc" | "knobby")
function wheel(g, r, z, width, style, rimMat) {
  const w = new THREE.Group(); w.position.set(0, r, z); g.add(w);
  const tube = r * (style === "knobby" ? 0.26 : 0.22);
  const tire = new THREE.Mesh(new THREE.TorusGeometry(r - tube, tube, 12, 32), RUBBER()); tire.rotation.y = Math.PI / 2; tire.scale.z = width / (tube * 2); tire.castShadow = true; w.add(tire);
  if (style === "knobby") for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; add(w, new THREE.BoxGeometry(width * 1.05, 0.05, 0.07), RUBBER(), 0, Math.sin(a) * (r - 0.01), Math.cos(a) * (r - 0.01), -a); }
  const rr = r - tube * 1.9;
  add(w, cylX(rr, width * 0.55, 24), style === "disc" ? rimMat : m("#2a2d36", { metalness: 0.4, roughness: 0.4 }));
  add(w, cylX(rr * 0.85, width * 0.6, 24), style === "disc" ? rimMat : DARK());
  add(w, cylX(0.06, width * 0.9, 12), CHROME());
  if (style === "spoke") for (let k = 0; k < 10; k++) add(w, new THREE.BoxGeometry(0.012, rr * 1.9, 0.012), CHROME(), 0, 0, 0, (k / 10) * Math.PI);
  else if (style === "star" || style === "knobby") for (let k = 0; k < 5; k++) add(w, new THREE.BoxGeometry(width * 0.4, rr * 0.95, 0.05), rimMat, 0, Math.cos((k / 5) * Math.PI * 2) * rr * 0.47, Math.sin((k / 5) * Math.PI * 2) * rr * 0.47, -(k / 5) * Math.PI * 2);
  return w;
}
// a fender arc over a wheel
function fender(g, r, z, width, mat, from = -0.15, to = 0.75) {
  const f = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.06, r + 0.06, width, 20, 1, true, Math.PI * from, Math.PI * (to - from)), mat);
  f.material = mat.clone(); f.material.side = THREE.DoubleSide; f.rotation.z = Math.PI / 2; f.position.set(0, r, z); f.castShadow = true; g.add(f); return f;
}
// a smooth side-profile body: points [z, y] around the outline, extruded across the bike
function profile(g, pts, width, mat, x = 0) {
  const sh = new THREE.Shape(); pts.forEach(([z, y], i) => (i ? sh.lineTo(z, y) : sh.moveTo(z, y))); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3, curveSegments: 8 });
  geo.translate(0, 0, -width / 2); geo.rotateY(-Math.PI / 2);   // shape z → world z, extruded along x
  const ms = new THREE.Mesh(geo, mat); ms.position.x = x; ms.castShadow = true; g.add(ms); return ms;
}
function bars(g, y, z, half, mat) { add(g, cylX(0.03, half * 2), mat, 0, y, z); [-1, 1].forEach((s) => add(g, cylX(0.045, 0.16), DARK(), s * (half + 0.02), y, z)); }
function headlight(g, y, z, r = 0.12) { add(g, new THREE.SphereGeometry(r, 16, 12), LAMP(), 0, y, z).scale.z = 0.6; add(g, new THREE.TorusGeometry(r, 0.025, 8, 20), CHROME(), 0, y, z - 0.01); }
function mirror(g, s, y, z) { rod(g, [s * 0.32, y - 0.12, z], [s * 0.42, y + 0.1, z - 0.04], 0.012, CHROME()); add(g, new THREE.SphereGeometry(0.06, 12, 8), CHROME(), s * 0.43, y + 0.13, z - 0.04).scale.set(1, 0.7, 0.3); }

export function buildBike(def) {
  const g = new THREE.Group(), body = m(def.col, def.metal ? { metalness: 0.45, roughness: 0.25, emissive: def.col, emissiveIntensity: 0.12 } : { roughness: 0.32, metalness: 0.15 }), trim = m(def.col2, { roughness: 0.4 });
  const ud = { wf: null, wb: null, seatY: 0.62, riderZ: -0.32, arm: -1.25, hover: false, glow: null };
  const k = def.kind;
  if (k === "scooter" || k === "vespa") {
    ud.wf = wheel(g, 0.3, 0.74, 0.16, "disc", trim); ud.wb = wheel(g, 0.3, -0.66, 0.18, "disc", trim);
    add(g, new THREE.BoxGeometry(0.46, 0.1, 0.9), DARK(), 0, 0.36, 0.08);   // the floorboard
    profile(g, [[-1.0, 0.5], [-0.98, 0.78], [-0.75, 0.95], [-0.2, 0.96], [-0.05, 0.62], [-0.05, 0.4], [-0.55, 0.36], [-0.9, 0.38]], 0.42, body);   // the back body
    if (k === "vespa") [-1, 1].forEach((s) => { const b = add(g, new THREE.SphereGeometry(0.3, 20, 14), body, s * 0.2, 0.62, -0.62); b.scale.set(0.55, 0.85, 1.35); add(g, new THREE.TorusGeometry(0.17, 0.015, 6, 20), CHROME(), s * 0.36, 0.62, -0.62, 0, Math.PI / 2).scale.set(1, 0.8, 1.6); });
    profile(g, [[0.5, 0.36], [0.68, 0.38], [0.74, 1.15], [0.66, 1.32], [0.56, 1.3], [0.48, 0.5]], 0.5, body);   // the front shield
    rod(g, [0, 1.0, 0.64], [0, 1.4, 0.58], 0.05, body); bars(g, 1.42, 0.56, 0.36, CHROME());
    add(g, new THREE.CapsuleGeometry(0.17, 0.5, 6, 14), trim, 0, 1.0, -0.48, Math.PI / 2).scale.set(1.25, 1, 0.5);   // the seat
    fender(g, 0.3, 0.74, 0.22, body, -0.05, 0.55);
    headlight(g, 1.3, 0.7, 0.1); add(g, new THREE.BoxGeometry(0.2, 0.08, 0.04), TAIL(), 0, 0.82, -1.02);
    if (k === "vespa") { mirror(g, -1, 1.42, 0.56); mirror(g, 1, 1.42, 0.56); add(g, new THREE.BoxGeometry(0.5, 0.04, 0.3), CHROME(), 0, 0.98, -0.95); }
    ud.seatY = 0.72; ud.riderZ = -0.36; ud.arm = -1.15;
  } else if (k === "cruiser" || k === "chopper") {
    const ch = k === "chopper", fz = ch ? 1.35 : 0.95, fr = ch ? 0.4 : 0.38, rz = -0.85, rr = ch ? 0.44 : 0.4;
    ud.wf = wheel(g, fr, fz, 0.14, "spoke", trim); ud.wb = wheel(g, rr, rz, 0.2, "spoke", trim);
    // engine: a block with two shiny cylinders (V)
    add(g, new THREE.BoxGeometry(0.34, 0.32, 0.5), m("#3a3f4a", { metalness: 0.6, roughness: 0.35 }), 0, 0.55, 0.05);
    [-0.12, 0.2].forEach((z, i) => { const c = add(g, new THREE.CylinderGeometry(0.11, 0.13, 0.42, 14), CHROME(), 0, 0.85, z, i ? 0.45 : -0.45); for (let f = 0; f < 4; f++) add(c, new THREE.CylinderGeometry(0.15, 0.15, 0.025, 14), CHROME(), 0, -0.12 + f * 0.08, 0); });
    // frame and the teardrop tank
    rod(g, [0, 0.55, 0.3], [0, 1.08, fz - 0.45], 0.04, DARK()); rod(g, [0, 0.42, -0.3], [0, rr, rz], 0.04, DARK());
    const tank = add(g, new THREE.SphereGeometry(0.26, 22, 14), body, 0, 1.06, 0.28); tank.scale.set(0.95, 0.7, 1.7);
    add(g, new THREE.TorusGeometry(0.16, 0.02, 6, 18), trim, 0, 1.17, 0.3, Math.PI / 2).scale.set(1, 1.7, 1);
    // the seat (low and long on the chopper, with a backrest)
    if (ch) { add(g, new THREE.CapsuleGeometry(0.16, 0.42, 6, 14), m("#2a1e16", { roughness: 0.8 }), 0, 0.86, -0.32, Math.PI / 2).scale.set(1.3, 1, 0.45); rod(g, [-0.16, 0.8, -0.72], [-0.16, 1.45, -0.86], 0.025, CHROME()); rod(g, [0.16, 0.8, -0.72], [0.16, 1.45, -0.86], 0.025, CHROME()); add(g, new THREE.BoxGeometry(0.36, 0.28, 0.06), m("#2a1e16", { roughness: 0.8 }), 0, 1.38, -0.85, -0.2); }
    else add(g, new THREE.CapsuleGeometry(0.17, 0.4, 6, 14), m("#2a1e16", { roughness: 0.8 }), 0, 0.98, -0.3, Math.PI / 2).scale.set(1.25, 1, 0.5);
    fender(g, rr, rz, 0.26, body, -0.05, 0.6); if (!ch) fender(g, fr, fz, 0.18, body, 0.1, 0.5);
    // the fork up to the handlebars (long and raked on the chopper, tall "ape" bars)
    const top = ch ? [fz - 0.62, 1.42] : [fz - 0.2, 1.3];
    [-0.11, 0.11].forEach((x) => rod(g, [x, fr, fz], [x, top[1], top[0]], 0.035, CHROME()));
    if (ch) { [-0.3, 0.3].forEach((x) => rod(g, [x * 0.4, top[1], top[0]], [x, 1.95, top[0] - 0.1], 0.025, CHROME())); bars(g, 1.95, top[0] - 0.1, 0.32, CHROME()); }
    else bars(g, top[1] + 0.05, top[0] - 0.05, 0.42, CHROME());
    headlight(g, top[1] - 0.12, top[0] + 0.16, 0.13); add(g, new THREE.BoxGeometry(0.18, 0.07, 0.04), TAIL(), 0, rr * 2 + 0.05, rz - 0.3);
    [-1, 1].forEach((s) => rod(g, [s * 0.2, 0.42, 0.1], [s * 0.22, 0.36, -1.1], 0.045, CHROME()));   // exhaust pipes
    ud.seatY = ch ? 0.58 : 0.7; ud.riderZ = -0.3; ud.arm = ch ? -1.95 : -1.2;
  } else if (k === "dirt") {
    ud.wf = wheel(g, 0.42, 0.98, 0.15, "knobby", trim); ud.wb = wheel(g, 0.42, -0.86, 0.18, "knobby", trim);
    rod(g, [0, 0.55, 0.2], [0, 1.15, 0.62], 0.04, DARK()); rod(g, [0, 0.5, -0.2], [0, 0.42, -0.86], 0.04, DARK());
    add(g, new THREE.BoxGeometry(0.3, 0.3, 0.4), m("#3a3f4a", { metalness: 0.6, roughness: 0.35 }), 0, 0.55, 0.0);
    profile(g, [[0.55, 1.0], [0.62, 1.2], [0.25, 1.28], [-0.15, 1.22], [-0.95, 1.32], [-1.1, 1.25], [-0.5, 1.06], [0.1, 0.92]], 0.34, body);   // tank, seat base and the tail
    add(g, new THREE.BoxGeometry(0.3, 0.1, 0.85), DARK(), 0, 1.3, -0.35);   // the long flat seat
    [-0.1, 0.1].forEach((x) => rod(g, [x, 0.42, 0.98], [x, 1.42, 0.7], 0.035, m("#ffd23a", { metalness: 0.6, roughness: 0.3 })));
    bars(g, 1.5, 0.66, 0.42, DARK());
    profile(g, [[0.85, 0.98], [1.32, 1.02], [1.25, 1.07], [0.85, 1.06]], 0.24, trim);   // the beak fender
    add(g, new THREE.BoxGeometry(0.34, 0.3, 0.04), m("#ffffff", { roughness: 0.6 }), 0, 1.28, 0.78, -0.25);   // number plate
    add(g, new THREE.BoxGeometry(0.12, 0.16, 0.05), m("#1d1f26"), 0, 1.28, 0.8, -0.25);
    rod(g, [0.18, 0.55, 0.0], [0.2, 0.95, -0.95], 0.05, CHROME());
    ud.seatY = 0.95; ud.riderZ = -0.3; ud.arm = -1.35;
  } else if (k === "sport") {
    ud.wf = wheel(g, 0.4, 1.0, 0.16, "star", trim); ud.wb = wheel(g, 0.41, -0.85, 0.26, "star", trim);
    add(g, new THREE.BoxGeometry(0.3, 0.3, 0.5), m("#2a2d36", { metalness: 0.6, roughness: 0.35 }), 0, 0.55, 0.05);
    profile(g, [[1.28, 0.82], [1.2, 1.12], [0.78, 1.36], [0.32, 1.3], [-0.15, 1.14], [-0.6, 1.1], [-1.08, 1.32], [-1.18, 1.22], [-0.72, 0.98], [-0.25, 0.86], [0.2, 0.74], [0.98, 0.62]], 0.36, body);
    [-1, 1].forEach((s) => rod(g, [s * 0.1, 0.62, 0.4], [s * 0.12, 0.6, -0.86], 0.04, m("#3a3f4a", { metalness: 0.5, roughness: 0.4 })));   // the swing arm
    profile(g, [[1.05, 0.9], [1.24, 1.0], [1.18, 1.08], [0.9, 1.0]], 0.46, trim, 0);   // a stripe on the nose
    add(g, new THREE.BoxGeometry(0.32, 0.08, 0.55), DARK(), 0, 1.2, -0.45);   // the seat
    const screen = add(g, new THREE.PlaneGeometry(0.42, 0.34), GLASS(), 0, 1.42, 0.82, -0.9); screen.material.side = THREE.DoubleSide;
    [-0.12, 0.12].forEach((x) => { add(g, new THREE.BoxGeometry(0.12, 0.06, 0.04), LAMP(), x, 1.05, 1.3, -0.3); rod(g, [x, 0.4, 1.0], [x, 1.18, 0.78], 0.035, CHROME()); });
    bars(g, 1.2, 0.72, 0.3, DARK()); add(g, new THREE.BoxGeometry(0.22, 0.06, 0.04), TAIL(), 0, 1.3, -1.17);
    rod(g, [0.18, 0.5, -0.1], [0.22, 0.95, -0.95], 0.06, CHROME());
    ud.seatY = 0.88; ud.riderZ = -0.38; ud.arm = -1.6;
  } else if (k === "hover") {
    ud.hover = true;
    profile(g, [[1.3, 0.62], [1.18, 0.92], [0.7, 1.12], [0.2, 1.06], [-0.3, 0.98], [-1.0, 1.12], [-1.25, 1.0], [-0.95, 0.7], [-0.3, 0.5], [0.5, 0.48]], 0.5, body);
    profile(g, [[1.0, 0.72], [1.24, 0.8], [1.16, 0.9], [0.8, 0.86]], 0.52, trim);
    const glowM = m(def.col2, { emissive: def.col2, emissiveIntensity: 1.6, roughness: 0.3 });
    [0.85, -0.8].forEach((z) => { add(g, new THREE.CylinderGeometry(0.3, 0.36, 0.16, 24), m("#2a2d36", { metalness: 0.7, roughness: 0.3 }), 0, 0.45, z); add(g, new THREE.CylinderGeometry(0.24, 0.24, 0.02, 24), glowM, 0, 0.36, z); });
    [-1, 1].forEach((s) => add(g, new THREE.BoxGeometry(0.03, 0.3, 0.45), trim, s * 0.28, 0.85, -0.85, 0, 0, s * 0.3));   // fins
    add(g, new THREE.BoxGeometry(0.32, 0.08, 0.55), DARK(), 0, 1.06, -0.4);
    const screen = add(g, new THREE.PlaneGeometry(0.42, 0.3), GLASS(), 0, 1.22, 0.68, -0.9); screen.material.side = THREE.DoubleSide;
    add(g, new THREE.BoxGeometry(0.4, 0.05, 0.05), glowM, 0, 0.82, 1.3);
    bars(g, 1.1, 0.6, 0.3, DARK());
    ud.seatY = 0.74; ud.riderZ = -0.38; ud.arm = -1.5;
  } else buildMore(g, def, body, trim, ud);
  // a coloured light on the ground under it
  if (def.glow) { const gl = new THREE.Mesh(new THREE.PlaneGeometry(ud.glowW || 1.8, ud.glowL || 3.2), new THREE.MeshBasicMaterial({ map: glowTex(), color: def.glow, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    gl.rotation.x = -Math.PI / 2; gl.position.y = 0.04; gl.renderOrder = 2; g.add(gl); ud.glow = gl; }
  // a touch bigger than life, so it suits the big-headed Jumpi characters
  const K = 1.18; g.scale.setScalar(K); ud.k = K; ud.seatY *= K; ud.riderZ *= K;
  g.userData = ud;
  return g;
}

// trail sparks behind a fast legendary bike: a small pool of points per bike
export function makeTrail(kind) {
  const N = 60, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: kind === "fire" ? 0.42 : 0.3, map: glowTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pts.frustumCulled = false;
  const P = Array.from({ length: N }, () => ({ life: 0, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, c: new THREE.Color() }));
  let next = 0;
  const RAIN = ["#ff4f4f", "#ffb21f", "#ffe14f", "#2fd36b", "#1fb6ff", "#9b5cff"];
  return {
    obj: pts,
    emit(x, y, z, face, k) {   // k = 0..1 how fast
      const p = P[next]; next = (next + 1) % N;
      p.life = 1; p.x = x - Math.sin(face) * 1.1 + (Math.random() - 0.5) * 0.3; p.y = y + Math.random() * 0.3; p.z = z - Math.cos(face) * 1.1 + (Math.random() - 0.5) * 0.3;
      p.vx = (Math.random() - 0.5) * 0.6; p.vy = kind === "fire" ? 0.9 + Math.random() : 0.2 + Math.random() * 0.5; p.vz = (Math.random() - 0.5) * 0.6;
      if (kind === "fire") p.c.set(Math.random() < 0.5 ? "#ff7a1c" : "#ffd23a");
      else if (kind === "rainbow") p.c.set(RAIN[(Math.random() * RAIN.length) | 0]);
      else if (kind === "stars") p.c.set(Math.random() < 0.5 ? "#9fe8ff" : "#ffffff");
      else p.c.set(Math.random() < 0.6 ? "#ffe27a" : "#ffffff");
      void k;
    },
    tick(dt) {
      for (let i = 0; i < N; i++) {
        const p = P[i];
        if (p.life > 0) { p.life -= dt * 1.4; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; }
        const a = Math.max(0, p.life);
        pos[i * 3] = p.x; pos[i * 3 + 1] = a > 0 ? p.y : -99; pos[i * 3 + 2] = p.z;
        col[i * 3] = p.c.r * a; col[i * 3 + 1] = p.c.g * a; col[i * 3 + 2] = p.c.b * a;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    },
  };
}

/* ---------- the newer vehicles: bicycles, boards and skates, carts and cars, flying things ---------- */
// cached geometries / textures (shared by every vehicle that uses them)
const GEO = new Map();
const geo = (key, make) => { if (!GEO.has(key)) GEO.set(key, make()); return GEO.get(key); };
const rbox = (w, h, d, r = 0.06) => geo(`rb${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)));
const TEX = new Map();
function canvasTex(key, w, h, draw, repeat) {
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  TEX.set(key, t); return t;
}
const texMat = (key, tex, o = {}) => { const k = "tex:" + key + JSON.stringify(o); if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, ...o })); return MATS.get(k); };
const glowMat = (c, i = 1.5) => m(c, { emissive: c, emissiveIntensity: i, roughness: 0.3 });
const shade = (c, k) => "#" + new THREE.Color(c).multiplyScalar(k).getHexString();
const RAINBOW = ["#ff4f4f", "#ff9a1f", "#ffe14f", "#2fd36b", "#1fb6ff", "#9b5cff"];
// a 5-point star outline
function starShape(R, r) { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r : R; i ? s.lineTo(Math.cos(a) * q, Math.sin(a) * q) : s.moveTo(Math.cos(a) * q, Math.sin(a) * q); } s.closePath(); return s; }
// two wheels on one axle (a group at the axle height: index.html spins wf / wb on x, its y is the radius)
function axle(g, r, z, half, width, style, rim) {
  const a = new THREE.Group(); a.position.set(0, r, z); g.add(a);
  [-1, 1].forEach((s) => { const w = wheel(a, r, 0, width, style, rim); w.position.set(s * half, 0, 0); });
  return a;
}
// a small plain wheel (skates, boards, scooters): tyre + hub
function smallWheel(par, r, w, x, y, z, tyreMat, hubMat) {
  const t = add(par, geo(`sw${r},${w}`, () => new THREE.CylinderGeometry(r, r, w, 16).rotateZ(Math.PI / 2)), tyreMat, x, y, z);
  add(par, geo(`swh${r},${w}`, () => new THREE.CylinderGeometry(r * 0.5, r * 0.5, w + 0.01, 10).rotateZ(Math.PI / 2)), hubMat, x, y, z);
  return t;
}
// a bicycle saddle
function saddle(g, y, z, mat, s = 1) { const sd = add(g, geo("saddle", () => new THREE.SphereGeometry(0.14, 16, 10)), mat, 0, y, z); sd.scale.set(1.15 * s, 0.38, 1.55 * s); return sd; }
// a bicycle-type frame and wheels (bicycle, BMX, tandem): returns the bottom bracket for the pedals
function pedals(g, y, z, mat) {
  const c = new THREE.Group(); c.position.set(0, y, z); g.add(c);
  add(c, cylX(0.09, 0.05, 16), CHROME());
  [-1, 1].forEach((s) => { const arm = new THREE.Group(); arm.position.x = s * 0.1; arm.rotation.x = s > 0 ? 0 : Math.PI; c.add(arm);
    add(arm, new THREE.BoxGeometry(0.03, 0.2, 0.04), CHROME(), 0, -0.09, 0);
    const p = add(arm, new THREE.BoxGeometry(0.12, 0.03, 0.08), mat, s * 0.07, -0.19, 0); p.userData.counter = true; });
  return c;
}
// the rider pedals: legs aren't separate, so the body bobs a little with the cranks
const pedalPose = (C, t, speed) => { const k = Math.min(1, Math.abs(speed) / 6); C.root.position.y += Math.abs(Math.sin(t * 7)) * 0.025 * k; };

function buildMore(g, def, body, trim, ud) {
  const k = def.kind;
  let last = -1, dist = 0;   // time and distance (for the tick functions)
  const step = (t, speed) => { const dt = last < 0 ? 0 : Math.min(0.1, Math.max(0, t - last)); last = t; dist += speed * dt; return dt; };
  // four-wheelers and boards don't lean on a kickstand when parked; cars barely roll when they turn
  const flat = (ridden, roll = 1) => { g.rotation.z = ridden ? g.rotation.z * roll : 0; };

  if (k === "bicycle" || k === "bmx" || k === "tandem") {
    const bmx = k === "bmx", tan = k === "tandem";
    const R = bmx ? 0.3 : 0.36, zf = bmx ? 0.55 : tan ? 1.08 : 0.64, zr = bmx ? -0.52 : tan ? -1.08 : -0.6;
    ud.wf = wheel(g, R, zf, bmx ? 0.11 : 0.07, bmx ? "star" : "spoke", trim); ud.wb = wheel(g, R, zr, bmx ? 0.11 : 0.07, bmx ? "star" : "spoke", trim);
    const fr = (a, b, r = bmx ? 0.045 : 0.035) => rod(g, a, b, r, body);
    const bb = [0, R + 0.02, tan ? 0.28 : bmx ? 0 : -0.02];
    const seatT = [0, bmx ? 0.8 : 0.96, tan ? 0.2 : bmx ? -0.2 : -0.24], head = [0, bmx ? 0.92 : 1.02, zf - (bmx ? 0.16 : 0.18)], headB = [0, bmx ? 0.72 : 0.8, zf - 0.13];
    fr(bb, seatT); fr(seatT, head); fr(bb, headB); fr(head, headB);
    if (tan) { const bb2 = [0, R + 0.02, -0.62], seat2 = [0, 0.96, -0.66]; fr(bb2, seat2); fr(seatT, seat2); fr(bb, bb2); fr(bb2, [0, R, zr]); fr(seat2, [0, R, zr]); pedals(g, bb2[1], bb2[2], DARK()).name = "crank2"; }
    else { fr(bb, [0, R, zr]); fr([0, seatT[1] - 0.06, seatT[2]], [0, R, zr]); }
    [-0.05, 0.05].forEach((x) => rod(g, [x, headB[1], headB[2]], [x, R, zf], 0.025, bmx ? body : CHROME()));
    pedals(g, bb[1], bb[2], DARK()).name = "crank";
    add(g, new THREE.CylinderGeometry(0.11, 0.11, 0.02, 18).rotateZ(Math.PI / 2), CHROME(), 0.08, bb[1], bb[2]);   // the chain ring
    rod(g, [0.08, bb[1] + 0.1, bb[2]], [0.08, R + 0.05, zr], 0.012, DARK()); rod(g, [0.08, bb[1] - 0.1, bb[2]], [0.08, R - 0.05, zr], 0.012, DARK());   // the chain
    // the saddle(s) and the handlebars
    rod(g, seatT, [0, seatT[1] + 0.06, seatT[2] - 0.02], 0.025, CHROME()); saddle(g, seatT[1] + 0.08, seatT[2] - 0.03, bmx ? trim : m("#3a2a20", { roughness: 0.8 }));
    const stemTop = [0, bmx ? 1.24 : 1.3, head[2] - (bmx ? 0.02 : 0.06)];
    rod(g, head, stemTop, 0.03, CHROME());
    if (bmx) { bars(g, stemTop[1] + 0.04, stemTop[2], 0.34, CHROME()); add(g, cylX(0.02, 0.4), CHROME(), 0, stemTop[1] - 0.06, stemTop[2]); add(g, rbox(0.16, 0.14, 0.05, 0.03), trim, 0, stemTop[1] - 0.12, stemTop[2] + 0.04);   // crossbar and the pad
      [-1, 1].forEach((s) => { add(g, cylX(0.035, 0.12, 10), CHROME(), s * 0.1, R, zf); add(g, cylX(0.035, 0.12, 10), CHROME(), s * 0.1, R, zr); });   // pegs
      add(g, rbox(0.3, 0.26, 0.04, 0.04), m("#ffffff", { roughness: 0.6 }), 0, stemTop[1] - 0.3, stemTop[2] + 0.12, -0.25);   // number plate
      add(g, new THREE.CircleGeometry(0.07, 16), trim, 0, stemTop[1] - 0.3, stemTop[2] + 0.145, -0.25);
    } else {
      // swept-back city bars
      add(g, cylX(0.025, 0.36), CHROME(), 0, stemTop[1], stemTop[2]);
      [-1, 1].forEach((s) => { rod(g, [s * 0.18, stemTop[1], stemTop[2]], [s * 0.3, stemTop[1] + 0.02, stemTop[2] - 0.16], 0.025, CHROME()); add(g, new THREE.CapsuleGeometry(0.035, 0.1, 4, 8), trim, s * 0.31, stemTop[1] + 0.02, stemTop[2] - 0.2, Math.PI / 2); });
      add(g, new THREE.SphereGeometry(0.045, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m("#ffd23a", { metalness: 0.5, roughness: 0.3 }), 0.16, stemTop[1] + 0.03, stemTop[2]);   // the bell
      fender(g, R, zf, 0.1, body, 0.05, 0.55); fender(g, R, zr, 0.1, body, -0.1, 0.5);
      add(g, rbox(0.04, 0.12, 0.42, 0.02), trim, 0.1, bb[1] + 0.04, (bb[2] + zr) * 0.45);   // the chain guard
      add(g, rbox(0.2, 0.03, 0.42, 0.012), CHROME(), 0, R + 0.46, zr - 0.04);   // rear rack and its tail light
      [-0.08, 0.08].forEach((x) => rod(g, [x, R + 0.45, zr - 0.2], [x, R, zr], 0.012, CHROME()));
      add(g, new THREE.BoxGeometry(0.1, 0.05, 0.03), TAIL(), 0, R + 0.43, zr - 0.26);
    }
    if (tan) {   // the second saddle and bars (empty seat for now)
      saddle(g, 1.04, -0.69, m("#3a2a20", { roughness: 0.8 }));
      rod(g, [0, 0.96, 0.08], [0, 1.18, -0.12], 0.025, CHROME()); add(g, cylX(0.022, 0.4), CHROME(), 0, 1.18, -0.12);
      [-1, 1].forEach((s) => add(g, new THREE.CapsuleGeometry(0.03, 0.08, 4, 8), trim, s * 0.21, 1.18, -0.12, 0, 0, Math.PI / 2));
    }
    if (k === "bicycle") {   // the wicker basket with flowers
      const wick = texMat("wicker", canvasTex("wicker", 64, 64, (c, w, h) => { c.fillStyle = "#b9844a"; c.fillRect(0, 0, w, h);
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { c.fillStyle = (x + y) % 2 ? "#d9a566" : "#a06c38"; c.fillRect(x * 8 + 1, y * 8 + 1, 6, 6); } }, true), { roughness: 0.85, side: THREE.DoubleSide });
      const bk = new THREE.Group(); bk.position.set(0, 1.08, zf + 0.04); g.add(bk);
      add(bk, geo("basket", () => new THREE.CylinderGeometry(0.24, 0.2, 0.26, 4, 1, true).rotateY(Math.PI / 4).scale(1, 1, 0.8)), wick);
      add(bk, geo("basketB", () => new THREE.BoxGeometry(0.27, 0.02, 0.22)), wick, 0, -0.12, 0);
      add(bk, geo("basketR", () => new THREE.TorusGeometry(0.34, 0.018, 6, 4).rotateZ(Math.PI / 4).rotateX(Math.PI / 2).scale(1, 1, 0.8)), m("#8a5a2c", { roughness: 0.8 }), 0, 0.13, 0);
      rod(g, [0, 0.95, zf - 0.05], [0, 0.98, zf + 0.04], 0.02, CHROME());
      [[-0.07, 0.04, "#ff6fa8"], [0.06, -0.03, "#ffd23a"], [0.02, 0.07, "#ffffff"]].forEach(([x, z, c]) => {
        add(bk, new THREE.CylinderGeometry(0.008, 0.008, 0.2, 5), m("#3f9a3a"), x, 0.12, z);
        const fl = add(bk, geo("flower", () => new THREE.SphereGeometry(0.05, 8, 6)), m(c, { roughness: 0.6 }), x, 0.23, z); fl.scale.y = 0.55;
        add(bk, geo("flowerC", () => new THREE.SphereGeometry(0.022, 8, 6)), m("#ffb21f"), x, 0.25, z); });
      headlight(g, 0.92, zf + 0.25, 0.06);
    }
    ud.seatY = bmx ? 0.48 : 0.64; ud.riderZ = tan ? 0.17 : bmx ? -0.23 : -0.27; ud.arm = bmx ? -1.35 : -1.15;
    const cranks = [];
    g.traverse((o) => { if (o.name === "crank" || o.name === "crank2") cranks.push(o); });
    ud.tick = (t, speed, ridden) => { step(t, speed); for (const c of cranks) { c.rotation.x = dist * 1.6; c.children.forEach((a) => a.children.forEach((p) => { if (p.userData.counter) p.rotation.x = -(c.rotation.x + a.rotation.x); })); } void ridden; };
    ud.pose = pedalPose;
  } else if (k === "skate" || k === "coinboard") {
    // a skateboard: the rider stands on the deck, a little sideways like a skater
    const coin = k === "coinboard";
    const trucks = new THREE.Group(); g.add(trucks);
    const wh = def.col2 && !coin ? m(def.col2, { roughness: 0.5 }) : m("#fff4d6", { roughness: 0.5 });
    const wz = coin ? 0.34 : 0.48, wx = coin ? 0.24 : 0.2, wr = 0.085;
    const wfront = new THREE.Group(), wback = new THREE.Group(); wfront.position.set(0, wr, wz); wback.position.set(0, wr, -wz); g.add(wfront, wback);
    [[wfront, wz], [wback, -wz]].forEach(([wg, z]) => { [-1, 1].forEach((s) => smallWheel(wg, wr, 0.08, s * wx, 0, 0, wh, CHROME()));
      add(g, cylX(0.025, wx * 2 - 0.06), CHROME(), 0, wr, z); add(g, rbox(0.14, 0.08, 0.1, 0.03), m("#9aa4b2", { metalness: 0.5, roughness: 0.35 }), 0, wr + 0.06, z); });
    ud.wf = wfront; ud.wb = wback;
    const top = wr + 0.14;
    if (coin) {
      // a big round coin: milled edge, raised rim and an embossed star
      const coinCol = def.col, rainbow = def.coin === "rainbow";
      const face = rainbow ? texMat("coinRainbow", canvasTex("coinRainbow", 256, 256, (c, w, h) => { const gr = c.createConicGradient(0, w / 2, h / 2); RAINBOW.concat(RAINBOW[0]).forEach((col, i) => gr.addColorStop(i / 6, col)); c.fillStyle = gr; c.fillRect(0, 0, w, h); }), { roughness: 0.3, metalness: 0.2, emissive: "#ffffff", emissiveIntensity: 0.12 })
        : m(coinCol, { metalness: 0.5, roughness: 0.25, emissive: coinCol, emissiveIntensity: 0.18 });
      const rim = rainbow ? m("#ffffff", { metalness: 0.5, roughness: 0.25, emissive: "#ffe9ff", emissiveIntensity: 0.2 }) : m(shade(coinCol, 0.86), { metalness: 0.55, roughness: 0.25, emissive: coinCol, emissiveIntensity: 0.12 });
      const edgeTex = canvasTex("coinEdge", 256, 16, (c, w, h) => { c.fillStyle = "#ffffff"; c.fillRect(0, 0, w, h); c.fillStyle = "#9a9a9a"; for (let x = 0; x < w; x += 4) c.fillRect(x, 0, 2, h); }, true);
      edgeTex.repeat.set(6, 1);
      const edge = texMat("coinEdge" + coinCol, edgeTex, { color: rainbow ? "#ffd6f5" : coinCol, metalness: 0.5, roughness: 0.3, emissive: rainbow ? "#ff9ccc" : coinCol, emissiveIntensity: 0.12 });
      const R = 0.58, th = 0.07, y = top - th / 2;
      add(g, geo("coinEdgeG", () => new THREE.CylinderGeometry(R, R, th, 48, 1, true)), edge, 0, y, 0);
      add(g, geo("coinFace", () => new THREE.CircleGeometry(R, 48).rotateX(-Math.PI / 2)), face, 0, top, 0);
      add(g, geo("coinBot", () => new THREE.CircleGeometry(R, 48).rotateX(Math.PI / 2)), rim, 0, top - th, 0);
      add(g, geo("coinRim", () => new THREE.TorusGeometry(R - 0.035, 0.03, 8, 48).rotateX(Math.PI / 2)), rim, 0, top, 0);
      add(g, geo("coinRing", () => new THREE.TorusGeometry(R - 0.13, 0.012, 6, 40).rotateX(Math.PI / 2)), rim, 0, top + 0.005, 0);
      const star = add(g, geo("coinStar", () => new THREE.ExtrudeGeometry(starShape(0.3, 0.13), { depth: 0.02, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 }).rotateX(-Math.PI / 2)), rim, 0, top, 0);
      void star;
      ud.seatY = top + 0.005;
    } else {
      // the deck with kicked-up tail and nose, grip tape on top and a print underneath
      const deckTex = canvasTex("deck" + def.col + def.col2, 64, 256, (c, w, h) => { c.fillStyle = def.col; c.fillRect(0, 0, w, h); c.fillStyle = def.col2; for (let i = 0; i < 6; i++) { c.save(); c.translate(w / 2, 30 + i * 40); c.rotate(Math.PI / 4); c.fillRect(-14, -14, 28, 28); c.restore(); } }, true);
      const deckShape = new THREE.Shape(); const L = 0.55, W = 0.24;
      deckShape.moveTo(-W, -L + W); deckShape.absarc(0, -L + W, W, Math.PI, Math.PI * 2, false); deckShape.lineTo(W, L - W); deckShape.absarc(0, L - W, W, 0, Math.PI, false); deckShape.closePath();
      const dg = geo("deck", () => { const gg = new THREE.ExtrudeGeometry(deckShape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 12 }); gg.rotateX(-Math.PI / 2);
        // bend up nose and tail
        const p = gg.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i), a = Math.max(0, Math.abs(z) - 0.36); p.setY(i, p.getY(i) + a * a * 3.2); }
        gg.computeVertexNormals();
        // three groups: top caps (grip), bottom caps (print), sides
        const P = gg.attributes.position, N = gg.attributes.normal, UV = gg.attributes.uv, top = [], bot = [], side = [];
        const cap = gg.groups[0], tri = (i) => [P, N, UV].map((a) => Array.from(a.array.slice(i * 3 * a.itemSize, (i + 1) * 3 * a.itemSize)));
        for (let i = 0; i < P.count / 3; i++) { const inCap = i * 3 >= cap.start && i * 3 < cap.start + cap.count; (inCap ? (N.getY(i * 3) > 0 ? top : bot) : side).push(tri(i)); }
        const out = new THREE.BufferGeometry(), all = top.concat(bot, side);
        [["position", 3, 0], ["normal", 3, 1], ["uv", 2, 2]].forEach(([nm, sz, k]) => out.setAttribute(nm, new THREE.Float32BufferAttribute(all.flatMap((t) => t[k]), sz)));
        out.addGroup(0, top.length * 3, 0); out.addGroup(top.length * 3, bot.length * 3, 1); out.addGroup((top.length + bot.length) * 3, side.length * 3, 2);
        gg.dispose(); return out; });
      const deck = add(g, dg, [texMat("deckGrip", canvasTex("grip", 32, 32, (c, w, h) => { c.fillStyle = "#26282e"; c.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { c.fillStyle = Math.random() < 0.5 ? "#3a3d45" : "#1b1c20"; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }, true), { roughness: 0.95 }), texMat("deckPrint" + def.col, deckTex, { roughness: 0.5 }), m(def.col, { roughness: 0.5 })], 0, top - 0.03, 0);
      // grip on the top face only: group 0 = caps, 1 = sides (ExtrudeGeometry); put the print on the sides
      void deck;
      ud.seatY = top + 0.035;
    }
    ud.riderZ = 0; ud.stand = true; ud.armOut = 0.95; ud.arm = -0.3; ud.glowW = coin ? 1.5 : 1.0; ud.glowL = coin ? 1.5 : 1.6;
    ud.tick = (t, speed, ridden) => { step(t, speed); flat(ridden); };
    ud.pose = (C, t, speed) => { const s = Math.min(1, Math.abs(speed) / 8); C.root.rotation.y = g.rotation.y + 0.42; C.root.rotation.x = 0.06 * s; C.root.position.y -= 0.03 * s + Math.sin(t * 2.4) * 0.01; };
  } else if (k === "blades") {
    // glowing rollerblades: just the two skates under the feet; the rider glides, swaying side to side
    const boot = m(def.col, { roughness: 0.35 }), cuff = m(def.col2, { roughness: 0.4 }), lit = glowMat(def.glow || def.col2, 1.8);
    const feet = [];
    [-1, 1].forEach((s) => {
      const f = new THREE.Group(); f.position.set(s * 0.17, 0, 0); g.add(f); feet.push(f);
      add(f, rbox(0.19, 0.08, 0.42, 0.035), boot, 0, 0.215, 0.02);   // the sole of the boot
      add(f, rbox(0.205, 0.05, 0.2, 0.02), cuff, 0, 0.25, -0.1);   // heel strap
      add(f, rbox(0.06, 0.06, 0.4, 0.02), m("#3a3f4a", { metalness: 0.5, roughness: 0.35 }), 0, 0.15, 0.02);   // the frame
      for (let i = 0; i < 4; i++) smallWheel(f, 0.065, 0.05, 0, 0.065, -0.15 + i * 0.11, lit, m("#ffffff"));
      add(f, rbox(0.06, 0.06, 0.06, 0.025), m("#e8423b"), 0, 0.08, -0.24);   // brake
    });
    ud.seatY = 0.21; ud.riderZ = 0; ud.stand = true; ud.armOut = 0.75; ud.glowW = 1.0; ud.glowL = 1.0;
    ud.wf = null; ud.wb = null;
    let ph = 0;
    ud.tick = (t, speed, ridden) => { const dt = step(t, speed); flat(ridden); const s = Math.min(1, Math.abs(speed) / 8); ph += dt * (1.5 + Math.abs(speed) * 0.35);
      feet.forEach((f, i) => { f.position.z = Math.sin(ph + i * Math.PI) * 0.12 * s; f.children.forEach((c) => { if (c.geometry && c.geometry.type === "CylinderGeometry" && c.material === lit) c.rotation.x = -dist * 15; }); }); };
    ud.pose = (C, t, speed) => { const s = Math.min(1, Math.abs(speed) / 8); C.root.rotation.z += Math.sin(ph) * 0.12 * s; C.root.rotation.x = 0.12 * s; C.armL.rotation.x += Math.sin(ph) * 0.35 * s; C.armR.rotation.x -= Math.sin(ph) * 0.35 * s; };
  } else if (k === "kick" || k === "kidscooter") {
    // standing scooters: a deck, a T-bar; the kids' one has two wheels in front and light-up wheels
    const kid = k === "kidscooter";
    const wr = kid ? 0.11 : 0.1, wf = new THREE.Group(), wb = new THREE.Group(); wf.position.set(0, wr, 0.5); wb.position.set(0, wr, -0.5); g.add(wf, wb);
    const tyre = kid ? glowMat(def.glow || "#ff7ac8", 1.2) : m("#ffffff", { roughness: 0.6 });
    if (kid) [-1, 1].forEach((s) => smallWheel(wf, wr, 0.08, s * 0.17, 0, 0, tyre, m("#ffffff"))); else smallWheel(wf, wr, 0.06, 0, 0, 0, tyre, CHROME());
    smallWheel(wb, wr, 0.06, 0, 0, 0, tyre, kid ? m("#ffffff") : CHROME());
    ud.wf = wf; ud.wb = wb;
    const deckY = wr + 0.08;
    if (kid) {
      const rb = texMat("rainbowDeck", canvasTex("rainbowDeck", 32, 128, (c, w, h) => { RAINBOW.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, (i * h) / 6, w, h / 6 + 1); }); }), { roughness: 0.45 });
      add(g, rbox(0.34, 0.06, 0.82, 0.03), body, 0, deckY, -0.05);
      add(g, new THREE.PlaneGeometry(0.28, 0.72).rotateX(-Math.PI / 2), rb, 0, deckY + 0.032, -0.06);
      add(g, rbox(0.42, 0.08, 0.16, 0.04), body, 0, wr + 0.04, 0.5);   // the front wheel housing
      add(g, rbox(0.12, 0.05, 0.2, 0.02), body, 0, wr * 2 + 0.03, -0.5);   // rear brake fender
    } else {
      add(g, rbox(0.2, 0.05, 0.86, 0.025), body, 0, deckY, -0.04);
      add(g, new THREE.PlaneGeometry(0.16, 0.74).rotateX(-Math.PI / 2), m("#26282e", { roughness: 0.95 }), 0, deckY + 0.027, -0.04);
      fender(g, wr, -0.5, 0.08, body, -0.1, 0.45);
      rod(g, [0, deckY, 0.36], [0, wr, 0.5], 0.03, CHROME());
    }
    const barY = kid ? 1.06 : 1.12;
    rod(g, [0, deckY, 0.4], [0, barY, 0.36], kid ? 0.045 : 0.035, kid ? trim : CHROME());
    add(g, cylX(kid ? 0.035 : 0.028, 0.6), kid ? trim : CHROME(), 0, barY, 0.36);
    [-1, 1].forEach((s) => add(g, new THREE.CapsuleGeometry(kid ? 0.05 : 0.04, 0.12, 4, 10), kid ? body : DARK(), s * 0.3, barY, 0.36, 0, 0, Math.PI / 2));
    if (kid) {   // streamers on the grips and a little flower on the stem
      [-1, 1].forEach((s) => RAINBOW.slice(0, 4).forEach((col, i) => add(g, new THREE.BoxGeometry(0.012, 0.16, 0.025), m(col), s * (0.38 + i * 0.012), barY - 0.06, 0.36 - 0.03 + i * 0.02, 0, 0, s * 0.3)));
      const fl = add(g, new THREE.CylinderGeometry(0.08, 0.08, 0.03, 10).rotateX(Math.PI / 2), m("#ffffff"), 0, barY - 0.25, 0.4); fl.rotation.x = -0.1;
      add(g, new THREE.SphereGeometry(0.035, 10, 8), m("#ffd23a"), 0, barY - 0.25, 0.42);
    }
    ud.seatY = deckY + 0.04; ud.riderZ = -0.18; ud.arm = -1.45; ud.glowW = 1.0; ud.glowL = 1.5;
    ud.tick = (t, speed, ridden) => { step(t, speed); flat(ridden); };
    ud.pose = (C, t, speed) => { const s = Math.min(1, Math.abs(speed) / 6); C.root.position.y += Math.abs(Math.sin(t * 4)) * 0.04 * s; C.root.rotation.x = 0.05 * s; };
  } else if (k === "golf") {
    ud.wf = axle(g, 0.24, 0.72, 0.52, 0.16, "disc", m("#e8ecf2", { metalness: 0.3, roughness: 0.35 })); ud.wb = axle(g, 0.24, -0.72, 0.52, 0.16, "disc", m("#e8ecf2", { metalness: 0.3, roughness: 0.35 }));
    add(g, rbox(1.06, 0.14, 2.0, 0.06), DARK(), 0, 0.32, 0);   // the floor
    add(g, rbox(1.12, 0.5, 0.62, 0.2), body, 0, 0.5, 0.86);   // the nose
    add(g, rbox(1.12, 0.36, 0.7, 0.14), body, 0, 0.5, -0.66);   // the back under the seat
    [-1, 1].forEach((s) => { add(g, rbox(0.14, 0.12, 0.42, 0.05), body, s * 0.56, 0.48, 0.72); add(g, rbox(0.14, 0.12, 0.42, 0.05), body, s * 0.56, 0.48, -0.72); });   // fenders
    const seatM = m(def.col2, { roughness: 0.6 });
    add(g, rbox(1.0, 0.16, 0.56, 0.07), seatM, 0, 0.76, -0.5);   // bench seat
    add(g, rbox(1.0, 0.46, 0.14, 0.07), seatM, 0, 1.02, -0.82, -0.12);   // backrest
    // dashboard and steering wheel
    add(g, rbox(1.0, 0.2, 0.2, 0.06), DARK(), 0, 0.8, 0.56);
    rod(g, [0, 0.8, 0.5], [0, 1.08, 0.3], 0.025, DARK());
    add(g, new THREE.TorusGeometry(0.15, 0.025, 8, 20), DARK(), 0, 1.1, 0.28, -0.9);
    // the roof on four posts (high up so the rider's head fits under it)
    const post = m("#e8ecf2", { metalness: 0.3, roughness: 0.35 });
    [[-0.5, 0.62], [0.5, 0.62], [-0.5, -0.86], [0.5, -0.86]].forEach(([x, z]) => rod(g, [x, 0.58, z], [x * 0.96, 2.58, z * 0.95], 0.03, post));
    add(g, rbox(1.2, 0.08, 1.85, 0.04), trim, 0, 2.62, -0.12);
    const stripes = texMat("golfRoof" + def.col, canvasTex("golfRoof" + def.col, 64, 16, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? def.col : "#ffffff"; c.fillRect((i * w) / 8, 0, w / 8 + 1, h); } }), { roughness: 0.6 });
    [-1, 1].forEach((s) => add(g, new THREE.PlaneGeometry(1.85, 0.12).rotateY(Math.PI / 2), stripes, s * 0.605, 2.54, -0.12));
    const wsh = add(g, new THREE.PlaneGeometry(0.96, 0.5), GLASS(), 0, 2.28, 0.6, -0.12); wsh.material.side = THREE.DoubleSide;   // the windscreen is high (over the face)
    // a golf bag at the back
    add(g, new THREE.CylinderGeometry(0.13, 0.12, 0.6, 14), m("#ffffff", { roughness: 0.5 }), 0.25, 1.0, -1.05, -0.25);
    [-0.04, 0.02, 0.07].forEach((x, i) => { rod(g, [0.25 + x, 1.2, -1.1], [0.25 + x * 2, 1.48, -1.16 - i * 0.03], 0.012, CHROME()); add(g, new THREE.SphereGeometry(0.05, 8, 6), m(["#1d1f26", "#3a3f4a", "#1d1f26"][i]), 0.25 + x * 2, 1.5, -1.16 - i * 0.03); });
    [-0.36, 0.36].forEach((x) => { headlight(g, 0.56, 1.18, 0.07); g.children[g.children.length - 2].position.x = x; g.children[g.children.length - 1].position.x = x; });
    ud.seatY = 0.7; ud.riderZ = -0.48; ud.arm = -1.15;
    ud.tick = (t, speed, ridden) => flat(ridden, 0.3);
  } else if (k === "quad") {
    ud.wf = axle(g, 0.3, 0.68, 0.5, 0.24, "knobby", trim); ud.wb = axle(g, 0.32, -0.66, 0.5, 0.28, "knobby", trim);
    add(g, rbox(0.5, 0.3, 1.2, 0.1), m("#3a3f4a", { metalness: 0.5, roughness: 0.4 }), 0, 0.52, 0);   // engine and frame
    // the body: front and back fenders over the wheels
    add(g, rbox(1.2, 0.18, 0.62, 0.08), body, 0, 0.78, 0.66);
    add(g, rbox(1.24, 0.18, 0.66, 0.08), body, 0, 0.82, -0.62);
    add(g, rbox(0.6, 0.28, 0.5, 0.12), body, 0, 0.88, 0.32);   // tank
    add(g, rbox(0.42, 0.18, 0.72, 0.08), DARK(), 0, 1.0, -0.22);   // seat
    [[0.66, 0.92], [-0.62, 0.96]].forEach(([z, y]) => { add(g, rbox(1.0, 0.04, 0.5, 0.02), DARK(), 0, y, z); });   // racks
    rod(g, [0, 0.96, 0.42], [0, 1.24, 0.34], 0.035, DARK()); bars(g, 1.26, 0.34, 0.4, DARK());
    headlight(g, 0.82, 0.98, 0.08); g.children[g.children.length - 2].position.x = -0.3; g.children[g.children.length - 1].position.x = -0.3;
    headlight(g, 0.82, 0.98, 0.08); g.children[g.children.length - 2].position.x = 0.3; g.children[g.children.length - 1].position.x = 0.3;
    add(g, rbox(0.2, 0.06, 0.04, 0.02), TAIL(), 0, 0.84, -0.96);
    add(g, new THREE.BoxGeometry(1.0, 0.03, 0.03), trim, 0, 0.88, 0.97);
    ud.seatY = 0.72; ud.riderZ = -0.24; ud.arm = -1.3;
    ud.tick = (t, speed, ridden) => flat(ridden, 0.6);
  } else if (k === "bubblecar") {
    // a little round car: an open bowl, the rider's head and shoulders above the rim
    ud.wf = axle(g, 0.2, 0.62, 0.52, 0.14, "disc", trim); ud.wb = axle(g, 0.2, -0.62, 0.52, 0.14, "disc", trim);
    const bowl = add(g, geo("bubbleBowl", () => new THREE.SphereGeometry(1, 36, 18, 0, Math.PI * 2, Math.PI * 0.36, Math.PI * 0.64)), body, 0, 0.82, 0);
    bowl.scale.set(0.74, 0.66, 1.04);
    const inner = add(g, geo("bubbleIn", () => new THREE.SphereGeometry(0.96, 30, 14, 0, Math.PI * 2, Math.PI * 0.36, Math.PI * 0.64)), m(shade(def.col, 0.6), { roughness: 0.7, side: THREE.BackSide }), 0, 0.82, 0);
    inner.scale.copy(bowl.scale);
    const rimY = 0.82 + Math.cos(Math.PI * 0.36) * 0.66;
    add(g, geo("bubbleRim", () => new THREE.TorusGeometry(1, 0.045, 8, 40).rotateX(Math.PI / 2)), trim, 0, rimY, 0).scale.set(Math.sin(Math.PI * 0.36) * 0.74, 1, Math.sin(Math.PI * 0.36) * 1.04);
    add(g, rbox(0.6, 0.14, 0.5, 0.06), m(def.col2, { roughness: 0.6 }), 0, 0.52, -0.2);   // seat
    add(g, rbox(0.6, 0.5, 0.12, 0.06), m(def.col2, { roughness: 0.6 }), 0, 0.82, -0.5, -0.15);
    // big friendly headlight eyes and a smile bumper
    [-1, 1].forEach((s) => { const e = add(g, new THREE.SphereGeometry(0.13, 16, 10), LAMP(), s * 0.3, 0.86, 0.86); e.scale.z = 0.6; });
    add(g, rbox(0.9, 0.1, 0.12, 0.05), CHROME(), 0, 0.5, 0.98); add(g, rbox(0.9, 0.1, 0.12, 0.05), CHROME(), 0, 0.5, -0.98);
    rod(g, [0, 0.9, 0.5], [0, 1.12, 0.32], 0.025, DARK()); add(g, new THREE.TorusGeometry(0.13, 0.025, 8, 18), DARK(), 0, 1.14, 0.3, -0.9);
    add(g, new THREE.SphereGeometry(0.09, 12, 8), trim, 0, 1.28, -0.62);   // a little bobble on an antenna at the back
    rod(g, [0, 1.0, -0.66], [0, 1.24, -0.63], 0.012, CHROME());
    add(g, new THREE.BoxGeometry(0.16, 0.06, 0.04), TAIL(), -0.32, 0.86, -0.98); add(g, new THREE.BoxGeometry(0.16, 0.06, 0.04), TAIL(), 0.32, 0.86, -0.98);
    ud.seatY = 0.5; ud.riderZ = -0.12; ud.arm = -1.2;
    ud.tick = (t, speed, ridden) => flat(ridden, 0.3);
  } else if (k === "jeep") {
    ud.wf = axle(g, 0.36, 0.92, 0.62, 0.26, "knobby", m("#3a3f4a", { metalness: 0.4, roughness: 0.4 })); ud.wb = axle(g, 0.36, -0.84, 0.62, 0.26, "knobby", m("#3a3f4a", { metalness: 0.4, roughness: 0.4 }));
    add(g, rbox(1.18, 0.5, 2.5, 0.12), body, 0, 0.78, 0.02);   // the tub
    add(g, rbox(1.08, 0.12, 2.1, 0.05), m(shade(def.col, 0.55), { roughness: 0.8 }), 0, 1.0, -0.02);   // inside floor (darker)
    add(g, rbox(1.14, 0.22, 0.86, 0.1), body, 0, 1.08, 0.82);   // the bonnet
    add(g, rbox(1.0, 0.2, 0.1, 0.04), DARK(), 0, 0.88, 1.28);   // grille
    for (let i = 0; i < 5; i++) add(g, new THREE.BoxGeometry(0.04, 0.16, 0.02), CHROME(), -0.3 + i * 0.15, 0.88, 1.33);
    [-1, 1].forEach((s) => { headlight(g, 1.0, 1.3, 0.09); g.children[g.children.length - 2].position.x = s * 0.42; g.children[g.children.length - 1].position.x = s * 0.42;
      add(g, rbox(0.24, 0.1, 0.72, 0.05), DARK(), s * 0.62, 0.88, 0.92); add(g, rbox(0.24, 0.1, 0.72, 0.05), DARK(), s * 0.62, 0.88, -0.86);   // fender flares
      add(g, rbox(0.12, 0.06, 0.7, 0.03), DARK(), s * 0.62, 0.5, 0.04); });   // step
    // windscreen frame (folded up), roll bar, seat and wheel
    [-0.5, 0.5].forEach((x) => rod(g, [x, 1.2, 0.4], [x, 1.85, 0.32], 0.035, trim)); add(g, cylX(0.035, 1.04), trim, 0, 1.85, 0.32); add(g, cylX(0.035, 1.04), trim, 0, 1.2, 0.4);
    const ws = add(g, new THREE.PlaneGeometry(0.96, 0.6), GLASS(), 0, 1.53, 0.36, -0.12); ws.material.side = THREE.DoubleSide;
    [-0.52, 0.52].forEach((x) => { rod(g, [x, 1.0, -0.42], [x, 2.1, -0.52], 0.045, trim); rod(g, [x, 2.1, -0.52], [x, 1.0, -1.1], 0.045, trim); }); add(g, cylX(0.045, 1.04), trim, 0, 2.1, -0.52);
    const seatM = m("#3a2a20", { roughness: 0.75 });
    add(g, rbox(0.62, 0.14, 0.52, 0.06), seatM, 0, 1.08, -0.2); add(g, rbox(0.62, 0.52, 0.14, 0.06), seatM, 0, 1.36, -0.46, -0.12);
    rod(g, [0, 1.18, 0.38], [0, 1.4, 0.2], 0.025, DARK()); add(g, new THREE.TorusGeometry(0.15, 0.028, 8, 20), DARK(), 0, 1.42, 0.18, -0.9);
    // the spare wheel on the back
    const sp = new THREE.Group(); sp.position.set(0, 1.0, -1.32); g.add(sp); wheel(sp, 0.34, 0, 0.22, "knobby", trim).rotation.y = Math.PI / 2; sp.children[0].position.set(0, 0, 0);
    [-0.4, 0.4].forEach((x) => add(g, new THREE.BoxGeometry(0.16, 0.06, 0.04), TAIL(), x, 0.9, -1.25));
    ud.seatY = 0.88; ud.riderZ = -0.2; ud.arm = -1.15;
    ud.tick = (t, speed, ridden) => flat(ridden, 0.3);
  } else if (k === "supercar") {
    // a low open sports car (a speedster: no roof, so the rider shows)
    const rimM = m("#2a2d36", { metalness: 0.6, roughness: 0.3 });
    ud.wf = axle(g, 0.3, 1.0, 0.62, 0.22, "star", trim); ud.wb = axle(g, 0.32, -0.92, 0.62, 0.28, "star", trim); void rimM;
    // side profile (z, y), extruded across
    const pf = [[1.5, 0.3], [1.52, 0.48], [1.2, 0.68], [0.6, 0.8], [0.42, 0.86], [0.1, 0.78], [-0.55, 0.78], [-0.75, 0.92], [-1.3, 0.92], [-1.42, 0.7], [-1.42, 0.3], [-1.1, 0.22], [1.2, 0.22]];
    profile(g, pf, 1.1, body);
    add(g, rbox(0.84, 0.3, 0.9, 0.12), DARK(), 0, 0.72, -0.15);   // the cockpit (cut in: a dark tub on top)
    add(g, rbox(0.8, 0.12, 0.6, 0.05), m(def.col2, { roughness: 0.6 }), 0, 0.62, -0.18);   // seat
    add(g, rbox(0.8, 0.44, 0.14, 0.06), m(def.col2, { roughness: 0.6 }), 0, 0.86, -0.5, -0.2);
    // stripes, lights, spoiler, windscreen, exhausts
    add(g, new THREE.BoxGeometry(0.22, 0.02, 0.9), trim, 0, 0.82, 0.95, -0.2);
    [-1, 1].forEach((s) => { add(g, rbox(0.3, 0.07, 0.06, 0.03), LAMP(), s * 0.38, 0.55, 1.5, -0.3); add(g, rbox(0.3, 0.07, 0.04, 0.03), TAIL(), s * 0.38, 0.72, -1.48);
      add(g, rbox(0.04, 0.12, 0.5, 0.02), DARK(), s * 0.6, 0.5, 0.0);   // side intake
      rod(g, [s * 0.4, 0.96, -1.12], [s * 0.4, 1.12, -1.18], 0.03, DARK()); add(g, new THREE.CylinderGeometry(0.06, 0.07, 0.1, 12).rotateX(Math.PI / 2), CHROME(), s * 0.22, 0.32, -1.48); });
    add(g, rbox(1.2, 0.05, 0.3, 0.02), trim, 0, 1.14, -1.22);
    const ws = add(g, new THREE.PlaneGeometry(0.84, 0.26), GLASS(), 0, 0.98, 0.36, -0.75); ws.material.side = THREE.DoubleSide;
    rod(g, [0, 0.78, 0.28], [0, 0.95, 0.15], 0.025, DARK()); add(g, new THREE.TorusGeometry(0.14, 0.026, 8, 20), DARK(), 0, 0.97, 0.13, -0.9);
    ud.seatY = 0.5; ud.riderZ = -0.16; ud.arm = -1.25;
    ud.tick = (t, speed, ridden) => flat(ridden, 0.3);
  } else if (k === "sofa") {
    // a little flying sofa: cushions, armrests, little wings and glowing feet
    ud.hover = true;
    const cush = m(def.col2, { roughness: 0.7 }), wood = m("#8a5a2c", { roughness: 0.6 });
    add(g, rbox(1.36, 0.36, 0.95, 0.14), body, 0, 0.42, 0);   // the base
    add(g, rbox(1.0, 0.18, 0.8, 0.08), cush, 0, 0.66, 0.04);   // seat cushion
    add(g, rbox(1.36, 0.82, 0.3, 0.14), body, 0, 0.84, -0.4, -0.08);   // backrest
    add(g, rbox(1.0, 0.5, 0.14, 0.07), cush, 0, 0.92, -0.24, -0.1);   // back cushion
    [-1, 1].forEach((s) => { add(g, rbox(0.24, 0.52, 0.95, 0.12), body, s * 0.6, 0.62, 0);   // armrests
      add(g, geo("sofaRoll", () => new THREE.CylinderGeometry(0.13, 0.13, 0.95, 16).rotateX(Math.PI / 2)), body, s * 0.6, 0.86, 0);
      [0.34, -0.34].forEach((z) => { add(g, new THREE.CylinderGeometry(0.05, 0.035, 0.18, 10), wood, s * 0.54, 0.16, z); add(g, new THREE.SphereGeometry(0.07, 10, 8), glowMat(def.glow || "#7fd6ff", 1.4), s * 0.54, 0.06, z); });
      // a little feathery wing on each side
      const wgp = new THREE.Group(); wgp.position.set(s * 0.72, 0.84, -0.28); wgp.name = "wing" + s; g.add(wgp);
      for (let i = 0; i < 3; i++) { const f = add(wgp, geo("feather", () => new THREE.SphereGeometry(0.2, 12, 8)), m("#ffffff", { roughness: 0.6 }), s * (0.14 + i * 0.08), 0.1 - i * 0.07, -0.08 - i * 0.04); f.scale.set(1.2 - i * 0.2, 0.32, 0.6); f.rotation.z = s * (0.4 - i * 0.15); } });
    // buttons on the backrest
    [-0.3, 0, 0.3].forEach((x) => add(g, new THREE.SphereGeometry(0.03, 8, 6), trim, x, 1.0, -0.17));
    const wings = g.children.filter((o) => o.name.startsWith("wing"));
    ud.seatY = 0.62; ud.riderZ = 0.02; ud.arm = -0.35;
    ud.tick = (t, speed) => { wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * Math.sin(t * (6 + Math.min(10, Math.abs(speed)))) * 0.35; }); };
    ud.pose = (C) => { C.armL.rotation.set(-0.35, 0, -0.55); C.armR.rotation.set(-0.35, 0, 0.55); };
  } else if (k === "snowmobile") {
    // a snowmobile: skis in front, a rubber track at the back (it rolls when you ride)
    const ski = m("#2a2d36", { roughness: 0.5 });
    [-1, 1].forEach((s) => { const sk = add(g, rbox(0.14, 0.05, 1.0, 0.02), ski, s * 0.46, 0.06, 0.9); void sk;
      add(g, geo("skiTip", () => new THREE.TorusGeometry(0.12, 0.025, 6, 10, Math.PI / 2).rotateY(Math.PI / 2)), ski, s * 0.46, 0.2, 1.38, 0, 0, 0);
      rod(g, [s * 0.46, 0.08, 0.86], [s * 0.3, 0.5, 0.7], 0.04, DARK()); });
    const trackTex = canvasTex("track", 16, 64, (c, w, h) => { c.fillStyle = "#26282e"; c.fillRect(0, 0, w, h); c.fillStyle = "#4a4d55"; for (let y = 0; y < h; y += 8) c.fillRect(0, y, w, 3); }, true);
    const tt = trackTex.clone(); tt.needsUpdate = true; tt.repeat.set(1, 3);
    const trackM = new THREE.MeshStandardMaterial({ map: tt, roughness: 0.9 });
    const track = add(g, new THREE.CapsuleGeometry(0.2, 0.9, 4, 12).rotateX(Math.PI / 2), trackM, 0, 0.22, -0.5); track.scale.x = 2.2;
    add(g, rbox(0.62, 0.3, 1.0, 0.12), m("#3a3f4a", { metalness: 0.4, roughness: 0.4 }), 0, 0.42, -0.5);
    // the nose and the body
    profile(g, [[1.15, 0.32], [1.2, 0.5], [0.9, 0.82], [0.45, 0.98], [0.2, 0.86], [-0.1, 0.62], [-1.0, 0.62], [-1.0, 0.42], [0.1, 0.32]], 0.72, body);
    profile(g, [[1.18, 0.42], [1.2, 0.52], [0.95, 0.76], [0.9, 0.7]], 0.76, trim);
    add(g, rbox(0.46, 0.18, 0.95, 0.08), DARK(), 0, 0.8, -0.42);   // seat
    const ws = add(g, new THREE.PlaneGeometry(0.6, 0.36), GLASS(), 0, 1.12, 0.48, -0.7); ws.material.side = THREE.DoubleSide;
    rod(g, [0, 0.95, 0.38], [0, 1.16, 0.28], 0.035, DARK()); bars(g, 1.18, 0.28, 0.4, DARK());
    headlight(g, 0.66, 1.1, 0.09); add(g, new THREE.BoxGeometry(0.3, 0.06, 0.04), TAIL(), 0, 0.62, -1.02);
    add(g, rbox(0.6, 0.04, 0.24, 0.02), trim, 0, 0.88, -0.98, 0.2);   // snow flap / tail
    ud.seatY = 0.55; ud.riderZ = -0.36; ud.arm = -1.3;
    ud.tick = (t, speed, ridden) => { step(t, speed); tt.offset.y = -dist * 0.9; flat(ridden, 0.5); };
  } else if (k === "jetski") {
    // a jet ski: it skims just above the ground on its own little puddle of water (sprays when you ride)
    ud.hover = true;
    const low = new THREE.Group(); low.position.y = -0.2; g.add(low);
    profile(low, [[1.35, 0.4], [1.2, 0.62], [0.7, 0.78], [0.3, 0.8], [0.1, 0.62], [-1.0, 0.62], [-1.08, 0.42], [-0.9, 0.2], [0.4, 0.14], [1.0, 0.22]], 0.72, body);
    profile(low, [[1.3, 0.5], [1.38, 0.42], [1.0, 0.24], [0.9, 0.3]], 0.76, trim);
    [-1, 1].forEach((s) => add(low, new THREE.BoxGeometry(0.03, 0.06, 1.6), trim, s * 0.42, 0.42, 0.05));
    add(low, rbox(0.42, 0.18, 0.95, 0.08), DARK(), 0, 0.72, -0.42);   // seat
    rod(low, [0, 0.78, 0.36], [0, 1.08, 0.28], 0.04, DARK()); bars(low, 1.1, 0.28, 0.4, DARK());
    const ws = add(low, new THREE.PlaneGeometry(0.4, 0.2), GLASS(), 0, 0.95, 0.56, -0.9); ws.material.side = THREE.DoubleSide;
    // the water under it: a soft ring that ripples, and spray at the back
    const water = new THREE.MeshStandardMaterial({ color: "#6fd0ff", transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.1, depthWrite: false });
    const pool = add(g, geo("jetPool", () => new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2)), water, 0, -0.26, -0.1); pool.scale.set(0.9, 1, 1.6); pool.castShadow = false;
    const ringM = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.6, depthWrite: false });
    const rings = [0, 1].map(() => { const r = add(g, geo("jetRing", () => new THREE.RingGeometry(0.9, 1, 28).rotateX(-Math.PI / 2)), ringM.clone(), 0, -0.25, -0.1); r.castShadow = false; return r; });
    const spray = new THREE.Group(); spray.position.set(0, -0.15, -1.1); g.add(spray);
    const drops = []; for (let i = 0; i < 8; i++) { const d = add(spray, geo("drop", () => new THREE.SphereGeometry(0.06, 6, 4)), m("#e8f8ff", { transparent: true, opacity: 0.8 }), 0, 0, 0); d.castShadow = false; drops.push(d); }
    ud.seatY = 0.36; ud.riderZ = -0.38; ud.arm = -1.35;
    ud.tick = (t, speed, ridden) => { step(t, speed); const s = Math.min(1, Math.abs(speed) / 10);
      rings.forEach((r, i) => { const p = (t * 0.7 + i * 0.5) % 1; r.scale.set(0.9 + p * 0.5, 1, 1.6 + p * 0.6); r.material.opacity = 0.55 * (1 - p); });
      spray.visible = ridden && s > 0.05;
      drops.forEach((d, i) => { const p = (t * 2.2 + i / drops.length) % 1, a = (i / drops.length) * Math.PI * 2; d.position.set(Math.cos(a) * 0.3 * p, Math.sin(p * Math.PI) * 0.5 * s, -p * 0.8 * s); d.scale.setScalar(1 - p * 0.6); }); };
  } else if (k === "cloud") {
    // a fluffy cloud you sit in
    ud.hover = true;
    const puff = m(def.col, { roughness: 0.9, emissive: def.col, emissiveIntensity: 0.18 }), puff2 = m(def.col2, { roughness: 0.9, emissive: def.col2, emissiveIntensity: 0.15 });
    const puffs = [];
    [[0, 0.42, 0, 0.6], [0.5, 0.48, 0.3, 0.42], [-0.5, 0.48, 0.3, 0.42], [0.55, 0.5, -0.32, 0.44], [-0.55, 0.5, -0.32, 0.44], [0, 0.55, 0.72, 0.4], [0, 0.66, -0.68, 0.48], [0.3, 0.3, 0.6, 0.3], [-0.3, 0.3, 0.6, 0.3], [0.62, 0.3, 0, 0.36], [-0.62, 0.3, 0, 0.36], [0, 0.3, -0.5, 0.36]]
      .forEach(([x, y, z, r], i) => { const p = add(g, geo("puff", () => new THREE.SphereGeometry(1, 20, 14)), i > 6 ? puff2 : puff, x, y, z); p.scale.set(r, r * 0.8, r); p.userData.r = r; p.userData.ph = i * 1.7; puffs.push(p); });
    // a seat dip: a flatter puff, and a little rainbow at the back
    const arc = new THREE.Group(); arc.position.set(0, 0.6, -0.9); g.add(arc);
    RAINBOW.forEach((c, i) => add(arc, new THREE.TorusGeometry(0.42 - i * 0.04, 0.022, 6, 24, Math.PI), glowMat(c, 0.6), 0, 0, 0));
    ud.seatY = 0.6; ud.riderZ = 0; ud.arm = -0.6;
    ud.tick = (t) => { puffs.forEach((p) => { const r = p.userData.r * (1 + Math.sin(t * 1.6 + p.userData.ph) * 0.04); p.scale.set(r, r * 0.8, r); }); };
    ud.pose = (C, t) => { C.armL.rotation.set(-0.5, 0, -0.5 - Math.sin(t * 1.6) * 0.06); C.armR.rotation.set(-0.5, 0, 0.5 + Math.sin(t * 1.6) * 0.06); };
  } else if (k === "carpet") {
    // a magic carpet: a patterned rug that ripples, with tassels
    ud.hover = true;
    const tex = canvasTex("carpet" + def.col + def.col2, 128, 192, (c, w, h) => {
      c.fillStyle = def.col; c.fillRect(0, 0, w, h);
      c.strokeStyle = def.col2; c.lineWidth = 8; c.strokeRect(8, 8, w - 16, h - 16); c.lineWidth = 3; c.strokeRect(20, 20, w - 40, h - 40);
      c.fillStyle = def.col2; c.save(); c.translate(w / 2, h / 2); c.rotate(Math.PI / 4); c.fillRect(-26, -26, 52, 52); c.restore();
      c.fillStyle = def.col; c.save(); c.translate(w / 2, h / 2); c.rotate(Math.PI / 4); c.fillRect(-15, -15, 30, 30); c.restore();
      c.fillStyle = "#ffffff"; c.beginPath(); c.arc(w / 2, h / 2, 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = def.col2; for (let i = 0; i < 4; i++) { const x = i % 2 ? w - 34 : 34, y = i < 2 ? 34 : h - 34; c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 9, y); c.lineTo(x, y + 9); c.lineTo(x - 9, y); c.fill(); }
      c.fillStyle = "rgba(255,255,255,.35)"; for (let y = 50; y < h - 50; y += 14) { c.beginPath(); c.arc(28, y, 2.5, 0, Math.PI * 2); c.arc(w - 28, y, 2.5, 0, Math.PI * 2); c.fill(); }
    });
    const cg = new THREE.PlaneGeometry(1.3, 1.95, 10, 16).rotateX(-Math.PI / 2);
    const base = Float32Array.from(cg.attributes.position.array);
    const rug = add(g, cg, texMat("carpet" + def.col + def.col2, tex, { roughness: 0.8, side: THREE.DoubleSide, emissive: def.col, emissiveIntensity: 0.06 }), 0, 0.2, 0);
    const tassels = [];
    [-1, 1].forEach((s) => { for (let i = 0; i < 6; i++) { const ts = add(g, geo("tassel", () => new THREE.ConeGeometry(0.035, 0.14, 6).rotateX(-Math.PI / 2 * 1)), m(def.col2), -0.55 + i * 0.22, 0.2, s * 1.04); ts.rotation.y = s > 0 ? 0 : Math.PI; tassels.push([ts, -0.55 + i * 0.22, s]); } });
    const wave = (x, z, t, a) => Math.sin(z * 3.2 - t * 4.5) * 0.045 * a + Math.sin(x * 2.4 + t * 2.0) * 0.02 * a;
    ud.seatY = 0.18; ud.riderZ = 0; ud.arm = -0.6;
    ud.tick = (t, speed) => { const a = 1 + Math.min(1, Math.abs(speed) / 10), p = cg.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = base[i * 3], z = base[i * 3 + 2], mid = Math.max(0, 1 - Math.hypot(x / 0.5, z / 0.6)); p.setY(i, wave(x, z, t, a) * (1 - mid * 0.85) + (Math.abs(z) > 0.7 ? (Math.abs(z) - 0.7) * 0.25 : 0)); }
      p.needsUpdate = true; cg.computeVertexNormals();
      tassels.forEach(([ts, x, s]) => { ts.position.y = 0.2 + wave(x, s * 0.975, t, a) + 0.06; ts.rotation.x = Math.sin(t * 5 + x * 3) * 0.3; }); void rug; };
    ud.pose = (C, t) => { C.armL.rotation.set(-0.4, 0, -0.45); C.armR.rotation.set(-0.4, 0, 0.45); C.root.position.y += Math.sin(t * 4.5) * 0.015; };
  } else if (k === "sleigh") {
    // a flying sleigh pulled by two reindeer (any reindeer: no names, no red noses)
    ud.hover = true;
    const gold = m(def.col2, { metalness: 0.5, roughness: 0.3, emissive: def.col2, emissiveIntensity: 0.15 });
    // runners: curled at the front
    [-1, 1].forEach((s) => { add(g, rbox(0.06, 0.06, 1.8, 0.025), gold, s * 0.5, 0.06, -0.05);
      add(g, geo("runnerCurl", () => new THREE.TorusGeometry(0.2, 0.03, 6, 16, Math.PI * 1.3).rotateY(Math.PI / 2)), gold, s * 0.5, 0.26, 0.85, -0.5);
      [-0.6, 0.4].forEach((z) => rod(g, [s * 0.5, 0.06, z], [s * 0.45, 0.4, z], 0.025, gold)); });
    profile(g, [[1.0, 0.75], [0.9, 0.42], [0.6, 0.36], [-0.9, 0.36], [-1.0, 0.5], [-1.0, 1.12], [-0.85, 1.2], [-0.6, 1.08], [-0.35, 0.92], [0.45, 0.9], [0.75, 1.05], [1.0, 1.12], [1.1, 1.0]], 1.0, body);
    profile(g, [[0.45, 0.9], [0.75, 1.05], [1.0, 1.12], [1.1, 1.0], [1.12, 1.05], [1.02, 1.18], [0.75, 1.1], [0.45, 0.96]], 1.04, gold);
    add(g, rbox(0.82, 0.14, 0.6, 0.06), m("#7a1020", { roughness: 0.8 }), 0, 0.68, -0.4);   // seat
    add(g, rbox(0.82, 0.5, 0.12, 0.06), m("#7a1020", { roughness: 0.8 }), 0, 0.92, -0.78, -0.15);
    const gift = (x, z, c, s) => { add(g, rbox(s, s, s, 0.03), m(c), x, 0.45 + s / 2 + 0.6, z); add(g, new THREE.BoxGeometry(s + 0.01, s + 0.01, 0.05), gold, x, 0.45 + s / 2 + 0.6, z); };
    gift(0.32, -0.95, "#2fd36b", 0.24); gift(-0.3, -0.98, "#1fb6ff", 0.2);
    // the reindeer, harnessed in front
    const fur = m("#9a6a3e", { roughness: 0.8 }), light = m("#e8d2b0", { roughness: 0.8 }), antler = m("#d9c09a", { roughness: 0.7 }), black = m("#1d1f26");
    const legs = [];
    [-0.36, 0.36].forEach((x, d) => {
      const r = new THREE.Group(); r.position.set(x, 0.45, 2.05); g.add(r); r.userData.ph = d * 0.9;
      const bdy = add(r, geo("deerBody", () => new THREE.CapsuleGeometry(0.2, 0.5, 6, 12).rotateX(Math.PI / 2)), fur, 0, 0.45, 0); void bdy;
      add(r, geo("deerBelly", () => new THREE.SphereGeometry(0.17, 12, 8)), light, 0, 0.36, 0.05).scale.set(1, 0.7, 2);
      add(r, geo("deerNeck", () => new THREE.CapsuleGeometry(0.1, 0.3, 4, 10)), fur, 0, 0.75, 0.38, 0.5);
      const head = new THREE.Group(); head.position.set(0, 0.98, 0.52); r.add(head);
      add(head, geo("deerHead", () => new THREE.SphereGeometry(0.15, 14, 10)), fur, 0, 0, 0).scale.set(0.9, 0.9, 1.15);
      add(head, geo("deerSnout", () => new THREE.SphereGeometry(0.09, 12, 8)), light, 0, -0.04, 0.15).scale.set(1, 0.85, 1.1);
      add(head, geo("deerNose", () => new THREE.SphereGeometry(0.035, 8, 6)), black, 0, -0.01, 0.25);
      [-1, 1].forEach((s) => { add(head, geo("deerEye", () => new THREE.SphereGeometry(0.025, 8, 6)), black, s * 0.08, 0.04, 0.11);
        add(head, geo("deerEar", () => new THREE.SphereGeometry(0.06, 8, 6)), fur, s * 0.13, 0.08, -0.04).scale.set(1.4, 0.5, 0.8);
        rod(head, [s * 0.06, 0.1, -0.02], [s * 0.15, 0.32, -0.08], 0.018, antler); rod(head, [s * 0.15, 0.32, -0.08], [s * 0.25, 0.42, -0.04], 0.015, antler);
        rod(head, [s * 0.15, 0.32, -0.08], [s * 0.12, 0.44, 0.02], 0.014, antler); rod(head, [s * 0.1, 0.2, -0.05], [s * 0.2, 0.24, 0.05], 0.013, antler); });
      add(r, geo("deerCollar", () => new THREE.TorusGeometry(0.12, 0.03, 6, 16)), m("#c8102e"), 0, 0.7, 0.36, 0.9);
      add(r, geo("deerBell", () => new THREE.SphereGeometry(0.045, 8, 6)), gold, 0, 0.6, 0.45);
      add(r, geo("deerTail", () => new THREE.SphereGeometry(0.06, 8, 6)), light, 0, 0.55, -0.42);
      [[-0.1, 0.24], [0.1, 0.24], [-0.1, -0.24], [0.1, -0.24]].forEach(([lx, lz], i) => { const L = new THREE.Group(); L.position.set(lx, 0.4, lz); r.add(L);
        add(L, geo("deerLeg", () => new THREE.CapsuleGeometry(0.04, 0.32, 4, 8)), fur, 0, -0.2, 0); add(L, geo("deerHoof", () => new THREE.SphereGeometry(0.045, 8, 6)), black, 0, -0.4, 0); legs.push([L, i, r.userData.ph]); });
      // the harness to the sleigh
      rod(g, [x, 0.95, 2.05], [x * 0.9, 0.9, 1.05], 0.015, m("#c8102e")); rod(g, [x, 0.95, 2.05], [x * 1.1, 1.0, 2.3], 0.018, m("#c8102e"));
    });
    ud.seatY = 0.5; ud.riderZ = -0.38; ud.arm = -1.0;
    const deer = g.children.filter((o) => o.isGroup && o.userData.ph !== undefined);
    ud.tick = (t, speed) => { const s = Math.min(1, Math.abs(speed) / 8), w = t * (3 + s * 8);
      legs.forEach(([L, i, ph]) => { L.rotation.x = Math.sin(w + ph + (i < 2 ? 0 : Math.PI) + (i % 2) * 0.4) * (0.15 + 0.6 * s); });
      deer.forEach((r) => { r.position.y = 0.45 + Math.abs(Math.sin(w + r.userData.ph)) * 0.08 * (0.3 + s); }); };
  } else if (k === "ship") {
    // a little flying saucer with an open cockpit, lights going round the rim
    ud.hover = true;
    const hull = m(def.col, { metalness: 0.45, roughness: 0.25, emissive: def.col, emissiveIntensity: 0.1 });
    const disc = add(g, geo("saucer", () => new THREE.SphereGeometry(1, 40, 14)), hull, 0, 0.5, 0); disc.scale.set(1.2, 0.26, 1.3);
    add(g, geo("saucerRing", () => new THREE.TorusGeometry(1.18, 0.07, 8, 48).rotateX(Math.PI / 2)), m(def.col2, { metalness: 0.4, roughness: 0.3 }), 0, 0.5, 0).scale.z = 1.08;
    add(g, geo("saucerBelly", () => new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), m("#3a3f4a", { metalness: 0.5, roughness: 0.3 }), 0, 0.42, 0).scale.y = 0.5;
    const beam = add(g, new THREE.CylinderGeometry(0.3, 0.42, 0.06, 20), glowMat(def.glow || def.col2, 1.8), 0, 0.17, 0); void beam;
    // the cockpit: a tub with a glass screen in front
    add(g, rbox(0.86, 0.4, 0.96, 0.18), m(shade(def.col, 0.6), { metalness: 0.3, roughness: 0.4 }), 0, 0.68, -0.05);
    add(g, rbox(0.7, 0.12, 0.6, 0.05), m("#ffffff", { roughness: 0.6 }), 0, 0.82, -0.12);
    const ws = add(g, geo("shipWS", () => new THREE.SphereGeometry(0.5, 20, 8, -1.0, 2.0, Math.PI * 0.2, Math.PI * 0.3)), GLASS(), 0, 0.82, 0.08); ws.scale.set(1.0, 1.2, 1.1); ws.material.side = THREE.DoubleSide;
    add(g, rbox(0.5, 0.12, 0.22, 0.04), DARK(), 0, 0.92, 0.42);
    [-0.12, 0, 0.12].forEach((x, i) => add(g, new THREE.SphereGeometry(0.03, 8, 6), glowMat(["#ff4f4f", "#2fd36b", "#ffd23a"][i], 1.6), x, 0.99, 0.44));
    // fins and a little antenna
    [-1, 1].forEach((s) => { add(g, rbox(0.06, 0.36, 0.42, 0.03), m(def.col2, { metalness: 0.4, roughness: 0.3 }), s * 0.62, 0.8, -0.85, 0, 0, s * 0.35); add(g, new THREE.CylinderGeometry(0.1, 0.13, 0.16, 14).rotateX(Math.PI / 2), m("#3a3f4a"), s * 0.32, 0.5, -1.3); add(g, new THREE.CircleGeometry(0.09, 14), glowMat(def.glow || def.col2, 2), s * 0.32, 0.5, -1.385, 0, Math.PI); });
    rod(g, [0.3, 0.84, -0.5], [0.4, 1.4, -0.6], 0.012, CHROME()); add(g, new THREE.SphereGeometry(0.05, 10, 8), glowMat("#ff4f4f", 1.6), 0.4, 1.42, -0.6);
    const ring = new THREE.Group(); ring.position.y = 0.5; g.add(ring);
    const lights = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; lights.push(add(ring, geo("shipLight", () => new THREE.SphereGeometry(0.06, 8, 6)), glowMat(RAINBOW[i % 6], 1.6), Math.cos(a) * 1.24, 0.02, Math.sin(a) * 1.34)); }
    ud.seatY = 0.58; ud.riderZ = -0.1; ud.arm = -1.2;
    ud.tick = (t) => { ring.rotation.y = t * 1.2; };
  } else if (k === "airtrain") {
    // a little toy train that flies: the rider drives the engine, one carriage behind, glowing pads underneath
    ud.hover = true;
    const red = body, gold = m(def.col2, { metalness: 0.45, roughness: 0.3, emissive: def.col2, emissiveIntensity: 0.12 }), black = m("#2a2d36", { metalness: 0.3, roughness: 0.5 });
    // engine (front half)
    add(g, rbox(0.86, 0.16, 1.7, 0.06), black, 0, 0.36, 0.55);   // chassis
    add(g, geo("boiler", () => new THREE.CylinderGeometry(0.34, 0.34, 0.9, 24).rotateX(Math.PI / 2)), red, 0, 0.76, 0.95);
    add(g, geo("boilerFront", () => new THREE.CylinderGeometry(0.36, 0.36, 0.08, 24).rotateX(Math.PI / 2)), black, 0, 0.76, 1.42);
    headlight(g, 0.82, 1.48, 0.1);
    [0.75, 1.15].forEach((z) => add(g, geo("boilerBand", () => new THREE.TorusGeometry(0.345, 0.025, 6, 24)), gold, 0, 0.76, z));
    add(g, new THREE.CylinderGeometry(0.14, 0.09, 0.36, 16), black, 0, 1.22, 1.2); add(g, new THREE.CylinderGeometry(0.17, 0.17, 0.07, 16), gold, 0, 1.4, 1.2);   // chimney
    add(g, new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold, 0, 1.09, 0.85);   // the dome
    // the cab: low open walls so the driver shows
    add(g, rbox(0.9, 0.5, 0.7, 0.08), red, 0, 0.7, 0.12);
    add(g, rbox(0.7, 0.5, 0.56, 0.06), m(shade(def.col, 0.55), { roughness: 0.8 }), 0, 0.82, 0.1);   // the inside (darker)
    add(g, rbox(0.62, 0.12, 0.4, 0.05), m("#3a2a20", { roughness: 0.8 }), 0, 0.68, 0.04);   // seat
    [-1, 1].forEach((s) => rod(g, [s * 0.42, 0.95, 0.44], [s * 0.42, 1.9, 0.44], 0.03, gold));
    add(g, rbox(1.0, 0.08, 0.55, 0.04), gold, 0, 1.93, 0.34);   // little sun roof up front, high above the head
    // the carriage
    const car = new THREE.Group(); car.position.set(0, 0, -1.25); g.add(car);
    add(car, rbox(0.86, 0.16, 1.3, 0.06), black, 0, 0.36, 0);
    add(car, rbox(0.9, 0.62, 1.2, 0.12), m(def.col2 === "#ffffff" ? "#ffd23a" : "#ffffff", { roughness: 0.4 }), 0, 0.76, 0);
    add(car, rbox(0.96, 0.1, 1.28, 0.05), red, 0, 1.1, 0);
    [-1, 1].forEach((s) => [-0.3, 0.3].forEach((z) => add(car, rbox(0.02, 0.24, 0.3, 0.01), GLASS(), s * 0.455, 0.84, z)));
    rod(g, [0, 0.36, -0.3], [0, 0.36, -0.6], 0.04, black);
    // glowing pads under it and the (decorative) wheels
    const pad = glowMat(def.glow || "#7fd6ff", 1.6);
    [[0.95, g], [0.15, g], [-0.4, car], [0.4, car]].forEach(([z, p]) => add(p, new THREE.CylinderGeometry(0.22, 0.26, 0.05, 18), pad, 0, 0.26, z));
    const whs = [];
    [[1.05, g], [0.6, g], [0.12, g], [-0.4, car], [0.4, car]].forEach(([z, p]) => [-1, 1].forEach((s) => { const w = new THREE.Group(); w.position.set(s * 0.44, 0.32, z); p.add(w); whs.push(w);
      add(w, geo("trainWheel", () => new THREE.CylinderGeometry(0.15, 0.15, 0.06, 16).rotateZ(Math.PI / 2)), red); add(w, geo("trainHub", () => new THREE.BoxGeometry(0.07, 0.26, 0.04)), gold); }));
    const puffs = []; for (let i = 0; i < 4; i++) { const p = add(g, geo("steam", () => new THREE.SphereGeometry(0.12, 10, 8)), new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.8, roughness: 1, depthWrite: false }), 0, 1.5, 1.2); p.castShadow = false; puffs.push(p); }
    ud.seatY = 0.48; ud.riderZ = 0.06; ud.arm = -1.0;
    ud.tick = (t, speed) => { step(t, speed); whs.forEach((w) => { w.rotation.x = -dist * 4; });
      puffs.forEach((p, i) => { const q = (t * 0.6 + i / 4) % 1; p.position.set(Math.sin(i * 2.1) * 0.08, 1.5 + q * 0.7, 1.2 - q * 0.6 * (0.3 + Math.min(1, Math.abs(speed) / 10))); p.scale.setScalar(0.5 + q * 1.1); p.material.opacity = 0.75 * (1 - q); }); };
  }
}
