/*
  Jumpi City (/city) in 3D. An island town that grows with our TikTok followers (server: routes/city.js → GET /api/city).
  - The town: a roundabout with a fountain, roads, colourful houses (later: houses with the names of followers who ask).
  - The Luna Park (the followers asked for it): ferris wheel, roller coaster with a riding train, carousel, drop tower,
    entrance arch, string lights, stalls, balloons, Jumpis walking around.
  - PLOTS: empty fenced plots with a big "?" sign (what is built there is a secret). The plot being built gets a building
    site: crane, scaffolding, a frame that rises with the time, worker Jumpis with hard hats, a cement mixer, and the
    24-hour timer (an HTML label that follows the plot). Opened buildings are drawn from BUILDINGS.
  The page script (city.js) calls window.JumpiCity.update(data) with what /api/city returns and .fly(name) for the view buttons.
*/
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { NAMES } from "./city-names.js";

const reduce = () => !!(window.JUMPI_REDUCE_MOTION || matchMedia("(prefers-reduced-motion: reduce)").matches);
const TAU = Math.PI * 2;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const ease = (k) => 1 - Math.pow(1 - clamp01(k), 3);
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

const canvas = document.getElementById("cityCanvas");
const stage = canvas.parentElement;
const PHONE = matchMedia("(max-width:760px)").matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, PHONE ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbfe6ff, 260, 620);
const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 900);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.minDistance = 22; controls.maxDistance = 190; controls.maxPolarAngle = 1.32; controls.minPolarAngle = 0.25;
controls.enablePan = true; controls.screenSpacePanning = false; controls.panSpeed = 0.7;
controls.target.set(12, 0, -6);
camera.position.set(88, 78, 112);
controls.autoRotate = !reduce(); controls.autoRotateSpeed = 0.35;
let idleT = 0;
controls.addEventListener("start", () => { controls.autoRotate = false; idleT = 0; flight = null; });

