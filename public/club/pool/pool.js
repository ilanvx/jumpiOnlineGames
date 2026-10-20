/* Jumpi Club billiards (8-ball pool) against Jumpi Bot, just for fun (no coins).
   A real 3D table (three.js), real ball physics (rolling, cushions, pockets), and the rules of 8-ball:
   after the break, the first ball you pot makes you "solids" (1-7) or "stripes" (9-15); pot all yours, then the 8 to win.
   Hitting the other player's ball first, missing everything or potting the white is a foul: the other player gets the white in hand.
   Potting the 8 too early (or with the white) loses the game.
   ?demo=1: Jumpi Bot plays both sides (the hover preview in the Club). */
import * as THREE from "three";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search), DEMO = Q.get("demo") === "1";
let lang = "en"; try { lang = localStorage.getItem("jumpi-lang") === "he" ? "he" : "en"; } catch (e) {}
document.documentElement.lang = lang; document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
const T = (en, he) => (lang === "he" ? he : en);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const emo = (n, cls = "emo") => { const i = el("img", cls); i.src = `/club/emoji/${n}.png`; i.alt = ""; i.draggable = false; return i; };
const tell = (m) => { if (parent !== window) parent.postMessage(m, location.origin); };
$("snTitle").textContent = T("Billiards", "ביליארד"); $("snBackT").textContent = T("Back", "חזרה");

/* ---------- sound (the Club's switch) ---------- */
const soundOn = () => { try { return localStorage.getItem("jumpi-club-sound") !== "off"; } catch (e) { return true; } };
let ac = null;
function tone(f, d = .06, type = "sine", v = .08, delay = 0) { if (!soundOn() || DEMO) return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + delay; o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .02); } catch (e) {} }
const S = { click: (k) => tone(1900 + Math.random() * 300, .035, "triangle", Math.min(.14, .02 + k * .12)), cush: (k) => tone(180, .07, "sine", Math.min(.1, k * .1)), pot: () => { tone(320, .12, "sine", .1); tone(160, .2, "sine", .08, .06); },
  cue: (k) => tone(900, .03, "square", .02 + k * .05), yay: () => [523, 659, 784].forEach((f, i) => tone(f, .16, "triangle", .07, i * .09)), foul: () => tone(200, .25, "sawtooth", .05) };
const SND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>';
function paintSnd() { const on = soundOn(), b = $("snSnd"); b.innerHTML = on ? SND_ON : SND_OFF; b.setAttribute("aria-pressed", on); b.title = on ? T("Sound on", "צלילים פועלים") : T("Sound off", "צלילים כבויים"); b.setAttribute("aria-label", b.title); }
$("snSnd").onclick = () => { try { localStorage.setItem("jumpi-club-sound", soundOn() ? "off" : "on"); } catch (e) {} paintSnd(); };
addEventListener("storage", (e) => { if (e.key === "jumpi-club-sound") paintSnd(); });
paintSnd();
$("snBack").onclick = () => tell({ jumpiArcade: "close" });
addEventListener("keydown", (e) => { if (e.key === "Escape") tell({ jumpiArcade: "close" }); });

/* =====================================================================
   THE TABLE AND THE PHYSICS (millimetres: an 8 ft pool table; the pockets a little kinder than a real one)
   ===================================================================== */
const L = 2240, Wd = 1120, R = 28.6, HX = L / 2, HZ = Wd / 2;
const HEAD = -HX + L / 4, FOOT = HX - L / 4;               // the head string (break from behind it) and the foot spot (the rack's front ball)
const COLS = ["", "#f5c400", "#1f4fd8", "#d4202c", "#6a2fb0", "#ff7a14", "#128a3e", "#8a1c2a", "#15131a"];
const colOf = (n) => COLS[n > 8 ? n - 8 : n];
const groupOf = (n) => (n === 8 ? "eight" : n < 8 ? "solid" : "stripe");
const GNAME = { solid: ["Solids", "חלקים"], stripe: ["Stripes", "פסים"], eight: ["The 8", "השמינייה"] };
const POCKETS = [[-HX - R * .45, -HZ - R * .45, R * 2.1], [HX + R * .45, -HZ - R * .45, R * 2.1], [-HX - R * .45, HZ + R * .45, R * 2.1], [HX + R * .45, HZ + R * .45, R * 2.1], [0, -HZ - R * 1.0, R * 1.95], [0, HZ + R * 1.0, R * 1.95]];
const CM = R * 2.6, MM = R * 2.05;                          // pocket mouths along the cushions: corners and middles
const DECEL = 520, E_BALL = .95, E_CUSH = .74, VMAX = 4600;

