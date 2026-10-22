/*
  What an Item designer recipe may hold (public/world/recipe.js builds it; routes/items.js checks it with cleanRecipe).
  No three.js here, so the server can use it too.
*/
export const SHAPES = {
  box: { name: "Box", a: { round: .15 } },            // round: 0 (sharp) .. .5 (very round)
  sphere: { name: "Ball", a: {} },
  hemi: { name: "Dome", a: {} },
  cyl: { name: "Cylinder", a: { taper: 1 } },         // taper: the top's width compared with the bottom's (0 .. 2)
  cone: { name: "Cone", a: {} },
  capsule: { name: "Capsule", a: {} },
  torus: { name: "Ring", a: { thick: .25, arc: 360 } }, // thick: .05 .. .9; arc: 10 .. 360 degrees
  flat: { name: "Flat shape", a: { kind: "star", depth: .25 } },   // kind: FLAT_KINDS; depth: .02 .. 1
};
export const FLAT_KINDS = ["star", "heart", "circle", "diamond", "moon", "shield", "triangle", "bolt"];
export const FINISHES = { matte: "Matte", gloss: "Shiny", metal: "Metal", glow: "Glowing", glass: "Glass" };
export const COLOR_KEYS = ["c1", "c2", "c3"];
export const MAX_PARTS = 150;
const clamp = (v, a, b, d) => (Number.isFinite(+v) ? Math.min(b, Math.max(a, +v)) : d);

// a shape's settings, always within limits
export function shapeArgs(t, a = {}) {
  const d = (SHAPES[t] || SHAPES.box).a;
  if (t === "box") return { round: clamp(a.round, 0, .5, d.round) };
  if (t === "cyl") return { taper: clamp(a.taper, 0, 2, d.taper) };
  if (t === "torus") return { thick: clamp(a.thick, .05, .9, d.thick), arc: clamp(a.arc, 10, 360, d.arc) };
  if (t === "flat") return { kind: FLAT_KINDS.includes(a.kind) ? a.kind : d.kind, depth: clamp(a.depth, .02, 1, d.depth) };
  return {};
}

const HEX = /^#[0-9a-f]{6}$/i;
const r4 = (n) => Math.round(n * 10000) / 10000;
// a recipe as it may be saved: known shapes and finishes only, numbers within limits, at most MAX_PARTS parts
export function cleanRecipe(R) {
  if (!R || typeof R !== "object" || !Array.isArray(R.parts)) throw new Error("The design is empty.");
  if (!R.parts.length) throw new Error("Add at least one shape.");
  if (R.parts.length > MAX_PARTS) throw new Error(`At most ${MAX_PARTS} shapes.`);
  const v3 = (a, lim, d) => (Array.isArray(a) && a.length === 3 ? a.map((x, k) => r4(clamp(x, -lim, lim, d[k]))) : d.slice());
  const parts = R.parts.map((q) => {
    if (!q || !SHAPES[q.t]) throw new Error("Unknown shape.");
    const s = v3(q.s, 8, [1, 1, 1]).map((x) => (Math.abs(x) < .005 ? .005 : x));
    const c = COLOR_KEYS.includes(q.c) || HEX.test(q.c || "") ? String(q.c).toLowerCase() : "c1";
    const out = { t: q.t, p: v3(q.p, 6, [0, 0, 0]), r: v3(q.r, 7, [0, 0, 0]), s, c, f: FINISHES[q.f] ? q.f : "matte", a: shapeArgs(q.t, q.a || {}) };
    if (typeof q.n === "string" && q.n.trim()) out.n = q.n.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 30);
    return out;
  });
  const colors = {};
  for (const k of COLOR_KEYS) colors[k] = HEX.test((R.colors && R.colors[k]) || "") ? R.colors[k].toLowerCase() : "#cccccc";
  return { v: 1, anchor: R.anchor === "body" ? "body" : "head", parts, colors };
}