/* ---------- sky, light ---------- */
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: "varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
  fragmentShader: "varying vec3 vP;void main(){float h=normalize(vP).y;vec3 top=vec3(.16,.55,.98),mid=vec3(.55,.83,1.),hor=vec3(.86,.95,1.);vec3 c=h>.1?mix(mid,top,smoothstep(.1,.7,h)):mix(hor,mid,smoothstep(-.05,.1,h));gl_FragColor=vec4(c,1.);}",
}));
scene.add(sky);
scene.add(new THREE.HemisphereLight(0xdff2ff, 0x7fae5e, 1.25));
const sun = new THREE.DirectionalLight(0xfff1d8, 2.6);
sun.position.set(-60, 110, 70); sun.castShadow = true;
sun.shadow.mapSize.set(PHONE ? 2048 : 4096, PHONE ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 10, far: 330 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

/* ---------- helpers ---------- */
const MATS = new Map();
const M = (color, o = {}) => {
  const k = color + JSON.stringify(o);
  if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.62, ...o }));
  return MATS.get(k);
};
function mesh(geo, m, pos, parent = scene, rot, shadow = true) {
  const x = new THREE.Mesh(geo, m);
  if (pos) x.position.set(...pos);
  if (rot) x.rotation.set(...rot);
  x.castShadow = shadow; x.receiveShadow = true;
  parent.add(x); return x;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s);
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const FONT = '"Lilita One","Secular One","Fredoka",system-ui,sans-serif';
function signTex(text, { bg = "#ff8a1c", fg = "#fff", edge = "#1d2b4f", w = 1024, h = 256, size = 150 } = {}) {
  return canvasTex(w, h, (x) => {
    x.fillStyle = edge; x.beginPath(); x.roundRect(0, 0, w, h, h * 0.22); x.fill();
    x.fillStyle = bg; x.beginPath(); x.roundRect(12, 12, w - 24, h - 24, h * 0.18); x.fill();
    x.fillStyle = fg; x.font = `${size}px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle";
    x.lineWidth = 16; x.strokeStyle = edge; x.lineJoin = "round"; x.strokeText(text, w / 2, h / 2 + 8); x.fillText(text, w / 2, h / 2 + 8);
  });
}
const anims = [];   // functions(t, dt) run every frame

/* ---------- the island ---------- */
const ISLAND = 92;
{
  // sea
  const sg = new THREE.PlaneGeometry(1400, 1400, 120, 120); sg.rotateX(-Math.PI / 2);
  const sea = mesh(sg, new THREE.MeshStandardMaterial({ color: 0x1fa8e8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.94 }), [0, -0.6, 0], scene, null, false);
  const base = sg.attributes.position.array.slice();
  anims.push((t) => {
    if (reduce()) return;
    const p = sg.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = base[i * 3], z = base[i * 3 + 2]; p.array[i * 3 + 1] = Math.sin(x * 0.05 + t * 0.9) * 0.25 + Math.cos(z * 0.06 + t * 0.7) * 0.25; }
    p.needsUpdate = true;
  });
  sea.receiveShadow = false;
  // beach + grass (rounded square shapes)
  const shape = (r, round) => { const s = new THREE.Shape(), a = r - round; s.moveTo(-a, -r); s.lineTo(a, -r); s.quadraticCurveTo(r, -r, r, -a); s.lineTo(r, a); s.quadraticCurveTo(r, r, a, r); s.lineTo(-a, r); s.quadraticCurveTo(-r, r, -r, a); s.lineTo(-r, -a); s.quadraticCurveTo(-r, -r, -a, -r); return s; };
  const ext = (r, round, depth, color, y) => { const g = new THREE.ExtrudeGeometry(shape(r, round), { depth, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 1.2, bevelSegments: 3, curveSegments: 18 }); g.rotateX(-Math.PI / 2); return mesh(g, M(color, { roughness: 0.95 }), [0, y, 0], scene, null, false); };
  ext(ISLAND + 9, 34, 2.2, "#f3d9a0", -3.4);   // the beach ring, lower than the grass
  const grassTex = canvasTex(512, 512, (x, w, h) => { x.fillStyle = "#7ccf52"; x.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { x.fillStyle = rnd() < 0.5 ? "rgba(70,150,40,.25)" : "rgba(170,230,110,.25)"; x.fillRect(rnd() * w, rnd() * h, 3, 3); } });
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(10, 10);
  const gg = new THREE.ExtrudeGeometry(shape(ISLAND, 30), { depth: 2.4, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.8, bevelSegments: 3, curveSegments: 18 });
  gg.rotateX(-Math.PI / 2);
  const grass = mesh(gg, new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }), [0, -2.4, 0], scene, null, false);
  grass.receiveShadow = true;
}

/* ---------- roads ---------- */
const roadTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = "#5d6675"; x.fillRect(0, 0, w, h); x.fillStyle = "#ffffff"; for (let y = 0; y < h; y += 64) x.fillRect(w / 2 - 5, y + 10, 10, 34); x.fillStyle = "#e9edf3"; x.fillRect(0, 0, 10, h); x.fillRect(w - 10, 0, 10, h); });
roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
function road(x, z, len, along) {   // along "x" or "z"
  const t = roadTex.clone(); t.needsUpdate = true; t.repeat.set(1, len / 10);
  const g = new THREE.PlaneGeometry(9, len); g.rotateX(-Math.PI / 2); if (along === "x") g.rotateY(Math.PI / 2);
  const r = mesh(g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), [x, 0.03, z], scene, null, false); r.receiveShadow = true;
  // pavements
  for (const s of [-1, 1]) {
    const pg = along === "x" ? box(len, 0.25, 2.2) : box(2.2, 0.25, len);
    mesh(pg, M("#e8e2d6", { roughness: 0.9 }), along === "x" ? [x, 0.12, z + s * 5.6] : [x + s * 5.6, 0.12, z], scene, null, false);
  }
}
road(0, 47, 76, "z"); road(0, -47, 76, "z"); road(47, 0, 76, "x"); road(-47, 0, 76, "x");
// roundabout + fountain
{
  const ring = new THREE.RingGeometry(7, 16, 48); ring.rotateX(-Math.PI / 2);
  mesh(ring, M("#5d6675", { roughness: 0.9 }), [0, 0.04, 0], scene, null, false);
  mesh(cyl(7, 7.4, 0.6, 40), M("#e8e2d6"), [0, 0.3, 0]);
  mesh(cyl(6.2, 6.2, 0.7, 40), M("#7ccf52", { roughness: 0.95 }), [0, 0.5, 0], scene, null, false);
  const basin = mesh(cyl(4, 4.4, 1.2, 32), M("#f5f1e8"), [0, 1, 0]);
  mesh(cyl(3.5, 3.5, 0.3, 32), M("#2fb9ff", { roughness: 0.1, metalness: 0.2 }), [0, 1.5, 0], scene, null, false);
  mesh(cyl(0.6, 0.9, 3, 16), M("#f5f1e8"), [0, 2.8, 0]);
  mesh(cyl(1.8, 0.4, 0.4, 24), M("#f5f1e8"), [0, 4.3, 0]);
  const drops = [];
  const dropM = new THREE.MeshStandardMaterial({ color: 0x8fdcff, transparent: true, opacity: 0.85, roughness: 0.1 });
  for (let i = 0; i < 40; i++) { const d = mesh(new THREE.SphereGeometry(0.16, 6, 6), dropM, [0, 4.6, 0], scene, null, false); d.userData.ph = i / 40; d.userData.a = rnd() * TAU; drops.push(d); }
  anims.push((t) => { for (const d of drops) { const k = (t * 0.6 + d.userData.ph) % 1, r = k * 3.2; d.position.set(Math.cos(d.userData.a) * r, 4.6 + Math.sin(k * Math.PI) * 2.4 - k * 2.6, Math.sin(d.userData.a) * r); } });
  // flower beds
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; mesh(new THREE.SphereGeometry(0.45, 8, 6), M(["#ff5fb4", "#ffd23a", "#ff7a1a", "#a66bff"][i % 4]), [Math.cos(a) * 5.4, 1, Math.sin(a) * 5.4]); }
}

/* ---------- trees, lamps, benches ---------- */
const treeTrunk = M("#9a6233", { roughness: 0.9 });
function tree(x, z, s = 1, kind = rnd()) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); scene.add(g);
  mesh(cyl(0.3, 0.45, 2.4, 8), treeTrunk, [0, 1.2, 0], g);
  if (kind < 0.55) { const c = ["#4caf3d", "#5cc24a", "#3f9e35"][Math.floor(rnd() * 3)]; mesh(new THREE.IcosahedronGeometry(2, 1), M(c, { flatShading: true }), [0, 3.6, 0], g); mesh(new THREE.IcosahedronGeometry(1.4, 1), M(c, { flatShading: true }), [0.9, 4.6, 0.4], g); }
  else if (kind < 0.85) { mesh(new THREE.ConeGeometry(2, 4, 8), M("#2f8f3f", { flatShading: true }), [0, 4, 0], g); mesh(new THREE.ConeGeometry(1.5, 3, 8), M("#38a149", { flatShading: true }), [0, 5.8, 0], g); }
  else { // palm
    mesh(cyl(0.22, 0.35, 5, 8), treeTrunk, [0, 2.5, 0], g, [0, 0, 0.08]);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, l = mesh(box(3.4, 0.12, 0.9), M("#3fae4a"), [Math.cos(a) * 1.4, 5.1, Math.sin(a) * 1.4], g); l.rotation.set(0, -a, -0.45); }
  }
  return g;
}
function lamp(x, z) {
  mesh(cyl(0.12, 0.16, 5, 8), M("#2b3a5c", { metalness: 0.4 }), [x, 2.5, z]);
  mesh(new THREE.SphereGeometry(0.45, 12, 8), M("#fff6cc", { emissive: "#ffe9a0", emissiveIntensity: 0.6 }), [x, 5.2, z], scene, null, false);
}

/* ---------- the Jumpi characters (blobby.glb), loaded once ---------- */
let JUMPI = null;
const crowd = [];   // { root, path(t) → [x,z,face], kind }
const SKINS = ["#ffd23a", "#ff8fc7", "#7fd3ff", "#9df07a", "#ffb05a", "#c9a2ff", "#ff6b6b", "#7ff0e0"];
function makeJumpi(skin, scale = 1.25) {
  const root = JUMPI.clone(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.material = [].concat(o.material).map((m) => {
      if (m.name === "Skin") { m = m.clone(); m.color.set(skin); }
      else if (m.name === "Mouth") { m = m.clone(); const c = new THREE.Color(skin), h = {}; c.getHSL(h); m.color.setHSL(h.h, Math.min(1, h.s * 0.9), h.l * 0.22); }
      return m;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  root.scale.setScalar(scale);
  const J = { root, body: root.getObjectByName("Body"), head: root.getObjectByName("Head"), armL: root.getObjectByName("ArmL"), armR: root.getObjectByName("ArmR"), ph: rnd() * 10 };
  scene.add(root);
  return J;
}
function hardHat(J) {
  const g = new THREE.Group(); g.position.set(0, 0.86, 0); J.head.add(g);
  const y = M("#ffc21c", { roughness: 0.35 });
  const dome = new THREE.SphereGeometry(0.64, 24, 12, 0, TAU, 0, Math.PI / 2); dome.scale(1, 0.72, 1);
  mesh(dome, y, [0, 0, 0], g);
  mesh(cyl(0.82, 0.82, 0.07, 24), y, [0, 0.02, 0.06], g);
  mesh(box(0.12, 0.12, 1.15), y, [0, 0.42, 0], g);
  return g;
}

/* ---------- town houses ---------- */
const HOUSE_COLS = ["#ff8fa3", "#ffd06b", "#8fd3ff", "#a6e38a", "#ffb07a", "#c6a8ff", "#7fe3d0", "#ffe08a"];
const ROOF_COLS = ["#e24a4a", "#3d6fd8", "#e07b1f", "#7a4fc7", "#2f9e6a"];
function house(x, z, face, i) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; scene.add(g);
  const w = 6 + (i % 3), d = 6, h = 4.2 + (i % 2) * 2.2;
  mesh(box(w, h, d), M(HOUSE_COLS[i % HOUSE_COLS.length]), [0, h / 2, 0], g);
  const roof = new THREE.ConeGeometry(Math.max(w, d) * 0.78, 3.2, 4); roof.rotateY(Math.PI / 4); roof.scale(w / Math.max(w, d), 1, d / Math.max(w, d));
  mesh(roof, M(ROOF_COLS[i % ROOF_COLS.length], { flatShading: true }), [0, h + 1.6, 0], g);
  mesh(box(1.4, 2.4, 0.2), M("#7a4a26"), [0, 1.2, d / 2 + 0.05], g);
  const win = M("#dff4ff", { emissive: "#bfe6ff", emissiveIntensity: 0.25, roughness: 0.2 });
  for (const sx of [-1, 1]) mesh(box(1.3, 1.2, 0.15), win, [sx * (w / 2 - 1.4), h - 1.6, d / 2 + 0.05], g, null, false);
  if (h > 5) for (const sx of [-1, 1]) mesh(box(1.3, 1.2, 0.15), win, [sx * (w / 2 - 1.4), 1.8, d / 2 + 0.05], g, null, false);
  mesh(box(0.8, 1.6, 0.8), M("#c45a3a"), [w / 2 - 1.2, h + 2.4, -1], g);
  // little garden fence + mailbox
  mesh(box(w + 2, 0.6, 0.15), M("#ffffff"), [0, 0.3, d / 2 + 2.4], g);
  mesh(cyl(0.08, 0.08, 1.1, 6), M("#2b3a5c"), [w / 2 + 0.4, 0.55, d / 2 + 2.9], g);
  mesh(box(0.5, 0.4, 0.7), M("#e24a4a"), [w / 2 + 0.4, 1.2, d / 2 + 2.9], g);
  return g;
}
{
  // two streets of houses (south-west and south-east of the roundabout)
  let i = 0;
  for (let k = 0; k < 4; k++) { house(-14 - k * 10, 14, 0, i++); house(-14 - k * 10, 30, Math.PI, i++); }
  for (let k = 0; k < 4; k++) { house(-14 - k * 10, -66, 0, i++); }
  for (const [x, z] of [[-24, 22], [-44, 22], [-64, 22], [-20, 40], [-58, 40], [-76, 30]]) tree(x, z, 1 + rnd() * 0.3, 0.3);
}

/* ---------- LUNA PARK (north-east) ---------- */
const LP = new THREE.Vector3(46, 0, -46);
const lights = [];   // bulbs that twinkle (instanced)
{
  const G = new THREE.Group(); G.position.copy(LP); scene.add(G);
  // ground: a colourful paved square
  const pave = canvasTex(512, 512, (x, w, h) => { x.fillStyle = "#f6e7c8"; x.fillRect(0, 0, w, h); const s = 64; for (let yy = 0; yy < h; yy += s) for (let xx = 0; xx < w; xx += s) { if (((xx + yy) / s) % 2 === 0) { x.fillStyle = "#f0d9ad"; x.fillRect(xx, yy, s, s); } } x.strokeStyle = "rgba(160,120,70,.25)"; x.lineWidth = 3; for (let i = 0; i <= w; i += s) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } });
  pave.wrapS = pave.wrapT = THREE.RepeatWrapping; pave.repeat.set(6, 6);
  const pg = new THREE.PlaneGeometry(64, 64); pg.rotateX(-Math.PI / 2);
  mesh(pg, new THREE.MeshStandardMaterial({ map: pave, roughness: 0.9 }), [0, 0.05, 0], G, null, false);
  // low hedge around, with the entrance facing the roundabout (south-west corner side, z+)
  for (const [x, z, w, d] of [[0, -32, 64, 1.4], [32, 0, 1.4, 64], [-32, -9, 1.4, 46], [9, 32, 46, 1.4]]) mesh(box(w, 1.4, d), M("#3f9e35", { roughness: 0.95 }), [x, 0.7, z], G);

  // --- entrance arch at the corner facing town ---
  const gate = new THREE.Group(); gate.position.set(-22, 0, 22); gate.rotation.y = Math.PI / 4; G.add(gate);
  for (const s of [-1, 1]) {
    mesh(cyl(0.9, 1.1, 9, 16), M("#ff5fb4"), [s * 6, 4.5, 0], gate);
    for (let k = 0; k < 9; k++) mesh(cyl(0.95, 0.95, 0.35, 16), M(k % 2 ? "#ffffff" : "#ffd23a"), [s * 6, 0.6 + k, 0], gate);
    mesh(new THREE.SphereGeometry(1.3, 16, 12), M("#ffd23a", { emissive: "#ffb000", emissiveIntensity: 0.35 }), [s * 6, 9.8, 0], gate);
  }
  const archG = new THREE.TorusGeometry(6, 0.55, 12, 40, Math.PI);
  mesh(archG, M("#a66bff"), [0, 8.2, 0], gate);
  const lpSign = mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshStandardMaterial({ map: signTex("LUNA PARK", { bg: "#ff5fb4", size: 160 }), roughness: 0.5, transparent: true }), [0, 11.2, 0.6], gate, null, false);
  const lpSignBack = lpSign.clone(); lpSignBack.rotation.y = Math.PI; lpSignBack.position.z = -0.6; gate.add(lpSignBack);
  for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI; lights.push([gate, Math.cos(a) * 6, 8.2 + Math.sin(a) * 6, 0.62, i]); }

  // --- ferris wheel ---
  const FW = new THREE.Group(); FW.position.set(14, 0, -14); FW.rotation.y = -Math.PI / 4; G.add(FW);
  const R = 11, HUB = 13;
  const legM = M("#e8eef8", { metalness: 0.3, roughness: 0.4 });
  for (const sz of [-1.6, 1.6]) for (const sx of [-1, 1]) { const l = mesh(cyl(0.35, 0.45, HUB / Math.cos(0.32) + 0.5, 10), legM, [sx * HUB * Math.tan(0.32) / 2, HUB / 2, sz], FW); l.rotation.z = sx * 0.32; }
  mesh(cyl(0.6, 0.6, 3.8, 16), M("#ffd23a", { metalness: 0.4 }), [0, HUB, 0], FW, [Math.PI / 2, 0, 0]);
  const wheel = new THREE.Group(); wheel.position.set(0, HUB, 0); FW.add(wheel);
  for (const sz of [-1.1, 1.1]) {
    mesh(new THREE.TorusGeometry(R, 0.28, 10, 64), M("#ff5fb4", { metalness: 0.2 }), [0, 0, sz], wheel);
    mesh(new THREE.TorusGeometry(R * 0.62, 0.18, 8, 48), M("#7fd3ff"), [0, 0, sz], wheel);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, sp = mesh(cyl(0.1, 0.1, R, 6), legM, [Math.cos(a) * R / 2, Math.sin(a) * R / 2, sz], wheel); sp.rotation.z = a - Math.PI / 2; }
  }
  const cabins = [];
  const CAB_COLS = ["#ff6b6b", "#ffd23a", "#7fd3ff", "#9df07a", "#c9a2ff", "#ffb05a"];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, c = new THREE.Group(); wheel.add(c); c.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    mesh(cyl(0.06, 0.06, 1.4, 6), legM, [0, -0.7, 0], c);
    const cab = mesh(cyl(1.15, 0.95, 1.5, 12), M(CAB_COLS[i % CAB_COLS.length]), [0, -2, 0], c);
    mesh(new THREE.SphereGeometry(1.2, 14, 8, 0, TAU, 0, Math.PI / 2), M(CAB_COLS[(i + 2) % CAB_COLS.length]), [0, -1.25, 0], c);
    cabins.push(c);
    lights.push([wheel, Math.cos(a + 0.26) * R, Math.sin(a + 0.26) * R, 1.45, i]);
  }
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; lights.push([wheel, Math.cos(a) * R, Math.sin(a) * R, -1.45, i]); }
  anims.push((t, dt) => { if (!reduce()) wheel.rotation.z -= dt * 0.12; for (const c of cabins) c.rotation.z = -wheel.rotation.z; });

  // --- roller coaster (a closed spline track with supports and a riding train) ---
  const pts = [];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const rx = 18 + Math.sin(a * 2) * 3, rz = 10 + Math.cos(a * 3) * 2;
    const h = 3 + (Math.sin(a * 2 + 0.6) + 1) * 4.5 + (i === 3 ? 6 : 0);
    pts.push(new THREE.Vector3(-6 + Math.cos(a) * rx, h, 8 + Math.sin(a) * rz));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
  const railM = M("#e24a4a", { metalness: 0.3, roughness: 0.35 });
  const tieM = M("#ffffff");
  const frames = curve.computeFrenetFrames(400, true);
  const left = [], right = [];
  for (let i = 0; i <= 400; i++) { const u = i / 400, p = curve.getPointAt(u), b = new THREE.Vector3(0, 1, 0).cross(curve.getTangentAt(u)).normalize(); left.push(p.clone().addScaledVector(b, 0.7)); right.push(p.clone().addScaledVector(b, -0.7)); }
  for (const side of [left, right]) mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(side, true), 400, 0.16, 6, true), railM, null, G);
  const tieG = [];
  for (let i = 0; i < 160; i++) { const u = i / 160, p = curve.getPointAt(u), tg = curve.getTangentAt(u); const g = box(1.7, 0.12, 0.3); const m4 = new THREE.Matrix4().lookAt(new THREE.Vector3(), tg, new THREE.Vector3(0, 1, 0)); g.applyMatrix4(m4); g.translate(p.x, p.y - 0.12, p.z); tieG.push(g); }
  mesh(mergeGeometries(tieG), tieM, null, G);
  const supG = [];
  for (let i = 0; i < 40; i++) { const p = curve.getPointAt(i / 40); const g = cyl(0.16, 0.22, p.y, 6); g.translate(p.x, p.y / 2, p.z); supG.push(g); }
  mesh(mergeGeometries(supG), M("#f2f5fa", { metalness: 0.2 }), null, G);
  void frames;
  const train = [];
  for (let k = 0; k < 4; k++) {
    const car = new THREE.Group(); G.add(car);
    mesh(box(1.5, 0.8, 2), M(k === 0 ? "#ffd23a" : "#3d6fd8", { roughness: 0.35 }), [0, 0.4, 0], car);
    mesh(box(1.5, 0.6, 0.25), M("#ffffff"), [0, 0.95, -0.85], car);
    train.push(car);
  }
  let tu = 0;
  anims.push((t, dt) => {
    if (!reduce()) { const p = curve.getPointAt(tu), slope = curve.getTangentAt(tu).y; tu = (tu + dt * (0.035 - slope * 0.03)) % 1; if (tu < 0) tu += 1; void p; }
    train.forEach((car, k) => { const u = (tu - k * 0.012 + 1) % 1, p = curve.getPointAt(u), tg = curve.getTangentAt(u); car.position.copy(p).y += 0.1; car.lookAt(p.clone().add(tg)); });
  });

  // --- carousel ---
  const CA = new THREE.Group(); CA.position.set(-14, 0, -12); G.add(CA);
  mesh(cyl(6.2, 6.6, 0.8, 32), M("#ffffff"), [0, 0.4, 0], CA);
  const spin = new THREE.Group(); CA.add(spin);
  mesh(cyl(6, 6, 0.3, 32), M("#a66bff"), [0, 0.95, 0], spin);
  mesh(cyl(0.7, 0.7, 6, 16), M("#ffd23a", { metalness: 0.4 }), [0, 4, 0], spin);
  const canopy = new THREE.ConeGeometry(7, 3.2, 16, 1, true);
  const stripes = canvasTex(512, 64, (x, w, h) => { for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? "#ffffff" : "#ff5fb4"; x.fillRect((i * w) / 16, 0, w / 16 + 1, h); } });
  mesh(canopy, new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.5, side: THREE.DoubleSide }), [0, 7.6, 0], spin);
  mesh(new THREE.SphereGeometry(0.7, 12, 8), M("#ffd23a", { emissive: "#ffb000", emissiveIntensity: 0.4 }), [0, 9.5, 0], spin);
  const horses = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU, hg = new THREE.Group(); hg.position.set(Math.cos(a) * 4.4, 0, Math.sin(a) * 4.4); hg.rotation.y = -a; spin.add(hg);
    mesh(cyl(0.08, 0.08, 6, 6), M("#ffd23a", { metalness: 0.5 }), [0, 4, 0], hg);
    const col = ["#ffffff", "#ffb05a", "#7fd3ff", "#ff8fc7"][i % 4];
    const body = new THREE.Group(); hg.add(body); horses.push(body);
    mesh(new THREE.CapsuleGeometry(0.45, 1.2, 4, 10), M(col), [0, 0, 0], body, [0, 0, Math.PI / 2]);
    mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 8), M(col), [0.85, 0.45, 0], body, [0, 0, -0.6]);
    mesh(box(0.5, 0.15, 0.6), M("#e24a4a"), [0, 0.42, 0], body);
    for (const lx of [-0.5, 0.5]) for (const lz of [-0.22, 0.22]) mesh(cyl(0.09, 0.09, 0.8, 6), M(col), [lx, -0.6, lz], body);
    lights.push([spin, Math.cos(a + 0.2) * 6.8, 6.1, Math.sin(a + 0.2) * 6.8, i]);
  }
  anims.push((t, dt) => { if (!reduce()) spin.rotation.y += dt * 0.5; horses.forEach((h, i) => (h.position.y = 2.2 + Math.sin(t * 2.4 + i * 1.3) * 0.35)); });

  // --- drop tower ---
  const DT = new THREE.Group(); DT.position.set(20, 0, 16); G.add(DT);
  mesh(cyl(1.1, 1.4, 24, 12), M("#3d6fd8", { metalness: 0.3 }), [0, 12, 0], DT);
  mesh(cyl(1.8, 1.8, 1.2, 16), M("#ffd23a"), [0, 24.4, 0], DT);
  mesh(new THREE.ConeGeometry(1.8, 2.2, 16), M("#ff5fb4"), [0, 26.1, 0], DT);
  const seat = mesh(cyl(2.6, 2.6, 1, 20), M("#ff7a1a"), [0, 3, 0], DT);
  for (let i = 0; i < 6; i++) lights.push([DT, Math.cos((i / 6) * TAU) * 1.5, 6 + i * 3, Math.sin((i / 6) * TAU) * 1.5, i]);
  // up slowly, wait at the top, drop fast, bounce a little at the bottom
  const dropY = (k) => k < 0.5 ? 2 + ease(k / 0.5) * 19 : k < 0.62 ? 21 : k < 0.7 ? 21 - Math.pow((k - 0.62) / 0.08, 2) * 19 : 2 + Math.abs(Math.sin((k - 0.7) * 26)) * Math.max(0, 1.2 - (k - 0.7) * 5);
  anims.push((t) => { if (!reduce()) seat.position.y = dropY((t % 9) / 9); });

  // --- stalls, balloons, trees ---
  const stall = (x, z, col, word, rot) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = rot; G.add(s);
    mesh(box(4, 2.4, 2.6), M("#ffffff"), [0, 1.2, 0], s);
    const awn = canvasTex(256, 64, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#ffffff" : col; c.fillRect((i * w) / 8, 0, w / 8 + 1, h); } });
    mesh(box(4.6, 0.3, 3.2), new THREE.MeshStandardMaterial({ map: awn }), [0, 3.2, 0.4], s, [0.25, 0, 0]);
    mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshStandardMaterial({ map: signTex(word, { bg: col, size: 120 }), transparent: true }), [0, 3.9, 1.0], s, null, false);
    for (const px of [-2.1, 2.1]) mesh(cyl(0.1, 0.1, 3.2, 6), M("#ffffff"), [px, 1.6, 1.8], s);
  };
  stall(-24, 4, "#ff7a1a", "POPCORN", Math.PI / 2);
  stall(-24, 12, "#ff5fb4", "CANDY", Math.PI / 2);
  stall(2, 26, "#3d6fd8", "ICE CREAM", Math.PI);
  stall(-6, 26, "#2f9e6a", "GAMES", Math.PI);
  const balloons = [];
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Group(); b.position.set(-20 + rnd() * 6, 0, 14 + rnd() * 6); G.add(b);
    mesh(new THREE.SphereGeometry(0.7, 14, 10), M(SKINS[i % SKINS.length], { roughness: 0.25 }), [0, 4.5 + rnd(), 0], b).scale.set(1, 1.18, 1);
    const st = mesh(cyl(0.02, 0.02, 4, 4), M("#ffffff"), [0, 2.4, 0], b, null, false); void st;
    b.userData.ph = rnd() * 6; balloons.push(b);
  }
  anims.push((t) => balloons.forEach((b) => { b.rotation.z = Math.sin(t * 1.2 + b.userData.ph) * 0.06; b.rotation.x = Math.cos(t + b.userData.ph) * 0.05; }));
  for (const [x, z] of [[28, -28], [-28, -28], [28, 28], [10, -28], [-28, 28]]) tree(LP.x + x, LP.z + z, 1.1, 0.9);
}

// all the bulbs as one instanced mesh that twinkles
const bulbGeo = new THREE.SphereGeometry(0.22, 8, 6);
const bulbs = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), lights.length);
bulbs.frustumCulled = false; scene.add(bulbs);
const BULB_COLS = [new THREE.Color("#fff2a8"), new THREE.Color("#ffb3dd"), new THREE.Color("#a8e6ff"), new THREE.Color("#c8ffb0")];
const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpC = new THREE.Color();
anims.push((t) => {
  lights.forEach(([parent, x, y, z, i], k) => {
    parent.updateMatrixWorld();
    tmpV.set(x, y, z).applyMatrix4(parent.matrixWorld);
    tmpM.makeTranslation(tmpV.x, tmpV.y, tmpV.z); bulbs.setMatrixAt(k, tmpM);
    const on = reduce() ? 1 : 0.55 + 0.45 * Math.max(0, Math.sin(t * 4 + i * 0.9));
    tmpC.copy(BULB_COLS[k % 4]).multiplyScalar(0.6 + on * 0.9); bulbs.setColorAt(k, tmpC);
  });
  bulbs.instanceMatrix.needsUpdate = true; if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
});

/* ---------- PLOTS (secret buildings) ---------- */
// the same order as GOALS in routes/city.js: plot 0 = the first goal
const PLOTS = [
  { x: 46, z: 40, face: Math.PI },          // south-east, next to the avenue
  { x: -46, z: -40, face: 0 },              // north-west
  { x: 16, z: 72, face: -Math.PI / 2 },     // south, by the beach road
  { x: -72, z: -14, face: Math.PI / 2 },    // west
  { x: 72, z: 14, face: -Math.PI / 2 },     // east
];
const plotObjs = PLOTS.map((P, i) => {
  const g = new THREE.Group(); g.position.set(P.x, 0, P.z); g.rotation.y = P.face; scene.add(g);
  return { P, g, i, state: "", label: null, labelPos: new THREE.Vector3(P.x, 18, P.z), parts: null };
});
const dirtTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = "#c99a62"; x.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { x.fillStyle = rnd() < 0.5 ? "rgba(120,80,40,.25)" : "rgba(240,210,160,.3)"; x.fillRect(rnd() * w, rnd() * h, 3, 3); } });
function clearGroup(g) { while (g.children.length) g.remove(g.children[0]); }
function fence(g, s = 13) {
  const wood = M("#d9a466", { roughness: 0.9 });
  const posts = [], rails = [];
  for (let k = -s; k <= s; k += 2.6) for (const [x, z] of [[k, -s], [k, s], [-s, k], [s, k]]) { const p = cyl(0.14, 0.14, 1.6, 6); p.translate(x, 0.8, z); posts.push(p); }
  for (const y of [0.55, 1.2]) for (const [x, z, w, d] of [[0, -s, 2 * s, 0.12], [0, s, 2 * s, 0.12], [-s, 0, 0.12, 2 * s], [s, 0, 0.12, 2 * s]]) { const r = box(w, 0.16, d); r.translate(x, y, z); rails.push(r); }
  mesh(mergeGeometries([...posts, ...rails]), wood, null, g);
}
function dirt(g, s = 13) { const t = dirtTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); const pg = new THREE.PlaneGeometry(2 * s, 2 * s); pg.rotateX(-Math.PI / 2); mesh(pg, new THREE.MeshStandardMaterial({ map: t, roughness: 1 }), [0, 0.06, 0], g, null, false); }

function drawEmpty(o) {
  clearGroup(o.g); dirt(o.g); fence(o.g);
  // a big wooden board with a "?"
  const qTex = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = "#1d2b4f"; x.beginPath(); x.roundRect(0, 0, w, h, 60); x.fill();
    x.fillStyle = "#ffd23a"; x.beginPath(); x.roundRect(14, 14, w - 28, h - 28, 50); x.fill();
    x.fillStyle = "#1d2b4f"; x.font = `380px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("?", w / 2, h / 2 + 30);
  });
  const board = new THREE.Group(); board.position.set(0, 0, 0); o.g.add(board);
  for (const s of [-1.6, 1.6]) mesh(cyl(0.22, 0.25, 7, 8), M("#9a6233"), [s, 3.5, 0], board);
  const q = new THREE.Group(); q.position.set(0, 5.2, 0); board.add(q);
  mesh(box(5.3, 5.3, 0.25), M("#9a6233"), [0, 0, 0], q);
  for (const side of [1, -1]) mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshStandardMaterial({ map: qTex, roughness: 0.6 }), [0, 0, side * 0.14], q, [0, side > 0 ? 0 : Math.PI, 0], false);
  o.parts = { q, board };
  o.labelPos.set(o.P.x, 9.5, o.P.z);
}