function newBalls() {
  const b = [{ k: "cue", n: 0, x: HEAD - 40, z: 0 }];
  // the rack: 15 balls in a triangle, the 1 in front on the foot spot, the 8 in the middle, a solid and a stripe in the back corners
  const sol = [2, 3, 4, 5, 6, 7].sort(() => Math.random() - .5), str = [9, 10, 11, 12, 13, 14, 15].sort(() => Math.random() - .5);
  const slots = []; for (let row = 0; row < 5; row++) for (let i = 0; i <= row; i++) slots.push([row, i]);
  const order = new Array(15); order[0] = 1; order[4] = 8; order[10] = sol.pop(); order[14] = str.pop();
  const rest = [...sol, ...str].sort(() => Math.random() - .5); for (let k = 0; k < 15; k++) if (order[k] == null) order[k] = rest.pop();
  slots.forEach(([row, i], k) => b.push({ k: "b" + order[k], n: order[k], x: FOOT + row * R * 1.745, z: (i - row / 2) * (R * 2 + .3) }));
  return b.map((o) => ({ ...o, vx: 0, vz: 0, on: true }));
}
const inMouthX = (z) => Math.abs(z) > HZ - CM;              // near a corner, along the end cushions
const inMouthZ = (x) => Math.abs(x) > HX - CM || Math.abs(x) < MM;   // near a corner or the middle, along the side cushions
// one step of the world. ev collects what happened: the first ball the white touched, what went in, cushions, clicks
function step(balls, dt, ev) {
  for (const b of balls) { if (!b.on) continue; const sp = Math.hypot(b.vx, b.vz); if (!sp) continue;
    const ns = Math.max(0, sp - DECEL * dt), k = ns / sp; b.vx *= k; b.vz *= k; b.x += b.vx * dt; b.z += b.vz * dt; if (b.spin) b.spin += sp * dt; }
  for (let i = 0; i < balls.length; i++) { const a = balls[i]; if (!a.on) continue;
    for (let j = i + 1; j < balls.length; j++) { const c = balls[j]; if (!c.on) continue;
      const dx = c.x - a.x, dz = c.z - a.z, d2 = dx * dx + dz * dz; if (d2 >= 4 * R * R || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, vn = (a.vx - c.vx) * nx + (a.vz - c.vz) * nz;
      const ov = (2 * R - d) / 2; a.x -= nx * ov; a.z -= nz * ov; c.x += nx * ov; c.z += nz * ov;
      if (vn <= 0) continue; const imp = vn * (1 + E_BALL) / 2;
      a.vx -= nx * imp; a.vz -= nz * imp; c.vx += nx * imp; c.vz += nz * imp;
      if (ev) { if (!ev.first && (a.k === "cue" || c.k === "cue")) ev.first = a.k === "cue" ? c : a; ev.clicks.push(vn); } } }
  for (const b of balls) { if (!b.on) continue;
    for (const [px, pz, pr] of POCKETS) if ((b.x - px) ** 2 + (b.z - pz) ** 2 < pr * pr) { b.on = false; b.vx = b.vz = 0; if (ev) ev.pots.push(b); break; }
    if (!b.on) continue;
    const lx = HX - R, lz = HZ - R;
    if (Math.abs(b.x) > lx) { if (!inMouthX(b.z)) { b.x = Math.sign(b.x) * lx; if (ev && Math.abs(b.vx) > 30) ev.cush.push(Math.abs(b.vx)); b.vx = -b.vx * E_CUSH; b.vz *= .96; } else if (Math.abs(b.x) > HX + R * 1.2) { b.on = false; if (ev) ev.pots.push(b); continue; } }
    if (Math.abs(b.z) > lz) { if (!inMouthZ(b.x)) { b.z = Math.sign(b.z) * lz; if (ev && Math.abs(b.vz) > 30) ev.cush.push(Math.abs(b.vz)); b.vz = -b.vz * E_CUSH; b.vx *= .96; } else if (Math.abs(b.z) > HZ + R * 1.2) { b.on = false; if (ev) ev.pots.push(b); continue; } }
    // the jaws: a ball in a mouth that runs past the cushion line still can't escape sideways off the table
    if (Math.abs(b.x) > HX + R * .2 && !inMouthX(b.z)) { b.x = Math.sign(b.x) * (HX + R * .2); b.vx = -b.vx * .4; }
    if (Math.abs(b.z) > HZ + R * .2 && !inMouthZ(b.x)) { b.z = Math.sign(b.z) * (HZ + R * .2); b.vz = -b.vz * .4; } }
}
const moving = (balls) => balls.some((b) => b.on && (b.vx || b.vz));

/* =====================================================================
   THE RULES (8-ball)
   ===================================================================== */
window.__sn = () => ({ G, shot });
const G = { balls: newBalls(), turn: 0, groups: [null, null], inHand: "head", breakShot: true, state: "menu", level: 1, names: ["", ""], over: false, winner: -1 };
const left = (g) => G.balls.filter((b) => b.on && b.k !== "cue" && groupOf(b.n) === g).length;
// what I may hit first (and pot): my group; the 8 once my group is gone; anything but the 8 on an open table
function legalFor(p, n) { const g = G.groups[p]; if (!g) return n !== 8; return left(g) === 0 ? n === 8 : groupOf(n) === g; }
const legal = (b) => b.k !== "cue" && legalFor(G.turn, b.n);
function judge(ev, by) {
  const p = by, o = 1 - p, pots = ev.pots.filter((b) => b.k !== "cue"), cueIn = ev.pots.some((b) => b.k === "cue"), first = ev.first, brk = G.breakShot;
  const myG = G.groups[p], onEight = !!myG && left(myG) + pots.filter((b) => groupOf(b.n) === myG).length === 0;   // was I on the 8 before this shot?
  let foul = null;
  if (cueIn) foul = T("The white went in!", "הלבן נפל לכיס!");
  else if (!first) foul = T("No ball hit!", "לא פגעת באף כדור!");
  else if (!brk && !(myG ? (onEight ? first.n === 8 : groupOf(first.n) === myG) : first.n !== 8)) foul = first.n === 8 ? T("Hit the 8 first", "פגעת קודם בשמינייה") : T("Hit the other player's ball first", "פגעת קודם בכדור של היריב");
  G.breakShot = false;
  // the 8
  if (pots.some((b) => b.n === 8)) {
    if (brk) { const e = G.balls.find((b) => b.n === 8); Object.assign(e, { x: FOOT, z: 0, vx: 0, vz: 0, on: true }); while (G.balls.some((q) => q !== e && q.on && (q.x - e.x) ** 2 + (q.z - e.z) ** 2 < 4 * R * R)) e.x += R; }
    else return endGame(onEight && !foul ? p : o, onEight && !foul ? T("The 8 is in!", "השמינייה בפנים!") : T("The 8 went in too early!", "השמינייה נכנסה מוקדם מדי!"));
  }
  const potted = pots.filter((b) => b.n !== 8);
  let named = false;
  if (!foul && !myG && !brk && potted.length) { const g = groupOf(potted[0].n); G.groups[p] = g; G.groups[o] = g === "solid" ? "stripe" : "solid"; named = true;
    msg(T(`${G.names[p]}: ${T(...GNAME[g])}!`, `${G.names[p]}: ${T(...GNAME[g])}!`), "good"); }
  const mine = G.groups[p], goodPot = !foul && (brk ? potted.length > 0 : mine ? potted.some((b) => groupOf(b.n) === mine) : false);
  if (window.__FF) console.info("[pool] shot by", p, "first", first && first.n, "pots", pots.map((b) => b.n).join("+"), foul || "ok", goodPot ? "again" : "");
  if (foul) { G.turn = o; G.inHand = "any"; msg(T(`Foul! ${foul} White in hand for ${G.names[o]}`, `עבירה! ${foul} הלבן ביד של ${G.names[o]}`), "foul"); S.foul(); }
  else if (goodPot) { if (!named) msg(potted.length > 1 ? T(`${potted.length} in!`, `${potted.length} נכנסו!`) : T("Nice shot!", "יפה!"), "good"); }
  else G.turn = o;
  paintHud(); nextTurn();
}

/* =====================================================================
   3D: the table, the balls, the cue
   ===================================================================== */
const canvas = $("snCanvas"), renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(), U = 1 / 1000;   // three units: metres
const camera = new THREE.PerspectiveCamera(36, 1, .05, 50);
scene.add(new THREE.HemisphereLight("#fff4e8", "#3a2a6a", .9));
const lamp = new THREE.SpotLight("#fff2dc", 24, 8, .9, .55, 1.4); lamp.position.set(0, 2.6, .35); lamp.target.position.set(0, 0, 0); lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048); lamp.shadow.bias = -.0004; lamp.shadow.radius = 4; scene.add(lamp, lamp.target);
[-1.1, 1.1].forEach((x) => { const l = new THREE.PointLight("#ffe9c8", 3.5, 4, 1.6); l.position.set(x, 1.4, 0); scene.add(l); });
{ const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene(); es.background = new THREE.Color("#6a4ad0");
  const add = (c, x, y, z, s) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); m.scale.setScalar(s); es.add(m); };
  add("#ffffff", 0, 6, 0, 2.2); add("#ffd9a0", -5, 2, 3, 1.6); add("#9fd8ff", 5, 2, -3, 1.6); scene.environment = pm.fromScene(es, .04).texture; }

