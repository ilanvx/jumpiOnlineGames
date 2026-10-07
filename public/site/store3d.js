/* Jumpi Store: 3D art. The hero (a Jumpi with a treasure chest), and pictures for every card
   (coin piles, membership medals, bundles), drawn once with three.js and put into <img data-art="..."> */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const TAU = Math.PI * 2;
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });
function mesh(geo, m, pos, parent, rot) {
  const x = new THREE.Mesh(geo, m);
  if (pos) x.position.set(...pos);
  if (rot) x.rotation.set(...rot);
  x.castShadow = true;
  parent && parent.add(x);
  return x;
}
const BLOBBY = new Promise((res, rej) => new GLTFLoader().load("/blobby.glb", (g) => res(g.scene), undefined, rej));
function blobby(base, skin, eye = "#7a3e12") {
  const root = base.clone(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.material = [].concat(o.material).map((m) => {
      if (m.name === "Skin") { m = m.clone(); m.color.set(skin); }
      else if (m.name === "Iris") { m = m.clone(); m.color.set(eye); }
      else if (m.name === "Mouth") { m = m.clone(); const c = new THREE.Color(skin), h = {}; c.getHSL(h); m.color.setHSL(h.h, Math.min(1, h.s * 0.9), h.l * 0.22); }
      return m;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  return { root, body: root.getObjectByName("Body"), head: root.getObjectByName("Head"), armL: root.getObjectByName("ArmL"), armR: root.getObjectByName("ArmR"), eyeL: root.getObjectByName("EyeL"), eyeR: root.getObjectByName("EyeR") };
}

/* ---------- shared pieces ---------- */
const GOLD = () => mat("#ffcc33", { metalness: 0.35, roughness: 0.32, emissive: "#9a6400", emissiveIntensity: 0.35 });
function coin(parent, x, y, z, rx = 0, rz = 0, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rx, 0, rz); g.scale.setScalar(s); parent.add(g);
  mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.07, 32), GOLD(), [0, 0, 0], g);
  mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 28), mat("#f0a800", { metalness: 0.3, roughness: 0.35, emissive: "#7a4a00", emissiveIntensity: 0.3 }), [0, 0.036, 0], g, [Math.PI / 2, 0, 0]);
  return g;
}
function stack(parent, x, z, n, s = 1) { for (let i = 0; i < n; i++) coin(parent, x + Math.sin(i * 1.7) * 0.02, 0.04 + i * 0.075 * s, z + Math.cos(i * 2.3) * 0.02, 0, 0, s); }
function chest(parent, open = 0.9, s = 1) {
  const g = new THREE.Group(); g.scale.setScalar(s); parent.add(g);
  const wood = mat("#a0602f", { roughness: 0.7 }), band = mat("#ffc21a", { metalness: 0.7, roughness: 0.3 });
  mesh(new THREE.BoxGeometry(1.4, 0.7, 0.9), wood, [0, 0.35, 0], g);
  [-0.5, 0.5].forEach((x) => mesh(new THREE.BoxGeometry(0.1, 0.72, 0.92), band, [x, 0.35, 0], g));
  // coins inside
  for (let i = 0; i < 26; i++) coin(g, (Math.random() - 0.5) * 1.15, 0.72 + Math.random() * 0.14, (Math.random() - 0.5) * 0.65, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9, 0.8);
  const lid = new THREE.Group(); lid.position.set(0, 0.7, -0.45); lid.rotation.x = -open * 1.6; g.add(lid);
  mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.4, 24, 1, false, 0, Math.PI), wood, [0, 0, 0.45], lid, [0, 0, Math.PI / 2]);
  [-0.5, 0.5].forEach((x) => mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.1, 24, 1, false, 0, Math.PI), band, [x, 0, 0.45], lid, [0, 0, Math.PI / 2]));
  mesh(new THREE.BoxGeometry(0.22, 0.26, 0.08), band, [0, 0.55, 0.47], g);
  return g;
}
function lights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9a0d9, 1.7));
  const d = new THREE.DirectionalLight(0xffffff, 2.1); d.position.set(3, 6, 5); scene.add(d);
  return d;
}

