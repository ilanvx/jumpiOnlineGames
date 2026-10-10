/*
  /team page in 3D: the first Community Team standing on a stage.
    Guide (green, cap + waving flag) · Community Manager (orange, megaphone that sends out sound rings) · Beta Tester
    (violet, goggles + magnifying glass chasing a little bug).
  One scene, two views: the hero (#heroCanvas, the whole crew, name tags, a spotlight on the chosen role) and the close-up in
  the roles section (#roleCanvas, only the chosen Jumpi). Talks to team.js with events: tm:role (page → 3D), tm:pick (3D → page),
  tm:sent (the form was sent: everyone jumps and confetti flies).
*/
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const reduce = (window.JUMPI_REDUCE_MOTION || matchMedia("(prefers-reduced-motion: reduce)").matches);
const TAU = Math.PI * 2;
const ease = (k) => 1 - Math.pow(1 - k, 3);
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const lerp = (a, b, k) => a + (b - a) * k;
const DPR = Math.min(devicePixelRatio || 1, matchMedia("(max-width:760px)").matches ? 1.5 : 2);

const scene = new THREE.Scene(), clock = new THREE.Clock();
scene.add(new THREE.HemisphereLight(0xffffff, 0x9fc4e8, 1.55));
const sun = new THREE.DirectionalLight(0xffffff, 2.3);
sun.position.set(3, 8, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 5; sun.shadow.bias = -0.0006;
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 22 });
scene.add(sun);
const rim = new THREE.DirectionalLight(0xbfe8ff, 0.9); rim.position.set(-5, 4, -6); scene.add(rim);

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });
function mesh(geo, m, pos, parent, rot) {
  const x = new THREE.Mesh(geo, m); if (pos) x.position.set(...pos); if (rot) x.rotation.set(...rot);
  x.castShadow = true; parent.add(x); return x;
}
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const star = (x, cx, cy, R, r) => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); };