// the cloth: blue felt with the head string and the foot spot
const cloth = (() => { const c = document.createElement("canvas"), PX = 1.2; c.width = Math.round(L * PX / 2); c.height = Math.round(Wd * PX / 2); const x = c.getContext("2d"), k = c.width / L;
  const g = x.createRadialGradient(c.width / 2, c.height / 2, 30, c.width / 2, c.height / 2, c.width * .62); g.addColorStop(0, "#1f6fd0"); g.addColorStop(1, "#124a9c"); x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? "255,255,255" : "0,20,60"},${Math.random() * .045})`; x.fillRect(Math.random() * c.width, Math.random() * c.height, 1.5, 1.5); }
  const X = (mx) => (mx + HX) * k, Z = (mz) => (mz + HZ) * k; x.strokeStyle = "rgba(255,255,255,.5)"; x.lineWidth = 2;
  x.beginPath(); x.moveTo(X(HEAD), 0); x.lineTo(X(HEAD), c.height); x.stroke();
  x.fillStyle = "rgba(255,255,255,.8)"; [[FOOT, 0], [HEAD, 0]].forEach(([sx, sz]) => { x.beginPath(); x.arc(X(sx), Z(sz), 3, 0, 7); x.fill(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })();
const TABLE = new THREE.Group(); scene.add(TABLE);
{ const bed = new THREE.Mesh(new THREE.PlaneGeometry(L * U + .2, Wd * U + .2), new THREE.MeshStandardMaterial({ map: cloth, roughness: .95, envMapIntensity: .25 })); bed.rotation.x = -Math.PI / 2; bed.receiveShadow = true; TABLE.add(bed);
  cloth.repeat.set((L + 200) / L, (Wd + 200) / Wd); cloth.offset.set(-100 / L, -100 / Wd);
  // cushions (green, rounded), the wooden frame round them, gold on the corners
  const cushM = new THREE.MeshStandardMaterial({ color: "#16509f", roughness: .85, envMapIntensity: .3 }), woodM = new THREE.MeshPhysicalMaterial({ color: "#4a200c", roughness: .4, clearcoat: 1, clearcoatRoughness: .15, envMapIntensity: .45 });
  const brassM = new THREE.MeshPhysicalMaterial({ color: "#e7b54a", roughness: .25, metalness: .85 }), holeM = new THREE.MeshStandardMaterial({ color: "#050308", roughness: 1 });
  const CW = .045, CHt = .044, FW = .11, FH = .072;
  const seg = (x0, x1, z, horiz, side) => { const len = Math.abs(x1 - x0); if (len <= 0) return; const m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : CW, CHt, horiz ? CW : len), cushM);
    if (horiz) m.position.set((x0 + x1) / 2, CHt / 2, z + side * CW / 2); else m.position.set(z + side * CW / 2, CHt / 2, (x0 + x1) / 2); m.castShadow = m.receiveShadow = true; TABLE.add(m); };
  const hx = HX * U, hz = HZ * U, cm = CM * U * .8, mm = MM * U * .8;
  [-1, 1].forEach((s) => { seg(-hx + cm, -mm, s * hz, true, s); seg(mm, hx - cm, s * hz, true, s); seg(-hz + cm, hz - cm, s * hx, false, s); });
  const frame = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, FH, d), woodM); m.position.set(x, FH / 2 - .012, z); m.castShadow = m.receiveShadow = true; TABLE.add(m); };
  frame(L * U + 2 * (CW + FW), FW, 0, -(hz + CW + FW / 2)); frame(L * U + 2 * (CW + FW), FW, 0, hz + CW + FW / 2); frame(FW, Wd * U + 2 * CW, -(hx + CW + FW / 2), 0); frame(FW, Wd * U + 2 * CW, hx + CW + FW / 2, 0);
  { const leg = new THREE.Mesh(new THREE.BoxGeometry(L * U + .3, .5, Wd * U + .3), woodM); leg.position.y = -.27; TABLE.add(leg); }
  POCKETS.forEach(([px, pz, pr], i) => { const r = pr * U * 1.05, h = new THREE.Mesh(new THREE.CylinderGeometry(r, r * .92, .02, 40), holeM); h.position.set(px * U, .001, pz * U); TABLE.add(h);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + .012, .012, 12, 40), brassM); ring.rotation.x = -Math.PI / 2; ring.position.set(px * U, .012, pz * U); TABLE.add(ring); void i; });
  // the diamonds on the wood
  const dm = new THREE.MeshPhysicalMaterial({ color: "#fff6dc", roughness: .2, metalness: .3 });
  for (let k = 1; k < 8; k++) { if (k === 4) continue; [-1, 1].forEach((s) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .004, 12), dm); d.position.set(-hx + k * (L * U / 8), FH - .01, s * (hz + CW + FW / 2)); TABLE.add(d); }); }
  for (let k = 1; k < 4; k++) [-1, 1].forEach((s) => { if (k === 2) return; const d = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .004, 12), dm); d.position.set(s * (hx + CW + FW / 2), FH - .01, -hz + k * (Wd * U / 4)); TABLE.add(d); }); }
// the balls
const ballG = new THREE.SphereGeometry(R * U, 40, 28);
// each ball: its colour (a band for the stripes) and its number in a white circle, painted round the ball
function ballTex(n) { const c = document.createElement("canvas"); c.width = 512; c.height = 256; const x = c.getContext("2d");
  if (!n) { x.fillStyle = "#fbf7ee"; x.fillRect(0, 0, 512, 256); x.fillStyle = "#e0453a"; [[128, 128], [384, 128]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 9, 0, 7); x.fill(); }); }
  else { const col = colOf(n); x.fillStyle = n > 8 ? "#fbf7ee" : col; x.fillRect(0, 0, 512, 256); if (n > 8) { x.fillStyle = col; x.fillRect(0, 62, 512, 132); }
    [128, 384].forEach((cx) => { x.save(); x.translate(cx, 128); x.scale(1, 1); x.fillStyle = "#fbf7ee"; x.beginPath(); x.ellipse(0, 0, 40, 46, 0, 0, 7); x.fill();
      x.fillStyle = "#1b1622"; x.font = `800 ${n > 9 ? 44 : 54}px "Lilita One", "Arial Black", sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(String(n), 0, 3); if (n === 6 || n === 9) x.fillRect(-14, 26, 28, 4); x.restore(); }); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
