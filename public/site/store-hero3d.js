/* Jumpi Store: the live 3D hero. A golden treasure chest that keeps opening, a fountain of coins and crystals in a
   beam of light, two real Jumpis (the game's own model) next to it and a bag of coins. Click the chest for a burst.
   The picture (img/store/hero-*.webp) stays underneath: it's what people see while this loads, with "reduce motion",
   or when the computer can't draw 3D. Drawn only while the hero is on screen. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const hero = document.querySelector(".st-hero");
const canvas = document.getElementById("stHero3d");
const reduce = window.JUMPI_REDUCE_MOTION || matchMedia("(prefers-reduced-motion: reduce)").matches;

if (hero && canvas && !reduce) start().catch((e) => { console.warn("[store hero]", e && e.message); canvas.remove(); });

async function start() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) { canvas.remove(); return; }
  // the canvas always covers the hero exactly (even if an old store.css is still in the browser's cache)
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;z-index:-1";
  const small = () => innerWidth <= 760;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 120);
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- a soft studio "room" for the shiny gold to reflect ---------- */
  {
    const room = new THREE.Scene();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: "varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
      fragmentShader: "varying vec3 p; void main(){ float h = p.y*.5+.5; vec3 c = mix(vec3(.12,.07,.28), vec3(1.,.86,.62), smoothstep(.35,1.,h)); c += vec3(.55,.35,.9)*smoothstep(.2,.0,abs(p.x+.3))*.35; gl_FragColor = vec4(c,1.); }",
    }));
    room.add(sky);
    const panel = (x, y, z, w, h, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); room.add(m); };
    panel(0, 8, 2, 8, 4, 0xffffff); panel(-7, 3, 4, 3, 5, 0xfff0d0); panel(7, 2, -3, 3, 4, 0xd8c8ff); panel(0, 1, 8, 6, 2, 0xffe6b0);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(room, 0.03).texture;
    pm.dispose();
  }

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0xcdbcff, 0x2a1660, 0.9));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.2);
  key.position.set(1.5, 9, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -3, near: 1, far: 30 });
  key.shadow.radius = 8;
  key.shadow.bias = -0.0006;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb48cff, 1.6);
  rim.position.set(-4, 3, -6);
  scene.add(rim);

  const world = new THREE.Group();   // everything, moved/scaled to sit beside the text
  scene.add(world);
  const tilt = new THREE.Group();    // the gentle follow-the-mouse turn
  world.add(tilt);

  /* ---------- textures drawn on a canvas ---------- */
  const tex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const glowTex = (stops) => tex(128, 128, (c, w) => { const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); stops.forEach(([o, col]) => g.addColorStop(o, col)); c.fillStyle = g; c.fillRect(0, 0, w, w); });
  const starPath = (c, cx, cy, R, r, n = 5) => { c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r : R; c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } c.closePath(); };
  const coinFace = tex(256, 256, (c, w) => {
    const m = w / 2;
    let g = c.createRadialGradient(m * 0.8, m * 0.7, 10, m, m, m); g.addColorStop(0, "#fff3a6"); g.addColorStop(0.55, "#ffc62a"); g.addColorStop(1, "#e08a00");
    c.fillStyle = g; c.fillRect(0, 0, w, w);
    c.lineWidth = 14; c.strokeStyle = "#c97400"; c.beginPath(); c.arc(m, m, m - 26, 0, TAU); c.stroke();
    c.lineWidth = 5; c.strokeStyle = "#fff0a0"; c.beginPath(); c.arc(m, m, m - 36, 0, TAU); c.stroke();
    starPath(c, m + 5, m + 7, 72, 30); c.fillStyle = "#c97400"; c.fill();
    starPath(c, m, m, 72, 30); g = c.createLinearGradient(0, m - 70, 0, m + 70); g.addColorStop(0, "#fffbe0"); g.addColorStop(1, "#ffd23a"); c.fillStyle = g; c.fill();
  });
  const sparkTex = tex(64, 64, (c, w) => {
    const m = w / 2, g = c.createRadialGradient(m, m, 0, m, m, m); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.18, "rgba(255,255,255,.65)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, w, w);
    c.fillStyle = "#fff"; c.beginPath(); c.moveTo(m, 2); c.quadraticCurveTo(m, m, w - 2, m); c.quadraticCurveTo(m, m, m, w - 2); c.quadraticCurveTo(m, m, 2, m); c.quadraticCurveTo(m, m, m, 2); c.fill();
  });

  /* ---------- materials ---------- */
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd04e, metalness: 0.72, roughness: 0.26, envMapIntensity: 1.3, emissive: 0x7a4200, emissiveIntensity: 0.28 });
  const goldDeep = new THREE.MeshStandardMaterial({ color: 0xf0a020, metalness: 0.75, roughness: 0.32, emissive: 0x5a2c00, emissiveIntensity: 0.25 });
  const goldBand = new THREE.MeshStandardMaterial({ color: 0xfff2c0, metalness: 0.8, roughness: 0.16, envMapIntensity: 1.5, emissive: 0x6a5020, emissiveIntensity: 0.25 });
  const coinEdge = new THREE.MeshStandardMaterial({ color: 0xffb81f, metalness: 0.75, roughness: 0.28, emissive: 0x6a3a00, emissiveIntensity: 0.3 });
  const coinTop = new THREE.MeshStandardMaterial({ map: coinFace, metalness: 0.55, roughness: 0.32, emissive: 0x5a3000, emissiveIntensity: 0.25 });
  const coinMats = [coinEdge, coinTop, coinTop];
  const shadowCast = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

  /* ---------- the floor: only the shadows and a warm glow ---------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), new THREE.ShadowMaterial({ color: 0x0a0428, opacity: 0.22 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  tilt.add(floor);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.2), new THREE.MeshBasicMaterial({ map: glowTex([[0, "rgba(255,200,90,.55)"], [0.45, "rgba(190,110,255,.18)"], [1, "rgba(120,60,255,0)"]]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0.2, 0.01, 0.2);
  tilt.add(pool);

  /* ---------- the big chest ---------- */
  const CH = { w: 2.1, d: 1.35, h: 1.15 };
  const chest = new THREE.Group();
  chest.position.set(-1.15, 0, 0);
  chest.rotation.y = 0.32;
  tilt.add(chest);
  chest.add(shadowCast(new THREE.Mesh(new RoundedBoxGeometry(CH.w, CH.h, CH.d, 4, 0.1), gold)).translateY(CH.h / 2));
  // bands and corner plates
  for (const x of [-0.62, 0.62]) chest.add(shadowCast(new THREE.Mesh(new RoundedBoxGeometry(0.2, CH.h + 0.04, CH.d + 0.05, 3, 0.04), goldBand)).translateX(x).translateY(CH.h / 2));
  chest.add(shadowCast(new THREE.Mesh(new RoundedBoxGeometry(CH.w + 0.05, 0.16, CH.d + 0.05, 3, 0.05), goldDeep)).translateY(0.08));
  // the lock and two little gems
  const lock = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.36, 0.08, 3, 0.04), goldBand);
  lock.position.set(0, CH.h - 0.28, CH.d / 2 + 0.03); chest.add(lock);
  const gemMat = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1, flatShading: true });
  for (const [x, c] of [[-0.32, 0xc77dff], [0.32, 0xc77dff]]) { const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), gemMat(c)); g.position.set(x, CH.h * 0.45, CH.d / 2 + 0.035); g.scale.z = 0.5; chest.add(g); }
  // the lid: half a barrel, hinged at the back
  const hinge = new THREE.Group();
  hinge.position.set(0, CH.h, -CH.d / 2);
  chest.add(hinge);
  const lidGeo = new THREE.CylinderGeometry(CH.d / 2, CH.d / 2, CH.w, 40, 1, false, 0, Math.PI);
  lidGeo.rotateZ(Math.PI / 2);
  const lid = shadowCast(new THREE.Mesh(lidGeo, gold));
  lid.position.z = CH.d / 2;
  hinge.add(lid);
  const lidIn = new THREE.Mesh(new THREE.PlaneGeometry(CH.w, CH.d), new THREE.MeshStandardMaterial({ color: 0xb86a00, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide }));
  lidIn.rotation.x = Math.PI / 2; lidIn.position.z = CH.d / 2; hinge.add(lidIn);
  for (const x of [-0.62, 0.62]) {
    const g = new THREE.CylinderGeometry(CH.d / 2 + 0.03, CH.d / 2 + 0.03, 0.2, 40, 1, false, 0, Math.PI);
    g.rotateZ(Math.PI / 2);
    const b = shadowCast(new THREE.Mesh(g, goldBand)); b.position.set(x, 0, CH.d / 2); hinge.add(b);
  }
  // the heap of coins inside, bulging over the rim
  const heapN = 70;
  const heap = new THREE.InstancedMesh(coinGeo(), coinMats, heapN);
  heap.castShadow = true;
  {
    const o = new THREE.Object3D();
    for (let i = 0; i < heapN; i++) {
      const u = rnd(-1, 1), v = rnd(-1, 1), dome = Math.max(0, 1 - (u * u * 0.8 + v * v * 0.9));
      o.position.set(u * (CH.w / 2 - 0.2), CH.h - 0.04 + dome * 0.32 + rnd(0, 0.05), v * (CH.d / 2 - 0.18));
      o.rotation.set(rnd(-0.6, 0.6), rnd(0, TAU), rnd(-0.6, 0.6));
      o.updateMatrix(); heap.setMatrixAt(i, o.matrix);
    }
  }
  chest.add(heap);
  // the light from inside
  const inner = new THREE.PointLight(0xffc860, 18, 6, 1.6);
  inner.position.set(0, CH.h + 0.5, 0.1);
  chest.add(inner);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex([[0, "rgba(255,250,220,1)"], [0.25, "rgba(255,220,120,.75)"], [1, "rgba(255,170,60,0)"]]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(3.2, 2.4, 1); halo.position.set(0, CH.h + 0.45, 0); chest.add(halo);
  // the beam of light going up
  const beamGeo = new THREE.CylinderGeometry(1.55, 0.85, 6.5, 48, 1, true);
  beamGeo.translate(0, 3.25, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 } },
    vertexShader: "varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec3 n = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix*mv; }",
    fragmentShader: "uniform float uT; varying vec2 vUv; varying float vF; void main(){ float a = pow(vF, 2.2) * smoothstep(1., .05, vUv.y) * smoothstep(0., .08, vUv.y); a *= .55 + .12*sin(vUv.x*40. + uT*1.5) + .08*sin(vUv.y*9. - uT*2.); gl_FragColor = vec4(vec3(1., .9, .66)*a*.75, a); }",
  }));
  beam.position.set(0, CH.h, 0.05);
  chest.add(beam);

  /* ---------- a small chest behind, closed over a pile of coins ---------- */
  const wood = new THREE.MeshStandardMaterial({ color: 0xd2761f, roughness: 0.55, metalness: 0.15 });
  const small2 = new THREE.Group();
  small2.position.set(0.45, 0, -0.75); small2.rotation.y = -0.25; small2.scale.setScalar(0.62);
  tilt.add(small2);
  small2.add(shadowCast(new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.9, 1.05, 3, 0.08), wood)).translateY(0.45));
  for (const x of [-0.5, 0.5]) small2.add(shadowCast(new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.94, 1.1, 3, 0.03), goldBand)).translateX(x).translateY(0.45));
  const lid2 = new THREE.Group(); lid2.position.set(0, 0.9, -0.52); lid2.rotation.x = -0.9; small2.add(lid2);
  const lg2 = new THREE.CylinderGeometry(0.52, 0.52, 1.6, 30, 1, false, 0, Math.PI); lg2.rotateZ(Math.PI / 2);
  lid2.add(shadowCast(new THREE.Mesh(lg2, wood)).translateZ(0.52));
  const glow2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex([[0, "rgba(255,220,140,.9)"], [1, "rgba(255,150,50,0)"]]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow2.scale.set(2.2, 1.3, 1); glow2.position.set(0, 1.05, 0); small2.add(glow2);

  /* ---------- coins on the floor and stacks ---------- */
  const floorSpots = [];
  for (let i = 0; i < 46; i++) {
    const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * 1.5 + 0.2;
    floorSpots.push([-1.0 + Math.cos(a) * r * 1.25, Math.sin(a) * r * 0.65 + 0.85]);
  }
  const stacks = [[-2.55, 0.55, 7], [-2.25, 0.95, 4], [0.05, 0.85, 6], [1.55, 0.95, 4], [2.95, 0.85, 5], [-0.3, 1.25, 3]];
  const stackN = stacks.reduce((n, s) => n + s[2], 0);
  const ground = new THREE.InstancedMesh(coinGeo(), coinMats, floorSpots.length + stackN);
  ground.castShadow = true; ground.receiveShadow = true;
  {
    const o = new THREE.Object3D(); let k = 0;
    for (const [x, z] of floorSpots) {
      const lean = Math.random() < 0.25;
      o.position.set(x, lean ? 0.12 : 0.025 + rnd(0, 0.04), z);
      o.rotation.set(lean ? rnd(0.9, 1.3) : rnd(-0.25, 0.25), rnd(0, TAU), lean ? 0 : rnd(-0.25, 0.25));
      o.updateMatrix(); ground.setMatrixAt(k++, o.matrix);
    }
    for (const [x, z, n] of stacks) for (let i = 0; i < n; i++) {
      o.position.set(x + rnd(-0.015, 0.015), 0.025 + i * 0.05, z + rnd(-0.015, 0.015));
      o.rotation.set(0, rnd(0, TAU), 0); o.updateMatrix(); ground.setMatrixAt(k++, o.matrix);
    }
  }
  tilt.add(ground);

  /* ---------- the coin bag ---------- */
  const bag = new THREE.Group();
  bag.position.set(3.45, 0, 0.45); bag.rotation.y = -0.5;
  tilt.add(bag);
  const bagMat = new THREE.MeshStandardMaterial({ color: 0x9b4dff, roughness: 0.6, emissive: 0x2a0a60, emissiveIntensity: 0.3 });
  const pts = []; for (let i = 0; i <= 20; i++) { const k = i / 20, y = k * 1.15; const r = k < 0.72 ? Math.sin(Math.PI * (0.08 + k * 1.05)) * 0.62 : 0.17 + (k - 0.72) * 0.75; pts.push(new THREE.Vector2(Math.max(0.02, r), y)); }
  bag.add(shadowCast(new THREE.Mesh(new THREE.LatheGeometry(pts, 40), bagMat)));
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 10, 30), new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: 0.7, roughness: 0.3 }));
  tie.rotation.x = Math.PI / 2; tie.position.y = 0.88; bag.add(tie);
  const badge = new THREE.Mesh(coinGeo(0.3, 0.06), coinMats); badge.rotation.x = Math.PI / 2; badge.position.set(0, 0.45, 0.6); bag.add(badge);
  const spill = new THREE.InstancedMesh(coinGeo(), coinMats, 9); spill.castShadow = true;
  { const o = new THREE.Object3D(); for (let i = 0; i < 9; i++) { o.position.set(rnd(-0.2, 0.2), 1.12 + i * 0.03, rnd(-0.2, 0.2)); o.rotation.set(rnd(-0.7, 0.7), rnd(0, TAU), rnd(-0.7, 0.7)); o.updateMatrix(); spill.setMatrixAt(i, o.matrix); } }
  bag.add(spill);

  /* ---------- the fountain: coins and crystals flying out of the chest ---------- */
  const FLY = small() ? 44 : 72, GEMS = small() ? 12 : 20, EXTRA = 50;
  const flyers = new THREE.InstancedMesh(coinGeo(0.21, 0.05), coinMats, FLY + EXTRA);
  flyers.castShadow = true; flyers.frustumCulled = false;
  const gemCols = [0xff6fae, 0x6fe7ff, 0xc9a2ff, 0xffe066, 0x8affc1];
  const gemGeo = new THREE.OctahedronGeometry(0.15, 0); gemGeo.scale(1, 1.45, 1);
  const gems = new THREE.InstancedMesh(gemGeo, new THREE.MeshStandardMaterial({ roughness: 0.12, metalness: 0.15, flatShading: true, emissive: 0xffffff, emissiveIntensity: 0.18, transparent: true, opacity: 0.92 }), GEMS);
  gems.frustumCulled = false;
  for (let i = 0; i < GEMS; i++) gems.setColorAt(i, new THREE.Color(gemCols[i % gemCols.length]));
  chest.add(flyers, gems);
  const G = 5.2, mouth = new THREE.Vector3(0, CH.h + 0.2, 0.05);
  const P = [];
  const launch = (p, t, big) => {
    p.pos.set(mouth.x + rnd(-0.55, 0.55), mouth.y + rnd(-0.1, 0.1), mouth.z + rnd(-0.3, 0.3));
    const a = rnd(0, TAU), s = big ? rnd(0.6, 1.8) : rnd(0.15, 0.85);
    p.vel.set(Math.cos(a) * s + 0.12, big ? rnd(4.6, 6.4) : rnd(3.6, 5.3), Math.sin(a) * s * 0.6 + 0.15);
    p.rot.set(rnd(0, TAU), rnd(0, TAU), rnd(0, TAU));
    p.spin.set(rnd(-7, 7), rnd(-4, 4), rnd(-7, 7));
    p.t0 = t; p.live = true;
  };
  for (let i = 0; i < FLY + EXTRA + GEMS; i++) {
    const kind = i < FLY + EXTRA ? "coin" : "gem";
    P.push({ kind, idx: kind === "coin" ? i : i - FLY - EXTRA, extra: kind === "coin" && i >= FLY, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), t0: 0, live: false, wait: rnd(0, 2.6) });
  }
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < FLY + EXTRA; i++) flyers.setMatrixAt(i, hide);
  for (let i = 0; i < GEMS; i++) gems.setMatrixAt(i, hide);

  /* ---------- sparkles: around the chest, and faint stars everywhere ---------- */
  const sparkMat = (size, warm) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uMap: { value: sparkTex }, uSize: { value: size }, uPx: { value: 1 } },
    vertexShader: "attribute float aPh; uniform float uT, uSize, uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); float tw = .5+.5*sin(uT*(1.3+fract(aPh*7.)*2.)+aPh*6.283); vA = tw; gl_PointSize = uSize*uPx*(.45+.75*tw)*(10./-mv.z); gl_Position = projectionMatrix*mv; }",
    fragmentShader: `uniform sampler2D uMap; varying float vA; void main(){ vec4 c = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(${warm ? "vec3(1.,.93,.75)" : "vec3(.92,.9,1.)"}*c.rgb, c.a*vA); }`,
  });
  const sparkCloud = (n, box, size, warm) => {
    const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { p[i * 3] = rnd(box[0], box[1]); p[i * 3 + 1] = rnd(box[2], box[3]); p[i * 3 + 2] = rnd(box[4], box[5]); ph[i] = Math.random(); }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3)); g.setAttribute("aPh", new THREE.BufferAttribute(ph, 1));
    const m = new THREE.Points(g, sparkMat(size, warm)); m.frustumCulled = false; return m;
  };
  const sparks = sparkCloud(small() ? 40 : 70, [-2.8, 1.2, 0.8, 5.4, -1.2, 1.4], 15, true);
  tilt.add(sparks);
  const stars = sparkCloud(small() ? 60 : 130, [-16, 16, -2, 10, -14, -5], 6, false);
  scene.add(stars);

  /* ---------- the two Jumpis (the real model from the game) ---------- */
  const base = await new Promise((res, rej) => new GLTFLoader().load("/blobby.glb", (g) => res(g.scene), undefined, rej));
  const size = new THREE.Box3().setFromObject(base).getSize(new THREE.Vector3());
  const jScale = 1.35 / (size.y || 1);
  const pink = makeJumpi(base, "#ff6fb5", "#5a2a12"), blue = makeJumpi(base, "#4fc3ff", "#5a2a12");
  pink.root.scale.setScalar(jScale); pink.root.position.set(1.35, 0, 0.55); pink.root.rotation.y = -0.55; pink.turn = -0.55;
  blue.root.scale.setScalar(jScale * 0.96); blue.root.position.set(2.45, 0, 0.15); blue.root.rotation.y = -0.2; blue.turn = -0.2;
  tilt.add(pink.root, blue.root);

  /* ---------- placing it beside the text (right; left in Hebrew; under the text on a phone) ---------- */
  let W = 0, H = 0, rtl = false;
  const fit = () => {
    const r = hero.getBoundingClientRect();
    rtl = document.documentElement.dir === "rtl";
    const w = Math.round(r.width), h = Math.round(r.height);
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, small() ? 1.5 : w > 1600 ? 1.4 : 1.75);
    if (renderer.getPixelRatio() !== dpr) renderer.setPixelRatio(dpr);
    if (w !== W || h !== H || canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) renderer.setSize(w, h, false);
    W = w; H = h;
    sparks.material.uniforms.uPx.value = stars.material.uniforms.uPx.value = dpr * (h / 700);
    cam.aspect = w / h;
    cam.fov = 30;
    cam.position.set(0, 3.1, 15.5);
    cam.lookAt(0, 1.55, 0);
    cam.updateProjectionMatrix();
    // the size of the view at the scene's depth
    const d = cam.position.distanceTo(new THREE.Vector3(0, 1.55, 0));
    const vh = 2 * Math.tan((cam.fov * Math.PI) / 360) * d, vw = vh * cam.aspect;
    const SW = 8.6, SH = 5.4;   // the scene's own width and height (with the fountain)
    let cx, cy, s;
    if (small()) {
      // phone: under the text, filling the width
      s = Math.min((vw * 1.0) / SW, (vh * 0.52) / SH);
      cx = 0; cy = -vh / 2 + vh * 0.15;
    } else {
      const box = hero.querySelector(".st-hero-box").getBoundingClientRect();
      const free = rtl ? (box.left - r.left) / w : 1 - (box.right - r.left) / w;   // the part of the width the text doesn't use
      const share = Math.max(0.44, Math.min(0.64, free));
      s = Math.min((vw * share * 1.02) / SW, (vh * 0.86) / SH);
      const mid = rtl ? share / 2 : 1 - share / 2;
      cx = (mid - 0.5) * vw; cy = -vh / 2 + vh * 0.19;
    }
    world.scale.set(rtl ? -s : s, s, s);
    world.position.set(cx + (rtl ? 0.72 : -0.72) * s, 1.55 + cy, 0);
  };
  let fitQueued = false;
  const fitSoon = () => { if (fitQueued) return; fitQueued = true; requestAnimationFrame(() => { fitQueued = false; fit(); }); };
  new ResizeObserver(fitSoon).observe(hero);
  addEventListener("resize", fitSoon);
  // the graphics card dropped the 3D (a long time in another tab, a driver reset…): show the picture, and come back cleanly
  let lost = false;
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; hero.classList.remove("is-3d"); });
  canvas.addEventListener("webglcontextrestored", () => { lost = false; W = H = 0; fit(); shown = false; last = 0; });
  new MutationObserver(fitSoon).observe(document.documentElement, { attributes: true, attributeFilter: ["dir", "lang"] });
  fit();

  /* ---------- mouse: the scene turns a little toward it, the Jumpis look; a click on the chest bursts ---------- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  hero.addEventListener("pointermove", (e) => { const r = hero.getBoundingClientRect(); mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1; mouse.ty = -(((e.clientY - r.top) / r.height) * 2 - 1); }, { passive: true });
  hero.addEventListener("pointerleave", () => { mouse.tx = 0; mouse.ty = 0; });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let burstAt = -9, lidKick = 0;
  const hitChest = (e) => {
    const r = hero.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    ray.setFromCamera(ndc, cam);
    return ray.intersectObjects([chest, small2, pink.root, blue.root, bag], true)[0];
  };
  hero.addEventListener("pointermove", (e) => { if (e.target.closest(".st-hero-box")) return; hero.style.cursor = hitChest(e) ? "pointer" : ""; }, { passive: true });
  hero.addEventListener("click", (e) => {
    if (e.target.closest("a,button,.st-hero-box")) return;
    const hit = hitChest(e);
    if (!hit) return;
    let o = hit.object; while (o && o !== pink.root && o !== blue.root && o !== tilt) o = o.parent;
    if (o === pink.root || o === blue.root) { (o === pink.root ? pink : blue).hopT = clock.getElapsedTime(); return; }
    burstAt = clock.getElapsedTime(); lidKick = 1;
    pink.hopT = burstAt + 0.15; blue.hopT = burstAt + 0.35;
    P.filter((p) => p.extra).forEach((p) => launch(p, burstAt, true));
  });

  /* ---------- the loop, only while the hero is on screen and the tab is open ---------- */
  let onScreen = true;
  new IntersectionObserver(([e]) => (onScreen = e.isIntersecting), { rootMargin: "60px" }).observe(hero);
  const clock = new THREE.Clock();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), tmp = new THREE.Vector3();
  let last = 0, shown = false, sizeTick = 0;
  const frame = () => {
    requestAnimationFrame(frame);
    if (!onScreen || document.hidden || lost) { clock.getDelta(); return; }
    // the drawing must match the hero's size (zoom, a moved window, a phone turned): check once a second
    if (++sizeTick % 60 === 0 && (Math.abs(canvas.clientWidth - W) > 1 || Math.abs(canvas.clientHeight - H) > 1)) fit();
    const dt = Math.min(clock.getDelta(), 1 / 20), t = clock.elapsedTime;
    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
    tilt.rotation.y = Math.sin(t * 0.22) * 0.08 + mouse.x * 0.16 * (rtl ? -1 : 1);
    tilt.rotation.x = mouse.y * -0.03;

    // the lid breathes open, and jumps when clicked
    lidKick = Math.max(0, lidKick - dt * 1.6);
    hinge.rotation.x = -(1.85 + Math.sin(t * 1.3) * 0.08 + Math.sin(lidKick * Math.PI) * 0.35);
    lid2.rotation.x = -0.75 - Math.max(0, Math.sin(t * 2.4)) * 0.18;
    inner.intensity = 16 + Math.sin(t * 3.1) * 3 + (t - burstAt < 0.6 ? 14 * (1 - (t - burstAt) / 0.6) : 0);
    halo.material.opacity = 0.85 + Math.sin(t * 2.3) * 0.15;
    beam.material.uniforms.uT.value = t;
    sparks.material.uniforms.uT.value = stars.material.uniforms.uT.value = t;
    sparks.rotation.y = t * 0.05;
    bag.rotation.z = Math.sin(t * 1.7) * 0.025;

    // the fountain
    for (const p of P) {
      if (!p.live) {
        if (p.extra) continue;
        p.wait -= dt;
        if (p.wait <= 0) launch(p, t, false);
        else continue;
      }
      p.vel.y -= G * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.rot.x += p.spin.x * dt; p.rot.y += p.spin.y * dt; p.rot.z += p.spin.z * dt;
      if (p.vel.y < 0 && p.pos.y < mouth.y - 0.15) { p.live = false; p.wait = p.kind === "gem" ? rnd(0.4, 2.2) : rnd(0, 0.9); }
      const life = t - p.t0, grow = Math.min(1, life * 6), sc = p.live ? grow : 0;
      q.setFromEuler(p.rot);
      m4.compose(p.pos, q, tmp.copy(one).multiplyScalar(sc));
      (p.kind === "coin" ? flyers : gems).setMatrixAt(p.idx, m4);
    }
    flyers.instanceMatrix.needsUpdate = true; gems.instanceMatrix.needsUpdate = true;

    // the Jumpis: breathing, blinking, looking at the mouse or the chest, a hop now and then, a wave
    for (const J of [pink, blue]) {
      if (t > J.nextHop) { J.hopT = t; J.nextHop = t + rnd(3.5, 7); }
      const look = mouse.x * 0.5 * (rtl ? -1 : 1);
      J.root.rotation.y += (J.turn + look - J.root.rotation.y) * 0.06;
      J.head.rotation.x += (-mouse.y * 0.15 - J.head.rotation.x) * 0.08;
      liveJumpi(J, t, { wave: J === pink && (t % 9) > 6.6, hopH: 0.42 });
    }

    renderer.render(scene, cam);
    if (!shown && ++last > 2) { shown = true; hero.classList.add("is-3d"); }
  };
  frame();
}