/* ---------- the game's Moderator outfit (index.html: modShirtTex, buildOutfit shells, hat "cap"), in any colour ---------- */
// a slice of an ellipsoid, the same shell the game uses for clothes
function shell({ center, radii, scale = 1, t0 = 0, t1 = Math.PI, pear = 0, mat: m, seg = [64, 32], rotZ = 0 }) {
  const g = new THREE.SphereGeometry(1, seg[0], seg[1], 0, TAU, t0, t1 - t0), a = g.attributes.position, v = new THREE.Vector3(), e = new THREE.Euler(0, 0, rotZ);
  for (let i = 0; i < a.count; i++) {
    v.fromBufferAttribute(a, i); const k = 1 - pear * Math.max(v.y, 0);
    v.set(v.x * k * radii[0] * scale, v.y * k * radii[1] * scale, v.z * k * radii[2] * scale).applyEuler(e);
    a.setXYZ(i, v.x + center[0], v.y + center[1], v.z + center[2]);
  }
  g.computeVertexNormals();
  const ms = new THREE.Mesh(g, m); ms.castShadow = true; return ms;
}
const cloth = (tex) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, side: THREE.DoubleSide });
const MOD_COL = {
  blue: { fill: "#1f5fe0", dark: "#123a99", badge: "#2f7bff", pants: "#173f9e", waist: "#0d2766" },
  red: { fill: "#e0262f", dark: "#8f1218", badge: "#ff4a52", pants: "#a3161d", waist: "#6b0d12" },
};
function modShirtTex(C) {
  return canvasTex(1024, 256, (x, w, h) => {
    x.fillStyle = C.fill; x.fillRect(0, 0, w, h);
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "rgba(255,255,255,.12)"); g.addColorStop(1, "rgba(0,0,0,.12)"); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const cx = w * 0.25;
    x.fillStyle = "#ffffff"; x.beginPath(); x.moveTo(cx - 90, 0); x.lineTo(cx - 8, 62); x.lineTo(cx - 8, 0); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(cx + 90, 0); x.lineTo(cx + 8, 62); x.lineTo(cx + 8, 0); x.closePath(); x.fill();
    x.fillStyle = C.dark; x.fillRect(cx - 6, 40, 12, 70); x.fillStyle = "#ffffff"; [62, 92].forEach((y) => { x.beginPath(); x.arc(cx, y, 5, 0, 7); x.fill(); });
    const sx = cx + 100, sy = 100, sh = (k, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(sx, sy - 38 * k); x.lineTo(sx + 32 * k, sy - 26 * k); x.lineTo(sx + 30 * k, sy + 6 * k); x.quadraticCurveTo(sx + 24 * k, sy + 30 * k, sx, sy + 42 * k); x.quadraticCurveTo(sx - 24 * k, sy + 30 * k, sx - 30 * k, sy + 6 * k); x.lineTo(sx - 32 * k, sy - 26 * k); x.closePath(); x.fill(); };
    sh(1.08, C.dark); sh(1, "#ffffff"); sh(0.78, C.badge); x.fillStyle = "#ffffff"; star(x, sx, sy + 2, 15, 6.5); x.fill();
    x.fillStyle = "#ffffff"; [w * 0.5, 4, w - 4].forEach((u) => x.fillRect(u - 4, 0, 8, h));
    x.font = '120px "Lilita One", sans-serif'; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 12; x.strokeStyle = C.dark; x.strokeText("MOD", w * 0.75, h * 0.52); x.fillStyle = "#ffffff"; x.fillText("MOD", w * 0.75, h * 0.52);
    x.fillStyle = C.dark; x.fillRect(0, h - 26, w, 26);
  });
}
const modSleeveTex = (C) => canvasTex(256, 128, (x, w, h) => { x.fillStyle = C.fill; x.fillRect(0, 0, w, h); x.fillStyle = C.dark; x.fillRect(0, h - 18, w, 18); });
const modPantsTex = (C) => canvasTex(512, 256, (x, w, h) => { x.fillStyle = C.pants; x.fillRect(0, 0, w, h); x.fillStyle = "#ffffff"; [w * 0.02, w * 0.48, w * 0.52, w * 0.98].forEach((u) => x.fillRect(u - 4, 0, 8, h)); x.fillStyle = C.waist; x.fillRect(0, 0, w, 30); });
function dressMod(J, colour) {
  const C = MOD_COL[colour];
  J.body.add(shell({ center: [0, 0.52, 0], radii: [0.38, 0.46, 0.33], scale: 1.045, pear: 0.12, t0: 0.36, t1: 1.85, mat: cloth(modShirtTex(C)), seg: [72, 24] }));
  [[J.armL, -1], [J.armR, 1]].forEach(([arm, s]) => arm.add(shell({ center: [s * 0.03, -0.2, 0], radii: [0.1, 0.24, 0.11], scale: 1.16, t0: 0, t1: 1.25, rotZ: s * 0.18, mat: cloth(modSleeveTex(C)), seg: [32, 12] })));
  const pm = cloth(modPantsTex(C));
  J.body.add(shell({ center: [0, 0.52, 0], radii: [0.38, 0.46, 0.33], scale: 1.05, pear: 0.12, t0: 1.8, t1: Math.PI, mat: pm, seg: [72, 16] }));
  [-1, 1].forEach((s) => J.body.add(shell({ center: [s * 0.16, 0.12, 0.03], radii: [0.15, 0.14, 0.17], scale: 1.08, t0: 0, t1: 1.62, mat: pm, seg: [32, 14] })));
  // the Moderator cap: colour dome, darker peak, white button and white band
  const cap = new THREE.Group(); J.head.add(cap);
  const c1 = mat(C.fill, { roughness: 0.6 }), peak = mat(new THREE.Color(C.fill).lerp(new THREE.Color("#000"), 0.4), { roughness: 0.6 }), white = mat("#ffffff", { roughness: 0.55 });
  const dome = mesh(new THREE.SphereGeometry(0.55, 40, 18, 0, TAU, 0, Math.PI / 2), c1, [0, 0.68, -0.02], cap); dome.scale.set(1.2, 0.7, 1.14);
  const band = mesh(new THREE.TorusGeometry(0.6, 0.03, 8, 48), white, [0, 0.69, -0.02], cap, [Math.PI / 2, 0, 0]); band.scale.set(1.1, 1.04, 1);
  const brim = mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 32, 1, false, -Math.PI / 2 - 0.95, 1.9), peak, [0, 0.72, 0.2], cap, [0.2, 0, 0]); brim.scale.set(1.12, 1, 1.2);
  mesh(new THREE.SphereGeometry(0.06, 14, 10), white, [0, 1.07, -0.02], cap);
}

