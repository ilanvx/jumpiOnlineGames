/*
  The company landing page's 3D world (company-world.html). One world, at sunset turning to night: our island in a calm
  sea with the Jumpi Games logo floating over it, four places on it (lighthouse, cottage, balloon tree, bridge), and two
  more islands out at sea (Jumpi's town with its ferris wheel and Jumpis, Puffball's inflatable pitch with bouncing Puffs). Scrolling moves the camera along a path (it never jumps, it follows the scroll
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
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const root = document.documentElement;
const calm = () => !!window.JUMPI_REDUCE_MOTION || matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const mix = (a, b, k) => a + (b - a) * k;

/* ---------- the words: split the big lines into words that appear one by one (an accent word keeps its <em>) ---------- */
const splitWords = (from, into) => {
  [...from.childNodes].forEach((n) => {
    if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach((p) => { if (!p) return; if (/^\s+$/.test(p)) into.append(" "); else { const s = document.createElement("span"); s.className = "w"; s.textContent = p; into.append(s); } });
    else if (n.nodeType === 1) { const c = n.cloneNode(false); splitWords(n, c); into.append(c); }
  });
};
document.querySelectorAll("[data-words] [data-l]").forEach((el) => { const f = document.createElement("span"); splitWords(el, f); el.replaceChildren(...f.childNodes); });
const scenes = [...document.querySelectorAll("[data-scene]")];
const rail = [...document.querySelectorAll(".cw-rail a")];
const GO = [0, .3, .03, .05, .3, .6];   // where in each scene the rail takes you
const sceneY = (i, t) => { const s = scenes[i]; return s ? s.offsetTop + t * Math.max(0, s.offsetHeight - innerHeight) : 0; };
rail.forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); const i = +a.dataset.go; scrollTo({ top: sceneY(i, GO[i] || 0), behavior: calm() ? "auto" : "smooth" }); }));

// everything that shows for part of its scene: data-show="from,to" (in that scene's 0..1)
const shows = [...document.querySelectorAll(".cw-show")].map((el) => {
  const [a, b] = el.dataset.show.split(",").map(Number);
  return { el, i: scenes.indexOf(el.closest("[data-scene]")), a, b, card: el.classList.contains("cw-card"), center: !el.closest(".cw-side") || el.classList.contains("cw-mid") };
});
const heads = [...document.querySelectorAll("[data-words]")].map((el) => ({ el, show: shows.find((s) => s.el === el || s.el.contains(el)) }));
const ramp = (t, a, b, e = .05) => smooth((t - a) / e) * (b >= 1 ? 1 : 1 - smooth((t - b) / e));

