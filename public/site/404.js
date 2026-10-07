/* Page not found: a Jumpi lost on a little floating island, next to giant 404 numbers.
   It looks left and right, turns its map round, scratches its head; question marks float above it. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// show which address they tried (as text, never as HTML)
{
  const p = location.pathname + location.search;
  if (p && p !== "/") { const el = document.getElementById("nfPath"); el.querySelector("code").textContent = p.length > 80 ? p.slice(0, 77) + "…" : p; el.hidden = false; }
}

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("nfCanvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 80), clock = new THREE.Clock();
scene.add(new THREE.HemisphereLight(0xffffff, 0x8fbfe0, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(4, 8, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25 });
scene.add(sun);

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });
function mesh(geo, m, pos, parent, rot) {
  const x = new THREE.Mesh(geo, m); if (pos) x.position.set(...pos); if (rot) x.rotation.set(...rot);
  x.castShadow = true; x.receiveShadow = true; parent.add(x); return x;
}
function canvasTex(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

const world = new THREE.Group(); scene.add(world);

/* ---------- the floating island ---------- */
const island = new THREE.Group(); world.add(island);
{
  // grass top with a soft edge, a chunky dirt underside
  mesh(new THREE.CylinderGeometry(3.3, 3.2, 0.32, 64), mat("#5fd36b", { roughness: 0.8 }), [0, -0.16, 0], island);
  mesh(new THREE.CylinderGeometry(3.36, 3.3, 0.12, 64), mat("#47b856", { roughness: 0.8 }), [0, -0.3, 0], island);
  const dirt = mesh(new THREE.ConeGeometry(3.25, 2.1, 9, 3), mat("#b9773f", { roughness: 0.95, flatShading: true }), [0, -1.4, 0], island, [Math.PI, 0, 0]);
  const p = dirt.geometry.attributes.position, R = (i) => Math.sin(i * 12.9898) * 43758.5453 % 1;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.9) { p.setX(i, p.getX(i) * (0.9 + Math.abs(R(i)) * 0.2)); p.setZ(i, p.getZ(i) * (0.9 + Math.abs(R(i + 7)) * 0.2)); }
  dirt.geometry.computeVertexNormals();
  [[-1.2, -1.0, 0.5], [1.5, -0.8, 0.35], [0.3, -1.7, 0.3]].forEach(([x, y, s]) => mesh(new THREE.DodecahedronGeometry(s, 0), mat("#9a6233", { roughness: 1, flatShading: true }), [x, y - 0.6, 0.6], island));
  // little flowers and tufts
  const petal = mat("#ff7fbf"), petal2 = mat("#ffd23a"), stem = mat("#2f9a43");
  [[-2.5, 0.9], [2.4, 1.4], [-1.6, 2.3], [2.8, -0.6], [-2.8, -0.4], [0.9, 2.6]].forEach(([x, z], i) => {
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), stem, [x, 0.11, z], island);
    const m = i % 2 ? petal : petal2;
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; mesh(new THREE.SphereGeometry(0.06, 10, 8), m, [x + Math.cos(a) * 0.07, 0.24, z + Math.sin(a) * 0.07], island); }
    mesh(new THREE.SphereGeometry(0.045, 10, 8), mat("#ffffff"), [x, 0.25, z], island);
  });
  // footprints wandering in circles (Jumpi has been going round and round)
  const step = mat("#3f9a4a", { roughness: 1 });
  for (let i = 0; i < 16; i++) { const a = i * 0.42 + 0.6, r = 1.75 - i * 0.025, s = i % 2 ? 0.07 : -0.07;
    const f = mesh(new THREE.CircleGeometry(0.075, 14), step, [Math.cos(a) * (r + s), 0.012, Math.sin(a) * (r + s) + 0.6], island, [-Math.PI / 2, 0, -a]); f.scale.set(1, 1.5, 1); f.castShadow = false; }
}

