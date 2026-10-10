/* Store page while the store is closed: a little building site.
   One Jumpi in a hard hat and safety vest hammers a plank, another paints the store sign with a roller. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* ---------- English ⇄ Hebrew (same choice as the rest of the site) ---------- */
{
  const btns = [...document.querySelectorAll(".lang-sw [data-l]")];
  const setLang = (l) => {
    if (l !== "he") l = "en";
    btns.forEach((b) => b.setAttribute("aria-pressed", b.dataset.l === l));
    document.documentElement.lang = l; document.documentElement.dir = l === "he" ? "rtl" : "ltr";
    document.querySelectorAll("[data-en]").forEach((el) => (el.textContent = l === "he" ? el.dataset.he : el.dataset.en));
    try { localStorage.setItem("jumpi-lang", l); } catch (e) {}
  };
  btns.forEach((b) => (b.onclick = () => setLang(b.dataset.l)));
  let start = "en";
  try { start = new URLSearchParams(location.search).get("lang") || localStorage.getItem("jumpi-lang") || "en"; } catch (e) {}
  setLang(start);
}

const reduce = (window.JUMPI_REDUCE_MOTION || matchMedia("(prefers-reduced-motion: reduce)").matches);
const canvas = document.getElementById("rnCanvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 80), clock = new THREE.Clock();
scene.add(new THREE.HemisphereLight(0xffffff, 0xd9b77a, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(3, 8, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 25 });
scene.add(sun);

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o });
function mesh(geo, m, pos, parent, rot) {
  const x = new THREE.Mesh(geo, m); if (pos) x.position.set(...pos); if (rot) x.rotation.set(...rot);
  x.castShadow = true; x.receiveShadow = true; parent.add(x); return x;
}
function canvasTex(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const hazard = canvasTex(256, 64, (x, w, h) => { x.fillStyle = "#ffd23a"; x.fillRect(0, 0, w, h); x.fillStyle = "#1d1d24";
  for (let i = -h; i < w + h; i += 48) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + 24, h); x.lineTo(i + 24 + h, 0); x.lineTo(i + h, 0); x.fill(); } });
const WOOD = mat("#d9a066", { roughness: 0.8 }), WOOD2 = mat("#b97c40", { roughness: 0.8 }), STEEL = mat("#8a93a3", { metalness: 0.6, roughness: 0.35 });
const ORANGE = mat("#ff6a1f", { roughness: 0.5 }), WHITE = mat("#ffffff", { roughness: 0.5 }), YELLOW = mat("#ffd23a", { roughness: 0.35 });

/* ---------- the building-site platform ---------- */
const plate = new THREE.Group(); scene.add(plate);
mesh(new THREE.CylinderGeometry(2.75, 2.65, 0.3, 64), mat("#ff9a1f", { roughness: 0.7 }), [0, -0.15, 0], plate);
mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.02, 64), mat("#efd9a8", { roughness: 0.95 }), [0, 0.005, 0], plate);

function cone(x, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); plate.add(g);
  mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), ORANGE, [0, 0.03, 0], g);
  mesh(new THREE.ConeGeometry(0.2, 0.62, 28), ORANGE, [0, 0.37, 0], g);
  mesh(new THREE.CylinderGeometry(0.135, 0.162, 0.1, 28, 1, true), WHITE, [0, 0.33, 0], g);
  mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.07, 28, 1, true), WHITE, [0, 0.52, 0], g);
}
cone(-2.05, 1.1); cone(2.15, 0.9, 0.9); cone(-0.2, 2.25, 0.85);

// bricks
const BRICK = mat("#d8573a", { roughness: 0.85 });
for (let r = 0; r < 4; r++) for (let i = 0; i < 4 - r; i++)
  mesh(new THREE.BoxGeometry(0.36, 0.16, 0.2), BRICK, [-1.95 + i * 0.38 + r * 0.19, 0.08 + r * 0.165, -0.75], plate, [0, (i % 2) * 0.04 - 0.02, 0]);

