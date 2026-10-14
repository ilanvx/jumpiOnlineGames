/*
  The autumn 2026 wardrobe: new hairstyles (items in public/shared/items/hair.js), built in the Head node's space
  like the ones in buildHair (public/index.html). HAIR_STYLES[id](cols, g, m1, m2, add, R, H): add meshes to g.
  add(points, radius, i, flat) makes a lock along points (i % 3 === 1 uses the second colour m2); H.hp(th, ph, s) is a
  point on the head (th from the crown, ph round from the front), H.hn its normal, H.capGeo a snug cap.

  Everything here goes through a small kit (below):
    S.cap(front, side, back, scale, lump, freq)  the hair base with its hairline (th of the hairline at the front / sides / back)
    S.lock(points, r, mat, opts)                 a lock that lies flat on the head (opts: flat, taper, pow, bump...)
    S.arc([th,ph], [th,ph], opts)                points along the head from one place to another (for hair pulled to a tie)
    S.hx(u, a, s)                                a point on the head by "across" (u: -1 left .. 1 right) and "round" (a: 0 front, PI/2 top, PI back)
    S.braid(points, r, mat), S.ringlet(...), S.coil(...), S.bundle(...), S.band(...), S.bow(...)
  Natural colours come from the item (cols); members-only styles add their own effects (H.anim on the SHARED m1/m2).
*/
let T = null;
const V = (x, y, z) => new T.Vector3(x, y, z);
const PI = Math.PI;
const dirTP = (th, ph) => V(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
const tpDir = (d) => [Math.acos(Math.max(-1, Math.min(1, d.y))), Math.atan2(d.x, d.z)];

// a lock along a curve. The flat side lies on the head (its thickness points away from the head's centre), so even wide,
// flat locks look combed. Round locks (flat >= .95) use a twist-free frame. Both ends are closed.
function strandGeo(pts, r0, o, HC) {
  const { flat = 0.6, seg = 18, rad = 8, taper = 0.94, pow = 1.35, root = 0.15, rootR = 0.72, bump = 0, bumpN = 0 } = o || {};
  const curve = new T.CatmullRomCurve3(pts, false, "centripetal");
  const pos = [], idx = [], P = new T.Vector3(), Tg = new T.Vector3(), B = new T.Vector3(), N = new T.Vector3(), C = new T.Vector3();
  let prevN = null;
  const ends = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    curve.getPointAt(t, P); curve.getTangentAt(t, Tg);
    if (flat < 0.95) {
      C.set(HC.x, Math.min(HC.y, P.y), HC.z); B.subVectors(P, C); B.addScaledVector(Tg, -B.dot(Tg));
      if (B.lengthSq() < 1e-6) B.set(0, 1, 0).addScaledVector(Tg, -Tg.y);
      if (B.lengthSq() < 1e-6) B.set(1, 0, 0);
      B.normalize(); N.crossVectors(Tg, B).normalize();
    } else {
      if (!prevN) { N.set(0, 1, 0); if (Math.abs(Tg.y) > 0.9) N.set(1, 0, 0); }
      else N.copy(prevN);
      N.addScaledVector(Tg, -N.dot(Tg)).normalize(); prevN = N.clone(); B.crossVectors(Tg, N).normalize();
    }
    let r = r0 * (t < root ? rootR + (t / root) * (1 - rootR) : 1 - Math.pow((t - root) / (1 - root), pow) * taper);
    if (bump) r *= 1 + bump * (Math.abs(Math.sin(t * bumpN * PI)) - 0.5);
    for (let j = 0; j < rad; j++) {
      const a = (j / rad) * PI * 2, cx = Math.cos(a) * r, sy = Math.sin(a) * r * flat;
      pos.push(P.x + N.x * cx + B.x * sy, P.y + N.y * cx + B.y * sy, P.z + N.z * cx + B.z * sy);
    }
    if (i === 0 || i === seg) ends.push([P.clone(), Tg.clone(), r]);
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
    const a = i * rad + j, b = i * rad + ((j + 1) % rad), c = a + rad, d = b + rad;
    idx.push(a, b, c, b, d, c);
  }
  // closed ends: a little dome on each
  ends.forEach(([p, tg, r], e) => {
    const k = pos.length / 3, s = e ? 1 : -1, ring = e ? seg * rad : 0;
    pos.push(p.x + tg.x * r * 0.5 * s, p.y + tg.y * r * 0.5 * s, p.z + tg.z * r * 0.5 * s);
    for (let j = 0; j < rad; j++) { const a = ring + j, b = ring + ((j + 1) % rad); e ? idx.push(a, b, k) : idx.push(b, a, k); }
  });
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

let SPHERE = null, TORUS = null;
function kit(g, m1, m2, H, R) {
  T = H.THREE;
  const { hp, hn, HC } = H;
  SPHERE = SPHERE || new T.SphereGeometry(1, 12, 9);
  TORUS = TORUS || new T.TorusGeometry(1, 0.62, 5, 10);
  const S = {
    g, m1, m2, H, R, hp, hn, HC,
    m: (i) => (i % 3 === 1 ? m2 : m1),
    // short faded hair: the base colour a little darker and matt
    matte() { return new T.MeshStandardMaterial({ color: m1.color, roughness: 0.85, metalness: 0, side: T.DoubleSide }); },
    fade() { return new T.MeshStandardMaterial({ color: m1.color.clone().multiplyScalar(0.72), roughness: 0.75, metalness: 0, side: T.DoubleSide }); },
    mesh(geo, m) { const ms = new T.Mesh(geo, m); g.add(ms); return ms; },
    cap(f, s, b, sc = 1.12, lump = 0.025, freq = 9, m = m1, t0 = 0) { return S.mesh(H.capGeo(f, s, b, sc, lump, freq, t0), m); },
    lock(pts, r, m = m1, o) { return S.mesh(strandGeo(pts, r, o, HC), m); },
    hx(u, a, s = 1) { const q = Math.sqrt(Math.max(0, 1 - u * u)); const [th, ph] = tpDir(V(u, q * Math.sin(a), q * Math.cos(a))); return hp(th, ph, s); },
    // points along the head between two (th, ph) places; s from s0 to s1, lifted by "lift" in the middle
    arc(a, b, { n = 5, s0 = 1.05, s1 = 1.12, lift = 0.05 } = {}) {
      const A = dirTP(a[0], a[1]), B = dirTP(b[0], b[1]), om = Math.acos(Math.max(-1, Math.min(1, A.dot(B)))), out = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        let d;
        if (om < 1e-4) d = A.clone();
        else d = A.clone().multiplyScalar(Math.sin((1 - t) * om) / Math.sin(om)).addScaledVector(B, Math.sin(t * om) / Math.sin(om));
        const [th, ph] = tpDir(d.normalize());
        out.push(hp(th, ph, s0 + (s1 - s0) * t + lift * Math.sin(PI * t)));
      }
      return out;
    },
    // outward (horizontal) direction at ph
    out: (ph) => V(Math.sin(ph), 0, Math.cos(ph)),
    // a sphere-ish lump (for buns, beads, knots)
    ball(p, r, m, sc = [1, 1, 1]) { const s = S.mesh(SPHERE, m); s.position.copy(p); s.scale.set(r * sc[0], r * sc[1], r * sc[2]); return s; },
    // a band round something (axis = dir)
    band(p, dir, r, tube, m) {
      const t = new T.Mesh(new T.TorusGeometry(r, tube, 8, 24), m); t.position.copy(p);
      t.quaternion.setFromUnitVectors(V(0, 0, 1), dir.clone().normalize()); g.add(t); return t;
    },
    // a little round coil of hair (torus) sitting on the head
    coil(p, n, r, m) {
      const t = S.mesh(TORUS, m); t.position.copy(p); t.scale.setScalar(r);
      const d = n.clone().add(V(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(1.4)).normalize();
      t.quaternion.setFromUnitVectors(V(0, 0, 1), d); return t;
    },
    // a spiral curl hanging from p along dir
    ringlet(p, dir, len, rad, turns, r, m, o = {}) {
      dir = dir.clone().normalize();
      const e1 = Math.abs(dir.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0);
      e1.addScaledVector(dir, -e1.dot(dir)).normalize();
      const e2 = new T.Vector3().crossVectors(dir, e1), pts = [], n = Math.max(8, Math.round(turns * 7)), ph0 = o.ph0 || 0;
      for (let i = 0; i <= n; i++) {
        const t = i / n, a = ph0 + t * turns * PI * 2, rr = rad * Math.min(1, t / 0.12) * (1 - (o.shrink || 0.2) * t);
        pts.push(p.clone().addScaledVector(dir, len * t).addScaledVector(e1, Math.cos(a) * rr).addScaledVector(e2, Math.sin(a) * rr));
      }
      return S.lock(pts, r, m, { flat: 1, seg: o.seg || Math.round(turns * 12), rad: o.rad || 6, taper: o.taper ?? 0.7, pow: 2 });
    },
    // a classic three-strand braid along pts: lobes leaning left and right in turn
    braid(pts, r, m, { out = null, taper = 0.35, step = 0.95, mAlt = null } = {}) {
      const c = new T.CatmullRomCurve3(pts, false, "centripetal"), L = c.getLength(), n = Math.max(4, Math.round(L / (r * step)));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, p = c.getPointAt(t), tg = c.getTangentAt(t), rr = r * (1 - taper * t);
        const o = out ? out.clone() : p.clone().sub(HC).setY(0);
        if (o.lengthSq() < 1e-6) o.set(0, 0, 1);
        const side = new T.Vector3().crossVectors(tg, o).normalize(), s = i % 2 ? 1 : -1;
        const d = tg.clone().addScaledVector(side, -s * 0.8).normalize();
        const b = S.mesh(SPHERE, mAlt && i % 2 ? mAlt : m);
        b.position.copy(p).addScaledVector(side, s * rr * 0.42);
        b.quaternion.setFromUnitVectors(V(0, 1, 0), d);
        b.scale.set(rr * 0.62, rr * 1.18, rr * 0.62);
      }
      return c;
    },
    // several locks following one path (a ponytail, a bunch of hair), spread round it
    bundle(path, n, spread, r, o = {}) {
      const c = new T.CatmullRomCurve3(path, false, "centripetal"), K = o.k || 12, prof = o.prof || ((t) => 0.35 + 0.65 * Math.sin(PI * Math.min(1, t * 1.25 + 0.1)));
      for (let k = 0; k < n; k++) {
        const phi = (k / n) * PI * 2 + (o.rot || 0), jit = (R() - 0.5) * 0.3, pts = [];
        for (let i = 0; i <= K; i++) {
          const t = i / K, p = c.getPointAt(t), tg = c.getTangentAt(t);
          const up = Math.abs(tg.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0), e1 = new T.Vector3().crossVectors(tg, up).normalize(), e2 = new T.Vector3().crossVectors(tg, e1);
          const sp = spread * prof(t) * (1 + jit);
          pts.push(p.addScaledVector(e1, Math.cos(phi) * sp).addScaledVector(e2, Math.sin(phi) * sp * (o.flatten || 1)));
        }
        if (o.wave) pts.forEach((p, i) => { p.x += Math.sin(i * 0.9 + k) * o.wave; });
        S.lock(pts, r * (0.85 + R() * 0.3), o.mat || S.m(k), { flat: o.flat ?? 0.75, seg: o.seg || 20, rad: 7, taper: o.taper ?? 0.9 });
      }
      return c;
    },
    // a ribbon bow: at p, facing fwd (the knot's front), "up" = its top
    bow(p, fwd, up, m, sz = 1, tails = true) {
      const grp = new T.Group(), z = fwd.clone().normalize(), y = up.clone().addScaledVector(z, -up.dot(z)).normalize(), x = new T.Vector3().crossVectors(y, z);
      [-1, 1].forEach((s) => {
        const loop = new T.Mesh(new T.TorusGeometry(0.1 * sz, 0.05 * sz, 10, 24), m);
        loop.scale.set(1.25, 0.9, 0.7); loop.position.set(s * 0.13 * sz, 0.01 * sz, 0); loop.rotation.set(0, 0, s * 0.25); grp.add(loop);
        if (tails) grp.add(new T.Mesh(strandGeo([V(0, 0, 0.01 * sz), V(s * 0.05 * sz, -0.1 * sz, 0.03 * sz), V(s * 0.09 * sz, -0.22 * sz, 0.02 * sz)], 0.035 * sz, { flat: 1, taper: 0.25, seg: 8, rad: 6 }, HC), m));
      });
      const knot = new T.Mesh(SPHERE, m); knot.scale.setScalar(0.055 * sz); knot.position.z = 0.02 * sz; grp.add(knot);
      S.place(grp, p, x, y, z);
    },
    // children of a local group (built at the origin) moved to p with a basis, then added to g
    place(grp, p, x, y, z) {
      const M = new T.Matrix4().makeBasis(x, y, z).setPosition(p);
      grp.children.slice().forEach((c) => { c.updateMatrix(); c.applyMatrix4(M); g.add(c); });
    },
  };
  return S;
}

