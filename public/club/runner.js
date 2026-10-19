/* Jumpi Club: the banner next to the log-in. A little Jumpi runs along a glowing track in the sky, jumps over the
   blocks in the way and collects spinning gold coins with the Jumpi Club logo on them; each coin pops with sparkles
   and the counter in the corner goes up. Everything is made here in code (no models to load).
   It only draws while it can be seen (stops when the tab is hidden or the banner is scrolled away), keeps the pixel
   ratio low on phones, and with "reduce motion" it shows one still picture. */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const TAU = Math.PI * 2;
export function startRunner(host, { onCoin } = {}) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const R = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  R.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 2));
  R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(R.domElement);
  const sc = new THREE.Scene();

  /* ---------- the sky: a purple → blue gradient, soft clouds, twinkling stars, far floating islands ---------- */
  {
    const c = document.createElement("canvas"); c.width = 16; c.height = 512; const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, "#3a1fb8"); g.addColorStop(.45, "#6a35f0"); g.addColorStop(.8, "#3d7dff"); g.addColorStop(1, "#7fd0ff");
    x.fillStyle = g; x.fillRect(0, 0, 16, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; sc.background = t;
  }
  sc.fog = new THREE.Fog("#6a5cf0", 30, 70);
  sc.add(new THREE.HemisphereLight("#e8e2ff", "#5a3ad0", 1.25));
  const sun = new THREE.DirectionalLight("#fff3e0", 2.4); sun.position.set(6, 12, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 8, bottom: -6, near: 1, far: 40 }); sc.add(sun);
  const rim = new THREE.DirectionalLight("#7fe4ff", 1.6); rim.position.set(-8, 4, -6); sc.add(rim);

  // a soft round glow (used for sparkles, coin shine and the lights on the track)
  const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.25, "rgba(255,255,255,.85)"); g.addColorStop(.6, "rgba(255,255,255,.18)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const starTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"); x.translate(64, 64);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 22); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 22, 0, TAU); x.fill();
    x.fillStyle = "#fff"; for (const r of [0, Math.PI / 2]) { x.save(); x.rotate(r); x.beginPath(); x.moveTo(-60, 0); x.quadraticCurveTo(0, -5, 60, 0); x.quadraticCurveTo(0, 5, -60, 0); x.fill(); x.restore(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();

  const far = new THREE.Group(); sc.add(far);   // things that drift by slowly (parallax)
  const cloudM = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, emissive: "#b9a8ff", emissiveIntensity: .35, transparent: true, opacity: .92 });
  const clouds = [];
  for (let i = 0; i < 9; i++) { const g = new THREE.Group(), n = 4 + (i % 3);
    for (let k = 0; k < n; k++) { const s = .9 + Math.random() * 1.4, m = new THREE.Mesh(new THREE.SphereGeometry(s, 20, 14), cloudM); m.position.set(k * 1.25 - n * .6, Math.random() * .5 + (k % 2 ? .4 : 0), Math.random() * .6); m.scale.y = .72; g.add(m); }
    g.position.set(-30 + i * 8 + Math.random() * 3, 2 + Math.random() * 7, -14 - Math.random() * 12); g.scale.setScalar(1.1 + Math.random() * .6); g.userData.v = .18 + Math.random() * .2; far.add(g); clouds.push(g); }
  // floating islands far behind, with a little tree
  const islands = [];
  for (let i = 0; i < 0; i++) { const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, .7, 28), new THREE.MeshStandardMaterial({ color: "#6be38e", roughness: .8 })); g.add(top);
    const rock = new THREE.Mesh(new THREE.ConeGeometry(2.5, 3.2, 28), new THREE.MeshStandardMaterial({ color: "#9b7bff", roughness: .9 })); rock.rotation.x = Math.PI; rock.position.y = -1.95; g.add(rock);
    const tr = new THREE.Mesh(new THREE.SphereGeometry(.8, 16, 12), new THREE.MeshStandardMaterial({ color: "#3fcf7a", roughness: .8 })); tr.position.set(.6, 1.2, 0); g.add(tr);
    const tk = new THREE.Mesh(new THREE.CylinderGeometry(.12, .16, .9, 8), new THREE.MeshStandardMaterial({ color: "#f3d6a8" })); tk.position.set(.6, .55, 0); g.add(tk);
    g.position.set(-24 + i * 15, 6 + (i % 2) * 3.5, -42 - (i % 2) * 8); g.scale.setScalar(1.2 + (i % 3) * .3); g.userData.v = .35; far.add(g); islands.push(g); }
  const stars = new THREE.Group(); sc.add(stars);
  for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: i % 3 ? "#ffffff" : "#ffe68a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set(-22 + Math.random() * 46, 4 + Math.random() * 11, -12 - Math.random() * 18); const k = .5 + Math.random() * .9; s.scale.setScalar(k); s.userData = { k, ph: Math.random() * TAU }; stars.add(s); }

  /* ---------- the track: glossy tiles with glowing edges, floating in the sky ---------- */
  const TRACK_W = 4.2, SEG = 3, NSEG = 16;
  const tileTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, "#f2eeff"); g.addColorStop(1, "#d8cfff"); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = "rgba(122,88,255,.35)"; x.lineWidth = 6; x.strokeRect(3, 3, 250, 250); x.fillStyle = "rgba(255,255,255,.5)"; x.fillRect(14, 14, 228, 16);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
  const tileM = new THREE.MeshPhysicalMaterial({ map: tileTex, roughness: .35, clearcoat: .8, clearcoatRoughness: .2 });
  const sideM = new THREE.MeshStandardMaterial({ color: "#5a2ee0", roughness: .5 });
  const edgeM = new THREE.MeshStandardMaterial({ color: "#7ff6ff", emissive: "#59e0ff", emissiveIntensity: 2.2 });
  const track = new THREE.Group(); sc.add(track); const segs = [];
  for (let i = 0; i < NSEG; i++) { const g = new THREE.Group();
    const top = new THREE.Mesh(new RoundedBoxGeometry(SEG - .03, .5, TRACK_W, 3, .06), [sideM, sideM, tileM, sideM, sideM, sideM]); top.position.y = -.25; top.receiveShadow = true; g.add(top);
    const under = new THREE.Mesh(new THREE.BoxGeometry(SEG - .3, 1.4, TRACK_W - .6), sideM); under.position.y = -1.15; g.add(under);
    [-1, 1].forEach((s) => { const e = new THREE.Mesh(new THREE.BoxGeometry(SEG - .1, .09, .09), edgeM); e.position.set(0, .02, s * (TRACK_W / 2 + .02)); g.add(e); });
    if (i % 2 === 0) [-1, 1].forEach((s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: "#59e0ff", transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.setScalar(1.1); sp.position.set(0, .05, s * (TRACK_W / 2 + .02)); g.add(sp); });
    g.position.x = -18 + i * SEG; track.add(g); segs.push(g); }

  /* ---------- Jumpi: an egg-shaped body with big shiny eyes, a smile, little arms and legs, red sneakers ---------- */
  const jumpi = new THREE.Group(), rig = new THREE.Group(); jumpi.add(rig); sc.add(jumpi);
  const skin = new THREE.MeshPhysicalMaterial({ color: "#38b6ff", roughness: .45, clearcoat: .5, clearcoatRoughness: .3, sheen: .6, sheenColor: new THREE.Color("#bfe9ff") });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 30), skin); body.scale.set(.95, 1.1, .9); body.position.y = 1.55; body.castShadow = true; rig.add(body);
  const face = new THREE.Group(); face.position.set(0, 1.75, 0); face.rotation.y = Math.PI / 2; rig.add(face);   // the face looks the way Jumpi runs (+x)
  const white = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: .15, clearcoat: 1 }), iris = new THREE.MeshPhysicalMaterial({ color: "#7a3a14", roughness: .2, clearcoat: 1 }),
    pupil = new THREE.MeshPhysicalMaterial({ color: "#0d0d12", roughness: .1, clearcoat: 1 }), shine = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  const eyes = [];
  [-1, 1].forEach((s) => { const e = new THREE.Group(); e.position.set(s * .36, .08, .78); e.rotation.y = s * .32;
    const w = new THREE.Mesh(new THREE.SphereGeometry(.3, 28, 20), white); w.scale.set(1, 1.18, .55); e.add(w);
    const ir = new THREE.Mesh(new THREE.SphereGeometry(.2, 24, 16), iris); ir.scale.set(1, 1.15, .5); ir.position.z = .12; e.add(ir);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(.11, 20, 14), pupil); pu.scale.set(1, 1.15, .5); pu.position.z = .19; e.add(pu);
    const h1 = new THREE.Mesh(new THREE.SphereGeometry(.055, 12, 8), shine); h1.position.set(.06, .1, .23); e.add(h1);
    const h2 = new THREE.Mesh(new THREE.SphereGeometry(.028, 10, 8), shine); h2.position.set(-.06, -.07, .23); e.add(h2);
    face.add(e); eyes.push(e); });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(.17, .035, 10, 24, Math.PI), new THREE.MeshStandardMaterial({ color: "#123a66", roughness: .5 })); smile.rotation.z = Math.PI; smile.position.set(0, -.28, .86); face.add(smile);
  [-1, 1].forEach((s) => { const ch = new THREE.Mesh(new THREE.CircleGeometry(.13, 20), new THREE.MeshBasicMaterial({ color: "#ff7ab0", transparent: true, opacity: .55, depthWrite: false })); ch.position.set(s * .58, -.22, .74); ch.rotation.y = s * .65; face.add(ch); });
  // a tuft on top
  { const tuft = new THREE.Mesh(new THREE.ConeGeometry(.16, .5, 16), skin); tuft.position.set(-.08, 2.72, 0); tuft.rotation.z = .35; rig.add(tuft); }
  const limb = (r, l, m) => { const g = new THREE.CapsuleGeometry(r, l, 6, 14); g.translate(0, -l / 2 - r * .3, 0); const x = new THREE.Mesh(g, m); x.castShadow = true; return x; };
  const arms = [-1, 1].map((s) => { const a = limb(.13, .42, skin); a.position.set(0, 1.55, s * .86); rig.add(a); return a; });
  const shoe = new THREE.MeshPhysicalMaterial({ color: "#ff4f5f", roughness: .35, clearcoat: .7 }), sole = new THREE.MeshStandardMaterial({ color: "#ffffff" });
  const legs = [-1, 1].map((s) => { const L = new THREE.Group(); L.position.set(0, .72, s * .36); const lg = limb(.15, .3, skin); L.add(lg);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(.24, 20, 14), shoe); sh.scale.set(1.45, .75, 1); sh.position.set(.08, -.62, 0); sh.castShadow = true; L.add(sh);
    const so = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .06, 20), sole); so.scale.set(1.45, 1, 1); so.position.set(.08, -.78, 0); L.add(so); rig.add(L); return L; });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.9, 32), new THREE.MeshBasicMaterial({ color: "#2a1680", transparent: true, opacity: .28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .015; sc.add(shadow);
  jumpi.rotation.y = -1.2;   // turned towards us (3/4) so we see the face

  /* ---------- coins: gold with the Jumpi Club logo on both faces ---------- */
  const coinFace = new THREE.CanvasTexture(document.createElement("canvas")); coinFace.colorSpace = THREE.SRGBColorSpace;
  { const c = coinFace.image; c.width = c.height = 256; const x = c.getContext("2d");
    const paint = (img) => { x.clearRect(0, 0, 256, 256); const g = x.createRadialGradient(100, 90, 10, 128, 128, 128); g.addColorStop(0, "#fff2a8"); g.addColorStop(.55, "#ffc93a"); g.addColorStop(1, "#e08a00");
      x.fillStyle = g; x.beginPath(); x.arc(128, 128, 128, 0, TAU); x.fill(); x.lineWidth = 12; x.strokeStyle = "#ffe27a"; x.beginPath(); x.arc(128, 128, 112, 0, TAU); x.stroke();
      x.lineWidth = 4; x.strokeStyle = "rgba(160,90,0,.5)"; x.beginPath(); x.arc(128, 128, 104, 0, TAU); x.stroke();
      if (img) { const w = 176, h = w * img.height / img.width; x.drawImage(img, 128 - w / 2, 128 - h / 2, w, h); }
      coinFace.needsUpdate = true; };
    paint(null); const im = new Image(); im.onload = () => paint(im); im.src = "/club/img/jumpi-club-logo-300.png"; }
  const coinFaceM = new THREE.MeshPhysicalMaterial({ map: coinFace, roughness: .25, metalness: .35, clearcoat: 1, emissive: "#6a4200", emissiveIntensity: .25 });
  const coinSideM = new THREE.MeshPhysicalMaterial({ color: "#f0a800", roughness: .25, metalness: .6, clearcoat: 1 });
  const coinG = new THREE.CylinderGeometry(.5, .5, .12, 40); coinG.rotateX(Math.PI / 2);
  const COINS = []; const coinGlow = () => new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: "#ffd34a", transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
  for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(coinG, [coinSideM, coinFaceM, coinFaceM]); m.castShadow = true; const gl = coinGlow(); gl.scale.setScalar(1.9); m.add(gl);
    m.visible = false; sc.add(m); COINS.push({ m, x: 0, y: 0, alive: false }); }

  /* ---------- obstacles: rounded blocks with candy stripes, and a little bouncy barrier ---------- */
  const stripe = (a, b) => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"); x.fillStyle = a; x.fillRect(0, 0, 128, 128); x.fillStyle = b;
    for (let k = -2; k < 6; k++) { x.beginPath(); x.moveTo(k * 32, 0); x.lineTo(k * 32 + 16, 0); x.lineTo(k * 32 + 16 + 128, 128); x.lineTo(k * 32 + 128, 128); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const OBM = [new THREE.MeshPhysicalMaterial({ map: stripe("#ff5fa8", "#ffffff"), roughness: .3, clearcoat: .8 }), new THREE.MeshPhysicalMaterial({ map: stripe("#ffb02e", "#fff3c4"), roughness: .3, clearcoat: .8 }),
    new THREE.MeshPhysicalMaterial({ map: stripe("#2fd36b", "#e9ffef"), roughness: .3, clearcoat: .8 })];
  const OBS = []; const blockG = new RoundedBoxGeometry(1.1, 1.1, 2.4, 4, .22), lowG = new RoundedBoxGeometry(.9, .75, 3.0, 4, .2);
  for (let i = 0; i < 4; i++) { const g = new THREE.Group(); const low = i % 2 === 1, m = new THREE.Mesh(low ? lowG : blockG, OBM[i % 3]); m.position.y = low ? .375 : .55; m.castShadow = true; m.receiveShadow = true; g.add(m);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(low ? .95 : 1.15, .08, low ? 3.05 : 2.45), edgeM); cap.position.y = (low ? .75 : 1.1) + .02; g.add(cap);
    g.visible = false; sc.add(g); OBS.push({ g, x: 0, h: low ? .75 : 1.1, alive: false }); }

  /* ---------- sparkles when a coin is picked up ---------- */
  const SP = []; for (let i = 0; i < 60; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: i % 2 ? "#ffe27a" : "#ffffff", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.visible = false; sc.add(s); SP.push({ s, life: 0 }); }
  const burst = (x, y, z) => { let n = 0; for (const p of SP) { if (p.life > 0) continue; const a = Math.random() * TAU, v = 2 + Math.random() * 3;
      p.life = .5 + Math.random() * .35; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v + 1.5; p.vz = (Math.random() - .5) * 2; p.s.position.set(x, y, z); p.s.visible = true; p.max = p.life; if (++n >= 9) break; } };
  // a ring that grows out of the coin
  const RINGS = []; for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(.4, .52, 40), new THREE.MeshBasicMaterial({ color: "#ffe27a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); r.visible = false; sc.add(r); RINGS.push({ r, life: 0 }); }
  const ring = (x, y, z) => { const q = RINGS.find((p) => p.life <= 0); if (!q) return; q.life = .45; q.r.position.set(x, y, z); q.r.visible = true; };
  // dust when landing
  const DUST = []; for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: "#ffffff", transparent: true, opacity: 0, depthWrite: false })); s.visible = false; sc.add(s); DUST.push({ s, life: 0 }); }
  const dust = (x) => { let n = 0; for (const p of DUST) { if (p.life > 0) continue; p.life = .55; p.s.position.set(x - .2 + Math.random() * .4, .15, (Math.random() - .5) * 1.4); p.vx = -1.5 - Math.random(); p.s.visible = true; if (++n >= 5) break; } };

  /* ---------- the run ---------- */
  const SPEED = 7.2, G = 30, JV = 11.5;
  let worldX = 0, nextSpawn = 8, jy = 0, vy = 0, air = false, squash = 0, coins = 0;
  const spawn = (x) => {
    const pick = Math.random();
    if (pick < .62) { const o = OBS.find((q) => !q.alive); if (o) { o.alive = true; o.x = x; o.g.visible = true; o.g.position.set(x, 0, 0);
        // coins in an arc over it (Jumpi collects them in the air)
        for (let k = 0; k < 5; k++) { const c = COINS.find((q) => !q.alive); if (!c) break; const u = (k - 2) / 2; c.alive = true; c.x = x + u * 1.9; c.y = o.h + 1.3 + (1 - u * u) * 1.4; c.m.visible = true; } } }
    else for (let k = 0; k < 4; k++) { const c = COINS.find((q) => !q.alive); if (!c) break; c.alive = true; c.x = x - 1.5 + k * 1.1; c.y = 1.5; c.m.visible = true; }
  };
  for (let x = 6; x < 30; x += 9) spawn(x);
  nextSpawn = 30;

  const cam = new THREE.PerspectiveCamera(36, 1, .1, 120);
  let W = 1, H = 1;
  const fit = () => { W = host.clientWidth || 1; H = host.clientHeight || 1; R.setSize(W, H, false); R.domElement.style.width = "100%"; R.domElement.style.height = "100%"; cam.aspect = W / H;
    const tall = W / H < 1.1;   // a narrow banner (phone): come closer and look a little more from the side
    cam.position.set(tall ? -2 : -3.4, tall ? 6.2 : 6.4, tall ? 17.5 : 19.5); cam.lookAt(tall ? 3 : 4.6, tall ? 1.1 : 1.4, 0); cam.fov = tall ? 40 : 32; cam.updateProjectionMatrix(); };
  fit(); new ResizeObserver(fit).observe(host);

  let last = performance.now(), t = 0, raf = 0, on = true;
  const step = (dt) => {
    t += dt; const dx = SPEED * dt; worldX += dx;
    // the track scrolls under Jumpi
    for (const s of segs) { s.position.x -= dx; if (s.position.x < -20) s.position.x += SEG * NSEG; }
    for (const c of clouds) { c.position.x -= c.userData.v * dt * 3; if (c.position.x < -34) c.position.x += 70; }
    for (const g of islands) { g.position.x -= g.userData.v * dt * 3; g.position.y += Math.sin(t * .8 + g.position.x) * .002; if (g.position.x < -34) g.position.x += 64; }
    stars.children.forEach((s) => { const k = s.userData.k * (.65 + .35 * Math.sin(t * 2.4 + s.userData.ph)); s.scale.setScalar(k); });
    // move the obstacles and coins; spawn more ahead
    let ahead = Infinity;
    for (const o of OBS) { if (!o.alive) continue; o.x -= dx; o.g.position.x = o.x; if (o.x < -14) { o.alive = false; o.g.visible = false; } else if (o.x > -.4 && o.x < ahead) ahead = o.x; }
    nextSpawn -= dx; if (nextSpawn < 22) { spawn(nextSpawn + 8); nextSpawn += 8 + Math.random() * 3; }
    // jump when a block comes close
    if (!air && ahead < 2.25) { air = true; vy = JV; }
    if (air) { vy -= G * dt; jy += vy * dt; if (jy <= 0) { jy = 0; air = false; vy = 0; squash = 1; dust(.2); } }
    squash = Math.max(0, squash - dt * 5);
    // running and jumping poses
    const ph = t * 13, run = air ? 0 : 1;
    legs[0].rotation.z = run ? Math.sin(ph) * .9 : -.55; legs[1].rotation.z = run ? -Math.sin(ph) * .9 : .35;
    arms[0].rotation.z = run ? -Math.sin(ph) * 1.1 : 2.4; arms[1].rotation.z = run ? Math.sin(ph) * 1.1 : 2.6;
    arms[0].rotation.x = arms[1].rotation.x = air ? 0 : 0;
    const bob = run ? Math.abs(Math.sin(ph)) * .14 : 0, stretch = air ? Math.min(.12, Math.abs(vy) * .012) : 0;
    rig.position.y = jy + bob; rig.scale.set(1 + squash * .18 - stretch * .5, 1 - squash * .2 + stretch, 1 + squash * .18 - stretch * .5);
    rig.rotation.z = air ? -Math.max(-.35, Math.min(.35, vy * .03)) : -.08 - Math.sin(ph * 2) * .02;
    face.position.y = 1.75 + Math.sin(t * 3) * .015;
    if (Math.floor(t * 10) % 37 === 0) eyes.forEach((e) => (e.scale.y = .15)); else eyes.forEach((e) => (e.scale.y = 1));   // a blink now and then
    shadow.scale.setScalar(Math.max(.45, 1 - jy * .14)); shadow.material.opacity = .28 * Math.max(.35, 1 - jy * .12);
    // coins spin, bob, and get picked up
    const hx = 0, hy = jy + 1.55;
    for (const c of COINS) { if (!c.alive) continue; c.x -= dx; c.m.position.set(c.x, c.y + Math.sin(t * 4 + c.x) * .08, 0); c.m.rotation.y = t * 4 + c.x;
      if (Math.abs(c.x - hx) < .75 && Math.abs(c.y - hy) < 1.35) { c.alive = false; c.m.visible = false; burst(c.x, c.y, 0); ring(c.x, c.y, .2); coins++; onCoin && onCoin(coins); }
      else if (c.x < -14) { c.alive = false; c.m.visible = false; } }
    for (const p of SP) { if (p.life <= 0) continue; p.life -= dt; if (p.life <= 0) { p.s.visible = false; continue; } p.vy -= 9 * dt; p.s.position.x += (p.vx - SPEED) * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      const k = p.life / p.max; p.s.material.opacity = k; p.s.scale.setScalar(.25 + .45 * k); p.s.material.rotation += dt * 4; }
    for (const q of RINGS) { if (q.life <= 0) continue; q.life -= dt; if (q.life <= 0) { q.r.visible = false; continue; } const k = 1 - q.life / .45; q.r.scale.setScalar(.8 + k * 1.3); q.r.material.opacity = 1 - k; q.r.position.x -= SPEED * dt; q.r.lookAt(cam.position); }
    for (const p of DUST) { if (p.life <= 0) continue; p.life -= dt; if (p.life <= 0) { p.s.visible = false; continue; } const k = p.life / .55; p.s.position.x += p.vx * dt; p.s.position.y += dt * .5; p.s.scale.setScalar(.5 + (1 - k) * .9); p.s.material.opacity = .55 * k; }
  };
  const frame = (now) => { raf = 0; if (!on) return; const dt = Math.min(.05, (now - last) / 1000); last = now; step(dt); R.render(sc, cam); raf = requestAnimationFrame(frame); };
  const play = () => { if (raf || reduce) return; on = true; last = performance.now(); raf = requestAnimationFrame(frame); };
  const stop = () => { on = false; if (raf) cancelAnimationFrame(raf); raf = 0; };
  if (reduce) { for (let i = 0; i < 40; i++) step(1 / 30); R.render(sc, cam); }
  else { new IntersectionObserver((e) => (e[0].isIntersecting && !document.hidden ? play() : stop())).observe(host);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : play())); play(); }
  return { stop };
}