/* ---------- giant 404 ---------- */
const digits = new THREE.Group(); digits.position.set(0, 0, -1.75); digits.scale.setScalar(1.4); world.add(digits);
function rrect(x, y, w, h, r) { const s = new THREE.Shape(); s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
const EXT = { depth: 0.42, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 4, curveSegments: 20 };
function four(color, edge) {
  const g = new THREE.Group(), m = mat(color, { roughness: 0.35 }), e = mat(edge, { roughness: 0.5 });
  [rrect(0, 0.62, 0.36, 1.08, 0.12), rrect(0, 0.55, 1.3, 0.36, 0.12), rrect(0.78, 0, 0.36, 1.7, 0.12)].forEach((s) => {
    const x = new THREE.Mesh(new THREE.ExtrudeGeometry(s, EXT), [m, e]); x.castShadow = x.receiveShadow = true; g.add(x); });
  return g;
}
function zero(color, edge) {
  const s = rrect(0, 0, 1.25, 1.7, 0.55); s.holes.push(rrect(0.36, 0.38, 0.53, 0.94, 0.24));
  const x = new THREE.Mesh(new THREE.ExtrudeGeometry(s, EXT), [mat(color, { roughness: 0.35 }), mat(edge, { roughness: 0.5 })]); x.castShadow = x.receiveShadow = true;
  const g = new THREE.Group(); g.add(x); return g;
}
const D = [four("#ff9a1f", "#c75e00"), zero("#1fb6ff", "#0b72c9"), four("#ff5fa8", "#c2307a")];
D.forEach((d, i) => { d.position.set(-2.15 + i * 1.5, 0.06, 0); d.rotation.y = (1 - i) * 0.18; d.userData.base = d.position.y; digits.add(d); });
// the middle 0 has tipped over a little, as if someone bumped into it
D[1].rotation.z = -0.12;

/* ---------- a signpost pointing every way ---------- */
const post = new THREE.Group(); post.position.set(2.55, 0, 0.9); post.rotation.y = -0.5; world.add(post);
{
  const wood = mat("#c98a4f", { roughness: 0.8 });
  mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.9, 12), wood, [0, 0.95, 0], post);
  const board = (text, y, ry, color) => {
    const tex = canvasTex(256, 72, (x, w, h) => { x.fillStyle = color; x.fillRect(0, 0, w, h);
      x.font = '44px "Lilita One", "Arial Rounded MT Bold", sans-serif'; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#fff"; x.fillText(text, w / 2 - 10, h / 2 + 3); });
    const s = new THREE.Shape(); s.moveTo(0, -0.14); s.lineTo(0.72, -0.14); s.lineTo(0.86, 0); s.lineTo(0.72, 0.14); s.lineTo(0, 0.14); s.closePath();
    const g = new THREE.Group(); g.position.y = y; g.rotation.y = ry; post.add(g);
    const b = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }), mat(color, { roughness: 0.6 }), [0.04, 0, -0.025], g);
    const face = mesh(new THREE.PlaneGeometry(0.72, 0.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), [0.4, 0, 0.03], g); void b; void face;
    return g;
  };
  board("PLAZA", 1.65, 0.2, "#ff9a1f");
  board("PARK", 1.3, Math.PI - 0.4, "#2fbf62");
  post.userData.spin = board("???", 0.95, 1.2, "#9b5cff");
}

/* ---------- the lost Jumpi ---------- */
const BLOBBY = new Promise((res, rej) => new GLTFLoader().load("/blobby.glb", (g) => res(g.scene), undefined, rej));
let J = null, mapG = null, hopT = -9;
BLOBBY.then((base) => {
  const root = base.clone(true);
  root.traverse((o) => {
    if (!o.isMesh) return; o.castShadow = true;
    o.material = [].concat(o.material).map((m) => {
      if (m.name === "Skin") { m = m.clone(); m.color.set("#ff8a1c"); }
      else if (m.name === "Iris") { m = m.clone(); m.color.set("#2a7fff"); }
      else if (m.name === "Mouth") { m = m.clone(); const c = new THREE.Color("#ff8a1c"), h = {}; c.getHSL(h); m.color.setHSL(h.h, Math.min(1, h.s * 0.9), h.l * 0.22); }
      return m;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  J = { root, body: root.getObjectByName("Body"), head: root.getObjectByName("Head"), armL: root.getObjectByName("ArmL"), armR: root.getObjectByName("ArmR"),
    eyeL: root.getObjectByName("EyeL"), eyeR: root.getObjectByName("EyeR"), lookL: root.getObjectByName("LookL"), lookR: root.getObjectByName("LookR") };
  J.headY = J.head.position.y; J.restL = J.lookL.position.clone(); J.restR = J.lookR.position.clone();
  root.position.set(0.75, 0, 1.25); root.rotation.y = -0.25; root.scale.setScalar(0.95); world.add(root);
  // a map held out in front (a little treasure map with a dotted path that goes nowhere)
  const tex = canvasTex(256, 192, (x, w, h) => {
    x.fillStyle = "#f6e7c1"; x.fillRect(0, 0, w, h); x.strokeStyle = "#c9a46a"; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8);
    x.fillStyle = "#7fcfff"; x.beginPath(); x.ellipse(60, 140, 40, 22, 0.3, 0, 7); x.fill();
    x.fillStyle = "#5fd36b"; x.beginPath(); x.ellipse(190, 60, 36, 26, -0.2, 0, 7); x.fill();
    x.strokeStyle = "#d8333a"; x.lineWidth = 5; x.setLineDash([10, 9]); x.beginPath(); x.moveTo(30, 40);
    x.bezierCurveTo(120, 10, 60, 120, 130, 100); x.bezierCurveTo(200, 80, 230, 170, 150, 160); x.bezierCurveTo(90, 150, 110, 60, 160, 70); x.stroke(); x.setLineDash([]);
    x.font = 'bold 56px "Lilita One", sans-serif'; x.fillStyle = "#d8333a"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("?", 165, 72);
  });
  mapG = new THREE.Group(); mapG.position.set(0, 0.62, 0.58); root.add(mapG);
  const paper = new THREE.PlaneGeometry(0.72, 0.52, 6, 1), pp = paper.attributes.position;
  for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.sin((pp.getX(i) / 0.72 + 0.5) * Math.PI * 3) * 0.025);   // folds
  paper.computeVertexNormals();
  mesh(paper, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide }), [0, 0, 0], mapG, [-0.35, 0, 0]);
});
// question marks floating above the head
const qTex = canvasTex(128, 128, (x, w, h) => { x.font = '110px "Lilita One", "Arial Rounded MT Bold", sans-serif'; x.textAlign = "center"; x.textBaseline = "middle";
  x.lineWidth = 14; x.strokeStyle = "#1d2b4f"; x.strokeText("?", w / 2, h / 2 + 6); x.fillStyle = "#ffd23a"; x.fillText("?", w / 2, h / 2 + 6); });