/* ---------------- shared building blocks ---------------- */

// hair falling round the back and sides from the crown, to the tips (len = how far below th thE it hangs)
function curtain(S, { from = 1.15, to = 2 * PI - 1.15, n = 16, th0 = 0.35, sMid = 1.17, len = 0.35, flare = 0.04, inward = 0, wave = 0, waveN = 2, r = 0.13, taper = 0.85, pow = 1.35, flat = 0.6, jitter = 0.04, thE = 1.65, sheet = true } = {}) {
  const { hp, R } = S;
  if (sheet && len > 0.12) hairSheet(S, { from, to, th0: (th0 + thE) * 0.45, thE, s: sMid - 0.03, len: len * 0.8, flare: flare * 0.8 });
  for (let k = 0; k < n; k++) {
    const ph = from + ((to - from) * k) / (n - 1), o = S.out(ph), L = len * (1 + (R() - 0.5) * jitter * 4);
    const side = V(Math.cos(ph), 0, -Math.sin(ph));
    const pts = [hp(th0, ph, 1.04), hp((th0 + thE) * 0.45, ph, sMid), hp(thE - 0.25, ph, sMid + 0.01), hp(thE, ph, sMid)];
    const e = pts[3].clone();
    const m = 4;
    for (let i = 1; i <= m; i++) {
      const t = i / m;
      const p = e.clone().add(V(0, -L * t, 0)).addScaledVector(o, flare * t * t);
      if (wave) p.addScaledVector(side, Math.sin(t * waveN * PI + k) * wave);
      if (inward && i === m) p.addScaledVector(o, -inward);
      pts.push(p);
    }
    S.lock(pts, r * (0.9 + R() * 0.2), S.m(k), { flat, taper, pow, seg: 22 });
  }
}

// a smooth sheet of hair just under the locks of a curtain, so no gaps show between them
function hairSheet(S, { from, to, th0, thE, s, len, flare }) {
  const { hp } = S, NP = 40, NV = 10, pos = [], idx = [];
  for (let j = 0; j <= NP; j++) {
    const ph = from + ((to - from) * j) / NP, o = S.out(ph), e = hp(thE, ph, s);
    for (let i = 0; i <= NV; i++) {
      const t = i / NV;
      let p;
      if (t <= 0.5) p = hp(th0 + (thE - th0) * (t / 0.5), ph, s);
      else { const u = (t - 0.5) / 0.5; p = e.clone().add(V(0, -len * u, 0)).addScaledVector(o, flare * u * u); }
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let j = 0; j < NP; j++) for (let i = 0; i < NV; i++) { const a = j * (NV + 1) + i, b = a + NV + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  S.mesh(g, S.m1);
}

// a blunt straight fringe across the forehead
function fringe(S, { n = 11, w = 1.05, end = 1.06, r = 0.1, lift = 1.17, taper = 0.3 } = {}) {
  const { hp } = S;
  for (let k = 0; k < n; k++) {
    const ph = -w + (k * 2 * w) / (n - 1);
    S.lock([hp(0.2, ph * 0.35, 1.05), hp(0.62, ph * 0.85, lift), hp(0.92, ph, lift), hp(end, ph * 1.02, lift - 0.04)], r, S.m(k), { flat: 0.45, taper, pow: 2.2, seg: 16 });
  }
}

// side-swept bangs from a part (on the left) across to the right temple (dir -1: mirrored)
function sweptBangs(S, { n = 6, part = -0.55, end = 1.04, r = 0.11, dir = 1 } = {}) {
  const { hp } = S;
  for (let k = 0; k < n; k++) {
    const p0 = part, t = k / (n - 1);
    S.lock([hp(0.3, p0 * 0.7, 1.04), hp(0.6 + t * 0.15, dir * (-0.35 + t * 0.45), 1.15), hp(0.85 + t * 0.12, dir * (0.05 + t * 0.6), 1.16), hp(end + t * 0.08, dir * (0.45 + t * 0.7), 1.12)], r * 1.1, S.m(k), { flat: 0.4, taper: 0.9, seg: 16, root: 0.2, rootR: 0.4 });
  }
}

// hair falling from a parting line (part = ph of the part; 0 = centre) and curving away to the temples and over the sides,
// like curtains opening: the front locks frame the forehead without covering it
function partTop(S, { part = 0, n = 6, s = 1.15, thEnd = 1.45, sideW = 1.3 } = {}) {
  const { hp } = S;
  [-1, 1].forEach((sd) => {
    const lim = sd * sideW, at = (f) => part + (lim - part) * f, long = Math.abs(lim - part) > sideW + 0.2;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1), lift = k === 0 ? 0.02 : 0.05;
      const end = hp(Math.min(thEnd, 1.06 + t * 0.4), at(Math.min(1, 0.78 + t * 0.22)), s);
      const m1p = long ? hp(0.5 + t * 0.06, at(0.18 + t * 0.12), s + lift) : hp(0.58 + t * 0.06, at(0.3 + t * 0.12), s + lift);
      const m2p = long ? hp(0.82 + t * 0.08, at(0.5 + t * 0.12), s + lift) : hp(0.9 + t * 0.08, at(0.58 + t * 0.12), s + lift);
      S.lock([hp(0.18 + t * 0.12, at(0.04), 1.05), m1p, m2p, end, end.clone().add(V(sd * 0.02, -0.07, 0.02))], k === 0 ? 0.15 : 0.13, S.m(k), { flat: 0.45, taper: 0.85, seg: 18, root: 0.2, rootR: 0.35 });
    }
  });
}