// striped barrier at the back
{
  const g = new THREE.Group(); g.position.set(-1.0, 0, -1.75); g.rotation.y = 0.25; plate.add(g);
  [-0.7, 0.7].forEach((x) => { mesh(new THREE.BoxGeometry(0.07, 0.75, 0.07), WHITE, [x, 0.375, 0], g); mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), STEEL, [x, 0.025, 0], g); });
  mesh(new THREE.BoxGeometry(1.7, 0.22, 0.05), new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.5 }), [0, 0.6, 0.04], g);
}

// sawhorse with the plank being hammered
const saw = new THREE.Group(); saw.position.set(-0.05, 0, 0.75); saw.rotation.y = -0.95; plate.add(saw);
[-0.45, 0.45].forEach((x) => [-1, 1].forEach((s) => mesh(new THREE.BoxGeometry(0.06, 0.62, 0.06), WOOD2, [x, 0.29, s * 0.13], saw, [s * 0.4, 0, 0])));
mesh(new THREE.BoxGeometry(1.1, 0.07, 0.1), WOOD2, [0, 0.58, 0], saw);
const plank = mesh(new THREE.BoxGeometry(1.5, 0.07, 0.36), WOOD, [0, 0.65, 0], saw);
const nail = mesh(new THREE.CylinderGeometry(0.025, 0.012, 0.1, 10), STEEL, [0.08, 0.71, 0.02], saw);
mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 14), STEEL, [0, 0.05, 0], nail);

/* ---------- scaffolding with the store sign ---------- */
const scaf = new THREE.Group(); scaf.position.set(0.85, 0, -1.15); scaf.rotation.y = -0.18; plate.add(scaf);
const pipe = (a, b) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), m = mesh(new THREE.CylinderGeometry(0.035, 0.035, A.distanceTo(B), 10), STEEL, null, scaf);
  m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); };
[-1.1, 1.1].forEach((x) => [-0.3, 0.3].forEach((z) => pipe([x, 0, z], [x, 3.45, z])));
[0.95, 2.6].forEach((y) => { pipe([-1.1, y, 0.3], [1.1, y, 0.3]); pipe([-1.1, y, -0.3], [1.1, y, -0.3]); });
pipe([-1.1, 0.1, 0.3], [1.1, 0.92, 0.3]);
mesh(new THREE.BoxGeometry(2.3, 0.06, 0.62), WOOD, [0, 0.98, 0], scaf);
// the sign: "JUMPI STORE", half of it already painted
const signTex = canvasTex(1024, 300, (x, w, h) => {
  x.fillStyle = "#fff6e0"; x.fillRect(0, 0, w, h);
  x.font = '190px "Lilita One", "Arial Rounded MT Bold", sans-serif'; x.textAlign = "center"; x.textBaseline = "middle";
  x.lineWidth = 22; x.strokeStyle = "#1d2b4f"; x.strokeText("STORE", w / 2, h / 2 + 10);
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#ffc04d"); g.addColorStop(1, "#ff7a1a"); x.fillStyle = g; x.fillText("STORE", w / 2, h / 2 + 10);
});
const signGroup = new THREE.Group(); signGroup.position.set(0, 3.05, 0.36); scaf.add(signGroup);
mesh(new THREE.BoxGeometry(2.05, 0.66, 0.08), WOOD2, [0, 0, -0.02], signGroup);
const signFace = mesh(new THREE.PlaneGeometry(1.9, 0.56), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6 }), [0, 0, 0.025], signGroup);
// fresh paint still to do: a blank cover that the roller "paints away"
const cover = mesh(new THREE.PlaneGeometry(1, 0.56), mat("#fff6e0", { roughness: 0.7 }), [0, 0, 0.03], signGroup);
cover.geometry.translate(-0.5, 0, 0);   // anchored on its right edge
cover.position.x = 0.95;
// paint bucket
{
  const b = new THREE.Group(); b.position.set(1.75, 0, -0.1); plate.add(b);
  mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.34, 24, 1, true), mat("#e9eef5", { metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide }), [0, 0.17, 0], b);
  mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 24), mat("#ff7a1a", { roughness: 0.3 }), [0, 0.3, 0], b);
  mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 24), mat("#c9d3e3"), [0, 0.01, 0], b);
  const drip = mesh(new THREE.SphereGeometry(0.05, 12, 8), mat("#ff7a1a", { roughness: 0.3 }), [0.2, 0.26, 0], b); drip.scale.set(0.5, 1.4, 0.5);
}