// a building site: crane, scaffolding, a frame that rises with the time, workers, mixer
function drawSite(o) {
  clearGroup(o.g); dirt(o.g); fence(o.g);
  const g = o.g, parts = { workers: [] };
  // orange and white barriers + cones
  for (let i = 0; i < 6; i++) mesh(new THREE.ConeGeometry(0.4, 1, 12), M(i % 2 ? "#ff7a1a" : "#ffffff"), [-11 + i * 1.4, 0.5, 11.5], g);
  // the building goes up floor by floor with the time (5 floors, each one shows when its part of the 24 hours starts)
  const frame = new THREE.Group(); g.add(frame); parts.floors = [];
  const colM = M("#b8c2d4", { roughness: 0.8 }), flM = M("#d8dee8", { roughness: 0.9 });
  for (let f = 0; f < 5; f++) {
    const fg = new THREE.Group(); fg.position.y = f * 3.2; frame.add(fg);
    const cols = [];
    for (const x of [-8, -2.7, 2.7, 8]) for (const z of [-8, 6]) { const c = box(0.6, 3.2, 0.6); c.translate(x, 1.6, z); cols.push(c); }
    mesh(mergeGeometries(cols), colM, null, fg);
    mesh(box(16, 0.4, 14), flM, [0, 3.2, -1], fg);
    fg.visible = false; parts.floors.push(fg);
  }
  mesh(box(17, 0.5, 15), M("#9aa3b2", { roughness: 0.9 }), [0, 0.25, -1], frame);   // the foundation
  // scaffolding on the front, as high as the building
  const sc = [];
  for (let f = 0; f < 5; f++) for (let k = -9; k <= 9; k += 3) { const a = cyl(0.07, 0.07, 3.2, 5); a.translate(k, f * 3.2 + 1.6, 7.6); sc.push(a); if (k < 9) { const b2 = box(3, 0.08, 0.08); b2.translate(k + 1.5, f * 3.2 + 3.2, 7.6); sc.push(b2); } }
  const scaf = mesh(mergeGeometries(sc), M("#ffd23a", { metalness: 0.4 }), null, g); parts.scaf = scaf;
  // the crane
  const crane = new THREE.Group(); crane.position.set(-10, 0, -10); g.add(crane);
  const latM = M("#ffc21c", { metalness: 0.3, roughness: 0.4 });
  mesh(box(1.2, 24, 1.2), latM, [0, 12, 0], crane);
  for (let y = 1; y < 24; y += 2) mesh(box(1.3, 0.12, 1.3), M("#1d2b4f"), [0, y, 0], crane, null, false);
  const jib = new THREE.Group(); jib.position.set(0, 24, 0); crane.add(jib); parts.jib = jib;
  mesh(box(22, 0.8, 0.9), latM, [6, 0.4, 0], jib);
  mesh(box(5, 2.4, 2.4), M("#3d6fd8"), [-4, -0.6, 0], jib);
  mesh(box(2.2, 2, 2), M("#ffffff"), [1.6, -1.4, 0], jib);
  const cable = mesh(cyl(0.05, 0.05, 1, 4), M("#1d2b4f"), [14, -6, 0], jib, null, false); parts.cable = cable;
  const load = mesh(box(3, 1, 1.4), M("#e24a4a"), [14, -12, 0], jib); parts.load = load;
  // cement mixer truck
  const truck = new THREE.Group(); truck.position.set(8, 0, 10); truck.rotation.y = -0.4; g.add(truck);
  mesh(box(5.5, 1.2, 2.4), M("#ffffff"), [0, 1.2, 0], truck);
  mesh(box(1.8, 1.8, 2.4), M("#3d6fd8"), [2.6, 2.2, 0], truck);
  const drum = mesh(new THREE.CapsuleGeometry(1.1, 2, 6, 12), M("#ff7a1a"), [-0.8, 2.8, 0], truck, [0, 0, Math.PI / 2 - 0.25]); parts.drum = drum;
  for (const x of [-1.8, 1.8]) for (const z of [-1.2, 1.2]) mesh(cyl(0.55, 0.55, 0.4, 12), M("#1d2b4f"), [x, 0.55, z], truck, [Math.PI / 2, 0, 0]);
  // sign
  mesh(new THREE.PlaneGeometry(7, 1.8), new THREE.MeshStandardMaterial({ map: signTex("UNDER CONSTRUCTION", { bg: "#ffc21c", fg: "#ffffff", edge: "#1d2b4f", size: 82 }), transparent: true }), [0, 2.4, 13.3], g, null, false);
  for (const s of [-3.2, 3.2]) mesh(cyl(0.12, 0.12, 2.4, 6), M("#1d2b4f"), [s, 1.2, 13.2], g);
  o.parts = parts;
  o.labelPos.set(o.P.x, 21, o.P.z);
  addWorkers(o);
}
function addWorkers(o) {
  if (!JUMPI || !o.parts || o.parts.workers.length) return;
  const spots = [[-4, 9, 0, "hammer"], [3, 9.5, 0.6, "hammer"], [-7, 3, Math.PI / 2, "carry"], [6, 2, -Math.PI / 2, "point"], [0, -11, Math.PI, "walk"]];
  spots.forEach(([x, z, face, job], k) => {
    const J = makeJumpi(SKINS[(k + 3) % SKINS.length], 1.15);
    o.g.add(J.root); J.root.position.set(x, 0, z); J.root.rotation.y = face; J.job = job; J.base = [x, z, face];
    hardHat(J);
    if (job === "hammer") { const h = new THREE.Group(); J.armR.add(h); h.position.set(0.03, -0.42, 0.06); mesh(cyl(0.05, 0.05, 0.7, 6), M("#9a6233"), [0, -0.15, 0.2], h, [Math.PI / 2, 0, 0]); mesh(box(0.28, 0.16, 0.16), M("#6b7487", { metalness: 0.6 }), [0, -0.15, 0.55], h); }
    if (job === "carry") { const p = mesh(box(1.4, 0.3, 0.5), M("#d9a466"), [0, 1.35, 0.55], J.root); J.plank = p; }
    o.parts.workers.push(J);
  });
}

