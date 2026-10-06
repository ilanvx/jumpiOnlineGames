/* Jumpi website: the 3D scenes. Hero = Jumpis bouncing on a floating island. Pets = a puppy, kitten or bunny to play with. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const TAU = Math.PI * 2;
const clock = new THREE.Clock();
const stages = [];
// the real Jumpi character from the game, loaded once and copied for every scene
const BLOBBY = new Promise((res, rej) => new GLTFLoader().load("/blobby.glb", (g) => res(g.scene), undefined, rej));
function makeBlobby(base, skin, eye = "#7a3e12") {
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
  const J = { root, body: root.getObjectByName("Body"), head: root.getObjectByName("Head"), armL: root.getObjectByName("ArmL"), armR: root.getObjectByName("ArmR"),
    eyeL: root.getObjectByName("EyeL"), eyeR: root.getObjectByName("EyeR"), hopT: -9, blinkT: 1 + Math.random() * 3, ph: Math.random() * 6 };
  J.headY = J.head.position.y;
  J.skinMats = [];
  root.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => m.name === "Skin" && J.skinMats.push(m)));
  return J;
}
// breathing, blinking, a hop when asked, and a wave
function liveBlobby(J, t, { hop = 0.7, hopH = 0.45, wave = false } = {}) {
  const br = Math.sin(t * 2.1 + J.ph);
  J.body.scale.set(1 + br * 0.012, 1 + br * 0.018, 1 + br * 0.012);
  J.head.position.y = J.headY + br * 0.012;
  if (t > J.blinkT) { const k = (t - J.blinkT) / 0.16; const s = k < 1 ? Math.abs(1 - 2 * k) : 1; J.eyeL.scale.y = J.eyeR.scale.y = Math.max(0.1, s); if (k >= 1) J.blinkT = t + 2 + Math.random() * 3; }
  const k = (t - J.hopT) / hop;
  J.root.position.y = (J.baseY || 0) + (k >= 0 && k < 1 ? Math.sin(Math.PI * k) * hopH : 0);
  J.armR.rotation.z = wave ? (1.9 + 0.35 * Math.sin(t * 9)) : -br * 0.04;
  J.armL.rotation.z = -br * 0.04;
}

/* ---------- a canvas with its own scene, drawn only while on screen ---------- */
function makeStage(canvas, { fov = 30 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  const st = { canvas, renderer, scene, cam, visible: true, onResize: null, tick: null, w: 0, h: 0 };
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === st.w && h === st.h)) return;
    st.w = w; st.h = h;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    st.onResize && st.onResize(w, h);
    cam.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => (st.visible = e.isIntersecting)).observe(canvas);
  st.resize = resize;
  stages.push(st);
  return st;
}
function loop() {
  const t = clock.getElapsedTime();
  renderMinis(t);
  for (const st of stages) {
    if (!st.visible) continue;
    st.resize();
    st.tick && st.tick(t);
    st.renderer.render(st.scene, st.cam);
  }
  requestAnimationFrame(loop);
}

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...o });
function mesh(geo, material, pos, parent, opts = {}) {
  const m = new THREE.Mesh(geo, material);
  if (pos) m.position.set(...pos);
  if (opts.scale) m.scale.set(...opts.scale);
  if (opts.rot) m.rotation.set(...opts.rot);
  m.castShadow = opts.cast !== false;
  m.receiveShadow = !!opts.receive;
  parent && parent.add(m);
  return m;
}
const ease = (k) => 1 - Math.pow(1 - k, 3);

// little emoji bursts over a canvas
function burst(box, x, y, list, n = 6) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.className = "pop";
    s.textContent = list[Math.floor(Math.random() * list.length)];
    s.style.left = x + (Math.random() - 0.5) * 30 + "px";
    s.style.top = y + (Math.random() - 0.5) * 20 + "px";
    s.style.setProperty("--dx", (Math.random() - 0.5) * 140 + "px");
    s.style.setProperty("--rot", (Math.random() - 0.5) * 60 + "deg");
    s.style.animationDelay = i * 40 + "ms";
    box.appendChild(s);
    setTimeout(() => s.remove(), 1300);
  }
}
const pointerOf = (e, el) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, nx: ((e.clientX - r.left) / r.width) * 2 - 1, ny: -((e.clientY - r.top) / r.height) * 2 + 1 }; };

