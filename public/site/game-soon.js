/* The game before the grand opening: a countdown to LAUNCH_AT and a little 3D building site.
   A crane lifts the Jumpi sign into place, one builder hammers, one carries boxes, one waves at you. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { LAUNCH_AT } from "/shared/launch.js";

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

/* ---------- the countdown (the server's clock, so a wrong computer clock doesn't matter) ---------- */
let off = 0;
fetch(location.pathname, { method: "HEAD", cache: "no-store" }).then((r) => { const d = Date.parse(r.headers.get("date")); if (d) off = d + 400 - Date.now(); }).catch(() => {});
const el = { d: document.getElementById("gsD"), h: document.getElementById("gsH"), m: document.getElementById("gsM"), s: document.getElementById("gsS") };
const pad = (n) => String(n).padStart(2, "0");
let opened = false;
function tick() {
  const left = Math.max(0, LAUNCH_AT - (Date.now() + off)), s = Math.floor(left / 1000);
  const v = { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
  for (const k in v) { const t = pad(v[k]); if (el[k].textContent !== t) { el[k].textContent = t; el[k].classList.remove("tick"); void el[k].offsetWidth; el[k].classList.add("tick"); } }
  if (left <= 0 && !opened) { opened = true; document.getElementById("gsOpen").hidden = false; setTimeout(() => location.reload(), 2500); }
}
tick(); setInterval(tick, 250);

/* ---------- the 3D building site ---------- */
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("gsCanvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 80), clock = new THREE.Clock();
scene.add(new THREE.HemisphereLight(0xfff0e6, 0x8a6aa0, 1.7));
const sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
sun.position.set(-4, 7, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 6, bottom: -5, near: 1, far: 25 });
scene.add(sun);
const rim = new THREE.DirectionalLight(0xff9ad0, 0.9); rim.position.set(5, 3, -6); scene.add(rim);

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
const ORANGE = mat("#ff6a1f", { roughness: 0.5 }), WHITE = mat("#ffffff", { roughness: 0.5 }), YELLOW = mat("#ffd23a", { roughness: 0.35 }), CRANE = mat("#ffc21a", { roughness: 0.4 });

// a little grassy island with a paved Plaza in the middle
const plate = new THREE.Group(); scene.add(plate);
mesh(new THREE.CylinderGeometry(3.3, 2.7, 0.8, 64), mat("#b5784a", { roughness: 0.95 }), [0, -0.4, 0], plate);
mesh(new THREE.CylinderGeometry(3.35, 3.35, 0.14, 64), mat("#6fcf5b", { roughness: 0.95 }), [0, -0.05, 0], plate);
const paveTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = "#efe4cf"; x.fillRect(0, 0, w, h); x.strokeStyle = "#d8c8a8"; x.lineWidth = 4;
  for (let r = 20; r < 128; r += 22) { x.beginPath(); x.arc(128, 128, r, 0, 7); x.stroke(); } for (let a = 0; a < 16; a++) { x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.cos(a / 16 * 6.283) * 128, 128 + Math.sin(a / 16 * 6.283) * 128); x.stroke(); } });
mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.03, 64), new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.9 }), [0.2, 0.03, 0.3], plate);
// a half-built fountain with a little scaffold
{ const f = new THREE.Group(); f.position.set(0.35, 0, 0.35); plate.add(f);
  mesh(new THREE.TorusGeometry(0.62, 0.12, 12, 40), mat("#e9e2d6"), [0, 0.12, 0], f, [Math.PI / 2, 0, 0]);
  mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 32), mat("#5fd0ff", { roughness: 0.1, metalness: 0.1, emissive: "#1a6a9a", emissiveIntensity: 0.25 }), [0, 0.1, 0], f);
  mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 16), mat("#e9e2d6"), [0, 0.42, 0], f); }