/* ---------- the stage ---------- */
const stage = new THREE.Group(); scene.add(stage);
const R = 2.75;
mesh(new THREE.CylinderGeometry(R, R - 0.08, 0.34, 72), mat("#ff9a1f", { roughness: 0.55 }), [0, -0.19, 0], stage).receiveShadow = true;
mesh(new THREE.CylinderGeometry(R - 0.12, R - 0.12, 0.05, 72), mat("#fff6e6", { roughness: 0.8 }), [0, 0.0, 0], stage).receiveShadow = true;
const ringTex = canvasTex(512, 512, (x, w) => {
  x.fillStyle = "#fff6e6"; x.fillRect(0, 0, w, w);
  x.strokeStyle = "#ffe2b5"; x.lineWidth = 14;
  for (const r of [70, 150, 230]) { x.beginPath(); x.arc(256, 256, r, 0, TAU); x.stroke(); }
});
const top = mesh(new THREE.CircleGeometry(R - 0.14, 72), new THREE.MeshStandardMaterial({ map: ringTex, roughness: 0.85 }), [0, 0.03, 0], stage, [-Math.PI / 2, 0, 0]);
top.receiveShadow = true; top.castShadow = false;
// chasing bulbs around the edge
const BULB_COL = ["#ffd23a", "#ff5fb4", "#4fd1ff", "#7dffaa"];
const bulbs = [];
for (let i = 0; i < 36; i++) {
  const a = (i / 36) * TAU;
  const m = new THREE.MeshStandardMaterial({ color: BULB_COL[i % 4], emissive: BULB_COL[i % 4], emissiveIntensity: 0.4, roughness: 0.3 });
  const b = mesh(new THREE.SphereGeometry(0.07, 14, 10), m, [Math.cos(a) * (R + 0.01), -0.17, Math.sin(a) * (R + 0.01)], stage);
  b.castShadow = false; bulbs.push(b);
}

/* ---------- spotlight on the chosen role ---------- */
const beamTex = canvasTex(64, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.6, "rgba(255,250,220,.16)"); g.addColorStop(1, "rgba(255,248,200,.42)");
  x.fillStyle = g; x.fillRect(0, 0, w, h);
});
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.05, 5.2, 40, 1, true),
  new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
beam.position.y = 2.6; scene.add(beam);
const glowTex = canvasTex(256, 256, (x, w) => { const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, "rgba(255,240,170,.85)"); g.addColorStop(1, "rgba(255,240,170,0)"); x.fillStyle = g; x.fillRect(0, 0, w, w); });
const glow = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false }));
glow.rotation.x = -Math.PI / 2; glow.position.y = 0.045; scene.add(glow);

/* ---------- confetti ---------- */
const CONF = 90;
const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.09, 0.14), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6 }), CONF);
const confD = [];
const CONF_COL = ["#ffd23a", "#ff5fb4", "#4fd1ff", "#7dffaa", "#ff9a1f", "#a77bff"].map((c) => new THREE.Color(c));
for (let i = 0; i < CONF; i++) {
  confD.push({ p: new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 6, (Math.random() - 0.5) * 4 - 0.5), v: new THREE.Vector3(0, -(0.25 + Math.random() * 0.3), 0), r: new THREE.Euler(Math.random() * TAU, Math.random() * TAU, 0), s: 0.5 + Math.random() * 3 });
  conf.setColorAt(i, CONF_COL[i % CONF_COL.length]);
}
scene.add(conf);
const dummy = new THREE.Object3D();
function confettiBurst() {
  confD.forEach((d) => { d.p.set((Math.random() - 0.5) * 1.5, 1.2 + Math.random(), (Math.random() - 0.5) * 1.2); d.v.set((Math.random() - 0.5) * 7, 4 + Math.random() * 4, (Math.random() - 0.3) * 4); });
}

/* ---------- the crew ---------- */
const ROLES = [
  { id: "guide", skin: "#2fd36b", eye: "#6b3a1a", x: -1.75, z: 0.05, face: 0.28, badge: ["GUIDE", "משגיח", "#1f5fe0"], mod: "blue" },
  { id: "manager", skin: "#ff8a1c", eye: "#2a7fff", x: 0, z: 0.3, face: 0, badge: ["MANAGER", "מנהל", "#e0262f"], mod: "red" },
  { id: "beta", skin: "#9b5cff", eye: "#1a8a5a", x: 1.75, z: 0.05, face: -0.28, badge: ["TESTER", "בודק", "#8a4dff"] },
];
const crew = {};
let chosen = "manager", chosenX = 0, chosenZ = 0.3, hover = null;
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
const v3 = new THREE.Vector3(), v3b = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