/* ---------- pictures for the cards ---------- */
let R = null;
function shot(build, { w = 360, h = 300, view = [0, 2.2, 6.2], look = [0, 0.8, 0], fov = 30 } = {}) {
  if (!R) { R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.setPixelRatio(1); }
  R.setSize(w, h, false);
  const scene = new THREE.Scene(); lights(scene); build(scene);
  const cam = new THREE.PerspectiveCamera(fov, w / h, 0.1, 60); cam.position.set(...view); cam.lookAt(...look);
  R.render(scene, cam);
  return R.domElement.toDataURL("image/png");
}
const ART = {
  "coins": (n) => shot((s) => {
    const k = { 600: 0, 1400: 1, 3200: 2, 7000: 3 }[n] ?? 0;
    if (k === 0) { stack(s, -0.25, 0, 4); stack(s, 0.35, 0.2, 2); coin(s, 0.1, 0.05, 0.75, -0.2, 0.3); }
    if (k === 1) { stack(s, -0.6, -0.1, 6); stack(s, 0, 0.15, 8); stack(s, 0.6, -0.1, 5); coin(s, 0.15, 0.04, 0.85, -0.2, 0.2); coin(s, -0.45, 0.04, 0.75, 0.1, -0.3); }
    if (k === 2) { chest(s, 0.5, 0.95); stack(s, 1.05, 0.4, 5, 0.9); coin(s, -1, 0.04, 0.5, 0.1, 0.4); }
    if (k === 3) { chest(s, 0.5, 1.15); stack(s, -1.25, 0.45, 9, 0.9); stack(s, 1.25, 0.45, 7, 0.9); for (let i = 0; i < 9; i++) coin(s, (Math.random() - 0.5) * 2.8, 0.04, 0.6 + Math.random() * 0.6, Math.random() * 0.4, Math.random() * 0.6, 0.85); }
  }, { view: [0, 2.3, 4.9], look: [0, 0.45, 0] }),
  "member": (days) => shot((s) => {
    const col = { 7: "#1fb6ff", 14: "#9b5cff", 30: "#ffb21f" }[days] || "#ffb21f";
    const g = new THREE.Group(); g.position.y = 1; g.rotation.set(0.15, -0.35, 0.05); s.add(g);
    [-1, 1].forEach((d) => mesh(new THREE.BoxGeometry(0.42, 1.2, 0.06), mat(col, { roughness: 0.6 }), [d * 0.28, -0.75, -0.08], g, [0, 0, d * 0.32]));
    mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.2, 48), GOLD(), [0, 0, 0], g, [Math.PI / 2, 0, 0]);
    mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.22, 48), mat(col, { roughness: 0.4 }), [0, 0, 0], g, [Math.PI / 2, 0, 0]);
    const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * TAU, r = i % 2 ? 0.25 : 0.6; i ? sh.lineTo(Math.cos(a) * r, -Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, -Math.sin(a) * r); }
    mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }), mat("#ffffff", { roughness: 0.3 }), [0, 0, 0.08], g);
  }, { view: [0, 1.1, 5.2], look: [0, 0.75, 0], w: 300, h: 300 }),
};
// bundles need the Jumpi model
async function bundleArt(id) {
  const base = await BLOBBY;
  return shot((s) => {
    const conf = { "bundle-starter": ["#1fb6ff", "#7fd6ff"], "bundle-sakura": ["#ff7fbf", "#ffd3e8"], "bundle-royal": ["#9b5cff", "#ffd84a"] }[id] || ["#ff8a1c", "#ffd23a"];
    const J = blobby(base, conf[0]); J.root.rotation.y = 0.25; s.add(J.root);
    mesh(new THREE.CylinderGeometry(1.15, 1.1, 0.16, 48), mat(conf[1], { roughness: 0.8 }), [0, -0.08, 0], s);
    if (id === "bundle-sakura") {
      for (let i = 0; i < 26; i++) { const a = (i / 26) * TAU * 2, r = 0.95 + Math.sin(i * 3) * 0.15; const p = mesh(new THREE.SphereGeometry(0.08, 10, 8), mat(i % 3 ? "#ff9ccc" : "#ffffff", { roughness: 0.6, emissive: "#ff5fa8", emissiveIntensity: 0.2 }), [Math.cos(a) * r, 0.3 + (i / 26) * 2, Math.sin(a) * r], s); p.scale.set(1, 0.35, 0.7); p.rotation.set(i, i * 2, 0); }
    } else if (id === "bundle-royal") {
      const crown = new THREE.Group(); crown.position.y = 2.35; s.add(crown);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, sh = new THREE.Shape(); for (let k = 0; k < 10; k++) { const b = -Math.PI / 2 + (k / 10) * TAU, rr = k % 2 ? 0.05 : 0.12; k ? sh.lineTo(Math.cos(b) * rr, Math.sin(b) * rr) : sh.moveTo(Math.cos(b) * rr, Math.sin(b) * rr); }
        mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }), GOLD(), [Math.cos(a) * 0.55, i % 2 ? 0 : 0.12, Math.sin(a) * 0.55], crown, [0, -a + Math.PI / 2, 0]); }
      mesh(new THREE.TorusGeometry(1.05, 0.04, 8, 48), GOLD(), [0, 0.02, 0], s, [Math.PI / 2, 0, 0]);
    } else {
      const box = new THREE.Group(); box.position.set(1.05, 0, 0.35); box.rotation.y = -0.4; s.add(box);
      mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), mat("#ff5fa8"), [0, 0.25, 0], box);
      mesh(new THREE.BoxGeometry(0.64, 0.12, 0.64), mat("#ff8fc8"), [0, 0.52, 0], box);
      mesh(new THREE.BoxGeometry(0.1, 0.52, 0.62), mat("#ffd23a"), [0, 0.26, 0], box); mesh(new THREE.BoxGeometry(0.62, 0.52, 0.1), mat("#ffd23a"), [0, 0.26, 0], box);
      for (let i = 0; i < 5; i++) coin(s, -1.1 + (i % 3) * 0.12, 0.04 + Math.floor(i / 3) * 0.08 + i * 0.075, 0.25, 0, 0, 0.8);
    }
  }, { view: [0, 1.9, 7.4], look: [0, 1.2, 0], w: 360, h: 360 });
}
const cache = {};
function art(key) {
  if (cache[key]) return cache[key];
  const [kind, arg] = key.split(":");
  // bundles: pictures made with the game itself (real clothes and auras), see /play?bundleshots
  cache[key] = kind === "bundle" ? Promise.resolve(`/site/img/${arg}.png`) : Promise.resolve(ART[kind] ? ART[kind](+arg) : "");
  return cache[key];
}
function fill(root = document) {
  root.querySelectorAll("img[data-art]:not([data-done])").forEach((img) => {
    img.dataset.done = "1";
    art(img.dataset.art).then((src) => { if (src) { img.src = src; img.classList.add("in"); } }).catch(() => {});
  });
}
new MutationObserver(() => fill()).observe(document.body, { childList: true, subtree: true });
fill();