/* ---------- opened buildings ---------- */
const BUILDINGS = {
  mall(g) {
    mesh(box(22, 10, 18), M("#ffffff"), [0, 5, -1], g);
    const glass = M("#7fd3ff", { roughness: 0.1, metalness: 0.3, emissive: "#4fb8ff", emissiveIntensity: 0.15 });
    for (let f = 0; f < 3; f++) mesh(box(20, 2.2, 0.3), glass, [0, 2 + f * 3, 8.1], g, null, false);
    mesh(box(24, 0.6, 20), M("#ff5fb4"), [0, 10.3, -1], g);
    mesh(new THREE.PlaneGeometry(14, 3), new THREE.MeshStandardMaterial({ map: signTex("JUMPI MALL", { bg: "#ff5fb4", size: 150 }), transparent: true }), [0, 12.2, 8.2], g, null, false);
    mesh(box(5, 3.6, 0.4), M("#2b3a5c", { roughness: 0.2 }), [0, 1.8, 8.25], g, null, false);
  },
  stadium(g) {
    mesh(cyl(12, 13, 7, 40, 1), M("#e8eef8"), [0, 3.5, 0], g);
    mesh(cyl(9, 9, 0.5, 40), M("#5cc24a"), [0, 0.6, 0], g, null, false);
    mesh(new THREE.TorusGeometry(12.5, 0.5, 8, 40), M("#3d6fd8"), [0, 7.2, 0], g, [Math.PI / 2, 0, 0]);
  },
  aquarium(g) {
    mesh(new THREE.SphereGeometry(10, 32, 16, 0, TAU, 0, Math.PI / 2), M("#7fd3ff", { roughness: 0.1, transparent: true, opacity: 0.8 }), [0, 0, 0], g);
    mesh(cyl(10.5, 10.5, 1.2, 40), M("#3d6fd8"), [0, 0.6, 0], g);
  },
  castle(g) {
    mesh(box(16, 8, 12), M("#f3e2c0"), [0, 4, 0], g);
    for (const [x, z] of [[-8, -6], [8, -6], [-8, 6], [8, 6]]) { mesh(cyl(2, 2.2, 12, 16), M("#f3e2c0"), [x, 6, z], g); mesh(new THREE.ConeGeometry(2.6, 4, 16), M("#a66bff"), [x, 14, z], g); }
  },
  tower(g) {
    mesh(cyl(4, 6, 40, 8), M("#7fd3ff", { roughness: 0.15, metalness: 0.4 }), [0, 20, 0], g);
    mesh(new THREE.ConeGeometry(4, 8, 8), M("#ffd23a"), [0, 44, 0], g);
  },
};
function drawBuilt(o, id) {
  clearGroup(o.g);
  const pg = new THREE.PlaneGeometry(26, 26); pg.rotateX(-Math.PI / 2);
  mesh(pg, M("#e8e2d6", { roughness: 0.9 }), [0, 0.06, 0], o.g, null, false);
  (BUILDINGS[id] || BUILDINGS.mall)(o.g);
  o.parts = null;
  o.labelPos.set(o.P.x, 16, o.P.z);
}