function cone(x, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0.02, z); g.scale.setScalar(s); plate.add(g);
  mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), ORANGE, [0, 0.03, 0], g);
  mesh(new THREE.ConeGeometry(0.2, 0.62, 28), ORANGE, [0, 0.37, 0], g);
  mesh(new THREE.CylinderGeometry(0.135, 0.162, 0.1, 28, 1, true), WHITE, [0, 0.33, 0], g);
}
cone(-2.5, 1.2); cone(2.6, 1.1, 0.9); cone(-0.6, 2.7, 0.8); cone(1.4, 2.5, 0.85);
// a striped barrier with balloons tied to it
const balloons = [];
{ const g = new THREE.Group(); g.position.set(-1.8, 0, -1.6); g.rotation.y = 0.5; plate.add(g);
  [-0.7, 0.7].forEach((x) => { mesh(new THREE.BoxGeometry(0.07, 0.75, 0.07), WHITE, [x, 0.375, 0], g); mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), STEEL, [x, 0.025, 0], g); });
  mesh(new THREE.BoxGeometry(1.7, 0.22, 0.05), new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.5 }), [0, 0.6, 0.04], g);
  ["#ff5fa8", "#ffd23a", "#1fb6ff", "#2fd36b"].forEach((c, i) => { const b = new THREE.Group(); b.position.set(-0.7 + (i % 2) * 0.12, 0.75, 0); g.add(b);
    const ball = mesh(new THREE.SphereGeometry(0.2, 20, 14), mat(c, { roughness: 0.25 }), [0, 1.1 + i * 0.18, 0], b); ball.scale.y = 1.15;
    const str = mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.1 + i * 0.18, 4), WHITE, [0, (1.1 + i * 0.18) / 2, 0], b); str.castShadow = false;
    balloons.push({ b, ph: i * 1.7, x: (i - 1.5) * 0.18 }); }); }
// sawhorse and a plank being hammered
const saw = new THREE.Group(); saw.position.set(-1.2, 0.02, 1.15); saw.rotation.y = -0.7; plate.add(saw);
[-0.45, 0.45].forEach((x) => [-1, 1].forEach((s) => mesh(new THREE.BoxGeometry(0.06, 0.62, 0.06), WOOD2, [x, 0.29, s * 0.13], saw, [s * 0.4, 0, 0])));
mesh(new THREE.BoxGeometry(1.1, 0.07, 0.1), WOOD2, [0, 0.58, 0], saw);
mesh(new THREE.BoxGeometry(1.5, 0.07, 0.36), WOOD, [0, 0.65, 0], saw);
const nail = mesh(new THREE.CylinderGeometry(0.025, 0.012, 0.1, 10), STEEL, [0.08, 0.71, 0.02], saw);
// a stack of boxes and the one being carried
const BOX = mat("#c9905a", { roughness: 0.85 }), TAPE = mat("#ffd23a");
const boxAt = (x, y, z, r, p) => { const b = new THREE.Group(); b.position.set(x, y, z); b.rotation.y = r; p.add(b); mesh(new THREE.BoxGeometry(0.42, 0.34, 0.42), BOX, [0, 0.17, 0], b); mesh(new THREE.BoxGeometry(0.43, 0.02, 0.1), TAPE, [0, 0.345, 0], b); return b; };
boxAt(2.2, 0.02, -0.4, 0.2, plate); boxAt(2.55, 0.02, 0.05, -0.3, plate); boxAt(2.35, 0.36, -0.2, 0.5, plate);

/* ---------- the crane with the Jumpi sign ---------- */
const crane = new THREE.Group(); crane.position.set(1.6, 0, -1.7); crane.rotation.y = -0.35; plate.add(crane);
const lattice = (h) => { const g = new THREE.Group(); [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]].forEach(([x, z]) => mesh(new THREE.BoxGeometry(0.05, h, 0.05), CRANE, [x, h / 2, z], g));
  for (let y = 0.3; y < h; y += 0.35) { mesh(new THREE.BoxGeometry(0.34, 0.03, 0.03), CRANE, [0, y, 0.16], g); mesh(new THREE.BoxGeometry(0.34, 0.03, 0.03), CRANE, [0, y, -0.16], g); mesh(new THREE.BoxGeometry(0.03, 0.03, 0.34), CRANE, [0.16, y, 0], g); mesh(new THREE.BoxGeometry(0.03, 0.03, 0.34), CRANE, [-0.16, y, 0], g); } return g; };