const mats = {}; for (let n = 0; n <= 15; n++) mats[n ? "b" + n : "cue"] = new THREE.MeshPhysicalMaterial({ map: ballTex(n), roughness: .12, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 1.1 });
const meshes = new Map();
function syncBalls(dtMove = 0) {
  for (const b of G.balls) { let m = meshes.get(b); if (!m) { m = new THREE.Mesh(ballG, mats[b.k]); m.castShadow = true; m.receiveShadow = true; m.rotation.set(Math.random() * 6, Math.random() * 6, 0); if (b.k !== "cue") m.rotation.set(-Math.PI / 2 + (Math.random() - .5) * .8, 0, Math.random() * 6); scene.add(m); meshes.set(b, m); b.px = b.x; b.pz = b.z; }
    m.visible = b.on; if (!b.on) continue;
    // roll: turn the ball by how far it moved
    const dx = b.x - (b.px ?? b.x), dz = b.z - (b.pz ?? b.z), d = Math.hypot(dx, dz);
    if (d > .01) { const axis = new THREE.Vector3(dz, 0, -dx).normalize(); m.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, d / R)); }
    b.px = b.x; b.pz = b.z; m.position.set(b.x * U, R * U, b.z * U); }
}
// the cue: a tapered stick (wood + a dark butt), and the aim line with a ghost ball
const CUE = new THREE.Group(); scene.add(CUE);
{ const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.0055, .014, 1.05, 24), new THREE.MeshPhysicalMaterial({ color: "#e9c48a", roughness: .35, clearcoat: .8 })); shaft.rotation.x = Math.PI / 2; shaft.position.z = -.525 - .02;
  const butt = new THREE.Mesh(new THREE.CylinderGeometry(.0142, .0155, .36, 24), new THREE.MeshPhysicalMaterial({ color: "#2a1a40", roughness: .3, clearcoat: 1 })); butt.rotation.x = Math.PI / 2; butt.position.z = -.86;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(.0055, .0055, .012, 16), new THREE.MeshStandardMaterial({ color: "#3a7fe0", roughness: .8 })); tip.rotation.x = Math.PI / 2; tip.position.z = -.014;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(.0072, .0072, .02, 16), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: .4 })); ring.rotation.x = Math.PI / 2; ring.position.z = -.03;
  const stick = new THREE.Group(); stick.add(shaft, butt, tip, ring); stick.traverse((o) => { if (o.isMesh) o.castShadow = true; }); stick.name = "stick"; CUE.add(stick); }