/* ---------- a few Jumpis walking around ---------- */
function startCrowd() {
  // in the Luna Park: loops around the rides
  const loops = [[LP.x - 4, LP.z + 2, 15, 0.08], [LP.x + 2, LP.z - 4, 9, -0.1], [LP.x - 10, LP.z + 14, 5, 0.14]];
  for (let i = 0; i < 9; i++) {
    const J = makeJumpi(SKINS[i % SKINS.length], 1.2), L = loops[i % loops.length];
    J.path = (t) => { const a = t * L[3] + i * 0.8; return [L[0] + Math.cos(a) * L[2], L[1] + Math.sin(a) * L[2], -a + (L[3] > 0 ? -Math.PI / 2 : Math.PI / 2) + Math.PI]; };
    crowd.push(J);
  }
  // in town, walking along the pavements
  for (let i = 0; i < 6; i++) {
    const J = makeJumpi(SKINS[(i + 4) % SKINS.length], 1.2), side = i % 2 ? 1 : -1, lane = i < 3 ? "x" : "z", off = rnd() * 70;
    J.path = (t) => { const s = ((t * 2.2 + off) % 70) - 35; const dir = side; return lane === "x" ? [-47 + s * dir, 5.6 * side, dir > 0 ? Math.PI / 2 : -Math.PI / 2] : [5.6 * side, 47 + s * dir, dir > 0 ? 0 : Math.PI]; };
    crowd.push(J);
  }
  // a few sitting by the fountain, waving
  for (let i = 0; i < 4; i++) { const J = makeJumpi(SKINS[(i + 1) % SKINS.length], 1.2), a = (i / 4) * TAU + 0.4; J.root.position.set(Math.cos(a) * 8.6, 0.3, Math.sin(a) * 8.6); J.root.rotation.y = -a - Math.PI / 2; J.wave = true; crowd.push(J); }
}
anims.push((t) => {
  for (const J of crowd) {
    const br = Math.sin(t * 2.3 + J.ph);
    if (J.path) {
      const [x, z, face] = J.path(reduce() ? 0 : t);
      J.root.position.set(x, Math.abs(Math.sin(t * 6 + J.ph)) * 0.12, z); J.root.rotation.y = face;
      J.armL.rotation.x = Math.sin(t * 6 + J.ph) * 0.5; J.armR.rotation.x = -Math.sin(t * 6 + J.ph) * 0.5;
    } else if (J.wave) {
      const w = (t + J.ph) % 6; J.armR.rotation.z = w < 1.5 ? 2.3 + Math.sin(t * 12) * 0.3 : 0.1;
    }
    J.body.scale.set(1 + br * 0.012, 1 + br * 0.02, 1 + br * 0.012);
  }
  // workers
  for (const o of plotObjs) {
    if (!o.parts || !o.parts.workers) continue;
    for (const J of o.parts.workers) {
      const r = reduce() ? 0 : t;
      if (J.job === "hammer") { J.armR.rotation.x = -1.2 - Math.abs(Math.sin(r * 5 + J.ph)) * 1.2; J.root.position.y = 0; }
      else if (J.job === "carry") { const s = Math.sin(r * 0.5 + J.ph) * 6; J.root.position.set(J.base[0], Math.abs(Math.sin(r * 6)) * 0.1, J.base[1] + s); J.root.rotation.y = Math.cos(r * 0.5 + J.ph) > 0 ? 0 : Math.PI; J.armL.rotation.x = J.armR.rotation.x = -1.4; }
      else if (J.job === "point") { J.armR.rotation.z = 1.8 + Math.sin(r * 1.5) * 0.2; J.head.rotation.y = Math.sin(r * 0.7) * 0.5; }
      else { const a = r * 0.35 + J.ph; J.root.position.set(Math.cos(a) * 10, Math.abs(Math.sin(r * 6)) * 0.1, Math.sin(a) * 10); J.root.rotation.y = -a + Math.PI; J.armL.rotation.x = Math.sin(r * 6) * 0.5; J.armR.rotation.x = -Math.sin(r * 6) * 0.5; }
    }
  }
});

