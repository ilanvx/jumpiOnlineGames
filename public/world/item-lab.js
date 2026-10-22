/*
  The Item studio's 3D view (admin panel → Item studio opens /play?game&itemlab in a frame).
  One Jumpi on a little stage, wearing the item being worked on. Drag around to look (mouse: left turns, right moves,
  wheel zooms); the arrows / rings / box on the item move, turn and size it. The panel talks to this page with messages
  (same site only):
    panel → here: {t:"show", slot, i, look, refit?, from?, patch?, fix?}  the item; from: a new one (not saved yet) that looks
                  like item "from"; patch: changed colours / names (also for an item made before)
                  {t:"fix", fix}  where it sits ({p:[x,y,z], r:[x,y,z], s}), from the panel's number fields
                  {t:"mode", m:"translate"|"rotate"|"scale"}   {t:"view", v:"front"|"side"|"back"|"top"|"fit"}
    here → panel: {t:"ready"}  {t:"fix", fix, done}  (while the item is dragged here, and when it is let go)
  Nothing here is saved: the panel saves (routes/items.js). Shirts and pants are painted on, so they can't be moved.
*/
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

const PLACEHOLDER = { id: "none", name: "", price: 0, gift: "none", placeholder: true };
const MOVABLE = new Set(["hair", "hat", "glasses", "neck", "beard"]);
const r4 = (n) => Math.round(n * 10000) / 10000;