const AIM = new THREE.Group(); scene.add(AIM);
const lineM = new THREE.LineDashedMaterial({ color: "#ffffff", dashSize: .03, gapSize: .02, transparent: true, opacity: .85 });
const aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]), lineM); AIM.add(aimLine);
const ghost = new THREE.Mesh(new THREE.RingGeometry(R * U * .86, R * U, 32), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: .9, side: THREE.DoubleSide })); ghost.rotation.x = -Math.PI / 2; AIM.add(ghost);
const tgtLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]), new THREE.LineBasicMaterial({ color: "#ffd23a", transparent: true, opacity: .9 })); AIM.add(tgtLine);
const dZone = new THREE.Mesh(new THREE.PlaneGeometry((HEAD + HX) * U, Wd * U), new THREE.MeshBasicMaterial({ color: "#ffd23a", transparent: true, opacity: .16, depthWrite: false })); dZone.rotation.x = -Math.PI / 2; dZone.position.set((HEAD - HX) / 2 * U, .002, 0); dZone.visible = false; scene.add(dZone);

// fit the table to the screen (turned on its side on a tall phone)
let portrait = false;
function fit() {
  const st = $("snStage"), w = st.clientWidth, h = st.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
  portrait = h > w * 1.05; const long = L * U + .5, short = Wd * U + .5, fw = (portrait ? short : long) * (DEMO ? .92 : 1.12), fh = portrait ? long : short;   // room at the side for the power bar
  const vf = THREE.MathUtils.degToRad(camera.fov), dist = Math.max(fh / 2 / Math.tan(vf / 2), fw / 2 / Math.tan(vf / 2) / camera.aspect) * (DEMO ? .98 : 1.06);
  const tilt = .3; camera.up.set(0, 1, 0);
  if (portrait) { camera.position.set(-Math.sin(tilt) * dist, Math.cos(tilt) * dist, 0); }
  else camera.position.set(0, Math.cos(tilt) * dist, Math.sin(tilt) * dist);
  camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
}
addEventListener("resize", fit);

/* =====================================================================
   PLAYING: aiming, power, shooting, the bot
   ===================================================================== */
let aim = 0, power = .45, shot = null, last = performance.now(); const FPS = { n: 0 }; window.__fps = FPS;
const cueBall = () => G.balls[0];
// where the white would first hit: the first ball along the line (or a cushion)
function firstContact(cx, cz, dx, dz) {
  let best = Infinity, hit = null;
  for (const b of G.balls) { if (!b.on || b.k === "cue") continue; const fx = b.x - cx, fz = b.z - cz, t = fx * dx + fz * dz; if (t <= 0) continue;
    const perp2 = fx * fx + fz * fz - t * t, rr = 4 * R * R; if (perp2 > rr) continue; const tt = t - Math.sqrt(rr - perp2); if (tt < best) { best = tt; hit = b; } }
  let tw = Infinity; if (dx) tw = Math.min(tw, ((dx > 0 ? HX - R : -HX + R) - cx) / dx); if (dz) tw = Math.min(tw, ((dz > 0 ? HZ - R : -HZ + R) - cz) / dz);
  return hit && best < tw ? { t: best, b: hit } : { t: tw, b: null };
}
function paintAim() {
  const c = cueBall();
  const show = (G.state === "aim" || G.state === "botAim") && c.on;
  CUE.visible = show; AIM.visible = show && G.state === "aim" && !DEMO;
  if (!show) return;
  const dx = Math.cos(aim), dz = Math.sin(aim), fc = firstContact(c.x, c.z, dx, dz), gx = c.x + dx * fc.t, gz = c.z + dz * fc.t, y = R * U;
  aimLine.geometry.setFromPoints([new THREE.Vector3(c.x * U, y, c.z * U), new THREE.Vector3(gx * U, y, gz * U)]); aimLine.computeLineDistances();
  ghost.position.set(gx * U, y, gz * U);
  if (fc.b) { const nx = fc.b.x - gx, nz = fc.b.z - gz, n = Math.hypot(nx, nz) || 1, len = G.level === 0 ? 900 : 380; tgtLine.visible = true;
    tgtLine.geometry.setFromPoints([new THREE.Vector3(fc.b.x * U, y, fc.b.z * U), new THREE.Vector3((fc.b.x + nx / n * len) * U, y, (fc.b.z + nz / n * len) * U)]);
    tgtLine.material.color.set(legal(fc.b) ? "#ffd23a" : "#ff4f6d"); } else tgtLine.visible = false;
  const pull = .03 + power * .22 * (G.state === "botAim" ? botPull : 1);
  CUE.position.set(c.x * U, y + .006, c.z * U); CUE.rotation.set(0, Math.PI / 2 - aim, 0); CUE.children[0].position.z = -(R * U + pull); CUE.children[0].rotation.x = .09;
}
function shoot(a, p) {
  const c = cueBall(); c.vx = Math.cos(a) * p * VMAX; c.vz = Math.sin(a) * p * VMAX; S.cue(p);
  shot = { ev: { first: null, pots: [], clicks: [], cush: [] }, by: G.turn }; G.state = "roll"; G.inHand = false; dZone.visible = false;
  $("snPower").hidden = $("snFine").hidden = true; paintAim();
}
function nextTurn() {
  if (G.over) return;
  const c = cueBall();
  if (G.inHand && !c.on) { // the white back on the table (behind the head string), wherever there's room
    Object.assign(c, { x: HEAD - 40, z: 0, vx: 0, vz: 0, on: true }); let k = 0; while (G.balls.some((o) => o !== c && o.on && (o.x - c.x) ** 2 + (o.z - c.z) ** 2 < 4.4 * R * R) && k++ < 60) c.z = ((k % 2 ? 1 : -1) * Math.ceil(k / 2) * R * 1.2); }
  const bot = DEMO || G.turn === 1;
  if (bot) { G.state = "bot"; $("snPower").hidden = $("snFine").hidden = true; dZone.visible = false; setTimeout(botPlay, DEMO ? 350 : 750); }
  else { G.state = "aim"; $("snPower").hidden = $("snFine").hidden = false; dZone.visible = G.inHand === "head"; aim = bestGuessAim(); paintPower(); }
  paintHud();
}
// start a turn pointing at a ball you're on (kinder than pointing nowhere)
function bestGuessAim() { const c = cueBall(); let best = null, bd = Infinity; for (const b of G.balls) if (b.on && legal(b)) { const d = (b.x - c.x) ** 2 + (b.z - c.z) ** 2; if (d < bd) { bd = d; best = b; } } return best ? Math.atan2(best.z - c.z, best.x - c.x) : 0; }

