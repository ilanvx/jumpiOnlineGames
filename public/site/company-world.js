/*
  The company landing page's 3D world (company-world.html). One scene, at sunset: a small island in a calm sea, the
  Jumpi Games logo floating over it. Scrolling moves the camera along a path (it never jumps, it follows the scroll
  softly), and each scene's words appear as the camera reaches them.
  - The text is real HTML (search engines, screen readers, translation); the world is only a picture behind it.
  - No 3D (or it fails): the still picture under it stays. Less motion (the system setting or the accessibility menu):
    no drifting or floating, the camera follows the scroll directly, the words are simply there.
  - Phones: lower resolution, and if the first seconds draw slowly, no glow pass.
*/
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const root = document.documentElement;
const calm = () => !!window.JUMPI_REDUCE_MOTION || matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const mix = (a, b, k) => a + (b - a) * k;

/* ---------- the words: split the big lines into words that appear one by one ---------- */
document.querySelectorAll("[data-words] [data-l]").forEach((el) => {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = "";
  words.forEach((w, i) => { const s = document.createElement("span"); s.className = "w"; s.textContent = w; el.append(s); if (i < words.length - 1) el.append(" "); });
});
const scenes = [...document.querySelectorAll("[data-scene]")];
const rail = [...document.querySelectorAll(".cw-rail a")];
rail.forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); const s = scenes[+a.dataset.go]; if (s) scrollTo({ top: s.offsetTop + (+a.dataset.go ? innerHeight * .9 : 0), behavior: calm() ? "auto" : "smooth" }); }));

// how far each scene has played (0..1), the whole page's progress, and the HTML that follows them
const state = { P: 0, t: [] };
function readScroll() {
  const vh = innerHeight, y = scrollY, max = Math.max(1, document.documentElement.scrollHeight - vh);
  state.P = clamp(y / max);
  let cur = 0;
  scenes.forEach((s, i) => {
    const t = clamp((y - s.offsetTop) / Math.max(1, s.offsetHeight - vh));
    state.t[i] = t; s.style.setProperty("--t", t.toFixed(4));
    if (y + vh * .5 >= s.offsetTop) cur = i;
  });
  rail.forEach((a, i) => (i === cur ? a.setAttribute("aria-current", "step") : a.removeAttribute("aria-current")));
  root.style.setProperty("--logo", smooth((y - vh * .55) / (vh * .3)).toFixed(3));
  // scene 2: the words, then the line under them, then all of it leaves at the end
  const t1 = state.t[1] || 0, out = 1 - smooth((t1 - .82) / .16);
  document.querySelectorAll(".cw-s1 [data-l]:not([hidden]) .w").forEach((w, i, all) => {
    w.style.setProperty("--w", (smooth((t1 - .04 - i * (.26 / all.length)) / .1) * out).toFixed(3));
  });
  const lead = document.querySelector(".cw-s1 [data-rise]");
  if (lead) lead.style.setProperty("--r", (smooth((t1 - .36) / .12) * out).toFixed(3));
  const st = document.querySelector(".cw-s1 .cw-stick"); if (st) st.style.setProperty("--shade", (smooth((t1 - .02) / .1) * out).toFixed(3));
}
addEventListener("scroll", readScroll, { passive: true });
addEventListener("resize", readScroll);
addEventListener("gd:lang", () => readScroll());
readScroll();

