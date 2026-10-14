/*
  The autumn 2026 wardrobe: new hats, glasses and neckwear (items in public/shared/items/heads.js).
  HAT_STYLES[id](o, C, H)   C = {g, c1, c2, dark, M, dome, yAt, top, S, mb} from buildHat (head space)
  NECK_STYLES[id](o, C, H)  C = {g, c1, c2, M, loop, front, chain, along, faceFront} from buildNeck (body space)
  GLASSES_STYLES[id](o, g, C, H)  C = {eyeL, eyeR, Y, Z, rrect, ext, rod, starShape, heartShape} (head space)
  Hat / neck builders add to C.g and may return "raw" to skip merging (for parts that move on their own).

  How these are put together:
  - parts are built in little groups and then flatten() bakes them into the item's own space, so buildHat / buildNeck
    (and the glasses here) merge them into a few meshes by material.
  - meshes marked K(mesh) keep their texture coordinates and draw order (merging drops them): they go into a "keep"
    group that is not merged (prints, moving textures, see-through parts).
  - things that move do it through SHARED materials / textures / geometries (H.anim), so every copied character moves
    too: texture offsets and rotations, colours, a small vertex-shader sway (sway()) and, for the floating cloud and
    the diving bubbles, their own geometry going up and down.
*/
let T = null;
const TEX = new Map();
// a cached canvas texture (repeat: [u, v] makes it tile)
function tex(H, key, w, h, draw, repeat) {
  if (TEX.has(key)) return TEX.get(key);
  const t = H.canvasTex(w, h, draw);
  if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...repeat); }
  TEX.set(key, t); return t;
}
const K = m => { m.userData.keep = true; return m; };
const V = (x, y, z) => new T.Vector3(x, y, z);
const mesh = (geo, m, x = 0, y = 0, z = 0) => { const s = new T.Mesh(geo, m); s.position.set(x, y, z); return s; };
// bake every nested mesh into g's own space (so it can be merged); K() meshes go into the "keep" group instead
function flatten(g) {
  g.updateMatrixWorld(true);
  const inv = g.matrixWorld.clone().invert(), list = [];
  let keep = g.children.find(c => c.name === "keep");
  g.traverse(m => { if (m.isMesh && (m.parent !== g || m.userData.keep) && !(keep && m.parent === keep)) list.push(m); });
  if (list.some(m => m.userData.keep) && !keep) { keep = new T.Group(); keep.name = "keep"; g.add(keep); }
  list.forEach(m => {
    const M4 = new T.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    m.parent.remove(m); M4.decompose(m.position, m.quaternion, m.scale);
    (m.userData.keep ? keep : g).add(m);
  });
  const hasMesh = o => { let k = false; o.traverse(q => { if (q.isMesh) k = true; }); return k; };
  g.children.slice().forEach(c => { if (!c.isMesh && !hasMesh(c)) g.remove(c); });
}
// a point on the head surface in the direction d from the head's centre (s = how far out, 1 = on the skin)
function dirPt(H, d, s = 1) {
  const nx = d.x / H.HR[0], ny = d.y / H.HR[1], nz = d.z / H.HR[2], L = Math.hypot(nx, ny, nz);
  const th = Math.acos(Math.max(-1, Math.min(1, ny / L))), ph = Math.atan2(nx, nz);
  return H.hp(th, ph, s);
}
// point an object's +z along n (and its +y along t when given)
function orient(m, n, t) {
  if (!t) { m.quaternion.setFromUnitVectors(V(0, 0, 1), n.clone().normalize()); return m; }
  const z = n.clone().normalize(), x = t.clone().cross(z).normalize(), y = z.clone().cross(x);
  m.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z)); return m;
}
// a closed shape from a list of [x, y] points
function poly(pts) { const s = new T.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; }
function pathOf(pts) { const s = new T.Path(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; }
const ptsOf = (shape, n = 8) => shape.getPoints(n).map(v => [v.x, v.y]);
// points round a centre: r(a) radius at angle a (radians, 0 = +x)
const ring = (r, n = 64, cx = 0, cy = 0, sx = 1) => Array.from({ length: n }, (_, k) => { const a = k / n * Math.PI * 2, R = r(a); return [cx + Math.cos(a) * R * sx, cy + Math.sin(a) * R]; });
const ell = (rx, ry, n = 48, cx = 0, cy = 0) => Array.from({ length: n }, (_, k) => { const a = k / n * Math.PI * 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
// flat shape geometry whose texture coordinates run 0..1 over a w x h box round (cx, cy)
function shapeUV(shape, w, h, cx = 0, cy = 0, seg = 24) {
  const ge = new T.ShapeGeometry(shape, seg), uv = ge.attributes.uv, p = ge.attributes.position;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (p.getX(k) - cx) / w + .5, (p.getY(k) - cy) / h + .5);
  return ge;
}
const thin = (shape, d = .02, b = .006, seg = 16) => new T.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: seg }).translate(0, 0, -d / 2);
const starPts = (R, r, n = 5) => Array.from({ length: n * 2 }, (_, i) => { const a = Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r : R; return [Math.cos(a) * q, Math.sin(a) * q]; });
// a heart outline (s = height to the bottom tip); t from a to b (0..2pi = all of it; pi..2pi = the left half, bottom to top)
const heartPts = (s, n = 40, a = 0, b = Math.PI * 2) => Array.from({ length: n }, (_, k) => { const t = a + (b - a) * k / (b - a === Math.PI * 2 ? n : n - 1); return [s * 16 * Math.sin(t) ** 3 / 17, s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17]; });
// a lumpy ball (pompoms, fur)
function fluff(r, lump = .12, det = 3, seed = 1) {
  const ge = new T.IcosahedronGeometry(r, det), p = ge.attributes.position, v = new T.Vector3();
  for (let k = 0; k < p.count; k++) {
    v.fromBufferAttribute(p, k); const n = v.clone().normalize();
    const f = 1 + lump * (Math.sin(n.x * 9 + seed) * Math.sin(n.y * 11 + seed * 2) * Math.sin(n.z * 10 + seed * 3) + .3 * Math.sin(n.x * 23 + n.y * 19));
    v.copy(n).multiplyScalar(r * f); p.setXYZ(k, v.x, v.y, v.z);
  }
  ge.computeVertexNormals(); return ge;
}
// a vertex-shader sway for a SHARED material: every copy of the item moves together. The part above y0 leans
// sideways (more the higher it is); fast = speed
function sway(H, m, y0, amp, fast, key) {
  const u = { value: 0 };
  m.onBeforeCompile = s => {
    s.uniforms.uSw = u;
    s.vertexShader = "uniform float uSw;\n" + s.vertexShader.replace("#include <begin_vertex>",
      `#include <begin_vertex>\n{float h=max(0.0,position.y-(${y0.toFixed(3)}));float k=h*h*${amp.toFixed(3)};transformed.x+=sin(uSw*${fast.toFixed(2)})*k;transformed.z+=sin(uSw*${(fast * .73).toFixed(2)}+1.3)*k*.5;transformed.y-=abs(sin(uSw*${fast.toFixed(2)}))*k*.25;}`);
  };
  m.customProgramCacheKey = () => "sway" + key + y0.toFixed(3) + amp + fast;
  H.anim(t => { u.value = t; });
  return m;
}
const gold = (H, c = "#ffc21a", e = .15) => H.solid(c, .25, { metalness: .75, emissive: c, emissiveIntensity: e });
const glow = (H, c, e = .8, extra = {}) => H.solid(c, .25, { emissive: c, emissiveIntensity: e, ...extra });