// hair from the crown and the top (roots along th0) combed down and round to one place (the side braid, the swept side)
function sweepTo(S, G, { from, to, n = 14, th0 = 0.35, s0 = 1.06, s1 = 1.16, lift = 0.05, r = 0.13 }) {
  for (let k = 0; k < n; k++) {
    const ph = from + ((to - from) * k) / (n - 1);
    S.lock(S.arc([th0 + (k % 2) * 0.12, ph], G, { n: 7, s0, s1, lift }), r, S.m(k), { flat: 0.4, taper: 0.45, seg: 20, root: 0.2, rootR: 0.3 });
  }
}

// a smooth edge along the front hairline (hides the roots of hair combed back)
function hairline(S, { hair = [1.0, 1.5, 1.8], w = 1.45, s = 1.06, r = 0.075 } = {}) {
  const [tf, tsd] = hair, pts = [];
  for (let ph = -w; ph <= w + 0.001; ph += w / 8) { const c = Math.cos(ph); pts.push(S.hp(tsd + (tf - tsd) * Math.pow(Math.max(0, c), 1.2) - 0.035, ph, s)); }
  S.lock(pts, r, S.m1, { flat: 0.45, taper: 0.5, pow: 4, root: 0.08, rootR: 0.5, seg: 30 });
}

// locks from a ring of places on the hairline (th of hairline per ph) pulled to a target [th, ph]
function gather(S, target, { n = 18, skip = null, s0 = 1.03, s1 = 1.1, lift = 0.03, r = 0.11, from = -PI, to = PI, hair = [1.0, 1.5, 1.8] } = {}) {
  const [tf, tsd, tb] = hair;
  for (let k = 0; k < n; k++) {
    const ph = from + ((to - from) * (k + 0.5)) / n;
    if (skip && skip(ph)) continue;
    const c = Math.cos(ph), th = c > 0 ? tsd + (tf - tsd) * Math.pow(c, 1.2) : tsd + (tb - tsd) * Math.pow(-c, 1.2);
    const pts = S.arc([th - 0.04, ph], target, { n: 6, s0, s1, lift });
    S.lock(pts, r, k % 4 === 1 ? S.m2 : S.m1, { flat: 0.32, taper: 0.75, seg: 16, root: 0.12, rootR: 0.85 });
  }
}

