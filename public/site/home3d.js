/*
  The home page banner, live in 3D: four Jumpi explorers on a little island in the sea.
  - The island, its props and what the Jumpis wear come from img/home/island.glb (exported from the studio scene
    "islandHero" in the game); their bodies come from /blobby.glb (the game's own character), dressed again here.
  - Alive: the sea moves (a wave shader with the sun glinting on it), clouds drift, palm leaves sway, the flag waves,
    the boat bobs; A looks out to sea through binoculars, B reads the treasure map, C and D play catch with a beach ball.
  - The still picture (island-hero.jpg) is the same view and stays under the canvas until the first frame is drawn,
    and is all that shows with "stop animations", reduced motion, no WebGL, or a very small screen.
*/
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const stage = document.getElementById("stage");
const still = () => !!window.JUMPI_REDUCE_MOTION || matchMedia("(prefers-reduced-motion: reduce)").matches;
const okGL = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } })();
if (stage && okGL && !still() && innerWidth >= 360) start().catch((e) => console.warn("[home3d]", e));

function tex(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

async function start() {
  const loader = new GLTFLoader();
  const load = (url) => new Promise((ok, no) => loader.load(url, (g) => ok(g.scene), undefined, no));
  const [island, blobby] = await Promise.all([load("/site/img/home/island.glb"), load("/blobby.glb")]);

  /* ---------- renderer and camera: the same view as the still picture ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const cv = renderer.domElement; cv.className = "hm-3d"; cv.setAttribute("aria-hidden", "true");
  stage.insertBefore(cv, stage.querySelector(".hm-sky"));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(35, 2, 0.1, 900); cam.position.set(0, 3.0, 16.6); cam.lookAt(0, 2.55, 0);
  scene.fog = new THREE.Fog(0xcdeeff, 140, 420);

  /* ---------- sky: bright day, far islands, the sun high on the right ---------- */
  const SKY_H = 330;
  const sky = tex(2048, 760, (c, w, h) => {
    const hy = h * (1 - 40 / SKY_H);
    const g = c.createLinearGradient(0, 0, 0, hy); g.addColorStop(0, "#1774d8"); g.addColorStop(.45, "#46a8f2"); g.addColorStop(.8, "#9ad8ff"); g.addColorStop(1, "#d9f4ff");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const sx = w * .72, sy = hy * .3, gl = c.createRadialGradient(sx, sy, 0, sx, sy, h * .9);
    gl.addColorStop(0, "rgba(255,252,225,.95)"); gl.addColorStop(.12, "rgba(255,246,200,.6)"); gl.addColorStop(.4, "rgba(255,240,200,.18)"); gl.addColorStop(1, "rgba(255,240,200,0)");
    c.fillStyle = gl; c.fillRect(0, 0, w, h); c.fillStyle = "#fffdf0"; c.beginPath(); c.arc(sx, sy, h * .045, 0, 7); c.fill();
    const far = (x, wd, ht, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x - wd, hy); c.bezierCurveTo(x - wd * .6, hy - ht, x + wd * .4, hy - ht * 1.1, x + wd, hy); c.fill(); };
    far(w * .14, w * .07, h * .03, "#7fb7cf"); far(w * .2, w * .035, h * .018, "#8cc2d8"); far(w * .86, w * .05, h * .02, "#8cc2d8");
  });
  const skyM = new THREE.Mesh(new THREE.PlaneGeometry(900, SKY_H), new THREE.MeshBasicMaterial({ map: sky, fog: false, toneMapped: false }));
  skyM.position.set(0, -40 + SKY_H / 2, -420); scene.add(skyM);
  const glow = (r, stops) => tex(256, 256, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); stops.forEach(([o, col]) => g.addColorStop(o, col)); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const sunT = glow(0, [[0, "rgba(255,255,245,1)"], [.09, "rgba(255,252,225,1)"], [.13, "rgba(255,240,180,.75)"], [.35, "rgba(255,235,170,.25)"], [1, "rgba(255,230,160,0)"]]);
  const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
  sunS.position.set(27, 13.5, -70); sunS.scale.setScalar(15); scene.add(sunS);

  /* ---------- clouds drift slowly across, far behind the island ---------- */
  const cloudTex = await Promise.all([1, 2, 3].map((i) => new THREE.TextureLoader().loadAsync(`/site/img/home/cloud-${i}.webp`)));
  cloudTex.forEach((t) => (t.colorSpace = THREE.SRGBColorSpace));
  const clouds = [[0, -120, 52, -260, 70, 2.2], [1, 40, 36, -230, 48, 3.1], [2, 160, 44, -300, 82, 1.6], [1, -40, 61, -280, 40, 2.6], [0, 260, 30, -250, 56, 1.9]].map(([k, x, y, z, s, sp]) => {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex[k], transparent: true, depthWrite: false, fog: false, opacity: .95 }));
    const img = cloudTex[k].image; m.scale.set(s, s * img.height / img.width, 1); m.position.set(x, y, z); m.userData.sp = sp; scene.add(m); return m;
  });

  /* ---------- the sea: gentle waves, sky-blue far away, deep blue near, the sun glinting ---------- */
  const seaU = { uT: { value: 0 }, uSun: { value: new THREE.Vector3(27, 13.5, -70).normalize() }, uCam: { value: cam.position } };
  const seaMat = new THREE.ShaderMaterial({
    uniforms: seaU, fog: false,
    vertexShader: `
      uniform float uT; varying vec3 vW; varying vec3 vN;
      float wave(vec2 p, vec2 d, float f, float a, float s){ return a*sin(dot(p,d)*f + uT*s); }
      void main(){
        vec4 w = modelMatrix * vec4(position,1.0);
        float near = smoothstep(9.0, 16.0, length(w.xz*vec2(.8,1.28)));   // calm right at the island
        vec2 p = w.xz;
        float h = wave(p,normalize(vec2(1.,.3)),.35,.10,1.3)+wave(p,normalize(vec2(-.4,1.)),.55,.06,1.9)+wave(p,normalize(vec2(.7,-.8)),.9,.035,2.6);
        float dx = .35*.10*cos(dot(p,normalize(vec2(1.,.3)))*.35+uT*1.3)*.95 + .55*.06*cos(dot(p,normalize(vec2(-.4,1.)))*.55+uT*1.9)*-.37;
        float dz = .35*.10*cos(dot(p,normalize(vec2(1.,.3)))*.35+uT*1.3)*.29 + .55*.06*cos(dot(p,normalize(vec2(-.4,1.)))*.55+uT*1.9)*.93;
        w.y += h*near; vW = w.xyz; vN = normalize(vec3(-dx*near, 1.0, -dz*near));
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform float uT; uniform vec3 uSun; uniform vec3 uCam; varying vec3 vW; varying vec3 vN;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float d = length(vW.xz - uCam.xz);
        vec3 nearC = vec3(.043,.525,.83), midC = vec3(.09,.6,.87), farC = vec3(.43,.80,.96), hor = vec3(.75,.91,1.0);
        vec3 col = mix(nearC, midC, smoothstep(10.,60.,d)); col = mix(col, farC, smoothstep(60.,220.,d)); col = mix(col, hor, smoothstep(220.,400.,d));
        // little ripples
        vec2 q = vW.xz*vec2(.9,2.2);
        float r = noise(q + vec2(uT*.35, uT*.12)) * .6 + noise(q*2.3 - vec2(uT*.5, -uT*.2)) * .4;
        vec3 n = normalize(vN + vec3((r-.5)*.35, 0., (noise(q*1.7+uT*.3)-.5)*.35));
        vec3 v = normalize(uCam - vW);
        float fres = pow(1. - max(dot(n, v), 0.), 4.);
        col = mix(col, vec3(.75,.9,1.), fres*.35);
        // the sun on the water
        vec3 h = normalize(uSun + v);
        float spec = pow(max(dot(n, h), 0.), 180.) * 2.2;
        col += vec3(1., .96, .85) * spec;
        // sparkles that come and go
        vec2 cell = floor(vW.xz * vec2(2.2, 5.0));
        float tw = hash(cell + floor(uT*2.5 + hash(cell)*7.));
        float sp = step(.985, tw) * smoothstep(80., 8., d) * (.5 + .5*sin(uT*9. + hash(cell)*30.));
        col += vec3(1.) * sp * .55;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 520, 220, 160), seaMat); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.04, -200); scene.add(sea);

  /* ---------- the island from the studio, and the Jumpis dressed again ---------- */
  scene.add(island);
  // names repeat between the four Jumpis, so the loader renames them; the export keeps each real name as "part"
  const part = (root, name) => { let f = null; root.traverse((o) => { if (!f && o.userData.part === name) f = o; }); return f; };
  island.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const shallows = part(island, "Shallows");
  if (shallows) { shallows.castShadow = shallows.receiveShadow = false; shallows.renderOrder = 1; }
  const makeBlobby = (skin, iris) => {
    const root = blobby.clone(true);
    root.traverse((o) => {
      if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
      o.material = [].concat(o.material).map((m) => {
        if (m.name === "Skin") { m = m.clone(); m.color.set(skin); m.roughness = .45; }
        else if (m.name === "Iris") { m = m.clone(); m.color.set(iris); }
        else if (m.name === "Mouth") { m = m.clone(); const c = new THREE.Color(skin), hh = {}; c.getHSL(hh); m.color.setHSL(hh.h, Math.min(1, hh.s * .9), hh.l * .22); }
        return m;
      });
      if (o.material.length === 1) o.material = o.material[0];
    });
    return root;
  };
  // each Jumpi from the studio keeps its pose and what it wears; the body itself is put back from blobby.glb, part by part
  const PARTS = ["Body", "ArmL", "ArmR", "Head", "EyeL", "EyeR", "LookL", "LookR"];
  const J = {};
  for (const id of ["JumpiA", "JumpiB", "JumpiC", "JumpiD"]) {
    const X = part(island, id); if (!X) continue;
    const body = makeBlobby(X.userData.skin || "#ff8a1c", X.userData.iris || "#7a3e12");
    for (const name of PARTS) {
      const to = part(X, name), from = body.getObjectByName(name); if (!to || !from) continue;
      const pieces = from.isMesh ? [[from, true]] : from.children.filter((c) => c.isMesh && !PARTS.includes(c.name)).map((c) => [c, false]);
      for (const [m, self] of pieces) {
        const k = new THREE.Mesh(m.geometry, m.material); k.castShadow = k.receiveShadow = true;
        if (!self) { k.position.copy(m.position); k.quaternion.copy(m.quaternion); k.scale.copy(m.scale); }
        to.add(k);
      }
    }
    const g = (n) => part(X, n);
    const n = { root: X, head: g("Head"), body: g("Body"), armL: g("ArmL"), armR: g("ArmR"), eyeL: g("EyeL"), eyeR: g("EyeR"), ph: Math.random() * 6, blinkT: 1 + Math.random() * 3 };
    n.base = { y: X.position.y, ry: X.rotation.y, head: n.head.rotation.clone(), armL: n.armL.rotation.clone(), armR: n.armR.rotation.clone(), headY: n.head.position.y, eye: n.eyeL.scale.y };
    J[id] = n;
  }

  /* ---------- light: the sun from the front right, the sky, a cool rim ---------- */
  scene.add(new THREE.HemisphereLight(0xdff2ff, 0xe8c890, 1.2));
  const sun = new THREE.DirectionalLight(0xfff1d6, 3.4); sun.position.set(6, 10, 9); sun.castShadow = true;
  const big = innerWidth > 900; sun.shadow.mapSize.set(big ? 2048 : 1024, big ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, near: 1, far: 40 }); sun.shadow.bias = -.0004; sun.shadow.radius = 4; scene.add(sun);
  const rim = new THREE.DirectionalLight(0xbfe8ff, 1.4); rim.position.set(-5, 4, -8); scene.add(rim);

  /* ---------- the beach ball ---------- */
  const ballT = tex(256, 128, (c, w, h) => { const cols = ["#ff4f6d", "#ffffff", "#ffd23a", "#ffffff", "#1fb6ff", "#ffffff"]; cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(i * w / 6, 0, w / 6 + 1, h); }); c.fillStyle = "#fff"; c.fillRect(0, 0, w, h * .07); c.fillRect(0, h * .93, w, h * .07); });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.24, 28, 20), new THREE.MeshStandardMaterial({ map: ballT, roughness: .35 })); ball.castShadow = true; scene.add(ball);
  const C = J.JumpiC, D = J.JumpiD;
  // the ball is held in front of the chest, between the two hands, a little toward the friend
  const mid = (n) => { const a = new THREE.Vector3(), b = new THREE.Vector3(); n.armL.getWorldPosition(a); n.armR.getWorldPosition(b); return a.add(b).multiplyScalar(.5); };
  scene.updateMatrixWorld(true);
  let pC = new THREE.Vector3(1, 1.2, 1.15), pD = new THREE.Vector3(3.7, 1.2, .75);
  if (C && D) {
    const mc = mid(C), md = mid(D), dir = md.clone().sub(mc).setY(0).normalize();
    pC = mc.clone().addScaledVector(dir, .34).add(new THREE.Vector3(0, .14, .08));
    pD = md.clone().addScaledVector(dir, -.34).add(new THREE.Vector3(0, .14, .08));
  }
  // chest glow, gently pulsing
  const chest = part(island, "Chest"), shineT = glow(0, [[0, "rgba(255,240,150,.9)"], [1, "rgba(255,220,80,0)"]]);
  const shine = new THREE.Sprite(new THREE.SpriteMaterial({ map: shineT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  if (chest) { shine.position.copy(chest.position).add(new THREE.Vector3(0, .8, 0)); scene.add(shine); }
  // gulls gliding round
  const gullM = new THREE.MeshBasicMaterial({ color: 0x2c3e60, side: THREE.DoubleSide, fog: false });
  const gullG = new THREE.BufferGeometry(); gullG.setAttribute("position", new THREE.Float32BufferAttribute([-1, .35, 0, -.45, 0, 0, 0, .12, 0, 0, .12, 0, .45, 0, 0, 1, .35, 0, -.45, 0, 0, 0, .12, 0, 0, -.05, 0, 0, .12, 0, .45, 0, 0, 0, -.05, 0], 3));
  const gulls = [[-30, 19, -60, .9], [-24, 21, -62, .7], [22, 23, -70, .8]].map(([x, y, z, s], i) => { const g = new THREE.Mesh(gullG, gullM); g.position.set(x, y, z); g.scale.setScalar(s); g.userData = { x, y, z, i }; scene.add(g); return g; });

  /* ---------- size, and drawing only while on screen ---------- */
  const resize = () => { const r = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, r.width > 1400 ? 1.5 : 1.75); renderer.setPixelRatio(dpr); renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height;
    // a narrow screen (a phone held upright): widen the view so the island and all four friends still fit side to side
    cam.fov = Math.max(35, 2 * Math.atan(4.9 / 16.6 / cam.aspect) * 180 / Math.PI); cam.updateProjectionMatrix(); };
  resize(); new ResizeObserver(resize).observe(stage);
  let onScreen = true; new IntersectionObserver((es) => { onScreen = es.some((e) => e.isIntersecting); }).observe(stage);

  const flag = part(island, "Flag"), flagPos = flag && flag.isMesh && flag.geometry.attributes.position, flag0 = flagPos && flagPos.array.slice();
  const fronds = []; island.traverse((o) => { if (String(o.userData.part || "").startsWith("Frond")) fronds.push({ o, rz: o.rotation.z, rx: o.rotation.x, k: fronds.length }); });
  const boat = part(island, "Boat"), boat0 = boat && { y: boat.position.y, rz: boat.rotation.z, rx: boat.rotation.x };
  const A = J.JumpiA, B = J.JumpiB;

  const live = (n, t) => {   // breathing and blinking
    const br = Math.sin(t * 2.1 + n.ph);
    n.body.scale.set(1 + br * .012, 1 + br * .018, 1 + br * .012); n.head.position.y = n.base.headY + br * .012;
    if (t > n.blinkT) { const k = (t - n.blinkT) / .16, s = k < 1 ? Math.abs(1 - 2 * k) : 1; n.eyeL.scale.y = n.eyeR.scale.y = n.base.eye * Math.max(.1, s); if (k >= 1) n.blinkT = t + 2 + Math.random() * 3; }
  };
  const ease = (k) => (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const FLY = 1.15, HOLD = .8, ARC = 1.5;   // seconds in the air, seconds holding it, height of the throw

  let first = true;
  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    if (!onScreen || document.hidden || (!first && still())) { clock.getDelta(); return; }
    const t = clock.elapsedTime + clock.getDelta() * 0;
    seaU.uT.value = t;
    clouds.forEach((c) => { c.position.x += c.userData.sp * .016; if (c.position.x > 420) c.position.x = -420; });
    gulls.forEach((g) => { const u = g.userData, a = t * .12 + u.i * .5; g.position.set(u.x + Math.sin(a) * 18, u.y + Math.sin(t * .7 + u.i) * .8, u.z + Math.cos(a) * 6); g.scale.y = (.9 + .2 * u.i) * (.6 + .4 * Math.abs(Math.sin(t * 3 + u.i))); g.lookAt(cam.position); });
    fronds.forEach((f) => { f.o.rotation.z = f.rz + Math.sin(t * 1.4 + f.k * .7) * .045; f.o.rotation.x = f.rx + Math.sin(t * 1.1 + f.k) * .03; });
    if (flagPos) { for (let i = 0; i < flagPos.count; i++) { const x = flag0[i * 3]; flagPos.setZ(i, Math.sin(x * 4.2 - t * 5) * .12 * Math.min(1, x / .5)); } flagPos.needsUpdate = true; flag.geometry.computeVertexNormals(); }
    if (boat) { boat.position.y = boat0.y + Math.sin(t * 1.3) * .05; boat.rotation.z = boat0.rz + Math.sin(t * 1.1) * .035; boat.rotation.x = boat0.rx + Math.sin(t * .9 + 1) * .025; }
    if (shallows) shallows.material.opacity = .9 + Math.sin(t * .9) * .08;
    shine.material.opacity = .65 + Math.sin(t * 2.2) * .2;
    for (const n of Object.values(J)) live(n, t);
    // A sweeps the horizon with the binoculars, stops, looks again
    if (A) { const s = Math.sin(t * .35), hold = Math.sign(s) * Math.pow(Math.abs(s), .45);
      A.head.rotation.y = A.base.head.y + hold * .55; A.head.rotation.x = A.base.head.x + Math.sin(t * .8) * .04; A.root.rotation.y = A.base.ry + hold * .18; }
    // B reads along the map, now and then looks up
    if (B) { const look = Math.max(0, Math.sin(t * .4 - 1)) ** 6;
      B.head.rotation.x = B.base.head.x - look * .45 + Math.sin(t * 2.2) * .02; B.head.rotation.y = B.base.head.y + Math.sin(t * 1.15) * .16 * (1 - look); B.root.rotation.y = B.base.ry + Math.sin(t * .5) * .05; }
    // C and D play catch
    if (C && D) {
      const cyc = (FLY + HOLD) * 2, tt = t % cyc, toD = tt < FLY + HOLD, k0 = toD ? tt : tt - FLY - HOLD;
      const from = toD ? pC : pD, to = toD ? pD : pC, thrower = toD ? C : D, catcher = toD ? D : C;
      if (k0 < FLY) { const k = k0 / FLY, e = ease(k); ball.position.lerpVectors(from, to, e); ball.position.y += Math.sin(Math.PI * e) * ARC; ball.rotation.z -= .12 * (toD ? 1 : -1); ball.rotation.x += .05; }
      else ball.position.copy(to);
      for (const n of [C, D]) {
        const isT = n === thrower, k = Math.min(1, k0 / FLY), held = k0 >= FLY;
        // arms: up to catch, a swing forward to throw
        let up = isT ? (k0 < .25 ? 1 - k0 / .25 * .6 : .4 + .6 * Math.min(1, (k0 - .25) / .8)) : (held ? 1 : .55 + .45 * k);
        if (isT && k0 < .25) up += Math.sin(k0 / .25 * Math.PI) * .3;
        n.armL.rotation.x = n.base.armL.x * up + (1 - up) * .15; n.armR.rotation.x = n.base.armR.x * up + (1 - up) * .15;
        // little hop when the ball lands in their hands
        const hop = !isT && held ? Math.max(0, Math.sin((k0 - FLY) / .35 * Math.PI)) * (k0 - FLY < .35 ? 1 : 0) : 0;
        n.root.position.y = n.base.y + hop * .22;
        // eyes on the ball
        const bp = ball.position.clone(), np = new THREE.Vector3(); n.head.getWorldPosition(np);
        n.head.rotation.x = n.base.head.x - THREE.MathUtils.clamp((bp.y - np.y) * .18, -.1, .45);
      }
    }
    renderer.render(scene, cam);
    if (first) { first = false; stage.classList.add("live3d"); }
  }
  // build every shader before the first frame (no stutter while the still picture hands over to the 3D)
  try { if (renderer.compileAsync) await renderer.compileAsync(scene, cam); else renderer.compile(scene, cam); } catch (e) {}
  frame();
}