const qs = [0, 1, 2].map((i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: qTex, transparent: true, depthWrite: false })); s.scale.setScalar(0.5 - i * 0.08); world.add(s); return s; });

/* ---------- animation ---------- */
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener("pointermove", (e) => { mouse.tx = e.clientX / innerWidth - 0.5; mouse.ty = e.clientY / innerHeight - 0.5; });
canvas.addEventListener("click", () => { hopT = clock.getElapsedTime(); });
let vis = true; new IntersectionObserver(([e]) => (vis = e.isIntersecting)).observe(canvas);
// fonts in the canvas textures: redraw once Lilita One has loaded
document.fonts && document.fonts.ready.then(() => { qTex.needsUpdate = true; });
const smooth = (a, b, k) => a + (b - a) * k;
let look = 0;
function frame() {
  requestAnimationFrame(frame);
  if (!vis) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false); cam.aspect = w / h; const k = Math.max(1, 1.45 / cam.aspect);
    cam.position.set(0, 2.6, 12 * k); cam.lookAt(0, 1.0, 0); cam.updateProjectionMatrix();
  }
  const t = reduce ? 2 : clock.getElapsedTime();
  mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
  // the whole island floats gently
  world.position.y = Math.sin(t * 0.9) * 0.08; world.rotation.y = mouse.x * 0.5 + Math.sin(t * 0.2) * 0.08; world.rotation.x = 0.02 + mouse.y * 0.08;
  D.forEach((d, i) => { d.position.y = d.userData.base + Math.max(0, Math.sin(t * 2.2 - i * 0.7)) * 0.08; });
  if (post.userData.spin) post.userData.spin.rotation.y = 1.2 + t * 1.4;
  if (J) {
    const br = Math.sin(t * 2.1); J.body.scale.set(1 + br * 0.012, 1 + br * 0.018, 1 + br * 0.012);
    // a little routine every 6 seconds: look left, look right, turn the map round, scratch head
    const c = t % 6;
    const want = c < 1.4 ? 0.55 : c < 2.8 ? -0.55 : c < 4.2 ? 0 : 0.15;
    look = smooth(look, want, 0.06);
    J.head.rotation.y = look; J.head.rotation.z = Math.sin(t * 1.3) * 0.06 + (c > 4.2 ? -0.12 : 0);
    J.head.position.y = J.headY + br * 0.012;
    [J.lookL, J.lookR].forEach((L, i) => { const rest = i ? J.restR : J.restL; L.position.set(rest.x + look * 0.06, rest.y + (c > 2.8 && c < 4.2 ? -0.03 : 0.01), rest.z); });
    const k = (t - hopT) / 0.8, hop = k >= 0 && k < 1;
    J.root.position.y = hop ? Math.sin(Math.PI * k) * 0.7 : 0;
    // arms hold the map; the right one goes up to scratch the head near the end of the routine
    J.armL.rotation.set(-1.0, 0, -0.35);
    const scratch = c > 4.4 && c < 5.8 && !hop;
    J.armR.rotation.set(scratch ? -2.6 : -1.0, 0, scratch ? 0.5 + Math.sin(t * 18) * 0.08 : 0.35);
    if (mapG) { mapG.visible = true; mapG.rotation.z = smooth(mapG.rotation.z, c > 2.8 && c < 4.2 ? Math.PI : 0, 0.07); mapG.position.x = scratch ? -0.12 : 0; }
    const bl = (t * 0.33) % 1 < 0.035; J.eyeL.scale.y = J.eyeR.scale.y = bl ? 0.15 : 1;
    const top = new THREE.Vector3(); J.head.getWorldPosition(top); world.worldToLocal(top);
    qs.forEach((q, i) => { const a = t * 0.9 + (i * Math.PI * 2) / 3; q.position.set(top.x + Math.cos(a) * 0.55, top.y + 1.15 + Math.sin(t * 2 + i) * 0.12 + i * 0.12, top.z + Math.sin(a) * 0.3);
      q.material.rotation = Math.sin(t * 1.5 + i) * 0.25; });
  }
  renderer.render(scene, cam);
}
frame();
