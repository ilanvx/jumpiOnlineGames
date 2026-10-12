/* After paying in the Jumpi Store (/success, /fail; server.js checks Hyp's answer first and then sends the buyer here).
   /success?p=<product>: what was bought, a Jumpi celebrating under a rain of coins.
   /success?check: Hyp didn't confirm yet (a Jumpi waiting under a spinning coin).
   /fail: nothing was charged; a Jumpi under a small rain cloud, and "Try again" opens the cart again. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { PRODUCT_BY_ID, STORE_OPEN } from "/shared/store.js";

const q = new URLSearchParams(location.search);
const KIND = document.body.dataset.kind === "fail" ? "fail" : "check" in Object.fromEntries(q) ? "check" : "ok";
const P = PRODUCT_BY_ID[q.get("p") || ""] || null;
const $ = (id) => document.getElementById(id);
let lang = "en";
const T = (en, he) => (lang === "he" ? he : en);
const num = (n) => Number(n).toLocaleString(lang === "he" ? "he-IL" : "en-US");

// the store link (while the store is closed only admins buy, on /store?preview); "Try again" opens the cart
document.querySelectorAll("[data-store]").forEach((a) => (a.href = (STORE_OPEN ? "/store" : "/store?preview") + (a.hasAttribute("data-cart") ? "#cart" : "")));
// paid: the cart is done
if (KIND === "ok") { try { sessionStorage.removeItem("jumpi-cart"); } catch (e) {} }

function fill() {
  if (KIND === "check") {
    const b = document.querySelector(".pr-badge");
    b.className = "pr-badge wait";
    b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
    $("prTitle").textContent = T("We're checking your payment", "אנחנו בודקים את התשלום");
    $("prLead").textContent = T("The payment company hasn't confirmed it yet. If the card was charged, the purchase will reach the account soon, usually within a few minutes.", "חברת הסליקה עוד לא אישרה את התשלום. אם הכרטיס חויב, הרכישה תגיע לחשבון בקרוב, בדרך כלל תוך כמה דקות.");
    $("prTip").textContent = T("Didn't get it after a while? Write to us and we'll sort it out.", "לא הגיע אחרי זמן מה? כתבו לנו ונסדר את זה.");
    const btns = $("prBtns");
    btns.innerHTML = `<a class="pr-btn retry" href="/contact"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m4.5 7.5 7.5 6 7.5-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${T("Contact us", "צור קשר")}</span></a>
      <a class="pr-btn ghost" href="/play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg><span>${T("Play meanwhile", "לשחק בינתיים")}</span></a>`;
    document.title = T("Checking your payment", "בודקים את התשלום") + " · Jumpi Games";
    return;
  }
  if (KIND !== "ok" || !P) return;
  $("prItem").hidden = false;
  $("prImg").src = `/site/img/store/${P.id}.webp`;
  $("prImg").onerror = () => { $("prImg").src = "/site/img/store/coins-4000.webp"; };
  $("prName").textContent = (P.name[lang] || P.name.en) + (P.variant ? ` · ${P.variant[lang] || P.variant.en}` : "");
  const g = P.give || {}, got = [];
  if (g.coins) got.push(["", T(`+${num(g.coins)} coins`, `+${num(g.coins)} מטבעות`)]);
  if (g.memberDays) got.push(["days", T(`${num(g.memberDays)} days of membership`, `${num(g.memberDays)} ימי מנוי`)]);
  if (g.items && g.items.length) got.push(["items", P.kind === "costume" ? T("The whole costume", "התחפושת המלאה") : T(`${g.items.length} special items`, `${g.items.length} פריטים מיוחדים`)]);
  $("prGot").innerHTML = got.map(([c, t]) => `<li class="${c}">${t}</li>`).join("");
  $("prLead").textContent = T(`Thank you! ${P.name.en} is already in your Jumpi account.`, `תודה! ${P.name.he} כבר בחשבון הג'אמפי שלכם.`);
}

/* ---------- English ⇄ Hebrew (same choice as the rest of the site) ---------- */
{
  const btns = [...document.querySelectorAll(".lang-sw [data-l]")];
  const setLang = (l) => {
    lang = l === "he" ? "he" : "en";
    btns.forEach((b) => b.setAttribute("aria-pressed", b.dataset.l === lang));
    document.documentElement.lang = lang; document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
    document.querySelectorAll("[data-en]").forEach((el) => (el.textContent = lang === "he" ? el.dataset.he : el.dataset.en));
    try { localStorage.setItem("jumpi-lang", lang); } catch (e) {}
    fill();
  };
  btns.forEach((b) => (b.onclick = () => setLang(b.dataset.l)));
  let start = "en";
  try { start = q.get("lang") || localStorage.getItem("jumpi-lang") || "en"; } catch (e) {}
  setLang(start);
}