/* =====================================================================
   HERO: a floating island with four Jumpis
   ===================================================================== */
{
  const canvas = document.getElementById("heroCanvas");
  const st = makeStage(canvas, { fov: 30 });
  const { scene, cam } = st;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8fb0d8, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.3);
  sun.position.set(4, 9, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25 });
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const world = new THREE.Group();
  scene.add(world);

  // the island
  const island = new THREE.Group();
  world.add(island);
  mesh(new THREE.CylinderGeometry(3.35, 3.2, 0.42, 56), mat("#5fd46f", { roughness: 0.8 }), [0, -0.21, 0], island, { receive: true });
  mesh(new THREE.CylinderGeometry(3.38, 3.38, 0.12, 56), mat("#49b85b", { roughness: 0.8 }), [0, -0.38, 0], island);
  mesh(new THREE.CylinderGeometry(3.2, 1.3, 1.5, 28), mat("#c08550", { roughness: 0.9, flatShading: true }), [0, -1.18, 0], island);
  mesh(new THREE.ConeGeometry(1.3, 1.3, 20), mat("#9a6236", { roughness: 0.9, flatShading: true }), [0, -2.55, 0], island, { rot: [Math.PI, 0, 0] });
  // grass tufts round the edge
  const tuftMat = mat("#49b85b", { roughness: 0.85 });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + Math.random() * 0.1;
    mesh(new THREE.SphereGeometry(0.22 + Math.random() * 0.1, 12, 10), tuftMat, [Math.cos(a) * 3.25, -0.08, Math.sin(a) * 3.25], island, { scale: [1, 0.55, 1] });
  }
  // a round tree
  const tree = new THREE.Group();
  tree.position.set(-2.2, 0, -1.3);
  island.add(tree);
  mesh(new THREE.CylinderGeometry(0.13, 0.19, 1.3, 10), mat("#a0663a"), [0, 0.65, 0], tree);
  [[0, 1.65, 0, 0.7], [-0.42, 1.38, 0.18, 0.48], [0.45, 1.42, 0.05, 0.5], [0.1, 2.15, -0.05, 0.45]].forEach(([x, y, z, r]) =>
    mesh(new THREE.SphereGeometry(r, 18, 14), mat("#3fbf62", { roughness: 0.7 }), [x, y, z], tree));
  [[0.3, 1.9, 0.52], [-0.4, 1.55, 0.55], [0.55, 1.4, 0.4]].forEach((p) => mesh(new THREE.SphereGeometry(0.08, 10, 8), mat("#ff4f6a"), p, tree));
  // flowers
  const flowerCols = ["#ff5fb4", "#ffd23a", "#ffffff", "#ff8a1c", "#9b5cff"];
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * TAU, r = 1.9 + Math.random() * 1.1;
    const f = new THREE.Group();
    f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    if (Math.abs(f.position.x) < 2 && f.position.z > 0.2) continue;
    island.add(f);
    mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 5), mat("#2f9a45"), [0, 0.11, 0], f, { cast: false });
    mesh(new THREE.SphereGeometry(0.075, 10, 8), mat(flowerCols[i % flowerCols.length]), [0, 0.24, 0], f, { cast: false });
  }
  // a present
  const gift = new THREE.Group();
  gift.position.set(2.3, 0, -1.2);
  gift.rotation.y = -0.5;
  island.add(gift);
  mesh(new THREE.BoxGeometry(0.62, 0.5, 0.62), mat("#ff4f6a"), [0, 0.25, 0], gift);
  mesh(new THREE.BoxGeometry(0.7, 0.14, 0.7), mat("#ff6f86"), [0, 0.55, 0], gift);
  mesh(new THREE.BoxGeometry(0.14, 0.66, 0.72), mat("#ffd23a"), [0, 0.32, 0], gift);
  mesh(new THREE.BoxGeometry(0.72, 0.66, 0.14), mat("#ffd23a"), [0, 0.32, 0], gift);
  mesh(new THREE.TorusGeometry(0.12, 0.045, 8, 16), mat("#ffd23a"), [-0.1, 0.7, 0], gift, { rot: [0, 0, 0.6] });
  mesh(new THREE.TorusGeometry(0.12, 0.045, 8, 16), mat("#ffd23a"), [0.1, 0.7, 0], gift, { rot: [0, 0, -0.6] });

  // spinning coins
  const coinMat = mat("#ffc400", { metalness: 0.6, roughness: 0.3, emissive: "#6b4a00", emissiveIntensity: 0.35 });
  const coins = [[-2.9, 2.1, 0.4], [2.9, 2.5, 0.2], [0.9, 3.1, -1.6], [-1.2, 3.0, -1.4]].map((p, i) => {
    const c = new THREE.Group();
    c.position.set(...p);
    c.userData.y = p[1];
    c.userData.ph = i * 1.3;
    world.add(c);
    mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.07, 28), coinMat, [0, 0, 0], c, { rot: [Math.PI / 2, 0, 0] });
    mesh(new THREE.TorusGeometry(0.19, 0.03, 8, 24), mat("#e8a300", { metalness: 0.5, roughness: 0.3 }), [0, 0, 0.04], c);
    return c;
  });

  // small islands far behind
  const far = [[-5.6, 1.2, -7, 0.85], [6, 0.3, -8, 1], [2.8, 2.6, -11, 0.65]].map(([x, y, z, s], i) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    g.userData = { y, ph: i * 2 };
    world.add(g);
    mesh(new THREE.CylinderGeometry(1.2, 1.1, 0.3, 24), mat("#7be08a", { roughness: 0.85 }), [0, 0, 0], g, { cast: false });
    mesh(new THREE.ConeGeometry(1.1, 1.3, 16), mat("#c99566", { roughness: 0.9, flatShading: true }), [0, -0.8, 0], g, { rot: [Math.PI, 0, 0], cast: false });
    mesh(new THREE.SphereGeometry(0.45, 14, 12), mat("#3fbf62"), [0.3, 0.5, 0], g, { cast: false });
    return g;
  });

  // the Jumpis
  const LOOKS = [
    { skin: "#ff8a1c", eye: "#7a3e12", pos: [-1.55, 0, 0.55], face: 0.35 },
    { skin: "#1fb6ff", eye: "#2fae4f", pos: [-0.35, 0, 1.35], face: 0.08 },
    { skin: "#ff5fb4", eye: "#8a4dff", pos: [0.95, 0, 0.75], face: -0.2 },
    { skin: "#2fd36b", eye: "#2a7fff", pos: [1.85, 0, -0.3], face: -0.5, crown: true },
  ];
  const jumpis = [];
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  function starShape(r1, r2, n = 5) {
    const s = new THREE.Shape();
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * TAU - Math.PI / 2, r = i % 2 ? r2 : r1;
      i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return s;
  }

  BLOBBY.then((base) => {
    LOOKS.forEach((L, idx) => {
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
      root.position.set(...L.pos);
      root.rotation.y = L.face;
      island.add(root);
      const J = {
        root, L, idx, face: L.face,
        body: root.getObjectByName("Body"), head: root.getObjectByName("Head"),
        armL: root.getObjectByName("ArmL"), armR: root.getObjectByName("ArmR"),
        eyeL: root.getObjectByName("EyeL"), eyeR: root.getObjectByName("EyeR"),
        hopT: -9, hopBig: false, waveT: -9, blinkT: 1 + Math.random() * 3, nextHop: 1 + idx * 0.9 + Math.random() * 2,
      };
      J.headY = J.head.position.y;
      // a golden crown of stars on the last one (like the Golden Glory aura)
      if (L.crown) {
        const ring = new THREE.Group();
        ring.position.y = 2.15;
        root.add(ring);
        const geo = new THREE.ExtrudeGeometry(starShape(0.13, 0.06), { depth: 0.04, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1 });
        const m = mat("#ffd23a", { metalness: 0.5, roughness: 0.25, emissive: "#a36a00", emissiveIntensity: 0.6 });
        for (let k = 0; k < 6; k++) { const s = mesh(geo, m, [Math.cos((k / 6) * TAU) * 0.48, 0, Math.sin((k / 6) * TAU) * 0.48], ring); s.userData.k = k; }
        J.crown = ring;
      }
      jumpis.push(J);
    });
  });

  // camera: pull back on narrow screens so the whole island fits
  st.onResize = (w, h) => {
    const a = w / h, d = 12.2 * Math.max(1, 1.35 / a);
    cam.position.set(0, 3.4, d);
    cam.lookAt(0, 0.7, 0);
    world.position.y = a < 1 ? 0.4 : 0;
  };

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function jumpiAt(e) {
    const p = pointerOf(e, canvas);
    ndc.set(p.nx, p.ny);
    ray.setFromCamera(ndc, cam);
    let best = null, bd = Infinity;
    for (const J of jumpis) { const h = ray.intersectObject(J.root, true)[0]; if (h && h.distance < bd) { bd = h.distance; best = J; } }
    return { J: best, p };
  }
  const pops = document.getElementById("heroPops");
  canvas.addEventListener("pointermove", (e) => {
    const p = pointerOf(e, canvas);
    mouse.tx = p.nx; mouse.ty = p.ny;
    canvas.style.cursor = jumpiAt(e).J ? "pointer" : "default";
  });
  addEventListener("pointermove", (e) => { if (e.target !== canvas) { mouse.tx = (e.clientX / innerWidth) * 2 - 1; mouse.ty = -(e.clientY / innerHeight) * 2 + 1; } }, { passive: true });
  canvas.addEventListener("click", (e) => {
    const { J, p } = jumpiAt(e);
    if (!J) return;
    J.hopT = clock.getElapsedTime(); J.hopBig = true;
    burst(pops, p.x, p.y - 40, ["⭐", "✨", "💥", "🎉", "💖"], 7);
  });

  const HOP = 0.75, FLIP = 1.15;
  st.tick = (t) => {
    const dt = Math.min(0.05, t - (st.lastT || t)); st.lastT = t;
    mouse.x += (mouse.tx - mouse.x) * 0.06; mouse.y += (mouse.ty - mouse.y) * 0.06;
    world.rotation.y = reduce ? 0 : Math.sin(t * 0.25) * 0.12 + mouse.x * 0.18;
    island.position.y = reduce ? 0 : Math.sin(t * 1.1) * 0.08;
    coins.forEach((c) => { c.rotation.y = t * 2 + c.userData.ph; c.position.y = c.userData.y + Math.sin(t * 1.6 + c.userData.ph) * 0.18; });
    far.forEach((g) => (g.position.y = g.userData.y + Math.sin(t * 0.8 + g.userData.ph) * 0.15));
    for (const J of jumpis) {
      const br = Math.sin(t * 2.1 + J.idx);
      J.body.scale.set(1 + br * 0.012, 1 + br * 0.018, 1 + br * 0.012);
      J.head.position.y = J.headY + br * 0.012;
      // look at the mouse
      J.head.rotation.y = mouse.x * 0.45 - J.face * 0.4;
      J.head.rotation.x = -mouse.y * 0.18;
      // blink
      if (t > J.blinkT) { const k = (t - J.blinkT) / 0.16; const s = k < 1 ? Math.abs(1 - 2 * k) : 1; J.eyeL.scale.y = J.eyeR.scale.y = Math.max(0.1, s); if (k >= 1) J.blinkT = t + 2 + Math.random() * 3; }
      // hop by itself now and then
      if (!reduce && t > J.nextHop && t - J.hopT > FLIP) { J.hopT = t; J.hopBig = Math.random() < 0.3; J.nextHop = t + 2.5 + Math.random() * 3.5; }
      let y = 0, rx = 0, sq = 1;
      const k = (t - J.hopT) / (J.hopBig ? FLIP : HOP);
      if (k >= 0 && k < 1) {
        if (J.hopBig) { y = Math.sin(Math.PI * k) * 1.5; rx = -ease(Math.min(1, k * 1.15)) * TAU; }
        else y = Math.sin(Math.PI * k) * 0.45;
        sq = k < 0.08 ? 1 - k * 2 : k > 0.9 ? 1 - (1 - k) * 1.5 : 1;
      }
      J.root.position.y = y;
      J.root.rotation.x = rx;
      J.root.scale.set(1 + (1 - sq) * 0.6, sq, 1 + (1 - sq) * 0.6);
      // the orange one waves hello
      if (J.idx === 0) {
        if (t - J.waveT > 6) J.waveT = t;
        const w = (t - J.waveT) / 2.2;
        J.armR.rotation.z = w < 1 ? ease(Math.min(1, w / 0.18)) * (1 - ease(Math.max(0, (w - 0.82) / 0.18))) * (2.35 + 0.32 * Math.sin((t - J.waveT) * 13)) : 0;
      }
      J.armL.rotation.z = -br * 0.04;
      if (J.crown) { J.crown.rotation.y = t * 1.2; J.crown.children.forEach((s) => { s.position.y = Math.sin(t * 3 + s.userData.k) * 0.06; s.rotation.y = -t * 1.2 + Math.PI / 2; }); }
    }
  };
}

