/*
  THE ITEM DESIGNER (admin panel → Item designer, or /play?game&itemdesign on its own, full screen).
  A small Blender for Jumpi items: build an item from simple shapes on the Jumpi itself, colour them, and save it as
  a new item (a "recipe": public/world/recipe.js, checked by the server in public/shared/recipe-spec.js).
  New designs are saved as "not sold": their price, rarity and shop are set in the Item studio, where "a new item from
  this" also makes colour versions (the design's 3 colours are the item's c1 / c2 / c3).
  Saving needs the admin panel to be unlocked (the same /api/admin checks as the rest of the panel).
  Keys: G move · R turn · S size · Shift+D copy · M mirror copy · X / Delete delete · A all · Esc none · F focus
        1 front · 3 side · 7 top · Ctrl+Z / Ctrl+Shift+Z undo / redo · Ctrl+S save · H show / hide the Jumpi
*/
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { SHAPES, FLAT_KINDS, FINISHES, COLOR_KEYS, MAX_PARTS, shapeArgs, partMesh } from "/world/recipe.js";

const SLOTS = { hat: "Hat", glasses: "Glasses", hair: "Hair", beard: "Beard", neck: "Neck & back" };
const DEF_ANCHOR = { hat: "head", glasses: "head", hair: "head", beard: "head", neck: "body" };
const r4 = (n) => Math.round(n * 10000) / 10000, deg = (r) => Math.round(r * 1800 / Math.PI) / 10, rad = (d) => d * Math.PI / 180;
const ICON = {
  box: '<rect x="5" y="5" width="14" height="14" rx="3"/>', sphere: '<circle cx="12" cy="12" r="7.5"/>', hemi: '<path d="M4 15a8 8 0 0 1 16 0z"/>',
  cyl: '<ellipse cx="12" cy="6" rx="6" ry="2.4"/><path d="M6 6v12c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4V6"/>', cone: '<path d="M12 3 5 19c2 2 12 2 14 0z"/>',
  capsule: '<rect x="8" y="3" width="8" height="18" rx="4"/>', torus: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
  flat: '<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ""}</svg>`;

export function startDesigner(G) {
  const { THREE, makeCharacter, OUTFIT_PARTS } = G;
  /* ---------- the page ---------- */
  const st = document.createElement("style");
  st.textContent = CSS; document.head.appendChild(st);
  document.body.classList.add("itemdesign");
  const root = document.createElement("div"); root.id = "dz"; document.body.appendChild(root);
  root.innerHTML = `
  <header class="dz-top">
    <b class="dz-logo">Jumpi <i>Designer</i></b>
    <div class="dz-menu"><button data-a="new">New</button><button data-a="open">Open…</button><button data-a="save" class="dz-pri">Save</button><button data-a="saveas">Save as new</button></div>
    <label class="dz-f">Worn as <select id="dzSlot">${Object.entries(SLOTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
    <label class="dz-f">On the <select id="dzAnchor"><option value="head">head</option><option value="body">body</option></select></label>
    <span class="dz-sp"></span>
    <button data-a="undo" title="Undo (Ctrl+Z)">↶</button><button data-a="redo" title="Redo (Ctrl+Shift+Z)">↷</button>
    <button data-a="full" title="Full screen">⛶</button>
    <span class="dz-doc" id="dzDoc"></span>
  </header>
  <nav class="dz-tools">
    <button data-m="translate" class="on" title="Move (G)"><svg viewBox="0 0 24 24"><path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/></svg></button>
    <button data-m="rotate" title="Turn (R)"><svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg></button>
    <button data-m="scale" title="Size (S)"><svg viewBox="0 0 24 24"><path d="M4 20 20 4M14 4h6v6M4 14v6h6"/></svg></button>
    <hr><button data-a="dup" title="Copy (Shift+D)"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg></button>
    <button data-a="mirror" title="Mirror copy, left ↔ right (M)"><svg viewBox="0 0 24 24"><path d="M12 3v18M9 7 4 12l5 5zM15 7l5 5-5 5z"/></svg></button>
    <button data-a="del" title="Delete (X)"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg></button>
  </nav>
  <aside class="dz-out">
    <h3>Add a shape</h3>
    <div class="dz-add">${Object.entries(SHAPES).map(([k, v]) => `<button data-add="${k}" title="${v.name}">${svg(k)}<span>${v.name}</span></button>`).join("")}</div>
    <h3>Shapes <small id="dzCount"></small></h3>
    <ul class="dz-list" id="dzList"></ul>
  </aside>
  <main class="dz-view"><canvas id="dzCv"></canvas>
    <div class="dz-ov"><button data-v="front">Front</button><button data-v="side">Side</button><button data-v="back">Back</button><button data-v="top">Top</button><button data-v="focus">Focus</button>
      <label><input type="checkbox" id="dzJumpi" checked> Jumpi</label><label><input type="checkbox" id="dzGrid" checked> Grid</label></div>
  </main>
  <aside class="dz-props" id="dzProps"></aside>
  <footer class="dz-foot"><span id="dzHint">Add a shape, then drag the arrows. Left drag: look around · right drag: slide the view · wheel: zoom · click a shape to pick it, Shift+click for more</span><span class="dz-sp"></span><span id="dzMsg"></span></footer>
  <div class="dz-modal" id="dzModal" hidden><div class="dz-card" id="dzCard"></div></div>`;
  const $ = (s) => root.querySelector(s);

  /* ---------- the document ---------- */
  const D = { slot: "hat", i: null, name: "", he: "", hideHair: false, recipe: { v: 1, anchor: "head", parts: [], colors: { c1: "#ff5fa8", c2: "#ffd23a", c3: "#3fb8ff" } } };
  let sel = [], hist = [], hp = -1, saved = "";
  const snap = () => JSON.stringify({ slot: D.slot, name: D.name, he: D.he, hideHair: D.hideHair, recipe: D.recipe });
  function commit() { const s = snap(); if (hist[hp] === s) return; hist = hist.slice(0, hp + 1); hist.push(s); if (hist.length > 120) hist.shift(); hp = hist.length - 1; paintDoc(); }
  function restore(s) { const o = JSON.parse(s); Object.assign(D, o); sel = sel.filter((k) => k < D.recipe.parts.length); rebuild(); paintAll(); }
  const dirty = () => snap() !== saved;

  /* ---------- the 3D view ---------- */
  const cv = $("#dzCv");
  const R = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  R.setPixelRatio(Math.min(2, devicePixelRatio || 1)); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color("#3a3a3a");
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8c95a8, 1.45));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(2.5, 6, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 4, bottom: -1 }); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdfe8ff, .7); fill.position.set(-4, 2, -3); scene.add(fill);
  const grid = new THREE.GridHelper(8, 32, 0x5a5a5a, 0x484848); scene.add(grid);
  const axisX = new THREE.Mesh(new THREE.BoxGeometry(8, .006, .006), new THREE.MeshBasicMaterial({ color: 0x9a3b3b })); axisX.position.y = .003; scene.add(axisX);
  const axisZ = new THREE.Mesh(new THREE.BoxGeometry(.006, .006, 8), new THREE.MeshBasicMaterial({ color: 0x3b6b9a })); axisZ.position.y = .003; scene.add(axisZ);
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: .25 })); shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.receiveShadow = true; scene.add(shadowFloor);
  const cam = new THREE.PerspectiveCamera(30, 1, .02, 80); cam.position.set(3, 3, 6);
  const orbit = new OrbitControls(cam, cv); orbit.enableDamping = true; orbit.dampingFactor = .12; orbit.target.set(0, 1.6, 0);
  const gizmo = new TransformControls(cam, cv); gizmo.setSize(.85); scene.add(gizmo);
  let jumpi = null, design = new THREE.Group(), meshes = [], unit = .5;
  const handle = new THREE.Object3D(), boxes = [];
  let rels = [];
  function makeJumpi() {
    if (jumpi) scene.remove(jumpi.root);
    const look = { color: 0, eyes: 1, hair: D.slot === "hair" || D.slot === "hat" ? -1 : 5,   // (hats are made on the bare head: in the game they sit on top of each hair by themselves)
      shirt: 3, pants: 2, glasses: -1, hat: -1, neck: -1, beard: -1, tag: -1, aura: -1 };
    jumpi = makeCharacter(look, ""); jumpi.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(jumpi.root);
    placeDesign(); showJumpi();
  }
  // the head's / body's own box, in the design's space (without the design itself)
  function anchorBox() { const o = D.recipe.anchor === "body" ? jumpi.body : jumpi.head, b = new THREE.Box3(); o.updateMatrixWorld(true);
    o.traverse((m) => { if (m.isMesh && m.visible !== false && !design.getObjectById(m.id) && m.geometry) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); b.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); } });
    b.applyMatrix4(o.matrixWorld.clone().invert()); return [b.min.toArray(), b.max.toArray()]; }
  function placeDesign() {
    const at = D.recipe.anchor === "body" ? jumpi.body : jumpi.head;
    at.add(design); jumpi.root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(D.recipe.anchor === "body" ? jumpi.body : jumpi.head), sz = b.getSize(new THREE.Vector3());
    const ws = at.getWorldScale(new THREE.Vector3()).x || 1; unit = Math.max(sz.x, sz.y) / ws * .28;
  }
  function showJumpi() { const on = $("#dzJumpi").checked; jumpi.root.traverse((o) => { if (o.isMesh && !design.getObjectById(o.id)) o.visible = on; }); }
  function rebuild() {
    gizmo.detach(); design.clear(); meshes = [];
    D.recipe.parts.forEach((p, k) => { const m = partMesh(p, D.recipe.colors, D.recipe); m.userData.k = k; design.add(m); meshes.push(m); });
    if (jumpi) { const want = D.recipe.anchor === "body" ? jumpi.body : jumpi.head; if (design.parent !== want) placeDesign(); }
    pickGizmo();
  }
  // the arrows: on the shape itself, or on a handle in the middle of several
  function pickGizmo() {
    gizmo.detach(); boxes.splice(0).forEach((b) => b.removeFromParent()); rels = [];
    const ms = sel.map((k) => meshes[k]).filter(Boolean);
    ms.forEach((m) => { const b = new THREE.BoxHelper(m, m === ms[ms.length - 1] ? 0xffa53d : 0xd06a1c); scene.add(b); boxes.push(b); });
    if (!ms.length) return;
    if (ms.length === 1) { gizmo.attach(ms[0]); return; }
    design.add(handle); design.updateMatrixWorld(true);
    const box = new THREE.Box3(); ms.forEach((m) => box.expandByObject(m)); const c = box.getCenter(new THREE.Vector3()); design.worldToLocal(c);
    handle.position.copy(c); handle.rotation.set(0, 0, 0); handle.scale.set(1, 1, 1); handle.updateMatrix();
    rels = ms.map((m) => { m.updateMatrix(); return [m, handle.matrix.clone().invert().multiply(m.matrix)]; });
    gizmo.attach(handle);
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
  gizmo.addEventListener("dragging-changed", (e) => { orbit.enabled = !e.value; if (!e.value) { readBack(); commit(); pickGizmo(); paintProps(); } });
  gizmo.addEventListener("objectChange", () => {
    if (gizmo.object === handle) {
      if (gizmo.getMode() === "scale") { const k = (handle.scale.x + handle.scale.y + handle.scale.z) / 3; handle.scale.setScalar(k); }
      handle.updateMatrix(); for (const [m, rel] of rels) { _m.multiplyMatrices(handle.matrix, rel); _m.decompose(m.position, _q, m.scale); m.rotation.setFromQuaternion(_q); }
    }
    boxes.forEach((b) => b.update()); paintTransform(true);
  });
  // the meshes' places back into the recipe
  function readBack() { for (const k of sel) { const m = meshes[k], p = D.recipe.parts[k]; if (!m || !p) continue;
    p.p = m.position.toArray().map(r4); p.r = [m.rotation.x, m.rotation.y, m.rotation.z].map(r4); p.s = m.scale.toArray().map((v) => r4(Math.abs(v) < .005 ? .005 : v)); } }

  /* ---------- picking in the view ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  cv.addEventListener("pointerdown", (e) => { down = gizmo.axis ? null : [e.clientX, e.clientY]; });
  cv.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5 || e.button !== 0) { down = null; return; } down = null;
    const r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects(meshes, false)[0], k = hit ? hit.object.userData.k : -1;
    if (k < 0) { if (!e.shiftKey) select([]); return; }
    if (e.shiftKey) select(sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k]); else select([k]);
  });
  function select(ks) { sel = [...new Set(ks)].filter((k) => k >= 0 && k < D.recipe.parts.length); pickGizmo(); paintList(); paintProps(); }

  /* ---------- actions ---------- */
  function addShape(t) {
    if (D.recipe.parts.length >= MAX_PARTS) return say(`At most ${MAX_PARTS} shapes.`);
    // in front of where the view looks, on the head or the body
    // where the view looks, unless that is inside the head / body: then on top of the head, or in front of the body
    const at = orbit.target.clone(); design.updateMatrixWorld(true); design.worldToLocal(at);
    const [mn, mx] = anchorBox(), inside = at.x > mn[0] && at.x < mx[0] && at.y > mn[1] && at.y < mx[1] && at.z > mn[2] && at.z < mx[2];
    if (inside) { const cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2, cz = (mn[2] + mx[2]) / 2, n = D.recipe.parts.length % 5;
      if (D.recipe.anchor === "body") at.set(cx + (n - 2) * unit * .25, cy, mx[2] + unit * .3); else at.set(cx + (n - 2) * unit * .25, mx[1] + unit * .35, cz); }
    const s = t === "flat" ? [unit, unit, unit] : t === "capsule" ? [unit * 1.4, unit * 1.4, unit * 1.4] : [unit, unit, unit];
    D.recipe.parts.push({ t, p: at.toArray().map(r4), r: [0, 0, 0], s: s.map(r4), c: COLOR_KEYS[D.recipe.parts.length % 3], f: "matte", a: shapeArgs(t, {}) });
    rebuild(); select([D.recipe.parts.length - 1]); commit();
  }
  function duplicate(mirror) {
    if (!sel.length) return;
    if (D.recipe.parts.length + sel.length > MAX_PARTS) return say(`At most ${MAX_PARTS} shapes.`);
    const out = sel.map((k) => { const p = JSON.parse(JSON.stringify(D.recipe.parts[k]));
      if (mirror) { p.p[0] = r4(-p.p[0]); p.r[1] = r4(-p.r[1]); p.r[2] = r4(-p.r[2]); if (p.n) p.n = p.n.replace(/ \((left|right)\)$/, "") + " (mirror)"; }
      else p.p[0] = r4(p.p[0] + unit * .3);
      return p; });
    const from = D.recipe.parts.length; D.recipe.parts.push(...out); rebuild(); select(out.map((_, j) => from + j)); commit();
  }
  function remove() { if (!sel.length) return; D.recipe.parts = D.recipe.parts.filter((_, k) => !sel.includes(k)); sel = []; rebuild(); paintAll(); commit(); }
  function undo() { if (hp > 0) { hp--; restore(hist[hp]); paintDoc(); } }
  function redo() { if (hp < hist.length - 1) { hp++; restore(hist[hp]); paintDoc(); } }
  function view(v) {
    const box = new THREE.Box3();
    const ms = (v === "focus" && sel.length ? sel.map((k) => meshes[k]) : meshes).filter(Boolean);
    if (ms.length) ms.forEach((m) => box.expandByObject(m)); else box.setFromObject(D.recipe.anchor === "body" ? jumpi.body : jumpi.head);
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()), d = Math.max(1.6, Math.max(sz.x, sz.y, sz.z) * 3.2);
    const dir = { front: [0, .1, 1], side: [1, .08, 0], back: [0, .1, -1], top: [0, 1, .001] }[v] || cam.position.clone().sub(orbit.target).normalize().toArray();
    orbit.target.copy(c); cam.position.copy(c).add(new THREE.Vector3(...dir).normalize().multiplyScalar(d));
  }
  function newDoc() {
    if (dirty() && D.recipe.parts.length && !confirm("Start a new design? What isn't saved will be lost.")) return;
    Object.assign(D, { i: null, name: "", he: "", hideHair: false, recipe: { v: 1, anchor: DEF_ANCHOR[D.slot], parts: [], colors: { c1: "#ff5fa8", c2: "#ffd23a", c3: "#3fb8ff" } } });
    sel = []; makeJumpi(); rebuild(); hist = []; hp = -1; commit(); saved = snap(); paintAll(); view("front");
  }
  function openList() {
    const mine = [];
    for (const slot of Object.keys(SLOTS)) (OUTFIT_PARTS[slot] || []).forEach((o, i) => { if (o && o.recipe && !o.placeholder) mine.push({ slot, i, o }); });
    modal(`<h2>Open a design</h2>${mine.length ? `<ul class="dz-open">${mine.map((x, n) => `<li><button data-n="${n}"><b>${esc(x.o.name)}</b><span>${SLOTS[x.slot]} · #${x.i} · ${x.o.recipe.parts.length} shapes</span></button></li>`).join("")}</ul>` : "<p>No designs yet. Save one first.</p>"}<div class="dz-acts"><button data-x>Close</button></div>`,
      (card) => card.querySelectorAll("[data-n]").forEach((b) => (b.onclick = () => { const x = mine[+b.dataset.n]; closeModal(); load(x.slot, x.i, x.o); })));
  }
  function load(slot, i, o) {
    if (dirty() && D.recipe.parts.length && !confirm("Open this design? What isn't saved will be lost.")) return;
    Object.assign(D, { slot, i, name: o.name || "", he: o.he || "", hideHair: !!o.hideHair, recipe: JSON.parse(JSON.stringify(o.recipe)) });
    COLOR_KEYS.forEach((k) => { if (o[k]) D.recipe.colors[k] = o[k]; });
    sel = []; makeJumpi(); rebuild(); hist = []; hp = -1; commit(); saved = snap(); paintAll(); view("focus");
  }
  async function save(asNew) {
    if (!D.recipe.parts.length) return say("Add a shape first.");
    if (!D.name.trim()) { paintProps(); const n = root.querySelector("#dzName"); if (n) n.focus(); return say("Give the item a name (on the right)."); }
    const body = { slot: D.slot, recipe: D.recipe, data: { name: D.name, he: D.he, hideHair: D.hideHair } };
    if (!asNew && D.i != null) body.i = D.i;
    say("Saving…");
    try {
      const r = await fetch("/api/admin/itemdefs/design", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) return say("The admin panel is locked. Unlock it (in the panel's tab) and save again.", true);
      if (r.status === 404 && !d.error) return say("Only the admin panel can save designs.", true);
      if (!r.ok) return say(d.error || "Couldn't save.", true);
      const L = OUTFIT_PARTS[D.slot]; while (L.length < d.i) L.push({ id: "none", name: "", price: 0, gift: "none", placeholder: true });
      L[d.i] = { id: "recipe", recipe: JSON.parse(JSON.stringify(D.recipe)), ...D.recipe.colors, name: D.name, he: D.he, custom: true, ...(L[d.i] && L[d.i].custom ? { price: L[d.i].price, sale: L[d.i].sale } : {}) };
      D.i = d.i; saved = snap(); paintDoc();
      say(body.i == null ? `Saved as a new item: ${SLOTS[D.slot]} #${d.i}. Set its price and shop in the Item studio.` : `Saved ${SLOTS[D.slot]} #${d.i}.`);
      try { parent.postMessage({ t: "designSaved", slot: D.slot, i: d.i }, location.origin); } catch (e) {}
    } catch (e) { say("Can't reach the server.", true); }
  }

  /* ---------- the panels ---------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let sayT = 0;
  function say(t, err) { const m = $("#dzMsg"); m.textContent = t; m.className = err ? "err" : ""; clearTimeout(sayT); sayT = setTimeout(() => { m.textContent = ""; }, 6000); }
  function modal(html, wire) { $("#dzCard").innerHTML = html; $("#dzModal").hidden = false; $("#dzCard").querySelectorAll("[data-x]").forEach((b) => (b.onclick = closeModal)); wire && wire($("#dzCard")); }
  function closeModal() { $("#dzModal").hidden = true; }
  const partName = (p, k) => p.n || `${SHAPES[p.t].name} ${k + 1}`;
  function paintDoc() { $("#dzDoc").textContent = (D.name || "Untitled") + (D.i != null ? ` · ${SLOTS[D.slot]} #${D.i}` : " · not saved yet") + (dirty() ? " •" : ""); $("#dzSlot").value = D.slot; $("#dzAnchor").value = D.recipe.anchor; }
  function paintList() {
    const ul = $("#dzList"); $("#dzCount").textContent = `${D.recipe.parts.length} / ${MAX_PARTS}`;
    ul.innerHTML = D.recipe.parts.map((p, k) => `<li><button data-k="${k}" class="${sel.includes(k) ? "on" : ""}">${svg(p.t)}<span>${esc(partName(p, k))}</span><i style="background:${esc(colorOf(p))}"></i></button></li>`).join("") || `<li class="dz-empty">No shapes yet. Add one above.</li>`;
    ul.querySelectorAll("[data-k]").forEach((b) => (b.onclick = (e) => { const k = +b.dataset.k; if (e.shiftKey) select(sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k]); else select([k]); }));
  }
  const colorOf = (p) => (COLOR_KEYS.includes(p.c) ? D.recipe.colors[p.c] : p.c);
  const num = (id, v, step, min, max) => `<input type="number" id="${id}" value="${Math.round(v * 1000) / 1000}" step="${step}"${min != null ? ` min="${min}"` : ""}${max != null ? ` max="${max}"` : ""}>`;
  function paintProps() {
    const P = $("#dzProps"), one = sel.length === 1 ? D.recipe.parts[sel[0]] : null;
    let h = "";
    if (sel.length) {
      const p = D.recipe.parts[sel[sel.length - 1]], A = shapeArgs(p.t, p.a);
      h += `<section><h3>${sel.length > 1 ? `${sel.length} shapes` : "Shape"}</h3>`;
      if (one) h += `<label class="dz-row">Name <input id="dzPn" maxlength="30" value="${esc(one.n || "")}" placeholder="${esc(partName(one, sel[0]))}"></label>`;
      if (one && p.t === "box") h += `<label class="dz-row">Round <input type="range" id="dzA_round" min="0" max=".5" step=".01" value="${A.round}"></label>`;
      if (one && p.t === "cyl") h += `<label class="dz-row">Top width <input type="range" id="dzA_taper" min="0" max="2" step=".02" value="${A.taper}"></label>`;
      if (one && p.t === "torus") h += `<label class="dz-row">Thickness <input type="range" id="dzA_thick" min=".05" max=".9" step=".01" value="${A.thick}"></label><label class="dz-row">Arc (°) <input type="range" id="dzA_arc" min="10" max="360" step="5" value="${A.arc}"></label>`;
      if (one && p.t === "flat") h += `<label class="dz-row">Shape <select id="dzA_kind">${FLAT_KINDS.map((k) => `<option${k === A.kind ? " selected" : ""}>${k}</option>`).join("")}</select></label><label class="dz-row">Depth <input type="range" id="dzA_depth" min=".02" max="1" step=".01" value="${A.depth}"></label>`;
      h += `</section>`;
      if (one) h += `<section><h3>Transform</h3>
        <div class="dz-xyz"><span>Location</span>${num("dzP0", one.p[0], .01)}${num("dzP1", one.p[1], .01)}${num("dzP2", one.p[2], .01)}</div>
        <div class="dz-xyz"><span>Rotation °</span>${num("dzR0", deg(one.r[0]), 1)}${num("dzR1", deg(one.r[1]), 1)}${num("dzR2", deg(one.r[2]), 1)}</div>
        <div class="dz-xyz"><span>Size</span>${num("dzS0", one.s[0], .01)}${num("dzS1", one.s[1], .01)}${num("dzS2", one.s[2], .01)}</div>
        <div class="dz-xyz dz-lbl"><span></span><i>X</i><i>Y</i><i>Z</i></div>
        <label class="dz-row dz-chk"><input type="checkbox" id="dzLock" ${lockSize ? "checked" : ""}> Same size on all sides</label></section>`;
      const c = p.c;
      h += `<section><h3>Colour and finish</h3><div class="dz-sw">${COLOR_KEYS.map((k, n) => `<button data-c="${k}" class="${c === k ? "on" : ""}" style="--c:${D.recipe.colors[k]}" title="Item colour ${n + 1}">${n + 1}</button>`).join("")}
        <label class="dz-own ${COLOR_KEYS.includes(c) ? "" : "on"}" title="Its own colour (stays the same in colour versions)"><input type="color" id="dzOwn" value="${COLOR_KEYS.includes(c) ? "#ffffff" : c}">Own</label></div>
        <div class="dz-fin">${Object.entries(FINISHES).map(([k, v]) => `<button data-f="${k}" class="${p.f === k ? "on" : ""}">${v}</button>`).join("")}</div>
        <p class="dz-note">Colours 1–3 are the item's colours: colour versions made in the Item studio change them. "Own" stays as it is.</p></section>`;
    } else h += `<section><h3>Nothing picked</h3><p class="dz-note">Click a shape in the view or in the list. Shift + click picks more.</p></section>`;
    h += `<section><h3>Item</h3>
      <label class="dz-row">Name <input id="dzName" maxlength="40" value="${esc(D.name)}" placeholder="English name"></label>
      <label class="dz-row">עברית <input id="dzHe" maxlength="40" dir="rtl" value="${esc(D.he)}" placeholder="השם בעברית"></label>
      <div class="dz-pal">${COLOR_KEYS.map((k, n) => `<label>Colour ${n + 1}<input type="color" data-pal="${k}" value="${D.recipe.colors[k]}"></label>`).join("")}</div>
      ${D.slot === "hat" ? `<label class="dz-row dz-chk"><input type="checkbox" id="dzHide" ${D.hideHair ? "checked" : ""}> Hides the hair under it</label><p class="dz-note">Hats are made on the bare head: in the game they sit on top of each hair by themselves (or hide it, if ticked).</p>` : ""}
      <p class="dz-note">Saved items aren't sold until you set a price and a shop in the Item studio.</p></section>`;
    P.innerHTML = h; wireProps();
  }
  let lockSize = false;
  function wireProps() {
    const P = $("#dzProps"), on = (id, ev, f) => { const e = P.querySelector(id); if (e) e.addEventListener(ev, f); };
    const each = (f) => { sel.forEach((k) => f(D.recipe.parts[k])); };
    on("#dzPn", "change", (e) => { D.recipe.parts[sel[0]].n = e.target.value.trim().slice(0, 30) || undefined; paintList(); commit(); });
    for (const k of ["round", "taper", "thick", "arc", "depth", "kind"]) {
      on("#dzA_" + k, "input", (e) => { const p = D.recipe.parts[sel[0]]; p.a = shapeArgs(p.t, { ...p.a, [k]: k === "kind" ? e.target.value : +e.target.value }); rebuild(); });
      on("#dzA_" + k, "change", () => commit());
    }
    const tf = (id, f) => on(id, "change", (e) => { const p = D.recipe.parts[sel[0]]; f(p, +e.target.value || 0); rebuild(); commit(); paintTransform(); });
    [0, 1, 2].forEach((n) => {
      tf("#dzP" + n, (p, v) => { p.p[n] = r4(v); });
      tf("#dzR" + n, (p, v) => { p.r[n] = r4(rad(v)); });
      tf("#dzS" + n, (p, v) => { const s = Math.max(.005, Math.abs(v)) * Math.sign(v || 1); if (lockSize) { const k = s / (p.s[n] || 1); p.s = p.s.map((x) => r4(x * k)); } else p.s[n] = r4(s); });
    });
    on("#dzLock", "change", (e) => { lockSize = e.target.checked; });
    P.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { each((p) => (p.c = b.dataset.c)); rebuild(); paintList(); paintProps(); commit(); }));
    on("#dzOwn", "input", (e) => { each((p) => (p.c = e.target.value)); rebuild(); paintList(); });
    on("#dzOwn", "change", () => { paintProps(); commit(); });
    P.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { each((p) => (p.f = b.dataset.f)); rebuild(); paintProps(); commit(); }));
    on("#dzName", "input", (e) => { D.name = e.target.value; paintDoc(); }); on("#dzName", "change", () => commit());
    on("#dzHe", "input", (e) => { D.he = e.target.value; }); on("#dzHe", "change", () => commit());
    P.querySelectorAll("[data-pal]").forEach((i) => { i.addEventListener("input", () => { D.recipe.colors[i.dataset.pal] = i.value; rebuild(); paintList(); }); i.addEventListener("change", () => { paintProps(); commit(); }); });
    on("#dzHide", "change", (e) => { D.hideHair = e.target.checked; commit(); });
  }
  // the numbers follow the arrows while dragging
  function paintTransform(live) {
    if (sel.length !== 1) return; const m = meshes[sel[0]]; if (!m) return; const P = $("#dzProps");
    const v = { dzP0: m.position.x, dzP1: m.position.y, dzP2: m.position.z, dzR0: deg(m.rotation.x), dzR1: deg(m.rotation.y), dzR2: deg(m.rotation.z), dzS0: m.scale.x, dzS1: m.scale.y, dzS2: m.scale.z };
    for (const [id, x] of Object.entries(v)) { const e = P.querySelector("#" + id); if (e && e !== document.activeElement) e.value = Math.round(x * 1000) / 1000; }
  }
  function paintAll() { paintDoc(); paintList(); paintProps(); }

  /* ---------- wiring ---------- */
  root.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => addShape(b.dataset.add)));
  root.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => setMode(b.dataset.m)));
  root.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => view(b.dataset.v)));
  const ACT = { new: newDoc, open: openList, save: () => save(false), saveas: () => save(true), undo, redo, dup: () => duplicate(false), mirror: () => duplicate(true), del: remove,
    full: () => { const d = document; if (d.fullscreenElement) d.exitFullscreen(); else d.documentElement.requestFullscreen().catch(() => say("Full screen isn't allowed here: open the designer in its own tab.", true)); } };
  root.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => ACT[b.dataset.a]()));
  function setMode(m) { gizmo.setMode(m); root.querySelectorAll("[data-m]").forEach((b) => b.classList.toggle("on", b.dataset.m === m)); }
  $("#dzSlot").onchange = (e) => { const was = D.slot; D.slot = e.target.value; if (D.i != null && was !== D.slot) { D.i = null; say("Worn somewhere else now: it will be saved as a new item."); } D.recipe.anchor = DEF_ANCHOR[D.slot]; makeJumpi(); rebuild(); paintAll(); commit(); };
  $("#dzAnchor").onchange = (e) => { D.recipe.anchor = e.target.value; rebuild(); paintAll(); commit(); view("focus"); };
  $("#dzJumpi").onchange = showJumpi;
  $("#dzGrid").onchange = (e) => { grid.visible = axisX.visible = axisZ.visible = e.target.checked; };
  $("#dzModal").addEventListener("pointerdown", (e) => { if (e.target.id === "dzModal") closeModal(); });
  addEventListener("keydown", (e) => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || !$("#dzModal").hidden) return;
    const k = e.key.toLowerCase(), c = e.ctrlKey || e.metaKey;
    if (c && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (c && k === "y") { e.preventDefault(); redo(); }
    else if (c && k === "s") { e.preventDefault(); save(false); }
    else if (c) return;
    else if (k === "g") setMode("translate"); else if (k === "r") setMode("rotate"); else if (k === "s") setMode("scale");
    else if (e.shiftKey && k === "d") duplicate(false); else if (k === "m") duplicate(true);
    else if (k === "x" || k === "delete") remove(); else if (k === "a") select(D.recipe.parts.map((_, j) => j)); else if (k === "escape") select([]);
    else if (k === "f") view("focus"); else if (k === "1") view("front"); else if (k === "3") view("side"); else if (k === "7") view("top");
    else if (k === "h") { $("#dzJumpi").checked = !$("#dzJumpi").checked; showJumpi(); }
  });
  addEventListener("beforeunload", (e) => { if (dirty() && D.recipe.parts.length) { e.preventDefault(); e.returnValue = ""; } });
  function size() { const r = cv.parentElement.getBoundingClientRect(); R.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix(); }
  new ResizeObserver(size).observe(cv.parentElement);
  R.setAnimationLoop(() => { orbit.update(); boxes.forEach((b) => b.update()); R.render(scene, cam); });
  makeJumpi(); rebuild(); commit(); saved = snap(); paintAll(); size(); view("front");
  { const o = (new URLSearchParams(location.search).get("open") || "").match(/^([a-z]+):(\d+)$/), it = o && OUTFIT_PARTS[o[1]] && OUTFIT_PARTS[o[1]][+o[2]];
    if (it && it.recipe && SLOTS[o[1]]) load(o[1], +o[2], it); }
  if (new URLSearchParams(location.search).has("labdebug")) window.__dz = { D, select, addShape, rebuild: () => { rebuild(); paintAll(); commit(); }, anchorBox, screenOf: (k) => { const v = new THREE.Box3().setFromObject(meshes[k]).getCenter(new THREE.Vector3()).project(cam), r = cv.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; } };
  try { parent.postMessage({ t: "designReady" }, location.origin); } catch (e) {}
}