let lang = document.documentElement.lang === "he" ? "he" : "en";
function badgeTex([en, he, color]) {
  const word = lang === "he" ? he : en;
  return canvasTex(256, 128, (x) => {
    x.fillStyle = "#ffffff"; x.beginPath(); x.roundRect(4, 4, 248, 120, 26); x.fill();
    x.fillStyle = color; x.beginPath(); x.roundRect(4, 4, 248, 42, [26, 26, 0, 0]); x.fill();
    x.fillStyle = "#fff"; x.textAlign = "center";
    x.font = lang === "he" ? "25px 'Secular One', Rubik, sans-serif" : "600 25px Fredoka, sans-serif"; x.fillText(lang === "he" ? "צוות ג'אמפי" : "JUMPI TEAM", 128, 35);
    x.fillStyle = "#1d2b4f"; x.font = lang === "he" ? `${word.length > 5 ? 40 : 48}px 'Secular One', Rubik, sans-serif` : `${word.length > 6 ? 40 : 50}px 'Lilita One', sans-serif`; x.fillText(word, 128, 103);
  });
}
function repaintBadges() { Object.values(crew).forEach((J) => { J.badge.material.map.dispose(); J.badge.material.map = badgeTex(J.badgeWord); J.badge.material.needsUpdate = true; }); }
addEventListener("tm:lang", (e) => { lang = e.detail === "he" ? "he" : "en"; if (Object.keys(crew).length) repaintBadges(); });