/* =====================================================================
   PETS: puppy, kitten and bunny (made from simple round shapes)
   ===================================================================== */
{
  const canvas = document.getElementById("petCanvas");
  const st = makeStage(canvas, { fov: 30 });
  const { scene, cam } = st;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9a3ff, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 });
  key.shadow.radius = 5;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc9b8ff, 1.2);
  rim.position.set(-4, 3, -4);
  scene.add(rim);

  // a round cushion to sit on
  const stand = new THREE.Group();
  scene.add(stand);
  mesh(new THREE.CylinderGeometry(1.55, 1.65, 0.32, 48), mat("#b48cff", { roughness: 0.75 }), [0, 0.16, 0], stand, { receive: true });
  mesh(new THREE.TorusGeometry(1.55, 0.14, 14, 48), mat("#9b6bff", { roughness: 0.75 }), [0, 0.3, 0], stand, { rot: [Math.PI / 2, 0, 0], receive: true });
  mesh(new THREE.CylinderGeometry(1.48, 1.48, 0.06, 48), mat("#d9c6ff", { roughness: 0.9 }), [0, 0.33, 0], stand, { receive: true });

  st.onResize = (w, h) => {
    const d = 7.4 * Math.max(1, 1.1 / (w / h));
    cam.position.set(0, 2.3, d);
    cam.lookAt(0, 1.25, 0);
  };

  // big friendly eyes
  function eye(parent, x, y, z, iris) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    mesh(new THREE.SphereGeometry(0.15, 20, 16), mat("#ffffff", { roughness: 0.2 }), [0, 0, 0], g, { scale: [1, 1.1, 0.7] });
    mesh(new THREE.SphereGeometry(0.105, 20, 16), mat(iris, { roughness: 0.25 }), [0, -0.01, 0.075], g, { scale: [1, 1.1, 0.6] });
    mesh(new THREE.SphereGeometry(0.06, 16, 12), mat("#111827", { roughness: 0.2 }), [0, -0.01, 0.12], g, { scale: [1, 1.1, 0.5] });
    mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: "#fff" }), [0.04, 0.045, 0.15], g, { cast: false });
    return g;
  }

  function buildPet(kind) {
    const P = { kind, root: new THREE.Group(), ears: [], tail: null, eyes: [] };
    const C = {
      puppy: { fur: "#e9b27c", belly: "#fff4e6", ear: "#8a5a3c", nose: "#2a1a12", iris: "#6b3a14" },
      kitten: { fur: "#a9b4c9", belly: "#f6f8ff", ear: "#a9b4c9", nose: "#ff8fb1", iris: "#2fae4f" },
      bunny: { fur: "#fbfbff", belly: "#ffffff", ear: "#fbfbff", nose: "#ff8fb1", iris: "#7a3e12" },
    }[kind];
    const fur = mat(C.fur, { roughness: 0.75 }), belly = mat(C.belly, { roughness: 0.8 });
    const root = P.root;
    root.position.y = 0.36;
    // body (sitting) and haunches
    const body = mesh(new THREE.SphereGeometry(0.62, 32, 24), fur, [0, 0.62, -0.05], root, { scale: [1, 1.05, 1] });
    mesh(new THREE.SphereGeometry(0.42, 24, 18), belly, [0, 0.58, 0.32], root, { scale: [1, 1.15, 0.6] });
    [-1, 1].forEach((s) => {
      mesh(new THREE.SphereGeometry(0.32, 20, 16), fur, [s * 0.42, 0.3, -0.05], root, { scale: [0.9, 0.75, 1.25] });
      mesh(new THREE.SphereGeometry(0.15, 16, 12), belly, [s * 0.44, 0.08, 0.38], root, { scale: [1, 0.6, 1.4] });   // back paws
      const leg = mesh(new THREE.CapsuleGeometry(0.11, 0.38, 6, 12), fur, [s * 0.2, 0.28, 0.42], root);
      mesh(new THREE.SphereGeometry(0.13, 16, 12), belly, [s * 0.2, 0.06, 0.48], root, { scale: [1, 0.65, 1.2] });   // front paws
      leg.rotation.x = 0.08;
    });
    P.body = body;
    // head
    const head = new THREE.Group();
    head.position.set(0, 1.42, 0.08);
    root.add(head);
    P.head = head;
    mesh(new THREE.SphereGeometry(0.6, 32, 24), fur, [0, 0, 0], head, { scale: [1.08, 0.96, 0.98] });
    mesh(new THREE.SphereGeometry(0.28, 24, 18), belly, [0, -0.17, 0.42], head, { scale: [1.15, 0.8, 0.8] });   // muzzle
    P.eyes = [eye(head, -0.23, 0.07, 0.48, C.iris), eye(head, 0.23, 0.07, 0.48, C.iris)];
    // cheeks
    [-1, 1].forEach((s) => mesh(new THREE.SphereGeometry(0.08, 12, 10), new THREE.MeshStandardMaterial({ color: "#ff9cc0", transparent: true, opacity: 0.55, roughness: 1 }), [s * 0.38, -0.12, 0.43], head, { scale: [1, 0.6, 0.4], cast: false }));
    if (kind === "puppy") {
      mesh(new THREE.SphereGeometry(0.085, 16, 12), mat(C.nose, { roughness: 0.2 }), [0, -0.08, 0.68], head, { scale: [1.3, 0.9, 0.9] });
      mesh(new THREE.SphereGeometry(0.07, 14, 10), mat("#ff6f8a"), [0, -0.3, 0.6], head, { scale: [1, 1.3, 0.5] });   // tongue
      [-1, 1].forEach((s) => {
        const pivot = new THREE.Group(); pivot.position.set(s * 0.46, 0.3, 0); head.add(pivot);
        mesh(new THREE.SphereGeometry(0.22, 20, 16), mat(C.ear, { roughness: 0.8 }), [s * 0.08, -0.28, 0.02], pivot, { scale: [0.75, 1.45, 0.45], rot: [0, 0, s * 0.25] });
        P.ears.push({ g: pivot, s, base: s * 0.2 });
      });
      // collar with a gold tag
      mesh(new THREE.TorusGeometry(0.4, 0.06, 12, 36), mat("#ff4f6a"), [0, 1.03, 0.04], root, { rot: [Math.PI / 2 - 0.15, 0, 0] });
      mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 20), mat("#ffd23a", { metalness: 0.6, roughness: 0.3 }), [0, 0.92, 0.44], root, { rot: [Math.PI / 2 - 0.2, 0, 0] });
      const tail = new THREE.Group(); tail.position.set(0, 0.45, -0.62); root.add(tail);
      mesh(new THREE.CapsuleGeometry(0.07, 0.38, 6, 10), fur, [0, 0.2, -0.05], tail, { rot: [-0.5, 0, 0] });
      mesh(new THREE.SphereGeometry(0.09, 12, 10), belly, [0, 0.42, -0.17], tail);
      P.tail = tail; P.wag = 9;
    } else if (kind === "kitten") {
      mesh(new THREE.ConeGeometry(0.06, 0.07, 3), mat(C.nose), [0, -0.09, 0.62], head, { rot: [Math.PI + 0.3, 0, 0] });
      [-1, 1].forEach((s) => {
        const pivot = new THREE.Group(); pivot.position.set(s * 0.32, 0.42, 0.02); head.add(pivot);
        mesh(new THREE.ConeGeometry(0.2, 0.38, 4), fur, [0, 0.14, 0], pivot, { rot: [0, Math.PI / 4, s * -0.25] });
        mesh(new THREE.ConeGeometry(0.11, 0.24, 4), mat("#ffb3c9"), [s * -0.01, 0.12, 0.07], pivot, { rot: [0, Math.PI / 4, s * -0.25] });
        P.ears.push({ g: pivot, s, base: 0 });
        for (let k = -1; k <= 1; k++) mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.42, 4), mat("#ffffff"), [s * 0.36, -0.12 + k * 0.05, 0.5], head, { rot: [0, 0, Math.PI / 2 + k * 0.15 * s], cast: false });
      });
      // stripes on the head
      [-0.12, 0, 0.12].forEach((x) => mesh(new THREE.SphereGeometry(0.05, 10, 8), mat("#8592ab"), [x, 0.48, 0.3], head, { scale: [0.6, 1.6, 0.5], rot: [-0.6, 0, 0], cast: false }));
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, 0.25, -0.25), new THREE.Vector3(0.35, 0.65, -0.3), new THREE.Vector3(0.3, 1, -0.1)]);
      const tail = new THREE.Group(); tail.position.set(0, 0.3, -0.58); root.add(tail);
      mesh(new THREE.TubeGeometry(curve, 24, 0.075, 10), fur, [0, 0, 0], tail);
      mesh(new THREE.SphereGeometry(0.075, 12, 10), fur, [0.3, 1, -0.1], tail);
      P.tail = tail; P.wag = 2.2;
    } else {
      mesh(new THREE.SphereGeometry(0.06, 14, 10), mat(C.nose), [0, -0.09, 0.66], head, { scale: [1.3, 0.9, 0.8] });
      [-1, 1].forEach((s) => mesh(new THREE.BoxGeometry(0.07, 0.1, 0.03), mat("#ffffff", { roughness: 0.3 }), [s * 0.04, -0.3, 0.62], head));   // teeth
      [-1, 1].forEach((s) => {
        const pivot = new THREE.Group(); pivot.position.set(s * 0.2, 0.45, -0.02); head.add(pivot);
        mesh(new THREE.CapsuleGeometry(0.13, 0.62, 8, 14), fur, [0, 0.42, 0], pivot, { scale: [1, 1, 0.55] });
        mesh(new THREE.CapsuleGeometry(0.075, 0.5, 6, 12), mat("#ffc2d6"), [0, 0.42, 0.055], pivot, { scale: [1, 1, 0.4] });
        pivot.rotation.z = s * -0.18;
        P.ears.push({ g: pivot, s, base: s * -0.18 });
      });
      const tail = new THREE.Group(); tail.position.set(0, 0.35, -0.62); root.add(tail);
      mesh(new THREE.SphereGeometry(0.2, 18, 14), belly, [0, 0, 0], tail);
      P.tail = tail; P.wag = 5;
    }
    return P;
  }

  const NAMES = { puppy: "Puppy", kitten: "Kitten", bunny: "Bunny" };
  let pet = null, old = null, swapT = -9, jumpT = -9, blinkT = 1;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  function setPet(kind) {
    if (pet && pet.kind === kind) return;
    if (old) scene.remove(old.root);
    old = pet;
    pet = buildPet(kind);
    pet.root.scale.setScalar(0.001);
    scene.add(pet.root);
    swapT = clock.getElapsedTime();
    dispatchEvent(new CustomEvent("petchange", { detail: NAMES[kind] }));
  }
  setPet("puppy");

  const tabs = [...document.querySelectorAll(".pet-tabs [data-pet]")];
  tabs.forEach((b) => (b.onclick = () => { tabs.forEach((x) => x.setAttribute("aria-selected", x === b)); setPet(b.dataset.pet); }));

  const pops = document.getElementById("petPops");
  const hearts = (x, y) => burst(pops, x ?? canvas.clientWidth / 2, y ?? canvas.clientHeight * 0.35, ["💖", "💜", "💕", "⭐", "🦴"].slice(0, pet.kind === "puppy" ? 5 : 4), 8);
  canvas.addEventListener("click", (e) => { const p = pointerOf(e, canvas); jumpT = clock.getElapsedTime(); hearts(p.x, p.y - 30); });
  addEventListener("petlove", () => { jumpT = clock.getElapsedTime(); hearts(); });
  canvas.addEventListener("pointermove", (e) => { const p = pointerOf(e, canvas); mouse.tx = p.nx; mouse.ty = p.ny; });
  canvas.addEventListener("pointerleave", () => { mouse.tx = 0; mouse.ty = 0; });

  st.tick = (t) => {
    mouse.x += (mouse.tx - mouse.x) * 0.08; mouse.y += (mouse.ty - mouse.y) * 0.08;
    stand.rotation.y = t * 0.15;
    // swap: the old pet shrinks away, the new one pops in
    const k = (t - swapT) / 0.55;
    if (old) { const s = Math.max(0.001, 1 - k * 2.2); old.root.scale.setScalar(s); if (s <= 0.001) { scene.remove(old.root); old = null; } }
    const pk = Math.min(1, Math.max(0, (k - 0.25) / 0.75));
    const pop = pk >= 1 ? 1 : 1 + Math.sin(pk * Math.PI * 2.5) * (1 - pk) * 0.35 - (1 - pk) * (1 - pk);
    if (!pet) return;
    const P = pet, br = Math.sin(t * 2.4);
    P.root.scale.setScalar(Math.max(0.001, pop));
    P.body.scale.set(1 + br * 0.015, 1.05 + br * 0.025, 1 + br * 0.015);
    // look toward the mouse (and turn a little to show off)
    P.root.rotation.y = (reduce ? 0 : Math.sin(t * 0.5) * 0.25) + mouse.x * 0.35;
    P.head.rotation.y = mouse.x * 0.35;
    P.head.rotation.x = -mouse.y * 0.2;
    P.head.rotation.z = Math.sin(t * 1.3) * 0.08;
    // happy jump with a spin
    const j = (t - jumpT) / 0.9;
    P.root.position.y = 0.36 + (j >= 0 && j < 1 ? Math.sin(Math.PI * j) * 0.7 : 0);
    if (j >= 0 && j < 1) P.root.rotation.y += ease(j) * TAU;
    // tail and ears
    const excited = j >= 0 && j < 2 ? 2 : 1;
    if (P.tail) P.tail.rotation.z = Math.sin(t * P.wag * excited) * (P.kind === "kitten" ? 0.35 : 0.45);
    P.ears.forEach((e, i) => (e.g.rotation.z = e.base + Math.sin(t * 3 + i) * 0.06 + (j >= 0 && j < 1 ? Math.sin(j * Math.PI) * 0.4 * e.s : 0)));
    // blink
    if (t > blinkT) { const b = (t - blinkT) / 0.16; const s = b < 1 ? Math.abs(1 - 2 * b) : 1; P.eyes.forEach((e) => (e.scale.y = Math.max(0.1, s))); if (b >= 1) blinkT = t + 2 + Math.random() * 3; }
  };
}