/* ---------- the 3D world ---------- */
function start() {
  const cv = document.getElementById("cwWorld");
  let R;
  try { R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: "high-performance" }); }
  catch (e) { root.classList.add("cw-calm"); return; }
  const small = innerWidth < 700;
  let dpr = Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75);
  R.setPixelRatio(dpr); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = .95;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(small ? 50 : 38, 1, .1, 1200);
  const SUN = new THREE.Vector3(-.42, .075, -1).normalize();
  const C = { top: new THREE.Color("#262a73"), mid: new THREE.Color("#ff7a68"), hor: new THREE.Color("#ffbf8e"), sun: new THREE.Color("#fff1c9"), deep: new THREE.Color("#0a3348"), lagoon: new THREE.Color("#23968f") };
  scene.fog = new THREE.Fog(C.hor.clone().lerp(C.mid, .35), 120, 520);

  // the sky: an evening gradient and the low sun
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: C.top }, mid: { value: C.mid }, hor: { value: C.hor }, sunC: { value: C.sun }, sunD: { value: SUN } },
    vertexShader: "varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `uniform vec3 top,mid,hor,sunC,sunD;varying vec3 vP;void main(){float h=vP.y;
      vec3 c=mix(hor,mid,smoothstep(0.,.16,h));c=mix(c,top,smoothstep(.12,.6,h));if(h<0.)c=hor;
      float s=max(dot(vP,sunD),0.);c+=sunC*(pow(s,900.)*2.2+pow(s,60.)*.28+pow(s,10.)*.1);gl_FragColor=vec4(c,1.);}`,
  }));
  scene.add(sky);

  // light: the warm sun behind the island, a sky fill, a soft rim from the front
  scene.add(new THREE.HemisphereLight(0xffd9c2, 0x2a6b78, 1.15));
  const sun = new THREE.DirectionalLight(0xffc89a, 2.6); sun.position.copy(SUN).multiplyScalar(60).add(new THREE.Vector3(14, 18, 0)); sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 10, far: 140 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
  scene.add(sun, sun.target);
  const front = new THREE.DirectionalLight(0xffb7a0, .55); front.position.set(-10, 12, 30); scene.add(front);

  // the sea: soft waves, the sky in it, a road of sunlight, a lighter lagoon and foam around the island
  const seaU = { time: { value: 0 }, sunD: { value: SUN }, sunC: { value: C.sun }, deep: { value: C.deep }, lagoon: { value: C.lagoon }, hor: { value: C.hor }, mid: { value: C.mid }, fogC: { value: scene.fog.color } };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, small ? 120 : 220, small ? 120 : 220), new THREE.ShaderMaterial({
    uniforms: seaU, transparent: false,
    vertexShader: `uniform float time;varying vec3 vW;varying float vH;
      float wave(vec2 p){return sin(p.x*.18+time*.9)*.16+sin(p.y*.23-time*.7)*.13+sin((p.x+p.y)*.41+time*1.3)*.06+sin((p.x-p.y*.6)*.9+time*1.7)*.025;}
      void main(){vec3 p=vec3(position.x,0.,-position.y);float d=length(p.xz);float k=smoothstep(5.5,9.,d);p.y=wave(p.xz)*k;vH=p.y;vW=p;
        gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
    fragmentShader: `uniform float time;uniform vec3 sunD,sunC,deep,lagoon,hor,mid,fogC;varying vec3 vW;varying float vH;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){vec3 N=normalize(cross(dFdx(vW),dFdy(vW)));if(N.y<0.)N=-N;vec3 V=normalize(cameraPosition-vW);
        float d=length(vW.xz);vec3 base=mix(lagoon,deep,smoothstep(6.5,16.,d));
        float fr=pow(1.-max(dot(N,V),0.),4.);vec3 skyR=mix(hor,mid,.55);vec3 c=mix(base,skyR,fr*.55+.04);
        vec3 Rf=reflect(-V,N);float s=max(dot(Rf,sunD),0.);
        float glit=pow(s,220.)*1.1+pow(s,1500.)*3.;float tw=step(.988,hash(floor(vW.xz*6.)+floor(time*6.)));c+=sunC*(glit+tw*pow(s,60.)*1.4);
        float ang=atan(vW.z,vW.x);float shore=6.55+.12*sin(ang*7.+time*.8)+.06*sin(ang*13.-time*1.3);
        float foam=smoothstep(.55,0.,abs(d-shore))*(.55+.45*sin(time*2.+ang*5.));c=mix(c,vec3(1.,.97,.93),clamp(foam,0.,1.)*.8);
        float far=smoothstep(60.,400.,length(vW-cameraPosition));c=mix(c,fogC,far);gl_FragColor=vec4(c,1.);}`,
  }));
  scene.add(sea);

  /* the island */
  const isle = new THREE.Group(); scene.add(isle);
  const mat = (c, r = .85, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...o });
  const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const noise = (x, z) => Math.sin(x * 1.3 + z * .7) * .5 + Math.sin(x * .6 - z * 1.7) * .5;
  // sand: a soft lathe, wider under the water
  const sandP = [[0, -2.5], [5.4, -2.5], [6.9, -.6], [6.7, .05], [6.35, .32], [5.6, .48], [0, .52]].map(([x, y]) => new THREE.Vector2(x, y));
  isle.add(shadowy(new THREE.Mesh(new THREE.LatheGeometry(sandP, 96), mat("#f3d3a3", .95))));
  // grass and a hill, gently lumpy
  const dome = (r, h, x, z, col) => { const g = new THREE.SphereGeometry(r, 72, 24, 0, Math.PI * 2, 0, Math.PI / 2); const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) { const px = pa.getX(i), py = pa.getY(i), pz = pa.getZ(i); const k = py / r; pa.setY(i, py * h / r + noise(px + x, pz + z) * .12 * k * (r / 3)); }
    g.computeVertexNormals(); const m = shadowy(new THREE.Mesh(g, mat(col, .9))); m.position.set(x, .42, z); isle.add(m); return m; };
  dome(5.05, .55, 0, 0, "#8cc49b");
  dome(2.7, 1.25, 1.6, -1.2, "#7fb98f");
  // little rocks along the shore
  const rockM = mat("#c9b8a6", .8);
  [[6.3, .4, .9], [-5.9, 1.6, .7], [4.2, -4.9, 1], [-2.5, -6, .8], [-6.4, -1.8, .6], [2.8, 6.1, .55]].forEach(([x, z, s], i) => {
    const r = shadowy(new THREE.Mesh(new THREE.IcosahedronGeometry(s, 2), rockM)); r.position.set(x, .2, z); r.scale.y = .6; r.rotation.set(i, i * 1.7, 0); isle.add(r); });
  // round trees
  const trunkM = mat("#8b5a46", .9), leaf = ["#5fae8b", "#4e9d84", "#77c39a", "#6bb38a"].map((c) => mat(c, .75));
  const tree = (x, z, s, k) => { const g = new THREE.Group(); const t = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(.09 * s, .14 * s, 1.1 * s, 10), trunkM)); t.position.y = .55 * s; g.add(t);
    const c = shadowy(new THREE.Mesh(new THREE.SphereGeometry(.62 * s, 28, 18), leaf[k % 4])); c.position.y = 1.35 * s; c.scale.y = 1.12; g.add(c);
    g.position.set(x, .5 + Math.max(0, 1.2 - Math.hypot(x - 1.6, z + 1.2) * .45), z); isle.add(g); return g; };
  [[1.2, -2.4, 1.15], [2.9, -.4, 1], [-.6, -3, .95], [3.2, -2.6, .85], [-1.9, 1.6, .9], [.2, 2.6, .8], [-3.2, -2.9, .8], [4, 1.4, .75], [-1, -1, .7]].forEach(([x, z, s], i) => tree(x, z, s, i));
  // two palms by the water
  const palm = (x, z, lean, rot) => { const g = new THREE.Group(); const segs = 8;
    for (let i = 0; i < segs; i++) { const u = i / segs, s = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .36, 10), mat("#a8794f", .9))); s.position.set(Math.sin(u * 1.2) * lean, .18 + i * .34, 0); s.rotation.z = -Math.cos(u * 1.2) * lean * .35; g.add(s); }
    const topY = .18 + segs * .34, tx = Math.sin(1.2) * lean;
    for (let k = 0; k < 7; k++) { const f = shadowy(new THREE.Mesh(new THREE.ConeGeometry(.22, 1.6, 6, 1), leaf[k % 2])); f.geometry.translate(0, .8, 0); f.position.set(tx, topY, 0);
      f.rotation.set(0, k / 7 * Math.PI * 2, 1.25); f.scale.z = .3; g.add(f); }
    g.position.set(x, .45, z); g.rotation.y = rot; isle.add(g); };
  palm(5.1, 2.2, .9, -.6); palm(-4.6, 3.1, .8, 2.4);
  // the lighthouse (it will light the night at the end)
  const lh = new THREE.Group(); lh.position.set(-3.7, .45, -1.4); isle.add(lh);
  const white = mat("#fff3e6", .6), coral = mat("#ff7f66", .6);
  lh.add(shadowy(new THREE.Mesh(new THREE.CylinderGeometry(.42, .58, 3.2, 32), white))).children.at(-1).position.y = 1.6;
  [.7, 1.75].forEach((y) => { const b = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(.53 - y * .04, .56 - y * .04, .38, 32), coral)); b.position.y = y; lh.add(b); });
  const deck = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, .08, 32), coral)); deck.position.y = 3.24; lh.add(deck);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .48, 24), new THREE.MeshStandardMaterial({ color: "#ffe2a8", emissive: "#ffcf7a", emissiveIntensity: 1.6, roughness: .2 })); lamp.position.y = 3.52; lh.add(lamp);
  const capL = shadowy(new THREE.Mesh(new THREE.ConeGeometry(.48, .55, 32), coral)); capL.position.y = 4.03; lh.add(capL);
  const lhLight = new THREE.PointLight(0xffc77a, 6, 9, 1.6); lhLight.position.y = 3.5; lh.add(lhLight);
  // a cottage on the hill, its window warm
  const home = new THREE.Group(); home.position.set(1.7, 1.55, -.6); home.rotation.y = .5; isle.add(home);
  const walls = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.1, .75, .9), mat("#fff1df", .8))); walls.position.y = .37; home.add(walls);
  const roofS = new THREE.Shape(); roofS.moveTo(-.68, 0); roofS.lineTo(.68, 0); roofS.lineTo(0, .55); roofS.lineTo(-.68, 0);
  const roof = shadowy(new THREE.Mesh(new THREE.ExtrudeGeometry(roofS, { depth: 1.05, bevelEnabled: false }), coral)); roof.position.set(0, .75, -.52); home.add(roof);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(.26, .24), new THREE.MeshStandardMaterial({ color: "#ffd88f", emissive: "#ffb85a", emissiveIntensity: 1.4 })); win.position.set(.22, .4, .455); home.add(win);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(.22, .4), mat("#c46a4f", .7)); door.position.set(-.22, .2, .455); home.add(door);
  // a little wooden pier towards us
  const wood = mat("#b98a64", .85);
  for (let i = 0; i < 9; i++) { const b = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1, .08, .34), wood)); b.position.set(2.3, .42, 6 + i * .4); isle.add(b); }
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const p = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1, 8), wood)); p.position.set(2.3 + s * .45, .05, 6.3 + i * 1.05); isle.add(p); }

  // clouds: soft round puffs far away, drifting; a few thin veils the camera flies through
  const cloudM = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffc4ac", emissiveIntensity: .38, roughness: 1 });
  const clouds = new THREE.Group(); scene.add(clouds);
  const rnd = (i, k = 0) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };
  for (let i = 0; i < 16; i++) { const g = new THREE.Group(), a = rnd(i) * Math.PI * 2, d = 55 + rnd(i, 1) * 120;
    for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), cloudM); const r = 2.2 + rnd(i, k + 2) * 2.4; s.scale.set(r * 1.3, r * .8, r); s.position.set((k - 2.5) * 2.4 + rnd(i, k + 9) * 1.5, rnd(i, k + 5) * 1.6, rnd(i, k + 7) * 2); g.add(s); }
    g.position.set(Math.sin(a) * d, 14 + rnd(i, 3) * 26, -Math.abs(Math.cos(a)) * d - 20); g.scale.setScalar(.8 + rnd(i, 4) * .9); clouds.add(g); }
  const puffTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 6, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.5, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const veils = [[3.5, 7.4, 23, 9], [6.2, 8.8, 20, 8], [8.4, 9.9, 17.5, 9], [5, 9.5, 18.5, 7], [9.6, 10.2, 15, 8]].map(([x, y, z, s]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: "#ffe9dc", transparent: true, opacity: 0, depthWrite: false, fog: false })); sp.position.set(x, y, z); sp.scale.set(s * 1.6, s, 1); scene.add(sp); return sp; });

  /* the logo, floating: the same picture in thin layers, the back ones darker, so it has real depth; a light sweeps over it */
  const logo = new THREE.Group(); scene.add(logo);
  const logoTex = new THREE.TextureLoader().load("/jumpi-logo.png", () => { ready.logo = true; });
  logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = R.capabilities.getMaxAnisotropy();
  const LW = small ? 6.6 : 8.8, LH = LW * 398 / 684, LAYERS = 16, DEPTH = .42, layerMats = [];
  const plane = new THREE.PlaneGeometry(LW, LH);
  for (let i = 0; i < LAYERS; i++) { const k = i / (LAYERS - 1);
    const m = new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, alphaTest: .45, color: i === LAYERS - 1 ? new THREE.Color(1, 1, 1) : new THREE.Color("#1c2a63").lerp(new THREE.Color("#4a63c4"), k * .8), fog: false });
    const p = new THREE.Mesh(plane, m); p.position.z = -DEPTH + k * DEPTH; logo.add(p); layerMats.push(m); }
  const shineU = { map: { value: logoTex }, time: { value: 0 }, fade: { value: 1 } };
  const shine = new THREE.Mesh(plane, new THREE.ShaderMaterial({ uniforms: shineU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "uniform sampler2D map;uniform float time,fade;varying vec2 vU;void main(){float a=texture2D(map,vU).a;float ph=mod(time*.28,1.6)-.3;float b=smoothstep(.08,0.,abs(vU.x+vU.y*.35-ph*1.35));gl_FragColor=vec4(vec3(1.,.95,.85)*b*a*.75*fade,1.);}" }));
  shine.position.z = .004; logo.add(shine);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: "#ffd2a8", transparent: true, opacity: .38, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.scale.set(LW * 1.5, LH * 1.6, 1); halo.position.z = -.6; halo.material.opacity = .22; logo.add(halo);
  // sparkles around it
  const spN = 140, spG = new THREE.BufferGeometry(), spP = new Float32Array(spN * 3);
  for (let i = 0; i < spN; i++) { spP[i * 3] = (rnd(i, 21) - .5) * LW * 1.6; spP[i * 3 + 1] = (rnd(i, 22) - .5) * LH * 2; spP[i * 3 + 2] = (rnd(i, 23) - .5) * 3; }
  spG.setAttribute("position", new THREE.BufferAttribute(spP, 3));
  const spM = new THREE.PointsMaterial({ map: puffTex, color: "#fff0c8", size: .16, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const sparks = new THREE.Points(spG, spM); logo.add(sparks);

  /* the camera's path: keyframes at the scenes' places on the page; between them it eases */
  const keys = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight), s1 = scenes[1] ? scenes[1].offsetTop / max : .4;
    const far = small ? 1.25 : 1;
    return [
      { p: 0, pos: [0, 5.6, 27 * far], look: [0, 4.4, 0] },
      { p: s1, pos: [9.5, 10.5, 16 * far], look: [0, 2.6, 0] },
      { p: 1, pos: [5.2, 3.6, 10.5 * far], look: [-.4, 1.7, 0] },
    ];
  };
  let K = keys();
  const at = (P) => { let i = 0; while (i < K.length - 2 && P > K[i + 1].p) i++;
    const a = K[i], b = K[i + 1], u = smooth((P - a.p) / Math.max(1e-6, b.p - a.p));
    return { pos: a.pos.map((v, j) => mix(v, b.pos[j], u)), look: a.look.map((v, j) => mix(v, b.look[j], u)) }; };

  /* drawing */
  let composer = null, bloom = null;
  function setupPost() { composer = new EffectComposer(R); composer.addPass(new RenderPass(scene, cam));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .32, .55, .9); composer.addPass(bloom); composer.addPass(new OutputPass()); }
  setupPost();
  function size() { const w = innerWidth, h = innerHeight; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); composer.setSize(w, h); composer.setPixelRatio(dpr); K = keys(); }
  addEventListener("resize", size); size();
  const ready = { logo: false };
  let camP = state.P, last = performance.now(), T = 0, frames = 0, slowT = 0, drawn = false;
  const look = new THREE.Vector3();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (document.hidden) return;
    const still = calm();
    if (!still) T += dt;
    camP = still ? state.P : mix(camP, state.P, 1 - Math.exp(-dt * 4.5));
    const c = at(camP);
    cam.position.set(c.pos[0], c.pos[1] + (still ? 0 : Math.sin(T * .5) * .08), c.pos[2]); look.set(c.look[0], c.look[1], c.look[2]); cam.lookAt(look);
    // the logo rises and fades as we fly in
    const s1 = K[1].p, gone = smooth(camP / Math.max(.001, s1 * .85));
    logo.position.set(0, 7.2 + gone * 6 + (still ? 0 : Math.sin(T * 1.1) * .18), 0); logo.rotation.y = (still ? 0 : Math.sin(T * .6) * .06) + gone * .3; logo.rotation.x = -.05;
    const op = 1 - gone; logo.visible = op > .01;
    layerMats.forEach((m) => { m.opacity = op; m.alphaTest = op > .98 ? .45 : .01; m.transparent = true; }); shineU.fade.value = op; halo.material.opacity = .22 * op; spM.opacity = .9 * op;
    shineU.time.value = T; seaU.time.value = T;
    sparks.rotation.y = T * .05; spM.size = .14 + Math.sin(T * 3) * .03;
    clouds.rotation.y = T * .004;
    const fly = Math.sin(clamp(camP / Math.max(.001, K[1].p)) * Math.PI);   // the veils only while flying in, never where the camera rests
    veils.forEach((v) => { const d = v.position.distanceTo(cam.position); v.material.opacity = .3 * fly * (1 - smooth((d - 3) / 7)) * smooth((d - 1) / 2.5); });   // (only close up: we fly through them)
    lamp.material.emissiveIntensity = 1.4 + Math.sin(T * 2) * .2;
    composer.render();
    if (!drawn) { drawn = true; root.classList.add("cw-3d"); }
    // the first seconds: if this device draws slowly, drop the glow and the resolution
    if (frames < 120) { frames++; slowT += dt; if (frames === 120 && slowT / 120 > 1 / 32) { dpr = 1; R.setPixelRatio(1); composer.removePass(bloom); size(); } }
  }
  R.setAnimationLoop(frame);
  if (calm()) root.classList.add("cw-calm");
  addEventListener("gd:lang", () => { K = keys(); });
  new ResizeObserver(() => { K = keys(); }).observe(document.body);
}
try { start(); } catch (e) { console.error("[company-world]", e); root.classList.add("cw-calm"); }