/* the bot: tries many shots in a copy of the table and takes the best one, then misses a little (by level) */
let botPull = 0;
const LEVELS = [{ noise: .024, pw: .1, name: ["Easy", "קל"] }, { noise: .009, pw: .06, name: ["Medium", "בינוני"] }, { noise: .0025, pw: .03, name: ["Hard", "קשה"] }];
function simulate(a, p) {
  const balls = G.balls.map((b) => ({ ...b })), ev = { first: null, pots: [], clicks: [], cush: [] }, c = balls[0];
  c.vx = Math.cos(a) * p * VMAX; c.vz = Math.sin(a) * p * VMAX;
  for (let i = 0; i < 2400 && moving(balls); i++) step(balls, 1 / 200, ev);
  return { ev, balls };
}
function rateShot(r) {
  const ev = r.ev, pots = ev.pots.filter((b) => b.k !== "cue"), cueIn = ev.pots.some((b) => b.k === "cue"), p = G.turn, g = G.groups[p];
  const onEight = !!g && left(g) === 0;
  if (pots.some((b) => b.n === 8)) return onEight && !cueIn && ev.first && ev.first.n === 8 ? 100 : -100;
  if (cueIn || !ev.first || (!G.breakShot && !legalFor(p, ev.first.n))) return -10;
  let s = 0; for (const b of pots) s += !g ? 10 : groupOf(b.n) === g ? 10 : -3;   // theirs going in helps them
  // where the white ends up: near something to pot next is good
  const c = r.balls[0]; if (c.on) { let near = Infinity; for (const b of r.balls) if (b.on && b.k !== "cue") near = Math.min(near, Math.hypot(b.x - c.x, b.z - c.z)); s += near < 900 ? 1.5 : 0; }
  return s + 1;   // a legal touch is worth something
}
function botPlay() {
  if (G.over || G.state !== "bot") return;
  const c = cueBall(), cands = [];
  for (const b of G.balls) { if (!b.on || !legal(b)) continue;
    for (const [px, pz] of POCKETS) { const tx = px - b.x, tz = pz - b.z, tl = Math.hypot(tx, tz), gx = b.x - tx / tl * 2 * R, gz = b.z - tz / tl * 2 * R;
      const ax = gx - c.x, az = gz - c.z, cut = (ax * tx + az * tz) / (Math.hypot(ax, az) * tl); if (cut < .25) continue;
      const a = Math.atan2(az, ax); for (const p of [.28, .42, .6, .82]) cands.push([a, p]); }
    const a = Math.atan2(b.z - c.z, b.x - c.x); cands.push([a, .3], [a, .5]); }
  for (let k = 0; k < 24; k++) cands.push([Math.random() * Math.PI * 2, .35 + Math.random() * .4]);
  if (G.breakShot) { const a = Math.atan2(-c.z, FOOT - c.x); cands.length = 0; cands.push([a, 1], [a + .004, .95], [a - .004, .95]); }
  let best = null, bs = -1e9;
  for (const [a, p] of cands) { const s = rateShot(simulate(a, p)) + Math.random() * .2; if (s > bs) { bs = s; best = [a, p]; } }
  const lv = LEVELS[DEMO ? 1 : G.level], ta = best[0] + (Math.random() - .5) * 2 * lv.noise, tp = Math.min(1, Math.max(.12, best[1] * (1 + (Math.random() - .5) * 2 * lv.pw)));
  // turn the cue round to the shot, pull back, hit
  G.state = "botAim"; const a0 = aim, da = Math.atan2(Math.sin(ta - a0), Math.cos(ta - a0)), t0 = performance.now(), dur = DEMO ? 550 : 900;
  power = tp; botPull = 0;
  const anim = (now) => { if (G.state !== "botAim") return; const k = Math.min(1, (now - t0) / dur), e = k < .6 ? (k / .6) : 1, ease = 1 - Math.pow(1 - e, 3);
    aim = a0 + da * ease; botPull = k < .6 ? 0 : Math.sin(((k - .6) / .4) * Math.PI / 2); paintAim();
    if (k < 1) requestAnimationFrame(anim); else setTimeout(() => { if (G.state === "botAim") shoot(ta, tp); }, 120); };
  requestAnimationFrame(anim);
}

/* ---------- my controls: aim with the mouse / finger on the table, power with the bar (pull down, let go to shoot) ---------- */
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R * U), hitP = new THREE.Vector3();
function tablePoint(e) { const r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera); return ray.ray.intersectPlane(plane, hitP) ? [hitP.x / U, hitP.z / U] : null; }
const canPlace = (x, z) => Math.abs(z) < HZ - R && x > -HX + R && x < (G.inHand === "head" ? HEAD : HX - R);
/* the mouse: move to aim; press and pull back (away from where you aim) for the power; let go to shoot.
   A finger: drag on the table to aim, then the power bar. */