// Jumpis walking up and down the village avenue and along its first streets (added once the model has loaded)
function villageCrowd() {
  for (let i = 0; i < 8; i++) {
    const J = makeJumpi(SKINS[(i + 2) % SKINS.length], 1.15), off = rnd() * 400, dir = i % 2 ? 1 : -1;
    if (i < 4) { const len = VHZ * 2 - 26, x = (i % 2 ? 1.6 : -1.6); J.path = (t) => { const s = ((t * 2 + off) % len) - len / 2; return [x, VZ + s * dir, dir > 0 ? 0 : Math.PI]; }; }
    else { const p = (i - 4) % Math.max(1, vPairs), zs = VZ0 + p * (ROW * 2 + STREET + GAP) + ROW + STREET / 2 + (i % 2 ? 1.2 : -1.2), len = VHX * 2 - 20; J.path = (t) => { const s = ((t * 2 + off) % len) - len / 2; return [s * dir, zs, dir > 0 ? Math.PI / 2 : -Math.PI / 2]; }; }
    crowd.push(J);
  }
}

/* ---------- trees all over, clouds ---------- */
for (let i = 0; i < 70; i++) {
  const x = (rnd() * 2 - 1) * (ISLAND - 6), z = (rnd() * 2 - 1) * (ISLAND - 6);
  const nearRoad = Math.abs(x) < 9 || Math.abs(z) < 9 || Math.hypot(x, z) < 20;
  const inLP = x > 10 && x < 82 && z < -10 && z > -82;
  const inPlot = PLOTS.some((P) => Math.abs(x - P.x) < 17 && Math.abs(z - P.z) < 17);
  const inHouses = x < -8 && x > -84 && ((z > 6 && z < 40) || (z < -58 && z > -76));
  if (!nearRoad && !inLP && !inPlot && !inHouses) tree(x, z, 0.9 + rnd() * 0.5);
}
for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; tree(Math.cos(a) * 88, Math.sin(a) * 88, 1.2, 0.95); }
for (const [x, z] of [[7, 30], [-7, 30], [7, 62], [-7, 62], [30, 7], [62, 7], [-30, -7], [-62, -7], [7, -30], [-7, -62], [30, -7], [-30, 7]]) lamp(x, z);
const clouds = [];
// clouds in a ring far outside the island (the camera never gets that far, so it never flies into one)
for (let i = 0; i < 12; i++) {
  const c = new THREE.Group(); const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  for (let k = 0; k < 4; k++) mesh(new THREE.SphereGeometry(8 + rnd() * 6, 12, 8), cm, [k * 10 - 15, rnd() * 3, rnd() * 6], c, null, false);
  const a = (i / 12) * TAU + rnd() * 0.3, r = 480 + rnd() * 60;
  c.position.set(Math.cos(a) * r, 55 + rnd() * 40, Math.sin(a) * r); c.userData.a = a; c.userData.r = r; c.userData.v = 0.004 + rnd() * 0.004; scene.add(c); clouds.push(c);
}
anims.push((t, dt) => { if (!reduce()) for (const c of clouds) { c.userData.a += dt * c.userData.v; c.position.x = Math.cos(c.userData.a) * c.userData.r; c.position.z = Math.sin(c.userData.a) * c.userData.r; c.lookAt(0, c.position.y, 0); } });

/* ---------- labels that follow things (HTML) ---------- */
const labels = document.getElementById("cityLabels");
function label(cls) { const d = document.createElement("div"); d.className = "cl " + cls; labels.appendChild(d); return d; }
const lpLabel = label("cl-lp");
lpLabel.innerHTML = '<b data-l="en">Luna Park</b><b data-l="he">לונה פארק</b><span data-l="en">You asked, we built it!</span><span data-l="he">ביקשתם, בנינו!</span>';
const lpPos = new THREE.Vector3(LP.x, 27, LP.z);
const pv = new THREE.Vector3();
function placeLabel(el, pos) {
  pv.copy(pos).project(camera);
  const vis = pv.z < 1 && Math.abs(pv.x) < 1.1 && Math.abs(pv.y) < 1.1;
  el.style.opacity = vis ? "1" : "0";
  if (vis) el.style.transform = `translate(-50%,-100%) translate(${((pv.x + 1) / 2) * stage.clientWidth}px,${((1 - pv.y) / 2) * stage.clientHeight}px)`;
}

/* ---------- FOLLOWERS VILLAGE (south, over a bridge): a house for every name in city-names.js ----------
   Rows of little houses along streets; the first names are nearest the bridge, new ones add rows further south.
   The houses are instanced (a few draw calls for all of them) and the names float over the roofs as billboards drawn
   from one canvas atlas (one draw call), fading out when the camera is far. findHome() flies to a house and marks it. */