/* ---------------- the styles ---------------- */
export const HAIR_STYLES = {

  /* ======== boys ======== */

  // curly top with short faded sides
  curlytop(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp, hn } = S;
    S.cap(0.98, 1.4, 1.72, 1.035, 0.004, 16, S.fade());
    S.cap(0.88, 0.78, 0.82, 1.15, 0.05, 7, S.matte());
    // a dense mop of fat spiral curls on top
    for (let k = 0; k < 110; k++) {
      const th = Math.sqrt(R()) * 0.9, ph = R() * PI * 2, c = Math.cos(ph);
      if (th > 0.8 + 0.08 * c) continue;
      const p = hp(th, ph, 1.17 + R() * 0.06), n = hn(th, ph);
      S.ringlet(p.clone().addScaledVector(n, -0.05), n.clone().add(V(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(0.9)), 0.11 + R() * 0.04, 0.032, 2, 0.05, S.m(k), { ph0: R() * 6, taper: 0.35, seg: 12, rad: 5 });
    }
    // the edge of the mop, curling over the fade
    for (let k = 0; k < 22; k++) {
      const ph = (k / 22) * PI * 2, c = Math.cos(ph), th = 0.78 + 0.1 * c + 0.06 * Math.max(0, -c);
      const p = hp(th, ph, 1.13), n = hn(th, ph);
      S.ringlet(p, n.clone().add(V(0, -0.5, 0)).add(S.out(ph).multiplyScalar(0.3)), 0.12, 0.032, 2, 0.05, S.m(k + 1), { ph0: k, taper: 0.35, seg: 12, rad: 5 });
    }
    // the curly fringe falling forward onto the forehead
    for (let k = 0; k < 7; k++) {
      const ph = -0.6 + k * 0.2, p = hp(0.68, ph, 1.2);
      S.ringlet(p, V(Math.sin(ph) * 0.3, -0.75, 0.7), 0.2 + R() * 0.05, 0.035, 2.4, 0.048, S.m(k), { ph0: k * 1.7, taper: 0.5, seg: 14, rad: 5 });
    }
  },

  // pompadour: combed up and back from the forehead into a big smooth wave, short tidy sides
  pompadour(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hx, hp } = S;
    S.cap(1.0, 1.42, 1.72, 1.06, 0.01, 14);
    const top = (u) => 1 - Math.abs(u) * 0.9;
    // the rounded roll at the front
    const roll = [];
    for (let u = -0.6; u <= 0.601; u += 0.12) roll.push(hx(u, 0.86 - Math.abs(u) * 0.12, 1.2 + 0.16 * top(u)));
    S.lock(roll, 0.15, m1, { flat: 0.85, taper: 0.55, pow: 3, root: 0.1, seg: 26, rad: 10 });
    for (let k = 0; k < 15; k++) {
      const u = -0.7 + k * 0.1, w = Math.max(0, top(u));
      S.lock([hx(u, 0.58, 1.03), hx(u, 0.74, 1.2 + 0.2 * w), hx(u * 0.98, 1.0, 1.33 + 0.18 * w), hx(u * 0.97, 1.4, 1.3 + 0.08 * w), hx(u * 0.98, 2.0, 1.16), hx(u, 2.5, 1.07)], 0.15, k % 4 === 2 ? m2 : m1, { flat: 0.55, taper: 0.7, seg: 22 });
    }
    // tidy back
    for (let k = 0; k < 7; k++) { const ph = PI + (k - 3) * 0.3; S.lock([hp(0.75, ph, 1.04), hp(1.2, ph, 1.1), hp(1.6, ph, 1.07)], 0.1, S.m(k), { flat: 0.45 }); }
  },

  // straight fringe across the forehead, neat rounded shape
  fringe(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.06, 1.5, 1.78, 1.12, 0.02, 10);
    fringe(S, { n: 12, w: 1.08, end: 1.07 });
    for (let k = 0; k < 14; k++) {
      const ph = 1.2 + ((2 * PI - 2.4) * k) / 13;
      S.lock([hp(0.25, ph, 1.05), hp(0.8, ph, 1.18), hp(1.3, ph, 1.17), hp(1.62 + 0.15 * Math.max(0, -Math.cos(ph)), ph, 1.12)], 0.12, S.m(k), { flat: 0.45, taper: 0.6, pow: 1.8 });
    }
  },

  // side part, combed over to one side (neat)
  sidepart(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hx, hp } = S;
    S.cap(1.0, 1.45, 1.75, 1.09, 0.012, 12);
    const P = -0.42;   // the parting, on the left
    // the big side: from the part over the top to the right
    for (let k = 0; k < 9; k++) {
      const a = 0.72 + k * 0.2;
      S.lock([hx(P + 0.03, a, 1.05), hx(P + 0.3, a + 0.02, 1.18), hx(0.25, a, 1.2), hx(0.68, a - 0.08, 1.15), hx(0.92, a - 0.2, 1.06)], 0.12, S.m(k), { flat: 0.42, taper: 0.75, seg: 18 });
    }
    // front: the lock that sweeps across the forehead, with a little lift
    for (let k = 0; k < 3; k++) {
      S.lock([hx(P + 0.02, 0.62 + k * 0.05, 1.04), hx(P + 0.3, 0.7 + k * 0.03, 1.22), hx(0.15, 0.68 + k * 0.04, 1.24), hx(0.55, 0.56 + k * 0.05, 1.16), hx(0.85, 0.42 + k * 0.05, 1.07)], 0.13, S.m(k + 1), { flat: 0.42, taper: 0.8 });
    }
    // the small side: from the part down to the left
    for (let k = 0; k < 8; k++) {
      const a = 0.62 + k * 0.24;
      S.lock([hx(P - 0.02, a, 1.05), hx(-0.7, a - 0.04, 1.13), hx(-0.93, a - 0.15, 1.06)], 0.11, S.m(k), { flat: 0.42, taper: 0.75 });
    }
    for (let k = 0; k < 7; k++) { const ph = PI + (k - 3) * 0.3; S.lock([hp(0.85, ph, 1.05), hp(1.25, ph, 1.1), hp(1.62, ph, 1.07)], 0.1, S.m(k), { flat: 0.45 }); }
  },

  // undercut: one side shaved short, long top from a deep part falling over to the other side
  undercut(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hx } = S;
    S.cap(1.0, 1.38, 1.7, 1.03, 0.004, 18, S.fade());
    const P = -0.5;
    for (let k = 0; k < 13; k++) {
      const a = 0.6 + k * 0.15, d = k === 0 ? 0.05 : 0;
      S.lock([hx(P, a, 1.05), hx(P + 0.25, a + 0.03, 1.18), hx(0.15, a + d, 1.24), hx(0.55, a - 0.05, 1.2), hx(0.82, a - 0.14, 1.14), hx(0.95, a - 0.2, 1.1).add(V(0, -0.1, 0))], 0.15, k % 4 === 1 ? m2 : m1, { flat: 0.5, taper: 0.85, seg: 22, root: 0.2, rootR: 0.4 });
    }
    // a smooth ridge along the part
    const ridge = [];
    for (let a = 0.55; a <= 2.56; a += 0.25) ridge.push(hx(P + 0.07, a, 1.14));
    S.lock(ridge, 0.13, m1, { flat: 0.6, taper: 0.6, pow: 3, seg: 24 });
    // the floppy lock over the forehead
    for (let k = 0; k < 3; k++) S.lock([hx(P + 0.1, 0.75 + k * 0.1, 1.2), hx(-0.15 + k * 0.1, 0.72, 1.36), hx(0.15 + k * 0.1, 0.55, 1.24), hx(0.32 + k * 0.1, 0.45, 1.13)], 0.13, k === 1 ? m2 : m1, { flat: 0.5, taper: 0.9 });
  },

  // messy medium hair, sticking out every which way
  messy(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp, hn } = S;
    S.cap(1.03, 1.5, 1.8, 1.14, 0.05, 8);
    for (let k = 0; k < 30; k++) {
      const th = 0.1 + R() * 1.0, ph = R() * PI * 2;
      if (th > 0.65 && Math.cos(ph) > 0.5) continue;
      const root = hp(th, ph, 1.08), n = hn(th, ph), t = V(R() - 0.5, R() * 0.2, R() - 0.5);
      t.addScaledVector(n, -t.dot(n)).normalize();
      const L = 0.2 + R() * 0.14;
      S.lock([root, root.clone().addScaledVector(n, 0.07).addScaledVector(t, L * 0.4), root.clone().addScaledVector(n, 0.1).addScaledVector(t, L * 0.8).add(V(0, -0.02, 0)), root.clone().addScaledVector(n, 0.15 + R() * 0.08).addScaledVector(t, L)], 0.11, S.m(k), { flat: 0.55, taper: 0.95, seg: 14 });
    }
    // messy fringe
    for (let k = 0; k < 7; k++) {
      const ph = -0.75 + k * 0.25 + (R() - 0.5) * 0.1, dp = (R() - 0.5) * 0.5;
      S.lock([hp(0.45, ph * 0.5, 1.06), hp(0.8, ph + dp * 0.5, 1.22), hp(0.98 + R() * 0.06, ph + dp, 1.2)], 0.11, S.m(k), { flat: 0.5, taper: 0.95 });
    }
    // sides and back, uneven lengths with flicks
    for (let k = 0; k < 14; k++) {
      const ph = 1.15 + ((2 * PI - 2.3) * k) / 13, o = S.out(ph), e = hp(1.6 + R() * 0.2, ph + (R() - 0.5) * 0.15, 1.16);
      S.lock([hp(0.5, ph, 1.06), hp(1.05, ph, 1.18), e, e.clone().addScaledVector(o, 0.06 + R() * 0.06).add(V((R() - 0.5) * 0.06, -0.04, 0))], 0.12, S.m(k + 2), { flat: 0.5, taper: 0.95 });
    }
  },

  // short tight curls close to the head
  tightcurls(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp, hn } = S;
    S.cap(0.96, 1.42, 1.72, 1.08, 0.02, 12, S.matte());
    const N = 210, ga = PI * (3 - Math.sqrt(5));
    for (let k = 0; k < N; k++) {
      const y = 1 - (k / (N - 1)) * 1.3, th = Math.acos(Math.max(-1, y)), ph = k * ga;
      const c = Math.cos(ph), tmax = c > 0 ? 1.42 + (0.96 - 1.42) * Math.pow(c, 1.2) : 1.42 + (1.72 - 1.42) * Math.pow(-c, 1.2);
      if (th > tmax - 0.04) continue;
      const n = hn(th, ph);
      S.ringlet(hp(th, ph, 1.08), n.clone().add(V(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(0.8)), 0.07, 0.03, 1.6, 0.048, S.m(k), { ph0: R() * 6, taper: 0.4, seg: 12, rad: 5 });
    }
  },

  // wavy hair down to the neck (skater flow) with curtain bangs
  flow(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.0, 1.58, 1.95, 1.14, 0.03, 9);
    [-1, 1].forEach((sd) => {
      for (let k = 0; k < 4; k++) {
        const p = hp(1.05 + k * 0.12, sd * (0.88 + k * 0.12), 1.2);
        S.lock([hp(0.22, sd * 0.12, 1.05), hp(0.62, sd * (0.32 + k * 0.08), 1.22), hp(0.92, sd * (0.66 + k * 0.1), 1.22), p, p.clone().add(V(sd * 0.05, -0.08, 0.05))], 0.12, S.m(k), { flat: 0.5, taper: 0.9 });
      }
    });
    curtain(S, { from: 1.2, to: 2 * PI - 1.2, n: 22, th0: 0.3, len: 0.2, thE: 1.78, flare: 0.12, wave: 0.035, waveN: 1.5, r: 0.16, taper: 0.75, flat: 0.5, jitter: 0.12 });
  },

  /* ======== girls (and everyone) ======== */

  // one long braid over the shoulder
  sidebraid(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.03, 1.55, 1.85, 1.1, 0.015, 10);
    const G = [1.62, 1.38];
    partTop(S, { part: -0.5, n: 5, s: 1.13, thEnd: 1.4, sideW: 1.25 });
    sweepTo(S, G, { from: -1.2, to: -2 * PI + 2.0, n: 22, th0: 0.3, s1: 1.16, r: 0.12 });
    const g0 = hp(G[0], G[1], 1.15);
    S.braid([g0, g0.clone().add(V(-0.01, -0.22, 0.1)), g0.clone().add(V(-0.08, -0.5, 0.18)), g0.clone().add(V(-0.13, -0.78, 0.2))], 0.15, m1, { out: V(0.6, 0, 0.8), taper: 0.3, mAlt: m2 });
    const tie = g0.clone().add(V(-0.13, -0.8, 0.2));
    S.band(tie, V(0, 1, 0), 0.05, 0.028, H.solid("#ff5fa8", 0.4));
    S.bundle([tie, tie.clone().add(V(0, -0.1, 0)), tie.clone().add(V(0, -0.22, 0.01))], 6, 0.05, 0.05, { flat: 1, taper: 0.9, k: 6, prof: (t) => 0.4 + t });
  },

  // two long braids with ribbons
  longbraids(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.03, 1.55, 1.85, 1.1, 0.015, 10);
    const rib = H.solid("#ff4f7a", 0.4);
    partTop(S, { part: 0, n: 5, s: 1.12, thEnd: 1.35, sideW: 1.2 });
    [-1, 1].forEach((sd) => {
      const G = [1.62, sd * 1.72];
      sweepTo(S, G, { from: sd * 1.0, to: sd * (PI - 0.04), n: 9, th0: 0.3, s1: 1.14, r: 0.12 });
      const g0 = hp(G[0], G[1], 1.15), end = V(sd * 0.5, -0.5, 0.26);
      S.braid([g0, g0.clone().add(V(sd * 0.01, -0.18, 0.12)), V(sd * 0.6, -0.15, 0.3), end], 0.11, m1, { out: V(sd * 0.7, 0, 0.7), taper: 0.3, mAlt: m2 });
      S.bow(end.clone().add(V(0, 0.02, 0.06)), V(sd * 0.4, 0, 1), V(0, 1, 0), rib, 0.65);
      S.bundle([end, end.clone().add(V(0, -0.1, 0.02)), end.clone().add(V(sd * 0.01, -0.2, 0.02))], 5, 0.035, 0.04, { flat: 1, taper: 0.9, k: 6, prof: (t) => 0.5 + t });
    });
  },

  // high ponytail
  hipony(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.0, 1.5, 1.82, 1.07, 0.01, 12);
    const tp = [0.55, PI], T0 = hp(tp[0], tp[1], 1.12);
    gather(S, tp, { n: 24, hair: [0.98, 1.48, 1.8], lift: 0.06, s1: 1.1 });
    hairline(S, { hair: [0.98, 1.48, 1.8] });
    S.band(T0.clone().add(V(0, 0.02, -0.02)), V(0, 0.7, -0.7), 0.085, 0.035, H.solid("#ff5fa8", 0.4));
    S.lock([T0, T0.clone().add(V(0, 0.1, -0.14)), T0.clone().add(V(0, -0.04, -0.32)), T0.clone().add(V(0, -0.4, -0.4)), T0.clone().add(V(0, -0.75, -0.36))], 0.15, m1, { flat: 0.95, taper: 0.8, seg: 20 });
    S.bundle([T0, T0.clone().add(V(0, 0.1, -0.14)), T0.clone().add(V(0, -0.04, -0.32)), T0.clone().add(V(0, -0.4, -0.4)), T0.clone().add(V(0, -0.75, -0.36)), T0.clone().add(V(0, -0.88, -0.32))], 12, 0.1, 0.13, { taper: 0.65, seg: 24, prof: (t) => 0.4 + 0.6 * Math.sin(PI * Math.min(1, t * 0.9 + 0.15)) });
    // two wisps by the face
    [-1, 1].forEach((sd) => S.lock([hp(0.95, sd * 0.95, 1.06), hp(1.25, sd * 1.05, 1.13), hp(1.6, sd * 1.08, 1.12), hp(1.75, sd * 1.0, 1.15)], 0.05, m2, { flat: 0.6, taper: 0.9 }));
  },

  // low ponytail tied with a ribbon
  lowpony(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.03, 1.52, 1.82, 1.08, 0.012, 12);
    const tp = [1.62, PI], T0 = hp(tp[0], tp[1], 1.12);
    gather(S, tp, { n: 22, hair: [1.0, 1.5, 1.78], lift: 0.06, s1: 1.1, skip: (ph) => Math.abs(ph) < 0.5 });
    sweptBangs(S, { n: 6, part: -0.6, end: 1.02 });
    S.bundle([T0, T0.clone().add(V(0, -0.12, -0.07)), T0.clone().add(V(0, -0.38, -0.08)), T0.clone().add(V(0, -0.68, -0.02)), T0.clone().add(V(0, -0.8, 0))], 10, 0.1, 0.13, { taper: 0.7, seg: 22 });
    S.bow(T0.clone().add(V(0, 0.01, -0.07)), V(0, 0, -1), V(0, 1, 0), H.solid("#ff4f7a", 0.4), 1.1);
  },

  // two buns on top
  twinbuns(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp, hn } = S;
    S.cap(1.0, 1.5, 1.8, 1.08, 0.012, 12);
    [-1, 1].forEach((sd) => {
      const at = [0.62, sd * 1.12], n = hn(at[0], at[1]), base = hp(at[0], at[1], 1.08), B = base.clone().addScaledVector(n, 0.16);
      gather(S, at, { n: 11, from: sd > 0 ? -0.05 : -PI + 0.05, to: sd > 0 ? PI - 0.05 : 0.05, hair: [1.0, 1.48, 1.78], lift: 0.05, s1: 1.1, r: 0.11 });
      // the bun: a ball wrapped with a spiral of hair
      S.ball(B, 0.17, m1);
      const e1 = Math.abs(n.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0); e1.addScaledVector(n, -e1.dot(n)).normalize(); const e2 = new T.Vector3().crossVectors(n, e1), pts = [];
      for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * PI * 2 * 3.2, lat = -1 + t * 1.9, rr = Math.sqrt(Math.max(0, 1 - lat * lat * 0.85)) * 0.18; pts.push(B.clone().addScaledVector(n, lat * 0.16).addScaledVector(e1, Math.cos(a) * rr).addScaledVector(e2, Math.sin(a) * rr)); }
      S.lock(pts, 0.07, m2, { flat: 1, seg: 60, rad: 7, taper: 0.7 });
      S.band(base.clone().addScaledVector(n, 0.03), n, 0.1, 0.03, H.solid("#ff5fa8", 0.4));
    });
    fringe(S, { n: 8, w: 0.6, end: 1.0, r: 0.09, taper: 0.8 });
  },

  // smooth bob to the jaw with a side part
  bob(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R);
    S.cap(1.0, 1.55, 1.85, 1.12, 0.015, 10);
    bobBody(S, true);
  },

  // bob with a straight fringe
  bobbangs(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R);
    S.cap(1.05, 1.55, 1.85, 1.12, 0.015, 10);
    bobBody(S, false);
    fringe(S, { n: 12, w: 1.05, end: 1.05 });
  },

  // long ringlet curls
  longcurls(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.03, 1.55, 1.85, 1.14, 0.03, 9);
    partTop(S, { part: -0.15, n: 6, s: 1.14, thEnd: 1.4, sideW: 1.25 });
    for (let k = 0; k < 16; k++) {
      const ph = 1.0 + ((2 * PI - 2.0) * k) / 15, o = S.out(ph), p = hp(1.35 + 0.15 * Math.max(0, -Math.cos(ph)), ph, 1.2);
      S.lock([hp(0.4, ph, 1.05), hp(0.95, ph, 1.18), p], 0.13, S.m(k), { flat: 0.5, taper: 0.4 });
      S.ringlet(p, V(0, -1, 0).addScaledVector(o, 0.12), 0.62 + R() * 0.1, 0.07, 3.6, 0.055, S.m(k), { ph0: k * 1.3, shrink: 0.15 });
    }
    for (let k = 0; k < 10; k++) {
      const ph = 1.6 + ((2 * PI - 3.2) * k) / 9, o = S.out(ph), p = hp(1.45, ph, 1.1);
      S.ringlet(p, V(0, -1, 0).addScaledVector(o, 0.05), 0.55, 0.06, 3.2, 0.05, S.m(k + 1), { ph0: k });
    }
  },

  // short curly hair (chin length)
  shortcurls(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp, hn } = S;
    S.cap(1.0, 1.5, 1.8, 1.19, 0.06, 8, S.matte());
    for (let k = 0; k < 150; k++) {
      const th = Math.sqrt(R()) * 1.25, ph = R() * PI * 2;
      if (th > 0.72 && Math.cos(ph) > 0.45) continue;
      const p = hp(th, ph, 1.15 + R() * 0.05), n = hn(th, ph);
      S.ringlet(p.clone().addScaledVector(n, -0.04), n.clone().add(V(R() - 0.5, -0.3, R() - 0.5).multiplyScalar(0.9)), 0.12 + R() * 0.04, 0.032, 2, 0.05, S.m(k), { ph0: R() * 6, taper: 0.35, seg: 11, rad: 5 });
    }
    for (let k = 0; k < 20; k++) {
      const ph = 1.05 + ((2 * PI - 2.1) * k) / 19, o = S.out(ph), p = hp(1.3 + 0.2 * Math.max(0, -Math.cos(ph)), ph, 1.2);
      S.ringlet(p, V(0, -1, 0).addScaledVector(o, 0.25), 0.3 + R() * 0.08, 0.05, 2.4, 0.06, S.m(k), { ph0: k * 2.1 });
    }
    for (let k = 0; k < 6; k++) {
      const ph = -0.6 + k * 0.24, p = hp(0.68, ph, 1.18);
      S.ringlet(p, V(Math.sin(ph) * 0.4, -0.5, 0.8), 0.15, 0.05, 1.7, 0.045, S.m(k + 1), { ph0: k * 1.9, taper: 0.5 });
    }
  },

  // long thin box braids
  boxbraids(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.02, 1.52, 1.82, 1.09, 0.01, 12);
    const gold = H.solid("#ffd23a", 0.3, { metalness: 0.6 });
    for (let k = 0; k < 26; k++) {
      const ph = 0.95 + ((2 * PI - 1.9) * k) / 25, o = S.out(ph), th0 = 0.3 + (k % 3) * 0.3;
      const e = hp(1.72, ph, 1.15), L = 0.55 + R() * 0.12;
      const pts = [hp(th0, ph * (th0 < 0.5 ? 0.9 : 1), 1.08), hp((th0 + 1.7) / 2, ph, 1.16), e, e.clone().add(V(0, -L * 0.5, 0)).addScaledVector(o, 0.04), e.clone().add(V(0, -L, 0)).addScaledVector(o, 0.07)];
      S.lock(pts, 0.042, S.m(k), { flat: 0.9, seg: 46, rad: 6, taper: 0.4, bump: 0.4, bumpN: 20 });
      if (k % 4 === 1) { const c = new T.CatmullRomCurve3(pts).getPointAt(0.82); S.band(c, V(0, 1, 0), 0.04, 0.02, gold); }
    }
    // braids from the front hairline, swept back over the top
    for (let k = 0; k < 7; k++) {
      const ph = -0.75 + k * 0.25, sd = ph < 0 ? -1 : 1;
      S.lock([hp(0.95, ph, 1.07), hp(0.55, ph * 1.4, 1.15), hp(0.9, sd * 1.55, 1.16), hp(1.5, sd * 1.85, 1.17)], 0.042, S.m(k), { flat: 0.9, seg: 36, rad: 6, taper: 0.5, bump: 0.4, bumpN: 14 });
    }
  },

  // long beach waves with a middle part
  beachwaves(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R);
    S.cap(1.03, 1.55, 1.85, 1.13, 0.025, 9);
    partTop(S, { part: 0, n: 6, s: 1.13, thEnd: 1.45, sideW: 1.3 });
    wavesBody(S, { len: 0.62, wave: 0.055 });
  },

  // half up: the top tied into a small knot at the back, the rest down to the shoulders
  halfup(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.03, 1.55, 1.85, 1.12, 0.02, 10);
    const K = [0.85, PI], K0 = hp(K[0], K[1], 1.15);
    for (let k = 0; k < 12; k++) {
      const ph = -1.3 + k * (2.6 / 11);
      S.lock(S.arc([0.98 - 0.08 * Math.abs(ph) + 0.1 * Math.abs(ph) * Math.abs(ph), ph], K, { n: 6, s0: 1.07, s1: 1.13, lift: 0.09 }), 0.12, S.m(k), { flat: 0.42, taper: 0.5 });
    }
    const n = K0.clone().sub(S.HC).normalize();
    S.ball(K0.clone().addScaledVector(n, 0.08), 0.12, m1, [1, 0.9, 1]);
    S.band(K0.clone().addScaledVector(n, 0.02), n, 0.08, 0.03, H.solid("#ffffff", 0.45));
    S.bundle([K0.clone().addScaledVector(n, 0.1), K0.clone().addScaledVector(n, 0.2).add(V(0, -0.1, 0)), K0.clone().addScaledVector(n, 0.18).add(V(0, -0.32, 0))], 5, 0.04, 0.07, { taper: 0.9, k: 8 });
    curtain(S, { from: 1.2, to: 2 * PI - 1.2, n: 18, th0: 1.0, len: 0.42, thE: 1.68, flare: 0.05, wave: 0.02, r: 0.13 });
  },

  // slicked straight back
  slickback(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hx } = S;
    S.cap(1.02, 1.5, 1.9, 1.07, 0.008, 14);
    for (let k = 0; k < 15; k++) {
      const u = -0.84 + k * 0.12, a0 = 0.6 - Math.abs(u) * 0.35;
      const aE = 3.2 - Math.abs(u) * 0.55;
      S.lock([hx(u, a0 + 0.02, 1.04), hx(u, a0 + 0.35, 1.13 + 0.04 * (1 - Math.abs(u))), hx(u * 0.98, 1.4, 1.13), hx(u * 0.98, 2.1, 1.12), hx(u * 0.98, aE - 0.4, 1.1), hx(u, aE, 1.09).add(V(0, 0, -0.03))], 0.12, k % 5 === 2 ? S.m2 : S.m1, { flat: 0.35, taper: 0.8, seg: 24, root: 0.12, rootR: 0.9 });
    }
    hairline(S, { hair: [1.02, 1.5, 1.9], w: 1.4, s: 1.05 });
  },

  // long hair with a big flower at the side
  flowerlong(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp, hn } = S;
    S.cap(1.03, 1.55, 1.85, 1.13, 0.02, 9);
    partTop(S, { part: -0.4, n: 6, s: 1.13, thEnd: 1.45, sideW: 1.3 });
    sweptBangs(S, { n: 4, part: -0.5, end: 0.95 });
    curtain(S, { from: 1.15, to: 2 * PI - 1.15, n: 18, th0: 0.4, len: 0.6, thE: 1.7, flare: 0.06, r: 0.13, wave: 0.015 });
    // the flower (hibiscus-like): five petals round a yellow centre, two leaves
    const at = [0.9, 1.15], P = hp(at[0], at[1], 1.3), n = hn(at[0], at[1]), grp = new T.Group();
    const pet = H.solid("#ff6f91", 0.45), pet2 = H.solid("#ff9fb8", 0.45), cen = H.solid("#ffd23a", 0.4), leaf = H.solid("#3fbf62", 0.5);
    for (let q = 0; q < 5; q++) {
      const a = (q / 5) * PI * 2, p = new T.Mesh(SPHERE, q % 2 ? pet2 : pet);
      p.position.set(Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0); p.scale.set(0.14, 0.095, 0.04); p.rotation.z = a; grp.add(p);
    }
    const c = new T.Mesh(SPHERE, cen); c.scale.setScalar(0.06); c.position.z = 0.035; grp.add(c);
    [-1, 1].forEach((s) => { const l = new T.Mesh(SPHERE, leaf); l.position.set(s * 0.22, -0.13, -0.03); l.scale.set(0.12, 0.045, 0.025); l.rotation.z = s * 0.6; grp.add(l); });
    const x = new T.Vector3().crossVectors(V(0, 1, 0), n).normalize(), y = new T.Vector3().crossVectors(n, x);
    S.place(grp, P, x, y, n);
  },

  // mid-height ponytail with a wide headband
  headbandpony(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.0, 1.5, 1.8, 1.08, 0.012, 12);
    const tp = [1.15, PI], T0 = hp(tp[0], tp[1], 1.12);
    gather(S, tp, { n: 22, hair: [0.98, 1.48, 1.78], lift: 0.06, s1: 1.1 });
    hairline(S, { hair: [0.98, 1.48, 1.78] });
    S.band(T0.clone().add(V(0, 0, -0.01)), V(0, 0.3, -1), 0.08, 0.035, H.solid("#2fb8ff", 0.4));
    const pp = [T0, T0.clone().add(V(0, 0.04, -0.15)), T0.clone().add(V(0, -0.15, -0.3)), T0.clone().add(V(0, -0.55, -0.3)), T0.clone().add(V(0, -0.85, -0.24))];
    S.lock(pp, 0.15, m1, { flat: 0.95, taper: 0.8, seg: 20 });
    S.bundle(pp, 12, 0.1, 0.13, { taper: 0.65, seg: 22, prof: (t) => 0.4 + 0.6 * Math.sin(PI * Math.min(1, t * 0.9 + 0.15)) });
    // the wide headband, ear to ear over the top, a little behind the hairline
    const band = [];
    for (let t = -1.62; t <= 1.621; t += 0.18) band.push(S.hx(Math.sin(t) * 0.999, PI / 2 - Math.cos(t) * 0.75, 1.25 - 0.12 * (1 - Math.cos(t))));
    S.lock(band, 0.12, H.solid("#2fb8ff", 0.45), { flat: 0.22, taper: 0.25, pow: 4, seg: 30, rad: 10, root: 0.06 });
  },

  // straight hair with a centre part, past the shoulders
  midpart(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R);
    S.cap(1.0, 1.55, 1.85, 1.11, 0.012, 12);
    partTop(S, { part: 0, n: 7, s: 1.12, thEnd: 1.5, sideW: 1.22 });
    curtain(S, { from: 1.12, to: 2 * PI - 1.12, n: 20, th0: 0.35, len: 0.5, thE: 1.68, flare: 0.03, r: 0.13, taper: 0.4, pow: 2 });
  },

  // short braids with colourful beads at the ends
  beadbraids(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.0, 1.5, 1.8, 1.08, 0.008, 14);
    const beads = ["#ff5fa8", "#ffd23a", "#2fd3c4", "#9b5cff", "#ffffff", "#ff8a1c"].map((c) => H.solid(c, 0.25, { metalness: 0.1 }));
    let bi = 0;
    for (let k = 0; k < 18; k++) {
      const ph = 1.0 + ((2 * PI - 2.0) * k) / 17, o = S.out(ph), th0 = 0.25 + (k % 3) * 0.28;
      const e = hp(1.62, ph, 1.15), L = 0.22 + R() * 0.06;
      const end = e.clone().add(V(0, -L, 0)).addScaledVector(o, 0.06);
      S.lock([hp(th0, ph, 1.07), hp((th0 + 1.6) / 2, ph, 1.15), e, end], 0.045, S.m(k), { flat: 0.9, seg: 34, rad: 6, taper: 0.35, bump: 0.4, bumpN: 13 });
      S.ball(end.clone().add(V(0, -0.02, 0)), 0.042, beads[bi++ % beads.length]);
      S.ball(end.clone().add(V(0, -0.095, 0)), 0.042, beads[bi++ % beads.length]);
    }
    for (let k = 0; k < 6; k++) {
      const ph = -0.7 + k * 0.28, sd = ph < 0 ? -1 : 1;
      S.lock([hp(0.95, ph, 1.07), hp(0.55, ph * 1.3, 1.13), hp(0.8, sd * 1.35, 1.15), hp(1.3, sd * 1.55, 1.15)], 0.045, S.m(k), { flat: 0.9, seg: 30, rad: 6, taper: 0.4, bump: 0.4, bumpN: 11 });
    }
  },

  // two little twisted horn buns on top, the rest down
  hornbuns(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp, hn } = S;
    S.cap(1.0, 1.55, 1.85, 1.1, 0.012, 12);
    curtain(S, { from: 1.25, to: 2 * PI - 1.25, n: 16, th0: 1.0, len: 0.36, thE: 1.68, flare: 0.05, r: 0.13 });
    fringe(S, { n: 9, w: 0.75, end: 1.02, r: 0.1, taper: 0.85 });
    [-1, 1].forEach((sd) => {
      const at = [0.5, sd * 0.85], n = hn(at[0], at[1]).add(V(0, 0.5, 0)).normalize(), base = hp(at[0], at[1], 1.08);
      gather(S, at, { n: 8, from: sd > 0 ? 0.3 : -PI, to: sd > 0 ? PI : -0.3, hair: [0.9, 1.0, 1.15], lift: 0.04, s1: 1.08, r: 0.1 });
      const e1 = new T.Vector3().crossVectors(n, V(0, 0, 1)).normalize(), e2 = new T.Vector3().crossVectors(n, e1), pts = [];
      for (let i = 0; i <= 36; i++) { const t = i / 36, a = t * PI * 2 * 3.2, rr = 0.13 * (1 - t * 0.85); pts.push(base.clone().addScaledVector(n, 0.02 + t * 0.3).addScaledVector(e1, Math.cos(a) * rr).addScaledVector(e2, Math.sin(a) * rr)); }
      S.lock(pts, 0.075, S.m(sd > 0 ? 1 : 0), { flat: 1, seg: 54, rad: 7, taper: 0.6 });
      S.ball(base.clone().addScaledVector(n, 0.12), 0.1, m1, [1, 1.4, 1]).quaternion.setFromUnitVectors(V(0, 1, 0), n);
    });
  },

  // bubble ponytail: a ponytail tied into round "bubbles"
  bubblepony(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.0, 1.5, 1.8, 1.07, 0.01, 12);
    const tp = [0.75, PI], T0 = hp(tp[0], tp[1], 1.12);
    gather(S, tp, { n: 22, hair: [0.98, 1.48, 1.8], lift: 0.06, s1: 1.1 });
    hairline(S, { hair: [0.98, 1.48, 1.8] });
    const tie = H.solid("#ff5fa8", 0.4);
    const path = new T.CatmullRomCurve3([T0, T0.clone().add(V(0, 0.08, -0.22)), T0.clone().add(V(0, -0.2, -0.4)), T0.clone().add(V(0, -0.65, -0.42)), T0.clone().add(V(0, -1.05, -0.36))]);
    const cuts = [0, 0.24, 0.47, 0.68, 0.86, 1.0], rs = [0.15, 0.14, 0.12, 0.1, 0.07];
    for (let b = 0; b < 5; b++) {
      const t0 = cuts[b], t1 = cuts[b + 1], p0 = path.getPointAt(t0), tg0 = path.getTangentAt(t0);
      S.band(p0, tg0, b ? 0.045 : 0.07, 0.025, tie);
      const n = b === 4 ? 4 : 7;
      for (let k = 0; k < n; k++) {
        const phi = (k / n) * PI * 2 + b, pts = [];
        for (let i = 0; i <= 6; i++) {
          const t = t0 + ((t1 - t0) * i) / 6, p = path.getPointAt(t), tg = path.getTangentAt(t);
          const e1 = new T.Vector3().crossVectors(tg, V(1, 0, 0)).normalize(), e2 = new T.Vector3().crossVectors(tg, e1);
          const sw = b === 4 ? 0.02 + (i / 6) * 0.06 : 0.03 + rs[b] * Math.sin((i / 6) * PI);
          pts.push(p.addScaledVector(e1, Math.cos(phi) * sw).addScaledVector(e2, Math.sin(phi) * sw));
        }
        S.lock(pts, b === 4 ? 0.06 : 0.075, S.m(k), { flat: 0.8, seg: 12, rad: 7, taper: b === 4 ? 0.9 : 0.3, root: 0.2 });
      }
    }
  },

  // long hair all swept over one shoulder
  sideswept(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.03, 1.55, 1.85, 1.1, 0.015, 10);
    const G = [1.5, 1.25];
    partTop(S, { part: -0.6, n: 6, s: 1.14, thEnd: 1.4, sideW: 1.3 });
    sweepTo(S, G, { from: -1.25, to: -2 * PI + 2.0, n: 22, th0: 0.3, s1: 1.2, r: 0.12 });
    const g0 = hp(G[0], G[1], 1.2);
    for (let k = 0; k < 12; k++) {
      const off = V((k - 5.5) * 0.028, 0, (k % 2) * 0.05 - 0.03);
      const pts = [g0.clone().add(V(0.02, 0.12, -0.1)).add(off), g0.clone().add(off), g0.clone().add(V(-0.02, -0.25, 0.1)).add(off.clone().multiplyScalar(1.4)), g0.clone().add(V(-0.08, -0.55, 0.16)).add(off.clone().multiplyScalar(1.8)), g0.clone().add(V(-0.1 + Math.sin(k) * 0.03, -0.82, 0.16)).add(off.clone().multiplyScalar(2))];
      pts.forEach((p, i) => { p.x += Math.sin(i * 1.4 + k * 0.5) * 0.025; });
      S.lock(pts, 0.13, S.m(k), { flat: 0.7, taper: 0.85, seg: 22 });
    }
  },

  /* ======== members only ======== */

  // big bouncy spring curls that slowly change colour
  springcurls(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.03, 1.55, 1.85, 1.15, 0.03, 9);
    partTop(S, { part: 0.2, n: 6, s: 1.15, thEnd: 1.35, sideW: 1.2 });
    for (let k = 0; k < 20; k++) {
      const ph = 0.95 + ((2 * PI - 1.9) * k) / 19, o = S.out(ph), p = hp(1.2 + 0.2 * Math.max(0, -Math.cos(ph)), ph, 1.18);
      S.ringlet(p, V(0, -1, 0).addScaledVector(o, 0.3), 0.6, 0.1, 3.4, 0.065, S.m(k), { ph0: k * 1.1, shrink: 0.1 });
    }
    for (let k = 0; k < 12; k++) {
      const ph = 1.5 + ((2 * PI - 3.0) * k) / 11, o = S.out(ph), p = hp(1.45, ph, 1.1);
      S.ringlet(p, V(0, -1, 0).addScaledVector(o, 0.15), 0.5, 0.09, 3, 0.06, S.m(k + 1), { ph0: k * 2.3, shrink: 0.1 });
    }
    H.anim((t) => { m1.color.setHSL((t * 0.06) % 1, 0.75, 0.55); m2.color.setHSL((t * 0.06 + 0.1) % 1, 0.85, 0.68); });
  },

  // shaggy shoulder-length hair whose tips sparkle gold
  sparkletips(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.03, 1.55, 1.85, 1.14, 0.03, 9);
    const tipM = H.solid("#ffd23a", 0.22, { metalness: 0.6, emissive: "#ffb000", emissiveIntensity: 0.5 });
    const tip = (pts, r, i) => {
      const c = new T.CatmullRomCurve3(pts, false, "centripetal"), a = [], b = [];
      for (let k = 0; k <= 8; k++) a.push(c.getPointAt((k / 8) * 0.72));
      for (let k = 0; k <= 4; k++) b.push(c.getPointAt(0.7 + (k / 4) * 0.3));
      S.lock(a, r, S.m(i), { flat: 0.5, taper: 0.25, seg: 16 });
      S.lock(b, r * 0.8, tipM, { flat: 0.5, taper: 0.95, root: 0.01, seg: 8 });
    };
    // layered shag fringe
    for (let k = 0; k < 7; k++) { const ph = -0.75 + k * 0.25; tip([hp(0.3, ph * 0.4, 1.05), hp(0.7, ph, 1.2), hp(0.95, ph * 1.1, 1.2), hp(1.08, ph * 1.15, 1.16)], 0.11, k); }
    for (let k = 0; k < 18; k++) {
      const ph = 1.1 + ((2 * PI - 2.2) * k) / 17, o = S.out(ph), e = hp(1.7, ph, 1.17), L = 0.18 + (k % 2) * 0.1;
      tip([hp(0.35, ph, 1.05), hp(1.0, ph, 1.19), e, e.clone().add(V(0, -L, 0)).addScaledVector(o, 0.08), e.clone().add(V(0, -L - 0.08, 0)).addScaledVector(o, 0.15)], 0.13, k);
    }
    // a few sparkles near the tips
    const spark = H.solid("#fff6c8", 0.2, { emissive: "#ffe27a", emissiveIntensity: 1.2 }), oct = new T.OctahedronGeometry(1, 0);
    for (let k = 0; k < 8; k++) {
      const ph = 1.3 + ((2 * PI - 2.6) * k) / 7, p = hp(1.8, ph, 1.32).add(V(0, -0.1 - (k % 2) * 0.12, 0)), s = S.mesh(oct, spark);
      s.position.copy(p); s.scale.set(0.025, 0.045, 0.025); s.rotation.y = k;
    }
    H.anim((t) => { tipM.emissiveIntensity = 0.45 + 0.35 * Math.sin(t * 3); spark.emissiveIntensity = 0.8 + 0.7 * Math.sin(t * 5 + 1); });
  },

  // one long braid down the back with little gold stars
  starbraid(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.03, 1.52, 1.82, 1.08, 0.012, 12);
    const tp = [1.35, PI], T0 = hp(tp[0], tp[1], 1.14);
    fringe(S, { n: 11, w: 1.0, end: 1.04 });
    sweepTo(S, tp, { from: 1.0, to: 2 * PI - 1.0, n: 20, th0: 0.3, s1: 1.15, r: 0.12 });
    const pts = [T0, T0.clone().add(V(0, -0.2, -0.08)), T0.clone().add(V(0.02, -0.55, -0.06)), T0.clone().add(V(-0.02, -0.95, 0)), T0.clone().add(V(0, -1.15, 0.03))];
    const c = S.braid(pts, 0.14, m1, { out: V(0, 0, -1), taper: 0.4, mAlt: m2 });
    const end = c.getPointAt(1);
    S.band(end, V(0, 1, 0), 0.045, 0.025, H.solid("#ffd23a", 0.3, { metalness: 0.6 }));
    S.bundle([end, end.clone().add(V(0, -0.1, -0.01)), end.clone().add(V(0, -0.2, 0))], 5, 0.04, 0.045, { flat: 1, taper: 0.9, k: 6, prof: (t) => 0.5 + t });
    // stars
    const sh = new T.Shape();
    for (let i = 0; i < 10; i++) { const a = PI / 2 + (i * PI) / 5, r = i % 2 ? 0.42 : 1; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const sg = new T.ExtrudeGeometry(sh, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 1 });
    const gold = H.solid("#ffd23a", 0.25, { metalness: 0.5, emissive: "#ffb000", emissiveIntensity: 0.45 });
    [0.12, 0.3, 0.48, 0.66, 0.84].forEach((t, i) => {
      const p = c.getPointAt(t), s = S.mesh(sg, gold);
      s.position.copy(p).add(V((i % 2 ? 1 : -1) * 0.06, 0, -0.1)); s.scale.setScalar(0.055 - t * 0.015); s.rotation.set(0, PI, (i * 0.7) % 1);
    });
    [[0.75, -0.9], [0.55, 0.7], [0.95, 1.25]].forEach(([th, ph], i) => { const s = S.mesh(sg, gold); s.position.copy(hp(th, ph, 1.2)); s.scale.setScalar(0.05); s.lookAt(s.position.clone().add(S.out(ph))); s.rotateZ(i); });
    H.anim((t) => { gold.emissiveIntensity = 0.4 + 0.3 * Math.sin(t * 2.5); });
  },

  // glossy ice-blue hair with crystal clips
  crystal(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    [m1, m2].forEach((m, i) => { m.roughness = 0.18; m.metalness = 0.25; m.emissive = new T.Color(i ? "#7fe8ff" : "#2a9dff"); m.emissiveIntensity = 0.18; });
    S.cap(1.03, 1.55, 1.85, 1.12, 0.015, 10);
    partTop(S, { part: 0.45, n: 7, s: 1.13, thEnd: 1.45, sideW: 1.25 });
    curtain(S, { from: 1.12, to: 2 * PI - 1.12, n: 20, th0: 0.4, len: 0.68, thE: 1.7, flare: 0.04, r: 0.13, taper: 0.95, pow: 1.1 });
    const ice = H.solid("#e6fbff", 0.08, { metalness: 0.2, emissive: "#8fe6ff", emissiveIntensity: 0.6, transparent: true, opacity: 0.9 }), oct = new T.OctahedronGeometry(1, 0);
    [[0.55, -0.85], [0.72, -1.05], [0.62, -0.62], [0.88, -1.2]].forEach(([th, ph], i) => {
      const s = S.mesh(oct, ice); s.position.copy(hp(th, ph, 1.2)); s.scale.set(0.05, 0.09 + (i % 2) * 0.03, 0.05); s.lookAt(s.position.clone().add(S.out(ph))); s.rotateX(PI / 2); s.rotateZ(0.4 - i * 0.25);
    });
    H.anim((t) => { m1.emissiveIntensity = 0.15 + 0.08 * Math.sin(t * 1.6); m2.emissiveIntensity = 0.2 + 0.12 * Math.sin(t * 1.6 + 1.5); ice.emissiveIntensity = 0.5 + 0.35 * Math.sin(t * 2.4); });
  },

  // long flowing hair in rainbow bands that move down it
  rainbow(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R);
    S.cap(1.03, 1.55, 1.85, 1.13, 0.025, 9);
    partTop(S, { part: -0.3, n: 6, s: 1.13, thEnd: 1.45, sideW: 1.3 });
    wavesBody(S, { len: 0.8, wave: 0.035 });
    const U = { value: 0 };
    [m1, m2].forEach((m, i) => {
      m.color.set("#ffffff");
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uRT = U;
        sh.vertexShader = "varying vec3 vHairP;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvHairP = position;");
        sh.fragmentShader = "uniform float uRT;\nvarying vec3 vHairP;\nvec3 hairHue(float h){return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);}\n" +
          sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>\n diffuseColor.rgb *= mix(vec3(1.0), hairHue(fract(vHairP.y*0.55 + uRT*0.12 + ${i ? "0.06" : "0.0"})), 0.78);`);
      };
      m.customProgramCacheKey = () => "jumpi-rainbow-hair";
    });
    H.anim((t) => { U.value = t; });
  },

  // princess ponytail: high, full of curls, with a gold ribbon
  princesspony(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.0, 1.5, 1.82, 1.07, 0.01, 12);
    const tp = [0.6, PI], T0 = hp(tp[0], tp[1], 1.12);
    gather(S, tp, { n: 24, hair: [0.98, 1.48, 1.8], lift: 0.07, s1: 1.1 });
    hairline(S, { hair: [0.98, 1.48, 1.8] });
    const gold = H.solid("#ffd23a", 0.22, { metalness: 0.65, emissive: "#a86f00", emissiveIntensity: 0.35 });
    S.band(T0.clone().add(V(0, 0.02, -0.02)), V(0, 0.7, -0.7), 0.09, 0.04, gold);
    S.bow(T0.clone().add(V(0, 0.1, -0.1)), V(0, 0.35, -1), V(0, 1, 0), gold, 1.1);
    // a fountain of ringlets
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * PI * 2, o = V(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.3 - 0.4);
      const st = T0.clone().add(V(0, 0.12, -0.18)).addScaledVector(o, 0.18);
      S.lock([T0, T0.clone().add(V(0, 0.16, -0.12)), st], 0.1, S.m(k), { flat: 0.8, taper: 0.3 });
      S.ringlet(st, V(o.x * 0.5, -1, o.z * 0.7 - 0.25), 0.72 + R() * 0.12, 0.075, 3.6, 0.06, S.m(k), { ph0: k, shrink: 0.15 });
    }
    [-1, 1].forEach((sd) => S.ringlet(hp(0.98, sd * 1.0, 1.08), V(sd * 0.1, -1, 0.1), 0.42, 0.045, 3, 0.035, m2, { ph0: sd }));
    H.anim((t) => { gold.emissiveIntensity = 0.3 + 0.2 * Math.sin(t * 2.2); });
  },

  // soft pastel cloud hair
  cloud(cols, g, m1, m2, add, R, H) {
    const S = kit(g, m1, m2, H, R), { hp } = S;
    S.cap(1.0, 1.52, 1.82, 1.14, 0.03, 9);
    const pastel = ["#ffc4e4", "#d6c4ff", "#bfe4ff", "#c8f5e0"].map((c) => H.solid(c, 0.75, { emissive: c, emissiveIntensity: 0.12 }));
    // clouds = clusters of soft puffs, round the top and down the sides
    const spots = [];
    for (let k = 0; k < 7; k++) spots.push([0.95, (k / 7) * PI * 2 + 0.45]);
    for (let k = 0; k < 4; k++) spots.push([0.45, (k / 4) * PI * 2]);
    spots.push([0, 0]);
    for (let k = 0; k < 6; k++) spots.push([1.45, PI + (k - 2.5) * 0.48]);
    spots.forEach(([th, ph], i) => {
      if (th > 0.9 && Math.cos(ph) > 0.55) return;
      const m = pastel[i % 4], C = hp(th, ph, 1.2), o = C.clone().sub(S.HC).normalize(), e1 = new T.Vector3().crossVectors(o, V(0, 1, 0.01)).normalize(), e2 = new T.Vector3().crossVectors(o, e1);
      for (let q = 0; q < 5; q++) {
        const a = (q / 5) * PI * 2 + i, r = q === 0 ? 0.2 : 0.13 + R() * 0.04;
        const p = q === 0 ? C.clone().addScaledVector(o, 0.06) : C.clone().addScaledVector(e1, Math.cos(a) * 0.15).addScaledVector(e2, Math.sin(a) * 0.12).addScaledVector(o, 0.02);
        S.ball(p, r, m, [1, 0.88, 1]);
      }
    });
    // a soft fringe of small puffs over the forehead
    for (let k = 0; k < 6; k++) S.ball(hp(0.82, -0.62 + k * 0.25, 1.22), 0.1, pastel[k % 4], [1, 0.85, 0.85]);
    H.anim((t) => pastel.forEach((m, i) => { m.emissiveIntensity = 0.1 + 0.08 * Math.sin(t * 1.5 + i * 1.6); }));
  },
};

// the long part of a bob: straight to the jaw, ends turned in a little
function bobBody(S, part) {
  const { hp } = S;
  const n = 18;
  for (let k = 0; k < n; k++) {
    const ph = 1.12 + ((2 * PI - 2.24) * k) / (n - 1), o = S.out(ph), e = hp(1.62, ph, 1.2);
    S.lock([hp(0.3, ph, 1.04), hp(0.95, ph, 1.19), e, e.clone().add(V(0, -0.24, 0)).addScaledVector(o, 0.03), e.clone().add(V(0, -0.32, 0)).addScaledVector(o, -0.04)], 0.14, S.m(k), { flat: 0.45, taper: 0.35, pow: 2.5, seg: 20 });
  }
  if (part) {
    // side part on the left; the front sweeps across to the right and down
    for (let k = 0; k < 5; k++) {
      const t = k / 4, e = hp(1.35 + t * 0.15, 1.0 + t * 0.1, 1.2);
      S.lock([hp(0.3 + t * 0.15, -0.45, 1.04), hp(0.65, 0.0 + t * 0.15, 1.22), hp(0.95 + t * 0.1, 0.62 + t * 0.15, 1.22), e, e.clone().add(V(0.02, -0.2, 0.02))], 0.13, S.m(k), { flat: 0.45, taper: 0.4, pow: 2.5 });
    }
    for (let k = 0; k < 3; k++) {
      const e = hp(1.4, -1.05 - k * 0.05, 1.2);
      S.lock([hp(0.35 + k * 0.1, -0.5, 1.04), hp(0.8, -0.85, 1.2), e, e.clone().add(V(-0.02, -0.22, 0.02))], 0.13, S.m(k + 1), { flat: 0.45, taper: 0.4, pow: 2.5 });
    }
  } else {
    [-1, 1].forEach((sd) => { for (let k = 0; k < 2; k++) { const e = hp(1.4, sd * (1.05 + k * 0.05), 1.2); S.lock([hp(0.4, sd * 0.6, 1.04), hp(0.9, sd * (0.95 + k * 0.05), 1.2), e, e.clone().add(V(sd * 0.02, -0.22, 0.02))], 0.13, S.m(k), { flat: 0.45, taper: 0.4, pow: 2.5 }); } });
  }
}

// long wavy hair round the back and sides plus face-framing waves
function wavesBody(S, { len = 0.6, wave = 0.05 } = {}) {
  const { hp } = S;
  curtain(S, { from: 1.15, to: 2 * PI - 1.15, n: 20, th0: 0.4, len, thE: 1.68, flare: 0.08, wave, waveN: 2.5, r: 0.13 });
  [-1, 1].forEach((sd) => {
    for (let k = 0; k < 2; k++) {
      const ph = sd * (1.08 + k * 0.08), e = hp(1.55, ph, 1.2), side = V(Math.cos(ph), 0, -Math.sin(ph)), pts = [hp(0.6, sd * 0.5, 1.06), hp(1.0, ph * 0.95, 1.2), e];
      for (let i = 1; i <= 4; i++) pts.push(e.clone().add(V(0, (-len * 0.85 * i) / 4, 0.02 * i)).addScaledVector(side, Math.sin(i * 1.6 + k) * wave));
      S.lock(pts, 0.12, S.m(k), { flat: 0.6, taper: 0.9, seg: 22 });
    }
  });
}