let dragging = false, placing = false, pull = null;
const PULL_MAX = 850;   // how far back (mm on the table) is full power
canvas.addEventListener("pointerdown", (e) => {
  if (G.state !== "aim" || e.button > 0) return; const p = tablePoint(e); if (!p) return; canvas.setPointerCapture(e.pointerId);
  const c = cueBall();
  if (G.inHand && Math.hypot(p[0] - c.x, p[1] - c.z) < R * 3) { placing = true; return; }
  if (e.pointerType === "mouse") { pull = { x: p[0], z: p[1], p0: power }; power = 0; paintPower(); $("snPower").classList.add("pulling"); return; }
  dragging = true; aimAt(p);
});
canvas.addEventListener("pointermove", (e) => {
  if (G.state !== "aim") return; const p = tablePoint(e); if (!p) return;
  if (placing) { placeWhite(p); return; }
  if (pull) { const back = (pull.x - p[0]) * Math.cos(aim) + (pull.z - p[1]) * Math.sin(aim); power = Math.max(0, Math.min(1, back / PULL_MAX)); paintPower(); return; }
  if (dragging || e.pointerType === "mouse") aimAt(p);
});
canvas.addEventListener("pointerup", () => {
  dragging = false; placing = false; if (!pull) return; const p0 = pull.p0; pull = null; $("snPower").classList.remove("pulling");
  if (power > .03 && G.state === "aim") shoot(aim, power); else { power = p0; paintPower(); }
});
canvas.addEventListener("pointercancel", () => { dragging = false; placing = false; if (pull) { power = pull.p0; pull = null; $("snPower").classList.remove("pulling"); paintPower(); } });
canvas.addEventListener("contextmenu", (e) => { e.preventDefault(); if (pull) { power = pull.p0; pull = null; $("snPower").classList.remove("pulling"); paintPower(); } });   // right click: never mind
function aimAt([x, z]) { const c = cueBall(); if (Math.hypot(x - c.x, z - c.z) < R * 1.5) return; aim = Math.atan2(z - c.z, x - c.x); paintAim(); }
function placeWhite([x, z]) {
  const c = cueBall(), px = Math.max(-HX + R, Math.min(G.inHand === "head" ? HEAD : HX - R, x)), pz = Math.max(-HZ + R, Math.min(HZ - R, z));
  if (G.balls.some((o) => o !== c && o.on && (o.x - px) ** 2 + (o.z - pz) ** 2 < 4 * R * R)) return; c.x = px; c.z = pz; c.px = px; c.pz = pz; paintAim();
}
// the power bar
const track = $("snPwTrack");
function paintPower() { const h = track.clientHeight, k = 38 + 8; $("snPwFill").style.height = (power * 100) + "%"; $("snPwKnob").style.top = (4 + power * (h - k)) + "px"; $("snPwT").textContent = Math.round(power * 100) + "%"; paintAim(); }
let pwDrag = null;
track.addEventListener("pointerdown", (e) => { if (G.state !== "aim") return; track.setPointerCapture(e.pointerId); pwDrag = { y: e.clientY, p0: 0 }; power = 0; setPw(e); });
track.addEventListener("pointermove", (e) => { if (pwDrag) setPw(e); });
track.addEventListener("pointerup", () => { if (!pwDrag) return; pwDrag = null; if (power > .04 && G.state === "aim") shoot(aim, power); else { power = .45; paintPower(); } });
function setPw(e) { const r = track.getBoundingClientRect(); power = Math.max(0, Math.min(1, (e.clientY - r.top - 20) / (r.height - 40))); paintPower(); }
$("snL").onclick = () => { aim -= .006; paintAim(); }; $("snR").onclick = () => { aim += .006; paintAim(); };
addEventListener("keydown", (e) => {
  if (G.state !== "aim") return;
  if (e.code === "ArrowLeft" || e.code === "ArrowRight") { aim += (e.code === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? .002 : .01) * (lang === "he" ? 1 : 1); paintAim(); e.preventDefault(); }
  if (e.code === "ArrowUp" || e.code === "ArrowDown") { power = Math.max(.05, Math.min(1, power + (e.code === "ArrowUp" ? .05 : -.05))); paintPower(); e.preventDefault(); }
  if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); shoot(aim, power); }
});

/* ---------- the loop ---------- */
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.12, (now - last) / 1000); last = now; FPS.n++;
  if (G.state === "roll") {
    const sim = window.__FF ? 1.5 : dt, n = Math.ceil(sim / (1 / 480)); for (let i = 0; i < n; i++) step(G.balls, sim / n, shot.ev);
    const ev = shot.ev; ev.clicks.splice(0).forEach((v) => S.click(v / VMAX)); ev.cush.splice(0).forEach((v) => S.cush(v / VMAX));
    if (ev.pots.length !== shot.npots) { if ((shot.npots || 0) < ev.pots.length) S.pot(); shot.npots = ev.pots.length; }
    if (!moving(G.balls)) { G.state = "judge"; const s = shot; shot = null; setTimeout(() => judge(s.ev, s.by), 250); }
  }
  syncBalls(); renderer.render(scene, camera);
}

