/*
  "Worlds in a Box" (company-box.html): every Jumpi Games game is a collector's toy box. One 3D scene behind the page;
  the scroll plays it:
  - Opening: the boxes stand together with a Jumpi, a Puff and bright toy shapes; they lean toward the mouse.
  - Each game: its box comes close, turns, the lid opens, confetti, and the game's world rises out of it, bigger than
    the box; the box steps aside and the game's card appears.
  - The future: three wrapped mystery boxes that rattle (hover or tap one and it peeks).
  - The end: the characters jump around the last words.
  The words are real HTML; the 3D is only a picture behind them. No 3D: the page still reads in full. Less motion
  (the system setting or the accessibility menu): nothing floats or bounces; the scroll still opens the boxes.
*/
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const root = document.documentElement;
const calm = () => !!window.JUMPI_REDUCE_MOTION || matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const mix = (a, b, k) => a + (b - a) * k;
const backOut = (v) => { v = clamp(v); const c = 1.6; return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2); };
const rnd = (i, k = 0) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };
const he = () => root.lang === "he";
const L2 = (en, hb) => (he() ? hb : en);

/* ---------- the page: scenes, what shows when, the room's colour ---------- */
const scenes = [...document.querySelectorAll("[data-scene]")];
const sceneY = (i, t) => { const s = scenes[i]; return s ? s.offsetTop + t * Math.max(0, s.offsetHeight - innerHeight) : 0; };
const shows = [...document.querySelectorAll(".bx-show")].map((el) => { const [a, b] = el.dataset.show.split(",").map(Number); return { el, i: scenes.indexOf(el.closest("[data-scene]")), a, b }; });
const steps = [...document.querySelectorAll(".bx-steps li")];
const ramp = (t, a, b, e = .05) => smooth((t - a) / e) * (b >= 1 ? 1 : 1 - smooth((t - b) / e));
const state = { t: [] };
function readScroll() {
  const vh = innerHeight, y = scrollY;
  scenes.forEach((s, i) => { const t = clamp((y - s.offsetTop) / Math.max(1, s.offsetHeight - vh)); state.t[i] = t; s.style.setProperty("--t", t.toFixed(4)); });
  for (const s of shows) { const v = ramp(state.t[s.i] || 0, s.a, s.b); s.el.style.setProperty("--v", v.toFixed(3)); s.el.classList.toggle("off", v < .005); }
  const near = (i) => { const s = scenes[i]; if (!s) return 0; const a = s.offsetTop - vh * .7, b = s.offsetTop + s.offsetHeight - vh * .3; return smooth((y - a) / (vh * .5)) * (1 - smooth((y - b) / (vh * .5))); };
  root.style.setProperty("--g0", Math.max(near(0), near(4) * .7).toFixed(3));
  root.style.setProperty("--g1", near(1).toFixed(3)); root.style.setProperty("--g2", near(2).toFixed(3)); root.style.setProperty("--g3", near(5).toFixed(3));
  root.style.setProperty("--logo", smooth((y - vh * .6) / (vh * .3)).toFixed(3));
  steps.forEach((li) => li.style.setProperty("--draw", smooth((vh * .92 - li.getBoundingClientRect().top) / (vh * .35)).toFixed(3)));
}
addEventListener("scroll", readScroll, { passive: true });
addEventListener("resize", readScroll);
addEventListener("gd:lang", () => readScroll());
readScroll();
const go = (i, t = 0) => scrollTo({ top: sceneY(i, t), behavior: calm() ? "auto" : "smooth" });
document.querySelectorAll('[data-go="games"]').forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); go(1, 0); }));

/* ---------- drawing on canvases (the boxes' printed faces) ---------- */
const imgs = {};
const loadImg = (k, src) => new Promise((ok) => { const i = new Image(); i.onload = () => { imgs[k] = i; ok(); }; i.onerror = ok; i.src = src; });
const redraws = [];
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const re = () => { const x = c.getContext("2d"); x.clearRect(0, 0, w, h); x.save(); draw(x, w, h); x.restore(); t.needsUpdate = true; };
  redraws.push(re); re(); return t;
}
const rr = (x, X, Y, W, H, r) => { x.beginPath(); x.roundRect ? x.roundRect(X, Y, W, H, r) : x.rect(X, Y, W, H); };
const ROUND = '"Fredoka","Heebo",sans-serif';
function text(x, s, X, Y, size, { w = 700, col = "#fff", maxW = 9999, align = "center", stroke = null, sw = 0, font = ROUND } = {}) {
  let f = size; x.font = `${w} ${f}px ${font}`; while (x.measureText(s).width > maxW && f > 8) { f -= 2; x.font = `${w} ${f}px ${font}`; }
  x.textAlign = align; x.textBaseline = "middle"; x.direction = /[֐-׿]/.test(s) ? "rtl" : "ltr";
  if (stroke) { x.lineJoin = "round"; x.strokeStyle = stroke; x.lineWidth = sw; x.strokeText(s, X, Y); }
  x.fillStyle = col; x.fillText(s, X, Y);
}
function burst(x, X, Y, r, col, n = 14) { x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, rr2 = i % 2 ? r * .78 : r; x.lineTo(X + Math.cos(a) * rr2, Y + Math.sin(a) * rr2); } x.closePath(); x.fillStyle = col; x.fill(); }