export function startLab(G) {
  const { THREE, OUTFIT_PARTS, OUTFIT_OBJ, outfitDrop, fixApply, makeCharacter } = G;
  const st = document.createElement("style");
  st.textContent = `body.itemlab>*:not(#itemLab){display:none!important}body.itemlab{margin:0;overflow:hidden;background:#eef3ff}
    #itemLab{position:fixed;inset:0;display:block;width:100%;height:100%;touch-action:none;cursor:grab}
    #itemLabMsg{position:fixed;left:12px;bottom:10px;font:500 13px/1.3 Fredoka,system-ui,sans-serif;color:#5a6488;pointer-events:none}`;
  document.head.appendChild(st);
  const cv = document.createElement("canvas"); cv.id = "itemLab"; document.body.appendChild(cv);
  const msg = document.createElement("div"); msg.id = "itemLabMsg"; document.body.appendChild(msg);
  document.body.classList.add("itemlab");
  const R = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  R.setPixelRatio(Math.min(2, devicePixelRatio || 1)); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color("#eef3ff");
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa0b4d6, 1.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(2.5, 5, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1 }); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffe6f4, .6); fill.position.set(-4, 2, 3); scene.add(fill);
  const back = new THREE.DirectionalLight(0xdfe8ff, .7); back.position.set(0, 3, -5); scene.add(back);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.5, 64), new THREE.MeshStandardMaterial({ color: "#dfe6fb", roughness: .9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.56, 64), new THREE.MeshBasicMaterial({ color: "#c3cdf0" })); ring.rotation.x = -Math.PI / 2; ring.position.y = .002; scene.add(ring);
  const cam = new THREE.PerspectiveCamera(30, 1, .05, 60); cam.position.set(0, 1.6, 7);
  const orbit = new OrbitControls(cam, cv); orbit.target.set(0, 1.15, 0); orbit.enableDamping = true; orbit.dampingFactor = .12; orbit.minDistance = .8; orbit.maxDistance = 14;
  const gizmo = new TransformControls(cam, cv); gizmo.setSpace("local"); gizmo.setSize(.8); scene.add(gizmo);
  gizmo.addEventListener("dragging-changed", (e) => { orbit.enabled = !e.value; if (!e.value) send(true); });
  // the arrows sit on a handle in the middle of the item (its own centre is often far away, at the body's or the head's);
  // the item keeps the same place relative to the handle, so turning and sizing happen around its middle
  const handle = new THREE.Object3D(), rel = new THREE.Matrix4(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
  gizmo.addEventListener("objectChange", () => {
    if (!S.obj) return;
    if (gizmo.getMode() === "scale") { const k = (handle.scale.x + handle.scale.y + handle.scale.z) / 3; handle.scale.setScalar(k); }
    handle.updateMatrix(); _m.multiplyMatrices(handle.matrix, rel); _m.decompose(S.obj.position, _q, S.obj.scale); S.obj.rotation.setFromQuaternion(_q, S.obj.rotation.order);
    send(false); });
  function grab(o) {   // put the handle in the middle of item o (in o's parent space) and remember how they sit
    o.parent.add(handle); o.updateMatrixWorld(true);
    const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()); o.parent.worldToLocal(c);
    handle.position.copy(c); handle.quaternion.copy(o.quaternion); handle.scale.copy(o.scale); handle.updateMatrix(); o.updateMatrix();
    rel.copy(handle.matrix).invert().multiply(o.matrix); gizmo.attach(handle); }

  const S = { slot: null, i: -1, look: {}, char: null, obj: null, init: null, fix0: null, sentT: 0 };
  const post = (m) => { try { parent.postMessage(m, location.origin); } catch (e) {} };
  // what the item's fix is now: the fix it had when shown, plus what was dragged since
  function fixNow() {
    const o = S.obj, I = S.init, f = S.fix0 || {};
    if (!o) return null;
    const p0 = f.p || [0, 0, 0], r0 = f.r || [0, 0, 0], s0 = f.s || 1;
    return { p: [r4(p0[0] + o.position.x - I.p.x), r4(p0[1] + o.position.y - I.p.y), r4(p0[2] + o.position.z - I.p.z)],
      r: [r4(r0[0] + o.rotation.x - I.r.x), r4(r0[1] + o.rotation.y - I.r.y), r4(r0[2] + o.rotation.z - I.r.z)], s: r4(s0 * o.scale.x / I.s) };
  }
  function send(done) {
    const f = fixNow(); if (!f) return;
    const now = performance.now(); if (!done && now - S.sentT < 60) return; S.sentT = now;
    const it = OUTFIT_PARTS[S.slot][S.i]; it.fix = f; const base = OUTFIT_OBJ[S.slot][S.i]; fixApply(S.slot, S.i, base);   // (the next copy starts from here)
    post({ t: "fix", fix: f, done });
  }
  // the item: (re)build the Jumpi wearing it
  function show(keepView) {
    if (S.char) { gizmo.detach(); scene.remove(S.char.root); S.char = null; S.obj = null; }
    const it = OUTFIT_PARTS[S.slot] && OUTFIT_PARTS[S.slot][S.i];
    if (!it) { msg.textContent = "No such item."; return; }
    const look = { color: 0, eyes: 1, hair: -1, shirt: -1, pants: -1, glasses: -1, hat: -1, neck: -1, beard: -1, tag: -1, aura: -1, ...S.look, [S.slot]: S.i };
    const C = makeCharacter(look, "");
    C.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(C.root); S.char = C;
    let obj = null; C.root.traverse((o) => { if (!obj && o.userData.outfit === `${S.slot}:${S.i}`) obj = o; });
    S.obj = MOVABLE.has(S.slot) ? obj : null;
    if (S.obj) { S.init = { p: S.obj.position.clone(), r: S.obj.rotation.clone(), s: S.obj.scale.x }; S.fix0 = it.fix ? JSON.parse(JSON.stringify(it.fix)) : null; grab(S.obj); }
    msg.textContent = S.obj ? "Drag to look around · drag the arrows, rings or box to move, turn or size it" : MOVABLE.has(S.slot) ? "" : "Shirts and pants are painted on: they can't be moved";
    if (!keepView) view("fit");
  }
  function view(v) {
    const box = new THREE.Box3();
    if (S.obj && v === "fit") box.setFromObject(S.obj); else if (S.char) box.setFromObject(S.char.root); else box.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2.4, 1));
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()), d = Math.max(v === "fit" ? 5 : 7.5, Math.max(sz.x, sz.y, sz.z) * 5);
    // "fit": look at the item from its side of the body (a jetpack from behind, glasses from the front)
    const behind = v === "fit" && S.char && c.z < new THREE.Box3().setFromObject(S.char.root).getCenter(new THREE.Vector3()).z - .05;
    const dir = { front: [0, .15, 1], fit: [.6, .3, behind ? -1 : 1], side: [1, .1, 0], back: [0, .15, -1], top: [0, 1, .02] }[v] || [.6, .3, 1];
    orbit.target.copy(c); cam.position.copy(c).add(new THREE.Vector3(...dir).normalize().multiplyScalar(d));
  }
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || e.source !== parent) return;
    const m = e.data || {};
    if (m.t === "show") {
      const L = OUTFIT_PARTS[m.slot]; if (!L) return;
      if (m.item) { while (L.length < m.i) L.push(PLACEHOLDER); L[m.i] = { ...m.item }; outfitDrop(m.slot, m.i); }
      else if (m.from != null && L[m.from]) {   // a new item, not saved yet: the look of item "from" with the panel's changes
        while (L.length < m.i) L.push(PLACEHOLDER); const { fix, fixPanel, ...look } = L[m.from];
        L[m.i] = { ...look, ...(m.patch || {}), custom: true, ...(m.fix ? { fix: m.fix } : {}) }; outfitDrop(m.slot, m.i);
      } else if (m.patch && L[m.i]) { L[m.i] = { ...L[m.i], ...m.patch }; outfitDrop(m.slot, m.i); }
      const same = S.slot === m.slot && S.i === m.i;
      S.slot = m.slot; S.i = m.i; S.look = m.look || {}; show(same && !m.refit);
    } else if (m.t === "fix" && S.slot) {
      const it = OUTFIT_PARTS[S.slot][S.i]; if (!it) return;
      it.fix = m.fix || null; const base = OUTFIT_OBJ[S.slot][S.i]; if (base) fixApply(S.slot, S.i, base); show(true);
    } else if (m.t === "mode") gizmo.setMode(m.m);
    else if (m.t === "view") view(m.v);
  });
  function size() { const w = innerWidth, h = innerHeight; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  addEventListener("resize", size); size();
  R.setAnimationLoop(() => { orbit.update(); R.render(scene, cam); });
  // for tests: where the handle is on the screen
  if (new URLSearchParams(location.search).has("labdebug")) window.__lab = { handle: () => { const v = handle.getWorldPosition(new THREE.Vector3()).project(cam); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; } };
  post({ t: "ready" });
}