const VCOLS = 20, LOT = 7, ROW = 7.5, STREET = 6, GAP = 2.5, AVE = 9;   // houses per row, lot width, row depth, street, path between pairs, main avenue
const vRows = Math.max(2, Math.ceil(NAMES.length / VCOLS));
const vPairs = Math.ceil(vRows / 2);
const VHX = (VCOLS / 2) * LOT + AVE / 2 + 10;                       // half width of the village island
const VHZ = (vPairs * (ROW * 2 + STREET) + (vPairs - 1) * GAP) / 2 + 14;
const VZ = ISLAND + 9 + 34 + VHZ;                                   // its centre (34 = the sea between, the bridge)
const VZ0 = VZ - VHZ + 14;                                          // where the first row starts
const homes = [];                                                   // { x, z, face, h, name }
{
  // the island (same rounded look as the main one)
  const rect = (hx, hz, round) => { const s = new THREE.Shape(); s.moveTo(-hx + round, -hz); s.lineTo(hx - round, -hz); s.quadraticCurveTo(hx, -hz, hx, -hz + round); s.lineTo(hx, hz - round); s.quadraticCurveTo(hx, hz, hx - round, hz); s.lineTo(-hx + round, hz); s.quadraticCurveTo(-hx, hz, -hx, hz - round); s.lineTo(-hx, -hz + round); s.quadraticCurveTo(-hx, -hz, -hx + round, -hz); return s; };
  const ext = (s, depth, mat, y) => { const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 1, bevelSegments: 3, curveSegments: 14 }); g.rotateX(-Math.PI / 2); const m = mesh(g, mat, [0, y, VZ], scene, null, false); m.receiveShadow = false; return m; };
  ext(rect(VHX + 8, VHZ + 8, 24), 2.2, M("#f3d9a0", { roughness: 0.95 }), -3.4);
  const vg = new THREE.MeshStandardMaterial({ color: "#86d65a", roughness: 0.95 });
  ext(rect(VHX, VHZ, 20), 2.4, vg, -2.4);
  // the bridge from the end of the south road
  const b0 = ISLAND - 2, b1 = VZ - VHZ + 2, bl = b1 - b0, bm = (b0 + b1) / 2;
  mesh(box(9, 0.8, bl), M("#c98a4b", { roughness: 0.85 }), [0, 0.2, bm], scene, null, false);
  for (const s of [-1, 1]) {
    mesh(box(0.4, 1.2, bl), M("#ffffff"), [s * 4.4, 1.2, bm], scene, null, false);
    for (let z = b0 + 4; z < b1 - 2; z += 8) mesh(cyl(0.6, 0.7, 6, 10), M("#8a5a30"), [s * 4.2, -2.6, z], scene, null, false);
  }
  // entrance arch with the village sign
  const arch = new THREE.Group(); arch.position.set(0, 0, VZ - VHZ + 6); scene.add(arch);
  for (const s of [-1, 1]) mesh(cyl(0.7, 0.8, 9, 14), M("#ff5fb4"), [s * 6, 4.5, 0], arch, null, false);
  const archSign = mesh(new THREE.PlaneGeometry(15, 3.6), new THREE.MeshStandardMaterial({ map: signTex("שכונת העוקבים", { bg: "#ff5fb4", w: 1024, h: 248, size: 132 }), roughness: 0.6, side: THREE.DoubleSide }), [0, 9.4, 0], arch, [0, Math.PI, 0], false);
  void archSign;
  // the main avenue (from the bridge to the south end) and the streets across it
  const asphalt = M("#6a7382", { roughness: 0.9 }), walk = M("#ece5d6", { roughness: 0.9 });
  mesh(box(AVE - 2, 0.12, VHZ * 2 - 16), asphalt, [0, 0.06, VZ], scene, null, false);
  for (let p = 0; p < vPairs; p++) {
    const zs = VZ0 + p * (ROW * 2 + STREET + GAP) + ROW + STREET / 2;
    mesh(box(VHX * 2 - 14, 0.1, STREET - 1.4), asphalt, [0, 0.05, zs], scene, null, false);
    for (const s of [-1, 1]) mesh(box(VHX * 2 - 14, 0.16, 0.7), walk, [0, 0.08, zs + s * (STREET / 2 - 0.35)], scene, null, false);
  }
  // where every house stands
  NAMES.forEach((name, i) => {
    const row = Math.floor(i / VCOLS), col = i % VCOLS, pair = Math.floor(row / 2), north = row % 2 === 0;
    const half = col < VCOLS / 2 ? -1 : 1, k = col < VCOLS / 2 ? VCOLS / 2 - 1 - col : col - VCOLS / 2;   // fill from the avenue outwards
    const x = half * (AVE / 2 + LOT / 2 + k * LOT);
    const zPair = VZ0 + pair * (ROW * 2 + STREET + GAP);
    const z = north ? zPair + ROW / 2 : zPair + ROW + STREET + ROW / 2;
    const r = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    homes.push({ i, name, x, z, face: north ? 0 : Math.PI, h: 3.4 + (r * 3 | 0) * 0.9, w: 4.4 + (i % 3) * 0.4, r });
  });
  // instanced houses: walls, roofs, doors, windows, little front paths
  const n = homes.length;
  const g1 = box(1, 1, 1); g1.translate(0, 0.5, 0);
  const roofG = new THREE.ConeGeometry(0.75, 1, 4); roofG.rotateY(Math.PI / 4); roofG.translate(0, 0.5, 0);
  const walls = new THREE.InstancedMesh(g1, new THREE.MeshStandardMaterial({ roughness: 0.65 }), n);
  const roofs = new THREE.InstancedMesh(roofG, new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true }), n);
  const doors = new THREE.InstancedMesh(g1, M("#7a4a26"), n);
  const paths = new THREE.InstancedMesh(g1, M("#e8dcc4", { roughness: 0.9 }), n);
  const wins = new THREE.InstancedMesh(g1, M("#dff4ff", { emissive: "#bfe6ff", emissiveIntensity: 0.25, roughness: 0.2 }), n * 2);
  const o = new THREE.Object3D(), c = new THREE.Color(), v = new THREE.Vector3();
  const put = (im, idx, H, lx, ly, lz, sx, sy, sz) => {
    v.set(lx, ly, lz).applyAxisAngle(THREE.Object3D.DEFAULT_UP, H.face);
    o.position.set(H.x + v.x, ly, H.z + v.z); o.rotation.set(0, H.face, 0); o.scale.set(sx, sy, sz); o.updateMatrix(); im.setMatrixAt(idx, o.matrix);
  };
  homes.forEach((H, i) => {
    put(walls, i, H, 0, 0, -0.6, H.w, H.h, 4.4);
    walls.setColorAt(i, c.set(HOUSE_COLS[(i * 5 + (H.r * 8 | 0)) % HOUSE_COLS.length]));
    put(roofs, i, H, 0, H.h, -0.6, H.w * 1.12, 2.4, 4.4 * 1.12);
    roofs.setColorAt(i, c.set(ROOF_COLS[(i * 3 + 1) % ROOF_COLS.length]));
    put(doors, i, H, 0, 0, 1.62, 1, 1.9, 0.16);
    put(paths, i, H, 0, 0, 2.7, 1.2, 0.06, 2);
    for (const s of [0, 1]) put(wins, i * 2 + s, H, (s ? 1 : -1) * (H.w / 2 - 0.95), H.h * 0.5, 1.62, 0.9, 0.9, 0.14);
  });
  for (const im of [walls, roofs, doors, paths, wins]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.castShadow = false; im.receiveShadow = false; scene.add(im); }
  // trees along the edges of the village and at the street ends
  for (let p = 0; p < vPairs; p++) { const zs = VZ0 + p * (ROW * 2 + STREET + GAP) + ROW + STREET / 2; for (const s of [-1, 1]) tree(s * (VHX - 4), zs, 1, 0.3); }
  for (let z = VZ - VHZ + 12; z < VZ + VHZ - 6; z += 14) for (const s of [-1, 1]) tree(s * (VHX + 3), z, 1.1, 0.95);
}

/* the names over the roofs: one atlas, one instanced billboard mesh */
const NAME_W = 384, NAME_H = 64, ATLAS_COLS = 10;   // (room for 640 names in a 3840×4096 atlas)
const atlasRows = Math.max(1, Math.ceil(NAMES.length / ATLAS_COLS));
const atlas = document.createElement("canvas"); atlas.width = NAME_W * ATLAS_COLS; atlas.height = NAME_H * atlasRows;
const atlasTex = new THREE.CanvasTexture(atlas); atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 8;
function drawNames() {
  const x = atlas.getContext("2d");
  x.clearRect(0, 0, atlas.width, atlas.height);
  NAMES.forEach((name, i) => {
    if (!name) return;
    const cx = (i % ATLAS_COLS) * NAME_W, cy = Math.floor(i / ATLAS_COLS) * NAME_H;
    x.font = `40px ${'"Secular One","Rubik",system-ui,sans-serif'}`;
    const tw = Math.min(NAME_W - 16, x.measureText(name).width + 34);
    const bx = cx + (NAME_W - tw) / 2;
    x.fillStyle = "#1d2b4f"; x.beginPath(); x.roundRect(bx, cy + 4, tw, NAME_H - 8, 18); x.fill();
    x.fillStyle = "#ffffff"; x.beginPath(); x.roundRect(bx + 4, cy + 8, tw - 8, NAME_H - 16, 14); x.fill();
    x.fillStyle = "#1d2b4f"; x.textAlign = "center"; x.textBaseline = "middle"; x.direction = /[\u0590-\u05ff]/.test(name) ? "rtl" : "ltr";   // (usernames are Latin: dots stay in place)
    x.fillText(name, cx + NAME_W / 2, cy + NAME_H / 2 + 2, NAME_W - 40);
  });
  atlasTex.needsUpdate = true;
}
drawNames();
document.fonts?.load('44px "Secular One"', "אבג").then(drawNames).catch(() => {});
{
  const n = homes.length;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const at = new Float32Array(n * 3), cell = new Float32Array(n * 2);
  homes.forEach((H, i) => { at.set([H.x, H.h + 3.6, H.z - 0.6], i * 3); cell.set([i % ATLAS_COLS, Math.floor(i / ATLAS_COLS)], i * 2); });
  g.setAttribute("at", new THREE.InstancedBufferAttribute(at, 3));
  g.setAttribute("cell", new THREE.InstancedBufferAttribute(cell, 2));
  g.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: atlasTex }, grid: { value: new THREE.Vector2(ATLAS_COLS, atlasRows) }, size: { value: new THREE.Vector2(6.6, 1.1) } },
    vertexShader: `attribute vec3 at; attribute vec2 cell; uniform vec2 grid; uniform vec2 size; varying vec2 vUv; varying float vFade;
      void main(){ vec4 mv = modelViewMatrix * vec4(at, 1.0); float d = -mv.z; vFade = 1.0 - smoothstep(120.0, 170.0, d);
        mv.xy += position.xy * size * (1.0 + smoothstep(40.0, 120.0, d) * 0.6);
        vUv = vec2((cell.x + uv.x) / grid.x, 1.0 - (cell.y + 1.0 - uv.y) / grid.y); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vFade;
      void main(){ vec4 c = texture2D(map, vUv); if (c.a * vFade < 0.5) discard; gl_FragColor = vec4(c.rgb, 1.0);
      #include <colorspace_fragment>
      }`,
  });
  const signs = new THREE.Mesh(g, mat); signs.frustumCulled = false; signs.renderOrder = 2; scene.add(signs);
}