// a coin: a short cylinder (side, top, bottom → edge, face, face)
function coinGeo(r = 0.17, h = 0.045) {
  const g = new THREE.CylinderGeometry(r, r, h, 30, 1);
  return g;
}

// the real Jumpi from the game, in a colour
function makeJumpi(base, skin, eye) {
  const root = base.clone(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.material = [].concat(o.material).map((m) => {
      if (m.name === "Skin") { m = m.clone(); m.color.set(skin); m.roughness = 0.45; }
      else if (m.name === "Iris") { m = m.clone(); m.color.set(eye); }
      else if (m.name === "Mouth") { m = m.clone(); const c = new THREE.Color(skin), h = {}; c.getHSL(h); m.color.setHSL(h.h, Math.min(1, h.s * 0.9), h.l * 0.22); }
      return m;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  const J = { root, body: root.getObjectByName("Body"), head: root.getObjectByName("Head"), armL: root.getObjectByName("ArmL"), armR: root.getObjectByName("ArmR"),
    eyeL: root.getObjectByName("EyeL"), eyeR: root.getObjectByName("EyeR"), hopT: -9, nextHop: 2 + Math.random() * 4, blinkT: 1 + Math.random() * 3, ph: Math.random() * 6 };
  J.headY = J.head ? J.head.position.y : 0;
  return J;
}
function liveJumpi(J, t, { hop = 0.6, hopH = 0.45, wave = false } = {}) {
  const br = Math.sin(t * 2.1 + J.ph);
  if (J.body) J.body.scale.set(1 + br * 0.014, 1 + br * 0.02, 1 + br * 0.014);
  if (J.head) J.head.position.y = J.headY + br * 0.012;
  if (J.eyeL && J.eyeR && t > J.blinkT) { const k = (t - J.blinkT) / 0.16; const s = k < 1 ? Math.abs(1 - 2 * k) : 1; J.eyeL.scale.y = J.eyeR.scale.y = Math.max(0.1, s); if (k >= 1) J.blinkT = t + 2 + Math.random() * 3; }
  const k = (t - J.hopT) / hop;
  const up = k >= 0 && k < 1 ? Math.sin(Math.PI * k) : 0;
  J.root.position.y = up * hopH;
  if (J.armR) J.armR.rotation.z = wave ? 1.9 + 0.35 * Math.sin(t * 9) : -br * 0.04 - up * 0.6;
  if (J.armL) J.armL.rotation.z = -br * 0.04 + up * 0.6;
}
