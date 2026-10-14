/*
  Moving eyes (the shop's animated eyes, EYE_COLORS entries with an anim in public/index.html):
    cat      the pupil is a slit that slowly widens and narrows
    look     every few seconds the eyes look to one side, then the other
    hearts   pink hearts instead of pupils, beating
    stars    golden stars instead of pupils, twinkling
    sleepy   half-closed eyes that now and then nearly close
    rainbow  the colour of the eyes keeps changing
    wink     every few seconds one eye winks
  Every character is a copy with its own eye meshes, so the moves are done in onBeforeRender of each eye mesh: the mesh's
  world matrix is adjusted just before it is drawn (after the game has placed and blinked the eyes as usual).
  installEyeFx(n, kind, THREE): n = {eyeL, eyeR, lookL, lookR}; kind = null removes it.
*/
let SHAPES = null;
function shapes(THREE) {
  if (SHAPES) return SHAPES;
  const heart = new THREE.Shape();
  heart.moveTo(0, -0.9); heart.bezierCurveTo(-0.2, -0.6, -1, -0.25, -1, 0.3); heart.bezierCurveTo(-1, 0.95, -0.25, 1.05, 0, 0.55);
  heart.bezierCurveTo(0.25, 1.05, 1, 0.95, 1, 0.3); heart.bezierCurveTo(1, -0.25, 0.2, -0.6, 0, -0.9);
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.42 : 1; i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  SHAPES = {
    heart: new THREE.ShapeGeometry(heart, 16), star: new THREE.ShapeGeometry(star),
    heartM: new THREE.MeshStandardMaterial({ color: "#e8174f", emissive: "#c8103e", emissiveIntensity: 0.45, roughness: 0.3 }),
    starM: new THREE.MeshStandardMaterial({ color: "#ffd23a", emissive: "#ffb300", emissiveIntensity: 0.5, roughness: 0.25 }),
  };
  return SHAPES;
}
const now = () => performance.now() / 1000;
// the matrix the game gave this mesh (if a pass already drew it this frame, its world matrix is still the adjusted one)
// (kept outside userData: characters are copied with clone(), which turns userData into plain JSON)
const FX = new WeakMap();   // mesh -> {inM, outM, keep, vis}
const fxOf = (o) => { let f = FX.get(o); if (!f) FX.set(o, (f = {})); return f; };
function trueWorld(o) { const u = FX.get(o); if (u && u.outM && u.inM && o.matrixWorld.equals(u.outM)) o.matrixWorld.copy(u.inM); return o.matrixWorld; }
const ease = (x) => x * x * (3 - 2 * x);
// 0..1..0 bump while u is inside [a, b]
const bump = (u, a, b) => (u < a || u > b ? 0 : Math.sin(((u - a) / (b - a)) * Math.PI));

