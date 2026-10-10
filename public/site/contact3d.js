/* Contact page: a Jumpi on the help desk, with a headset, a name badge and envelopes flying around. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const reduce = (window.JUMPI_REDUCE_MOTION || matchMedia("(prefers-reduced-motion: reduce)").matches);
const TAU = Math.PI * 2;
const canvas = document.getElementById("ctCanvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60), clock = new THREE.Clock();
scene.add(new THREE.HemisphereLight(0xffffff, 0x9fc4e8, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(3, 7, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 5;
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 });
scene.add(sun);

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });
function mesh(geo, m, pos, parent, rot) {
  const x = new THREE.Mesh(geo, m); if (pos) x.position.set(...pos); if (rot) x.rotation.set(...rot);
  x.castShadow = true; parent.add(x); return x;
}
const ease = (k) => 1 - Math.pow(1 - k, 3);

// a round platform like a game piece
const plate = new THREE.Group(); scene.add(plate);
const pm = mesh(new THREE.CylinderGeometry(1.45, 1.4, 0.26, 48), mat("#7ccbf2", { roughness: 0.7 }), [0, -0.13, 0], plate); pm.receiveShadow = true;
const pt = mesh(new THREE.CylinderGeometry(1.42, 1.42, 0.02, 48), mat("#d4f0ff", { roughness: 0.85 }), [0, 0.005, 0], plate); pt.receiveShadow = true;

// envelopes that float around
function envelope(color = "#ffffff", flap = "#ff9a1f") {
  const g = new THREE.Group();
  mesh(new THREE.BoxGeometry(0.42, 0.28, 0.025), mat(color, { roughness: 0.6 }), [0, 0, 0], g);
  const s = new THREE.Shape(); s.moveTo(-0.21, 0.14); s.lineTo(0.21, 0.14); s.lineTo(0, -0.02); s.closePath();
  mesh(new THREE.ShapeGeometry(s), mat(flap, { side: THREE.DoubleSide }), [0, 0, 0.014], g);
  mesh(new THREE.SphereGeometry(0.035, 10, 8), mat("#ff4f6a"), [0, -0.005, 0.02], g);   // the seal
  return g;
}
const ENV_COL = ["#ff9a1f", "#1fb6ff", "#ff5fb4", "#2fd36b"];
const orbit = ENV_COL.map((c, i) => { const e = envelope("#ffffff", c); e.userData.k = i; scene.add(e); return e; });
const flyers = [];   // envelopes sent away by the form

const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
let J = null, hopT = -9, waveT = 0, typing = false, nodT = -9, spinT = -9;

new GLTFLoader().load("/blobby.glb", (g) => {
  const root = g.scene;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.material = [].concat(o.material).map((m) => {
      if (m.name === "Skin") { m = m.clone(); m.color.set("#ff8a1c"); }
      else if (m.name === "Iris") { m = m.clone(); m.color.set("#2a7fff"); }
      else if (m.name === "Mouth") { m = m.clone(); m.color.set("#3a1a06"); }
      return m;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  scene.add(root);
  root.updateMatrixWorld(true);
  const head = root.getObjectByName("Head"), body = root.getObjectByName("Body");
  J = { root, head, body, armL: root.getObjectByName("ArmL"), armR: root.getObjectByName("ArmR"), eyeL: root.getObjectByName("EyeL"), eyeR: root.getObjectByName("EyeR"), blinkT: 2 };
  J.headY = head.position.y;

  // ---- headset (sits on the head and moves with it) ----
  const hb = new THREE.Box3();
  head.traverse((o) => { if (o.isMesh && o.name !== "EyeL" && o.name !== "EyeR") hb.expandByObject(o); });
  const hc = hb.getCenter(new THREE.Vector3()), hs = hb.getSize(new THREE.Vector3());
  const hw = hs.x * 0.5, top = hb.max.y;
  const set = new THREE.Group(); head.add(set);
  set.position.copy(head.worldToLocal(new THREE.Vector3(hc.x, hc.y + hs.y * 0.06, hc.z - hs.z * 0.05)));
  const navy = mat("#1d2b4f", { roughness: 0.35 }), orange = mat("#ff9a1f", { roughness: 0.4 }), pad = mat("#3e5b86", { roughness: 0.8 });
  const bandR = Math.max(hw, top - hc.y) * 1.03;
  mesh(new THREE.TorusGeometry(bandR, 0.045, 12, 40, Math.PI), navy, [0, 0, 0], set);
  [-1, 1].forEach((s) => {
    const cup = new THREE.Group(); cup.position.set(s * bandR, 0, 0); set.add(cup);
    mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 24), navy, [0, 0, 0], cup, [0, 0, Math.PI / 2]);
    mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 24), orange, [s * 0.07, 0, 0], cup, [0, 0, Math.PI / 2]);
    mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 24), pad, [-s * 0.06, 0, 0], cup, [0, Math.PI / 2, 0]);
  });
  // the microphone arm, from the left ear to in front of the mouth
  const boom = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-bandR - 0.04, -0.02, 0.05), new THREE.Vector3(-bandR * 0.95, -hs.y * 0.22, hs.z * 0.3),
    new THREE.Vector3(-bandR * 0.6, -hs.y * 0.36, hs.z * 0.5), new THREE.Vector3(-bandR * 0.28, -hs.y * 0.38, hs.z * 0.56)]);
  mesh(new THREE.TubeGeometry(boom, 24, 0.022, 8), navy, [0, 0, 0], set);
  const micTip = boom.getPoint(1);
  const mic = mesh(new THREE.SphereGeometry(0.065, 16, 12), orange, [micTip.x, micTip.y, micTip.z], set);
  J.mic = mic;

  // ---- "HELP" name badge on the tummy ----
  const bb = new THREE.Box3(); body.traverse((o) => { if (o.isMesh) bb.expandByObject(o); });
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = "#ffffff"; x.beginPath(); x.roundRect(4, 4, 248, 120, 26); x.fill();
  x.fillStyle = "#1fb6ff"; x.beginPath(); x.roundRect(4, 4, 248, 40, [26, 26, 0, 0]); x.fill();
  x.fillStyle = "#fff"; x.font = "bold 26px Fredoka, sans-serif"; x.textAlign = "center"; x.fillText("JUMPI TEAM", 128, 34);
  x.fillStyle = "#1d2b4f"; x.font = "52px 'Lilita One', sans-serif"; x.fillText("HELP", 128, 108);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.18), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, transparent: true }));
  const bc = bb.getCenter(new THREE.Vector3());
  const front = new THREE.Vector3(bc.x + 0.12, bc.y + (bb.max.y - bc.y) * 0.15, 0);
  // find the front of the body at that height
  const ray = new THREE.Raycaster(new THREE.Vector3(front.x, front.y, 5), new THREE.Vector3(0, 0, -1));
  const hit = ray.intersectObject(body, true)[0];
  front.z = hit ? hit.point.z + 0.015 : bb.max.z;
  body.add(badge); badge.position.copy(body.worldToLocal(front)); badge.rotation.y = 0.12; badge.rotation.x = -0.12;
  // a little gold pin on the badge
  if (document.fonts) document.fonts.ready.then(() => { x.clearRect(0, 0, 256, 128); x.fillStyle = "#ffffff"; x.beginPath(); x.roundRect(4, 4, 248, 120, 26); x.fill();
    x.fillStyle = "#1fb6ff"; x.beginPath(); x.roundRect(4, 4, 248, 40, [26, 26, 0, 0]); x.fill();
    x.fillStyle = "#fff"; x.font = "600 26px Fredoka, sans-serif"; x.fillText("JUMPI TEAM", 128, 34);
    x.fillStyle = "#1d2b4f"; x.font = "52px 'Lilita One', sans-serif"; x.fillText("HELP", 128, 108); tex.needsUpdate = true; });
});

// camera fits the platform at any size
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  cam.aspect = w / h;
  const d = 7.2 * Math.max(1, 0.95 / cam.aspect);
  cam.position.set(0, 1.55, d); cam.lookAt(0, 1.2, 0); cam.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
let visible = true;
new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

canvas.addEventListener("pointermove", (e) => { const r = canvas.getBoundingClientRect(); mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1; mouse.ty = -((e.clientY - r.top) / r.height) * 2 + 1; });
canvas.addEventListener("pointerleave", () => { mouse.tx = mouse.ty = 0; });
canvas.addEventListener("click", () => { hopT = clock.getElapsedTime(); waveT = hopT; });
addEventListener("ct:topic", () => { hopT = clock.getElapsedTime(); spinT = hopT; });
addEventListener("ct:typing", (e) => { typing = e.detail; if (typing) nodT = clock.getElapsedTime(); });
addEventListener("ct:sent", () => {
  const t = clock.getElapsedTime(); hopT = t; waveT = t;
  const e = envelope("#ffffff", "#ff9a1f"); e.position.set(0.5, 1.2, 0.6); e.userData.t = t; scene.add(e); flyers.push(e);
});

function loop() {
  requestAnimationFrame(loop);
  if (!visible) return;
  const t = clock.getElapsedTime();
  mouse.x += (mouse.tx - mouse.x) * 0.08; mouse.y += (mouse.ty - mouse.y) * 0.08;
  plate.rotation.y = t * 0.15;
  orbit.forEach((e) => {
    const k = e.userData.k, a = t * (reduce ? 0.2 : 0.55) + (k / orbit.length) * TAU;
    e.position.set(Math.cos(a) * 1.35, 1.0 + Math.sin(t * 1.6 + k) * 0.35 + k * 0.12, Math.sin(a) * 0.9 - 0.1);
    e.rotation.set(Math.sin(t + k) * 0.25, -a + Math.PI / 2, Math.sin(t * 1.3 + k) * 0.2);
  });
  for (let i = flyers.length - 1; i >= 0; i--) {
    const e = flyers[i], k = (t - e.userData.t) / 1.6;
    if (k >= 1) { scene.remove(e); flyers.splice(i, 1); continue; }
    e.position.set(0.5 + k * 2.2, 1.2 + Math.sin(k * Math.PI) * 1.2 + k * 1.8, 0.6 - k * 1.5);
    e.rotation.set(0, k * TAU * 1.5, -k * 0.8); e.scale.setScalar(1 + k * 0.4);
  }
  if (J) {
    const br = Math.sin(t * 2.1);
    J.body.scale.set(1 + br * 0.012, 1 + br * 0.018, 1 + br * 0.012);
    J.head.position.y = J.headY + br * 0.012;
    // looks at the mouse; nods while you type
    const nod = typing ? Math.sin((t - nodT) * 9) * 0.08 : 0;
    J.head.rotation.y = mouse.x * 0.45;
    J.head.rotation.x = -mouse.y * 0.2 + nod;
    J.head.rotation.z = typing ? Math.sin(t * 2) * 0.06 : 0;
    if (t > J.blinkT) { const k = (t - J.blinkT) / 0.16; const s = k < 1 ? Math.abs(1 - 2 * k) : 1; J.eyeL.scale.y = J.eyeR.scale.y = Math.max(0.1, s); if (k >= 1) J.blinkT = t + 2 + Math.random() * 3; }
    // hop (and a spin when you pick a topic)
    const k = (t - hopT) / 0.75;
    J.root.position.y = k >= 0 && k < 1 ? Math.sin(Math.PI * k) * 0.45 : 0;
    const sk = (t - spinT) / 0.75;
    J.root.rotation.y = (sk >= 0 && sk < 1 ? ease(sk) * TAU : 0) + Math.sin(t * 0.5) * (reduce ? 0 : 0.15);
    // wave hello every few seconds, and when a message is sent
    if (!reduce && t - waveT > 7) waveT = t;
    const w = (t - waveT) / 2.2;
    J.armR.rotation.z = w >= 0 && w < 1 ? ease(Math.min(1, w / 0.18)) * (1 - ease(Math.max(0, (w - 0.82) / 0.18))) * (2.35 + 0.32 * Math.sin((t - waveT) * 13)) : -br * 0.04;
    J.armL.rotation.z = typing ? -0.4 + Math.sin(t * 14) * 0.15 : -br * 0.04;   // "typing" with the other hand
    if (J.mic) J.mic.scale.setScalar(typing ? 1 + Math.abs(Math.sin(t * 12)) * 0.25 : 1);
  }
  renderer.render(scene, cam);
}
resize();
loop();