/* the village label, and finding a house */
const vLabel = label("cl-lp cl-village");
const vLabelPos = new THREE.Vector3(0, 16, VZ - VHZ + 6);
function paintVillageLabel() {
  const count = NAMES.filter(Boolean).length;
  vLabel.innerHTML = `<b data-l="en">Followers Village</b><b data-l="he">שכונת העוקבים</b><span data-l="en"><span dir="ltr">${count}</span> houses</span><span data-l="he"><span dir="ltr">${count}</span> בתים</span>`;
}
paintVillageLabel();
const homeLabel = label("cl-lp cl-home"); homeLabel.style.display = "none";
const homePos = new THREE.Vector3();
const marker = new THREE.Group(); marker.visible = false; scene.add(marker);
{
  const pink = M("#ff5fb4", { emissive: "#ff5fb4", emissiveIntensity: 0.35 });
  const cone = new THREE.ConeGeometry(1.1, 2.2, 16); cone.rotateX(Math.PI);
  mesh(cone, pink, [0, 0, 0], marker, null, false);
  const ring = new THREE.TorusGeometry(3.6, 0.22, 8, 40); ring.rotateX(Math.PI / 2);
  marker.userData.ring = mesh(ring, pink, [0, 0, 0], marker, null, false);
}
let picked = null;
const norm = (s) => String(s || "").trim().toLowerCase().replace(/^@/, "").replace(/[֑-ׇ'"׳״\s-]/g, "").replace(/(.)\1+/g, "$1");
function matchHomes(q) { const k = norm(q); if (!k) return []; const eq = homes.filter((H) => H.name && norm(H.name) === k); return eq.length ? eq : homes.filter((H) => H.name && norm(H.name).startsWith(k)); }
function showHome(H, now) {
  picked = H;
  marker.visible = true; marker.position.set(H.x, H.h + 6.2, H.z - 0.6); marker.userData.ring.position.y = -(H.h + 6);
  homePos.set(H.x, H.h + 8.4, H.z - 0.6);
  homeLabel.style.display = "";
  homeLabel.innerHTML = `<b data-l="en">${esc(H.name)}'s house</b><b data-l="he">הבית של ${esc(H.name)}</b><span data-l="en">House no. <span dir="ltr">${H.i + 1}</span></span><span data-l="he">בית מספר <span dir="ltr">${H.i + 1}</span></span>`;
  const s = H.face ? -1 : 1;
  const far = PHONE ? 1.25 : 1;
  const v = { pos: [H.x + 12 * far, 30 * far, H.z + s * 36 * far], target: [H.x, PHONE ? 12 : 7, H.z] };   // (phones: the search box covers the top)
  controls.autoRotate = false;
  if (now) { camera.position.set(...v.pos); controls.target.set(...v.target); flight = null; return; }
  flight = { t: 0, from: camera.position.clone(), to: new THREE.Vector3(...v.pos), tf: controls.target.clone(), tt: new THREE.Vector3(...v.target) };
}
function esc(s) { return String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])); }
function findHome(q, nth = 0) { const list = matchHomes(q); if (!list.length) return { found: 0 }; const H = list[nth % list.length]; showHome(H); return { found: list.length, at: (nth % list.length) + 1, home: H.i + 1 }; }
function goHome(no, now) { const H = homes[no - 1]; if (H && H.name) { showHome(H, now); return true; } return false; }
anims.push((t) => { if (marker.visible) { const b = reduce() ? 0 : Math.sin(t * 3); marker.children[0].position.y = b * 0.5; marker.userData.ring.scale.setScalar(1 + (reduce() ? 0 : (t * 0.8) % 1) * 0.4); } });

/* ---------- the state from the server ---------- */
let DATA = null;
const fmt = (n) => Number(n).toLocaleString("en-US");
function update(d) {
  DATA = d; DATA.at0 = Date.now();   // (server clock − our clock = DATA.now − DATA.at0)
  const builtOn = new Map(d.built.filter((b) => b.plot >= 0).map((b) => [b.plot, b.id]));
  const goals = d.goals || [];
  plotObjs.forEach((o, i) => {
    const want = builtOn.has(i) ? "built:" + builtOn.get(i) : d.build && d.build.plot === i ? "site" : "empty";
    if (o.state !== want) {
      o.state = want;
      if (want === "site") drawSite(o); else if (want === "empty") drawEmpty(o); else drawBuilt(o, builtOn.get(i));
    }
    if (!o.label) o.label = label("cl-plot");
    const nextPlot = d.build ? d.build.plot + 1 : builtOn.size;   // the plot the next goal will use
    if (want === "site") {
      o.label.className = "cl cl-plot cl-site";
      o.label.dataset.end = d.build.end; o.label.dataset.skew = d.now - Date.now();
    } else if (want === "empty") {
      o.label.className = "cl cl-plot" + (i === nextPlot && d.next ? " cl-next" : " cl-later");
      if (i === nextPlot && d.next) o.label.innerHTML = `<b dir="ltr">${fmt(d.next.goal)}</b><span data-l="en">followers</span><span data-l="he">עוקבים</span>`;
      else o.label.innerHTML = '<b>?</b>';
    } else {
      o.label.className = "cl cl-plot cl-done";
      o.label.innerHTML = "";
    }
    void goals;
  });
  tickTimers();
}
function tickTimers() {
  for (const o of plotObjs) {
    if (!o.label || o.state !== "site") continue;
    const end = Number(o.label.dataset.end), skew = Number(o.label.dataset.skew) || 0;
    const left = Math.max(0, end - (Date.now() + skew));
    const h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000), s = Math.floor((left % 60000) / 1000);
    const tt = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    o.label.innerHTML = `<span data-l="en">Opening in</span><span data-l="he">נפתח בעוד</span><b dir="ltr">${tt}</b>`;
  }
}
setInterval(tickTimers, 1000);

/* ---------- camera flights for the view buttons ---------- */
let flight = null;
const VIEWS = {
  city: { pos: [88, 78, 112], target: [12, 0, -6] },
  lunapark: { pos: [LP.x - 34, 30, LP.z + 44], target: [LP.x, 6, LP.z] },
  village: () => ({ pos: [(document.documentElement.lang === "he" ? -1 : 1) * 30, 52, VZ - VHZ - 52], target: [0, 0, VZ - VHZ + 46] }),   // (from the side the card doesn't cover)
  // in front of the plot (its +z side, where the sign is), a little to the side
  build: () => { const o = plotObjs.find((p) => p.state === "site") || plotObjs.find((p) => p.label && p.label.classList.contains("cl-next")) || plotObjs[0]; const P = o.P, c = Math.cos(P.face), s2 = Math.sin(P.face), lx = 18, lz = 54; return { pos: [P.x + lx * c + lz * s2, 32, P.z - lx * s2 + lz * c], target: [P.x, 9, P.z] }; },
};
function fly(name, now) {
  const v = typeof VIEWS[name] === "function" ? VIEWS[name]() : VIEWS[name];
  if (!v) return;
  controls.autoRotate = false;
  if (now) { camera.position.set(...v.pos); controls.target.set(...v.target); flight = null; return; }   // (straight there: videos / tests)
  flight = { t: 0, from: camera.position.clone(), to: new THREE.Vector3(...v.pos), tf: controls.target.clone(), tt: new THREE.Vector3(...v.target) };
}

/* ---------- load the Jumpi, start ---------- */
new GLTFLoader().load("/blobby.glb", (g) => {
  JUMPI = g.scene;
  startCrowd();
  villageCrowd();
  for (const o of plotObjs) if (o.state === "site") addWorkers(o);
});
// before the server answers: all plots empty, the first is "next"
plotObjs.forEach((o) => { drawEmpty(o); o.state = "empty"; });

/* ---------- size + loop ---------- */
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w < h ? 58 : 40;
  // standing phones: the card covers the bottom, so the picture's centre moves up
  if (w < h) camera.setViewOffset(w, h, 0, h * 0.2, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage); resize();
let visible = true;
new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(stage);
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (!visible || document.hidden) return;
  if (flight) {
    flight.t = Math.min(1, flight.t + dt / 1.6); const k = ease(flight.t) ;
    camera.position.lerpVectors(flight.from, flight.to, k); controls.target.lerpVectors(flight.tf, flight.tt, k);
    if (flight.t >= 1) flight = null;
  } else if (!controls.autoRotate && !reduce()) { idleT += dt; if (idleT > 25) controls.autoRotate = true; }
  for (const f of anims) f(t, dt);
  // the building site: frame rises with the time, crane turns, drum spins
  for (const o of plotObjs) {
    if (o.state !== "site" || !o.parts || !DATA || !DATA.build) continue;
    const k = clamp01((Date.now() + (DATA.now - DATA.at0) - DATA.build.start) / (DATA.build.end - DATA.build.start));
    const n = Math.min(5, Math.floor(k * 5) + 1);
    o.parts.floors.forEach((f, i) => (f.visible = i < n));
    o.parts.scaf.scale.y = n / 5;
    if (!reduce()) { o.parts.jib.rotation.y = Math.sin(t * 0.15) * 1.1; o.parts.load.position.y = -12 + Math.sin(t * 0.4) * 5; o.parts.cable.scale.y = 12 - Math.sin(t * 0.4) * 5; o.parts.cable.position.y = -(12 - Math.sin(t * 0.4) * 5) / 2; o.parts.drum.rotation.x += dt * 2; }
  }
  // the "?" boards bob a little
  for (const o of plotObjs) if (o.state === "empty" && o.parts && o.parts.q) o.parts.q.position.y = 5.2 + Math.sin(t * 1.6 + o.i) * 0.15;
  controls.update();
  placeLabel(lpLabel, lpPos);
  placeLabel(vLabel, vLabelPos);
  if (picked) placeLabel(homeLabel, homePos);
  for (const o of plotObjs) if (o.label) placeLabel(o.label, o.labelPos);
  renderer.render(scene, camera);
});

window.JumpiCity = { update, fly, findHome, goHome, homes: homes.length, camera, controls, render: () => renderer.render(scene, camera) };
dispatchEvent(new Event("city:ready"));