const CSS = `
body.itemdesign>*:not(#dz){display:none!important}body.itemdesign{margin:0;overflow:hidden;background:#1d1d1d}
#dz{--bg:#1d1d1d;--pn:#2b2b2b;--pn2:#303030;--in:#1f1f1f;--ln:#3d3d3d;--tx:#d8d8d8;--mu:#8f8f8f;--ac:#4772b3;--or:#ffa53d;
  position:fixed;inset:0;display:grid;grid-template-columns:44px 230px minmax(0,1fr) 290px;grid-template-rows:40px minmax(0,1fr) 24px;
  grid-template-areas:"top top top top" "tools out view props" "foot foot foot foot";background:var(--bg);color:var(--tx);font:13px/1.35 Fredoka,system-ui,sans-serif;user-select:none}
#dz button{font:inherit;color:inherit;cursor:pointer}
#dz input,#dz select{font:inherit;color:var(--tx);background:var(--in);border:1px solid var(--ln);border-radius:5px;padding:3px 6px;min-width:0}
#dz input:focus,#dz select:focus{outline:0;border-color:var(--ac)}
#dz input[type=color]{padding:0;width:34px;height:24px;cursor:pointer}
#dz input[type=range]{padding:0;accent-color:var(--ac);border:0;background:none}
.dz-top{grid-area:top;display:flex;align-items:center;gap:8px;padding:0 10px;background:var(--pn);border-bottom:1px solid #151515}
.dz-logo{font:400 16px "Lilita One",system-ui;color:#fff;letter-spacing:.02em;margin-inline-end:6px}.dz-logo i{font-style:normal;color:var(--or)}
.dz-menu{display:flex;gap:2px}
.dz-top button{background:none;border:0;border-radius:5px;padding:5px 9px}
.dz-top button:hover{background:#3d3d3d}
.dz-top .dz-pri{background:var(--ac);color:#fff}.dz-top .dz-pri:hover{background:#5683c7}
.dz-f{display:flex;align-items:center;gap:6px;color:var(--mu)}
.dz-sp{flex:1}
.dz-doc{color:var(--mu);max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dz-tools{grid-area:tools;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 0;background:var(--pn);border-right:1px solid #151515}
.dz-tools button{width:34px;height:34px;border:0;border-radius:6px;background:none;display:grid;place-items:center}
.dz-tools button:hover{background:#3d3d3d}.dz-tools button.on{background:var(--ac);color:#fff}
.dz-tools svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.dz-tools hr{width:24px;border:0;border-top:1px solid var(--ln);margin:4px 0}
.dz-out,.dz-props{background:var(--pn);overflow:auto;padding:8px}
.dz-out{grid-area:out;border-right:1px solid #151515}.dz-props{grid-area:props;border-left:1px solid #151515}
#dz h3{margin:8px 2px 6px;font:600 11px Fredoka,system-ui;letter-spacing:.08em;text-transform:uppercase;color:var(--mu);display:flex;justify-content:space-between}
#dz h3 small{font-weight:400;letter-spacing:0;text-transform:none}
.dz-add{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.dz-add button{display:grid;justify-items:center;gap:2px;padding:6px 2px;border:1px solid var(--ln);border-radius:6px;background:var(--pn2);font-size:10.5px!important;color:var(--mu)!important}
.dz-add button:hover{border-color:var(--ac);color:var(--tx)!important}
.dz-add svg,.dz-list svg{width:20px;height:20px;fill:#5a5a5a;stroke:#cfcfcf;stroke-width:1.3}
.dz-list{list-style:none;margin:0;padding:0;display:grid;gap:1px}
.dz-list button{width:100%;display:grid;grid-template-columns:20px minmax(0,1fr) 12px;gap:7px;align-items:center;border:0;border-radius:4px;padding:4px 6px;background:none;text-align:start}
.dz-list button:hover{background:#383838}.dz-list button.on{background:#334d75;color:#fff}
.dz-list span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dz-list svg{width:16px;height:16px}
.dz-list i{width:12px;height:12px;border-radius:3px;border:1px solid #000}
.dz-empty{color:var(--mu);padding:6px}
.dz-view{grid-area:view;position:relative;min-width:0;min-height:0;background:#3a3a3a}
#dzCv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.dz-ov{position:absolute;top:8px;left:8px;right:8px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;pointer-events:none}
.dz-ov>*{pointer-events:auto}
.dz-ov button{background:rgb(30 30 30 / .75);border:1px solid #4a4a4a;border-radius:5px;padding:3px 9px}
.dz-ov button:hover{background:#3d3d3d}
.dz-ov label{display:flex;align-items:center;gap:4px;background:rgb(30 30 30 / .75);border:1px solid #4a4a4a;border-radius:5px;padding:2px 8px}
.dz-props section{background:var(--pn2);border:1px solid #262626;border-radius:6px;padding:6px 8px 8px;margin-bottom:8px}
.dz-row{display:grid;grid-template-columns:78px minmax(0,1fr);gap:6px;align-items:center;margin:4px 0;color:var(--mu)}
.dz-chk{display:flex;gap:6px}
.dz-xyz{display:grid;grid-template-columns:68px repeat(3,minmax(0,1fr));gap:3px;align-items:center;margin:3px 0;color:var(--mu)}
.dz-xyz input{width:100%;text-align:center}
.dz-lbl i{font-style:normal;text-align:center;font-size:10px}.dz-lbl i:nth-child(2){color:#e06c6c}.dz-lbl i:nth-child(3){color:#8bd06c}.dz-lbl i:nth-child(4){color:#6c9be0}
.dz-sw{display:flex;gap:4px;align-items:center;margin:4px 0}
.dz-sw button{width:30px;height:26px;border-radius:5px;border:2px solid #222;background:var(--c);color:#000;font-weight:600;text-shadow:0 0 3px #fff}
.dz-sw button.on{border-color:#fff}
.dz-own{display:flex;align-items:center;gap:4px;padding:1px 6px 1px 1px;border:2px solid transparent;border-radius:6px;color:var(--mu)}.dz-own.on{border-color:#fff;color:var(--tx)}
.dz-fin{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}
.dz-fin button{border:1px solid var(--ln);background:var(--in);border-radius:5px;padding:3px 8px}
.dz-fin button.on{background:var(--ac);border-color:var(--ac);color:#fff}
.dz-pal{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin:6px 0}
.dz-pal label{display:grid;justify-items:center;gap:2px;color:var(--mu);font-size:11px}
.dz-note{margin:6px 0 0;color:var(--mu);font-size:11.5px}
.dz-foot{grid-area:foot;display:flex;align-items:center;gap:8px;padding:0 10px;background:var(--ac);color:#e8efff;font-size:11.5px;white-space:nowrap;overflow:hidden}
#dzMsg.err{color:#ffd0d0;font-weight:600}
.dz-modal{position:fixed;inset:0;background:rgb(0 0 0 / .55);display:grid;place-items:center;z-index:5}
.dz-modal[hidden]{display:none}
.dz-card{width:min(460px,92vw);max-height:80vh;overflow:auto;background:var(--pn);border:1px solid #151515;border-radius:10px;padding:16px;box-shadow:0 20px 50px rgb(0 0 0 / .5)}
.dz-card h2{margin:0 0 10px;font:400 18px "Lilita One",system-ui;color:#fff}
.dz-open{list-style:none;margin:0;padding:0;display:grid;gap:4px}
.dz-open button{width:100%;display:grid;text-align:start;gap:1px;border:1px solid var(--ln);border-radius:6px;background:var(--pn2);padding:7px 10px}
.dz-open button:hover{border-color:var(--ac)}.dz-open span{color:var(--mu);font-size:11.5px}
.dz-acts{display:flex;justify-content:flex-end;margin-top:10px}.dz-acts button{border:1px solid var(--ln);background:var(--pn2);border-radius:5px;padding:5px 12px}
@media (max-width:1100px){#dz{grid-template-columns:44px 190px minmax(0,1fr) 250px}}
`;