mesh(new THREE.BoxGeometry(0.8, 0.2, 0.8), mat("#3a4256"), [0, 0.1, 0], crane);
crane.add(lattice(4.2));
const top = new THREE.Group(); top.position.y = 4.2; crane.add(top);
mesh(new THREE.BoxGeometry(0.5, 0.4, 0.45), mat("#3a4256"), [0, 0.2, 0], top);
mesh(new THREE.BoxGeometry(3.4, 0.16, 0.22), CRANE, [-1.2, 0.45, 0], top);
mesh(new THREE.BoxGeometry(0.9, 0.16, 0.22), CRANE, [0.75, 0.45, 0], top);
mesh(new THREE.BoxGeometry(0.4, 0.38, 0.4), mat("#8a93a3"), [1.05, 0.3, 0], top);   // counterweight
const trolley = new THREE.Group(); trolley.position.set(-2.4, 0.36, 0); top.add(trolley);
mesh(new THREE.BoxGeometry(0.22, 0.1, 0.26), mat("#3a4256"), [0, 0, 0], trolley);
const cable = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), mat("#2a2d36"), [0, 0, 0], trolley); cable.castShadow = false;
const hook = new THREE.Group(); trolley.add(hook);
mesh(new THREE.TorusGeometry(0.06, 0.02, 8, 16, Math.PI * 1.4), STEEL, [0, -0.04, 0], hook);
// the sign: the Jumpi logo on a wooden board, hanging from two ropes
const sign = new THREE.Group(); hook.add(sign);
const logoTex = new THREE.TextureLoader().load("/jumpi-logo.png"); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 4;
mesh(new THREE.BoxGeometry(1.7, 1.02, 0.08), WOOD2, [0, -0.85, 0], sign);
const face = mesh(new THREE.PlaneGeometry(1.56, 0.9), new THREE.MeshStandardMaterial({ color: "#fff6e0", roughness: 0.7 }), [0, -0.85, 0.045], sign);
const logo = mesh(new THREE.PlaneGeometry(1.4, 0.82), new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: 0.6 }), [0, -0.85, 0.05], sign); logo.castShadow = false;
[-0.6, 0.6].forEach((x) => { const r = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.62, 5), mat("#2a2d36"), [x * 0.5, -0.18, 0], sign, [0, 0, x > 0 ? -0.75 : 0.75]); r.castShadow = false; });
void face;

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
  const hat = new THREE.Group(); J.head.add(hat);
  const dome = mesh(new THREE.SphereGeometry(1, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2), YELLOW, [0, 0.6, 0], hat); dome.scale.set(0.74, 0.55, 0.64);
  const brim = mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.045, 48), YELLOW, [0, 0.62, 0.05], hat); brim.scale.z = 0.86;
  const vest = mesh(new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0.95, 0.95), mat("#ff7a1a", { roughness: 0.6, side: THREE.DoubleSide }), [0, 0.52, 0], J.body);
  vest.scale.set(0.4, 0.485, 0.35);
  [0.42, 0.62].forEach((y) => { const s = mesh(new THREE.CylinderGeometry(1, 1, 0.045, 48, 1, true), mat("#e9eef5", { metalness: 0.5, roughness: 0.2, emissive: "#ffffff", emissiveIntensity: 0.15, side: THREE.DoubleSide }), [0, y, 0], J.body);
    const r = y === 0.42 ? 1.0 : 0.985; s.scale.set(0.4 * r * 1.002, 1, 0.35 * r * 1.002); });
  return J;
}
let A = null, B = null, C = null, hammer = null, carried = null;
const hop = { A: -9, B: -9, C: -9 };
const dust = [];
for (let i = 0; i < 10; i++) { const d = mesh(new THREE.SphereGeometry(0.05, 8, 6), mat("#e6d2a8", { roughness: 1, transparent: true, opacity: 0.9 }), [0, -5, 0], plate); d.castShadow = false; dust.push({ m: d, v: new THREE.Vector3(), t: 9 }); }
BLOBBY.then((base) => {
  A = jumpi(base, "#ff8a1c", "#2a7fff"); A.root.scale.setScalar(0.85); A.root.position.set(-2.0, 0.02, 0.6); A.root.rotation.y = 0.9; plate.add(A.root);
  hammer = new THREE.Group(); hammer.position.set(0, -0.4, 0.02); A.armR.add(hammer);
  mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.5, 12), mat("#a0602f", { roughness: 0.7 }), [0, -0.18, 0], hammer);
  mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), STEEL, [0, -0.42, 0.05], hammer);
  B = jumpi(base, "#2fd36b", "#7a3e12"); B.root.scale.setScalar(0.8); plate.add(B.root);
  carried = boxAt(0, 0, 0, 0, B.root); carried.position.set(0, 0.95, 0.55); carried.scale.setScalar(1.2);
  C = jumpi(base, "#ff5fa8", "#2a2d36"); C.root.scale.setScalar(0.85); C.root.position.set(0.9, 0.02, 1.6); C.root.rotation.y = 0.15; plate.add(C.root);
});