// how far each scene has played (0..1), the whole page's progress, and the HTML that follows them
const state = { P: 0, t: [], side: 0 };
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
  const shade = new Map(); let side = 0;
  for (const s of shows) {
    const v = ramp(state.t[s.i] || 0, s.a, s.b); s.v = v;
    s.el.style.setProperty("--v", v.toFixed(3)); s.el.classList.toggle("off", v < .005);
    if (s.card) side = Math.max(side, v);
    if (s.center) { const st = s.el.closest(".cw-stick"); if (st) shade.set(st, Math.max(shade.get(st) || 0, v)); }
  }
  shade.forEach((v, st) => st.style.setProperty("--shade", v.toFixed(3)));
  state.side = side;
  // the big words: one by one as their part of the scene begins
  for (const h of heads) {
    if (!h.show || h.el.closest(".cw-end")) continue;
    const t = state.t[h.show.i] || 0, { a, b } = h.show, span = Math.min(.22, (b - a) * .45), out = b >= 1 ? 1 : 1 - smooth((t - b) / .05);
    const ws = [...h.el.querySelectorAll("[data-l]:not([hidden]) .w")].filter((w) => w.offsetParent !== null);
    ws.forEach((w, i) => w.style.setProperty("--w", (smooth((t - a - i * (span * .75 / ws.length)) / (span * .3 + .015)) * out).toFixed(3)));
    h.el.querySelectorAll("em").forEach((em) => em.style.setProperty("--em", smooth((t - a - span * .8) / (span * .4 + .02)) * out));
  }
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
  const hemi = new THREE.HemisphereLight(0xffd9c2, 0x2a6b78, 1.15); scene.add(hemi);
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
  const rnd = (i, k = 0) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };
  const puffTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 6, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.5, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
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
  [[1.2, -2.4, 1.15], [2.9, -.4, 1], [-.6, -3, .95], [3.2, -2.6, .85], [.2, 2.6, .8], [-3.2, -2.9, .8], [4, 1.4, .75], [-1, -1, .7]].forEach(([x, z, s], i) => tree(x, z, s, i));
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

  /* what we care about: four places on the island (the lighthouse and the cottage are above) */
  // joy: a tree full of balloons
  const joyTree = tree(-1.9, 1.6, 1.05, 2);
  const balloons = new THREE.Group(); joyTree.add(balloons);
  const balloonCols = ["#ff6f8e", "#ffd23a", "#4fc8ff", "#9be84a", "#b9a2ff", "#ff9a3c", "#8af4ff"];
  const stringM = new THREE.LineBasicMaterial({ color: "#fff4e8", transparent: true, opacity: .7 });
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + .3, r = .35 + rnd(i, 31) * .35, top = new THREE.Vector3(Math.cos(a) * r, 2.35 + rnd(i, 32) * .7, Math.sin(a) * r);
    const b = new THREE.Mesh(new THREE.SphereGeometry(.26, 24, 18), new THREE.MeshStandardMaterial({ color: balloonCols[i], roughness: .28, metalness: .05, emissive: balloonCols[i], emissiveIntensity: .08 }));
    b.scale.set(1, 1.18, 1); b.position.copy(top); b.castShadow = true; b.userData.ph = rnd(i, 33) * 6; b.userData.base = top.clone(); balloons.add(b);
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(a) * .15, 1.5, Math.sin(a) * .15), top.clone().add(new THREE.Vector3(0, -.3, 0))]), stringM); b.userData.line = ln; balloons.add(ln);
  }
  // easy for every kid: a wide bridge with soft rails to a little island
  const bridge = new THREE.Group(); scene.add(bridge);
  const BX0 = -6.1, BX1 = -10.7, BZ = 2.6, arch = (u) => .5 + Math.sin(u * Math.PI) * .55;
  const plankM = mat("#d9a676", .8), railM = mat("#fff1df", .6);
  for (let i = 0; i <= 15; i++) { const u = i / 15, x = mix(BX0, BX1, u); const p = shadowy(new THREE.Mesh(new THREE.BoxGeometry(.3, .09, 1.9), i % 2 ? plankM : wood)); p.position.set(x, arch(u), BZ);
    p.rotation.z = -Math.cos(u * Math.PI) * .37; bridge.add(p); }
  for (const s of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push(new THREE.Vector3(mix(BX0, BX1, u), arch(u) + .55, BZ + s * .9)); }
    bridge.add(shadowy(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, .055, 8), coral)));
    for (let i = 0; i <= 5; i++) { const u = i / 5, post = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .6, 8), railM)); post.position.set(mix(BX0, BX1, u), arch(u) + .28, BZ + s * .9); bridge.add(post); }
  }
  const islet = (x, z, r, col = "#8cc49b") => { const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const p = [[0, -2], [r * .8, -2], [r * 1.05, -.4], [r, .1], [r * .85, .38], [r * .5, .5], [0, .52]].map(([a, b]) => new THREE.Vector2(a, b));
    g.add(shadowy(new THREE.Mesh(new THREE.LatheGeometry(p, 64), mat("#f3d3a3", .95))));
    if (col) { const m = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(r * .76, r * .84, .4, 64), mat(col, .9))); m.position.y = .58; g.add(m); }
    return g; };
  const small1 = islet(-12.6, BZ, 2.3);
  { const fl = ["#ff6f8e", "#ffd23a", "#fff", "#b9a2ff"]; for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), new THREE.MeshStandardMaterial({ color: fl[i % 4], emissive: fl[i % 4], emissiveIntensity: .25 }));
    const a = rnd(i, 41) * 6.28, d = .3 + rnd(i, 42) * 1.3; f.position.set(Math.cos(a) * d, .78, Math.sin(a) * d); small1.add(f); } }

  /* our games: two more islands out at sea */
  // Jumpi: a small bright town with a plaza, a fountain and a ferris wheel
  const JI = islet(-30, -24, 8.5); JI.rotation.y = .35;
  const plaza = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, .06, 48), mat("#ffe9c9", .7))); plaza.position.y = .78; JI.add(plaza);
  const fount = new THREE.Group(); fount.position.y = .8; JI.add(fount);
  fount.add(shadowy(new THREE.Mesh(new THREE.CylinderGeometry(.8, .9, .3, 32), mat("#fff3e6", .6)))).children.at(-1).position.y = .15;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, .04, 32), new THREE.MeshStandardMaterial({ color: "#5fd4ff", emissive: "#2aa8e0", emissiveIntensity: .35, roughness: .15 })); water.position.y = .28; fount.add(water);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(.06, .14, 1, 12), new THREE.MeshStandardMaterial({ color: "#bff0ff", emissive: "#7fdcff", emissiveIntensity: .6, transparent: true, opacity: .8 })); jet.position.y = .75; fount.add(jet);
  const houseCols = [["#fff3df", "#ff5a7a"], ["#fff8e8", "#1fb6ff"], ["#ffeedd", "#ffc23a"], ["#f6fff0", "#7ed321"], ["#fff1f6", "#a66bff"], ["#fff6e0", "#ff8a3c"], ["#eef9ff", "#ff5a7a"]];
  const windows = [win];
  const house = (parent, x, z, ry, s, [wc, rc]) => { const h = new THREE.Group(); h.position.set(x, .78, z); h.rotation.y = ry; h.scale.setScalar(s); parent.add(h);
    const w = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1), mat(wc, .8))); w.position.y = .5; h.add(w);
    const rs = new THREE.Shape(); rs.moveTo(-.74, 0); rs.lineTo(.74, 0); rs.lineTo(0, .62); rs.lineTo(-.74, 0);
    const r = shadowy(new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: 1.12, bevelEnabled: false }), mat(rc, .6))); r.position.set(0, 1, -.56); h.add(r);
    for (const wx of [-.3, .3]) { const wn = new THREE.Mesh(new THREE.PlaneGeometry(.24, .26), new THREE.MeshStandardMaterial({ color: "#ffe2a0", emissive: "#ffb85a", emissiveIntensity: .5 })); wn.position.set(wx, .58, .505); h.add(wn); windows.push(wn); }
    return h; };
  [[-4.2, -1.2, .9, 1.1], [-3.6, 1.9, 1.9, 1], [-1.2, 4.2, 2.8, 1.05], [1.8, 4, 3.6, .95], [3.9, 1.5, 4.4, 1.1], [-1.6, -4.3, .1, 1], [-4.8, -3.8, .5, .85]].forEach(([x, z, ry, s], i) => house(JI, x, z, ry, s, houseCols[i]));
  // the ferris wheel, its cabins always upright, little lights on the rim
  const fw = new THREE.Group(); fw.position.set(2.6, .78, -2.8); fw.rotation.y = -.5; JI.add(fw);
  const FR = 2.5, FY = 3.1, steel = mat("#ffffff", .4, { metalness: .2 });
  for (const s of [-1, 1]) for (const d of [-1, 1]) { const leg = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, FY * 1.08, 8), steel)); leg.position.set(d * .75, FY / 2, s * .45); leg.rotation.z = d * -.24; fw.add(leg); }
  const wheel = new THREE.Group(); wheel.position.y = FY; fw.add(wheel);
  for (const s of [-.32, .32]) { const ring = shadowy(new THREE.Mesh(new THREE.TorusGeometry(FR, .06, 8, 64), mat("#ff5a7a", .45))); ring.position.z = s; wheel.add(ring); }
  const rimLights = new THREE.MeshStandardMaterial({ color: "#fff2c0", emissive: "#ffd27a", emissiveIntensity: .6 });
  const cabins = [];
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, FR, 6), steel); sp.position.set(Math.cos(a) * FR / 2, Math.sin(a) * FR / 2, 0); sp.rotation.z = a - Math.PI / 2; wheel.add(sp);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), rimLights); bulb.position.set(Math.cos(a + .31) * FR, Math.sin(a + .31) * FR, .36); wheel.add(bulb);
    const cab = new THREE.Group(); cab.position.set(Math.cos(a) * FR, Math.sin(a) * FR, 0); wheel.add(cab);
    const body = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(.28, .22, .38, 16), mat(houseCols[i % 7][1], .5))); body.position.y = -.32; cab.add(body);
    const roofC = new THREE.Mesh(new THREE.ConeGeometry(.32, .16, 16), mat("#fff", .5)); roofC.position.y = -.06; cab.add(roofC); cabins.push(cab); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .8, 16), mat("#ffc23a", .4)); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  [[5.2, -.8, 1.1], [-.5, -6.2, 1], [5.5, 3.9, .9], [-6.5, .6, .95], [.6, 6.4, .85], [-5.6, 4.6, .8]].forEach(([x, z, s], i) => { const t = tree(0, 0, s, i); t.position.set(x, .78, z); JI.add(t); });
  // Puffball: an inflatable pitch with soft walls, two round goals, Puffs bouncing on it
  const PI_ = islet(28, -26, 8.2, null); PI_.rotation.y = -.4;
  const pitchTex = (() => { const c = document.createElement("canvas"); c.width = 512; c.height = 340; const x = c.getContext("2d");
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? "#9fe05a" : "#b6ef6e"; x.fillRect(i * 64, 0, 64, 340); }
    x.strokeStyle = "rgba(255,255,255,.92)"; x.lineWidth = 7; x.strokeRect(14, 14, 484, 312); x.beginPath(); x.moveTo(256, 14); x.lineTo(256, 326); x.stroke();
    x.beginPath(); x.arc(256, 170, 52, 0, Math.PI * 2); x.stroke(); x.strokeRect(14, 100, 60, 140); x.strokeRect(438, 100, 60, 140);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
  const PW = 9.6, PD = 6.2;
  const pitch = shadowy(new THREE.Mesh(new THREE.BoxGeometry(PW, .34, PD), [mat("#86d04a"), mat("#86d04a"), new THREE.MeshStandardMaterial({ map: pitchTex, roughness: .8 }), mat("#86d04a"), mat("#86d04a"), mat("#86d04a")])); pitch.position.y = .62; PI_.add(pitch);
  const puffCols = ["#8af4ff", "#ff9be6", "#ffe27a", "#b9a2ff", "#ff8a95", "#86bcff", "#d8ff6e"];
  const tube = (len, col, x, z, ry) => { const m = shadowy(new THREE.Mesh(new THREE.CapsuleGeometry(.3, len, 8, 16), new THREE.MeshStandardMaterial({ color: col, roughness: .35, emissive: col, emissiveIntensity: .06 }))); m.rotation.set(0, ry, Math.PI / 2); m.position.set(x, 1.05, z); PI_.add(m); };
  for (let i = 0; i < 4; i++) { tube(1.9, puffCols[i % 2 ? 1 : 0], -PW / 2 + 1.2 + i * 2.4, -PD / 2 - .05, 0); tube(1.9, puffCols[i % 2 ? 0 : 1], -PW / 2 + 1.2 + i * 2.4, PD / 2 + .05, 0); }
  for (const s of [-1, 1]) { tube(1.2, puffCols[3], s * (PW / 2 + .05), -2.1, Math.PI / 2); tube(1.2, puffCols[3], s * (PW / 2 + .05), 2.1, Math.PI / 2);
    const goal = shadowy(new THREE.Mesh(new THREE.TorusGeometry(1.05, .2, 12, 32, Math.PI), new THREE.MeshStandardMaterial({ color: "#ffe27a", roughness: .3, emissive: "#ffc23a", emissiveIntensity: .15 })));
    goal.position.set(s * (PW / 2 - .3), .8, 0); goal.rotation.y = Math.PI / 2; PI_.add(goal); }
  const faceTex = (() => { const c = document.createElement("canvas"); c.width = 256; c.height = 128; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 256, 128);
    const cx = 64; for (const ex of [-13, 13]) { x.fillStyle = "#1d1b3a"; x.beginPath(); x.ellipse(cx + ex, 56, 6, 9, 0, 0, 7); x.fill(); x.fillStyle = "#fff"; x.beginPath(); x.arc(cx + ex + 2, 52, 2.4, 0, 7); x.fill(); }
    x.strokeStyle = "#1d1b3a"; x.lineWidth = 4; x.lineCap = "round"; x.beginPath(); x.arc(cx, 66, 10, .25, Math.PI - .25); x.stroke();
    x.fillStyle = "rgba(255,110,150,.45)"; for (const ex of [-24, 24]) { x.beginPath(); x.ellipse(cx + ex, 70, 6, 4, 0, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const puffs = [];
  [[-2.8, -1.4], [-1.2, 1.5], [.6, -.6], [2.4, 1.2], [3.2, -1.8], [-3.6, 1.1]].forEach(([x, z], i) => {
    const m = shadowy(new THREE.Mesh(new THREE.SphereGeometry(.5, 32, 24), new THREE.MeshStandardMaterial({ color: puffCols[i], map: faceTex, roughness: .35, emissive: puffCols[i], emissiveIntensity: .05 })));
    m.position.set(x, 1.3, z); m.userData = { x, z, ph: i * 1.13 }; PI_.add(m); puffs.push(m); });
  const ballP = new THREE.Mesh(new THREE.SphereGeometry(.26, 24, 16), mat("#ffffff", .4)); PI_.add(ballP); ballP.castShadow = true;
  // Jumpis: the game's own characters, on the plaza and on the little island, waving
  const jumpis = [];
  new GLTFLoader().load("/blobby.glb", (gl) => {
    const base = gl.scene; const box = new THREE.Box3().setFromObject(base), hgt = box.max.y - box.min.y || 1;
    const make = (skin, iris, parent, x, z, ry, s = 1) => {
      const b = base.clone(true);
      b.traverse((o) => { if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
        o.material = [].concat(o.material).map((m) => { if (m.name === "Skin") { m = m.clone(); m.color.set(skin); m.roughness = .45; } else if (m.name === "Iris") { m = m.clone(); m.color.set(iris); }
          else if (m.name === "Mouth") { m = m.clone(); const c = new THREE.Color(skin), hh = {}; c.getHSL(hh); m.color.setHSL(hh.h, Math.min(1, hh.s * .9), hh.l * .22); } return m; });
        if (o.material.length === 1) o.material = o.material[0]; });
      const k = 1.25 * s / hgt; b.scale.setScalar(k); b.position.set(x, .8 - box.min.y * k, z); b.rotation.y = ry; parent.add(b);
      const n = { root: b, armL: b.getObjectByName("ArmL"), armR: b.getObjectByName("ArmR"), y: b.position.y, ph: jumpis.length * 1.7 };
      n.rL = n.armL ? n.armL.rotation.z : 0; n.rR = n.armR ? n.armR.rotation.z : 0; jumpis.push(n); return n; };
    make("#ff8a1c", "#7a3e12", JI, -.9, 1.2, .1); make("#1fb6ff", "#0a4f7a", JI, .9, 1.4, -.25); make("#ff5a9a", "#7a1240", JI, .1, 2.2, 0, .9); make("#7ed321", "#2f5c08", JI, -1.9, -.4, .5, .95);
    make("#ffc23a", "#6b4a00", small1, .2, .3, .7);
  }, undefined, () => {});

  /* evening: stars, and the lighthouse's turning beam */
  const starG = new THREE.BufferGeometry(), starN = 1100, starP = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) { const a = rnd(i, 51) * Math.PI * 2, h = .06 + Math.pow(rnd(i, 52), .7) * .94, r = 480; const c = Math.sqrt(1 - h * h);
    starP[i * 3] = Math.cos(a) * c * r; starP[i * 3 + 1] = h * r; starP[i * 3 + 2] = Math.sin(a) * c * r; }
  starG.setAttribute("position", new THREE.BufferAttribute(starP, 3));
  const starM = new THREE.PointsMaterial({ map: puffTex, color: "#fff6e0", size: small ? 2.6 : 3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const stars = new THREE.Points(starG, starM); scene.add(stars);
  const beamU = { n: { value: 0 } };
  const beamG = new THREE.ConeGeometry(1.3, 22, 32, 1, true); beamG.translate(0, -11, 0); beamG.rotateZ(Math.PI / 2);
  const beamM = new THREE.ShaderMaterial({ uniforms: beamU, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: "varying float vX;void main(){vX=position.x/22.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "uniform float n;varying float vX;void main(){float a=pow(1.-clamp(vX,0.,1.),1.6)*.13*n;gl_FragColor=vec4(vec3(1.,.86,.6)*a,1.);}" });
  const beam = new THREE.Group(); beam.position.y = 3.52; lh.add(beam);
  for (const r of [0, Math.PI]) { const b = new THREE.Mesh(beamG, beamM); b.rotation.y = r; b.rotation.z = -.06; beam.add(b); }
  const NIGHT = { top: new THREE.Color("#070b26"), mid: new THREE.Color("#1d2160"), hor: new THREE.Color("#3a3878"), deep: new THREE.Color("#04182a"), lagoon: new THREE.Color("#0f4a5a"), fog: new THREE.Color("#141a46") };
  const DAY = { top: C.top.clone(), mid: C.mid.clone(), hor: C.hor.clone(), deep: C.deep.clone(), lagoon: C.lagoon.clone(), sun: C.sun.clone(), fog: scene.fog.color.clone() };

  // clouds: soft round puffs far away, drifting; a few thin veils the camera flies through
  const cloudM = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffc4ac", emissiveIntensity: .38, roughness: 1 });
  const clouds = new THREE.Group(); scene.add(clouds);
  for (let i = 0; i < 16; i++) { const g = new THREE.Group(), a = rnd(i) * Math.PI * 2, d = 55 + rnd(i, 1) * 120;
    for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), cloudM); const r = 2.2 + rnd(i, k + 2) * 2.4; s.scale.set(r * 1.3, r * .8, r); s.position.set((k - 2.5) * 2.4 + rnd(i, k + 9) * 1.5, rnd(i, k + 5) * 1.6, rnd(i, k + 7) * 2); g.add(s); }
    g.position.set(Math.sin(a) * d, 14 + rnd(i, 3) * 26, -Math.abs(Math.cos(a)) * d - 20); g.scale.setScalar(.8 + rnd(i, 4) * .9); clouds.add(g); }
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

  /* the camera's path: keyframes at places in the scenes (a scene and how far into it); between them it eases.
     Two keys with the same place make the camera stay while a card is read. */
  const PATH = [
    [0, 0, [0, 5.6, 27], [0, 4.4, 0]],
    [1, 0, [9.5, 10.5, 16], [0, 2.6, 0]],
    [1, .85, [5.2, 3.6, 10.5], [-.4, 1.7, 0]],
    [2, .04, [0, 8, 17], [0, 1.6, 0]],
    [2, .15, [-1, 3.1, 5.2], [-3.7, 2.7, -1.4]], [2, .3, [-.6, 3.2, 5.4], [-3.7, 2.7, -1.4]],         // the lighthouse
    [2, .38, [4.2, 3.3, 3.6], [1.7, 1.9, -.6]], [2, .53, [4.4, 3.4, 3.8], [1.7, 1.9, -.6]],           // the cottage
    [2, .61, [.4, 3.6, 8], [-1.9, 2.3, 1.6]], [2, .75, [0, 3.7, 8.3], [-1.9, 2.3, 1.6]],           // the balloon tree
    [2, .83, [-8.2, 3.4, 9.6], [-9.2, .9, 2.6]], [2, .97, [-9, 3.6, 9.8], [-9.2, .9, 2.6]],             // the bridge
    [3, .07, [0, 30, 46], [0, 0, -18]],                                                                 // out to sea
    [3, .2, [-20.5, 9, -6.5], [-30, 2.2, -24]], [3, .5, [-22.5, 8.4, -6], [-30, 2.2, -24]],             // Jumpi
    [3, .62, [19, 8, -9.5], [28, 1.2, -26]], [3, .94, [21, 7.4, -8.8], [28, 1.2, -26]],                // Puffball
    [4, .12, [8, 6.5, 18], [-1.5, 3, -1]], [4, .92, [-5, 5.2, 16], [-2, 3, -1]],                        // evening at home
    [5, .3, [0, 50, 50], [0, 0, -14]], [5, 1, [0, 56, 56], [0, 0, -14]],                                // the whole world from above
  ];
  const keys = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight), far = small ? 1.3 : 1;
    const k = PATH.map(([i, t, pos, lk]) => ({ p: clamp(sceneY(i, t) / max), pos: pos.map((v, j) => lk[j] + (v - lk[j]) * (i === 5 ? 1 : far)), look: lk }));
    k.s1 = k[1].p; k.n0 = clamp(sceneY(3, .96) / max); k.n1 = clamp(sceneY(4, .26) / max);
    return k;
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
  let W = innerWidth, H = innerHeight;
  function size() { W = innerWidth; H = innerHeight; R.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); composer.setSize(W, H); composer.setPixelRatio(dpr); K = keys(); }
  addEventListener("resize", size); size();
  const ready = { logo: false };
  let camP = state.P, side = 0, last = performance.now(), T = 0, frames = 0, slowT = 0, drawn = false, bloomOn = true;
  const look = new THREE.Vector3();
  const moon = new THREE.Color("#9fb0ff"), sunDay = new THREE.Color(0xffc89a), hemiDay = new THREE.Color(0xffd9c2), cloudNight = new THREE.Color("#454b8a"), cloudEmD = new THREE.Color("#ffc4ac"), cloudEmN = new THREE.Color("#2a2f70");
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (document.hidden) return;
    const still = calm();
    if (!still) T += dt;
    camP = still ? state.P : mix(camP, state.P, 1 - Math.exp(-dt * 4.5));
    side = still ? state.side : mix(side, state.side, 1 - Math.exp(-dt * 5));
    const c = at(camP);
    cam.position.set(c.pos[0], c.pos[1] + (still ? 0 : Math.sin(T * .5) * .08), c.pos[2]); look.set(c.look[0], c.look[1], c.look[2]); cam.lookAt(look);
    // while a card is read, the place it talks about moves to the other side of the screen (on phones: above the card)
    const rtl = root.dir === "rtl";
    if (side > .002) cam.setViewOffset(W, H, small ? 0 : (rtl ? 1 : -1) * W * .2 * side, small ? H * .2 * side : 0, W, H); else cam.clearViewOffset();
    // the logo rises and fades as we fly in
    const gone = smooth(camP / Math.max(.001, K.s1 * .85));
    logo.position.set(0, 7.2 + gone * 6 + (still ? 0 : Math.sin(T * 1.1) * .18), 0); logo.rotation.y = (still ? 0 : Math.sin(T * .6) * .06) + gone * .3; logo.rotation.x = -.05;
    const op = 1 - gone; logo.visible = op > .01;
    layerMats.forEach((m) => { m.opacity = op; m.alphaTest = op > .98 ? .45 : .01; m.transparent = true; }); shineU.fade.value = op; halo.material.opacity = .22 * op; spM.opacity = .9 * op;
    shineU.time.value = T; seaU.time.value = T;
    sparks.rotation.y = T * .05; spM.size = .14 + Math.sin(T * 3) * .03;
    clouds.rotation.y = T * .004;
    const fly = Math.sin(clamp(camP / Math.max(.001, K.s1)) * Math.PI);   // the veils only while flying in, never where the camera rests
    veils.forEach((v) => { const d = v.position.distanceTo(cam.position); v.material.opacity = .3 * fly * (1 - smooth((d - 3) / 7)) * smooth((d - 1) / 2.5); });
    // evening comes: the sky, the sea and the light turn to night, stars come out, the lighthouse turns its beam
    const n = smooth((camP - K.n0) / Math.max(1e-4, K.n1 - K.n0));
    C.top.copy(DAY.top).lerp(NIGHT.top, n); C.mid.copy(DAY.mid).lerp(NIGHT.mid, n); C.hor.copy(DAY.hor).lerp(NIGHT.hor, n);
    C.deep.copy(DAY.deep).lerp(NIGHT.deep, n); C.lagoon.copy(DAY.lagoon).lerp(NIGHT.lagoon, n); C.sun.copy(DAY.sun).multiplyScalar(1 - n * .92);
    scene.fog.color.copy(DAY.fog).lerp(NIGHT.fog, n);
    hemi.intensity = mix(1.15, .55, n); hemi.color.copy(hemiDay).lerp(moon, n);
    sun.intensity = mix(2.6, .45, n); sun.color.copy(sunDay).lerp(moon, n); front.intensity = mix(.55, .35, n);
    cloudM.color.setRGB(1, 1, 1).lerp(cloudNight, n); cloudM.emissive.copy(cloudEmD).lerp(cloudEmN, n);
    starM.opacity = n * (.8 + Math.sin(T * 1.7) * .08); stars.rotation.y = T * .003;
    beamU.n.value = n; beam.visible = n > .01; beam.rotation.y = T * .55;
    lhLight.intensity = mix(6, 16, n); lamp.material.emissiveIntensity = (1.4 + Math.sin(T * 2) * .2) * (1 + n);
    windows.forEach((w, i) => { w.material.emissiveIntensity = i ? mix(.5, 2.4, n) : mix(1.4, 2.6, n); });
    rimLights.emissiveIntensity = mix(.6, 3.2, n);
    if (bloom) bloom.strength = mix(.32, .7, n);
    R.toneMappingExposure = mix(.95, 1.08, n);
    // life: balloons, the wheel, the fountain, the Puffs and their ball, the Jumpis waving
    balloons.children.forEach((b) => { if (!b.userData.base) return; b.position.y = b.userData.base.y + Math.sin(T * 1.2 + b.userData.ph) * .06; b.position.x = b.userData.base.x + Math.sin(T * .8 + b.userData.ph) * .03;
      const a = b.userData.line.geometry.attributes.position; a.setXYZ(1, b.position.x, b.position.y - .3, b.position.z); a.needsUpdate = true; });
    wheel.rotation.z = T * .14; cabins.forEach((cb) => (cb.rotation.z = -wheel.rotation.z));
    jet.scale.y = 1 + Math.sin(T * 5) * .12;
    puffs.forEach((m) => { const u = m.userData, h = Math.abs(Math.sin(T * 2.2 + u.ph)); m.position.set(u.x + Math.sin(T * .6 + u.ph) * .5, 1.29 + h * 1.1, u.z + Math.cos(T * .5 + u.ph) * .3);
      const sq = 1 - (1 - smooth(h * 4)) * .16; m.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); m.lookAt(cam.position); });
    ballP.position.set(Math.sin(T * .9) * 3.2, 1.05 + Math.abs(Math.sin(T * 2.8)) * .9, Math.cos(T * 1.3) * 1.6);
    jumpis.forEach((j) => { j.root.position.y = j.y + Math.abs(Math.sin(T * 2.6 + j.ph)) * .07;
      if (j.armR) j.armR.rotation.z = j.rR + (Math.sin(T * 7 + j.ph) * .45 + .9) * (still ? 0 : 1);
      if (j.armL) j.armL.rotation.z = j.rL - Math.sin(T * 2 + j.ph) * .12; });
    composer.render();
    if (!drawn) { drawn = true; root.classList.add("cw-3d"); }
    // the first seconds: if this device draws slowly, drop the glow and the resolution
    if (frames < 120) { frames++; slowT += dt; if (frames === 120 && slowT / 120 > 1 / 32 && bloomOn) { bloomOn = false; dpr = 1; R.setPixelRatio(1); composer.removePass(bloom); bloom = null; size(); } }
  }
  R.setAnimationLoop(frame);
  if (calm()) root.classList.add("cw-calm");
  addEventListener("gd:lang", () => { K = keys(); });
  new ResizeObserver(() => { K = keys(); }).observe(document.body);
}
try { start(); } catch (e) { console.error("[company-world]", e); root.classList.add("cw-calm"); }