/* ---------- the 3D stage ---------- */
const canvas = $("prCanvas");
const reduce = window.JUMPI_REDUCE_MOTION || matchMedia("(prefers-reduced-motion: reduce)").matches;
if (canvas) stage().catch((e) => console.warn("[pay result 3D]", e && e.message));

async function stage() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" }); } catch (e) { return; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, 0.1, 60), TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a);
  scene.add(new THREE.HemisphereLight(0xe6dcff, 0x3a2380, 1.25));
  const key = new THREE.DirectionalLight(0xfff3e0, 2.3);
  key.position.set(2.5, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6; key.shadow.bias = -0.0006;
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb48cff, 1.4); rim.position.set(-3, 2, -4); scene.add(rim);

  const tex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const glow = (stops) => tex(128, 128, (c, w) => { const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); stops.forEach(([o, col]) => g.addColorStop(o, col)); c.fillStyle = g; c.fillRect(0, 0, w, w); });
  const star = (c, cx, cy, R, r) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R; c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } c.closePath(); };
  const face = tex(256, 256, (c, w) => { const m = w / 2; let g = c.createRadialGradient(m * .8, m * .7, 10, m, m, m); g.addColorStop(0, "#fff3a6"); g.addColorStop(.55, "#ffc62a"); g.addColorStop(1, "#e08a00"); c.fillStyle = g; c.fillRect(0, 0, w, w);
    c.lineWidth = 14; c.strokeStyle = "#c97400"; c.beginPath(); c.arc(m, m, m - 26, 0, TAU); c.stroke(); star(c, m + 5, m + 7, 72, 30); c.fillStyle = "#c97400"; c.fill(); star(c, m, m, 72, 30); c.fillStyle = "#fff4b8"; c.fill(); });
  const edge = new THREE.MeshStandardMaterial({ color: 0xffb81f, metalness: 0.7, roughness: 0.3, emissive: 0x6a3a00, emissiveIntensity: 0.35 });
  const top = new THREE.MeshStandardMaterial({ map: face, metalness: 0.4, roughness: 0.35, emissive: 0x5a3000, emissiveIntensity: 0.3 });
  const coinMats = [edge, top, top], coinGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.045, 28);

  const world = new THREE.Group(); scene.add(world);
  // a round stage
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.6, 0.26, 64), new THREE.MeshStandardMaterial({ color: KIND === "fail" ? 0x6c6fd8 : 0x8a4dff, roughness: 0.5, emissive: 0x2a0a70, emissiveIntensity: 0.25 }));
  disc.position.y = -0.13; disc.receiveShadow = true; world.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.06, 12, 80), new THREE.MeshStandardMaterial({ color: KIND === "fail" ? 0xc8ccff : 0xffc23a, metalness: 0.6, roughness: 0.3, emissive: KIND === "fail" ? 0x202050 : 0x6a3a00, emissiveIntensity: 0.3 }));
  ring.rotation.x = Math.PI / 2; world.add(ring);
  const shadowOnly = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), new THREE.ShadowMaterial({ opacity: 0.3 }));
  shadowOnly.rotation.x = -Math.PI / 2; shadowOnly.position.y = 0.006; shadowOnly.receiveShadow = true; world.add(shadowOnly);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(KIND === "fail" ? [[0, "rgba(190,200,255,.5)"], [1, "rgba(120,130,255,0)"]] : [[0, "rgba(255,236,160,.85)"], [0.4, "rgba(255,190,90,.35)"], [1, "rgba(255,150,60,0)"]]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(4.6, 4.6, 1); halo.position.set(0, 1.2, -0.6); world.add(halo);

  // the Jumpi (the game's own model)
  const base = await new Promise((res, rej) => new GLTFLoader().load("/blobby.glb", (g) => res(g.scene), undefined, rej));
  const size = new THREE.Box3().setFromObject(base).getSize(new THREE.Vector3());
  const J = jumpi(base, KIND === "fail" ? "#4fc3ff" : "#ff6fb5");
  J.root.scale.setScalar(1.55 / (size.y || 1));
  world.add(J.root);

  // success: piles of coins, an open treasure box and a rain of coins; check: one big coin spinning; fail: a little rain cloud
  const coins = [];
  let rain = null, cloud = null, bigCoin = null;
  if (KIND === "ok") {
    const pile = new THREE.InstancedMesh(coinGeo, coinMats, 40); pile.castShadow = true; pile.receiveShadow = true;
    const o = new THREE.Object3D();
    for (let i = 0; i < 40; i++) {
      const a = rnd(0, TAU), r = rnd(0.75, 1.45), stackAt = i < 12;
      if (stackAt) { const sx = i < 6 ? -1.05 : 1.1, sz = i < 6 ? 0.45 : 0.35; o.position.set(sx, 0.025 + (i % 6) * 0.05, sz); o.rotation.set(0, rnd(0, TAU), 0); }
      else { o.position.set(Math.cos(a) * r, 0.03, Math.sin(a) * r * 0.8 + 0.1); o.rotation.set(rnd(-0.25, 0.25), rnd(0, TAU), rnd(-0.25, 0.25)); }
      o.updateMatrix(); pile.setMatrixAt(i, o.matrix);
    }
    world.add(pile);
    const N = 46;
    rain = new THREE.InstancedMesh(coinGeo, coinMats, N); rain.frustumCulled = false;
    for (let i = 0; i < N; i++) coins.push({ p: new THREE.Vector3(rnd(-2.2, 2.2), rnd(1, 7), rnd(-1.2, 1)), v: rnd(1.1, 2.1), r: new THREE.Euler(rnd(0, TAU), rnd(0, TAU), 0), s: new THREE.Vector3(rnd(-4, 4), rnd(-3, 3), rnd(-4, 4)), k: rnd(0.8, 1.2) });
    world.add(rain);
  } else if (KIND === "check") {
    bigCoin = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.09, 40), coinMats);
    bigCoin.rotation.x = Math.PI / 2; bigCoin.position.set(0, 2.25, 0); bigCoin.castShadow = true; world.add(bigCoin);
  } else {
    cloud = new THREE.Group(); cloud.position.set(0.15, 2.55, 0); world.add(cloud);
    const cm = new THREE.MeshStandardMaterial({ color: 0xe9ecff, roughness: 0.9, emissive: 0x30335a, emissiveIntensity: 0.2 });
    [[0, 0, 0, 0.42], [0.42, -0.06, 0.05, 0.32], [-0.42, -0.08, 0.02, 0.3], [0.2, 0.2, -0.05, 0.3], [-0.22, 0.16, 0, 0.28]].forEach(([x, y, z, r]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), cm); s.position.set(x, y, z); s.scale.y = 0.85; s.castShadow = true; cloud.add(s); });
    const dropGeo = new THREE.SphereGeometry(0.035, 10, 8); dropGeo.scale(1, 2.2, 1);
    rain = new THREE.InstancedMesh(dropGeo, new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.2, emissive: 0x2a6aa0, emissiveIntensity: 0.4 }), 18); rain.frustumCulled = false;
    for (let i = 0; i < 18; i++) coins.push({ p: new THREE.Vector3(rnd(-0.55, 0.65), rnd(0.4, 2.3), rnd(-0.2, 0.2)), v: rnd(2.2, 3) });
    world.add(rain);
    // a closed little chest beside, with a padlock
    const box = new THREE.Group(); box.position.set(1.05, 0, 0.35); box.rotation.y = -0.5; box.scale.setScalar(0.55); world.add(box);
    const wood = new THREE.MeshStandardMaterial({ color: 0xc97a2a, roughness: 0.55 }), band = new THREE.MeshStandardMaterial({ color: 0xd9dcef, metalness: 0.6, roughness: 0.3 });
    const b1 = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.8, 0.9, 3, 0.08), wood); b1.position.y = 0.4; b1.castShadow = true; box.add(b1);
    const lg = new THREE.CylinderGeometry(0.45, 0.45, 1.3, 28, 1, false, 0, Math.PI); lg.rotateZ(Math.PI / 2);
    const lid = new THREE.Mesh(lg, wood); lid.position.y = 0.8; lid.castShadow = true; box.add(lid);
    const lock = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.3, 0.1, 3, 0.04), band); lock.position.set(0, 0.62, 0.48); box.add(lock);
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 20, Math.PI), band); shackle.position.set(0, 0.78, 0.48); box.add(shackle);
  }
  // twinkles
  const twinkle = (() => {
    const n = 30, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { p[i * 3] = rnd(-2.6, 2.6); p[i * 3 + 1] = rnd(0.3, 3.6); p[i * 3 + 2] = rnd(-1.5, 0.5); ph[i] = Math.random(); }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3)); g.setAttribute("aPh", new THREE.BufferAttribute(ph, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uPx: { value: 1 } },
      vertexShader: "attribute float aPh; uniform float uT, uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vA = .5+.5*sin(uT*(1.5+aPh*2.)+aPh*6.283); gl_PointSize = uPx*(4.+10.*vA)*(8./-mv.z); gl_Position = projectionMatrix*mv; }",
      fragmentShader: `varying float vA; void main(){ vec2 d = abs(gl_PointCoord-.5); float s = max(0., 1.-(d.x*d.y)*90.-length(gl_PointCoord-.5)*1.6); gl_FragColor = vec4(${KIND === "fail" ? "vec3(.8,.85,1.)" : "vec3(1.,.92,.7)"}, s*vA); }` });
    const pts = new THREE.Points(g, m); world.add(pts); return m;
  })();

  // size
  const box = canvas.parentElement;
  const fit = () => {
    const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.setSize(w, h, false);
    cam.aspect = w / h; cam.position.set(0, 2.4, 9.2); cam.lookAt(0, 1.05, 0);
    // fit the stage's width (3.8) on narrow boxes
    const need = 2 * Math.atan(Math.tan((32 * Math.PI) / 360) * Math.max(1, 1.15 / cam.aspect)) * (180 / Math.PI);
    cam.fov = need; cam.updateProjectionMatrix();
    twinkle.uniforms.uPx.value = Math.min(devicePixelRatio || 1, 1.75) * (h / 440);
  };
  new ResizeObserver(fit).observe(box); fit();
  let mx = 0, tmx = 0;
  box.addEventListener("pointermove", (e) => { const r = box.getBoundingClientRect(); tmx = ((e.clientX - r.left) / r.width) * 2 - 1; }, { passive: true });
  box.addEventListener("pointerleave", () => (tmx = 0));
  box.addEventListener("click", () => (J.hopT = clock.getElapsedTime()));

  let onScreen = true;
  new IntersectionObserver(([e]) => (onScreen = e.isIntersecting)).observe(box);
  const clock = new THREE.Clock(), m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), sc = new THREE.Vector3();
  const draw = () => {
    const dt = Math.min(clock.getDelta(), 1 / 20), t = clock.elapsedTime;
    mx += (tmx - mx) * 0.06;
    world.rotation.y = (lang === "he" ? -1 : 1) * 0.12 + Math.sin(t * 0.35) * 0.1 + mx * 0.25;
    twinkle.uniforms.uT.value = t;
    // the Jumpi
    const br = Math.sin(t * 2.1);
    if (J.body) J.body.scale.set(1 + br * 0.014, 1 + br * 0.02, 1 + br * 0.014);
    if (J.eyeL && t > J.blinkT) { const k = (t - J.blinkT) / 0.16, s = k < 1 ? Math.abs(1 - 2 * k) : 1; J.eyeL.scale.y = J.eyeR.scale.y = Math.max(0.1, s); if (k >= 1) J.blinkT = t + 2 + Math.random() * 3; }
    if (KIND === "ok") {
      // happy hops with both arms up
      const k = ((t - J.hopT) % 1.1) / 0.62, up = k < 1 ? Math.sin(Math.PI * k) : 0;
      J.root.position.y = up * 0.5;
      J.root.rotation.y = Math.sin(t * 0.9) * 0.35;
      if (J.armL) J.armL.rotation.z = -1.9 - Math.sin(t * 8) * 0.25;
      if (J.armR) J.armR.rotation.z = 1.9 + Math.sin(t * 8 + 1) * 0.25;
      for (let i = 0; i < coins.length; i++) {
        const c = coins[i];
        c.p.y -= c.v * dt; c.r.x += c.s.x * dt; c.r.y += c.s.y * dt; c.r.z += c.s.z * dt;
        if (c.p.y < 0.05) { c.p.set(rnd(-2.2, 2.2), rnd(4.4, 5.6), rnd(-1.2, 1)); }
        qt.setFromEuler(c.r); m4.compose(c.p, qt, sc.copy(one).multiplyScalar(c.k)); rain.setMatrixAt(i, m4);
      }
      rain.instanceMatrix.needsUpdate = true;
      halo.material.opacity = 0.8 + Math.sin(t * 2.4) * 0.2;
    } else if (KIND === "check") {
      // waiting: a small sway, looking up at the spinning coin
      const k = (t - J.hopT) / 0.6; J.root.position.y = k >= 0 && k < 1 ? Math.sin(Math.PI * k) * 0.4 : 0;
      J.root.rotation.y = Math.sin(t * 0.8) * 0.2;
      if (J.head) J.head.rotation.x = -0.25;
      if (J.armR) J.armR.rotation.z = Math.sin(t * 3) * 0.15;
      bigCoin.rotation.z = t * 3; bigCoin.position.y = 2.25 + Math.sin(t * 2) * 0.08;
    } else {
      // fail: a little sad, but the cloud is clearing; a hop when clicked
      const k = (t - J.hopT) / 0.6; J.root.position.y = k >= 0 && k < 1 ? Math.sin(Math.PI * k) * 0.4 : 0;
      J.root.rotation.y = -0.15 + Math.sin(t * 0.6) * 0.12;
      if (J.head) { J.head.rotation.z = Math.sin(t * 0.7) * 0.12; J.head.rotation.x = 0.12; }
      if (J.armL) J.armL.rotation.z = 0.25; if (J.armR) J.armR.rotation.z = -0.25;
      cloud.position.x = 0.15 + Math.sin(t * 0.5) * 0.25; cloud.position.y = 2.55 + Math.sin(t * 1.1) * 0.05;
      for (let i = 0; i < coins.length; i++) {
        const c = coins[i]; c.p.y -= c.v * dt;
        if (c.p.y < 0.05) c.p.set(rnd(-0.55, 0.65), 2.35, rnd(-0.2, 0.2));
        m4.compose(sc.set(c.p.x + cloud.position.x - 0.15, c.p.y, c.p.z), qt.identity(), one); rain.setMatrixAt(i, m4);
      }
      rain.instanceMatrix.needsUpdate = true;
    }
    renderer.render(scene, cam);
  };
  if (reduce) { draw(); return; }
  const loop = () => { requestAnimationFrame(loop); if (onScreen && !document.hidden) draw(); else clock.getDelta(); };
  loop();
}

function jumpi(base, skin) {
  const root = base.clone(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.material = [].concat(o.material).map((m) => {
      if (m.name === "Skin") { m = m.clone(); m.color.set(skin); m.roughness = 0.45; }
      else if (m.name === "Iris") { m = m.clone(); m.color.set("#5a2a12"); }
      else if (m.name === "Mouth") { m = m.clone(); const c = new THREE.Color(skin), h = {}; c.getHSL(h); m.color.setHSL(h.h, Math.min(1, h.s * 0.9), h.l * 0.22); }
      return m;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  return { root, body: root.getObjectByName("Body"), head: root.getObjectByName("Head"), armL: root.getObjectByName("ArmL"), armR: root.getObjectByName("ArmR"),
    eyeL: root.getObjectByName("EyeL"), eyeR: root.getObjectByName("EyeR"), hopT: 0, blinkT: 1.5 };
}