/* the two games' boxes, printed */
const GAMES = {
  jumpi: { logo: "jumpi", base: ["#7fdcff", "#1fb6ff", "#0f8fd8"], deep: "#0a4f8a", band: "#13235a", accent: "#ffc23a", pop: "#ff5a9a", side: "#1fb6ff", liner: "#dff5ff",
    name: ["JUMPI", "ג'אמפי"], kind: ["3D VIRTUAL WORLD", "עולם וירטואלי בתלת־ממד"], badge: ["NEW!", "חדש!"], dot: ["6+", "6+"], dotSub: ["AGES", "גיל"], num: "01" },
  puff: { logo: "puff", base: ["#e6ffb0", "#b6f0ff", "#8af4ff"], deep: "#3d7a8a", band: "#4a2fb0", accent: "#ff9be6", pop: "#d8ff6e", side: "#8af4ff", liner: "#f3ffd8",
    name: ["PUFFBALL", "פאפבול"], kind: ["BUBBLE SOCCER", "כדורגל בועות"], badge: ["BOUNCY!", "קופצני!"], dot: ["0", "0"], dotSub: ["DOWNLOADS", "הורדות"], num: "02" },
};
const WIN = { x: .11, y: .25, w: .78, h: .47 };   // the window in the front, as parts of the face
function drawFront(x, w, h, g) {
  const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, g.base[0]); gr.addColorStop(.5, g.base[1]); gr.addColorStop(1, g.base[2]); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  // light rays from the top
  x.save(); x.translate(w / 2, h * .12); x.globalAlpha = .16; x.fillStyle = "#fff";
  for (let i = 0; i < 16; i++) { x.rotate(Math.PI / 8); x.beginPath(); x.moveTo(0, 0); x.lineTo(-60, h * 1.2); x.lineTo(60, h * 1.2); x.fill(); } x.restore();
  // a pattern: clouds for Jumpi, bubbles for Puffball
  for (let i = 0; i < 26; i++) { const X = rnd(i, 3) * w, Y = rnd(i, 4) * h, r = 10 + rnd(i, 5) * 34;
    x.globalAlpha = .28; if (g.logo === "puff") { x.strokeStyle = "#fff"; x.lineWidth = 4; x.beginPath(); x.arc(X, Y, r, 0, 7); x.stroke(); }
    else { x.fillStyle = "#fff"; x.beginPath(); x.arc(X, Y, r, 0, 7); x.arc(X + r, Y + 4, r * .7, 0, 7); x.arc(X - r * .9, Y + 6, r * .6, 0, 7); x.fill(); } }
  x.globalAlpha = 1;
  // the logo
  const L = imgs[g.logo]; if (L) { const lw = w * (g.logo === "puff" ? .8 : .6), lh = lw * L.height / L.width; x.shadowColor = "rgba(0,0,0,.22)"; x.shadowBlur = 18; x.shadowOffsetY = 8; x.drawImage(L, (w - lw) / 2, h * .135 - lh / 2, lw, lh); x.shadowColor = "transparent"; }
  // the band at the bottom: what it is, and the series
  rr(x, w * .05, h * .765, w * .9, h * .2, 34); x.fillStyle = g.band; x.fill();
  text(x, L2(g.kind[0], g.kind[1]), w / 2, h * .832, 64, { maxW: w * .8 });
  text(x, L2(`SERIES 01 · WORLD ${g.num} · WORLDS IN A BOX`, `סדרה 01 · עולם ${g.num} · עולמות באריזה`), w / 2, h * .91, 28, { w: 600, col: "rgba(255,255,255,.75)", maxW: w * .82 });
  // the window: cut out, with a thick white frame
  const X = w * WIN.x, Y = h * WIN.y, W = w * WIN.w, H = h * WIN.h;
  rr(x, X - 16, Y - 16, W + 32, H + 32, 56); x.fillStyle = "#fff"; x.fill();
  rr(x, X - 16, Y - 16, W + 32, H + 32, 56); x.strokeStyle = "rgba(0,0,0,.18)"; x.lineWidth = 3; x.stroke();
  x.globalCompositeOperation = "destination-out"; rr(x, X, Y, W, H, 42); x.fill(); x.globalCompositeOperation = "source-over";
  // stickers: a burst and a round one
  x.save(); x.translate(w * .83, h * .25); x.rotate(.22); x.shadowColor = "rgba(0,0,0,.25)"; x.shadowBlur = 12; x.shadowOffsetY = 6;
  burst(x, 0, 0, 92, g.accent); x.shadowColor = "transparent"; burst(x, 0, 0, 78, "#fff", 14); burst(x, 0, 0, 72, g.accent, 14);
  text(x, L2(g.badge[0], g.badge[1]), 0, 2, 40, { maxW: 120, col: g.logo === "puff" ? "#4a2fb0" : "#13235a" }); x.restore();
  x.save(); x.translate(w * .15, h * .72); x.rotate(-.15); x.shadowColor = "rgba(0,0,0,.25)"; x.shadowBlur = 12; x.shadowOffsetY = 6;
  x.beginPath(); x.arc(0, 0, 66, 0, 7); x.fillStyle = g.pop; x.fill(); x.shadowColor = "transparent"; x.lineWidth = 6; x.strokeStyle = "#fff"; x.stroke();
  const dark = g.logo === "puff" ? "#3a4a00" : "#fff";
  text(x, L2(g.dot[0], g.dot[1]), 0, -6, 52, { col: dark, maxW: 100 }); text(x, L2(g.dotSub[0], g.dotSub[1]), 0, 34, 20, { w: 600, col: dark, maxW: 100 }); x.restore();
}
function drawSide(x, w, h, g) {
  x.fillStyle = g.side; x.fillRect(0, 0, w, h);
  x.fillStyle = "rgba(255,255,255,.22)"; for (let i = -h; i < h; i += 60) { x.beginPath(); x.moveTo(0, i); x.lineTo(w, i + w); x.lineTo(w, i + w + 26); x.lineTo(0, i + 26); x.fill(); }
  rr(x, w * .12, h * .04, w * .76, h * .92, 40); x.fillStyle = g.band; x.fill();
  x.save(); x.translate(w / 2, h * .5); x.rotate(-Math.PI / 2); text(x, L2(g.name[0], g.name[1]), 0, 0, 150, { maxW: h * .62, col: "#fff" }); x.restore();
  text(x, g.num, w / 2, h * .1, 64, { col: g.accent }); text(x, "JUMPI GAMES", w / 2, h * .9, 26, { w: 600, col: "rgba(255,255,255,.7)", maxW: w * .7 });
}
function drawTop(x, w, h, g) {
  x.fillStyle = g.side; x.fillRect(0, 0, w, h);
  x.fillStyle = "rgba(255,255,255,.3)"; for (let i = 0; i < 40; i++) { x.beginPath(); x.arc((i % 10) * w / 10 + 38, Math.floor(i / 10) * h / 4 + 44, 9, 0, 7); x.fill(); }
  rr(x, w * .18, h * .26, w * .64, h * .48, 60); x.fillStyle = "#fff"; x.fill();
  text(x, L2("OPEN HERE ↓", "↓ פתחו כאן"), w / 2, h * .5, 64, { col: g.band, maxW: w * .56 });
}
function drawBack(x, w, h, g) {
  const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, g.base[1]); gr.addColorStop(1, g.base[2]); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  text(x, L2(g.name[0], g.name[1]), w / 2, h * .45, 110, { maxW: w * .8, col: "rgba(255,255,255,.9)" });
  text(x, "JUMPI GAMES", w / 2, h * .56, 34, { w: 600, col: "rgba(255,255,255,.7)" });
}
function drawLiner(x, w, h, g) {   // the printed backdrop inside the box, behind the figure
  if (g.logo === "puff") {
    x.fillStyle = "#bff4ff"; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { x.fillStyle = ["#ff9be6", "#ffe27a", "#b9a2ff", "#fff"][i % 4]; x.beginPath(); x.arc(rnd(i, 7) * w, h * .25 + rnd(i, 8) * h * .25, 8, 0, 7); x.fill(); }
    x.fillStyle = "#9fe05a"; x.fillRect(0, h * .55, w, h); x.fillStyle = "#b6ef6e"; for (let i = 0; i < 8; i += 2) x.fillRect(i * w / 8, h * .55, w / 8, h);
    x.strokeStyle = "#fff"; x.lineWidth = 6; x.beginPath(); x.ellipse(w / 2, h * .78, w * .2, h * .08, 0, 0, 7); x.stroke();
  } else {
    const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#8fe0ff"); gr.addColorStop(.6, "#d9f6ff"); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.fillStyle = "#ffe27a"; x.beginPath(); x.arc(w * .75, h * .22, 46, 0, 7); x.fill();
    x.fillStyle = "#fff"; [[.2, .2], [.5, .32]].forEach(([a, b]) => { x.beginPath(); x.arc(w * a, h * b, 28, 0, 7); x.arc(w * a + 30, h * b + 6, 22, 0, 7); x.arc(w * a - 28, h * b + 8, 18, 0, 7); x.fill(); });
    x.fillStyle = "#8fd88a"; x.beginPath(); x.ellipse(w * .25, h * .82, w * .5, h * .3, 0, 0, 7); x.fill(); x.fillStyle = "#6cc46a"; x.beginPath(); x.ellipse(w * .85, h * .86, w * .5, h * .3, 0, 0, 7); x.fill();
  }
}
function drawMystery(x, w, h, col) {
  x.fillStyle = col; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,240,190,${.3 + rnd(i, 9) * .5})`; const X = rnd(i, 10) * w, Y = rnd(i, 11) * h, r = 2 + rnd(i, 12) * 5; burst(x, X, Y, r * 1.6, x.fillStyle, 4); }
  text(x, "?", w / 2, h * .54, 300, { col: "#ffd76a", stroke: "rgba(0,0,0,.25)", sw: 14 });
}
const faceTex = canvasTex(256, 128, (x) => { x.fillStyle = "#fff"; x.fillRect(0, 0, 256, 128); const cx = 64;
  for (const ex of [-13, 13]) { x.fillStyle = "#1d1b3a"; x.beginPath(); x.ellipse(cx + ex, 56, 6, 9, 0, 0, 7); x.fill(); x.fillStyle = "#fff"; x.beginPath(); x.arc(cx + ex + 2, 52, 2.4, 0, 7); x.fill(); }
  x.strokeStyle = "#1d1b3a"; x.lineWidth = 4; x.lineCap = "round"; x.beginPath(); x.arc(cx, 66, 10, .25, Math.PI - .25); x.stroke();
  x.fillStyle = "rgba(255,110,150,.45)"; for (const ex of [-24, 24]) { x.beginPath(); x.ellipse(cx + ex, 70, 6, 4, 0, 0, 7); x.fill(); } });
const blobTex = canvasTex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, "rgba(31,27,61,.55)"); g.addColorStop(.6, "rgba(31,27,61,.18)"); g.addColorStop(1, "rgba(31,27,61,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
const glowTex = canvasTex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.35, "rgba(255,240,200,.6)"); g.addColorStop(1, "rgba(255,230,180,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
const glareTex = canvasTex(256, 256, (x) => { x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.moveTo(30, 256); x.lineTo(110, 0); x.lineTo(150, 0); x.lineTo(70, 256); x.fill(); x.fillStyle = "rgba(255,255,255,.3)"; x.beginPath(); x.moveTo(100, 256); x.lineTo(180, 0); x.lineTo(196, 0); x.lineTo(116, 256); x.fill(); });

/* ---------- the 3D ---------- */
function start() {
  const cv = document.getElementById("bxWorld");
  let R;
  try { R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: "high-performance" }); }
  catch (e) { root.classList.add("bx-no3d"); return; }
  const small = () => innerWidth < 760;
  let dpr = Math.min(devicePixelRatio || 1, small() ? 1.6 : 2);
  R.setPixelRatio(dpr); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = .98; R.setClearColor(0, 0);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(35, 1, .1, 200);
  // soft studio light: a light box environment (for the glossy toy plastic), a key light, a sky fill
  { const env = new THREE.Scene(); const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: "#fff2e2" })); env.add(sky);
    [[0, 8, 0, 8, .3, 8, "#ffffff"], [-7, 2, 3, .3, 4, 6, "#ffe9d6"], [7, 3, 2, .3, 4, 6, "#e6f4ff"], [0, -6, 0, 10, .3, 10, "#d9c8b8"]].forEach(([x, y, z, a, b, c, col]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), new THREE.MeshBasicMaterial({ color: col })); m.position.set(x, y, z); env.add(m); });
    const pm = new THREE.PMREMGenerator(R); scene.environment = pm.fromScene(env, .04).texture; }
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffe0c8, .7));
  const key = new THREE.DirectionalLight(0xfff4e6, 1.9); key.position.set(-5, 9, 10); scene.add(key);
  const rim = new THREE.DirectionalLight(0xd6ecff, .9); rim.position.set(6, 4, -6); scene.add(rim);
  const world = new THREE.Group(); scene.add(world);   // everything; it leans toward the mouse

  const mat = (c, r = .45, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...o });
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const hits = [];   // things the mouse can touch
  const blobShadow = (w, d) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: .8 })); m.rotation.x = -Math.PI / 2; return m; };

  /* Jumpis (from /blobby.glb, the game's own character): places are kept now, bodies come when it loads */
  const jumpis = [];
  const jumpi = (parent, skin, iris, h, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); const n = { g, skin, iris, h, ph: jumpis.length * 1.37 }; jumpis.push(n); return n; };
  new GLTFLoader().load("/blobby.glb", (gl) => {
    const base = gl.scene, box = new THREE.Box3().setFromObject(base), hgt = box.max.y - box.min.y || 1;
    for (const n of jumpis) {
      const b = base.clone(true);
      b.traverse((o) => { if (!o.isMesh) return;
        o.material = [].concat(o.material).map((m) => { if (m.name === "Skin") { m = m.clone(); m.color.set(n.skin); m.roughness = .4; } else if (m.name === "Iris") { m = m.clone(); m.color.set(n.iris); }
          else if (m.name === "Mouth") { m = m.clone(); const c = new THREE.Color(n.skin), hh = {}; c.getHSL(hh); m.color.setHSL(hh.h, Math.min(1, hh.s * .9), hh.l * .22); } return m; });
        if (o.material.length === 1) o.material = o.material[0]; });
      const k = n.h / hgt; b.scale.setScalar(k); b.position.y = -box.min.y * k; n.g.add(b);
      n.body = b; n.armL = b.getObjectByName("ArmL"); n.armR = b.getObjectByName("ArmR"); n.rL = n.armL ? n.armL.rotation.z : 0; n.rR = n.armR ? n.armR.rotation.z : 0;
    }
  }, undefined, () => {});
  const puffs = [];
  const puffColors = ["#8af4ff", "#ff9be6", "#ffe27a", "#b9a2ff", "#ff8a95", "#86bcff", "#d8ff6e"];
  const puff = (parent, col, r, x = 0, y = 0, z = 0, hop = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), mat(col, .3, { map: faceTex })); m.position.set(x, y + r, z); parent.add(m); const p = { m, r, x, y, z, hop, ph: puffs.length * 1.13 }; puffs.push(p); return p; };

  /* small worlds that rise out of the boxes */
  const tree = (s, k) => { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(.04 * s, .06 * s, .4 * s, 8), mat("#9a6a4a", .8)); t.position.y = .2 * s; g.add(t);
    const c = new THREE.Mesh(new THREE.SphereGeometry(.24 * s, 20, 14), mat(["#5fbf7a", "#4aae6c", "#7ccf86"][k % 3], .6)); c.position.y = .5 * s; g.add(c); return g; };
  const platform = (r, top) => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r * .92, .34, 64), mat("#f2cf9c", .7)); b.position.y = -.17; g.add(b);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r * .97, r * .97, .08, 64), mat(top, .65)); t.position.y = .02; g.add(t); return g; };
  const wheels = [];
  function jumpiWorld() {
    const g = platform(1.5, "#8fd88a");
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, .03, 40), mat("#fff1dc", .6)); plaza.position.y = .07; g.add(plaza);
    const f = new THREE.Mesh(new THREE.CylinderGeometry(.2, .23, .1, 24), mat("#ffffff", .4)); f.position.y = .12; g.add(f);
    const wtr = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .02, 24), mat("#5fd4ff", .1, { emissive: "#2aa8e0", emissiveIntensity: .3 })); wtr.position.y = .17; g.add(wtr);
    const cols = [["#fff3df", "#ff5a7a"], ["#fff8e8", "#1fb6ff"], ["#ffeedd", "#ffc23a"], ["#f6fff0", "#7ed321"], ["#fff1f6", "#a66bff"]];
    [[-1, -.55, .9], [-.95, .5, 2.2], [.1, -1.1, .1], [.95, .65, 4], [-.25, 1.05, 3]].forEach(([x, z, ry], i) => { const h = new THREE.Group(); h.position.set(x, .06, z); h.rotation.y = ry; h.scale.setScalar(.36); g.add(h);
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1), mat(cols[i][0], .6)); w.position.y = .5; h.add(w);
      const rs = new THREE.Shape(); rs.moveTo(-.74, 0); rs.lineTo(.74, 0); rs.lineTo(0, .62); rs.lineTo(-.74, 0);
      const r = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: 1.12, bevelEnabled: false }), mat(cols[i][1], .45)); r.position.set(0, 1, -.56); h.add(r);
      const wn = new THREE.Mesh(new THREE.PlaneGeometry(.3, .3), mat("#ffe2a0", .5, { emissive: "#ffb85a", emissiveIntensity: .4 })); wn.position.set(.25, .55, .505); h.add(wn); });
    // a ferris wheel
    const fw = new THREE.Group(); fw.position.set(.85, .06, -.6); fw.rotation.y = -.6; fw.scale.setScalar(.34); g.add(fw);
    for (const s of [-1, 1]) for (const d of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 3.3, 8), mat("#fff", .4)); leg.position.set(d * .75, 1.55, s * .45); leg.rotation.z = d * -.24; fw.add(leg); }
    const wh = new THREE.Group(); wh.position.y = 3.1; fw.add(wh);
    for (const s of [-.32, .32]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, .08, 8, 48), mat("#ff5a7a", .4)); ring.position.z = s; wh.add(ring); }
    const cabins = [];
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const sp = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 2.5, 6), mat("#fff", .4)); sp.position.set(Math.cos(a) * 1.25, Math.sin(a) * 1.25, 0); sp.rotation.z = a - Math.PI / 2; wh.add(sp);
      const cab = new THREE.Group(); cab.position.set(Math.cos(a) * 2.5, Math.sin(a) * 2.5, 0); wh.add(cab); const b = new THREE.Mesh(new THREE.CylinderGeometry(.32, .26, .44, 16), mat(cols[i % 5][1], .4)); b.position.y = -.34; cab.add(b); cabins.push(cab); }
    wheels.push({ wh, cabins });
    [[-1.25, .05, 1], [1.2, -.2, .9], [.5, 1.2, .85], [-.6, -1.2, .9], [1.25, .9, .7]].forEach(([x, z, s], i) => { const t = tree(s, i); t.position.set(x, .06, z); g.add(t); });
    jumpi(g, "#ff8a1c", "#7a3e12", .5, -.22, .08, .3, .2); jumpi(g, "#ff5a9a", "#7a1240", .46, .24, .08, .36, -.2);
    // two little clouds above
    for (const [x, y, z] of [[-.9, 1.55, -.3], [.8, 1.8, .4]]) { const c = new THREE.Group(); c.position.set(x, y, z); g.add(c);
      for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(.16 + k % 2 * .05, 16, 12), mat("#ffffff", .9)); s.position.set((k - 1) * .2, 0, 0); c.add(s); } }
    return g;
  }
  const pitchTex = canvasTex(512, 320, (x) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? "#9fe05a" : "#b6ef6e"; x.fillRect(i * 64, 0, 64, 320); }
    x.strokeStyle = "rgba(255,255,255,.95)"; x.lineWidth = 7; x.strokeRect(14, 14, 484, 292); x.beginPath(); x.moveTo(256, 14); x.lineTo(256, 306); x.stroke(); x.beginPath(); x.arc(256, 160, 48, 0, 7); x.stroke(); });
  const balls = [];
  function puffWorld() {
    const g = platform(1.5, "#f6e4c4");
    const pitch = new THREE.Mesh(new THREE.BoxGeometry(2.3, .12, 1.45), [mat("#86d04a"), mat("#86d04a"), mat("#fff", .7, { map: pitchTex }), mat("#86d04a"), mat("#86d04a"), mat("#86d04a")]); pitch.position.y = .12; g.add(pitch);
    const tube = (len, col, x, z, ry) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(.08, len, 6, 12), mat(col, .3)); m.rotation.set(0, ry, Math.PI / 2); m.position.set(x, .24, z); g.add(m); };
    for (let i = 0; i < 3; i++) { tube(.6, puffColors[i % 2], -.75 + i * .75, -.78, 0); tube(.6, puffColors[(i + 1) % 2], -.75 + i * .75, .78, 0); }
    for (const s of [-1, 1]) { tube(.3, puffColors[3], s * 1.2, -.5, Math.PI / 2); tube(.3, puffColors[3], s * 1.2, .5, Math.PI / 2);
      const goal = new THREE.Mesh(new THREE.TorusGeometry(.28, .05, 10, 24, Math.PI), mat("#ffe27a", .3)); goal.position.set(s * 1.08, .18, 0); goal.rotation.y = Math.PI / 2; g.add(goal); }
    [[-.6, -.3], [-.2, .35], [.35, -.2], [.7, .3]].forEach(([x, z], i) => puff(g, puffColors[i + 1], .16, x, .18, z, .5));
    const b = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 12), mat("#fff", .35)); g.add(b); balls.push(b);
    [[-1.3, .9, .8], [1.3, -.95, .7]].forEach(([x, z, s], i) => { const t = tree(s, i); t.position.set(x, .06, z); g.add(t); });
    return g;
  }

  /* a collector's box: printed faces, a window with the figure inside, a lid that opens, confetti, the world inside */
  const BW = 2.4, BH = 3.2, BD = 1.1;
  function gameBox(id) {
    const g = GAMES[id], o = new THREE.Group(), body = new THREE.Group(); o.add(body); world.add(o);
    const m = (t, x = {}) => mat("#fff", .5, { map: t, ...x });
    const side = m(canvasTex(352, 1024, (x, w, h) => drawSide(x, w, h, g))), front = m(canvasTex(768, 1024, (x, w, h) => drawFront(x, w, h, g)), { alphaTest: .5 }), back = m(canvasTex(768, 1024, (x, w, h) => drawBack(x, w, h, g)));
    const shell = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, BD), [side, side, hidden, mat(g.deep), front, back]); body.add(shell);
    const linS = mat(g.liner, .7, { side: THREE.BackSide }), linB = m(canvasTex(512, 512, (x, w, h) => drawLiner(x, w, h, g)), { side: THREE.BackSide, roughness: .7 });
    body.add(new THREE.Mesh(new THREE.BoxGeometry(BW - .05, BH - .05, BD - .05), [linS, linS, hidden, linS, hidden, linB]));
    // the clear window, with a glint
    const wy = BH / 2 - (WIN.y + WIN.h / 2) * BH, ww = WIN.w * BW, wh = WIN.h * BH;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: .06, roughness: .05, metalness: .1, depthWrite: false })); glass.position.set(0, wy, BD / 2 - .012); body.add(glass);
    const glint = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: glareTex, transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending })); glint.position.set(0, wy, BD / 2 - .01); body.add(glint);
    // the figure on a little stand, inside
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(.5, .55, .14, 40), mat(g.pop, .35)); stand.position.set(0, wy - wh / 2 + .12, -.05); body.add(stand);
    const figY = wy - wh / 2 + .19;
    if (id === "jumpi") jumpi(body, "#1fb6ff", "#0a4f7a", 1.3, 0, figY, -.05, 0);
    else { puff(body, "#ff9be6", .5, -.08, figY, -.05, 0); const b = new THREE.Mesh(new THREE.SphereGeometry(.17, 20, 14), mat("#fff", .35)); b.position.set(.55, figY + .17, .1); body.add(b); }
    // the lid, hinged at the back
    const hinge = new THREE.Group(); hinge.position.set(0, BH / 2, -BD / 2); body.add(hinge);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(BW + .04, .07, BD + .04), [side, side, m(canvasTex(768, 352, (x, w, h) => drawTop(x, w, h, g))), mat(g.side, .6), mat(g.side, .5), mat(g.side, .5)]); lid.position.set(0, .035, BD / 2); hinge.add(lid);
    // the world that rises, a glowing ring under it, confetti
    const wld = id === "jumpi" ? jumpiWorld() : puffWorld(); body.add(wld);
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: id === "jumpi" ? "#bfe9ff" : "#eaffb0" })); ring.rotation.x = -Math.PI / 2; body.add(ring);
    const N = 110, conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(.07, .13), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), N); conf.frustumCulled = false; body.add(conf);
    const cc = ["#ff5a9a", "#ffc23a", "#1fb6ff", "#7ed321", "#a66bff", "#ff8a3c", "#ffffff"]; for (let i = 0; i < N; i++) conf.setColorAt(i, new THREE.Color(cc[i % cc.length]));
    const sh = blobShadow(BW * 1.7, BD * 2.6); sh.position.y = -BH / 2 + .01; o.add(sh);
    shell.userData.owner = id; hits.push(shell);
    return { o, body, hinge, wld, ring, conf, N, id, wig: 0 };
  }
  const BOX = { jumpi: gameBox("jumpi"), puff: gameBox("puff") };

  /* the mystery boxes: wrapped, a bow on top; inside, a light */
  function mysteryBox(col, ribbon, i) {
    const o = new THREE.Group(), body = new THREE.Group(); o.add(body); world.add(o);
    const S = 1.7, t = mat("#fff", .5, { map: canvasTex(512, 512, (x, w, h) => drawMystery(x, w, h, col)) });
    const shell = new THREE.Mesh(new THREE.BoxGeometry(S, S * .82, S), [t, t, hidden, mat(col), t, t]); shell.position.y = -S * .09; body.add(shell);
    const rib = mat(ribbon, .3);
    for (const [a, b] of [[.24, S + .02], [S + .02, .24]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(a, S * .82 + .02, b), rib); r.position.y = -S * .09; body.add(r); }
    const lidG = new THREE.Group(); lidG.position.set(0, S * .32, -S / 2); body.add(lidG);
    const lid = new THREE.Group(); lid.position.set(0, 0, S / 2); lidG.add(lid);
    lid.add(new THREE.Mesh(new THREE.BoxGeometry(S + .1, .3, S + .1), [t, t, mat(col, .5), mat(col), t, t])); lid.children[0].position.y = .15;
    for (const [a, b] of [[.25, S + .12], [S + .12, .25]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(a, .32, b), rib); r.position.y = .15; lid.add(r); }
    for (const s of [-1, 1]) { const loop = new THREE.Mesh(new THREE.TorusGeometry(.26, .08, 12, 28), rib); loop.position.set(s * .26, .44, 0); loop.rotation.set(0, 0, s * .5); loop.scale.set(1, .8, .6); lid.add(loop); }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(.12, 16, 12), rib); knot.position.y = .36; lid.add(knot);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: "#ffe9a8", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(2.8, 2.2, 1); glow.position.y = S * .3; body.add(glow);
    const sh = blobShadow(S * 1.6, S * 1.6); sh.position.y = -S * .5 + .01; o.add(sh);
    shell.userData.owner = "m" + i; hits.push(shell);
    return { o, body, lidG, glow, id: "m" + i, wig: 0, ph: i * 2.1, peek: 0 };
  }
  const MYS = [mysteryBox("#2b2557", "#ffc23a", 0), mysteryBox("#7a4dff", "#ff9be6", 1), mysteryBox("#ff5a9a", "#8af4ff", 2)];

  /* the opening's friends and toy shapes */
  const hero = new THREE.Group(); world.add(hero);
  const heroJ = jumpi(hero, "#ff5a9a", "#7a1240", 1.25); const heroJs = blobShadow(1.3, 1.1); heroJ.g.add(heroJs); heroJs.position.y = .01;
  const heroP = puff(hero, "#d8ff6e", .42, 0, 0, 0, 1.2); const heroPs = blobShadow(1, 1); hero.add(heroPs);
  const shapes = [];
  { const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? .22 : .5; i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const geos = [new THREE.TorusGeometry(.36, .15, 20, 40), new THREE.ExtrudeGeometry(star, { depth: .16, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 3 }), new THREE.SphereGeometry(.3, 28, 20),
      new THREE.CapsuleGeometry(.16, .46, 8, 16), new RoundedBoxGeometry(.5, .5, .5, 4, .1), new THREE.ConeGeometry(.28, .56, 28), new THREE.TorusGeometry(.22, .07, 12, 32), new THREE.SphereGeometry(.18, 20, 14), new THREE.CapsuleGeometry(.11, .3, 6, 12)];
    const cols = ["#ff5a9a", "#ffc23a", "#5fe3f0", "#c6f25a", "#8c6bff", "#1fb6ff", "#ff8a3c", "#ff9be6", "#7ed321"];
    // where each one floats in the opening (around the boxes) and at the end (around the words), as parts of the screen
    const HP = [[.1, .38, 1], [.95, .45, -1], [.22, -.62, 2], [1.02, -.1, 1], [.58, .78, -2], [.3, .1, 2.5], [.82, -.75, 1.5], [.08, -.2, -1], [.7, .58, 2]];
    const EP = [[-.82, .55, 0], [.8, .62, -1], [-.7, -.35, 1], [.85, -.28, 1], [-.45, .78, -2], [.5, .82, 0], [-.9, .1, -1], [.92, .15, 1], [.15, -.82, 1]];
    geos.forEach((geo, i) => { const m = new THREE.Mesh(geo, mat(cols[i], .28, { metalness: .05 })); world.add(m); shapes.push({ m, hp: HP[i], ep: EP[i], ph: i * 1.7, spin: .3 + rnd(i, 61) * .5 }); }); }

  /* the end: everyone jumps */
  const ender = new THREE.Group(); world.add(ender);
  const enders = [jumpi(ender, "#ff8a1c", "#7a3e12", 1.1), jumpi(ender, "#1fb6ff", "#0a4f7a", 1.15), jumpi(ender, "#7ed321", "#2f5c08", 1.05), jumpi(ender, "#a66bff", "#3d1a7a", 1.1)];
  const enderP = [puff(ender, "#ff9be6", .38), puff(ender, "#8af4ff", .34), puff(ender, "#ffe27a", .36)];
  const rain = new THREE.InstancedMesh(new THREE.PlaneGeometry(.09, .16), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true }), 160); rain.frustumCulled = false; world.add(rain);
  { const cc = ["#ff5a9a", "#ffc23a", "#1fb6ff", "#7ed321", "#a66bff", "#ff8a3c"]; for (let i = 0; i < 160; i++) rain.setColorAt(i, new THREE.Color(cc[i % cc.length])); }

  /* ---------- the choreography: keys at places in the scenes; the scroll moves between them ---------- */
  let Lay, K = {};
  function layout() {
    const w = innerWidth, h = innerHeight, asp = w / h, M = w < 760, D = root.dir === "rtl" ? -1 : 1, tn = Math.tan(THREE.MathUtils.degToRad(17.5));
    const z = Math.max(14, (M ? 3.5 : 7.2) / (tn * asp));
    cam.aspect = asp; cam.position.set(0, 0, z); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
    return { M, D, hw: z * tn * asp, hh: z * tn };
  }
  // a track: [scene, t, {fields}] — each key keeps what the one before it had, unless it says otherwise
  const track = (list) => { let prev = { x: 0, y: 0, z: 0, s: 1, rx: 0, ry: 0, open: 0, world: 0, conf: 0 }; return list.map(([i, t, f]) => { prev = { ...prev, ...f }; return { y: sceneY(i, t), f: prev }; }); };
  const at = (keys, y) => { if (y <= keys[0].y) return keys[0].f; let i = 0; while (i < keys.length - 2 && y > keys[i + 1].y) i++;
    const a = keys[i], b = keys[i + 1]; if (y >= b.y) return b.f; const u = smooth((y - a.y) / Math.max(1, b.y - a.y)), o = {};
    for (const k in b.f) o[k] = k in a.f ? mix(a.f[k], b.f[k], u) : b.f[k]; return o; };
  function build() {
    Lay = layout(); const { M, D, hw, hh } = Lay;
    const Fy = M ? hh * .02 : -hh * .5;                          // the floor in the opening
    const off = hh * 1.9;                                          // out of sight, above or below
    const gameKeys = (i, hero, wait) => {
      const near = M ? { x: 0, y: hh * .02, z: 2, s: .9 } : { x: 0, y: -hh * .26, z: 2.4, s: 1.08 };
      const side = M ? { x: 0, y: hh * .2, z: 0, s: .7 } : { x: D * hw * .38, y: -hh * .4, z: 0, s: .95 };
      return [...hero,
        ...wait,
        [i, 0, { ...near, y: near.y - hh * .25, z: near.z - 3, ry: D * 2.4, rx: .05, open: 0, world: 0, conf: 0 }],
        [i, .13, { ...near, ry: -D * .3, rx: .12 }],
        [i, .27, { ...near, ry: -D * .14, rx: .26, open: 1 }],
        [i, .31, { conf: 0 }],
        [i, .42, { ...near, z: near.z - 1.2, y: near.y - hh * .04, ry: -D * .1, rx: .16, world: 1 }],
        [i, .5, { ...side, ry: -D * .3, rx: .08, conf: 1 }],
        [i, .92, { ...side, ry: -D * .22 }],
        [i + 1, .06, { ...side, y: off, ry: -D * .1 }]];
    };
    K.jumpi = track(gameKeys(1, [
      [0, 0, M ? { x: -hw * .3, y: Fy + BH / 2 * .72, z: 0, s: .72, ry: .38, rx: .06 } : { x: D * hw * .42, y: Fy + BH / 2 * 1.05, z: 0, s: 1.05, ry: -D * .42, rx: .06 }],
      [0, .55, {}]], []));
    K.puff = track(gameKeys(2, [
      [0, 0, M ? { x: hw * .42, y: Fy + BH / 2 * .6 + .5, z: -1.6, s: .6, ry: -.5, rx: .06 } : { x: D * hw * .79, y: Fy + BH / 2 * .9 + .25, z: -1.8, s: .9, ry: -D * .8, rx: .06 }],
      [0, .55, {}]], [[1, 0, M ? { x: hw * 1.8 } : { x: D * hw * 1.6 }], [1, .95, {}]]));
    K.hero = track([[0, 0, { y: 0, s: 1 }], [0, .55, {}], [1, .06, { y: -off, s: 1 }]]);
    K.hj = M ? { x: hw * .02, y: Fy, z: 1.4, s: .8 } : { x: D * hw * .63, y: Fy, z: 1.3, s: 1 };
    K.hp = M ? { x: hw * .68, y: Fy, z: .6 } : { x: D * hw * .92, y: Fy, z: .6 };
    K.mys = [0, 1, 2].map((k) => {
      const row = M ? { x: (k - 1) * hw * .64, y: -hh * .42, z: 0, s: .6 } : { x: (k - 1) * hw * .5, y: -hh * .3, z: 0, s: .9 };
      const heroPos = M ? { x: hw * .06, y: hh * .66, z: -3, s: .34, ry: .5 } : { x: D * hw * .63, y: hh * .5, z: -3.4, s: .62, ry: .5 };
      return track(k === 1 ? [[0, 0, heroPos], [0, .55, {}], [1, .08, { y: off }], [4, 0, { ...row, y: off, ry: -.3 }], [4, .14, { ...row, ry: (k - 1) * -.25 }], [4, .95, {}], [5, .12, { y: -off }]]
        : [[0, 0, { ...row, y: -off, ry: .3 }], [4, 0, {}], [4, .1 + k * .03, { ...row, ry: (k - 1) * -.25 }], [4, .95, {}], [5, .12, { y: -off }]]);
    });
    K.shapes = track([[0, 0, { a: 1, b: 0 }], [0, .55, {}], [1, .1, { a: 0 }], [4, .9, { a: 0, b: 1 }], [5, .15, { a: 0, b: 2 }]]);   // a: in the opening, b: 1→2 flying in at the end
    K.end = track([[0, 0, { y: -off }], [4, .92, {}], [5, .14, { y: 0 }]]);
  }
  build();

  /* the mouse: the world leans a little toward it; boxes wiggle when touched, a mystery box peeks */
  const ptr = new THREE.Vector2(9, 9), lean = { x: 0, y: 0 }, ray = new THREE.Raycaster(); let hover = null;
  addEventListener("pointermove", (e) => { ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); });
  addEventListener("pointerleave", () => ptr.set(9, 9));
  const blocked = (el) => !!(el && el.closest && el.closest("a,button,.bx-panel,.bx-page,.lang-sw,input"));
  addEventListener("click", (e) => {
    if (blocked(e.target)) return;
    ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); const id = pick(); if (!id) return;
    if (id === "jumpi" && (state.t[0] || 0) < .6 && scrollY < sceneY(1, 0)) go(1, .42); else if (id === "puff" && scrollY < sceneY(1, 0)) go(2, .42);
    const b = BOX[id] || MYS.find((m) => m.id === id); if (b) { b.wig = 1; if (b.peek !== undefined) b.peekT = 1.6; }
  });
  function pick() { if (Math.abs(ptr.x) > 1.5) return null; ray.setFromCamera(ptr, cam); const h = ray.intersectObjects(hits, false).find((x) => x.object.visible && x.object.parent.parent.visible); return h ? h.object.userData.owner : null; }

  /* ---------- drawing ---------- */
  function size() { R.setSize(innerWidth, innerHeight, false); build(); }
  addEventListener("resize", size); size();
  let Y = scrollY, last = performance.now(), T = 0, drawn = false, frames = 0, slowT = 0, lastHover = null;
  const pose = (o, f, extra = 0) => { o.position.set(f.x, f.y, f.z); o.rotation.set(f.rx || 0, f.ry || 0, extra); o.scale.setScalar(f.s); o.visible = Math.abs(f.y) < Lay.hh * 1.8; };
  const dummy = new THREE.Object3D();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (document.hidden) return;
    const still = calm(); if (!still) T += dt;
    Y = still ? scrollY : mix(Y, scrollY, 1 - Math.exp(-dt * 6));
    const { M, D, hw, hh } = Lay;
    // lean toward the mouse (not on touch screens)
    const px = Math.abs(ptr.x) > 1.5 || M || still ? 0 : ptr.x, py = Math.abs(ptr.y) > 1.5 || M || still ? 0 : ptr.y;
    lean.x = mix(lean.x, px, 1 - Math.exp(-dt * 3)); lean.y = mix(lean.y, py, 1 - Math.exp(-dt * 3));
    world.rotation.set(-lean.y * .05, lean.x * .08, 0);
    hover = frames % 3 === 0 ? pick() : hover; if (hover !== lastHover) { root.classList.toggle("bx-hover", !!hover); lastHover = hover; }
    // the game boxes
    for (const b of Object.values(BOX)) {
      const f = at(K[b.id], Y); if (hover === b.id && !still) b.wig = Math.max(b.wig, .35); b.wig = Math.max(0, b.wig - dt * 1.4);
      pose(b.o, f, Math.sin(T * 18) * .05 * b.wig); b.o.position.y += still ? 0 : Math.sin(T * 1.3 + (b.id === "puff" ? 2 : 0)) * .05 * (1 - f.open);
      b.hinge.rotation.x = -backOut(f.open) * 2.05;
      const w = f.world, wv = backOut(w);
      b.wld.visible = w > .01; b.wld.scale.setScalar(mix(.2, 1, wv)); b.wld.position.y = BH / 2 + mix(-1, .72, smooth(w * 1.4)); b.wld.rotation.y = T * .25 + w * 2;
      b.ring.visible = w > .01; b.ring.position.y = BH / 2 + .1; b.ring.material.opacity = smooth(w * 2) * (.55 + Math.sin(T * 3) * .1); b.ring.scale.setScalar(mix(.4, 1, wv));
      const c = f.conf; b.conf.visible = c > .001 && c < .999;
      if (b.conf.visible) for (let i = 0; i < b.N; i++) { const a = rnd(i, 71) * Math.PI * 2, sp = .8 + rnd(i, 72) * 1.6, up = 3 + rnd(i, 73) * 3, tt = c * 1.25;
        dummy.position.set(Math.cos(a) * sp * tt * 1.4, BH / 2 + .2 + up * tt - 4.2 * tt * tt, Math.sin(a) * sp * tt);
        dummy.rotation.set(T * 4 + i, T * 3 + i * .7, i); dummy.scale.setScalar(1 - smooth((c - .75) / .25)); dummy.updateMatrix(); b.conf.setMatrixAt(i, dummy.matrix); }
      if (b.conf.visible) b.conf.instanceMatrix.needsUpdate = true;
    }
    // the opening: friends and shapes
    const hf = at(K.hero, Y); hero.position.y = hf.y; hero.visible = Math.abs(hf.y) < hh * 1.8;
    heroJ.g.position.set(K.hj.x, K.hj.y, K.hj.z); heroJ.g.scale.setScalar(K.hj.s); heroJ.g.rotation.y = -D * .35 + (M ? .2 : 0);
    heroP.x = K.hp.x; heroP.y = K.hp.y; heroP.z = K.hp.z; heroPs.position.set(K.hp.x, K.hp.y + .01, K.hp.z);
    const sf = at(K.shapes, Y);
    shapes.forEach((s, i) => { const b = sf.b, inEnd = b > 0, k = inEnd ? clamp(b - 1) : sf.a, p = inEnd ? s.ep : s.hp;
      const fx = inEnd ? p[0] : (M ? (p[0] - .55) * 1.9 : D * p[0]), fy = inEnd ? p[1] : (M ? .2 + p[1] * .45 : p[1]);
      const spread = 1 + (1 - k) * .8; s.m.position.set(fx * hw * spread, fy * hh * spread + (still ? 0 : Math.sin(T * 1.2 + s.ph) * .15), p[2]);
      s.m.rotation.set(T * s.spin + s.ph, T * s.spin * .7, s.ph); s.m.scale.setScalar(k * (M ? .75 : 1)); s.m.visible = k > .01; });
    // the mystery boxes: they wobble, now and then something inside jumps; touched, they peek
    MYS.forEach((m, k) => { const f = at(K.mys[k], Y); if (hover === m.id && !still) m.wig = Math.max(m.wig, .5); m.wig = Math.max(0, m.wig - dt * 1.2);
      const hop = still ? 0 : Math.pow(Math.max(0, Math.sin(T * 1.6 + m.ph)), 14);
      pose(m.o, f, (still ? 0 : Math.sin(T * 2 + m.ph) * .04) + Math.sin(T * 20) * .08 * m.wig + hop * Math.sin(T * 30) * .03);
      m.body.position.y = hop * .18; m.peekT = Math.max(0, (m.peekT || 0) - dt);
      m.peek = mix(m.peek, Math.max(m.wig > .3 ? .6 : 0, m.peekT > 0 ? 1 : 0, hop * .4), 1 - Math.exp(-dt * 8));
      m.lidG.rotation.x = -m.peek * .55; m.lidG.position.y = 1.7 * .32 + m.peek * .12; m.glow.material.opacity = m.peek * .9; });
    // the end
    const ef = at(K.end, Y); ender.position.y = ef.y; ender.visible = Math.abs(ef.y) < hh * 1.8;
    const row = M ? [[-.72, -.8], [-.3, -.86], [.3, -.86], [.72, -.8]] : [[-.86, -.55], [-.68, -.72], [.68, -.72], [.86, -.55]];
    enders.forEach((n, i) => { n.g.position.set(row[i][0] * hw, row[i][1] * hh + (still ? 0 : Math.abs(Math.sin(T * 3.2 + i)) * .55), 0); n.g.rotation.y = -row[i][0] * .5; n.g.scale.setScalar(M ? .6 : 1); });
    const prow = M ? [[-.1, -.95], [.55, -.95], [-.55, -.95]] : [[-.55, -.8], [.52, -.82], [-.95, -.82]];
    enderP.forEach((p, i) => { p.x = prow[i][0] * hw; p.y = prow[i][1] * hh; p.z = .3; });
    const rv = ender.visible && ef.y > -hh * .5; rain.visible = rv;
    if (rv) { for (let i = 0; i < 160; i++) { const sp = .5 + rnd(i, 81) * .7, yy = ((rnd(i, 82) + T * sp * .12) % 1); dummy.position.set((rnd(i, 83) * 2 - 1) * hw, hh * (1.1 - yy * 2.3) + ef.y, -2 - rnd(i, 84) * 4);
      dummy.rotation.set(T * 2 + i, T * 1.5 + i, i); dummy.scale.setScalar(1); dummy.updateMatrix(); rain.setMatrixAt(i, dummy.matrix); } rain.instanceMatrix.needsUpdate = true; }
    // life: Jumpis bob and wave, Puffs bounce and look at us, wheels turn
    for (const n of jumpis) { if (!n.body) continue; n.body.position.y = n.body.position.y * 0 + (n.body.userData.y0 ??= n.body.position.y) + (still ? 0 : Math.abs(Math.sin(T * 2.6 + n.ph)) * .04 * n.h);
      if (n.armR) n.armR.rotation.z = n.rR + (still ? 0 : Math.sin(T * 7 + n.ph) * .45 + .9); if (n.armL) n.armL.rotation.z = n.rL - (still ? 0 : Math.sin(T * 2 + n.ph) * .12); }
    for (const p of puffs) { const h = still || !p.hop ? 0 : Math.abs(Math.sin(T * 2.4 + p.ph)); p.m.position.set(p.x, p.y + p.r + h * p.r * 1.6 * p.hop, p.z);
      const sq = 1 - (1 - smooth(h * 4)) * .14 * (p.hop ? 1 : 0); p.m.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); p.m.lookAt(cam.position); }
    for (const w of wheels) { w.wh.rotation.z = T * .3; w.cabins.forEach((c) => (c.rotation.z = -w.wh.rotation.z)); }
    balls.forEach((b) => b.position.set(Math.sin(T * 1.1) * .8, .25 + Math.abs(Math.sin(T * 3)) * .25, Math.cos(T * 1.4) * .4));
    R.render(scene, cam);
    if (!drawn) { drawn = true; root.classList.add("bx-3d"); }
    if (frames < 120) { frames++; slowT += dt; if (frames === 120 && slowT / 120 > 1 / 30 && dpr > 1) { dpr = 1; R.setPixelRatio(1); size(); } }
  }
  R.setAnimationLoop(frame);
  if (calm()) root.classList.add("bx-calm");
  addEventListener("gd:lang", () => { build(); redraws.forEach((r) => r()); });
  new ResizeObserver(() => build()).observe(document.body);
}

Promise.all([loadImg("jumpi", "/jumpi-logo.png"), loadImg("puff", "/site/img/company/puffball-logo.png")]).then(() => {
  try { start(); } catch (e) { console.error("[company-box]", e); root.classList.add("bx-no3d"); }
  // the printed faces again once the round font has arrived
  if (document.fonts) Promise.all(["700 40px Fredoka", "600 40px Fredoka"].map((f) => document.fonts.load(f, "אבג abc"))).then(() => redraws.forEach((r) => r())).catch(() => {});
});