/* ---------- the scoreboard: who's solids / stripes, and their balls still on the table ---------- */
function ballDot(n) { const i = el("i", "sn-ball" + (n > 8 ? " st" : "")); i.style.setProperty("--c", colOf(n)); i.textContent = n; return i; }
function paintHud() {
  $("snHud").hidden = false;
  [0, 1].forEach((i) => { $("snP" + i).classList.toggle("turn", G.turn === i); $("snN" + i).textContent = G.names[i]; const s = $("snS" + i); s.textContent = ""; const g = G.groups[i];
    if (!g) s.append(el("span", "sn-open", T("Open table", "שולחן פתוח")));
    else { const mine = G.balls.filter((b) => b.on && b.k !== "cue" && groupOf(b.n) === g).map((b) => b.n).sort((a, c) => a - c); if (mine.length) mine.forEach((n) => s.append(ballDot(n))); else s.append(ballDot(8)); } });
  const oe = $("snOn"); oe.textContent = ""; const g = G.groups[G.turn], tgt = !g ? null : left(g) ? g : "eight";
  oe.append(tgt ? (tgt === "eight" ? ballDot(8) : ballDot(tgt === "solid" ? 1 : 9)) : el("i", "sn-ball mix"), document.createTextNode(tgt ? T("Pot: ", "להכניס: ") + T(...GNAME[tgt]) : T("Any ball (not the 8)", "כל כדור (לא השמינייה)")));
  const mouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
  $("snInfo").textContent = G.inHand && G.state === "aim" ? T("Drag the white to move it, then aim", "גררו את הלבן כדי להזיז אותו, ואז כוונו")
    : G.state === "aim" && mouse ? T("Aim with the mouse · hold the button and pull back for power · let go to shoot", "מכוונים עם העכבר · לוחצים ומושכים אחורה לכוח · משחררים ויורים")
    : G.breakShot ? T("Break!", "פתיחה!") : "";
}
let msgT = 0;
function msg(t, cls = "") { const m = $("snMsg"); m.textContent = t; m.className = "sn-msg " + cls; m.hidden = false; m.style.animation = "none"; void m.offsetWidth; m.style.animation = ""; clearTimeout(msgT); msgT = setTimeout(() => (m.hidden = true), 2400); }

/* ---------- start and end ---------- */
function startScreen() {
  G.state = "menu"; const s = $("snStart"); s.textContent = ""; s.hidden = false;
  const c = el("div", "sn-card"); c.append(emo("jumpi_cool"), el("h2", "", T("Billiards vs Jumpi Bot", "ביליארד נגד ג׳אמפי בוט")), el("span", "sn-fun", T("Just for fun · no coins", "לכיף · בלי מטבעות")));
  const how = el("ol", "sn-how");
  [[T("Aim: move the mouse (or drag your finger) on the table.", "כיוון: מזיזים את העכבר (או גוררים עם האצבע) על השולחן.")], [T("Power: hold the mouse button and pull back, then let go. On a phone: the power bar.", "כוח: לוחצים על העכבר ומושכים אחורה, ומשחררים. בטלפון: פס הכוח.")],
    [T("The first ball you pot makes you solids (1-7) or stripes (9-15).", "הכדור הראשון שתכניסו קובע: חלקים (1-7) או פסים (9-15).")], [T("Pot all yours, then the 8 to win. The 8 too early = you lose!", "מכניסים את כל שלכם ואז את השמינייה. שמינייה מוקדם מדי = הפסד!")]]
    .forEach(([t], i) => { const li = el("li"); li.append(el("i", "", String(i + 1)), el("span", "", t)); how.append(li); });
  c.append(how);
  const lv = el("div", "sn-lv"); LEVELS.forEach((L2, i) => { const b = el("button", "", T(...L2.name)); b.type = "button"; b.setAttribute("aria-pressed", i === G.level); b.onclick = () => { G.level = i; lv.querySelectorAll("button").forEach((x, j) => x.setAttribute("aria-pressed", j === i)); }; lv.append(b); }); c.append(lv);
  const btns = el("div", "sn-btns"), go = el("button", "sn-btn go", T("Play!", "לשחק!")); go.type = "button"; go.onclick = () => { s.hidden = true; newGame(); }; btns.append(go); c.append(btns); s.append(c); go.focus();
}
function newGame() {
  for (const m of meshes.values()) scene.remove(m); meshes.clear();
  Object.assign(G, { balls: newBalls(), turn: 0, groups: [null, null], inHand: "head", breakShot: true, over: false, winner: -1 }); syncBalls(); nextTurn(); if (!DEMO) msg(T("Your break!", "אתם פותחים!"));
}
function endGame(w, why) {
  G.over = true; G.winner = w; G.state = "over"; paintHud(); msg(why, w === 0 || DEMO ? "good" : "foul"); if (DEMO) { setTimeout(newGame, 1800); return; }
  const win = w === 0, s = $("snEnd"); s.textContent = ""; s.hidden = false; const c = el("div", "sn-card");
  c.append(emo(win ? "jumpi_party" : "jumpi_gg"), el("h2", "", win ? T("You won!", "ניצחתם!") : T("Jumpi Bot won!", "ג׳אמפי בוט ניצח!")), el("p", "sn-why", why));
  const btns = el("div", "sn-btns"), again = el("button", "sn-btn go", T("Play again", "עוד משחק")), menu = el("button", "sn-btn ghost", T("Menu", "תפריט")); again.type = menu.type = "button";
  again.onclick = () => { s.hidden = true; newGame(); }; menu.onclick = () => { s.hidden = true; startScreen(); }; btns.append(menu, again); c.append(btns); s.append(c); if (win) S.yay();
}

/* ---------- go ---------- */
(async () => {
  G.names = [T("You", "אתם"), T("Jumpi Bot", "ג׳אמפי בוט")];
  $("snAv1").append(emo("jumpi_cool"));
  if (!DEMO) { try { const r = await fetch("/api/auth/me", { credentials: "same-origin" }); const d = r.ok ? await r.json() : null;
      if (d && d.user) { G.names[0] = d.user.username; const i = new Image(); i.alt = ""; i.onload = () => $("snAv0").append(i); i.onerror = () => $("snAv0").append(emo("jumpi_hi")); i.src = "/api/club/pic/" + encodeURIComponent(d.user.username); } else $("snAv0").append(emo("jumpi_hi")); } catch (e) { $("snAv0").append(emo("jumpi_hi")); } }
  else { G.names = [T("Jumpi Bot", "ג׳אמפי בוט"), T("Pip Bot", "פיפ בוט")]; $("snAv0").append(emo("jumpi_hi")); }
  fit(); syncBalls(); requestAnimationFrame(loop);
  if (DEMO) { $("snHud").hidden = false; newGame(); } else { startScreen(); paintHud(); }
})();