function makeJumpi(base, L) {
  const root = base.clone(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.material = [].concat(o.material).map((m) => {
      if (m.name === "Skin") { m = m.clone(); m.color.set(L.skin); }
      else if (m.name === "Iris") { m = m.clone(); m.color.set(L.eye); }
      else if (m.name === "Mouth") { m = m.clone(); const c = new THREE.Color(L.skin), h = {}; c.getHSL(h); m.color.setHSL(h.h, Math.min(1, h.s * 0.9), h.l * 0.22); }
      return m;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  const J = { id: L.id, L, root, body: root.getObjectByName("Body"), head: root.getObjectByName("Head"), armL: root.getObjectByName("ArmL"), armR: root.getObjectByName("ArmR"),
    eyeL: root.getObjectByName("EyeL"), eyeR: root.getObjectByName("EyeR"), hopT: -9, blinkT: 1 + Math.random() * 3, ph: Math.random() * 6, z: L.z, props: [] };
  J.headY = J.head.position.y;
  root.position.set(L.x, 0, L.z);
  root.rotation.y = L.face;
  scene.add(root);
  J.hand = new THREE.Object3D(); J.hand.position.set(0.03, -0.42, 0.03); J.armR.add(J.hand);
  J.handL = new THREE.Object3D(); J.handL.position.set(-0.03, -0.42, 0.03); J.armL.add(J.handL);

  if (L.mod) dressMod(J, L.mod);
  // the name badge on the tummy (found with a ray so it sits on the shirt / body)
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3(); J.body.traverse((o) => { if (o.isMesh) bb.expandByObject(o); });
  const bc = bb.getCenter(new THREE.Vector3());
  const front = new THREE.Vector3(bc.x, bc.y + (bb.max.y - bc.y) * 0.05, 0);
  const local = root.worldToLocal(front.clone());
  const ray = new THREE.Raycaster(root.localToWorld(new THREE.Vector3(local.x, local.y, 5)), new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion).negate());
  const hit = ray.intersectObject(J.body, true)[0];
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshStandardMaterial({ map: badgeTex(L.badge), roughness: 0.5, transparent: true }));
  J.body.add(badge);
  badge.position.copy(J.body.worldToLocal(hit ? hit.point.clone().add(new THREE.Vector3(0, 0, 0.012).applyQuaternion(root.quaternion)) : front));
  badge.rotation.x = -0.1;
  J.badge = badge; J.badgeWord = L.badge;
  return J;
}

/* props: they live on the character (not the arm) and follow the hand every frame, so they stay upright */
function addMegaphone(J) {
  const g = new THREE.Group();
  const white = mat("#ffffff", { roughness: 0.35 }), orange = mat("#ff9a1f", { roughness: 0.4 }), navy = mat("#1d2b4f", { roughness: 0.4 });
  const horn = new THREE.Group(); g.add(horn);
  mesh(new THREE.CylinderGeometry(0.2, 0.07, 0.42, 28, 1, true), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35, side: THREE.DoubleSide }), [0, 0.21, 0], horn);
  mesh(new THREE.TorusGeometry(0.2, 0.028, 10, 28), orange, [0, 0.42, 0], horn, [Math.PI / 2, 0, 0]);
  mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 20), orange, [0, -0.03, 0], horn);
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 16), navy, [0, -0.11, 0], horn);
  mesh(new THREE.BoxGeometry(0.06, 0.16, 0.07), navy, [0, 0.03, -0.1], horn, [0.3, 0, 0]);   // the handle
  J.root.add(g); J.mega = g; J.horn = horn;
  J.props.push(g);
  // sound rings
  J.rings = [0, 1, 2].map(() => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 32), new THREE.MeshBasicMaterial({ color: "#ffd23a", transparent: true, opacity: 0, depthWrite: false }));
    J.root.add(r); J.props.push(r); return r;
  });
}
function addFlag(J) {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.03, 0.034, 2.45, 12), mat("#f2f6ff", { roughness: 0.4 }), [0, 1.225, 0], g);
  mesh(new THREE.SphereGeometry(0.07, 16, 12), mat("#ffd23a", { roughness: 0.25, metalness: 0.3 }), [0, 2.47, 0], g);
  mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 20), mat("#123a99"), [0, 0.025, 0], g);
  const tex = canvasTex(256, 168, (x, w, h) => {
    x.fillStyle = "#1f5fe0"; x.fillRect(0, 0, w, h);
    x.fillStyle = "#123a99"; x.fillRect(0, h - 22, w, 22);
    x.fillStyle = "#ffffff"; star(x, 120, 76, 52, 22); x.fill();
  });
  const geo = new THREE.PlaneGeometry(0.62, 0.4, 16, 4); geo.translate(0.31, 0, 0);
  const flag = mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.7 }), [0.025, 2.18, 0], g);
  J.flagPos = geo.attributes.position.array.slice();
  J.flag = flag;
  J.root.add(g); J.pole = g; J.props.push(g);
}
function addTesterKit(J) {
  // goggles pushed up on the forehead
  const gog = new THREE.Group(); J.head.add(gog);
  const band = mat("#3a1192", { roughness: 0.6 }), frame = mat("#ffd23a", { roughness: 0.3, metalness: 0.2 });
  const lens = new THREE.MeshStandardMaterial({ color: "#7fe8ff", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.75, emissive: "#2ab8ff", emissiveIntensity: 0.25 });
  const strap = mesh(new THREE.TorusGeometry(0.6, 0.045, 10, 48), band, [0, 0.74, -0.02], gog, [Math.PI / 2 + 0.12, 0, 0]); strap.scale.set(1.06, 0.96, 1);
  [-1, 1].forEach((s) => {
    const eye = new THREE.Group(); eye.position.set(s * 0.21, 0.78, 0.5); eye.rotation.set(-0.5, s * 0.32, 0); gog.add(eye);
    mesh(new THREE.TorusGeometry(0.15, 0.045, 12, 28), frame, [0, 0, 0], eye);
    mesh(new THREE.CircleGeometry(0.14, 28), lens, [0, 0, 0.01], eye);
  });
  // magnifying glass
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.32, 12), mat("#5a22d6", { roughness: 0.5 }), [0, 0.04, 0], g);
  const loop = new THREE.Group(); loop.position.set(0, 0.36, 0); loop.rotation.x = -0.85; g.add(loop);
  mesh(new THREE.TorusGeometry(0.17, 0.035, 12, 32), frame, [0, 0, 0], loop);
  mesh(new THREE.CircleGeometry(0.16, 32), new THREE.MeshStandardMaterial({ color: "#d8f6ff", transparent: true, opacity: 0.45, roughness: 0.05, side: THREE.DoubleSide }), [0, 0, 0], loop);
  J.root.add(g); J.glass = g; J.props.push(g);
  // the bug it's chasing
  const bug = new THREE.Group();
  const bugG = mat("#7ee04a", { roughness: 0.4 }), dark = mat("#1d2b4f", { roughness: 0.3 });
  const bd = mesh(new THREE.SphereGeometry(0.075, 16, 12), bugG, [0, 0, 0], bug); bd.scale.set(1, 0.9, 1.25);
  mesh(new THREE.SphereGeometry(0.05, 14, 10), bugG, [0, 0.03, 0.09], bug);
  [-1, 1].forEach((s) => {
    mesh(new THREE.SphereGeometry(0.022, 10, 8), mat("#ffffff", { roughness: 0.2 }), [s * 0.022, 0.06, 0.125], bug);
    mesh(new THREE.SphereGeometry(0.011, 8, 6), dark, [s * 0.024, 0.062, 0.143], bug);
    const ant = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 6), dark, [s * 0.025, 0.11, 0.1], bug, [0.5, 0, s * -0.35]);
    mesh(new THREE.SphereGeometry(0.014, 8, 6), mat("#ff5fb4"), [0, 0.04, 0], ant);
  });
  const wingM = new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.6, side: THREE.DoubleSide, roughness: 0.2 });
  J.wings = [-1, 1].map((s) => { const w = new THREE.Group(); w.position.set(s * 0.03, 0.06, -0.01); bug.add(w); mesh(new THREE.CircleGeometry(0.07, 16), wingM, [s * 0.06, 0, 0], w, [Math.PI / 2, 0, 0]).scale.set(1, 0.6, 1); return w; });
  scene.add(bug); J.bug = bug;
}