/* =====================================================================
   LITTLE 3D SCENES in the feature cards (and the helper by the safety panel).
   One hidden renderer draws each scene, then copies the picture into the card.
   ===================================================================== */
const minis = [];
let miniR = null;
function miniRenderer() {
  if (miniR) return miniR;
  miniR = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  miniR.outputColorSpace = THREE.SRGBColorSpace;
  miniR.toneMapping = THREE.ACESFilmicToneMapping;
  miniR.setClearColor(0x000000, 0);
  return miniR;
}
function miniLights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb3d1, 1.7));
  const d = new THREE.DirectionalLight(0xffffff, 2.1);
  d.position.set(3, 6, 5);
  scene.add(d);
}
// a soft round shadow on the ground
let shadowTex = null;
function blobShadow(parent, r = 0.5, x = 0, z = 0, y = 0.01) {
  if (!shadowTex) {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(0,0,0,.35)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); parent.add(m);
  return m;
}
// a round game piece to stand on
function plate(scene, top, side, r = 1.7) {
  mesh(new THREE.CylinderGeometry(r, r * 0.96, 0.28, 48), mat(side, { roughness: 0.7 }), [0, -0.14, 0], scene, { cast: false });
  mesh(new THREE.CylinderGeometry(r * 0.98, r * 0.98, 0.02, 48), mat(top, { roughness: 0.8 }), [0, 0.005, 0], scene, { cast: false });
}
function makeMini(canvas, build) {
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1.6, 0.1, 60);
  miniLights(scene);
  const M = { canvas, ctx: canvas.getContext("2d"), scene, cam, visible: false, hoverT: -9, tick: null, view: [0, 2.6, 7.2, 0, 0.8, 0] };
  build(M);
  const card = canvas.closest(".feat") || canvas.closest(".helper");
  card && card.addEventListener("pointerenter", () => { M.hoverT = clock.getElapsedTime(); M.hit = true; });
  new IntersectionObserver(([e]) => (M.visible = e.isIntersecting)).observe(canvas);
  minis.push(M);
}
let miniFrame = 0;
function renderMinis(t) {
  miniFrame++;
  for (const M of minis) {
    if (!M.visible) continue;
    const w = M.canvas.clientWidth, h = M.canvas.clientHeight;
    if (!w || !h) continue;
    const pr = Math.min(devicePixelRatio, 2), W = Math.round(w * pr), H = Math.round(h * pr);
    if (M.canvas.width !== W || M.canvas.height !== H) { M.canvas.width = W; M.canvas.height = H; }
    const r = miniRenderer();
    if (r.domElement.width !== W || r.domElement.height !== H) r.setSize(W, H, false);
    if (M.cam.aspect !== w / h) {
      M.cam.aspect = w / h;
      const [x, y, z, lx, ly, lz] = M.view, k = Math.max(1, 1.6 / M.cam.aspect) * (M.zoom || 0.8);
      M.cam.position.set(x * k, y, z * k); M.cam.lookAt(lx, ly, lz); M.cam.updateProjectionMatrix();
    }
    M.tick && M.tick(t, t - M.hoverT < 1.2 ? t - M.hoverT : -1);
    M.hit = false;
    r.render(M.scene, M.cam);
    M.ctx.clearRect(0, 0, W, H);
    M.ctx.drawImage(r.domElement, 0, 0);
  }
}