/* ---------- the builders ---------- */
const BLOBBY = new Promise((res, rej) => new GLTFLoader().load("/blobby.glb", (g) => res(g.scene), undefined, rej));
function jumpi(base, skin, eye) {
  const root = base.clone(true);
  root.traverse((o) => {
    if (!o.isMesh) return; o.castShadow = true;
    o.material = [].concat(o.material).map((m) => {
      if (m.name === "Skin") { m = m.clone(); m.color.set(skin); }
      else if (m.name === "Iris") { m = m.clone(); m.color.set(eye); }
      else if (m.name === "Mouth") { m = m.clone(); const c = new THREE.Color(skin), h = {}; c.getHSL(h); m.color.setHSL(h.h, Math.min(1, h.s * 0.9), h.l * 0.22); }
      return m;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  const J = { root, body: root.getObjectByName("Body"), head: root.getObjectByName("Head"), armL: root.getObjectByName("ArmL"), armR: root.getObjectByName("ArmR"), eyeL: root.getObjectByName("EyeL"), eyeR: root.getObjectByName("EyeR") };
  J.headY = J.head.position.y;
  // hard hat
  const hat = new THREE.Group(); J.head.add(hat);
  const dome = mesh(new THREE.SphereGeometry(1, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2), YELLOW, [0, 0.6, 0], hat); dome.scale.set(0.74, 0.55, 0.64);
  const brim = mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.045, 48), YELLOW, [0, 0.62, 0.05], hat); brim.scale.z = 0.86;
  const ridge = mesh(new THREE.TorusGeometry(0.5, 0.05, 10, 40, Math.PI), mat("#ffbf1a", { roughness: 0.35 }), [0, 0.6, 0], hat, [0, Math.PI / 2, 0]); ridge.scale.set(1.1, 1.1, 1.25);
  // safety vest with shiny stripes
  const vest = mesh(new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0.95, 0.95), mat("#ff7a1a", { roughness: 0.6, side: THREE.DoubleSide }), [0, 0.52, 0], J.body);
  vest.scale.set(0.4, 0.485, 0.35);
  [0.42, 0.62].forEach((y) => { const s = mesh(new THREE.CylinderGeometry(1, 1, 0.045, 48, 1, true), mat("#e9eef5", { metalness: 0.5, roughness: 0.2, emissive: "#ffffff", emissiveIntensity: 0.15, side: THREE.DoubleSide }), [0, y, 0], J.body);
    const r = y === 0.42 ? 1.0 : 0.985; s.scale.set(0.4 * r * 1.002, 1, 0.35 * r * 1.002); });
  return J;
}
let A = null, B = null, hammer = null, roller = null, hopA = -9, hopB = -9;
const dust = [];
for (let i = 0; i < 10; i++) { const d = mesh(new THREE.SphereGeometry(0.05, 8, 6), mat("#e6d2a8", { roughness: 1, transparent: true, opacity: 0.9 }), [0, -5, 0], plate); d.castShadow = false; dust.push({ m: d, v: new THREE.Vector3(), t: 9 }); }
BLOBBY.then((base) => {
  // the hammering builder
  A = jumpi(base, "#ff8a1c", "#2a7fff"); A.root.position.set(-0.95, 0, 0.15); A.root.rotation.y = 0.98; plate.add(A.root);
  hammer = new THREE.Group(); hammer.position.set(0, -0.4, 0.02); A.armR.add(hammer);
  mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.5, 12), mat("#a0602f", { roughness: 0.7 }), [0, -0.18, 0], hammer);
  mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), STEEL, [0, -0.42, 0.05], hammer);
  // the painter, on the scaffold
  B = jumpi(base, "#1fb6ff", "#7a3e12"); B.root.scale.setScalar(0.82); B.root.position.set(0.42, 1.01, 0.12); B.root.rotation.y = -0.2; scaf.add(B.root);
  roller = new THREE.Group(); roller.position.set(0, -0.4, 0); B.armR.add(roller);
  mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.25, 10), mat("#2a2d36"), [0, -0.55, 0], roller);
  const head = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.36, 18), mat("#ff7a1a", { roughness: 0.9 }), [0, -1.2, 0.08], roller, [0, 0, Math.PI / 2]);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), mat("#2a2d36"), [0, -1.16, 0.03], roller, [Math.PI / 2, 0, 0]);
  void head;
});