/* ---------- views ---------- */
function makeView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const V = { canvas, renderer, cam: new THREE.PerspectiveCamera(30, 1, 0.1, 80), visible: false, w: 0, h: 0 };
  new ResizeObserver(() => { V.w = canvas.clientWidth; V.h = canvas.clientHeight; if (V.w && V.h) { renderer.setSize(V.w, V.h, false); V.cam.aspect = V.w / V.h; V.cam.updateProjectionMatrix(); } }).observe(canvas);
  new IntersectionObserver(([e]) => (V.visible = e.isIntersecting)).observe(canvas);
  return V;
}
const hero = makeView(document.getElementById("heroCanvas"));
const close = makeView(document.getElementById("roleCanvas"));
const tagsBox = document.getElementById("heroTags");
const tags = {}; document.querySelectorAll(".tag3d").forEach((t) => (tags[t.dataset.role] = t));
const closeCam = { x: 0, z: 0.3 };

/* ---------- talking to the page ---------- */
function choose(id, hop) {
  chosen = id;
  const J = crew[id];
  if (J && hop) J.hopT = clock.getElapsedTime();
}
addEventListener("tm:role", (e) => choose(e.detail, true));
addEventListener("tm:sent", () => { const t = clock.getElapsedTime(); Object.values(crew).forEach((J, i) => (J.hopT = t + i * 0.12)); confettiBurst(); });
const rc = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickAt(e) {
  const r = hero.canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  rc.setFromCamera(ndc, hero.cam);
  let best = null, bd = Infinity;
  for (const J of Object.values(crew)) { const h = rc.intersectObject(J.root, true)[0]; if (h && h.distance < bd) { bd = h.distance; best = J.id; } }
  return best;
}
hero.canvas.addEventListener("pointermove", (e) => {
  const r = hero.canvas.getBoundingClientRect();
  mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1; mouse.ty = -((e.clientY - r.top) / r.height) * 2 + 1;
  if (e.pointerType === "mouse") { hover = pickAt(e); hero.canvas.style.cursor = hover ? "pointer" : ""; }
});
hero.canvas.addEventListener("pointerleave", () => { mouse.tx = mouse.ty = 0; hover = null; });
hero.canvas.addEventListener("click", (e) => {
  const id = pickAt(e);
  if (!id) return;
  choose(id, true);
  dispatchEvent(new CustomEvent("tm:pick", { detail: id }));
});
close.canvas.addEventListener("click", () => { const J = crew[chosen]; if (J) J.hopT = clock.getElapsedTime(); });

/* ---------- load the Jumpi ---------- */
new GLTFLoader().load("/blobby.glb", (g) => {
  const base = g.scene;
  for (const L of ROLES) crew[L.id] = makeJumpi(base, L);
  addMegaphone(crew.manager);
  addFlag(crew.guide);
  addTesterKit(crew.beta);
  if (document.fonts) document.fonts.ready.then(() => repaintBadges());
  Object.values(tags).forEach((t) => t.classList.add("show"));
});