/* ---------- the hero: a Jumpi next to a treasure chest, coins hopping around ---------- */
const canvas = document.getElementById("stHero");
if (canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60), clock = new THREE.Clock();
  const sun = lights(scene); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
  const plate = new THREE.Group(); scene.add(plate);
  const pm = mesh(new THREE.CylinderGeometry(2.1, 2.02, 0.3, 64), mat("#ffb21f", { roughness: 0.7 }), [0, -0.15, 0], plate); pm.receiveShadow = true;
  const pt = mesh(new THREE.CylinderGeometry(2.06, 2.06, 0.02, 64), mat("#fff1c9", { roughness: 0.85 }), [0, 0.005, 0], plate); pt.receiveShadow = true;
  const ch = chest(plate, 0.55, 0.9); ch.position.set(0.85, 0, -0.35); ch.rotation.y = -0.45;
  stack(plate, -1.35, 0.55, 5); stack(plate, 1.55, 0.75, 3);
  const flyers = [];
  for (let i = 0; i < 9; i++) { const c = coin(scene, 0, 0, 0, Math.PI / 2, 0, 0.9); flyers.push(c); }
  let J = null, hopT = -9;
  BLOBBY.then((b) => { J = blobby(b, "#ff8a1c", "#2a7fff"); J.root.position.set(-0.55, 0, 0.25); J.root.rotation.y = 0.35; J.root.scale.setScalar(0.95); plate.add(J.root); J.headY = J.head.position.y; });
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => { mouse.tx = e.clientX / innerWidth - 0.5; mouse.ty = e.clientY / innerHeight - 0.5; });
  canvas.addEventListener("click", () => { hopT = clock.getElapsedTime(); });
  let vis = true; new IntersectionObserver(([e]) => (vis = e.isIntersecting)).observe(canvas);
  function frame() {
    requestAnimationFrame(frame);
    if (!vis) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * r.getPixelRatio()) || canvas.height !== Math.round(h * r.getPixelRatio())) {
      r.setSize(w, h, false); cam.aspect = w / h; const k = Math.max(1, 1.2 / cam.aspect);
      cam.position.set(0, 3.2, 9.5 * k); cam.lookAt(0, 0.9, 0); cam.updateProjectionMatrix();
    }
    const t = reduce ? 1 : clock.getElapsedTime();
    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
    plate.rotation.y = mouse.x * 0.5 + Math.sin(t * 0.3) * 0.12; plate.rotation.x = mouse.y * 0.12;
    flyers.forEach((c, i) => { const a = (i / flyers.length) * TAU + t * 0.6, y = 1.3 + Math.sin(t * 1.6 + i) * 0.35;
      c.position.set(Math.cos(a) * 2.6, y, Math.sin(a) * 1.3 - 0.3); c.rotation.set(Math.PI / 2, 0, t * 2 + i); });
    if (J) {
      const br = Math.sin(t * 2.1); J.body.scale.set(1 + br * 0.012, 1 + br * 0.018, 1 + br * 0.012); J.head.position.y = J.headY + br * 0.012;
      const k = (t - hopT) / 0.8; J.root.position.y = k >= 0 && k < 1 ? Math.sin(Math.PI * k) * 0.6 : Math.abs(Math.sin(t * 1.4)) * 0.06;
      J.armR.rotation.z = 1.9 + 0.35 * Math.sin(t * 7); J.armL.rotation.z = -br * 0.04;
      const bl = (t * 0.4) % 1 < 0.04; J.eyeL.scale.y = J.eyeR.scale.y = bl ? 0.15 : 1;
    }
    r.render(scene, cam);
  }
  frame();
}