/* ---------- moving about ---------- */
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener("pointermove", (e) => { mouse.tx = e.clientX / innerWidth - 0.5; mouse.ty = e.clientY / innerHeight - 0.5; });
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
canvas.addEventListener("click", (e) => {
  const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
  const t = clock.getElapsedTime();
  if (B && ray.intersectObject(B.root, true).length) hopB = t; else hopA = t;
});
let vis = true; new IntersectionObserver(([e]) => (vis = e.isIntersecting)).observe(canvas);
let lastHit = -1;
const tmp = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  if (!vis) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false); cam.aspect = w / h; const k = Math.max(1, 1.25 / cam.aspect);
    cam.position.set(0, 3.7, 9.6 * k); cam.lookAt(0, 1.35, 0); cam.updateProjectionMatrix();
  }
  const t = reduce ? 1.2 : clock.getElapsedTime();
  mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
  plate.rotation.y = -0.15 + mouse.x * 0.45 + Math.sin(t * 0.25) * 0.1; plate.rotation.x = mouse.y * 0.1;
  const breathe = (J, ph) => { const br = Math.sin(t * 2.1 + ph); J.body.scale.set(1 + br * 0.012, 1 + br * 0.018, 1 + br * 0.012); J.head.position.y = J.headY + br * 0.012;
    const bl = ((t + ph) * 0.37) % 1 < 0.035; J.eyeL.scale.y = J.eyeR.scale.y = bl ? 0.15 : 1; };
  if (A) {
    breathe(A, 0);
    // hammer: lift slowly, bang down fast
    const c = (t * 1.25) % 1, swing = c < 0.72 ? c / 0.72 : 1 - (c - 0.72) / 0.28;
    A.armR.rotation.x = -0.75 - swing * 1.25; A.armR.rotation.z = 0.12;
    A.armL.rotation.x = -0.6; A.armL.rotation.z = -0.15;
    A.head.rotation.x = 0.18;
    const k = (t - hopA) / 0.8; A.root.position.y = k >= 0 && k < 1 ? Math.sin(Math.PI * k) * 0.7 : 0;
    const beat = Math.floor(t * 1.25);
    if (!reduce && c > 0.97 && beat !== lastHit && !(k >= 0 && k < 1)) {
      lastHit = beat; nail.position.y = Math.max(0.67, nail.position.y - 0.006); if (nail.position.y <= 0.67) nail.position.y = 0.71;
      nail.getWorldPosition(tmp); plate.worldToLocal(tmp);
      dust.forEach((d, i) => { d.t = 0; d.m.position.copy(tmp); const a = (i / dust.length) * Math.PI * 2; d.v.set(Math.cos(a) * 0.9, 1.1 + (i % 3) * 0.35, Math.sin(a) * 0.9); });
    }
  }
  dust.forEach((d) => { if (d.t > 0.7) { d.m.position.y = -5; return; } d.t += 1 / 60; d.v.y -= 4 / 60; d.m.position.addScaledVector(d.v, 1 / 60); d.m.scale.setScalar(1 - d.t / 0.7); });
  if (B) {
    breathe(B, 1.3);
    // rolling paint up and down the sign; the unpainted part shrinks, then the sign gets "freshened" again
    const r = Math.sin(t * 2.6);
    B.armR.rotation.x = -2.75 + r * 0.12; B.armR.rotation.z = 0.05 + Math.sin(t * 0.9) * 0.18;
    B.armL.rotation.z = -0.25 + Math.sin(t * 1.3) * 0.05;
    B.head.rotation.x = -0.25;
    const k = (t - hopB) / 0.8; B.root.position.y = 1.01 + (k >= 0 && k < 1 ? Math.sin(Math.PI * k) * 0.5 : 0);
    const p = reduce ? 0.5 : ((t * 0.07) % 1);
    cover.scale.x = Math.max(0.0001, 1 - Math.min(1, p * 1.3));
  }
  renderer.render(scene, cam);
}
frame();