/* ---------- every frame ---------- */
function poseCrew(t, dt) {
  const ids = Object.keys(crew);
  for (const id of ids) {
    const J = crew[id], L = J.L, isChosen = id === chosen;
    const br = Math.sin(t * 2.1 + J.ph);
    J.body.scale.set(1 + br * 0.012, 1 + br * 0.018, 1 + br * 0.012);
    J.head.position.y = J.headY + br * 0.012;
    // step forward when chosen
    J.z = lerp(J.z, L.z + (isChosen ? 0.45 : 0), 1 - Math.exp(-dt * 6));
    // hop
    const k = (t - J.hopT) / 0.7;
    const hopY = k >= 0 && k < 1 ? Math.sin(Math.PI * k) * 0.5 : 0;
    J.root.position.set(L.x, hopY, J.z);
    J.root.rotation.y = L.face + (k >= 0 && k < 1 ? ease(k) * TAU : 0) + (reduce ? 0 : Math.sin(t * 0.6 + J.ph) * 0.08) + (hover === id ? Math.sin(t * 8) * 0.05 : 0);
    // look at the mouse (the tester watches its bug instead)
    J.head.rotation.y = lerp(J.head.rotation.y, mouse.x * 0.45 - L.face * 0.5, 0.1);
    J.head.rotation.x = lerp(J.head.rotation.x, -mouse.y * 0.18, 0.1);
    J.head.rotation.z = 0;
    // blink
    if (t > J.blinkT) { const b = (t - J.blinkT) / 0.16, s = b < 1 ? Math.abs(1 - 2 * b) : 1; J.eyeL.scale.y = J.eyeR.scale.y = Math.max(0.1, s); if (b >= 1) J.blinkT = t + 2 + Math.random() * 3; }
    J.armL.rotation.set(0, 0, -br * 0.04);
  }
  const M = crew.manager, G = crew.guide, B = crew.beta;
  if (M) {
    // every few seconds: lift the megaphone and announce (sound rings)
    if (M.annAt === undefined) { M.annAt = 1.2; M.annNext = 1.2; }
    if (!reduce && t > M.annNext) { M.annAt = t; M.annNext = t + 4.8 + Math.random() * 2; }
    const a = t - M.annAt;
    const lift = a >= 0 && a < 1.6 ? Math.sin(Math.min(1, a / 0.25) * Math.PI / 2) * (1 - ease(clamp01((a - 1.25) / 0.35))) : 0;
    M.armR.rotation.set(-0.35 - lift * 0.2, 0, 0.7 + lift * 0.75);
    M.armL.rotation.set(0, 0, -0.08 - lift * 0.5 + Math.sin(t * 2) * 0.04);
    M.root.updateMatrixWorld(true);
    M.mega.position.copy(M.root.worldToLocal(M.hand.getWorldPosition(v3)));
    M.horn.quaternion.setFromUnitVectors(UP, v3b.set(0.62, 0.3 + lift * 0.45, 0.72).normalize());
    // rings fly out of the bell
    const tip = v3b.set(0, 0.46, 0); M.horn.localToWorld(tip); M.root.worldToLocal(tip);
    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(M.horn.quaternion);
    M.rings.forEach((r, i) => {
      const k = lift > 0.5 ? ((t * 1.6 + i / 3) % 1) : -1;
      if (k < 0) { r.material.opacity = Math.max(0, r.material.opacity - dt * 4); return; }
      r.position.copy(tip).addScaledVector(dir, k * 0.9);
      r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      r.scale.setScalar(0.8 + k * 1.6); r.material.opacity = (1 - k) * 0.9;
    });
  }
  if (G) {
    G.armR.rotation.set(-0.15, 0, 0.72);
    G.root.updateMatrixWorld(true);
    G.pole.position.copy(G.root.worldToLocal(G.hand.getWorldPosition(v3))); G.pole.position.y = 0.04;
    G.pole.rotation.z = Math.sin(t * 1.7) * 0.025;
    // the flag waves
    const p = G.flag.geometry.attributes.position, o = G.flagPos;
    for (let i = 0; i < p.count; i++) {
      const x = o[i * 3], y = o[i * 3 + 1];
      p.array[i * 3 + 2] = Math.sin(x * 9 - t * 6 + y * 2) * 0.06 * (x / 0.62);
      p.array[i * 3 + 1] = y - (x / 0.62) * 0.03 * (1 + Math.sin(t * 3));
    }
    p.needsUpdate = true; G.flag.geometry.computeVertexNormals();
    // wave hello with the other hand now and then
    const w = (t + 3) % 7;
    G.armL.rotation.set(0, 0, w < 1.6 ? -(ease(Math.min(1, w / 0.25)) * (1 - ease(clamp01((w - 1.3) / 0.3)))) * (2.3 + 0.3 * Math.sin(t * 13)) : -0.04);
  }
  if (B) {
    // the bug flies a little loop in front, the glass follows it
    const bt = reduce ? 0 : t;
    const bx = Math.sin(bt * 1.3) * 0.6 - 0.1, by = 1.3 + Math.sin(bt * 2.6) * 0.2, bz = 1.45 + Math.cos(bt * 1.3) * 0.25;
    B.root.updateMatrixWorld(true);
    B.bug.position.copy(B.root.localToWorld(v3.set(bx, by, bz)));
    const nx = Math.cos(bt * 1.3) * 0.55 * 1.3, nz = -Math.sin(bt * 1.3) * 0.25 * 1.3;
    B.bug.rotation.set(0, Math.atan2(nx, nz) + B.root.rotation.y, Math.sin(t * 3) * 0.2);
    B.wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * (0.3 + Math.abs(Math.sin(t * 40)) * 0.9)));
    // look at the bug
    const toBug = new THREE.Vector3(bx, by - 1.45, bz);
    B.head.rotation.y = lerp(B.head.rotation.y, Math.atan2(toBug.x, toBug.z) * 0.8, 0.12);
    B.head.rotation.x = lerp(B.head.rotation.x, -Math.atan2(toBug.y, toBug.z) * 0.6, 0.12);
    B.armR.rotation.set(-1.45 - (by - 1.3) * 0.6, 0, 0.12 - bx * 0.35);
    B.root.updateMatrixWorld(true);
    B.glass.position.copy(B.root.worldToLocal(B.hand.getWorldPosition(v3)));
    B.glass.rotation.set(0.85, 0, -bx * 0.35 - 0.15);
  }
}

