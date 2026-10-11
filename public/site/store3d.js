/* Jumpi Store: the hero. A sea of gold coins with waves, Jumpis swimming in it (one on a swim ring, one diving
   out and back in with a splash of coins, one peeking), coins jumping out of the sea. The card pictures are made
   ahead of time (public/site/img/store/*.webp; bundles: public/site/img/bundle-*.png). */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const canvas = document.getElementById("stHero");
const reduce = window.JUMPI_REDUCE_MOTION || matchMedia("(prefers-reduced-motion: reduce)").matches || document.body.classList.contains("no-motion");
const TAU = Math.PI * 2;

if (canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(devicePixelRatio, 1.75)); r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(34, 1, 0.1, 80), clock = new THREE.Clock();

  // a warm sky for the gold to shine in
  {
    const env = new THREE.Scene(), g = new THREE.SphereGeometry(20, 32, 16), cols = [];
    const top = new THREE.Color("#fff3d6"), mid = new THREE.Color("#8fd0ff"), bot = new THREE.Color("#7a4a10");
    for (let i = 0; i < g.attributes.position.count; i++) { const y = g.attributes.position.getY(i) / 20; const c = y > 0 ? mid.clone().lerp(top, y) : mid.clone().lerp(bot, -y); cols.push(c.r, c.g, c.b); }
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    env.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(env, 0.03).texture; pm.dispose();
  }
  scene.add(new THREE.HemisphereLight(0xdff4ff, 0xc08a30, 1.1));
  const sun = new THREE.DirectionalLight(0xfff4dc, 2.8); sun.position.set(-4, 8, 6); scene.add(sun);

  const GOLD = new THREE.MeshStandardMaterial({ color: "#ffa200", metalness: 0.75, roughness: 0.3, envMapIntensity: 0.75 });
  scene.fog = new THREE.Fog(0xffd98a, 16, 34);   // the far coins melt into the warm horizon
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });

  /* ---------- the sea of coins ---------- */
  const X0 = -15, X1 = 15, Z0 = -16, Z1 = 3.4, STEP = 0.31;
  const cells = [];
  for (let z = Z0, row = 0; z <= Z1; z += STEP * 0.86, row++)
    for (let x = X0; x <= X1; x += STEP) cells.push([x + (Math.random() - 0.5) * 0.2 + (row % 2) * STEP / 2, z + (Math.random() - 0.5) * 0.14]);
  const N = cells.length;
  const sea = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), GOLD, N);
  sea.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const tilt = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { tilt[i * 3] = (Math.random() - 0.5) * 0.9; tilt[i * 3 + 1] = Math.random() * TAU; tilt[i * 3 + 2] = (Math.random() - 0.5) * 0.9; }
  scene.add(sea);
  // a gold floor just under the coins, so no gaps show
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), mat("#c97800", { metalness: 0.45, roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.4, -8); scene.add(floor);
  const wave = (x, z, t) => 0.17 * Math.sin(x * 0.55 + t * 1.15) + 0.13 * Math.sin(z * 0.8 - t * 0.85) + 0.05 * Math.sin((x + z) * 1.6 + t * 2.1);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
  function updateSea(t) {
    for (let i = 0; i < N; i++) {
      const [x, z] = cells[i], y = wave(x, z, t);
      const sx = 0.094 * Math.cos(x * 0.55 + t * 1.15), sz = -0.104 * Math.cos(z * 0.8 - t * 0.85);   // the slope, so coins ride the waves
      E.set(tilt[i * 3] + sz * 1.4, tilt[i * 3 + 1], tilt[i * 3 + 2] - sx * 1.4); Q.setFromEuler(E); P.set(x, y, z);
      M.compose(P, Q, ONE); sea.setMatrixAt(i, M);
    }
    sea.instanceMatrix.needsUpdate = true;
  }

  /* ---------- coins flying out of the sea ---------- */
  const flyGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.06, 24);
  const flyers = [];
  for (let i = 0; i < 28; i++) { const m = new THREE.Mesh(flyGeo, GOLD); m.visible = false; scene.add(m); flyers.push({ m, v: new THREE.Vector3(), spin: 0, live: false }); }
  function launch(x, z, n = 1, power = 1) {
    for (const f of flyers) {
      if (f.live) continue;
      f.live = true; f.m.visible = true; f.m.position.set(x + (Math.random() - 0.5) * 0.5, 0.1, z + (Math.random() - 0.5) * 0.4);
      const a = Math.random() * TAU; f.v.set(Math.cos(a) * 1.4 * power, (4.2 + Math.random() * 2.2) * power, Math.sin(a) * 0.9 * power); f.spin = 6 + Math.random() * 8;
      f.m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      if (--n <= 0) return;
    }
  }
  function updateFlyers(dt, t) {
    for (const f of flyers) {
      if (!f.live) continue;
      f.v.y -= 9.8 * dt; f.m.position.addScaledVector(f.v, dt); f.m.rotation.x += f.spin * dt; f.m.rotation.z += f.spin * 0.6 * dt;
      if (f.v.y < 0 && f.m.position.y < wave(f.m.position.x, f.m.position.z, t)) { f.live = false; f.m.visible = false; }
    }
  }

  /* ---------- the Jumpis ---------- */
  function blobby(base, skin, eye) {
    const root = base.clone(true);
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = [].concat(o.material).map((m) => {
        if (m.name === "Skin") { m = m.clone(); m.color.set(skin); }
        else if (m.name === "Iris") { m = m.clone(); m.color.set(eye); }
        else if (m.name === "Mouth") { m = m.clone(); const c = new THREE.Color(skin), h = {}; c.getHSL(h); m.color.setHSL(h.h, Math.min(1, h.s * 0.9), h.l * 0.22); }
        return m;
      });
      if (o.material.length === 1) o.material = o.material[0];
    });
    const get = (n) => root.getObjectByName(n);
    return { root, body: get("Body"), head: get("Head"), armL: get("ArmL"), armR: get("ArmR"), eyeL: get("EyeL"), eyeR: get("EyeR") };
  }
  // a red and white swim ring
  function ring() {
    const g = new THREE.TorusGeometry(0.62, 0.22, 18, 48), cols = [];
    for (let i = 0; i < g.attributes.position.count; i++) { const p = g.attributes.position; const a = Math.atan2(p.getY(i), p.getX(i)); const c = new THREE.Color(Math.floor(((a + Math.PI) / TAU) * 8) % 2 ? "#ffffff" : "#ff4f6a"); cols.push(c.r, c.g, c.b); }
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 })); m.rotation.x = Math.PI / 2; return m;
  }
  const swimmers = [];
  // "swim" goes round in a loop paddling, "ring" floats on a swim ring, "dive" jumps out and dives back, "peek" looks at you
  const SETUP = [
    { kind: "swim", skin: "#ff8a1c", eye: "#2a7fff", x: 1.9, z: 1.5, s: 1.0 },
    { kind: "ring", skin: "#1fb6ff", eye: "#5a3a12", x: 5.2, z: -0.2, s: 0.95 },
    { kind: "dive", skin: "#ff5fa8", eye: "#3a2a12", x: 3.4, z: -2.6, s: 0.9 },
    { kind: "peek", skin: "#2fd36b", eye: "#3a2a12", x: 0.2, z: -1.0, s: 0.85 },
    { kind: "swim", skin: "#9b5cff", eye: "#3a2a12", x: 8.6, z: -4.6, s: 0.85, slow: true },
  ];
  new GLTFLoader().load("/blobby.glb", (gl) => {
    for (const c of SETUP) {
      const J = blobby(gl.scene, c.skin, c.eye); Object.assign(J, c);
      J.root.scale.setScalar(c.s); J.root.position.set(c.x, 0, c.z); J.phase = Math.random() * TAU;
      if (c.kind === "ring") { J.ring = ring(); J.ring.scale.setScalar(0.9 / c.s); J.ring.position.y = 0.55; J.root.add(J.ring); }
      scene.add(J.root); swimmers.push(J);
    }
    if (reduce) frame();
  });
  let diveAt = 1.2;
  const faceYaw = (x, z) => Math.atan2(cam.position.x - x, cam.position.z - z);   // turned towards us
  function updateSwimmers(t, dt) {
    for (const J of swimmers) {
      const ph = J.phase, br = Math.sin(t * 2 + ph);
      // phones: the group squeezed together under the text
      const hx = wide ? J.x : 3.4 + (J.x - 3.4) * 0.4, hz = wide ? J.z : J.z * 0.7 - 0.4;
      let x = hx, z = hz, y, ry;
      if (J.kind === "swim") {
        const sp = J.slow ? 0.18 : 0.28, a = t * sp + ph, rx = J.slow ? 1.1 : 1.5, rz = J.slow ? 0.7 : 0.9;
        x = hx + Math.cos(a) * rx * (wide ? 1 : 0.5); z = hz + Math.sin(a) * rz * (wide ? 1 : 0.6);
        ry = faceYaw(x, z) - Math.sin(a) * 0.75;   // mostly towards us, turning a bit with the swim loop
        y = wave(x, z, t) - 0.4 * J.s + Math.sin(t * 4 + ph) * 0.04;
        if (J.armL) { J.armL.rotation.z = -0.4 - 1.1 * Math.max(0, Math.sin(t * 4.5 + ph)); J.armR.rotation.z = 0.4 + 1.1 * Math.max(0, Math.sin(t * 4.5 + ph + Math.PI)); }
        J.root.rotation.set(-0.06, ry, Math.sin(t * 4.5 + ph) * 0.08);
        if (!reduce && Math.random() < dt * 0.6) launch(x - Math.sin(ry) * 0.6, z - Math.cos(ry) * 0.6, 1, 0.55);
      } else if (J.kind === "ring") {
        y = wave(x, z, t) - 0.42 * J.s; ry = faceYaw(x, z) + Math.sin(t * 0.3) * 0.45;
        if (J.armL) { J.armL.rotation.z = -0.95 + Math.sin(t * 1.3) * 0.08; J.armR.rotation.z = 0.95 - Math.sin(t * 1.3) * 0.08; }
        J.root.rotation.set(Math.sin(t * 1.1) * 0.08, ry, Math.sin(t * 0.9) * 0.1);
      } else if (J.kind === "dive") {
        const cyc = 5.2, k = (((t - diveAt) % cyc) + cyc) % cyc, air = 1.25;
        const base = wave(x, z, t) - 0.9 * J.s;
        if (k < air) {   // up out of the coins, a spin, and back in
          const u = k / air; y = base + Math.sin(Math.PI * u) * 2.4;
          J.root.rotation.set(0, faceYaw(x, z) + u * TAU, 0);
          if (J.armL) { J.armL.rotation.z = -2.3; J.armR.rotation.z = 2.3; }
          if (!J.out && u > 0.02) { J.out = true; if (!reduce) launch(x, z, 9, 1); }
          if (J.out && u > 0.93 && !J.splash) { J.splash = true; if (!reduce) launch(x, z, 7, 0.75); }
        } else { J.out = J.splash = false; y = base - 0.6; J.root.rotation.set(0, faceYaw(x, z), 0); }
        if (reduce) { y = base + 1.6; J.root.rotation.set(0, faceYaw(x, z), 0); if (J.armL) { J.armL.rotation.z = -2.3; J.armR.rotation.z = 2.3; } }
      } else {   // just the head over the coins, looking around
        y = wave(x, z, t) - 0.85 * J.s + Math.sin(t * 1.6 + ph) * 0.05;
        J.root.rotation.set(0, faceYaw(x, z) + Math.sin(t * 0.7) * 0.4, 0);
      }
      J.root.position.set(x, y, z);
      if (J.body) J.body.scale.set(1 + br * 0.012, 1 + br * 0.018, 1 + br * 0.012);
      const blink = (t * 0.35 + ph) % 1 < 0.035; if (J.eyeL) J.eyeL.scale.y = J.eyeR.scale.y = blink ? 0.15 : 1;
    }
  }

  /* ---------- camera, mouse, size ---------- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => { mouse.tx = e.clientX / innerWidth - 0.5; mouse.ty = e.clientY / innerHeight - 0.5; }, { passive: true });
  canvas.addEventListener("click", () => { diveAt = clock.getElapsedTime(); });   // a tap: the pink Jumpi dives right away
  let wide = true, vis = true, last = 0;
  new IntersectionObserver(([e]) => { vis = e.isIntersecting; }).observe(canvas);
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return false;
    if (canvas.width === Math.round(w * r.getPixelRatio()) && canvas.height === Math.round(h * r.getPixelRatio())) return true;
    r.setSize(w, h, false); cam.aspect = w / h; wide = cam.aspect > 1.15; cam.updateProjectionMatrix(); return true;
  }
  function place() {
    // wide screens: the text is on the left, the Jumpis on the right. Phones: the Jumpis in the middle, under the text
    const cx = wide ? -1.2 : 3.4, dist = wide ? 10.5 : 10.5 + Math.max(0, 0.9 - cam.aspect) * 6;
    cam.position.set(cx + mouse.x * 0.8, (wide ? 3.6 : 4.6) - mouse.y * 0.4, dist);
    cam.lookAt(cx + (wide ? 2.2 : 0), wide ? 0.3 : 2.1, -2.2);
  }
  function frame() {
    if (!reduce) requestAnimationFrame(frame);
    if (!vis && !reduce) return;
    if (!resize()) return;
    const t = reduce ? 2.3 : clock.getElapsedTime(), dt = Math.min(0.05, t - last); last = t;
    mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
    place(); updateSea(t);
    if (!reduce) { updateFlyers(dt, t); if (Math.random() < dt * 2.2) launch(-6 + Math.random() * 16, -9 + Math.random() * 6.5, 1, 0.8); }
    updateSwimmers(t, dt);
    r.render(scene, cam);
  }
  frame();
  if (reduce) addEventListener("resize", () => frame());
  window.__storeHero = { frame, dive: () => { diveAt = clock.getElapsedTime(); } };
}
