/*
  Beards and moustaches (the "beard" slot; items in public/shared/items/beards.js).
  Built in the Head node's space around the real mouth: the moustache sits just ABOVE the mouth, the beard grows
  from just under it round the chin and up the cheeks to the sideburns, so the mouth always stays visible.
  F = {th, ph} of the mouth centre on the head ellipsoid and eyeTh (the eyes' height), measured in index.html.
*/
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// a furry patch on the face: depth(th, ph) in 0..1 says how thick it is there (0 = under the skin, invisible)
function patch(H, F, depthFn, d, mat, nT = 34, nP = 56) {
  const { THREE, hp } = H, pos = [], idx = [];
  const t0 = F.eyeTh, t1 = F.th + 0.95, p0 = -1.75, p1 = 1.75;
  for (let i = 0; i <= nT; i++) for (let j = 0; j <= nP; j++) {
    const th = t0 + (t1 - t0) * (i / nT), ph = p0 + (p1 - p0) * (j / nP), k = depthFn(th, ph);
    const fuzz = k > 0 ? 0.012 * Math.sin(ph * 37 + th * 23) * Math.sin(th * 41) : 0;
    const v = hp(th, ph, k > 0.001 ? 1.0 + d * k + fuzz : 0.97);
    pos.push(v.x, v.y, v.z);
  }
  const W = nP + 1;
  for (let i = 0; i < nT; i++) for (let j = 0; j < nP; j++) {
    const a = i * W + j, b = a + 1, c = a + W, e = c + 1;
    idx.push(a, c, b, b, c, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

// fluffy locks hanging from the chin, so a beard looks like hair and not like a mask
function chinTufts(H, F, g, m1, m2, n, len, d, spread = 0.13) {
  const { lockGeo, hp, hn, THREE } = H, R = (k) => Math.sin(k * 12.9898) * 0.5 + 0.5;
  for (let k = 0; k < n; k++) {
    const u = n === 1 ? 0 : k / (n - 1) - 0.5, ph = F.ph + u * spread * (n - 1), th = F.th + 0.42 - Math.abs(u) * 0.12;
    const a = hp(th, ph, 1 + d * 0.8), nn = hn(th, ph), down = new THREE.Vector3(u * 0.12, -1, 0.25).normalize(), L = len * (1 - Math.abs(u) * 0.55) * (0.85 + R(k) * 0.3);
    const pts = [a, a.clone().addScaledVector(nn, 0.04).addScaledVector(down, L * 0.4), a.clone().addScaledVector(down, L).addScaledVector(nn, 0.02), a.clone().addScaledVector(down, L * 1.15).add(new THREE.Vector3(u * 0.05, 0.02, -0.02))];
    g.add(new THREE.Mesh(lockGeo(pts, 0.075 + d * 0.3, 0.7, 14, 8), k % 3 === 1 ? m2 : m1));
  }
}
// the moustache: two locks from the middle out to the sides, just above the mouth
function moustache(H, F, o, g, m1, m2) {
  const { lockGeo, hp, THREE } = H, T = F.th - 0.085, s = 1.045, thick = o.thick || 0.07;
  [-1, 1].forEach((sd) => {
    const P = (dt, dp, k = s) => hp(T + dt, F.ph + sd * dp, k);
    let pts;
    if (o.style === "handlebar") pts = [P(0, 0.02), P(0.01, 0.14), P(0.035, 0.27), P(0.0, 0.38, 1.03), P(-0.07, 0.4, 1.01)];
    else if (o.style === "walrus") pts = [P(-0.01, 0.02, 1.05), P(0.02, 0.15, 1.06), P(0.07, 0.27, 1.04), P(0.12, 0.31, 1.02)];
    else if (o.style === "pencil") pts = [P(0.01, 0.03), P(0.015, 0.14), P(0.02, 0.24, 1.035)];
    else pts = [P(-0.012, 0.0, 1.05), P(0.0, 0.12), P(0.03, 0.24), P(0.085, 0.33, 1.02)];
    const r = o.style === "pencil" ? thick * 0.42 : o.style === "walrus" ? thick * 1.35 : thick * 1.15;
    g.add(new THREE.Mesh(lockGeo(pts, r, 0.62, 20, 9), m1));
    if (o.style !== "pencil") g.add(new THREE.Mesh(lockGeo(pts.map((p) => p.clone().multiplyScalar(1).add(new THREE.Vector3(0, 0.012, 0.004))), r * 0.55, 0.6, 16, 7), m2));
  });
  // the middle, where the two halves meet (a little dip under the nose)
  g.add(new THREE.Mesh(lockGeo([hp(T - 0.005, F.ph - 0.05, 1.05), hp(T + 0.004, F.ph, 1.055), hp(T - 0.005, F.ph + 0.05, 1.05)], (o.style === "pencil" ? 0.03 : thick) * 1.2, 0.6, 8, 8), m1));
}

export function buildBeard(o, F, H) {
  const { THREE, solid } = H, g = new THREE.Group();
  const base = new THREE.Color(o.col), hi = base.clone().offsetHSL(0, 0, base.getHSL({}).l < 0.25 ? 0.02 : 0.08);   // the lighter strands: only a little lighter (no grey stripes on dark beards)
  const m1 = new THREE.MeshStandardMaterial({ color: base, roughness: 0.78, side: THREE.DoubleSide });
  const m2 = new THREE.MeshStandardMaterial({ color: hi, roughness: 0.7, side: THREE.DoubleSide });
  const T = F.th, side = (ph) => Math.abs(ph - F.ph);
  // under the mouth: starts a little below it (the mouth stays clear), round the chin
  const under = (th, ph, w = 1.3, len = 0.62) => sm(T + 0.07, T + 0.15, th) * (1 - sm(T + len - 0.12, T + len, th)) * (1 - sm(w - 0.25, w, side(ph)));
  // the cheeks and sideburns up to the ears
  const cheeks = (th, ph) => sm(0.55, 0.85, side(ph)) * (1 - sm(1.4, 1.62, side(ph))) * sm(F.eyeTh + 0.12, F.eyeTh + 0.3, th) * (1 - sm(T + 0.5, T + 0.62, th));
  const kind = o.id;
  if (kind === "full" || kind === "big") {
    const len = kind === "big" ? 0.9 : 0.6, d = kind === "big" ? 0.16 : 0.085;
    g.add(patch(H, F, (th, ph) => Math.max(under(th, ph, 1.45, len) * (1 + 0.6 * sm(T + 0.2, T + len, th) * (1 - side(ph) / 1.45)), cheeks(th, ph) * 0.7), d, m1));
    chinTufts(H, F, g, m1, m2, kind === "big" ? 9 : 7, kind === "big" ? 0.42 : 0.16, d);
    moustache(H, F, { ...o, style: kind === "big" ? "walrus" : o.style || "classic", thick: kind === "big" ? 0.085 : 0.07 }, g, m1, m2);
  } else if (kind === "chinstrap") {
    g.add(patch(H, F, (th, ph) => Math.max(under(th, ph, 1.45, 0.42) * sm(T + 0.18, T + 0.26, th + 0.08 * (1 - side(ph))), cheeks(th, ph) * 0.8) , 0.06, m1));
    chinTufts(H, F, g, m1, m2, 5, 0.1, 0.06);
  } else if (kind === "goatee") {
    g.add(patch(H, F, (th, ph) => under(th, ph, 0.42, 0.48) * (1 + 0.5 * sm(T + 0.2, T + 0.48, th)), 0.09, m1));
    chinTufts(H, F, g, m1, m2, 3, 0.16, 0.09, 0.09);
    moustache(H, F, { ...o, style: "classic", thick: 0.055 }, g, m1, m2);
  } else if (kind === "stubble") {
    const mat = new THREE.MeshStandardMaterial({ color: base, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false });
    g.add(patch(H, F, (th, ph) => Math.max(under(th, ph, 1.45, 0.6), cheeks(th, ph) * 0.9, sm(T - 0.16, T - 0.12, th) * (1 - sm(T - 0.06, T - 0.03, th)) * (1 - sm(0.28, 0.42, side(ph)))), 0.012, mat));
  } else {
    moustache(H, F, o, g, m1, m2);   // moustache only: o.style = classic | handlebar | walrus | pencil
  }
  if (o.glow) [m1, m2].forEach((m) => { m.emissive = new THREE.Color(o.glow); m.emissiveIntensity = 0.35; });
  if (o.rainbow) H.anim((t) => { m1.color.setHSL((t * 0.12) % 1, 0.75, 0.55); m2.color.setHSL((t * 0.12 + 0.08) % 1, 0.8, 0.68); });
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return g;
}