let last = 0;
function loop() {
  requestAnimationFrame(loop);
  if (!hero.visible && !close.visible) return;
  const t = clock.getElapsedTime(), dt = Math.min(0.05, t - last); last = t;
  mouse.x += (mouse.tx - mouse.x) * 0.08; mouse.y += (mouse.ty - mouse.y) * 0.08;
  // bulbs chase around the stage
  bulbs.forEach((b, i) => (b.material.emissiveIntensity = reduce ? 0.6 : 0.25 + Math.max(0, Math.sin(t * 5 - i * 0.7)) * 1.2));
  // confetti drifts down (and flies out after a send)
  confD.forEach((d, i) => {
    d.v.y = Math.max(-0.5, d.v.y - dt * 6); d.v.x *= 1 - dt * 1.5; d.v.z *= 1 - dt * 1.5;
    if (d.v.y < -0.3) d.v.y = lerp(d.v.y, -0.3 - (i % 5) * 0.04, dt * 2);
    d.p.addScaledVector(d.v, dt);
    d.p.x += Math.sin(t * 1.5 + i) * dt * 0.15;
    if (d.p.y < -0.6) d.p.set((Math.random() - 0.5) * 9, 5.5 + Math.random(), (Math.random() - 0.5) * 4 - 0.5);
    d.r.x += dt * d.s; d.r.y += dt * d.s * 0.7;
    dummy.position.copy(d.p); dummy.rotation.copy(d.r); dummy.updateMatrix(); conf.setMatrixAt(i, dummy.matrix);
  });
  conf.instanceMatrix.needsUpdate = true;
  if (Object.keys(crew).length) poseCrew(t, dt);
  // the spotlight glides to the chosen Jumpi
  const C = crew[chosen];
  const tx = C ? C.L.x : 0, tz = C ? C.z : 0.3;
  chosenX = lerp(chosenX, tx, 1 - Math.exp(-dt * 7)); chosenZ = lerp(chosenZ, tz, 1 - Math.exp(-dt * 7));
  beam.position.set(chosenX, 2.6, chosenZ); glow.position.set(chosenX, 0.045, chosenZ);
  beam.material.opacity = 0.85 + Math.sin(t * 3) * 0.1;

  if (hero.visible && hero.w) {
    const a = hero.cam.aspect, d = 9.4 * Math.max(1, 1.2 / a);
    hero.cam.position.set(mouse.x * 0.5, 2.35 + mouse.y * 0.2, d); hero.cam.lookAt(0, 1.08, 0);
    beam.visible = true; glow.visible = true; conf.visible = true;
    Object.values(crew).forEach((J) => { J.root.visible = true; J.props.forEach((p) => (p.visible = true)); if (J.bug) J.bug.visible = true; });
    hero.renderer.render(scene, hero.cam);
    // name tags above the heads
    if (C) {
      const cr = hero.canvas.getBoundingClientRect(), br = tagsBox.getBoundingClientRect();
      for (const J of Object.values(crew)) {
        const tag = tags[J.id]; if (!tag) continue;
        v3.set(J.root.position.x, 2.2 + J.root.position.y, J.root.position.z).project(hero.cam);
        tag.style.transform = `translate(${(v3.x * 0.5 + 0.5) * cr.width + cr.left - br.left}px, ${(-v3.y * 0.5 + 0.5) * cr.height + cr.top - br.top}px)`;
      }
    }
  }
  if (close.visible && close.w && C) {
    // only the chosen Jumpi, close up
    closeCam.x = lerp(closeCam.x, tx, 1 - Math.exp(-dt * 6)); closeCam.z = lerp(closeCam.z, tz, 1 - Math.exp(-dt * 6));
    const a = close.cam.aspect, d = Math.max(6.4, 3.6 / a);
    close.cam.position.set(closeCam.x + Math.sin(C.L.face) * 1.4, 1.75, closeCam.z + d); close.cam.lookAt(closeCam.x, 1.18, closeCam.z);
    beam.visible = false; glow.visible = true; conf.visible = true;
    Object.values(crew).forEach((J) => { const on = J.id === chosen; J.root.visible = on; J.props.forEach((p) => (p.visible = on)); if (J.bug) J.bug.visible = on; });
    close.renderer.render(scene, close.cam);
  }
}
loop();