export function installEyeFx(n, kind, THREE) {
  if (!n || !n.eyeL || !n.lookL) return;
  // take the old one off
  if (n.eyeFx) { n.eyeFx.meshes.forEach((m) => { const f = fxOf(m); m.onBeforeRender = f.keep || function () {}; if (f.vis !== undefined) { m.visible = f.vis; f.vis = undefined; } if (f.inM && f.outM && m.matrixWorld.equals(f.outM)) m.matrixWorld.copy(f.inM); f.inM = f.outM = null; }); n.eyeFx.extra.forEach((o) => o.removeFromParent()); n.eyeFx = null; }
  if (!kind) return;
  const S = shapes(THREE), seed = Math.random() * 100, fx = { meshes: [], extra: [] };
  const _E = new THREE.Matrix4(), _L = new THREE.Matrix4(), _M = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _t1 = new THREE.Matrix4(), _t2 = new THREE.Matrix4();
  // per side and frame: E = a squash of the whole eye (sleepy, wink), L = where the iris looks (look)
  const frameState = (side) => {
    const t = now() + seed, st = { sy: 1, lx: 0 };
    if (kind === "sleepy") { const u = t % 7; st.sy = 0.55 - 0.4 * bump(u, 5.2, 6.4); }
    if (kind === "wink" && side > 0) { const u = t % 4.5; st.sy = 1 - 0.92 * bump(u, 3.6, 4.1); }
    if (kind === "look") { const u = t % 5; st.lx = ease(bump(u, 0.8, 2.2)) * -1 + ease(bump(u, 2.6, 4.0)); }
    return st;
  };
  const sides = [[n.eyeL, n.lookL, -1], [n.eyeR, n.lookR, 1]];
  sides.forEach(([eye, look, side]) => {
    if (!eye || !look) return;
    const pupil = look.children.find((c) => c.isMesh && c.material && c.material.name === "Pupil");
    const iris = look.children.find((c) => c.isMesh && c.material && c.material.name === "Iris");
    let pc = new THREE.Vector3(), pr = 0.05;
    if (pupil) { pupil.geometry.computeBoundingSphere(); pc = pupil.geometry.boundingSphere.center.clone(); pr = pupil.geometry.boundingSphere.radius; }
    // hearts / stars sit where the pupil is, facing out of the eye
    if ((kind === "hearts" || kind === "stars") && pupil) {
      const m = new THREE.Mesh(kind === "hearts" ? S.heart : S.star, kind === "hearts" ? S.heartM : S.starM);
      const out = pc.clone().add(look.position).normalize();   // from the eye's centre through the pupil (eye space ~ look space: no rotation)
      m.position.copy(pc).addScaledVector(out, 0.045); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), out);
      const k = pr * (kind === "hearts" ? 1.05 : 1.25); m.scale.setScalar(k); fxOf(m).size = k; m.userData.eyeFxPart = true; m.userData.base = true; m.renderOrder = 2;
      look.add(m); fx.extra.push(m);
      fxOf(pupil).vis = pupil.visible; pupil.visible = false; fx.meshes.push(pupil);
    }
    let cache = { t: -1, st: null };
    const stateNow = () => { const t = now(); if (cache.t !== t) cache = { t, st: frameState(side) }; return cache.st; };
    const meshes = [];
    eye.traverse((o) => { if (o.isMesh) meshes.push(o); });
    meshes.forEach((m) => {
      const inLook = m !== eye && (m.parent === look || m.parent?.parent === look);
      const isPupil = m === pupil, isOverlay = fx.extra.includes(m), isIris = m === iris;
      fxOf(m).keep = m.onBeforeRender;
      m.onBeforeRender = function () {
        const st = stateNow(), t = now() + seed;
        if (isIris && kind === "rainbow") this.material.color.setHSL((t * 0.15) % 1, 0.85, 0.55);
        trueWorld(this);
        const squash = st.sy !== 1, lookOff = inLook && st.lx !== 0;
        let local = null;
        if (isPupil && kind === "cat") { const sx = 0.28 + 0.42 * ease(0.5 + 0.5 * Math.sin(t * 0.7)); local = _M.makeTranslation(pc.x, pc.y, pc.z).multiply(_t1.makeScale(sx, 1.18, 1)).multiply(_t2.makeTranslation(-pc.x, -pc.y, -pc.z)); }
        if (isOverlay) { const k = fxOf(this).size * (kind === "hearts" ? 1 + 0.18 * Math.pow(Math.max(0, Math.sin(t * 7)), 6) : 0.85 + 0.2 * Math.abs(Math.sin(t * 3))); this.scale.setScalar(k); if (kind === "stars") this.rotation.z = Math.sin(t * 2) * 0.35; this.updateMatrix(); this.updateMatrixWorld(); }
        if (!squash && !lookOff && !local) return;
        // world = eyeW · E · L · eyeW⁻¹ · meshW · M
        const eyeW = this === eye ? this.matrixWorld : trueWorld(eye);
        _E.makeScale(1, st.sy, 1);
        if (lookOff) _E.multiply(_L.makeTranslation(st.lx * 0.038, 0, -Math.abs(st.lx) * 0.006));
        _inv.copy(eyeW).invert();
        const w = _t1.copy(eyeW).multiply(_E).multiply(_inv).multiply(this.matrixWorld);
        if (local) w.multiply(local);
        const f = fxOf(this); (f.inM ||= new THREE.Matrix4()).copy(this.matrixWorld);
        this.matrixWorld.copy(w); (f.outM ||= new THREE.Matrix4()).copy(w);
      };
      fx.meshes.push(m);
    });
  });
  n.eyeFx = fx;
}
