/*
  The Item studio's 3D view (admin panel → Item studio opens /play?game&itemlab in a frame).
  One Jumpi on a little stage, wearing the item being worked on. Drag around to look (mouse: left turns, right moves,
  wheel zooms); the arrows / rings / box on the item move, turn and size it. The panel talks to this page with messages
  (same site only):
    panel → here: {t:"show", slot, i, look, refit?, from?, patch?, fix?}  the item; from: a new one (not saved yet) that looks
                  like item "from"; patch: changed colours / names (also for an item made before)
                  {t:"fix", fix}  where it sits ({p:[x,y,z], r:[x,y,z], s}), from the panel's number fields
                  {t:"mode", m:"translate"|"rotate"|"scale"}   {t:"view", v:"front"|"side"|"back"|"top"|"fit"}
                  {t:"select", parts:["3"]}  move only those parts ([] = the whole item)
    here → panel: {t:"ready"}  {t:"fix", fix, done}  (while the item is dragged here, and when it is let go)
                  {t:"sel", parts, count}  what is picked (parts of the item, [] = all of it) and how many parts it has
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
  gizmo.addEventListener("dragging-changed", (e) => { orbit.enabled = !e.value; if (!e.value) { send(true); grab(); } });

  /* What is being moved: the whole item, or some of its parts on their own (click a part; shift + click adds more;
     click beside the item = the whole item again). A part = a direct child of the item (a jetpack: the pack, each strap).
     The arrows sit on a handle in the middle of what is picked; each picked piece keeps its place relative to the handle,
     so turning and sizing happen around their middle. */
  const S = { slot: null, i: -1, look: {}, char: null, obj: null, sel: [], targets: [], F: null, sentT: 0 };
  const handle = new THREE.Object3D(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
  const boxes = [];
  const clone = (f) => (f ? JSON.parse(JSON.stringify(f)) : null);
  const fixOf = (F, key) => (key === "" ? F || {} : (F && F.parts && F.parts[key]) || {});
  gizmo.addEventListener("objectChange", () => {
    if (!S.targets.length) return;
    if (gizmo.getMode() === "scale") { const k = (handle.scale.x + handle.scale.y + handle.scale.z) / 3; handle.scale.setScalar(k); }
    handle.updateMatrix();
    for (const T of S.targets) { _m.multiplyMatrices(handle.matrix, T.rel); _m.decompose(T.o.position, _q, T.o.scale); T.o.rotation.setFromQuaternion(_q, T.o.rotation.order); }
    boxes.forEach((b) => b.update()); send(false); });
  function grab() {
    gizmo.detach(); boxes.splice(0).forEach((b) => b.removeFromParent());
    if (!S.obj) return;
    const whole = !S.sel.length, objs = whole ? [S.obj] : S.sel.map((k) => S.obj.children[+k]).filter(Boolean);
    const space = whole ? S.obj.parent : S.obj;
    space.add(handle); S.obj.updateMatrixWorld(true);
    const box = new THREE.Box3(); objs.forEach((o) => box.expandByObject(o));
    const c = box.getCenter(new THREE.Vector3()); space.worldToLocal(c);
    handle.position.copy(c);
    if (objs.length === 1) { handle.quaternion.copy(objs[0].quaternion); handle.scale.copy(objs[0].scale); } else { handle.quaternion.identity(); handle.scale.set(1, 1, 1); }
    handle.updateMatrix();
    S.targets = objs.map((o) => { o.updateMatrix(); const key = whole ? "" : String(S.obj.children.indexOf(o));
      return { o, key, rel: handle.matrix.clone().invert().multiply(o.matrix), init: { p: o.position.clone(), r: o.rotation.clone(), s: o.scale.x }, f0: clone(fixOf(S.F, key)) }; });
    if (!whole) objs.forEach((o) => { const b = new THREE.BoxHelper(o, 0xff9a1f); scene.add(b); boxes.push(b); });
    gizmo.attach(handle);
  }
  const post = (m) => { try { parent.postMessage(m, location.origin); } catch (e) {} };
  // the whole fix now: what it was when picked, plus what was dragged since
  function fixNow() {
    const F = clone(S.F) || {};
    for (const T of S.targets) {
      const o = T.o, I = T.init, f = T.f0 || {}, p0 = f.p || [0, 0, 0], r0 = f.r || [0, 0, 0], s0 = f.s || 1;
      const one = { p: [r4(p0[0] + o.position.x - I.p.x), r4(p0[1] + o.position.y - I.p.y), r4(p0[2] + o.position.z - I.p.z)],
        r: [r4(r0[0] + o.rotation.x - I.r.x), r4(r0[1] + o.rotation.y - I.r.y), r4(r0[2] + o.rotation.z - I.r.z)], s: r4(s0 * o.scale.x / I.s) };
      if (T.key === "") { const parts = F.parts; Object.keys(F).forEach((k) => delete F[k]); Object.assign(F, one); if (parts) F.parts = parts; }
      else (F.parts ||= {})[T.key] = one;
    }
    return F;
  }
  function send(done) {
    if (!S.targets.length) return;
    const now = performance.now(); if (!done && now - S.sentT < 60) return; S.sentT = now;
    const F = fixNow(); if (done) S.F = F;
    const it = OUTFIT_PARTS[S.slot][S.i]; it.fix = F; const base = OUTFIT_OBJ[S.slot][S.i]; fixApply(S.slot, S.i, base);   // (the next copy starts from here)
    post({ t: "fix", fix: F, done });
  }
  const nParts = () => (S.obj ? S.obj.children.filter((c) => c !== handle).length : 0);   // (the handle itself may sit in the item while parts are picked)
  function tellSel() { post({ t: "sel", parts: S.sel.slice(), count: nParts() }); }
  // the item: (re)build the Jumpi wearing it
  function show(keepView) {
    if (S.char) { gizmo.detach(); boxes.splice(0).forEach((b) => b.removeFromParent()); scene.remove(S.char.root); S.char = null; S.obj = null; S.targets = []; }
    const it = OUTFIT_PARTS[S.slot] && OUTFIT_PARTS[S.slot][S.i];
    if (!it) { msg.textContent = "No such item."; return; }
    const look = { color: 0, eyes: 1, hair: -1, shirt: -1, pants: -1, glasses: -1, hat: -1, neck: -1, beard: -1, tag: -1, aura: -1, ...S.look, [S.slot]: S.i };
    const C = makeCharacter(look, "");
    C.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(C.root); S.char = C;
    let obj = null; C.root.traverse((o) => { if (!obj && o.userData.outfit === `${S.slot}:${S.i}`) obj = o; });
    S.obj = MOVABLE.has(S.slot) ? obj : null; S.F = clone(it.fix);
    if (S.obj) S.sel = S.sel.filter((k) => S.obj.children[+k]);
    grab(); tellSel();
    msg.textContent = S.obj ? "Drag to look around · drag the arrows, rings or box to move, turn or size it · click a part to move only that part (shift: more parts)" : MOVABLE.has(S.slot) ? "" : "Shirts and pants are painted on: they can't be moved";
    if (!keepView) view("fit");
  }
  // clicking: a part of the item (a click, not a drag; not on the arrows)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  cv.addEventListener("pointerdown", (e) => { down = gizmo.axis ? null : [e.clientX, e.clientY]; });
  cv.addEventListener("pointerup", (e) => {
    if (!down || !S.obj || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return; down = null;
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObject(S.obj, true).find((h) => h.object.visible && !h.object.isLine);
    let key = null;
    if (hit) { let o = hit.object; while (o && o.parent !== S.obj) o = o.parent; if (o && o.parent === S.obj && o !== handle && nParts() > 1) key = String(S.obj.children.indexOf(o)); }
    if (key === null) S.sel = [];
    else if (e.shiftKey) S.sel = S.sel.includes(key) ? S.sel.filter((k) => k !== key) : [...S.sel, key];
    else S.sel = [key];
    grab(); tellSel();
  });
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
      if (!same) S.sel = [];
      S.slot = m.slot; S.i = m.i; S.look = m.look || {}; show(same && !m.refit);
    } else if (m.t === "select") { S.sel = (m.parts || []).map(String); grab(); tellSel();
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
  if (new URLSearchParams(location.search).has("labdebug")) window.__lab = { handle: () => { const v = handle.getWorldPosition(new THREE.Vector3()).project(cam); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; },
    part: (k) => { const o = S.obj && S.obj.children[k]; if (!o) return null; const v = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(cam); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; } };
  post({ t: "ready" });
}