/* ---------- moving about ---------- */
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener("pointermove", (e) => { mouse.tx = e.clientX / innerWidth - 0.5; mouse.ty = e.clientY / innerHeight - 0.5; });
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
canvas.addEventListener("click", (e) => {
  const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
  const t = clock.getElapsedTime();
  if (B && ray.intersectObject(B.root, true).length) hop.B = t; else if (C && ray.intersectObject(C.root, true).length) hop.C = t; else hop.A = t;
});
let vis = true; new IntersectionObserver(([e]) => (vis = e.isIntersecting)).observe(canvas);
let lastHit = -1;
const tmp = new THREE.Vector3();
const hopY = (k, h) => (k >= 0 && k < 1 ? Math.sin(Math.PI * k) * h : 0);
function frame() {
  requestAnimationFrame(frame);
  if (!vis) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false); cam.aspect = w / h; const k = Math.max(1, 1.2 / cam.aspect);
    cam.position.set(0, 4.4, 12 * k); cam.lookAt(0, 1.75, 0); cam.updateProjectionMatrix();
  }
  const t = reduce ? 1.2 : clock.getElapsedTime();
  mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
  plate.rotation.y = -0.2 + mouse.x * 0.45 + Math.sin(t * 0.22) * 0.12; plate.rotation.x = mouse.y * 0.08;
  // the crane: the trolley slides out and back, the sign goes down and up, swinging a little
  const cy = (t * 0.12) % 1, along = Math.sin(cy * Math.PI * 2) * 0.5 + 0.5;
  trolley.position.x = -2.6 + along * 0.9;
  const drop = 1.3 + (0.5 + 0.5 * Math.sin(t * 0.55)) * 1.1;
  hook.position.y = -drop; cable.scale.y = drop; cable.position.y = -drop / 2;
  hook.rotation.z = Math.sin(t * 1.3) * 0.06; hook.rotation.y = Math.sin(t * 0.7) * 0.25;
  balloons.forEach((q) => { q.b.rotation.z = Math.sin(t * 1.1 + q.ph) * 0.12 + q.x * 0.6; q.b.rotation.x = Math.cos(t * 0.9 + q.ph) * 0.08; });
  const breathe = (J, ph) => { const br = Math.sin(t * 2.1 + ph); J.body.scale.set(1 + br * 0.012, 1 + br * 0.018, 1 + br * 0.012); J.head.position.y = J.headY + br * 0.012;
    const bl = ((t + ph) * 0.37) % 1 < 0.035; J.eyeL.scale.y = J.eyeR.scale.y = bl ? 0.15 : 1; };
  if (A) {
    breathe(A, 0);
    const c = (t * 1.25) % 1, swing = c < 0.72 ? c / 0.72 : 1 - (c - 0.72) / 0.28;
    A.armR.rotation.x = -0.75 - swing * 1.25; A.armR.rotation.z = 0.12; A.armL.rotation.x = -0.6; A.armL.rotation.z = -0.15; A.head.rotation.x = 0.18;
    const k = (t - hop.A) / 0.8; A.root.position.y = 0.02 + hopY(k, 0.7);
    const beat = Math.floor(t * 1.25);
    if (!reduce && c > 0.97 && beat !== lastHit && !(k >= 0 && k < 1)) {
      lastHit = beat; nail.getWorldPosition(tmp); plate.worldToLocal(tmp);
      dust.forEach((d, i) => { d.t = 0; d.m.position.copy(tmp); const a = (i / dust.length) * Math.PI * 2; d.v.set(Math.cos(a) * 0.9, 1.1 + (i % 3) * 0.35, Math.sin(a) * 0.9); });
    }
  }
  dust.forEach((d) => { if (d.t > 0.7) { d.m.position.y = -5; return; } d.t += 1 / 60; d.v.y -= 4 / 60; d.m.position.addScaledVector(d.v, 1 / 60); d.m.scale.setScalar(1 - d.t / 0.7); });
  if (B) {
    // carrying a box back and forth between the stack and the fountain
    breathe(B, 1.3);
    const p = (t * 0.09) % 1, go = p < 0.5, u = go ? p * 2 : 2 - p * 2, s = u * u * (3 - 2 * u);
    const x0 = 1.9, z0 = 0.5, x1 = -0.2, z1 = -0.9, x = x0 + (x1 - x0) * s, z = z0 + (z1 - z0) * s;
    const walking = u > 0.02 && u < 0.98, ph = t * 9;
    B.root.position.set(x, 0.02 + (walking ? Math.abs(Math.sin(ph)) * 0.05 : 0) + hopY((t - hop.B) / 0.8, 0.6), z);
    B.root.rotation.y = Math.atan2(go ? x1 - x0 : x0 - x1, go ? z1 - z0 : z0 - z1); B.root.rotation.z = walking ? Math.sin(ph) * 0.05 : 0;
    B.armL.rotation.set(-1.3, 0, -0.25); B.armR.rotation.set(-1.3, 0, 0.25);
    carried.visible = go;
  }
  if (C) {
    // waving at you
    breathe(C, 2.6);
    const wv = (t * 0.6) % 1 < 0.45;
    C.armR.rotation.set(0, 0, wv ? 2.4 + Math.sin(t * 12) * 0.35 : 0.1); C.armL.rotation.set(0, 0, -0.1);
    C.root.position.y = 0.02 + hopY((t - hop.C) / 0.8, 0.7);
    C.head.rotation.y = mouse.x * 0.5;
  }
  renderer.render(scene, cam);
}
frame();