const SCENES = {
  // walking around a little beach island with a palm tree
  explore(M) {
    const s = M.scene;
    plate(s, "#6fdc7c", "#3fae55");
    mesh(new THREE.CircleGeometry(1.66, 40, -0.2, Math.PI * 0.9), mat("#ffe2a1", { roughness: 0.9 }), [0, 0.02, 0], s, { rot: [-Math.PI / 2, 0, 0], cast: false });
    const palm = new THREE.Group(); palm.position.set(-0.85, 0, -0.55); s.add(palm);
    for (let i = 0; i < 6; i++) mesh(new THREE.CylinderGeometry(0.09 - i * 0.006, 0.11 - i * 0.006, 0.3, 10), mat(i % 2 ? "#b77a43" : "#a0663a"), [i * 0.035, 0.15 + i * 0.28, 0], palm, { rot: [0, 0, -0.08] });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; const leaf = mesh(new THREE.SphereGeometry(0.45, 14, 8), mat("#2fbf55", { roughness: 0.7 }), [0.2 + Math.cos(a) * 0.38, 1.8, Math.sin(a) * 0.38], palm, { scale: [1, 0.12, 0.32] }); leaf.rotation.set(0, -a, -0.45); }
    [[0.15, 1.68, 0.1], [0.3, 1.66, -0.08]].forEach((p) => mesh(new THREE.SphereGeometry(0.08, 10, 8), mat("#7a4a22"), p, palm));
    blobShadow(s, 0.5, -0.85, -0.55);
    // a starfish and a ball on the sand
    mesh(new THREE.ExtrudeGeometry((() => { const sh = new THREE.Shape(); for (let i = 0; i <= 10; i++) { const a = (i / 10) * TAU, r = i % 2 ? 0.07 : 0.17; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return sh; })(), { depth: 0.04, bevelEnabled: false }), mat("#ff7a59"), [0.9, 0.03, 0.75], s, { rot: [-Math.PI / 2, 0, 0.4] });
    const ball = mesh(new THREE.SphereGeometry(0.17, 18, 14), mat("#ff4f6a"), [1.1, 0.17, -0.2], s);
    mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 24), mat("#ffffff"), [0, 0, 0], ball, { rot: [0, Math.PI / 2, 0] });
    M.view = [0, 2.8, 7.4, 0, 0.85, 0];
    BLOBBY.then((b) => {
      const J = makeBlobby(b, "#ff8a1c"); J.root.scale.setScalar(0.7); s.add(J.root);
      const sh = blobShadow(s, 0.38);
      M.tick = (t, hov) => {
        const a = t * 0.7, r = 0.75;
        J.root.position.x = 0.35 + Math.cos(a) * r; J.root.position.z = 0.25 + Math.sin(a) * r * 0.6;
        J.root.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a) * 0.6);   // face the way it walks
        sh.position.set(J.root.position.x, 0.012, J.root.position.z);
        if (M.hit) J.hopT = t;
        liveBlobby(J, t, { hop: 0.6 });
        J.root.position.y += Math.abs(Math.sin(t * 8)) * 0.05;
        J.armL.rotation.x = Math.sin(t * 8) * 0.5; J.armR.rotation.x = -Math.sin(t * 8) * 0.5;
        ball.rotation.z = t; ball.position.y = 0.17 + Math.abs(Math.sin(t * 3)) * 0.08;
      };
    });
  },
  // Fruit Catch: apples fall into a moving basket, coins pop out
  coins(M) {
    const s = M.scene;
    plate(s, "#ffd890", "#e8a64a");
    const basket = new THREE.Group(); s.add(basket);
    mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.36, 24, 1, true), mat("#c27a3a", { side: THREE.DoubleSide, roughness: 0.8 }), [0, 0.2, 0], basket);
    mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 24), mat("#a0663a"), [0, 0.03, 0], basket);
    mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 28), mat("#8a5a2c"), [0, 0.38, 0], basket, { rot: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < 3; i++) mesh(new THREE.TorusGeometry(0.37 - i * 0.025, 0.018, 6, 28), mat("#a0663a"), [0, 0.12 + i * 0.1, 0], basket, { rot: [Math.PI / 2, 0, 0] });
    const bShadow = blobShadow(s, 0.5);
    const apples = Array.from({ length: 4 }, (_, i) => {
      const g = new THREE.Group(); s.add(g);
      const gold = i === 2;
      mesh(new THREE.SphereGeometry(0.16, 18, 14), mat(gold ? "#ffcc1a" : "#ff3b3b", gold ? { metalness: 0.6, roughness: 0.3, emissive: "#6b4a00", emissiveIntensity: 0.4 } : {}), [0, 0, 0], g, { scale: [1, 0.92, 1] });
      mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 5), mat("#6b3a14"), [0, 0.17, 0], g);
      mesh(new THREE.SphereGeometry(0.06, 8, 6), mat("#2fbf55"), [0.06, 0.18, 0], g, { scale: [1.4, 0.4, 0.8] });
      return g;
    });
    const coin = new THREE.Group(); s.add(coin);
    mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24), mat("#ffc400", { metalness: 0.6, roughness: 0.3, emissive: "#6b4a00", emissiveIntensity: 0.35 }), [0, 0, 0], coin, { rot: [Math.PI / 2, 0, 0] });
    M.view = [0, 2.6, 7.2, 0, 0.95, 0];
    const bx = (t) => Math.sin(t * 1.3) * 0.9;
    M.tick = (t, hov) => {
      const sp = hov >= 0 ? 1.6 : 1;
      basket.position.x = bx(t); bShadow.position.x = basket.position.x;
      apples.forEach((a, i) => {
        const P = 1.6, ph = ((t * sp) / P + i / 4) % 1, land = t + (1 - ph) * P / sp;
        a.position.set(bx(land), 2.6 - ph * 2.3, 0); a.rotation.z = ph * 4; a.visible = ph < 0.97;
      });
      const cp = (t * 0.9) % 1; coin.position.set(basket.position.x, 0.5 + cp * 1.4, 0); coin.rotation.y = t * 6; coin.scale.setScalar(cp < 0.8 ? 1 : 1 - (cp - 0.8) * 5);
    };
    BLOBBY.then((b) => {
      const J = makeBlobby(b, "#2fd36b", "#2a7fff"); J.root.scale.setScalar(0.64); J.root.position.set(-1.05, 0, -0.75); J.root.rotation.y = 0.5; s.add(J.root);
      blobShadow(s, 0.35, -1.05, -0.75);
      const prev = M.tick;
      M.tick = (t, hov) => { prev(t, hov); if (t - J.hopT > 1.4) J.hopT = t; liveBlobby(J, t, { hop: 0.55, hopH: 0.3, wave: true }); };
    });
  },
  // a cosy corner of a Jumpi home
  home(M) {
    const s = M.scene;
    mesh(new THREE.BoxGeometry(3, 0.16, 2.6), mat("#d9a066", { roughness: 0.8 }), [0, -0.08, 0], s, { cast: false });
    for (let i = -1; i <= 1; i += 0.5) mesh(new THREE.BoxGeometry(0.01, 0.002, 2.6), mat("#b98149"), [i, 0.001, 0], s, { cast: false });
    mesh(new THREE.BoxGeometry(3, 1.9, 0.12), mat("#ffb3cf", { roughness: 0.9 }), [0, 0.95, -1.3], s, { cast: false });
    mesh(new THREE.BoxGeometry(0.12, 1.9, 2.6), mat("#9fdcff", { roughness: 0.9 }), [-1.5, 0.95, 0], s, { cast: false });
    // a window and a picture
    mesh(new THREE.BoxGeometry(0.75, 0.6, 0.04), mat("#ffffff"), [0.7, 1.15, -1.23], s, { cast: false });
    mesh(new THREE.BoxGeometry(0.65, 0.5, 0.03), mat("#7ddcff", { emissive: "#3fa9e6", emissiveIntensity: 0.4 }), [0.7, 1.15, -1.2], s, { cast: false });
    mesh(new THREE.BoxGeometry(0.03, 0.6, 0.6), mat("#ffd23a"), [-1.43, 1.2, -0.2], s, { cast: false });
    mesh(new THREE.CircleGeometry(0.18, 20), mat("#ff8a1c"), [-1.41, 1.2, -0.2], s, { rot: [0, Math.PI / 2, 0], cast: false });
    // rug, sofa, lamp, plant
    mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.02, 40), mat("#8a4dff", { roughness: 0.95 }), [0.25, 0.01, 0.35], s, { cast: false });
    const sofa = new THREE.Group(); sofa.position.set(-0.25, 0, -0.75); s.add(sofa);
    const sm = mat("#ff8a1c", { roughness: 0.8 });
    mesh(new THREE.BoxGeometry(1.4, 0.32, 0.62), sm, [0, 0.2, 0], sofa);
    mesh(new THREE.BoxGeometry(1.4, 0.5, 0.18), sm, [0, 0.55, -0.24], sofa);
    [-0.72, 0.72].forEach((x) => mesh(new THREE.BoxGeometry(0.16, 0.48, 0.62), sm, [x, 0.3, 0], sofa));
    [-0.33, 0.33].forEach((x) => mesh(new THREE.BoxGeometry(0.62, 0.1, 0.5), mat("#ffb05e"), [x, 0.41, 0.04], sofa));
    const lamp = new THREE.Group(); lamp.position.set(0.95, 0, -0.85); s.add(lamp);
    mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 16), mat("#3e5b86"), [0, 0.02, 0], lamp);
    mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 8), mat("#3e5b86"), [0, 0.57, 0], lamp);
    const shade = mesh(new THREE.CylinderGeometry(0.14, 0.26, 0.3, 20), mat("#ffe27a", { emissive: "#ffcc33", emissiveIntensity: 0.8 }), [0, 1.2, 0], lamp);
    const pot = new THREE.Group(); pot.position.set(-1.1, 0, 0.75); s.add(pot);
    mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.28, 16), mat("#e8423b"), [0, 0.14, 0], pot);
    [[0, 0.45, 0, 0.2], [-0.1, 0.38, 0.08, 0.15], [0.1, 0.4, -0.05, 0.16]].forEach(([x, y, z, r]) => mesh(new THREE.SphereGeometry(r, 14, 10), mat("#2fbf55"), [x, y, z], pot));
    M.view = [2.6, 2.7, 5.6, 0, 0.55, -0.1]; M.zoom = 0.92;
    BLOBBY.then((b) => {
      const J = makeBlobby(b, "#1fb6ff", "#2fae4f"); J.root.scale.setScalar(0.48); J.baseY = 0.3; J.root.position.set(-0.25, 0.3, -0.78); s.add(J.root);
      M.tick = (t, hov) => { if (M.hit) J.hopT = t; liveBlobby(J, t, { hop: 0.6, hopH: 0.3 }); J.head.rotation.z = Math.sin(t * 1.4) * 0.12; shade.material.emissiveIntensity = 0.7 + Math.sin(t * 2) * 0.1; };
    });
  },
  // the Jumpi Phone with the app grid
  phone(M) {
    const s = M.scene;
    plate(s, "#d7c2ff", "#9b6bff");
    const c = document.createElement("canvas"); c.width = 256; c.height = 512;
    const g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#7b5cff"); gr.addColorStop(1, "#1fb6ff");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
    g.fillStyle = "#fff"; g.font = "bold 22px Fredoka, sans-serif"; g.fillText("12:00", 18, 34); g.fillRect(200, 18, 34, 16);
    g.font = "64px 'Lilita One', sans-serif"; g.textAlign = "center"; g.fillText("12:00", 128, 130);
    const apps = [["#2fd36b", "💬"], ["#1fb6ff", "👥"], ["#ff9a1f", "🏠"], ["#ff5fb4", "🐶"], ["#8a4dff", "🎵"], ["#ffd23a", "👕"], ["#ff5f5f", "🛍️"], ["#12b8a0", "🌐"]];
    g.font = "34px sans-serif"; g.textBaseline = "middle";
    apps.forEach(([col, em], i) => {
      const x = 28 + (i % 3) * 72, y = 190 + Math.floor(i / 3) * 86;
      g.fillStyle = col; g.beginPath(); g.roundRect(x, y, 56, 56, 16); g.fill();
      g.fillText(em, x + 28, y + 30);
    });
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const phone = new THREE.Group(); phone.position.set(0.45, 1.25, 0); s.add(phone);
    mesh(new THREE.BoxGeometry(0.95, 1.85, 0.12), mat("#1d2b4f", { roughness: 0.3 }), [0, 0, 0], phone);
    mesh(new THREE.PlaneGeometry(0.85, 1.72), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), [0, 0, 0.065], phone, { cast: false });
    // chat bubbles popping out of the phone
    const bubbles = [0, 1, 2].map((i) => { const b = new THREE.Group(); s.add(b);
      mesh(new THREE.SphereGeometry(0.16, 16, 12), mat(i === 1 ? "#2fd36b" : "#ffffff"), [0, 0, 0], b, { scale: [1.4, 1, 0.5] });
      [-0.08, 0, 0.08].forEach((x) => mesh(new THREE.SphereGeometry(0.025, 8, 6), mat(i === 1 ? "#ffffff" : "#8a97b8"), [x, 0, 0.08], b, { cast: false }));
      return b; });
    blobShadow(s, 0.5, 0.45, 0);
    M.view = [0, 2.3, 7.4, 0, 1.05, 0];
    M.tick = (t) => {
      phone.rotation.y = -0.35 + Math.sin(t * 0.9) * 0.25; phone.position.y = 1.25 + Math.sin(t * 1.5) * 0.06;
      bubbles.forEach((b, i) => { const k = ((t * 0.5) + i / 3) % 1; b.position.set(0.95 + Math.sin(k * 6 + i) * 0.15, 1.1 + k * 1.3, 0.3); b.scale.setScalar(k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1); });
    };
    BLOBBY.then((b) => {
      const J = makeBlobby(b, "#ff5fb4", "#8a4dff"); J.root.scale.setScalar(0.55); J.root.position.set(-0.85, 0, 0.3); J.root.rotation.y = 0.45; s.add(J.root);
      blobShadow(s, 0.35, -0.85, 0.3);
      const prev = M.tick;
      M.tick = (t, hov) => { prev(t, hov); if (M.hit) J.hopT = t; liveBlobby(J, t, { wave: true }); };
    });
  },
  // Tic-Tac-Toe: pieces pop onto the board one by one
  duel(M) {
    const s = M.scene;
    const board = new THREE.Group(); board.rotation.y = 0.25; s.add(board);
    mesh(new THREE.BoxGeometry(2, 0.18, 2), mat("#2c4468", { roughness: 0.6 }), [0, 0.09, 0], board);
    const tiles = [];
    for (let i = 0; i < 9; i++) tiles.push(mesh(new THREE.BoxGeometry(0.56, 0.08, 0.56), mat("#e9f2ff", { roughness: 0.5 }), [((i % 3) - 1) * 0.62, 0.22, (Math.floor(i / 3) - 1) * 0.62], board));
    const xMat = mat("#1f9bff", { roughness: 0.4 }), oMat = mat("#ff8a1c", { roughness: 0.4 });
    const ORDER = [4, 0, 2, 6, 8, 1, 7];   // X wins down the middle
    const pieces = ORDER.map((cell, i) => {
      const g = new THREE.Group(); g.position.set(((cell % 3) - 1) * 0.62, 0.3, (Math.floor(cell / 3) - 1) * 0.62); board.add(g);
      if (i % 2 === 0) { [0.785, -0.785].forEach((r) => mesh(new THREE.BoxGeometry(0.46, 0.1, 0.11), xMat, [0, 0.05, 0], g, { rot: [0, r, 0] })); }
      else mesh(new THREE.TorusGeometry(0.17, 0.055, 12, 28), oMat, [0, 0.06, 0], g, { rot: [Math.PI / 2, 0, 0] });
      return g;
    });
    const winLine = mesh(new THREE.BoxGeometry(0.08, 0.05, 1.7), mat("#ffd23a", { emissive: "#ffb300", emissiveIntensity: 0.9 }), [0, 0.42, 0], board, { rot: [0, 0, 0] });
    M.view = [0, 3.6, 6.4, 0, 0.3, 0]; M.zoom = 0.85;
    M.tick = (t, hov) => {
      const step = (t * (hov >= 0 ? 2.4 : 1.6)) % 10;
      pieces.forEach((p, i) => { const k = step - i; const sc = k < 0 ? 0 : k < 0.4 ? Math.sin((k / 0.4) * Math.PI * 0.5) * (1 + 0.3 * Math.sin((k / 0.4) * Math.PI)) : 1; p.scale.setScalar(Math.max(0.001, sc)); p.position.y = 0.3 + (k > 0 && k < 0.4 ? (0.4 - k) * 0.8 : 0); });
      const wl = step - pieces.length;
      winLine.scale.z = wl < 0 ? 0.001 : Math.min(1, wl * 2.5);
      winLine.visible = wl >= 0;
      tiles.forEach((tl, i) => (tl.position.y = 0.22 + (wl > 0 && (i === 1 || i === 4 || i === 7) ? Math.abs(Math.sin(t * 6 + i)) * 0.06 : 0)));
    };
  },
  // two friends swap items
  trade(M) {
    const s = M.scene;
    plate(s, "#8ff0dc", "#12b8a0");
    const gift = new THREE.Group(); s.add(gift);
    mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34), mat("#ff4f6a"), [0, 0, 0], gift);
    mesh(new THREE.BoxGeometry(0.08, 0.32, 0.36), mat("#ffd23a"), [0, 0, 0], gift);
    mesh(new THREE.BoxGeometry(0.36, 0.32, 0.08), mat("#ffd23a"), [0, 0, 0], gift);
    const star = new THREE.Group(); s.add(star);
    const sh = new THREE.Shape(); for (let i = 0; i <= 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? 0.1 : 0.24; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }), mat("#ffd23a", { metalness: 0.4, roughness: 0.3, emissive: "#a36a00", emissiveIntensity: 0.4 }), [0, 0, -0.04], star);
    M.view = [0, 2.4, 7.4, 0, 0.9, 0];
    BLOBBY.then((b) => {
      const A = makeBlobby(b, "#ff5fb4", "#8a4dff"), B = makeBlobby(b, "#1fb6ff", "#2fae4f");
      [[A, -0.95, 0.9], [B, 0.95, -0.9]].forEach(([J, x, ry]) => { J.root.scale.setScalar(0.74); J.root.position.x = x; J.root.rotation.y = ry; s.add(J.root); blobShadow(s, 0.36, x, 0); });
      M.tick = (t, hov) => {
        const P = hov >= 0 ? 1.6 : 2.4, k = (t % P) / P, e = k < 0.7 ? ease(k / 0.7) : 1;
        gift.position.set(-0.6 + e * 1.2, 1.25 + Math.sin(e * Math.PI) * 0.7, 0.15); gift.rotation.y = e * TAU;
        star.position.set(0.6 - e * 1.2, 1.25 + Math.sin(e * Math.PI) * 0.45, -0.15); star.rotation.y = -e * TAU;
        if (k > 0.72 && t - A.hopT > P * 0.5) { A.hopT = t; B.hopT = t + 0.08; }
        liveBlobby(A, t, { hop: 0.45, hopH: 0.25 }); liveBlobby(B, t, { hop: 0.45, hopH: 0.25 });
      };
    });
  },
  // a present that bursts open with coins
  gift(M) {
    const s = M.scene;
    plate(s, "#ffe08a", "#e0a400");
    const box = new THREE.Group(); s.add(box);
    mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), mat("#ff4f6a"), [0, 0.35, 0], box);
    mesh(new THREE.BoxGeometry(0.18, 0.72, 0.92), mat("#ffd23a"), [0, 0.35, 0], box);
    mesh(new THREE.BoxGeometry(0.92, 0.72, 0.18), mat("#ffd23a"), [0, 0.35, 0], box);
    const lid = new THREE.Group(); lid.position.y = 0.7; box.add(lid);
    mesh(new THREE.BoxGeometry(1.0, 0.2, 1.0), mat("#ff6f86"), [0, 0.1, 0], lid);
    mesh(new THREE.BoxGeometry(0.2, 0.22, 1.02), mat("#ffd23a"), [0, 0.1, 0], lid);
    mesh(new THREE.BoxGeometry(1.02, 0.22, 0.2), mat("#ffd23a"), [0, 0.1, 0], lid);
    [-1, 1].forEach((sd) => mesh(new THREE.TorusGeometry(0.15, 0.05, 8, 18), mat("#ffd23a"), [sd * 0.13, 0.32, 0], lid, { rot: [0, 0, sd * -0.6] }));
    blobShadow(s, 0.75);
    const coinMat = mat("#ffc400", { metalness: 0.6, roughness: 0.3, emissive: "#6b4a00", emissiveIntensity: 0.35 });
    const coins = Array.from({ length: 7 }, (_, i) => { const c = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 20), coinMat, [0, 0, 0], s); c.userData = { a: (i / 7) * TAU, v: 0.8 + (i % 3) * 0.25 }; return c; });
    const conf = Array.from({ length: 12 }, (_, i) => { const c = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.015), mat(["#ff5fb4", "#1fb6ff", "#2fd36b", "#8a4dff"][i % 4]), [0, 0, 0], s, { cast: false }); c.userData = { a: (i / 12) * TAU + 0.2, v: 1 + (i % 4) * 0.2 }; return c; });
    M.view = [0, 2.6, 7.2, 0, 0.85, 0];
    M.tick = (t, hov) => {
      const P = 3, k = ((hov >= 0 ? t * 1.6 : t) % P) / P;
      const open = k > 0.25 && k < 0.85, ok = (k - 0.25) / 0.6;
      lid.position.y = 0.7 + (open ? Math.sin(Math.min(1, ok * 3) * Math.PI * 0.5) * 0.6 * (ok < 0.8 ? 1 : (1 - ok) / 0.2) : 0);
      lid.rotation.z = open ? Math.sin(ok * Math.PI) * 0.5 : 0;
      box.scale.set(1, k < 0.25 ? 1 - Math.abs(Math.sin(k * 60)) * 0.04 : 1, 1);
      box.rotation.z = k < 0.25 ? Math.sin(t * 30) * 0.03 * (k / 0.25) : 0;
      [...coins, ...conf].forEach((c) => {
        const u = c.userData, f = open ? ok : 0, x = Math.cos(u.a) * f * u.v, z = Math.sin(u.a) * f * u.v * 0.5;
        c.visible = open; c.position.set(x, 0.9 + f * 3.2 * u.v - f * f * 3.6, z); c.rotation.set(t * 5 + u.a, t * 4, 0);
      });
    };
  },
  // dress up: colours and hats change on a turntable
  dress(M) {
    const s = M.scene;
    plate(s, "#ffb3b3", "#e8423b");
    const turn = new THREE.Group(); s.add(turn);
    blobShadow(s, 0.6);
    M.view = [0, 2.2, 7.2, 0, 1.15, 0];
    BLOBBY.then((b) => {
      const SC = 0.86, J = makeBlobby(b, "#ff8a1c"); J.root.scale.setScalar(SC); turn.add(J.root);
      // where the head and eyes are (for the hats and sunglasses)
      J.root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(J.head), top = box.max.y / SC, eyeL = new THREE.Vector3(), eyeR = new THREE.Vector3();
      J.eyeL.getWorldPosition(eyeL); J.eyeR.getWorldPosition(eyeR);
      const toLocal = (v) => J.head.worldToLocal(v.clone());
      const hats = new THREE.Group(); J.head.add(hats);
      const headTop = J.head.worldToLocal(new THREE.Vector3(0, top * SC, 0));
      // party hat
      const party = new THREE.Group(); party.position.copy(headTop); party.position.y -= 0.12; hats.add(party);
      mesh(new THREE.ConeGeometry(0.32, 0.7, 24), mat("#8a4dff"), [0, 0.35, 0], party);
      [0.12, 0.32].forEach((y) => mesh(new THREE.TorusGeometry(0.29 - y * 0.42, 0.03, 6, 24), mat("#ffd23a"), [0, y, 0], party, { rot: [Math.PI / 2, 0, 0] }));
      mesh(new THREE.SphereGeometry(0.08, 10, 8), mat("#ff5fb4"), [0, 0.72, 0], party);
      // crown
      const crown = new THREE.Group(); crown.position.copy(headTop); crown.position.y -= 0.1; hats.add(crown);
      const gold = mat("#ffc400", { metalness: 0.6, roughness: 0.3, emissive: "#6b4a00", emissiveIntensity: 0.4 });
      mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.16, 24, 1, true), gold, [0, 0.08, 0], crown).material.side = THREE.DoubleSide;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; mesh(new THREE.ConeGeometry(0.07, 0.2, 8), gold, [Math.cos(a) * 0.33, 0.25, Math.sin(a) * 0.33], crown); mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(["#ff4f6a", "#1fb6ff", "#2fd36b"][i % 3]), [Math.cos(a) * 0.345, 0.08, Math.sin(a) * 0.345], crown, { cast: false }); }
      // sunglasses
      const shades = new THREE.Group(); hats.add(shades);
      const L = toLocal(eyeL), R = toLocal(eyeR), lensMat = mat("#14141a", { roughness: 0.2, metalness: 0.3 });
      [L, R].forEach((p) => mesh(new THREE.BoxGeometry(0.26, 0.17, 0.04), lensMat, [p.x, p.y, p.z + 0.1], shades));
      mesh(new THREE.BoxGeometry(Math.abs(R.x - L.x), 0.03, 0.03), lensMat, [(L.x + R.x) / 2, L.y + 0.05, L.z + 0.1], shades);
      const LOOKS = [["#ff8a1c", party, true], ["#1fb6ff", crown, false], ["#ff5fb4", null, true], ["#2fd36b", crown, true], ["#ffd23a", party, false], ["#9b5cff", null, true]];
      let cur = -1;
      M.tick = (t, hov) => {
        const P = hov >= 0 ? 0.8 : 1.6, i = Math.floor(t / P) % LOOKS.length, k = (t % P) / P;
        if (i !== cur) { cur = i; const [col, hat, gl] = LOOKS[i]; J.skinMats.forEach((m) => m.color.set(col)); party.visible = hat === party; crown.visible = hat === crown; shades.visible = gl; J.hopT = t; }
        turn.rotation.y = Math.sin(t * 0.8) * 0.6;
        const pop = k < 0.15 ? 1 + Math.sin((k / 0.15) * Math.PI) * 0.12 : 1;
        J.root.scale.set(SC * pop, SC / pop, SC * pop);
        liveBlobby(J, t, { hop: 0.35, hopH: 0.18 });
      };
    });
  },
  // the friendly helper next to the safety settings
  helper(M) {
    const s = M.scene;
    plate(s, "#c9ecff", "#7ccbf2", 1.4);
    M.view = [0, 1.7, 6.6, 0, 1.15, 0]; M.zoom = 0.78;
    BLOBBY.then((b) => {
      const J = makeBlobby(b, "#1fb6ff", "#2fae4f"); s.add(J.root); blobShadow(s, 0.6);
      // a little shield badge
      const badge = new THREE.Group(); s.add(badge);
      const sh = new THREE.Shape(); sh.moveTo(0, 0.22); sh.lineTo(0.18, 0.15); sh.lineTo(0.18, -0.02); sh.quadraticCurveTo(0.16, -0.18, 0, -0.26); sh.quadraticCurveTo(-0.16, -0.18, -0.18, -0.02); sh.lineTo(-0.18, 0.15); sh.closePath();
      mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), mat("#2fd36b", { roughness: 0.4 }), [0, 0, 0], badge);
      M.tick = (t, hov) => {
        if (M.hit) J.hopT = t;
        liveBlobby(J, t, { wave: Math.sin(t * 0.8) > 0 });
        J.root.rotation.y = Math.sin(t * 0.6) * 0.25;
        badge.position.set(0.95, 1.5 + Math.sin(t * 2) * 0.1, 0.3); badge.rotation.y = Math.sin(t * 1.2) * 0.6;
      };
    });
  },
};
document.querySelectorAll("canvas.mini").forEach((c) => SCENES[c.dataset.scene] && makeMini(c, SCENES[c.dataset.scene]));

requestAnimationFrame(loop);
