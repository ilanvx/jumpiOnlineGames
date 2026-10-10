/*
  3D motorcycles and scooters (public/shared/vehicles.js says which ones exist).
  buildBike(def) → a THREE.Group, front = +z, standing on y = 0, with userData:
    wf / wb   the wheel groups (spin them on x), or null for the hover bike; k = the bike's scale
    seatY     where the rider's feet-root goes (the character is drawn from its feet)
    riderZ    how far back the rider sits
    arm       how far forward the rider reaches (arm angle)
    hover     true = floats (bob it)
    glow      a ground light under it (or null)
  Materials are shared between bikes of the same colours, so many bikes cost little.
*/
import * as THREE from "three";

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
  }
  // a coloured light on the ground under it
  if (def.glow) { const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.2), new THREE.MeshBasicMaterial({ map: glowTex(), color: def.glow, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
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
