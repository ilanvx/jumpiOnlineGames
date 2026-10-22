/*
  Items designed in the admin panel's Item designer are "recipes": a list of simple shapes, each with a place, a turn,
  a size, a colour and a finish. This builds one (the game, the Item studio's view and the designer all use it).
  recipe = { v: 1, anchor: "head" | "body", parts: [ { t, p:[x,y,z], r:[x,y,z] (radians), s:[x,y,z], c, f, a, n } ] }
    t: a shape in SHAPES; c: "c1" | "c2" | "c3" (the item's colours: its c1 / c2 / c3 fields, so colour versions are just
    other values) or "#rrggbb"; f: a finish in FINISHES; a: the shape's settings (see SHAPES); n: a name in the designer.
  Every shape is about 1 × 1 × 1 at size 1, centred on its place. The parts are hung on the head or the body.
*/
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

import { SHAPES, FLAT_KINDS, FINISHES, COLOR_KEYS, MAX_PARTS, shapeArgs } from "/shared/recipe-spec.js";
export { SHAPES, FLAT_KINDS, FINISHES, COLOR_KEYS, MAX_PARTS, shapeArgs };
const HEX = /^#[0-9a-f]{6}$/i;

function flatShape(kind) {
  const s = new THREE.Shape(), P = Math.PI;
  if (kind === "star") { for (let i = 0; i < 10; i++) { const a = P / 2 + i * P / 5, r = i % 2 ? .21 : .5; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } }
  else if (kind === "heart") { s.moveTo(0, -.45); s.bezierCurveTo(-.15, -.3, -.5, -.05, -.5, .18); s.bezierCurveTo(-.5, .42, -.22, .5, 0, .3); s.bezierCurveTo(.22, .5, .5, .42, .5, .18); s.bezierCurveTo(.5, -.05, .15, -.3, 0, -.45); }
  else if (kind === "circle") s.absarc(0, 0, .5, 0, P * 2, false);
  else if (kind === "diamond") { s.moveTo(0, .5); s.lineTo(.36, 0); s.lineTo(0, -.5); s.lineTo(-.36, 0); }
  else if (kind === "moon") { s.absarc(0, 0, .5, P * .3, P * 1.7, false); s.absarc(.22, 0, .36, P * 1.62, P * .38, true); }
  else if (kind === "shield") { s.moveTo(-.42, .45); s.lineTo(.42, .45); s.lineTo(.42, .05); s.quadraticCurveTo(.4, -.32, 0, -.5); s.quadraticCurveTo(-.4, -.32, -.42, .05); }
  else if (kind === "triangle") { s.moveTo(0, .5); s.lineTo(.5, -.4); s.lineTo(-.5, -.4); }
  else if (kind === "bolt") { s.moveTo(.1, .5); s.lineTo(-.3, -.05); s.lineTo(-.02, -.05); s.lineTo(-.12, -.5); s.lineTo(.3, .08); s.lineTo(.02, .08); }
  return s;
}

const GEO = new Map();
export function shapeGeometry(t, a) {
  const A = shapeArgs(t, a), key = t + JSON.stringify(A);
  if (GEO.has(key)) return GEO.get(key);
  let g;
  if (t === "sphere") g = new THREE.SphereGeometry(.5, 32, 20);
  else if (t === "hemi") g = new THREE.SphereGeometry(.5, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  else if (t === "cyl") g = new THREE.CylinderGeometry(.5 * A.taper, .5, 1, 32);
  else if (t === "cone") g = new THREE.ConeGeometry(.5, 1, 32);
  else if (t === "capsule") g = new THREE.CapsuleGeometry(.25, .5, 8, 20);
  else if (t === "torus") { const tube = .5 * A.thick * .5; g = new THREE.TorusGeometry(.5 - tube, tube, 16, 48, A.arc * Math.PI / 180); }
  else if (t === "flat") { g = new THREE.ExtrudeGeometry(flatShape(A.kind), { depth: A.depth, bevelEnabled: true, bevelSize: .03, bevelThickness: .03, bevelSegments: 3, curveSegments: 24 }); g.translate(0, 0, -A.depth / 2); }
  else g = new RoundedBoxGeometry(1, 1, 1, 4, Math.max(.001, A.round * .5));
  GEO.set(key, g);
  return g;
}

const MAT = new Map();
export function finishMaterial(hex, f) {
  const key = hex + f;
  if (MAT.has(key)) return MAT.get(key);
  const o = { color: hex, roughness: .7, metalness: 0 };
  if (f === "gloss") o.roughness = .2;
  else if (f === "metal") Object.assign(o, { metalness: .85, roughness: .26 });
  else if (f === "glow") Object.assign(o, { emissive: hex, emissiveIntensity: .9, roughness: .4 });
  else if (f === "glass") Object.assign(o, { transparent: true, opacity: .45, roughness: .05, metalness: .1, depthWrite: false });
  const m = new THREE.MeshStandardMaterial(o); m.userData.shared = true;
  MAT.set(key, m);
  return m;
}
export const partColor = (c, item, recipe) => (COLOR_KEYS.includes(c) ? (item && HEX.test(item[c] || "") ? item[c] : (recipe.colors && recipe.colors[c]) || "#cccccc") : HEX.test(c || "") ? c : "#cccccc");

// one part as a mesh (the designer keeps its own index on it)
export function partMesh(part, item, recipe) {
  const m = new THREE.Mesh(shapeGeometry(part.t, part.a), finishMaterial(partColor(part.c, item, recipe), part.f));
  const p = part.p || [0, 0, 0], r = part.r || [0, 0, 0], s = part.s || [1, 1, 1];
  m.position.set(p[0], p[1], p[2]); m.rotation.set(r[0], r[1], r[2]); m.scale.set(s[0], s[1], s[2]);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
export function buildRecipe(recipe, item) {
  const g = new THREE.Group();
  for (const part of (recipe && recipe.parts) || []) g.add(partMesh(part, item, recipe));
  return g;
}