/* ------------------------------------------------------------------ textures ------------------------------------------------------------------ */
const strawTex = (H, col) => tex(H, "straw" + col, 128, 128, (x, w, h) => {
  x.fillStyle = col; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const odd = (i + j) % 2; x.fillStyle = odd ? "rgba(255,255,255,.22)" : "rgba(110,70,10,.16)"; x.fillRect(j * 16 + 1, i * 16 + 1, 14, 14);
    x.strokeStyle = "rgba(90,55,10,.35)"; x.lineWidth = 1.5; x.beginPath(); for (let k = 0; k < 3; k++) { if (odd) { x.moveTo(j * 16 + 3 + k * 5, i * 16 + 2); x.lineTo(j * 16 + 3 + k * 5, i * 16 + 14); } else { x.moveTo(j * 16 + 2, i * 16 + 3 + k * 5); x.lineTo(j * 16 + 14, i * 16 + 3 + k * 5); } } x.stroke();
  }
}, [12, 3]);
const stripeTex = (H, cols, n, key, vertical = true) => tex(H, "stripe" + key, vertical ? 256 : 16, vertical ? 16 : 256, (x, w, h) => {
  for (let i = 0; i < n; i++) { x.fillStyle = cols[i % cols.length]; if (vertical) x.fillRect(i * w / n, 0, w / n + 1, h); else x.fillRect(0, i * h / n, w, h / n + 1); }
});
const starryTex = (H, a, b, key) => tex(H, "starry" + key, 256, 256, (x, w, h) => {
  const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a); gr.addColorStop(1, b); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  let s = 7; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,255,255,${.3 + R() * .6})`; x.beginPath(); x.arc(R() * w, R() * h, .8 + R() * 1.6, 0, 7); x.fill(); }
  for (let i = 0; i < 9; i++) { const cx = R() * w, cy = R() * h, r = 8 + R() * 9; x.fillStyle = i % 3 ? "#ffd23a" : "#ffffff"; x.beginPath();
    for (let k = 0; k < 10; k++) { const an = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r * .42 : r; x.lineTo(cx + Math.cos(an) * q, cy + Math.sin(an) * q); } x.closePath(); x.fill(); }
}, [3, 1]);

/* =================================================================== HATS =================================================================== */
// a thin headband over the top from ear to ear (like the cat ears'); s = how far out from the head
function headband(H, g, m, s = 1.1, r = .035, z = .03) {
  const band = []; for (let t = -1.35; t <= 1.351; t += .15) band.push(H.hp(t, Math.PI / 2, s).add(V(0, 0, z)));
  g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(band), 40, r, 8), m));
}
const lathe = (prof, seg = 48) => new T.LatheGeometry(prof.map(([x, y]) => new T.Vector2(x, y)), seg);
// where an ear sits on a headband: th = how far down from the crown, k = side (-1 / 1)
const earAt = (H, k, th = .58, s = 1.1) => ({ base: H.hp(k * th, Math.PI / 2, s), n: H.hn(k * th, Math.PI / 2) });
const ringFlat = (r, tube, m, y, zs) => { const t = mesh(new T.TorusGeometry(r, tube, 8, 48), m, 0, y, 0); t.rotation.x = Math.PI / 2; t.scale.y = zs; return t; };

export const HAT_STYLES = {
  // a flat-topped straw boater with a ribbon
  boater(o, C, H) {
    T = H.THREE; const { g, yAt } = C, y0 = yAt(.5) - .02;
    const straw = new T.MeshStandardMaterial({ map: strawTex(H, o.col), roughness: .85, side: T.DoubleSide });
    const hat = K(mesh(lathe([[0, .3], [.47, .3], [.5, .28], [.51, .03], [.56, 0], [.88, -.01], [.9, .015], [.87, .03], [.56, .02], [.5, .05]]), straw, 0, y0, 0)); hat.scale.z = .88; g.add(hat);
    const rm = H.solid(o.col2, .5, { side: T.DoubleSide });
    const rib = mesh(new T.CylinderGeometry(.515, .52, .1, 48, 1, true), rm, 0, y0 + .09, 0); rib.scale.z = .88; g.add(rib);
    const bow = new T.Group(); bow.position.set(.44, y0 + .09, -.2); bow.rotation.y = Math.PI / 2 + .45; g.add(bow);
    [-1, 1].forEach(sd => { const l = mesh(new T.SphereGeometry(.07, 12, 8), rm, sd * .07, 0, .02); l.scale.set(1.2, .7, .35); bow.add(l); });
    flatten(g);
  },
  // a wide floppy summer hat with a ribbon tied in a bow at the side
  sunhat(o, C, H) {
    T = H.THREE; const { g, yAt, c1 } = C, y0 = yAt(.52) - .04;
    const ge = lathe([[0, .34], [.3, .33], [.46, .26], [.53, .08], [.56, 0], [.75, -.04], [1.0, -.12], [1.12, -.17], [1.13, -.14], [1.0, -.1], [.75, -.02], [.56, .02], [.52, .05]], 64), p = ge.attributes.position;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k), r = Math.hypot(x, z), a = Math.atan2(x, z); if (r > .6) p.setY(k, p.getY(k) + Math.sin(a * 6) * .045 * (r - .6) / .5 - Math.cos(a) * .05 * (r - .6)); }
    ge.computeVertexNormals(); const hat = mesh(ge, c1, 0, y0, 0); hat.scale.z = .9; g.add(hat);
    const rm = H.solid(o.col2, .5, { side: T.DoubleSide });
    const rib = mesh(new T.CylinderGeometry(.535, .55, .12, 48, 1, true), rm, 0, y0 + .07, 0); rib.scale.z = .9; g.add(rib);
    const bow = new T.Group(); bow.position.set(.5, y0 + .08, .17); bow.rotation.y = Math.PI / 2 - .35; g.add(bow);
    [-1, 1].forEach(sd => { const l = mesh(new T.TorusGeometry(.07, .03, 8, 16), rm, sd * .08, .01, 0); l.scale.set(1.3, .8, .6); bow.add(l);
      const tl = mesh(new T.BoxGeometry(.06, .2, .02), rm, sd * .05, -.12, 0); tl.rotation.z = sd * .3; bow.add(tl); });
    bow.add(mesh(new T.SphereGeometry(.04, 10, 8), rm));
    flatten(g);
  },
  // a farmer's straw hat: round crown, wide frayed brim, a band
  strawhat(o, C, H) {
    T = H.THREE; const { g, yAt } = C, y0 = yAt(.54) - .03;
    const straw = new T.MeshStandardMaterial({ map: strawTex(H, o.col), roughness: .9, side: T.DoubleSide });
    const ge = lathe([[0, .4], [.25, .38], [.42, .3], [.52, .14], [.56, 0], [.8, -.03], [1.0, -.05], [1.04, -.04], [1.0, -.02], [.8, 0], [.57, .03]], 72), p = ge.attributes.position;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k), r = Math.hypot(x, z), a = Math.atan2(x, z); if (r > .95) { const f = 1 + .05 * Math.sin(a * 37) * Math.sin(a * 11 + 1) + .02 * Math.sin(a * 71); p.setX(k, x * f); p.setZ(k, z * f); } }
    ge.computeVertexNormals(); const hat = K(mesh(ge, straw, 0, y0, 0)); hat.scale.z = .9; g.add(hat);
    const band = mesh(new T.CylinderGeometry(.545, .565, .11, 48, 1, true), H.solid(o.col2, .6, { side: T.DoubleSide }), 0, y0 + .07, 0); band.scale.z = .9; g.add(band);
    flatten(g);
  },
  // a little striped circus tent: scalloped trim, a pompom and a flag on top
  circus(o, C, H) {
    T = H.THREE; const { g, yAt } = C, y0 = yAt(.56) - .03, h = .78, zs = .88;
    const tm = new T.MeshStandardMaterial({ map: stripeTex(H, [o.col, "#ffffff"], 12, "circus" + o.col), roughness: .6, side: T.DoubleSide });
    const cone = K(mesh(new T.ConeGeometry(.6, h, 48, 1, true), tm, 0, y0 + h / 2, 0)); cone.scale.z = zs; g.add(cone);
    const trim = H.solid(o.col2, .45), red = H.solid(o.col, .5);
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = Math.sin(a) * .6, z = Math.cos(a) * .6 * zs;
      const b = mesh(new T.SphereGeometry(.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), k % 2 ? trim : red, x, y0 + .01, z); b.lookAt(x * 3, y0 + .01, z * 3); b.rotateX(Math.PI / 2); b.scale.set(1, .55, .8); g.add(b); }
    g.add(ringFlat(.6, .025, trim, y0 + .03, zs));
    g.add(mesh(new T.SphereGeometry(.07, 14, 10), trim, 0, y0 + h + .02, 0));
    g.add(mesh(new T.CylinderGeometry(.012, .012, .32, 6), H.solid("#c9d3e3", .3, { metalness: .6 }), 0, y0 + h + .2, 0));
    const fl = new T.Shape(); fl.moveTo(0, 0); fl.lineTo(.2, -.06); fl.lineTo(0, -.12); fl.closePath();
    g.add(mesh(thin(fl, .01, .003), H.solid(o.col, .5, { side: T.DoubleSide }), .01, y0 + h + .35, 0));
    flatten(g);
  },
  // a fluffy hat: soft knit top, a furry cuff and a big pompom
  furhat(o, C, H) {
    T = H.THREE; const { g, dome, c1, top, S } = C;
    dome(0, 1.32, S * 1.05, c1);
    const fur = H.solid(o.col2, .95);
    g.add(new T.Mesh(H.capGeo(1.45, 1.45, 1.45, S * 1.14, .07, 15, 1.02), fur));
    g.add(mesh(fluff(.22, .14, 3, 2), fur, 0, top + .16, 0));
    flatten(g);
  },
  // three school books stacked on the head with an apple on top
  books(o, C, H) {
    T = H.THREE; const { g, top } = C, pages = H.solid("#fbf6e8", .8);
    let y = top - .05;
    [[.74, .13, .52, o.cols[0], .12], [.66, .11, .48, o.cols[1], -.22], [.56, .1, .42, o.cols[2], .3]].forEach(([w, t, d, col, ry], i) => {
      const b = new T.Group(); b.position.set(i === 1 ? .03 : 0, y + t / 2, i === 2 ? -.02 : 0); b.rotation.y = ry; g.add(b);
      b.add(mesh(new T.BoxGeometry(w, t, d), H.solid(col, .55)));
      b.add(mesh(new T.BoxGeometry(w - .03, t - .035, d + .012), pages, .02, 0, 0));
      b.add(mesh(new T.BoxGeometry(.035, t + .004, d + .004), H.solid(new T.Color(col).lerp(new T.Color("#000"), .25), .55), -w / 2 + .1, 0, 0));
      if (i === 1) b.add(mesh(new T.BoxGeometry(.04, .2, .008), H.solid("#e8423b", .5), .12, -.08, d / 2 + .008));
      y += t;
    });
    const ap = mesh(new T.SphereGeometry(.12, 18, 14), H.solid("#e8423b", .35), -.06, y + .1, 0); ap.scale.set(1, .9, 1); g.add(ap);
    g.add(mesh(new T.CylinderGeometry(.012, .014, .08, 6), H.solid("#6b3f1f", .6), -.06, y + .22, 0));
    const lf = mesh(new T.SphereGeometry(.05, 10, 8), H.solid("#3fbf4a", .5), -.02, y + .23, 0); lf.scale.set(1.5, .4, .8); lf.rotation.z = .4; g.add(lf);
    flatten(g);
  },
  // a wide fabric headband with dots and a knot on top (sits on the hair)
  wideband(o, C, H) {
    T = H.THREE; const { g } = C;
    const dm = new T.MeshStandardMaterial({ roughness: .7, side: T.DoubleSide, map: tex(H, "dots" + o.col + o.col2, 128, 64, (x, w, h) => { x.fillStyle = o.col; x.fillRect(0, 0, w, h); x.fillStyle = o.col2; for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(i * 16 + 8 + (j % 2) * 8, j * 16 + 8, 3.5, 0, 7); x.fill(); } }, [6, 1]) });
    const ge = new T.CylinderGeometry(1, 1, .2, 48, 1, true, Math.PI - 1.5, 3.0).rotateX(Math.PI / 2);
    const b = K(mesh(ge, dm, 0, H.HC.y, .1)); b.scale.set(H.HR[0] * 1.2, H.HR[1] * 1.22, 1); g.add(b);
    const km = H.solid(o.col, .7), kp = H.HC.y + H.HR[1] * 1.22 + .02;
    [-1, 1].forEach(sd => { const l = mesh(new T.SphereGeometry(.09, 14, 10), km, sd * .09, kp, .1); l.scale.set(1.3, .75, 1.1); l.rotation.z = sd * .4; g.add(l); });
    g.add(mesh(new T.SphereGeometry(.06, 12, 10), km, 0, kp + .01, .1));
    flatten(g);
  },
  // a thin headband with a butterfly sitting on one side
  butterflyband(o, C, H) {
    T = H.THREE; const { g } = C; headband(H, g, H.solid(o.col2, .45), 1.1, .03);
    const p = H.hp(.62, .75, 1.25), n = H.hn(.62, .75), bf = new T.Group(); bf.position.copy(p); orient(bf, n, V(0, 1, 0)); bf.scale.setScalar(1.45); g.add(bf);
    const wm = H.solid(o.col, .4, { side: T.DoubleSide }), sp = H.solid(o.col2, .4), dk = H.solid("#3a2a55", .5);
    [-1, 1].forEach(sd => {
      const up = mesh(new T.SphereGeometry(.1, 14, 10), wm, sd * .1, .05, .02); up.scale.set(1.25, 1, .22); up.rotation.z = sd * .5; bf.add(up);
      const lo = mesh(new T.SphereGeometry(.07, 12, 8), wm, sd * .075, -.07, .02); lo.scale.set(1.1, 1, .22); lo.rotation.z = -sd * .5; bf.add(lo);
      bf.add(mesh(new T.SphereGeometry(.03, 8, 6), sp, sd * .12, .07, .045));
      bf.add(mesh(new T.SphereGeometry(.018, 8, 6), sp, sd * .08, -.08, .04));
      const an = mesh(new T.CylinderGeometry(.006, .006, .12, 5), dk, sd * .03, .17, .04); an.rotation.z = -sd * .35; bf.add(an);
      bf.add(mesh(new T.SphereGeometry(.016, 8, 6), dk, sd * .052, .225, .04));
    });
    bf.add(mesh(new T.CapsuleGeometry(.025, .14, 4, 10), dk, 0, 0, .04));
    flatten(g);
  },
  // round teddy-bear ears on a headband
  bearears(o, C, H) {
    T = H.THREE; const { g, c1, c2 } = C; headband(H, g, c1, 1.08, .035);
    [-1, 1].forEach(k => { const { base, n } = earAt(H, k, .6, 1.1);
      const e = mesh(new T.SphereGeometry(.2, 22, 16), c1, ...base.clone().addScaledVector(n, .1).toArray()); e.scale.set(1, .95, .5); g.add(e);
      const i = mesh(new T.SphereGeometry(.12, 18, 12), c2, ...base.clone().addScaledVector(n, .09).add(V(0, 0, .065)).toArray()); i.scale.set(1, .95, .3); g.add(i); });
    flatten(g);
  },
  // tall pointy fox ears with white insides and dark tips
  foxears(o, C, H) {
    T = H.THREE; const { g, c1, c2 } = C; headband(H, g, c1, 1.08, .035);
    const tipM = H.solid("#3a2a2a", .6);
    [-1, 1].forEach(k => { const { base, n: n0 } = earAt(H, k, .55, 1.1), n = n0.clone().add(V(k * .15, 0, 0)).normalize();
      const e = mesh(new T.ConeGeometry(.22, .58, 24), c1, ...base.clone().addScaledVector(n, .27).toArray()); e.quaternion.setFromUnitVectors(V(0, 1, 0), n); e.scale.set(1, 1, .38); g.add(e);
      const i = mesh(new T.ConeGeometry(.13, .4, 20), c2, ...base.clone().addScaledVector(n, .24).add(V(0, 0, .055)).toArray()); i.quaternion.copy(e.quaternion); i.scale.set(1, 1, .3); g.add(i);
      const t = mesh(new T.ConeGeometry(.085, .17, 16), tipM, ...base.clone().addScaledVector(n, .5).toArray()); t.quaternion.copy(e.quaternion); t.scale.set(1, 1, .45); g.add(t); });
    flatten(g);
  },
  // big round mouse ears
  mouseears(o, C, H) {
    T = H.THREE; const { g, c1, c2 } = C; headband(H, g, c1, 1.08, .035);
    [-1, 1].forEach(k => { const { base, n } = earAt(H, k, .78, 1.1), p = base.clone().addScaledVector(n, .2);
      const e = mesh(new T.CylinderGeometry(.26, .26, .06, 36), c1, ...p.toArray()); e.rotation.x = Math.PI / 2; g.add(e);
      const i = mesh(new T.CylinderGeometry(.17, .17, .02, 32), c2, ...p.clone().add(V(0, 0, .035)).toArray()); i.rotation.x = Math.PI / 2; g.add(i); });
    flatten(g);
  },
  // a striped beanie with a pompom on each side
  pombeanie(o, C, H) {
    T = H.THREE; const { g, dome, c1, c2, S } = C;
    [[0, .4], [.4, .62], [.62, .84], [.84, 1.3]].forEach(([a, b], i) => dome(a, b, S * 1.03, i % 2 ? c2 : c1));
    dome(1.0, 1.42, S * 1.09, c2);
    const pm = H.solid(o.col3 || o.col2, .95);
    [-1, 1].forEach(k => g.add(mesh(fluff(.15, .14, 2, k + 3), pm, ...H.hp(.62, k * Math.PI / 2, 1.26).toArray())));
    flatten(g);
  },
  // a folded paper hat (newspaper print)
  paperhat(o, C, H) {
    T = H.THREE; const { g } = C, y0 = .84, h = .78;
    const pt = tex(H, "paper" + o.col, 256, 256, (x, w, hh) => { x.fillStyle = o.col; x.fillRect(0, 0, w, hh); x.fillStyle = "rgba(40,50,70,.45)";
      for (let r = 0; r < 18; r++) for (let c = 0; c < 3; c++) { const L = 60 + ((r * 7 + c * 13) % 20); x.fillRect(10 + c * 82, 14 + r * 13, L, 4); }
      x.fillStyle = "rgba(40,50,70,.6)"; x.fillRect(10, 4, 140, 7); });
    const pm = new T.MeshStandardMaterial({ map: pt, roughness: .85, side: T.DoubleSide });
    const cone = K(mesh(new T.ConeGeometry(1, h, 4, 1, true), pm, 0, y0 + h / 2, 0)); cone.scale.set(.95, 1, .6); g.add(cone);
    const brim = mesh(new T.CylinderGeometry(1.0, 1.04, .17, 4, 1, true), H.solid(o.col, .8, { side: T.DoubleSide }), 0, y0 + .08, 0); brim.scale.set(.97, 1, .62); g.add(brim);
    flatten(g);
  },
  // a striped bike helmet with vents and a small visor
  bikehelmet(o, C, H) {
    T = H.THREE; const { g, dome, c1, c2, S } = C, sh = S * 1.13;
    dome(0, 1.22, sh, c1);
    const rimPts = []; for (let k = 0; k < 64; k++) { const ph = k / 64 * Math.PI * 2; rimPts.push(H.hp(1.22, ph, sh)); }
    g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(rimPts, true), 96, .035, 8, true), H.solid("#2a2d36", .6)));
    [-.2, 0, .2].forEach((xo, i) => { const pts = []; for (let a = -1.15; a <= 1.151; a += .1) pts.push(dirPt(H, V(xo, Math.cos(a), Math.sin(a)), sh * 1.02)); g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, i === 1 ? .04 : .03, 8), c2)); });
    const vm = H.solid("#1d1d24", .5);
    [-.42, -.31, .31, .42].forEach(xo => [.35, -.25].forEach(a0 => { const p = dirPt(H, V(xo, Math.cos(a0), Math.sin(a0)), sh * 1.01), p2 = dirPt(H, V(xo, Math.cos(a0 + .05), Math.sin(a0 + .05)), sh * 1.01), n = p.clone().sub(H.HC).normalize();
      const v = mesh(new T.SphereGeometry(.05, 10, 6), vm); v.position.copy(p); orient(v, n, p2.clone().sub(p).normalize()); v.scale.set(.8, 2.6, .35); g.add(v); }));
    const ey = H.HC.y + Math.cos(1.22) * H.HR[1] * sh;
    const vis = mesh(new T.CylinderGeometry(.5, .5, .04, 40, 1, false, -Math.PI / 2, Math.PI), c1, 0, ey + .03, .32); vis.scale.set(.95, 1, .55); vis.rotation.x = .3; g.add(vis);
    flatten(g);
  },
  // an eggshell with a zig-zag crack, a chick popping out of the top
  egghat(o, C, H) {
    T = H.THREE; const { g, c1 } = C;
    const ge = new T.SphereGeometry(.76, 40, 14, 0, Math.PI * 2, .5, .97), p = ge.attributes.position, W = 41;
    for (let k = 0; k < p.count; k++) { const row = Math.floor(k / W), col = k % W; if (row === 0 || row === 14) p.setY(k, p.getY(k) + (col % 2 ? .06 : -.03) * (row ? 1 : -.8)); }
    ge.computeVertexNormals(); const sh = mesh(ge, c1, 0, .5, 0); sh.scale.set(1, 1.22, .9); g.add(sh);
    const spot = H.solid(new T.Color(o.col).lerp(new T.Color("#c9a46a"), .5), .6);
    [[.9, .5], [.8, 2.4], [1.1, 3.6], [.75, 4.6], [1.2, 1.4]].forEach(([th, ph]) => { const d = V(Math.sin(th) * Math.sin(ph), Math.cos(th) * 1.22, Math.sin(th) * Math.cos(ph) * .9).normalize(); const s = mesh(new T.SphereGeometry(.04, 8, 6), spot); s.position.set(Math.sin(th) * Math.sin(ph) * .765, .5 + Math.cos(th) * .765 * 1.22, Math.sin(th) * Math.cos(ph) * .765 * .9); orient(s, d); s.scale.set(1, .8, .25); g.add(s); });
    const ck = new T.Group(); ck.position.set(0, 1.33, 0); g.add(ck);
    const ye = H.solid(o.col2, .55);
    const bd = mesh(new T.SphereGeometry(.27, 24, 18), ye); bd.scale.set(1, .95, .95); ck.add(bd);
    [-1, 1].forEach(sd => { const w = mesh(new T.SphereGeometry(.09, 12, 8), ye, sd * .25, -.08, 0); w.scale.set(.5, 1, 1); w.rotation.z = sd * .4; ck.add(w);
      ck.add(mesh(new T.SphereGeometry(.035, 10, 8), H.solid("#1d1d24", .3), sd * .09, .06, .235));
      ck.add(mesh(new T.SphereGeometry(.012, 6, 4), H.solid("#ffffff", .3, { emissive: "#ffffff", emissiveIntensity: .5 }), sd * .09 + .012, .075, .265));
      const ch = mesh(new T.SphereGeometry(.04, 10, 6), H.solid("#ff9ccc", .6), sd * .16, -.02, .2); ch.scale.set(1, .6, .4); ch.lookAt(ch.position.clone().multiplyScalar(2)); ck.add(ch); });
    const bk = mesh(new T.ConeGeometry(.045, .09, 10), H.solid("#ff8a1c", .5), 0, -.01, .28); bk.rotation.x = Math.PI / 2; ck.add(bk);
    [-.4, 0, .4].forEach(a => { const tf = mesh(new T.ConeGeometry(.025, .1, 8), ye, Math.sin(a) * .04, .3, 0); tf.rotation.z = -a * .8; ck.add(tf); });
    flatten(g);
  },
  // a big strawberry with seeds and a crown of leaves
  strawberry(o, C, H) {
    T = H.THREE; const { g, dome, c1, top, S } = C, sc = S * 1.08;
    dome(0, 1.3, sc, c1);
    const seed = H.solid(o.col2, .4), sg = new T.SphereGeometry(.024, 6, 4);
    for (let i = 0; i < 46; i++) { const th = .42 + (i / 46) * .85, ph = i * 2.39996; const p = H.hp(th, ph, sc * 1.005), s = mesh(sg, seed); s.position.copy(p); orient(s, H.hn(th, ph)); s.scale.set(.8, 1.4, .5); g.add(s); }
    const lm = H.solid("#3fbf4a", .55), lm2 = H.solid("#2f9a3a", .55);
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, l = mesh(new T.SphereGeometry(.1, 12, 8), k % 2 ? lm : lm2); l.scale.set(.75, .22, 1.9);
      l.position.set(Math.sin(a) * .2, top + .05, Math.cos(a) * .18); l.rotation.order = "YXZ"; l.rotation.y = a; l.rotation.x = .38; g.add(l); }
    const st = mesh(new T.CylinderGeometry(.03, .045, .16, 8), lm2, .02, top + .15, 0); st.rotation.z = -.35; g.add(st);
    flatten(g);
  },
  // members: a happy little cloud floating over the head (it bobs up and down) with a rainbow
  cloudhat(o, C, H) {
    T = H.THREE; const { g, top } = C, y = top + .55, cm = H.solid(o.col, .8);
    [[0, 0, 0, .26], [-.24, -.05, 0, .19], [.24, -.06, 0, .19], [-.1, .12, -.06, .19], [.14, .1, -.04, .18], [0, -.08, .06, .19], [-.38, -.1, -.02, .12], [.38, -.11, -.02, .12], [0, -.02, -.16, .2]]
      .forEach(([x, yy, z, r]) => g.add(mesh(new T.SphereGeometry(r, 18, 14), cm, x, y + yy, z)));
    const ink = H.solid("#3a3352", .5);
    [-1, 1].forEach(sd => { const e = mesh(new T.TorusGeometry(.035, .011, 6, 12, Math.PI), ink, sd * .085, y + .03, .255); e.rotation.z = Math.PI; g.add(e);
      const ch = mesh(new T.SphereGeometry(.035, 10, 6), H.solid("#ff9ccc", .6), sd * .15, y - .03, .23); ch.scale.set(1, .6, .3); g.add(ch); });
    const sm = mesh(new T.TorusGeometry(.045, .012, 6, 14, Math.PI), ink, 0, y - .02, .262); sm.rotation.z = Math.PI; g.add(sm);
    ["#ff4f5f", "#ff9a1f", "#ffe94a", "#4fe07a", "#3fb8ff", "#9a5cff"].forEach((c, k) => g.add(mesh(new T.TorusGeometry(.3 - k * .028, .016, 6, 28, Math.PI), H.solid(c, .5, { emissive: c, emissiveIntensity: .2 }), .38, y - .12, -.02)));
    flatten(g); H.mergeByMaterial(g);
    const geos = g.children.filter(m => m.isMesh).map(m => m.geometry); let last = 0;
    H.anim(t => { const d = Math.sin(t * 1.7) * .045; if (Math.abs(d - last) < 1e-4) return; geos.forEach(ge => ge.translate(0, d - last, 0)); last = d; });
    return "raw";
  },
  // members: a crown of ice: frosty band, icy spikes, little icicles and a snowflake
  icecrown(o, C, H) {
    T = H.THREE; const { g, yAt } = C, y0 = yAt(.5) - .07, zs = .88;
    const frost = H.solid("#eef8ff", .35, { metalness: .2, side: T.DoubleSide }),
      ice = H.solid(o.col, .1, { metalness: .1, emissive: o.col, emissiveIntensity: .3, transparent: true, opacity: .82 });
    const b = mesh(new T.CylinderGeometry(.535, .51, .15, 40, 1, true), frost, 0, y0 + .075, 0); b.scale.z = zs; g.add(b);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, f = Math.cos(a), h = .2 + .22 * Math.max(0, f) ** 2 + (k % 2 ? 0 : .07);
      const s = mesh(new T.ConeGeometry(.055, h, 5), ice, Math.sin(a) * .52, y0 + .15 + h / 2 - .02, Math.cos(a) * .52 * zs); s.rotation.y = a; g.add(s); }
    for (let k = 0; k < 18; k++) { const a = (k + .5) / 18 * Math.PI * 2, L = .05 + (k * 37 % 5) * .015;
      const ic = mesh(new T.ConeGeometry(.022, L, 6), ice, Math.sin(a) * .535, y0 - L / 2, Math.cos(a) * .535 * zs); ic.rotation.x = Math.PI; g.add(ic); }
    const sf = new T.Group(); sf.position.set(0, y0 + .1, .535 * zs + .03); sf.rotation.x = -.15; g.add(sf);
    const wm = H.solid("#ffffff", .2, { emissive: "#bfeaff", emissiveIntensity: .6 });
    for (let k = 0; k < 3; k++) { const bar = mesh(new T.BoxGeometry(.2, .022, .02), wm); bar.rotation.z = k * Math.PI / 3; sf.add(bar); }
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; sf.add(mesh(new T.SphereGeometry(.018, 8, 6), wm, Math.cos(a) * .1, Math.sin(a) * .1, 0)); }
    flatten(g);
    H.anim(t => { ice.emissiveIntensity = .25 + .2 * Math.sin(t * 2.2); wm.emissiveIntensity = .5 + .35 * Math.sin(t * 3.1 + 1); });
  },
  // members: a golden sun crown with twinkling rays and a sun gem
  suncrown(o, C, H) {
    T = H.THREE; const { g, yAt } = C, y0 = yAt(.5) - .07, zs = .88;
    const band = gold(H, o.col, .25), r1 = H.solid(o.col, .25, { metalness: .5, emissive: o.col, emissiveIntensity: .4 }), r2 = H.solid(o.col2, .3, { metalness: .3, emissive: o.col2, emissiveIntensity: .4 });
    const b = mesh(new T.CylinderGeometry(.535, .51, .15, 40, 1, true), band, 0, y0 + .075, 0); b.scale.z = zs; g.add(b);
    g.add(ringFlat(.535, .02, band, y0 + .15, zs));
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, long = k % 2 === 0, L = (long ? .3 : .18) + .08 * Math.max(0, Math.cos(a)), w = long ? .085 : .06;
      const r = mesh(thin(poly([[-w, 0], [w, 0], [0, L]]), .02, .006, 4), long ? r1 : r2, Math.sin(a) * .53, y0 + .13, Math.cos(a) * .53 * zs);
      r.rotation.order = "YXZ"; r.rotation.y = a; r.rotation.x = .45; g.add(r); }
    const sun = mesh(new T.CylinderGeometry(.085, .085, .03, 24), r2, 0, y0 + .08, .535 * zs + .02); sun.rotation.x = Math.PI / 2 - .1; g.add(sun);
    g.add(mesh(new T.TorusGeometry(.1, .014, 8, 24), band, 0, y0 + .08, .535 * zs + .02));
    flatten(g);
    H.anim(t => { r1.emissiveIntensity = .3 + .35 * (.5 + .5 * Math.sin(t * 3)); r2.emissiveIntensity = .3 + .35 * (.5 + .5 * Math.sin(t * 3 + Math.PI)); });
  },
  // members: a tall soft magic hat covered in a starry night sky; the stars drift round it, a star at the tip
  magichat(o, C, H) {
    T = H.THREE; const { g, yAt } = C, y0 = yAt(.58) - .02;
    const st = starryTex(H, o.col, o.col3 || "#1a1040", o.col + "m"), sm = new T.MeshStandardMaterial({ map: st, roughness: .6, side: T.DoubleSide, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: .25 });
    const brim = K(mesh(lathe([[.5, .02], [.62, 0], [.92, -.03], [1.0, -.02], [1.02, .01], [.96, .0], [.84, -.04], [.6, -.02], [.5, -.01]]), sm, 0, y0, 0)); brim.scale.z = .9; g.add(brim);
    const H0 = 1.3, cone = new T.ConeGeometry(.52, H0, 36, 14, true), pa = cone.attributes.position;
    const bend = (x, y, z) => { const t = Math.max(0, y + H0 / 2 - .55); return [x - t * t * .5, y - t * t * .12, z - t * t * .18]; };
    for (let k = 0; k < pa.count; k++) { const [x, y, z] = bend(pa.getX(k), pa.getY(k), pa.getZ(k)); pa.setXYZ(k, x, y, z); }
    cone.computeVertexNormals(); const cm = K(mesh(cone, sm, 0, y0 + H0 / 2 + .02, 0)); cm.scale.z = .9; g.add(cm);
    const tip = bend(0, H0 / 2, 0);
    const gm = H.solid(o.col2, .25, { metalness: .5, emissive: o.col2, emissiveIntensity: .7 });
    const bd = mesh(new T.CylinderGeometry(.525, .54, .13, 36, 1, true), gm, 0, y0 + .08, 0); bd.scale.z = .9; g.add(bd);
    g.add(mesh(thin(poly(starPts(.13, .055)), .04, .01, 4), gm, tip[0] - .02, y0 + H0 / 2 + .06 + tip[1], tip[2] * .9));
    flatten(g);
    H.anim(t => { st.offset.x = (t * .025) % 1; st.offset.y = (t * .012) % 1; gm.emissiveIntensity = .5 + .35 * Math.sin(t * 2.6); });
  },
  // members: gold headphones with glowing light rings that change colour
  glowphones(o, C, H) {
    T = H.THREE; const { g } = C, gm = gold(H, o.col, .2), pad = H.solid(o.col2, .7);
    const lm = H.solid("#ff4fd8", .3, { emissive: "#ff4fd8", emissiveIntensity: 1.2 });
    const band = []; for (let t = -1.4; t <= 1.401; t += .1) band.push(H.hp(t, Math.PI / 2, 1.13));
    g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(band), 48, .05, 10), gm));
    g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(band.slice(4, -4).map(p => p.clone().add(V(0, -.035, 0)))), 40, .03, 8), pad));
    [-1, 1].forEach(sd => { const p = H.hp(sd * 1.48, Math.PI / 2, 1.02);
      const cup = mesh(new T.CylinderGeometry(.22, .24, .18, 32), gm, ...p.toArray()); cup.rotation.z = Math.PI / 2; g.add(cup);
      const pd = mesh(new T.TorusGeometry(.18, .055, 10, 24), pad, ...p.clone().add(V(-sd * .08, 0, 0)).toArray()); pd.rotation.y = Math.PI / 2; g.add(pd);
      const lr = mesh(new T.TorusGeometry(.17, .025, 8, 32), lm, ...p.clone().add(V(sd * .095, 0, 0)).toArray()); lr.rotation.y = Math.PI / 2; g.add(lr);
      const cap = mesh(new T.CylinderGeometry(.12, .12, .02, 24), gm, ...p.clone().add(V(sd * .095, 0, 0)).toArray()); cap.rotation.z = Math.PI / 2; g.add(cap); });
    flatten(g);
    H.anim(t => { lm.color.setHSL((t * .12) % 1, 1, .6); lm.emissive.copy(lm.color); });
  },
  // members: a space helmet: glass bubble, white shell, raised gold mirror visor and a collar (hides the hair)
  astrohelmet(o, C, H) {
    T = H.THREE; const { g } = C, cy = .46, cz = .02, R = .86;
    const shell = H.solid(o.col, .45, { side: T.DoubleSide }), trim = H.solid(o.col2, .45, { metalness: .3 }),
      visor = H.solid("#ffc94a", .12, { metalness: .95, emissive: "#ff9a1f", emissiveIntensity: .12, side: T.DoubleSide });
    const glass = new T.MeshStandardMaterial({ color: "#dff4ff", transparent: true, opacity: .16, roughness: .05, metalness: .2, depthWrite: false, side: T.FrontSide });
    const gl = K(mesh(new T.SphereGeometry(R - .01, 40, 24), glass, 0, cy, cz)); gl.renderOrder = 3; g.add(gl);
    const W0 = Math.PI / 2 - 1.15, WL = 2.3, T0 = .62, T1 = 2.2, TE = Math.PI * .86;   // the window: phi from W0 for WL, theta T0..T1
    g.add(mesh(new T.SphereGeometry(R, 40, 20, W0 + WL, Math.PI * 2 - WL, 0, TE), shell, 0, cy, cz));
    g.add(mesh(new T.SphereGeometry(R, 24, 8, W0, WL, 0, T0), shell, 0, cy, cz));
    g.add(mesh(new T.SphereGeometry(R, 24, 6, W0, WL, T1, TE - T1), shell, 0, cy, cz));
    g.add(mesh(new T.SphereGeometry(R + .015, 30, 8, W0 + .08, WL - .16, T0 - .02, .5), visor, 0, cy, cz));
    const sp = (ph, th, r = R + .01) => V(-Math.cos(ph) * Math.sin(th) * r, cy + Math.cos(th) * r, Math.sin(ph) * Math.sin(th) * r + cz);
    const fr = []; for (let k = 0; k <= 16; k++) fr.push(sp(W0 + WL * k / 16, T0)); for (let k = 1; k <= 12; k++) fr.push(sp(W0 + WL, T0 + (T1 - T0) * k / 12));
    for (let k = 1; k <= 16; k++) fr.push(sp(W0 + WL - WL * k / 16, T1)); for (let k = 1; k < 12; k++) fr.push(sp(W0, T1 - (T1 - T0) * k / 12));
    g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(fr, true, "catmullrom", .2), 120, .035, 8, true), trim));
    const by = cy + Math.cos(TE) * R, br = Math.sin(TE) * R;
    g.add(ringFlat(br + .02, .07, trim, by, 1));
    [-1, 1].forEach(sd => { const p = sp(sd > 0 ? Math.PI - .05 : .05, 1.15, R); const lamp = mesh(new T.CylinderGeometry(.07, .08, .08, 18), trim, ...p.toArray()); lamp.rotation.z = Math.PI / 2; g.add(lamp);
      const ln = mesh(new T.CylinderGeometry(.05, .05, .02, 16), H.solid("#bfeaff", .2, { emissive: "#7fd8ff", emissiveIntensity: .9 }), p.x + sd * .045, p.y, p.z); ln.rotation.z = Math.PI / 2; g.add(ln); });
    const ab = sp(Math.PI * 1.25, .55, R);
    g.add(mesh(new T.CylinderGeometry(.012, .012, .3, 6), trim, ab.x, ab.y + .15, ab.z));
    g.add(mesh(new T.SphereGeometry(.035, 10, 8), H.solid("#ff4f5f", .3, { emissive: "#ff4f5f", emissiveIntensity: .8 }), ab.x, ab.y + .31, ab.z));
    flatten(g);
  },
  // members: shimmering dragon fins on the sides and two little golden horns
  dragonears(o, C, H) {
    T = H.THREE; const { g } = C;
    const fm = H.solid(o.col, .3, { metalness: .35, emissive: o.col, emissiveIntensity: .25, side: T.DoubleSide }), sp = H.solid(o.col2, .3, { metalness: .5, emissive: o.col2, emissiveIntensity: .2 }),
      tw = H.solid("#ffffff", .2, { emissive: "#ffffff", emissiveIntensity: 1 });
    [-1, 1].forEach(s => {
      const f = new T.Group(); f.position.copy(H.hp(1.05, s * 1.5, 1.2)); f.rotation.y = s * Math.PI / 2; f.scale.setScalar(1.45); g.add(f);
      const P = [[0, -.06], [.06, .08], [.02, .34], [.15, .16], [.22, .36], [.27, .13], [.42, .26], [.36, .02], [.2, -.08]].map(([x, y]) => [x * s, y]);
      f.add(mesh(thin(poly(P), .025, .008, 6), fm, 0, 0, .02));
      [[.02, .34], [.22, .36], [.42, .26]].forEach(([x, y]) => { const a = V(0, -.02, .045), b = V(x * s, y, .045), r = mesh(new T.CylinderGeometry(.008, .016, a.distanceTo(b), 6), sp); r.position.copy(a).add(b).multiplyScalar(.5); r.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); f.add(r); });
      [[.12, .1], [.3, .16], [.08, .22]].forEach(([x, y]) => f.add(mesh(new T.OctahedronGeometry(.02, 0), tw, x * s, y, .05)));
      const hb = H.hp(.35, s * .9, 1.03), hn = H.hn(.35, s * .9);
      g.add(new T.Mesh(H.lockGeo([hb.clone().addScaledVector(hn, -.03), hb.clone().addScaledVector(hn, .12), hb.clone().addScaledVector(hn, .2).add(V(s * .03, .08, -.04))], .07, 1, 16, 10), sp));
    });
    flatten(g);
    H.anim(t => { fm.color.setHSL(.47 + .12 * Math.sin(t * .9), .75, .55); fm.emissive.copy(fm.color); tw.emissiveIntensity = .4 + .8 * Math.abs(Math.sin(t * 2.4)); });
  },
  // a magician's top hat with a white bunny peeking out of the top
  magician(o, C, H) {
    T = H.THREE; const { g, yAt, c1, c2 } = C, y0 = yAt(.42) + .02;
    const brim = mesh(new T.CylinderGeometry(.72, .72, .04, 40), c1, 0, y0, 0); brim.scale.z = .88; g.add(brim);
    const cr = mesh(new T.CylinderGeometry(.44, .42, .7, 36), c1, 0, y0 + .37, 0); cr.scale.z = .88; g.add(cr);
    const bd = mesh(new T.CylinderGeometry(.445, .435, .15, 36, 1, true), c2, 0, y0 + .11, 0); bd.scale.z = .88; g.add(bd);
    const wh = H.solid("#ffffff", .7), pk = H.solid("#ff9ccc", .6), yt = y0 + .72;
    [-1, 1].forEach(sd => { const n = V(sd * .35, 1, sd * .1).normalize(); const e = mesh(new T.CapsuleGeometry(.075, .3, 6, 12), wh, sd * .09 + n.x * .2, yt + n.y * .2, n.z * .2); e.quaternion.setFromUnitVectors(V(0, 1, 0), n); e.scale.set(1, 1, .55); g.add(e);
      const i = mesh(new T.CapsuleGeometry(.04, .22, 6, 10), pk, sd * .09 + n.x * .21, yt + n.y * .21, n.z * .21 + .035); i.quaternion.copy(e.quaternion); i.scale.set(1, 1, .4); g.add(i); });
    g.add(mesh(new T.SphereGeometry(.13, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), wh, 0, yt, 0));
    const sp = gold(H, "#ffd23a", .5);
    [[.33, .5, .38], [-.36, .28, .33]].forEach(([x, y, z]) => { const s = mesh(thin(poly(starPts(.055, .022)), .015, .004, 2), sp, x, y0 + y, z); s.lookAt(x * 3, y0 + y, z * 3); g.add(s); });
    flatten(g);
  },
  // a sports visor: a band round the head and a see-through tinted peak (sits on the hair)
  sportvisor(o, C, H) {
    T = H.THREE; const { g, c1 } = C, y = .74;
    const b = mesh(new T.CylinderGeometry(1, 1, .13, 48, 1, true), c1, 0, y, -.02); b.scale.set(.67, 1, .59); b.rotation.x = .1; g.add(b);
    const tint = new T.MeshStandardMaterial({ color: o.col2, transparent: true, opacity: .55, roughness: .1, metalness: .1, side: T.DoubleSide, depthWrite: false });
    const pk = K(mesh(new T.CylinderGeometry(.6, .6, .025, 40, 1, false, -Math.PI / 2, Math.PI), tint, 0, y - .05, .28)); pk.scale.set(1.0, 1, .95); pk.rotation.x = .18; pk.renderOrder = 2; g.add(pk);
    const e = mesh(new T.TorusGeometry(.6, .018, 6, 40, Math.PI), c1, 0, y - .05, .28); e.rotation.x = Math.PI / 2 + .18; e.scale.set(1.0, .95, 1); g.add(e);
    flatten(g);
  },
  // a headband with two springy antennae that wobble, hearts on top
  boppers(o, C, H) {
    T = H.THREE; const { g, c1, top } = C; headband(H, g, c1, 1.08, .035);
    const y0 = top + .02;
    const sm = sway(H, H.solid("#d9e0ea", .3, { metalness: .6 }), y0, .55, 5.5, "bopS"), hm = sway(H, H.solid(o.col2, .35, { emissive: o.col2, emissiveIntensity: .25 }), y0, .55, 5.5, "bopH" + o.col2);
    [-1, 1].forEach(sd => { const base = H.hp(sd * .45, Math.PI / 2, 1.08).add(V(0, 0, .03)), pts = [];
      for (let k = 0; k <= 60; k++) { const t = k / 60, a = t * Math.PI * 2 * 6; pts.push(base.clone().add(V(Math.cos(a) * .035 + sd * t * .12, t * .42, Math.sin(a) * .035))); }
      g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 240, .011, 5), sm));
      const tp = pts[60]; g.add(mesh(thin(poly(heartPts(.11)), .05, .015, 6), hm, tp.x, tp.y + .08, tp.z)); });
    flatten(g);
  },
  // one big tropical flower on the side of the head
  sideflower(o, C, H) {
    T = H.THREE; const { g } = C;
    const f = new T.Group(); f.position.copy(H.hp(.92, 1.25, 1.27)); orient(f, H.hn(.92, 1.25), V(0, 1, 0)); f.scale.setScalar(1.35); g.add(f);
    const pm = H.solid(o.col, .5, { side: T.DoubleSide }), pm2 = H.solid(new T.Color(o.col).lerp(new T.Color("#ffffff"), .35), .5), cm = H.solid(o.col2, .4), lm = H.solid("#3fbf4a", .55);
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + .3, q = mesh(new T.SphereGeometry(.13, 14, 10), pm, Math.cos(a) * .13, Math.sin(a) * .13, 0); q.rotation.z = a; q.scale.set(1.25, .85, .22); f.add(q); }
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + .93, q = mesh(new T.SphereGeometry(.08, 12, 8), pm2, Math.cos(a) * .07, Math.sin(a) * .07, .04); q.rotation.z = a; q.scale.set(1.2, .8, .25); f.add(q); }
    f.add(mesh(new T.SphereGeometry(.05, 12, 8), cm, 0, 0, .07));
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; f.add(mesh(new T.SphereGeometry(.018, 6, 4), cm, Math.cos(a) * .05, Math.sin(a) * .05 + .03, .12)); }
    [[-.25, -.12, -2.6], [-.2, .2, 2.4]].forEach(([x, y, r]) => { const l = mesh(new T.SphereGeometry(.1, 12, 8), lm, x, y, -.03); l.scale.set(1.6, .55, .2); l.rotation.z = r; f.add(l); });
    flatten(g);
  },
  // members: a silver crown of crystals in every colour of the rainbow that shimmer in turn
  rainbowcrown(o, C, H) {
    T = H.THREE; const { g, yAt } = C, y0 = yAt(.5) - .07, zs = .88;
    const sil = H.solid(o.col, .2, { metalness: .85, side: T.DoubleSide });
    const b = mesh(new T.CylinderGeometry(.535, .51, .13, 40, 1, true), sil, 0, y0 + .065, 0); b.scale.z = zs; g.add(b);
    g.add(ringFlat(.535, .022, sil, y0 + .13, zs));
    const cols = ["#ff4f5f", "#ff9a1f", "#ffe94a", "#4fe07a", "#3fb8ff", "#5a6bff", "#b45cff"], ms = cols.map(c => H.solid(c, .1, { metalness: .15, emissive: c, emissiveIntensity: .35, transparent: true, opacity: .9 }));
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, f = Math.cos(a), h = .22 + .2 * Math.max(0, f) ** 2 + (k % 2 ? 0 : .06);
      const s = mesh(new T.OctahedronGeometry(.1, 0), ms[k % 7], Math.sin(a) * .52, y0 + .15 + h * .5, Math.cos(a) * .52 * zs); s.scale.set(.7, h / .2, .7); s.rotation.y = a; g.add(s); }
    const big = mesh(new T.OctahedronGeometry(.09, 0), H.solid("#ffffff", .05, { metalness: .2, emissive: "#ffffff", emissiveIntensity: .5 }), 0, y0 + .07, .535 * zs + .04); big.scale.set(1, 1.25, .6); g.add(big);
    flatten(g);
    H.anim(t => ms.forEach((m, k) => { m.emissiveIntensity = .2 + .7 * Math.max(0, Math.sin(t * 2.4 - k * .9)); }));
  },
};

/* ================================================================== GLASSES ================================================================== */
// two lenses in front of the eyes (each turned a little round the face), a bridge and arms back to the ears, like
// the built-in frames. lens(L, s, i): build one lens in L (s = -1 left / 1 right; shapes use x*s to point outward)
function pair(g, C, H, { half = .21, dy = 0, lens, fm, bridge = true, temples = true, br = .018, by = .03 }) {
  [C.eyeL, C.eyeR].forEach((e, i) => { const s = i ? 1 : -1, L = new T.Group(); L.position.set(e.x, C.Y + dy, C.Z); L.rotation.y = s * .16; lens(L, s, i); g.add(L); });
  if (bridge) g.add(C.rod([C.eyeL.x + half * .95, C.Y + dy + by, C.Z], [C.eyeR.x - half * .95, C.Y + dy + by, C.Z], br, fm));
  if (temples) [C.eyeL, C.eyeR].forEach((e, i) => { const s = i ? 1 : -1; g.add(C.rod([e.x + s * half * .98, C.Y + dy + .02, C.Z - .03], [s * .63, C.Y + .05, .02], .017, fm)); });
}
const tintMat = (c, op = .3, extra = {}) => new T.MeshStandardMaterial({ color: c, transparent: true, opacity: op, roughness: .08, metalness: .1, ...extra });
// a frame from an outline and a hole ([x, y] lists), the lens filling the hole
function framed(L, C, outer, hole, fm, lm) {
  const sh = poly(outer); sh.holes.push(pathOf(hole)); const f = C.ext(sh, fm); f.position.z = -.015; L.add(f);
  if (lm) { const l = new T.Mesh(new T.ShapeGeometry(poly(hole), 24), lm); l.position.z = .005; L.add(l); }
}
const GLINT = {};
const glint = (L, x = -.07, y = .03, h = .18) => { const m = new T.Mesh(new T.PlaneGeometry(.045, h), GLINT.m || (GLINT.m = new T.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: .4 }))); m.position.set(x, y, .012); m.rotation.z = -.5; L.add(m); };
const done = (g, H) => { flatten(g); H.mergeByMaterial(g); };
// a strap round the back of the head (goggles, masks)
function strap(g, m, y, r = .04) { const s = new T.Mesh(new T.TorusGeometry(.66, r, 8, 48, Math.PI * 1.25), m); s.rotation.set(Math.PI / 2, 0, Math.PI * 1.125); s.position.set(0, y, -.02); s.scale.set(1, .92, 1); g.add(s); }
// the hypnosis spiral
const spiralTex = (H, col, bg, rainbow) => tex(H, "spiral" + col + bg + (rainbow ? "R" : ""), 256, 256, (x, w, h) => {
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.lineCap = "round"; x.lineWidth = 15;
  const cx = w / 2, cy = h / 2, R = w * .55, turns = 4;
  for (let arm = 0; arm < (rainbow ? 2 : 1); arm++) { let px = cx, py = cy;
    for (let k = 1; k <= 400; k++) { const t = k / 400, a = t * turns * Math.PI * 2 + arm * Math.PI, r = t * R, nx = cx + Math.cos(a) * r, ny = cy + Math.sin(a) * r;
      x.strokeStyle = rainbow ? `hsl(${(t * 720 + arm * 180) % 360},95%,55%)` : col; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke(); px = nx; py = ny; } }
  x.fillStyle = rainbow ? "#ffffff" : col; x.beginPath(); x.arc(cx, cy, 9, 0, 7); x.fill();
});
const tortoiseTex = H => tex(H, "tortoise", 128, 128, (x, w, h) => {
  x.fillStyle = "#6b3a17"; x.fillRect(0, 0, w, h); let s = 11; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 40; i++) { const g2 = x.createRadialGradient(0, 0, 0, 0, 0, 1); const c = R() < .5 ? "rgba(214,140,60,.75)" : "rgba(40,18,6,.7)"; g2.addColorStop(0, c); g2.addColorStop(1, "rgba(0,0,0,0)");
    x.save(); x.translate(R() * w, R() * h); x.scale(8 + R() * 16, 5 + R() * 10); x.fillStyle = g2; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill(); x.restore(); }
}, [5, 5]);

export const GLASSES_STYLES = {
  // big square nerd glasses with a bit of tape on the bridge
  nerd(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .35), lm = tintMat("#e8f6ff", .18);
    pair(g, C, H, { half: .25, fm, br: .03, lens: L => { framed(L, C, ptsOf(C.rrect(.5, .42, .07)), ptsOf(C.rrect(.38, .3, .04)), fm, lm); glint(L); } });
    g.add(mesh(new T.BoxGeometry(.075, .1, .07), H.solid(o.col2 || "#ffffff", .8), 0, C.Y + .03, C.Z));
    done(g, H);
  },
  // aviators: thin gold teardrops, a double bridge and green tinted lenses
  aviator(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .25, { metalness: .75 }), lm = tintMat(o.col2 || "#2f6b4a", .7, { metalness: .4 });
    const drop = (s, k) => Array.from({ length: 48 }, (_, i) => { const a = i / 48 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a); let x = c * .22, y = sn * .17; if (y > 0) y *= .72; else { y *= 1.08; x += .035 * c * -sn; } return [s * (x * k + .01), y * k - .01]; });
    pair(g, C, H, { half: .23, fm, br: .014, by: .1, lens: (L, s) => { framed(L, C, drop(s, 1), drop(s, .86), fm, lm); glint(L, -.06 * s, .02); } });
    g.add(C.rod([C.eyeL.x + .2, C.Y + .02, C.Z], [C.eyeR.x - .2, C.Y + .02, C.Z], .012, fm));
    done(g, H);
  },
  // swimming goggles: small oval eye cups and a coloured strap
  swim(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .35), lm = tintMat(o.col2 || "#3fb8ff", .55, { metalness: .5 });
    [C.eyeL, C.eyeR].forEach((e, i) => { const s = i ? 1 : -1, L = new T.Group(); L.position.set(e.x, C.Y, C.Z - .01); L.rotation.y = s * .2; g.add(L);
      const r = mesh(new T.TorusGeometry(.18, .045, 10, 36), fm); r.scale.set(1.15, .85, 1); L.add(r);
      const cup = mesh(new T.CylinderGeometry(.19, .2, .05, 32, 1, true), fm, 0, 0, -.03); cup.rotation.x = Math.PI / 2; cup.scale.set(1.15, 1, .85); L.add(cup);
      const l = mesh(new T.CircleGeometry(.18, 32), lm, 0, 0, .01); l.scale.set(1.15, .85, 1); L.add(l); glint(L, -.06, .03, .12); });
    g.add(C.rod([C.eyeL.x + .2, C.Y, C.Z - .01], [C.eyeR.x - .2, C.Y, C.Z - .01], .015, fm));
    strap(g, H.solid(o.col3 || o.frame, .5), C.Y + .02, .035);
    done(g, H);
  },
  // round frames with little cat ears on top
  kitty(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .35), lm = tintMat(o.col2 || "#ffc2dc", .3), im = H.solid(o.col2 || "#ffc2dc", .5);
    pair(g, C, H, { half: .21, fm, lens: (L, s) => { L.add(new T.Mesh(new T.TorusGeometry(.2, .028, 12, 48), fm)); const l = new T.Mesh(new T.CircleGeometry(.19, 36), lm); l.position.z = .004; L.add(l);
      [[.1, .17, -.3], [-.11, .17, .3]].forEach(([x, y, r]) => { const e = mesh(thin(poly([[-.07, 0], [.07, 0], [0, .12]]), .03, .008, 2), fm, x * s, y, 0); e.rotation.z = r * s; L.add(e);
        const i2 = mesh(thin(poly([[-.035, 0], [.035, 0], [0, .065]]), .01, .003, 2), im, x * s, y + .02, .025); i2.rotation.z = r * s; L.add(i2); }); } });
    done(g, H);
  },
  // flower glasses: a ring of petals round each lens
  flowerglasses(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .45), cm = H.solid(o.col2, .4), lm = tintMat("#fff2a8", .25), pg = new T.SphereGeometry(.07, 12, 8);
    pair(g, C, H, { half: .22, fm: cm, lens: L => { L.add(new T.Mesh(new T.TorusGeometry(.15, .025, 10, 36), cm)); const l = new T.Mesh(new T.CircleGeometry(.15, 32), lm); l.position.z = .004; L.add(l);
      for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, p = mesh(pg, fm, Math.cos(a) * .2, Math.sin(a) * .2, -.005); p.rotation.z = a; p.scale.set(1.0, .72, .3); L.add(p); } } });
    done(g, H);
  },
  // butterfly-wing frames with spots
  butterflyglasses(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .4), sp = H.solid(o.col2, .4), lm = tintMat("#e8d8ff", .3);
    const wing = s => ring(a => (Math.sin(a) > 0 ? .27 : .21) * (Math.cos(a) > 0 ? 1.1 : .93) * (1 - .14 * Math.abs(Math.sin(2 * a))), 72).map(([x, y]) => [x * s + .01 * s, y + .01]);
    pair(g, C, H, { half: .24, fm, lens: (L, s) => { framed(L, C, wing(s), ell(.15, .13, 40), fm, lm);
      [[.21, .16, .035], [.24, -.12, .028], [-.15, .2, .025]].forEach(([x, y, r]) => { const d = mesh(new T.SphereGeometry(r, 10, 6), sp, x * s, y, .02); d.scale.z = .4; L.add(d); }); } });
    done(g, H);
  },
  // thin hexagon frames
  hexagon(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .25, { metalness: .7 }), lm = tintMat(o.col2 || "#d8f0ff", .25);
    const hex = r => Array.from({ length: 6 }, (_, k) => { const a = k / 6 * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r * .92]; });
    pair(g, C, H, { half: .22, fm, br: .014, lens: L => { framed(L, C, hex(.235), hex(.2), fm, lm); glint(L); } });
    done(g, H);
  },
  // see-through candy-coloured plastic frames
  clearframe(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .15, { transparent: true, opacity: .62, emissive: o.frame, emissiveIntensity: .15 }), lm = tintMat("#ffffff", .12);
    pair(g, C, H, { half: .235, fm, br: .025, lens: L => { framed(L, C, ptsOf(C.rrect(.47, .4, .12)), ptsOf(C.rrect(.38, .31, .08)), fm, lm); glint(L); } });
    done(g, H);
  },
  // cat-eye frames covered in polka dots
  dotcat(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .35), dm = H.solid(o.col2, .4), lm = tintMat("#ffd6ec", .25), dg = new T.SphereGeometry(.018, 8, 6);
    pair(g, C, H, { half: .22, fm, lens: (L, s) => { const sh = new T.Shape(), q = s; sh.moveTo(-.22 * q, -.06); sh.quadraticCurveTo(-.2 * q, -.2, 0, -.19); sh.quadraticCurveTo(.2 * q, -.18, .24 * q, -.02); sh.quadraticCurveTo(.3 * q, .12, .34 * q, .22); sh.quadraticCurveTo(.12 * q, .18, -.04 * q, .16); sh.quadraticCurveTo(-.24 * q, .14, -.22 * q, -.06);
      const hole = new T.Path(); hole.absellipse(0, -.01, .17, .13, 0, Math.PI * 2, true); sh.holes.push(hole); const f = C.ext(sh, fm); f.position.z = -.015; L.add(f);
      const t2 = new T.Mesh(new T.CircleGeometry(.17, 28), lm); t2.scale.y = .78; t2.position.set(0, -.01, .004); L.add(t2);
      [[.2, .1], [.27, .17], [.13, .15], [-.12, .13], [-.19, -.08], [.19, -.1], [0, -.17], [-.1, -.16], [.1, -.165], [.31, .2], [-.03, .15], [.22, .02]].forEach(([x, y]) => { const d = mesh(dg, dm, x * s, y, .028); d.scale.z = .35; L.add(d); }); } });
    done(g, H);
  },
  // members: mirror sunglasses whose shiny lenses shimmer
  mirror(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .2, { metalness: .9 });
    const mt = tex(H, "mirror", 128, 128, (x, w, h) => { const gr = x.createLinearGradient(0, 0, w, h); ["#5fe0ff", "#9b5cff", "#ff5fa8", "#ffb347", "#5fe0ff"].forEach((c, k) => gr.addColorStop(k / 4, c)); x.fillStyle = gr; x.fillRect(0, 0, w, h);
      x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.moveTo(w * .1, 0); x.lineTo(w * .3, 0); x.lineTo(w * .1, h); x.lineTo(-w * .1, h); x.fill(); }, [1, 1]);
    const lm = new T.MeshStandardMaterial({ map: mt, metalness: .7, roughness: .12, emissive: "#ffffff", emissiveMap: mt, emissiveIntensity: .35 });
    pair(g, C, H, { half: .24, fm, lens: L => { const hole = C.rrect(.42, .32, .11); framed(L, C, ptsOf(C.rrect(.48, .38, .14)), ptsOf(hole), fm, null);
      const l = K(new T.Mesh(shapeUV(hole, .42, .32), lm)); l.position.z = .006; L.add(l); } });
    done(g, H);
    H.anim(t => { mt.offset.x = (t * .18) % 1; });
  },
  // tiny round retro glasses with a curved bridge
  tinyround(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .25, { metalness: .8 }), lm = tintMat(o.col2 || "#ffb347", .45);
    pair(g, C, H, { half: .14, fm, bridge: false, lens: L => { L.add(new T.Mesh(new T.TorusGeometry(.14, .016, 10, 40), fm)); const l = new T.Mesh(new T.CircleGeometry(.135, 32), lm); l.position.z = .003; L.add(l); glint(L, -.04, .03, .1); } });
    const pts = [V(C.eyeL.x + .13, C.Y + .02, C.Z - .01), V(-.06, C.Y + .07, C.Z + .01), V(.06, C.Y + .07, C.Z + .01), V(C.eyeR.x - .13, C.Y + .02, C.Z - .01)];
    g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 16, .013, 6), fm));
    done(g, H);
  },
  // watermelon slices: green rind, a pale band and a red lens with seeds
  melon(o, g, C, H) {
    T = H.THREE; const rind = H.solid(o.frame, .45), wm = H.solid("#f2ffe0", .5), lm = tintMat("#ff4f6b", .6), sd = H.solid("#1d1d24", .4);
    const half = (r, ry, top, n = 40) => { const p = [[-r, top], [r, top]]; for (let k = 1; k < n; k++) { const a = -k / n * Math.PI; p.push([Math.cos(a) * r, top + Math.sin(a) * ry]); } return p; };
    pair(g, C, H, { half: .24, fm: rind, by: .07, lens: L => { framed(L, C, half(.25, .25, .1), half(.215, .2, .07), rind, null);
      const inner = poly(half(.215, .2, .07)); inner.holes.push(pathOf(half(.19, .175, .06))); const w = new T.Mesh(new T.ShapeGeometry(inner, 24), wm); w.position.z = .006; L.add(w);
      const l = new T.Mesh(new T.ShapeGeometry(poly(half(.19, .175, .06)), 24), lm); l.position.z = .005; L.add(l);
      [[-.08, -.01], [.08, -.01], [0, -.06], [-.04, .03], [.05, .03], [-.12, .03], [.12, .03]].forEach(([x, y]) => { const s2 = mesh(new T.SphereGeometry(.017, 8, 6), sd, x, y, .012); s2.scale.set(.7, 1.1, .4); L.add(s2); }); } });
    done(g, H);
  },
  // lightning glasses: rounded frames with a lightning bolt flashing from each outer corner
  bolt(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .3, { emissive: o.frame, emissiveIntensity: .25 }), lm = tintMat(o.col2 || "#3a2a8a", .5, { metalness: .3 });
    pair(g, C, H, { half: .23, fm, lens: (L, s) => { framed(L, C, ptsOf(C.rrect(.46, .36, .1)), ptsOf(C.rrect(.39, .29, .07)), fm, lm); glint(L);
      const b = poly([[.12, .2], [.3, .4], [.26, .3], [.36, .32], [.27, .14], [.3, .22], [.2, .16]].map(([x, y]) => [x * s, y - .02])); L.add(mesh(thin(b, .03, .008, 2), fm, 0, -.05, 0)); } });
    done(g, H);
  },
  // cloud-shaped frames with sky-blue lenses
  cloudglasses(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .6), lm = tintMat(o.col2 || "#7fd3ff", .45);
    const cloud = ring(a => { const b = .2 + .045 * Math.abs(Math.cos(a * 3.5)); return Math.sin(a) < -.3 ? b * .88 : b; }, 96, 0, 0, 1.05);
    pair(g, C, H, { half: .25, fm, br: .025, lens: L => { framed(L, C, cloud, ell(.17, .135, 40), fm, lm); glint(L); } });
    done(g, H);
  },
  // crescent-moon frames with a tiny star
  moon(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .25, { metalness: .5, emissive: o.frame, emissiveIntensity: .2 }), lm = tintMat(o.col2 || "#2a3a8a", .45);
    pair(g, C, H, { half: .21, fm, lens: (L, s) => { L.add(new T.Mesh(new T.TorusGeometry(.19, .02, 10, 40), fm)); const l = new T.Mesh(new T.CircleGeometry(.185, 32), lm); l.position.z = .004; L.add(l);
      const cr = []; for (let k = 0; k <= 24; k++) { const a = -1.9 + k / 24 * 3.8; cr.push([Math.cos(a) * .29 * s, Math.sin(a) * .29]); } for (let k = 24; k >= 0; k--) { const a = -1.75 + k / 24 * 3.5; cr.push([Math.cos(a) * .2 * s, Math.sin(a) * .2]); }
      L.add(mesh(thin(poly(cr), .03, .008, 2), fm, 0, 0, -.005)); L.add(mesh(thin(poly(starPts(.05, .02)), .015, .004, 2), fm, -.16 * s, .18, 0)); } });
    done(g, H);
  },
  // 8-bit pixel sunglasses
  pixel(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .4), wm = H.solid("#ffffff", .4), u = .055, z = C.Z + .02, y = C.Y + .1;
    const box = (x, yy, w, h, m) => g.add(mesh(new T.BoxGeometry(w, h, .05), m, x, yy, z));
    box(0, y, 1.05, u, fm);
    [-1, 1].forEach(s => { const cx = s * .26;
      box(cx, y - u, .44, u, fm); box(cx, y - 2 * u, .44, u, fm); box(cx + s * .03, y - 3 * u, .33, u, fm); box(cx + s * .055, y - 4 * u, .22, u, fm);
      box(cx - s * .13, y - u, u, u * 1.02, wm); box(cx - s * .075, y - 2 * u, u, u * 1.02, wm); });
    [-1, 1].forEach(s => g.add(C.rod([s * .5, y, z - .02], [s * .63, C.Y + .05, .02], .017, fm)));
    done(g, H);
  },
  // a teacher's browline glasses: thick top bar, thin gold rims below
  browline(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .35), gm = H.solid(o.col2 || "#d9b24a", .25, { metalness: .75 }), lm = tintMat("#eef8ff", .15);
    pair(g, C, H, { half: .23, fm, br: .022, by: .07, lens: L => {
      const top = []; for (let k = 0; k <= 20; k++) { const a = k / 20 * Math.PI; top.push([Math.cos(a) * .235, .02 + Math.sin(a) * .18]); } for (let k = 20; k >= 0; k--) { const a = k / 20 * Math.PI; top.push([Math.cos(a) * .2, .05 + Math.sin(a) * .1]); }
      L.add(mesh(thin(poly(top), .04, .01, 2), fm));
      const rim = mesh(new T.TorusGeometry(.2, .012, 8, 32, Math.PI), gm, 0, .03, 0); rim.rotation.z = Math.PI; rim.scale.y = .9; L.add(rim);
      const l = new T.Mesh(new T.CircleGeometry(.2, 32, Math.PI, Math.PI), lm); l.position.set(0, .03, .002); l.scale.y = .9; L.add(l); } });
    done(g, H);
  },
  // big ski goggles with a sunset-coloured wrap lens and a striped strap
  ski(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .5), TH = .95, EA = .8, EB = .82, LH = .4, y = C.Y + .03;
    const st = tex(H, "sunset", 64, 128, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); [["#ffd23a", 0], ["#ff8a3d", .35], ["#ff4f8b", .65], ["#7b3fe4", 1]].forEach(([c, k]) => gr.addColorStop(k, c)); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
    const lens = K(new T.Mesh(new T.CylinderGeometry(1, 1, LH, 56, 1, true, -TH, TH * 2).scale(EA, 1, EB), new T.MeshStandardMaterial({ map: st, roughness: .1, metalness: .4, transparent: true, opacity: .62, side: T.DoubleSide, depthWrite: false, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: .25 })));
    lens.position.y = y; lens.renderOrder = 3; g.add(lens);
    const arc = yy => Array.from({ length: 41 }, (_, k) => { const a = -TH + 2 * TH * k / 40; return V(EA * Math.sin(a), yy, EB * Math.cos(a)); });
    const loop = [...arc(y + LH / 2), ...arc(y - LH / 2).reverse()];
    g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(loop, true, "catmullrom", .1), 160, .045, 8, true), fm));
    const sm = new T.MeshStandardMaterial({ map: stripeTex(H, [o.col2, o.col3 || "#ffffff"], 10, "ski" + o.col2), roughness: .6 });
    const s2 = K(new T.Mesh(new T.TorusGeometry(.66, .045, 8, 48, Math.PI * 1.25), sm)); s2.rotation.set(Math.PI / 2, 0, Math.PI * 1.125); s2.position.set(0, y, -.02); s2.scale.set(1, .92, 1.6); g.add(s2);
    done(g, H);
  },
  // a diving mask with a snorkel and bubbles floating up
  divemask(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .5), TH = .8, EA = .78, EB = .8, y = C.Y + .02;
    const gm = tintMat("#bfeaff", .3, { side: T.DoubleSide, depthWrite: false });
    const sh = K(new T.Mesh(new T.CylinderGeometry(1, 1, .44, 48, 1, true, -TH, TH * 2).scale(EA, 1, EB), gm)); sh.position.y = y; sh.renderOrder = 3; g.add(sh);
    const arc = yy => Array.from({ length: 33 }, (_, k) => { const a = -TH + 2 * TH * k / 32; return V(EA * Math.sin(a), yy, EB * Math.cos(a)); });
    const loop = [...arc(y + .22), ...arc(y - .22).reverse()];
    g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(loop, true, "catmullrom", .1), 140, .04, 8, true), fm));
    strap(g, fm, y, .04);
    const sp = [V(-.68, C.Y - .25, .2), V(-.74, C.Y + .1, .05), V(-.74, C.Y + .6, -.05), V(-.7, C.Y + .85, -.08)];
    g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(sp), 24, .04, 10), H.solid(o.col2, .45)));
    g.add(mesh(new T.CylinderGeometry(.05, .05, .08, 12), H.solid(o.col3 || "#ffd23a", .4), -.7, C.Y + .9, -.08));
    const bm = new T.MeshStandardMaterial({ color: "#dff6ff", transparent: true, opacity: .55, roughness: .05, metalness: .2, depthWrite: false });
    const bb = new T.Group(); [[0, 0, .045], [.06, .11, .03], [-.03, .2, .025], [.04, .3, .018]].forEach(([x, yy, r]) => bb.add(mesh(new T.SphereGeometry(r, 10, 8), bm, x, yy, 0))); bb.position.set(-.7, C.Y + 1.0, -.08); g.add(bb);
    done(g, H);
    const bub = g.children.find(m => m.isMesh && m.material === bm);
    if (bub) { let last = 0; H.anim(t => { const ph = (t * .6) % 1, d = ph * .3; bub.geometry.translate(0, d - last, 0); last = d; bm.opacity = .6 * (1 - ph) * Math.min(1, ph * 6); }); }
  },
  // members: diamond-shaped sparkly frames with gems at the corners
  diamondglasses(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .15, { metalness: .9 }), lm = tintMat(o.col2 || "#bff4ff", .35, { metalness: .3 }),
      gm = H.solid("#ffffff", .05, { metalness: .2, emissive: o.col2 || "#bff4ff", emissiveIntensity: .6 });
    const dia = k => [[.27 * k, 0], [0, .23 * k], [-.27 * k, 0], [0, -.23 * k]];
    pair(g, C, H, { half: .26, fm, lens: (L, s) => { framed(L, C, dia(1), dia(.8), fm, lm); glint(L);
      [[.27 * s, 0, .05], [0, .23, .04], [0, -.23, .035]].forEach(([x, y, r]) => { const d = mesh(new T.OctahedronGeometry(r, 0), gm, x, y, .02); d.scale.z = .6; L.add(d); }); } });
    done(g, H);
    H.anim(t => { gm.emissiveIntensity = .4 + .9 * Math.abs(Math.sin(t * 3.3)); });
  },
  // members: rainbow frames whose colours run round and round, with twinkling sparkles
  rainbowglasses(o, g, C, H) {
    T = H.THREE; const rt = tex(H, "rainbowring", 256, 8, (x, w, h) => { for (let i = 0; i < w; i++) { x.fillStyle = `hsl(${i / w * 360},95%,58%)`; x.fillRect(i, 0, 1, h); } }, [2, 1]);
    const fm = new T.MeshStandardMaterial({ map: rt, roughness: .3, emissive: "#ffffff", emissiveMap: rt, emissiveIntensity: .35 }), lm = tintMat("#ffffff", .15), sp = H.solid("#ffffff", .2, { emissive: "#fff6b0", emissiveIntensity: 1 });
    const plain = H.solid(o.frame, .3);
    pair(g, C, H, { half: .22, fm: plain, lens: (L, s) => { L.add(K(new T.Mesh(new T.TorusGeometry(.215, .035, 12, 64), fm))); const l = new T.Mesh(new T.CircleGeometry(.2, 32), lm); l.position.z = .004; L.add(l); glint(L);
      L.add(mesh(thin(poly(starPts(.06, .018, 4)), .01, .003, 2), sp, .2 * s, .2, .03)); L.add(mesh(thin(poly(starPts(.04, .012, 4)), .01, .003, 2), sp, -.2 * s, -.17, .03)); } });
    done(g, H);
    H.anim(t => { rt.offset.x = (t * .3) % 1; sp.emissiveIntensity = .3 + Math.abs(Math.sin(t * 2.7)); });
  },
  // members: gold frames with a tiny crown on the bridge
  crownglasses(o, g, C, H) {
    T = H.THREE; const fm = gold(H, o.frame, .2), lm = tintMat(o.col2 || "#ffe9a8", .25), gem = H.solid("#ff3b6b", .15, { emissive: "#ff3b6b", emissiveIntensity: .4 });
    pair(g, C, H, { half: .22, fm, lens: L => { const r = new T.Mesh(new T.TorusGeometry(.21, .03, 12, 48), fm); r.scale.set(1.05, .92, 1); L.add(r); const l = new T.Mesh(new T.CircleGeometry(.2, 32), lm); l.scale.set(1.05, .92, 1); l.position.z = .004; L.add(l); glint(L); } });
    const cy = C.Y + .13, cz = C.Z + .01;
    g.add(mesh(thin(poly([[-.09, 0], [.09, 0], [.1, .12], [.05, .06], [0, .14], [-.05, .06], [-.1, .12]]), .03, .008, 2), fm, 0, cy, cz));
    [-.1, 0, .1].forEach((x, k) => g.add(mesh(new T.SphereGeometry(.018, 8, 6), fm, x, cy + (k === 1 ? .145 : .125), cz)));
    g.add(mesh(new T.OctahedronGeometry(.025, 0), gem, 0, cy + .04, cz + .025));
    done(g, H);
  },
  // members: star frames that keep changing colour
  starshift(o, g, C, H) {
    T = H.THREE; const fm = H.solid("#ff5fa8", .3, { metalness: .3, emissive: "#ff5fa8", emissiveIntensity: .35 }), lm = tintMat("#ffffff", .2);
    pair(g, C, H, { half: .2, fm, lens: L => { const sh = C.starShape(.3, .17), hole = new T.Path(); hole.absarc(0, 0, .15, 0, Math.PI * 2, true); sh.holes.push(hole); const f = C.ext(sh, fm); f.position.z = -.015; L.add(f);
      const l = new T.Mesh(new T.CircleGeometry(.15, 30), lm); l.position.z = .004; L.add(l); glint(L, -.05, .03, .12); } });
    done(g, H);
    H.anim(t => { fm.color.setHSL((t * .1) % 1, .9, .58); fm.emissive.copy(fm.color); });
  },
  // members: a sparkly masquerade mask with feathers on one side
  masquerade(o, g, C, H) {
    T = H.THREE;
    const sh = new T.Shape(), W = .6; sh.moveTo(0, .1);
    sh.quadraticCurveTo(.2, .24, .38, .2); sh.quadraticCurveTo(.56, .2, W + .1, .34); sh.quadraticCurveTo(W + .06, .1, W - .04, -.06); sh.quadraticCurveTo(W - .2, -.22, .3, -.2); sh.quadraticCurveTo(.12, -.18, 0, -.08);
    sh.quadraticCurveTo(-.12, -.18, -.3, -.2); sh.quadraticCurveTo(-W + .2, -.22, -W + .04, -.06); sh.quadraticCurveTo(-W - .06, .1, -W - .1, .34); sh.quadraticCurveTo(-.56, .2, -.38, .2); sh.quadraticCurveTo(-.2, .24, 0, .1);
    [C.eyeL, C.eyeR].forEach(e => { const hole = new T.Path(); hole.absellipse(e.x, 0, .15, .11, 0, Math.PI * 2, true); sh.holes.push(hole); });
    const gt = tex(H, "glitter" + o.frame + o.col2, 128, 128, (x, w, h) => { x.fillStyle = o.frame; x.fillRect(0, 0, w, h); let s = 5; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 260; i++) { x.fillStyle = R() < .6 ? o.col2 : "rgba(255,255,255,.9)"; x.fillRect(R() * w, R() * h, 2, 2); } }, [5, 5]);
    const mm = new T.MeshStandardMaterial({ map: gt, roughness: .3, metalness: .5, emissive: "#ffffff", emissiveMap: gt, emissiveIntensity: .25 });
    const m = K(new T.Mesh(new T.ExtrudeGeometry(sh, { depth: .03, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 2, curveSegments: 20 }), mm));
    m.position.set(0, C.Y + .01, C.Z - .01); const bend = m.geometry.attributes.position; for (let k = 0; k < bend.count; k++) { const vx = bend.getX(k); bend.setZ(k, bend.getZ(k) - vx * vx * .28); } m.geometry.computeVertexNormals(); g.add(m);
    g.add(mesh(new T.OctahedronGeometry(.04, 0), H.solid("#ffffff", .05, { emissive: o.col2, emissiveIntensity: .7 }), 0, C.Y + .08, C.Z + .03));
    const fc = [o.col2, "#ffffff", o.col3 || "#ffd23a"];
    [[0, .25, -.3], [.12, .22, -.65], [-.1, .2, .05]].forEach(([ox, L, r], k) => { const f = mesh(new T.SphereGeometry(.07, 12, 8), H.solid(fc[k], .6), .66 + ox, C.Y + .32 + L * .5, C.Z - .32); f.scale.set(.55, L / .07 * .5, .2); f.rotation.z = r; g.add(f); });
    g.add(mesh(new T.SphereGeometry(.04, 10, 8), gold(H, o.col3 || "#ffd23a", .3), .67, C.Y + .25, C.Z - .3));
    [-1, 1].forEach(s => { const sp = new T.Mesh(new T.TorusGeometry(.66, .014, 6, 24, Math.PI * .55), H.solid("#1d1d24", .6)); sp.rotation.set(Math.PI / 2, 0, s > 0 ? -.12 : Math.PI + .12); sp.position.set(0, C.Y + .04, -.04); g.add(sp); });
    done(g, H);
  },
  // members: a sleek band from the future with a light running back and forth along it
  scanner(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .2, { metalness: .6 }), TH = 1.05, EA = .79, EB = .81, LH = .25, y = C.Y + .03;
    const lt = tex(H, "scan" + o.col2, 256, 16, (x, w, h) => { x.fillStyle = "#06080f"; x.fillRect(0, 0, w, h); const gr = x.createLinearGradient(w * .3, 0, w * .7, 0);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(.38, o.col2); gr.addColorStop(.5, "#ffffff"); gr.addColorStop(.62, o.col2); gr.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gr; x.fillRect(w * .3, 3, w * .4, h - 6);
      x.fillStyle = "rgba(255,255,255,.15)"; for (let i = 0; i < w; i += 8) x.fillRect(i, 2, 1, h - 4); });
    lt.wrapS = T.RepeatWrapping;
    const band = K(new T.Mesh(new T.CylinderGeometry(1, 1, LH, 64, 1, true, -TH, TH * 2).scale(EA, 1, EB), new T.MeshStandardMaterial({ color: "#000000", map: lt, emissive: "#ffffff", emissiveMap: lt, emissiveIntensity: 1.2, roughness: .15, metalness: .3, side: T.DoubleSide })));
    band.position.y = y; g.add(band);
    const arc = yy => Array.from({ length: 41 }, (_, k) => { const a = -TH + 2 * TH * k / 40; return V(EA * 1.005 * Math.sin(a), yy, EB * 1.005 * Math.cos(a)); });
    [LH / 2, -LH / 2].forEach(d => g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(arc(y + d)), 64, .025, 8), fm)));
    [-1, 1].forEach(sd => { g.add(mesh(new T.CylinderGeometry(.045, .045, LH + .06, 12), fm, sd * EA * Math.sin(TH), y, EB * Math.cos(TH))); g.add(C.rod([sd * EA * Math.sin(TH), y + .02, EB * Math.cos(TH)], [sd * .66, C.Y + .05, -.12], .022, fm)); });
    done(g, H);
    H.anim(t => { const p = (t * .45) % 2, k = p < 1 ? p : 2 - p; lt.offset.x = k * .8 - .4; });
  },
  // hypnosis glasses: round frames, a spiral spinning in each lens
  hypno(o, g, C, H) {
    T = H.THREE; const fm = H.solid(o.frame, .35), st = spiralTex(H, o.col2, o.col3 || "#ffffff", o.rainbow);
    st.center.set(.5, .5);
    const lm = new T.MeshStandardMaterial({ map: st, roughness: .3, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: .25 });
    pair(g, C, H, { half: .21, fm, lens: L => { L.add(new T.Mesh(new T.TorusGeometry(.205, .03, 12, 48), fm)); const l = K(new T.Mesh(new T.CircleGeometry(.2, 40), lm)); l.position.z = .004; L.add(l); glint(L); } });
    done(g, H);
    H.anim(t => { st.rotation = -t * 2.6; });
  },
  // reading glasses: thin half-moon frames sitting low on the nose
  reading(o, g, C, H) {
    T = H.THREE; const tort = o.tortoise, fm = tort ? new T.MeshStandardMaterial({ map: tortoiseTex(H), roughness: .3 }) : H.solid(o.frame, o.metal ? .25 : .35, o.metal ? { metalness: .8 } : {}), lm = tintMat("#eef8ff", .16);
    const hm = (rx, ry, top) => { const p = [[-rx, top], [rx, top]]; for (let k = 1; k < 32; k++) { const a = -k / 32 * Math.PI; p.push([Math.cos(a) * rx, top + Math.sin(a) * ry]); } return p; };
    const pm = tort ? H.solid("#6b3a17", .35) : fm;
    pair(g, C, H, { half: .21, dy: -.08, by: .025, br: .014, fm: pm, lens: L => { const sh = poly(hm(.215, .16, .04)); sh.holes.push(pathOf(hm(.19, .135, .02)));
      const f = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: .02, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 1, curveSegments: 12 }), fm); f.position.z = -.01; if (tort) K(f); L.add(f);
      const l = new T.Mesh(new T.ShapeGeometry(poly(hm(.19, .135, .02)), 16), lm); l.position.z = .004; L.add(l); glint(L, -.06, -.04, .1); } });
    done(g, H);
  },
};

/* =================================================================== NECK =================================================================== */
// a little group hanging in front of the chest, turned to face forward (p = where)
function pend(C, p) { const q = new T.Group(); q.position.copy(p); q.rotation.x = -.25; C.g.add(q); return q; }
// a flat shape pendant (sh) facing forward at p
function flatPend(C, sh, m, p, d = .03) { const q = pend(C, p); q.add(mesh(thin(sh, d, .01, 12), m)); return q; }
// a thin cord round the neck (not the chain): material m
const cord = (C, m, r = .014, drop = .32) => C.g.add(new T.Mesh(new T.TubeGeometry(C.loop(drop), 96, r, 6, true), m));
// things along the front part of the loop only (u from .. to, 0 = the middle of the front)
function frontAlong(C, n, from, to, fn, drop = .32) { const c = C.loop(drop); for (let i = 0; i < n; i++) { const u = ((from + (to - from) * i / (n - 1)) % 1 + 1) % 1; fn(c.getPointAt(u), i, c.getTangentAt(u)); } }
// a scarf end WITH texture coordinates (u round, v along); end = how thick the tip stays
function lockUV(pts, r0, flat = .32, seg = 20, rad = 10, end = .9) {
  const curve = new T.CatmullRomCurve3(pts, false, "centripetal"), fr = curve.computeFrenetFrames(seg, false), pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg, p = curve.getPointAt(t), r = r0 * (1 - t * (1 - end)), N = fr.normals[i], B = fr.binormals[i];
    for (let j = 0; j <= rad; j++) { const a = j / rad * Math.PI * 2, cx = Math.cos(a) * r, sy = Math.sin(a) * r * flat; pos.push(p.x + N.x * cx + B.x * sy, p.y + N.y * cx + B.y * sy, p.z + N.z * cx + B.z * sy); uv.push(j / rad, t); } }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) { const a = i * (rad + 1) + j, b = a + 1, c = a + rad + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const plateShape = (w, h, r) => { const s = new T.Shape(); s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); return s; };

export const NECK_STYLES = {
  // a gold chain with a name plate that says JUMPI
  nameplate(o, C, H) {
    T = H.THREE; C.chain(.014);
    const q = pend(C, C.front(.2)), gm = gold(H, o.col, .15);
    q.add(mesh(thin(plateShape(.36, .12, .05), .025, .008, 6), gm));
    const tt = tex(H, "jumpi" + o.col2, 256, 96, (x, W, HH) => { x.clearRect(0, 0, W, HH); x.font = `64px "Lilita One", "Arial Rounded MT Bold", sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 8; x.strokeStyle = "rgba(255,255,255,.7)"; x.strokeText("JUMPI", W / 2, HH / 2 + 3); x.fillStyle = o.col2; x.fillText("JUMPI", W / 2, HH / 2 + 3); });
    q.add(K(mesh(new T.PlaneGeometry(.32, .12), new T.MeshStandardMaterial({ map: tt, transparent: true, roughness: .4, metalness: .3, depthWrite: false }), 0, 0, .025)));
    [-1, 1].forEach(sd => q.add(mesh(new T.TorusGeometry(.018, .006, 6, 12), gm, sd * .17, .07, 0)));
    flatten(C.g);
  },
  // half of a best-friends heart (the zig-zag edge where it broke in two)
  halfheart(o, C, H) {
    T = H.THREE; C.chain(.013); const s = .15;
    const left = heartPts(s, 40, Math.PI, Math.PI * 2), top = left[left.length - 1][1], bot = left[0][1], zig = [];
    for (let k = 1; k < 7; k++) zig.push([k % 2 ? .022 : -.012, top + (bot - top) * k / 7]);
    flatPend(C, poly([...left, ...zig]), H.solid(o.col2, .3, { metalness: .5 }), C.front(.17).add(V(-.01, 0, 0)), .03);
    flatten(C.g);
  },
  // seashells on a cord
  shells(o, C, H) {
    T = H.THREE; cord(C, H.solid(o.col, .7), .012);
    const ms = ["#fff1e0", "#ffc9b5", "#ffe7a8", "#ffd6e6"].map(c => H.solid(c, .45)), bm = H.solid(o.col2, .3);
    const scallop = poly(Array.from({ length: 30 }, (_, k) => { const a = Math.PI * .1 + k / 29 * Math.PI * .8, r = .09 * (1 + .08 * Math.abs(Math.sin(a * 9))); return [Math.cos(a) * r, Math.sin(a) * r - .05]; }).concat([[.015, -.06], [0, -.075], [-.015, -.06]]));
    frontAlong(C, 7, -.12, .12, (p, i) => { if (i === 3) return; const q = new T.Group(); q.position.copy(p).add(V(0, -.02, 0)); q.lookAt(p.clone().add(V(p.x, -.1, p.z))); C.g.add(q);
      if (i % 2 === 0) { const sh = mesh(thin(scallop, .025, .01, 4), ms[(i / 2) % 4]); sh.rotation.z = Math.PI; sh.scale.setScalar(.85); q.add(sh); }
      else q.add(mesh(new T.SphereGeometry(.03, 10, 8), bm)); });
    const mid = pend(C, C.front(.13)), sp = mesh(new T.ConeGeometry(.05, .15, 14), ms[1]); sp.rotation.z = Math.PI; mid.add(sp);
    for (let k = 0; k < 3; k++) { const r = mesh(new T.TorusGeometry(.045 - k * .012, .012, 6, 16), ms[2], 0, .05 - k * .035, 0); r.rotation.x = Math.PI / 2; mid.add(r); }
    flatten(C.g);
  },
  // a little old key
  keynecklace(o, C, H) {
    T = H.THREE; C.chain(.012); const q = pend(C, C.front(.16)), gm = gold(H, o.col2, .15);
    q.add(mesh(new T.TorusGeometry(.045, .016, 8, 20), gm, 0, .07, 0));
    q.add(mesh(new T.TorusGeometry(.022, .01, 6, 14), gm, 0, .07, 0));
    q.add(mesh(new T.CylinderGeometry(.014, .014, .17, 8), gm, 0, -.04, 0));
    q.add(mesh(new T.BoxGeometry(.05, .02, .018), gm, .025, -.1, 0)); q.add(mesh(new T.BoxGeometry(.035, .02, .018), gm, .018, -.06, 0));
    flatten(C.g);
  },
  // a silver disc with a pink paw print
  paw(o, C, H) {
    T = H.THREE; C.chain(.012); const q = pend(C, C.front(.17)), pm = H.solid(o.col2, .45);
    const d = mesh(new T.CylinderGeometry(.1, .1, .022, 28), H.solid(o.col, .25, { metalness: .7 })); d.rotation.x = Math.PI / 2; q.add(d);
    const pad = mesh(new T.SphereGeometry(.045, 14, 10), pm, 0, -.025, .015); pad.scale.set(1.15, .9, .35); q.add(pad);
    [[-.055, .025], [-.02, .055], [.02, .055], [.055, .025]].forEach(([x, y]) => { const t = mesh(new T.SphereGeometry(.018, 10, 8), pm, x, y, .015); t.scale.set(1, 1.2, .5); q.add(t); });
    flatten(C.g);
  },
  // a rainbow with two little clouds
  rainbownecklace(o, C, H) {
    T = H.THREE; C.chain(.012); const q = pend(C, C.front(.15));
    ["#ff4f5f", "#ff9a1f", "#ffe94a", "#4fe07a", "#3fb8ff", "#9a5cff"].forEach((c, k) => q.add(mesh(new T.TorusGeometry(.13 - k * .017, .01, 6, 24, Math.PI), H.solid(c, .4), 0, -.03, 0)));
    const cm = H.solid("#ffffff", .7); [-1, 1].forEach(sd => [[0, 0, .03], [.025, .015, .025], [-.025, .01, .022]].forEach(([x, y, r]) => q.add(mesh(new T.SphereGeometry(r, 10, 8), cm, sd * .115 + x, -.035 + y, .01))));
    flatten(C.g);
  },
  // a gold crescent moon with a star
  moonstar(o, C, H) {
    T = H.THREE; C.chain(.012); const q = pend(C, C.front(.16)), gm = gold(H, o.col2, .2);
    const cr = []; for (let k = 0; k <= 24; k++) { const a = Math.PI * .3 + k / 24 * Math.PI * 1.4; cr.push([Math.cos(a) * .1, Math.sin(a) * .1]); } for (let k = 24; k >= 0; k--) { const a = Math.PI * .42 + k / 24 * Math.PI * 1.16; cr.push([Math.cos(a) * .078 - .03, Math.sin(a) * .078]); }
    q.add(mesh(thin(poly(cr), .025, .008, 2), gm));
    q.add(mesh(thin(poly(starPts(.04, .017)), .02, .006, 2), gm, .03, 0, 0));
    flatten(C.g);
  },
  // a big sunflower on a green cord
  sunflower(o, C, H) {
    T = H.THREE; cord(C, H.solid("#3f9a3a", .7), .013); const q = pend(C, C.front(.16)), pm = H.solid(o.col, .5), pm2 = H.solid(new T.Color(o.col).lerp(new T.Color("#ff8a1c"), .35), .5);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, p = mesh(new T.SphereGeometry(.035, 10, 6), k % 2 ? pm : pm2, Math.cos(a) * .075, Math.sin(a) * .075, -.005); p.rotation.z = a; p.scale.set(1.6, .7, .3); q.add(p); }
    const c = mesh(new T.SphereGeometry(.05, 16, 10), H.solid(o.col2, .7), 0, 0, .01); c.scale.z = .45; q.add(c);
    const dm = H.solid("#2a1608", .7); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; q.add(mesh(new T.SphereGeometry(.008, 6, 4), dm, Math.cos(a) * .028, Math.sin(a) * .028, .03)); }
    flatten(C.g);
  },
  // a sea turtle on a cord of blue beads
  turtle(o, C, H) {
    T = H.THREE; cord(C, H.solid("#2a6b8a", .7), .011);
    const bm = [H.solid("#3fb8ff", .3), H.solid("#ffffff", .3)]; frontAlong(C, 10, -.17, .17, (p, i) => { if (i === 4 || i === 5) return; C.g.add(mesh(new T.SphereGeometry(.025, 8, 6), bm[i % 2], p.x, p.y, p.z)); });
    const q = pend(C, C.front(.15)), sm = H.solid(o.col, .5), sk = H.solid(o.col2, .6), dk = H.solid(new T.Color(o.col).lerp(new T.Color("#000"), .3), .5);
    const sh = mesh(new T.SphereGeometry(.08, 18, 12), sm); sh.scale.set(1, 1.15, .45); q.add(sh);
    [[0, .02], [-.035, -.025], [.035, -.025], [0, -.06], [-.04, .04], [.04, .04]].forEach(([x, y]) => { const s = mesh(new T.CylinderGeometry(.022, .022, .01, 6), dk, x, y, .035); s.rotation.x = Math.PI / 2; q.add(s); });
    q.add(mesh(new T.SphereGeometry(.035, 12, 8), sk, 0, .11, 0));
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sy]) => { const f = mesh(new T.SphereGeometry(.035, 10, 6), sk, sx * .08, sy * .055, 0); f.scale.set(1.4, .6, .35); f.rotation.z = sx * sy * .6; q.add(f); });
    [-1, 1].forEach(sd => q.add(mesh(new T.SphereGeometry(.007, 6, 4), H.solid("#1d1d24", .3), sd * .014, .125, .025)));
    flatten(C.g);
  },
  // wooden beads: round and tube beads in three wood colours
  woodbeads(o, C, H) {
    T = H.THREE; const c = C.loop(), ms = ["#b07a45", "#7a4a24", "#d9a86a"].map(x => H.solid(x, .55)), sg = new T.SphereGeometry(.045, 12, 10), tg = new T.CylinderGeometry(.03, .03, .07, 12);
    cord(C, H.solid("#4a2e1a", .7), .008);
    C.along(c, 32, (p, i) => { if (i % 3 === 2) { const m = mesh(tg, ms[1], p.x, p.y, p.z); m.quaternion.setFromUnitVectors(V(0, 1, 0), c.getTangentAt(i / 32)); C.g.add(m); } else C.g.add(mesh(sg, ms[i % 3 === 0 ? 0 : 2], p.x, p.y, p.z)); });
    flatten(C.g);
  },
  // a candy necklace: pastel candy rings on an elastic
  candy(o, C, H) {
    T = H.THREE; const c = C.loop(), ms = ["#ffb3d1", "#fff1a8", "#b5f5d8", "#d6c2ff", "#a8e2ff", "#ffcfa8"].map(x => H.solid(x, .4)), cg = new T.CylinderGeometry(.04, .04, .035, 14);
    cord(C, H.solid("#ffffff", .5), .007);
    C.along(c, 36, (p, i) => { const m = mesh(cg, ms[i % ms.length], p.x, p.y, p.z); m.quaternion.setFromUnitVectors(V(0, 1, 0), c.getTangentAt(i / 36)); C.g.add(m); });
    flatten(C.g);
  },
  // a puffy polka-dot bow tie
  dotbowtie(o, C, H) {
    T = H.THREE; const q = new T.Group(); q.position.copy(C.front(.42, 1.12)); C.g.add(q);
    const bm = H.solid(o.col, .5), dm = H.solid(o.col2, .5), dg = new T.SphereGeometry(.016, 8, 6);
    [-1, 1].forEach(s => { const cx = s * .12, a = .13, b = .1, cz = .06; const l = mesh(new T.SphereGeometry(1, 20, 14), bm, cx, 0, 0); l.scale.set(a, b, cz); q.add(l);
      [[.3, .4], [-.25, .45], [.55, -.2], [0, -.5], [-.6, -.05], [.1, .05], [.75, .3]].forEach(([u, v]) => { const n = Math.sqrt(Math.max(0, 1 - u * u - v * v)); const d = mesh(dg, dm, cx + s * u * a, v * b, n * cz); orient(d, V(s * u / a, v / b, n / cz)); d.scale.z = .5; q.add(d); }); });
    const k = mesh(new T.SphereGeometry(.05, 12, 10), bm, 0, 0, .03); k.scale.set(1, 1.15, .8); q.add(k);
    flatten(C.g);
  },
  // a knitted scarf in stripes (o.cols); o.chunky = the thick winter one with a knit pattern; fringe on the ends
  knitscarf(o, C, H) {
    T = H.THREE; const chunky = !!o.chunky, cols = o.cols;
    const kt = tex(H, "knit" + cols.join() + chunky, 128, 256, (x, w, h) => { const n = cols.length * (chunky ? 2 : 3), bh = h / n;
      for (let i = 0; i < n; i++) { x.fillStyle = cols[i % cols.length]; x.fillRect(0, i * bh, w, bh + 1); }
      if (chunky) { x.strokeStyle = "rgba(0,0,0,.16)"; x.lineWidth = 3; for (let yy = 0; yy < h; yy += 12) for (let xx = 0; xx < w; xx += 16) { x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + 8, yy + 10); x.lineTo(xx + 16, yy); x.stroke(); } } });
    const mk = rep => { const t = kt.clone(); t.wrapS = t.wrapT = T.RepeatWrapping; t.needsUpdate = true; t.repeat.set(...rep); return new T.MeshStandardMaterial({ map: t, roughness: .9 }); };
    const r = chunky ? .11 : .085, loop = C.loop(chunky ? .1 : .08, .64, chunky ? 1.1 : 1.08);
    const tube = new T.TubeGeometry(loop, 80, r, 12, true), tp = tube.attributes.uv; for (let k = 0; k < tp.count; k++) tp.setXY(k, tp.getY(k), tp.getX(k));
    C.g.add(K(new T.Mesh(tube, mk([1, chunky ? 7 : 9]))));
    const em = mk([1, chunky ? 2 : 3]), fr = H.solid(cols[0], .9);
    [[.32, 0], [.52, .07]].forEach(([ph, dz]) => { const pts = [H.bodyPt(ph, .6, 1.16), H.bodyPt(ph + .05, .35, 1.24).add(V(0, 0, dz)), H.bodyPt(ph + .08, .05, 1.26).add(V(0, 0, dz)), H.bodyPt(ph + .1, -.15, 1.26).add(V(0, 0, dz))];
      C.g.add(K(new T.Mesh(lockUV(pts, chunky ? .17 : .13, .32, 20, 12, .9), em)));
      const e = pts[3]; for (let k = 0; k < 6; k++) C.g.add(mesh(new T.CylinderGeometry(.01, .008, .1, 5), fr, e.x + (k - 2.5) * (chunky ? .026 : .02), e.y - .06, e.z)); });
    flatten(C.g);
  },
  // a little camera on a strap
  camera(o, C, H) {
    T = H.THREE; C.g.add(new T.Mesh(new T.TubeGeometry(C.loop(.42), 96, .018, 6, true), H.solid("#3a2a2a", .7)));
    const q = pend(C, C.front(.05, 1.18)), bm = H.solid(o.col, .45), dk = H.solid("#2a2d36", .4);
    q.add(mesh(new T.BoxGeometry(.26, .16, .09), bm)); q.add(mesh(new T.BoxGeometry(.262, .05, .092), dk, 0, -.035, 0));
    const ln = mesh(new T.CylinderGeometry(.055, .06, .06, 24), dk, 0, -.005, .07); ln.rotation.x = Math.PI / 2; q.add(ln);
    const gl = mesh(new T.CylinderGeometry(.04, .04, .01, 24), H.solid("#5fa8ff", .05, { metalness: .6 }), 0, -.005, .1); gl.rotation.x = Math.PI / 2; q.add(gl);
    q.add(mesh(new T.BoxGeometry(.05, .03, .02), H.solid("#ffffff", .3, { emissive: "#ffffff", emissiveIntensity: .3 }), .08, .05, .046));
    q.add(mesh(new T.CylinderGeometry(.018, .018, .02, 12), H.solid(o.col2, .4), -.08, .09, 0));
    flatten(C.g);
  },
  // a pair of music notes
  musicnote(o, C, H) {
    T = H.THREE; C.chain(.012); const q = pend(C, C.front(.15)), gm = gold(H, o.col2, .15);
    [-1, 1].forEach(sd => { const h = mesh(new T.SphereGeometry(.035, 14, 10), gm, sd * .045 - .015, -.06, 0); h.scale.set(1.25, .85, .5); h.rotation.z = .4; q.add(h);
      q.add(mesh(new T.CylinderGeometry(.008, .008, .13, 6), gm, sd * .045 + .022, 0, 0)); });
    const beam = mesh(new T.BoxGeometry(.11, .028, .016), gm, 0, .065, 0); beam.rotation.z = .1; q.add(beam);
    flatten(C.g);
  },
  // members: a glowing moonstone in a silver frame with twinkles
  moonstone(o, C, H) {
    T = H.THREE; C.chain(.012); const q = pend(C, C.front(.17)), sil = H.solid(o.col, .2, { metalness: .85 });
    const st = H.solid(o.col2, .1, { metalness: .1, emissive: o.col2, emissiveIntensity: .5, transparent: true, opacity: .95 }), tw = H.solid("#ffffff", .1, { emissive: "#ffffff", emissiveIntensity: 1 });
    const s = mesh(new T.SphereGeometry(.07, 20, 14), st); s.scale.set(1, 1.3, .5); q.add(s);
    const fr = mesh(new T.TorusGeometry(.075, .013, 8, 32), sil); fr.scale.y = 1.3; q.add(fr);
    [[.11, .1, .022], [-.1, .06, .016], [.08, -.12, .014], [-.07, -.11, .02]].forEach(([x, y, r]) => q.add(mesh(new T.OctahedronGeometry(r, 0), tw, x, y, .02)));
    flatten(C.g);
    H.anim(t => { st.emissiveIntensity = .35 + .4 * (.5 + .5 * Math.sin(t * 2)); st.color.setHSL(.55 + .06 * Math.sin(t * .8), .6, .82); st.emissive.copy(st.color); tw.emissiveIntensity = .2 + Math.abs(Math.sin(t * 3.1)) * 1.1; });
  },
  // members: a crystal that keeps changing colour
  huecrystal(o, C, H) {
    T = H.THREE; C.chain(.012); const q = pend(C, C.front(.15)), sil = H.solid(o.col, .2, { metalness: .85 });
    const cm = H.solid("#ff5fa8", .05, { metalness: .2, emissive: "#ff5fa8", emissiveIntensity: .5, transparent: true, opacity: .9 });
    const c = mesh(new T.OctahedronGeometry(.08, 0), cm, 0, -.03, 0); c.scale.set(.75, 1.6, .55); q.add(c);
    q.add(mesh(new T.CylinderGeometry(.03, .04, .04, 6), sil, 0, .1, 0));
    q.add(mesh(new T.TorusGeometry(.02, .007, 6, 12), sil, 0, .135, 0));
    flatten(C.g);
    H.anim(t => { cm.color.setHSL((t * .08) % 1, .9, .6); cm.emissive.copy(cm.color); });
  },
  // members: a gold whistle with a little crown on it
  whistle(o, C, H) {
    T = H.THREE; C.chain(.013); const q = pend(C, C.front(.13)), gm = gold(H, o.col, .2), gem = H.solid(o.col2, .15, { emissive: o.col2, emissiveIntensity: .45 });
    const b = mesh(new T.CylinderGeometry(.05, .05, .1, 20), gm, 0, -.04, 0); b.rotation.z = Math.PI / 2; b.scale.set(1, 1, .9); q.add(b);
    q.add(mesh(new T.BoxGeometry(.1, .05, .045), gm, .08, -.015, 0));
    q.add(mesh(new T.BoxGeometry(.03, .02, .046), H.solid("#3a2a10", .5), .02, .005, 0));
    q.add(mesh(new T.TorusGeometry(.016, .006, 6, 12), gm, -.04, .02, 0));
    q.add(mesh(thin(poly([[-.04, 0], [.04, 0], [.045, .05], [.022, .025], [0, .06], [-.022, .025], [-.045, .05]]), .015, .005, 2), gm, 0, .01, 0)); q.add(mesh(new T.SphereGeometry(.009, 6, 4), gem, 0, .03, .014));
    flatten(C.g);
  },
  // members: a comet with a glowing star head and a shimmering tail
  comet(o, C, H) {
    T = H.THREE; C.chain(.012); const q = pend(C, C.front(.15));
    const hm = glow(H, o.col, .9), t1 = H.solid(o.col2, .3, { emissive: o.col2, emissiveIntensity: .6, transparent: true, opacity: .85 }), t2 = H.solid(o.col3 || "#ffffff", .3, { emissive: o.col3 || "#ffffff", emissiveIntensity: .5, transparent: true, opacity: .8 });
    q.add(mesh(thin(poly(starPts(.06, .026)), .03, .01, 2), hm, -.05, -.05, .01));
    [[0, .07, t1, .035], [-.03, .045, t2, .025], [.03, .09, t2, .022]].forEach(([dx, dy, m, r]) => q.add(new T.Mesh(H.lockGeo([V(-.04 + dx * .3, -.04 + dy * .1, 0), V(.02 + dx, .02 + dy * .5, 0), V(.08 + dx, .09 + dy * .6, 0)], r, .4, 16, 8), m)));
    flatten(C.g);
    H.anim(t => { hm.emissiveIntensity = .6 + .5 * Math.abs(Math.sin(t * 2.5)); t1.emissiveIntensity = .4 + .4 * Math.sin(t * 3.3); t2.emissiveIntensity = .4 + .4 * Math.sin(t * 3.3 + 2); });
  },
  // members: glittering butterfly wings that flap
  sparklewings(o, C, H) {
    T = H.THREE; const g = C.g;
    const gt = tex(H, "bwing" + o.col + o.col2, 256, 256, (c, W, Hh) => { const gr = c.createRadialGradient(W * .15, Hh * .5, 6, W * .4, Hh * .5, W * .75); gr.addColorStop(0, o.col2); gr.addColorStop(.6, o.col); gr.addColorStop(1, o.col3 || o.col); c.fillStyle = gr; c.fillRect(0, 0, W, Hh);
      c.fillStyle = "rgba(255,255,255,.9)"; [[.6, .3, 16], [.75, .55, 12], [.5, .72, 11], [.35, .25, 8]].forEach(([u, v, r]) => { c.beginPath(); c.arc(u * W, v * Hh, r, 0, 7); c.fill(); });
      let s = 3; const R = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 260; i++) { c.fillStyle = R() < .5 ? "#ffffff" : "#fff6b0"; const x = R() * W, y = R() * Hh, r = R() * 1.8 + .6; c.fillRect(x, y, r, r); }
      c.strokeStyle = "rgba(40,20,60,.65)"; c.lineWidth = 8; c.strokeRect(0, 0, W, Hh); });
    const gl = tex(H, "bglit", 128, 128, (c, W, Hh) => { c.fillStyle = "#000"; c.fillRect(0, 0, W, Hh); let s = 9; const R = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 90; i++) { c.fillStyle = "#ffffff"; c.fillRect(R() * W, R() * Hh, 2, 2); } }, [3, 3]);
    const wm = new T.MeshStandardMaterial({ map: gt, emissive: "#ffffff", emissiveMap: gl, emissiveIntensity: 1, side: T.DoubleSide, transparent: true, opacity: .93, roughness: .35, metalness: .2 });
    // the wings flap in the vertex shader (shared material): each side turns round the upright line through the root
    const RZ = -.38, u = { value: 0 };
    wm.onBeforeCompile = s => { s.uniforms.uFl = u; s.vertexShader = "uniform float uFl;\n" + s.vertexShader.replace("#include <begin_vertex>",
      `#include <begin_vertex>\n{float sd=sign(position.x);float a=sd*(-.35-sin(uFl*4.5)*.45);vec2 d=vec2(position.x,position.z-(${RZ.toFixed(3)}));
       float c=cos(a),sn=sin(a);transformed.x=d.x*c+d.y*sn;transformed.z=${RZ.toFixed(3)}-d.x*sn+d.y*c;}`); };
    wm.customProgramCacheKey = () => "sparklewings";
    const up = new T.Shape(); up.moveTo(0, 0); up.bezierCurveTo(.15, .55, .62, .62, .66, .3); up.bezierCurveTo(.68, .08, .3, .02, 0, 0);
    const lo = new T.Shape(); lo.moveTo(0, 0); lo.bezierCurveTo(.4, -.06, .52, -.42, .3, -.5); lo.bezierCurveTo(.12, -.52, .04, -.2, 0, 0);
    [-1, 1].forEach(sd => [up, lo].forEach(sh => { const ge = shapeUV(sh, .7, 1.2, .35, 0, 16), p = ge.attributes.position;
      for (let k = 0; k < p.count; k++) p.setXYZ(k, sd * (.08 + p.getX(k) * 1.55), .84 + p.getY(k) * 1.55, RZ);
      ge.computeVertexNormals(); g.add(K(new T.Mesh(ge, wm))); }));
    g.add(mesh(new T.CapsuleGeometry(.035, .3, 6, 10), H.solid("#3a2a55", .5), 0, .84, RZ + .01));
    H.anim(t => { u.value = t; gl.offset.set((t * .05) % 1, (t * .03) % 1); wm.emissiveIntensity = .6 + .4 * Math.sin(t * 2); });
    flatten(g);
  },
};
