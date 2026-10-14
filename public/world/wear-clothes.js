/*
  The autumn 2026 wardrobe: how the new shirts and pants look (items listed in public/shared/items/clothes.js).
  Used by public/index.html: shirtTex / sleeveTex / pantsTex call these painters by item id, and the shirt / pants
  builders add any 3D extras returned by shirt3D / pants3D. H = WEAR_H() in index.html (the shared helpers).
  Canvas layout: shirts span the whole way round (front centre at u = .25, back centre at u = .75), 1024 x 256;
  sleeves 256 x 128; pants 512 x 256 (waistband = top 30 px, painted afterwards).
  On the body the top ~100 px of a shirt sit under the chin, so front prints live between y ~110 and the hem (h - 26).
*/
const TAU = Math.PI * 2;
const FONT = '"Lilita One", "Arial Rounded MT Bold", sans-serif';
const INK = "#2a1f2e";

/* ======================= small canvas helpers ======================= */
const circ = (x, cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, TAU); };
const ell = (x, cx, cy, rx, ry, a = 0) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, a, 0, TAU); };
const fillC = (x, col, cx, cy, r) => { x.fillStyle = col; circ(x, cx, cy, r); x.fill(); };
const fillE = (x, col, cx, cy, rx, ry, a = 0) => { x.fillStyle = col; ell(x, cx, cy, rx, ry, a); x.fill(); };
const outline = (x, lw = 5, col = INK) => { x.lineWidth = lw; x.strokeStyle = col; x.lineJoin = "round"; x.lineCap = "round"; x.stroke(); };
const word = (x, txt, cx, cy, size, col) => { x.save(); x.font = `${size}px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = col; x.fillText(txt, cx, cy); x.restore(); };
// a big sports number with an outline
function bigNum(x, txt, cx, cy, size, fill, stroke) {
  x.save(); x.font = `${size}px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
  if (stroke) { x.lineWidth = size * .12; x.strokeStyle = stroke; x.strokeText(txt, cx, cy); }
  x.fillStyle = fill; x.fillText(txt, cx, cy); x.restore();
}
// the sides of the body (u = 0, .5, 1)
const sides = (w) => [0, w * .5, w];
// knitted look: rows of little V stitches
function knit(x, w, h, dark = "rgba(0,0,0,.16)", light = "rgba(255,255,255,.13)", s = 8) {
  x.lineWidth = 2; x.lineCap = "round";
  for (let y = 0; y < h; y += s) for (let u = (y / s) % 2 ? s / 2 : 0; u < w; u += s) {
    x.strokeStyle = dark; x.beginPath(); x.moveTo(u, y); x.lineTo(u + s / 2, y + s * .8); x.lineTo(u + s, y); x.stroke();
    x.strokeStyle = light; x.beginPath(); x.moveTo(u + 1, y - 1); x.lineTo(u + s / 2, y + s * .5); x.stroke();
  }
}
// cross-stitch picture from strings ("x" = filled); flip mirrors it
function stitch(x, rows, cx, cy, px, col, flip = false) {
  const W = rows[0].length, Hh = rows.length; x.fillStyle = col;
  rows.forEach((r, j) => [...r].forEach((b, i) => { if (b !== "x") return; const ii = flip ? W - 1 - i : i;
    x.fillRect(Math.round(cx + (ii - W / 2) * px), Math.round(cy + (j - Hh / 2) * px), px - 1, px - 1); }));
}
function snowflake(x, cx, cy, r, col, lw = 3) {
  x.save(); x.strokeStyle = col; x.lineWidth = lw; x.lineCap = "round";
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, c = Math.cos(a), s = Math.sin(a);
    x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + c * r, cy + s * r); x.stroke();
    const m = r * .55, b = r * .28;
    [-1, 1].forEach(d => { const a2 = a + d * .7; x.beginPath(); x.moveTo(cx + c * m, cy + s * m); x.lineTo(cx + c * m + Math.cos(a2) * b, cy + s * m + Math.sin(a2) * b); x.stroke(); }); }
  x.restore();
}
function sparkle(x, cx, cy, r, col) {
  x.fillStyle = col; x.beginPath(); x.moveTo(cx, cy - r); x.quadraticCurveTo(cx, cy, cx + r, cy); x.quadraticCurveTo(cx, cy, cx, cy + r);
  x.quadraticCurveTo(cx, cy, cx - r, cy); x.quadraticCurveTo(cx, cy, cx, cy - r); x.fill();
}
function glitter(x, w, h, seed, n, cols, H, y0 = 0, y1 = h) {
  const R = H.rng(seed);
  for (let i = 0; i < n; i++) { const cx = R() * w, cy = y0 + R() * (y1 - y0), r = 2 + R() * 7;
    if (R() < .35) sparkle(x, cx, cy, r * 1.4, cols[i % cols.length]); else { x.globalAlpha = .5 + R() * .5; fillC(x, cols[i % cols.length], cx, cy, r * .35); x.globalAlpha = 1; } }
}
function buttons(x, cx, y0, y1, n, col, r = 7) { for (let i = 0; i < n; i++) { const y = y0 + (y1 - y0) * i / Math.max(1, n - 1); fillC(x, col, cx, y, r); fillC(x, "rgba(255,255,255,.35)", cx - r * .3, y - r * .3, r * .35); } }
function zipper(x, cx, y0, y1, col = "#c9ced8") {
  x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(cx - 5, y0, 10, y1 - y0); x.fillStyle = col;
  for (let y = y0; y < y1; y += 6) x.fillRect(cx - 4 + ((y / 6) % 2 ? 4 : 0), y, 4, 3);
  x.beginPath(); x.roundRect(cx - 7, y0 + 2, 14, 24, 4); x.fill(); x.fillStyle = "rgba(0,0,0,.3)"; x.fillRect(cx - 2, y0 + 10, 4, 12);
}
function stitchLine(x, pts, col = "rgba(255,210,120,.9)", lw = 2.5) {
  x.save(); x.strokeStyle = col; x.lineWidth = lw; x.setLineDash([7, 6]); x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); x.restore();
}
function denim(x, w, h, base, H, seed = 3) {
  x.fillStyle = base; x.fillRect(0, 0, w, h); const R = H.rng(seed);
  x.globalAlpha = .08; for (let i = 0; i < w + h; i += 4) { x.strokeStyle = i % 8 ? "#ffffff" : "#000000"; x.lineWidth = 1.5; x.beginPath(); x.moveTo(i, 0); x.lineTo(i - h, h); x.stroke(); }
  x.globalAlpha = 1; for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,255,255,${.03 + R() * .05})`; ell(x, R() * w, R() * h, 20 + R() * 40, 4 + R() * 8); x.fill(); }
}
function hibiscus(x, cx, cy, r, col, mid = "#ffe14d", rot = 0) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.fillStyle = col;
  for (let k = 0; k < 5; k++) { x.save(); x.rotate(k / 5 * TAU); x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(-r * .65, -r * .35, -r * .55, -r * 1.05, 0, -r); x.bezierCurveTo(r * .55, -r * 1.05, r * .65, -r * .35, 0, 0); x.fill(); x.restore(); }
  x.fillStyle = "rgba(0,0,0,.12)"; for (let k = 0; k < 5; k++) { x.save(); x.rotate(k / 5 * TAU); x.fillRect(-1, -r * .8, 2, r * .7); x.restore(); }
  fillC(x, mid, 0, 0, r * .18); x.strokeStyle = mid; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 0); x.lineTo(r * .5, -r * .45); x.stroke(); fillC(x, mid, r * .5, -r * .45, 3.5);
  x.restore();
}
function leaf(x, cx, cy, L, a, col) {
  x.save(); x.translate(cx, cy); x.rotate(a); x.fillStyle = col; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(L * .5, -L * .32, L, 0); x.quadraticCurveTo(L * .5, L * .32, 0, 0); x.fill();
  x.strokeStyle = "rgba(0,0,0,.2)"; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(L * .9, 0); x.stroke(); x.restore();
}
function cloud(x, cx, cy, k, col = "#ffffff") {
  x.fillStyle = col; [[-34, 6, 22], [-12, -8, 26], [14, -12, 24], [34, 4, 20], [0, 10, 24]].forEach(([a, b, r]) => { circ(x, cx + a * k, cy + b * k, r * k); x.fill(); });
}
function bolt(x, cx, cy, k, col, glow) {
  x.save(); x.translate(cx, cy); x.scale(k, k); if (glow) { x.shadowColor = glow; x.shadowBlur = 18; }
  x.fillStyle = col; x.beginPath(); x.moveTo(8, -46); x.lineTo(-24, 6); x.lineTo(-2, 6); x.lineTo(-12, 46); x.lineTo(26, -10); x.lineTo(4, -10); x.lineTo(14, -46); x.closePath(); x.fill(); x.restore();
}
function star(x, H, cx, cy, r) { H.starPath(x, cx, cy, r, r * .45); x.fill(); }

/* ======================= cartoon prints (centred on cx, cy; about 110 px tall at k = 1) ======================= */
function drawCat(x, cx, cy, k, col = "#ff9a3c", col2 = "#ffd9a8") {
  x.save(); x.translate(cx, cy); x.scale(k, k);
  [-1, 1].forEach(s => { x.fillStyle = col; x.beginPath(); x.moveTo(s * 44, -16); x.lineTo(s * 40, -62); x.lineTo(s * 10, -40); x.closePath(); x.fill(); outline(x, 5);
    x.fillStyle = "#ffb3c8"; x.beginPath(); x.moveTo(s * 36, -24); x.lineTo(s * 36, -50); x.lineTo(s * 18, -38); x.closePath(); x.fill(); });
  fillE(x, col, 0, 0, 56, 46); outline(x, 5);
  x.fillStyle = "rgba(160,60,0,.35)"; [-14, 0, 14].forEach(d => { x.fillRect(d - 3, -44, 6, 14); });
  fillE(x, col2, 0, 18, 26, 18);
  [-1, 1].forEach(s => { fillE(x, INK, s * 22, -4, 7, 10); fillC(x, "#ffffff", s * 22 - 2, -8, 3); fillE(x, "rgba(255,110,140,.45)", s * 34, 14, 9, 5); });
  x.fillStyle = "#ff6b8a"; x.beginPath(); x.moveTo(-6, 10); x.lineTo(6, 10); x.lineTo(0, 17); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(0, 17); x.quadraticCurveTo(-6, 26, -12, 20); x.moveTo(0, 17); x.quadraticCurveTo(6, 26, 12, 20); outline(x, 3);
  x.beginPath(); [-1, 1].forEach(s => { x.moveTo(s * 30, 14); x.lineTo(s * 62, 8); x.moveTo(s * 30, 20); x.lineTo(s * 62, 24); }); outline(x, 2.5);
  x.restore();
}
function drawPuppy(x, cx, cy, k, col = "#e6b27a", ear = "#8a5a3c") {
  x.save(); x.translate(cx, cy); x.scale(k, k);
  fillE(x, col, 0, 0, 50, 46); outline(x, 5);
  fillE(x, "#ffffff", 16, -8, 18, 20, .3);
  [-1, 1].forEach(s => { x.fillStyle = ear; x.beginPath(); x.ellipse(s * 50, 4, 16, 34, s * -.35, 0, TAU); x.fill(); outline(x, 5); });
  fillE(x, "#fff2df", 0, 20, 28, 20);
  [-1, 1].forEach(s => { fillE(x, INK, s * 19, -6, 7, 9); fillC(x, "#ffffff", s * 19 - 2, -9, 3); });
  fillE(x, INK, 0, 10, 11, 8); fillC(x, "rgba(255,255,255,.6)", -3, 7, 3);
  x.beginPath(); x.moveTo(0, 18); x.quadraticCurveTo(-8, 28, -14, 22); x.moveTo(0, 18); x.quadraticCurveTo(8, 28, 14, 22); outline(x, 3);
  x.fillStyle = "#ff6b8a"; x.beginPath(); x.ellipse(0, 31, 7, 9, 0, 0, Math.PI); x.fill(); outline(x, 2.5);
  x.restore();
}
function drawDino(x, cx, cy, k, col = "#4fc35a", belly = "#c9f27a") {
  x.save(); x.translate(cx, cy); x.scale(k, k);
  x.fillStyle = "#ff8a3c"; for (let i = 0; i < 6; i++) { const a = -2.6 + i * .32, px = Math.cos(a) * 46 - 6, py = Math.sin(a) * 36 + 6; x.beginPath(); x.moveTo(px - 8, py + 4); x.lineTo(px + Math.cos(a) * 16, py + Math.sin(a) * 16); x.lineTo(px + 8, py + 4); x.closePath(); x.fill(); outline(x, 3); }
  x.fillStyle = col; x.beginPath(); x.moveTo(-40, 14); x.quadraticCurveTo(-80, 20, -86, -4); x.quadraticCurveTo(-64, 24, -30, 30); x.closePath(); x.fill(); outline(x, 4);   // tail
  fillE(x, col, -6, 10, 46, 32); outline(x, 5);
  fillE(x, belly, 0, 20, 26, 16);
  x.fillStyle = col; [[-26, 38], [12, 38]].forEach(([a, b]) => { x.beginPath(); x.roundRect(a, b - 6, 18, 20, 7); x.fill(); outline(x, 4); });
  fillE(x, col, 40, -22, 32, 24, -.2); outline(x, 5);    // head
  fillC(x, INK, 46, -30, 6); fillC(x, "#fff", 44, -32, 2.2);
  x.beginPath(); x.moveTo(36, -12); x.quadraticCurveTo(54, -4, 68, -16); outline(x, 3.5);
  fillE(x, "rgba(255,110,140,.45)", 58, -18, 6, 4);
  x.restore();
}
function drawAvocado(x, cx, cy, k) {
  x.save(); x.translate(cx, cy); x.scale(k, k);
  const pear = (s, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, -58 * s); x.bezierCurveTo(30 * s, -58 * s, 30 * s, -20 * s, 44 * s, 10 * s); x.bezierCurveTo(56 * s, 44 * s, 30 * s, 62 * s, 0, 62 * s);
    x.bezierCurveTo(-30 * s, 62 * s, -56 * s, 44 * s, -44 * s, 10 * s); x.bezierCurveTo(-30 * s, -20 * s, -30 * s, -58 * s, 0, -58 * s); x.fill(); };
  pear(1, "#3f7d2a"); outline(x, 5); pear(.86, "#d7ef8a"); pear(.7, "#eaf7b8");
  fillC(x, "#a0652e", 0, 20, 24); outline(x, 4); fillC(x, "rgba(255,255,255,.35)", -8, 12, 6);
  [-1, 1].forEach(s => fillC(x, INK, s * 9, 18, 3.5)); x.beginPath(); x.arc(0, 23, 6, .2, Math.PI - .2); outline(x, 2.5);
  [-1, 1].forEach(s => fillE(x, "rgba(255,110,140,.55)", s * 16, 26, 5, 3));
  x.restore();
}
function drawPizza(x, cx, cy, k) {
  x.save(); x.translate(cx, cy); x.scale(k, k);
  x.fillStyle = "#ffcf4d"; x.beginPath(); x.moveTo(-54, -44); x.quadraticCurveTo(0, -60, 54, -44); x.lineTo(0, 60); x.closePath(); x.fill(); outline(x, 5);
  x.fillStyle = "#e0a050"; x.beginPath(); x.moveTo(-58, -44); x.quadraticCurveTo(0, -64, 58, -44); x.quadraticCurveTo(60, -30, 50, -30); x.quadraticCurveTo(0, -46, -50, -30); x.quadraticCurveTo(-60, -30, -58, -44); x.fill(); outline(x, 4);
  [[-22, -14, 11], [20, -10, 10], [0, 16, 9], [-6, -28, 7]].forEach(([a, b, r]) => { fillC(x, "#e8423b", a, b, r); outline(x, 3); fillC(x, "rgba(255,255,255,.35)", a - r * .3, b - r * .3, r * .3); });
  [[8, -24], [-10, 30], [26, 4]].forEach(([a, b]) => { leaf(x, a, b, 12, .6, "#4fa83a"); });
  x.restore();
}
function drawRainbow(x, cx, cy, k) {
  x.save(); x.translate(cx, cy); x.scale(k, k);
  ["#ff4f5f", "#ff9a1f", "#ffe14d", "#4fd36b", "#3fb8ff", "#9a5cff"].forEach((c, i) => { x.strokeStyle = c; x.lineWidth = 11; x.beginPath(); x.arc(0, 30, 74 - i * 11, Math.PI, 0); x.stroke(); });
  cloud(x, -64, 32, .62); cloud(x, 64, 32, .62);
  x.restore();
}
function drawSun(x, cx, cy, k) {
  x.save(); x.translate(cx, cy); x.scale(k, k);
  x.fillStyle = "#ffb21f"; for (let i = 0; i < 12; i++) { x.save(); x.rotate(i / 12 * TAU); x.beginPath(); x.moveTo(-6, -36); x.lineTo(0, -54); x.lineTo(6, -36); x.closePath(); x.fill(); x.restore(); }
  fillC(x, "#ffd23a", 0, 0, 32); fillC(x, "rgba(255,255,255,.35)", -10, -10, 9);
  x.restore();
}
function waveBand(x, w, y, amp, len, col) {
  x.fillStyle = col; x.beginPath(); x.moveTo(0, y + 200);
  for (let u = 0; u <= w; u += 4) x.lineTo(u, y + Math.sin(u / len * TAU) * amp);
  x.lineTo(w, y + 200); x.closePath(); x.fill();
}
function bubble(x, cx, cy, r) {
  const g = x.createRadialGradient(cx, cy, r * .6, cx, cy, r); g.addColorStop(0, "rgba(255,255,255,.12)"); g.addColorStop(.75, "rgba(220,240,255,.45)"); g.addColorStop(1, "rgba(255,255,255,1)");
  x.fillStyle = g; circ(x, cx, cy, r); x.fill();
  x.strokeStyle = "rgba(255,90,200,.85)"; x.lineWidth = Math.max(2, r * .1); x.beginPath(); x.arc(cx, cy, r * .9, .3, 1.6); x.stroke();
  x.strokeStyle = "rgba(60,220,200,.85)"; x.beginPath(); x.arc(cx, cy, r * .9, 3.4, 4.4); x.stroke();
  fillE(x, "rgba(255,255,255,.95)", cx - r * .38, cy - r * .4, r * .2, r * .12, -.7);
}
function pineappleIcon(x, cx, cy, k, rot) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(k, k);
  x.fillStyle = "#3fa84a"; [-.5, 0, .5].forEach(a => { x.save(); x.rotate(a); x.beginPath(); x.moveTo(-5, -18); x.quadraticCurveTo(0, -46, 5, -18); x.fill(); x.restore(); });
  fillE(x, "#ffcf3a", 0, 4, 18, 24); x.strokeStyle = "#d99a1a"; x.lineWidth = 2;
  x.save(); ell(x, 0, 4, 18, 24); x.clip(); for (let k2 = -3; k2 <= 3; k2++) { x.beginPath(); x.moveTo(-20, k2 * 10 - 12); x.lineTo(20, k2 * 10 + 12); x.moveTo(20, k2 * 10 - 12); x.lineTo(-20, k2 * 10 + 12); x.stroke(); } x.restore();
  x.restore();
}
function starField(x, w, h, H, col) {
  const R = H.rng(27); x.fillStyle = col;
  for (let i = 0; i < 46; i++) { const r = 6 + R() * 12; star(x, H, R() * w, 12 + R() * (h - 50), r); }
  [[w * .25 - 64, 150, 20], [w * .25 + 70, 186, 16], [w * .75, 150, 30]].forEach(([a, b, r]) => star(x, H, a, b, r));
}
function sleeveStars(x, w, h, H, col) { const R = H.rng(15); x.fillStyle = col; for (let i = 0; i < 9; i++) star(x, H, R() * w, 10 + R() * (h - 40), 5 + R() * 8); }
// the glowing parts of the glow-in-the-dark shirt (bg = the colour behind them: the shirt's or black for the glow map)
function glowArt(x, w, h, H, col, bg) {
  const R = H.rng(92); x.fillStyle = col;
  for (let i = 0; i < 26; i++) star(x, H, R() * w, 14 + R() * (h - 60), 5 + R() * 9);
  const cx = w * .25; fillC(x, col, cx, 168, 40); fillC(x, bg, cx + 20, 156, 34);
  x.fillStyle = col; star(x, H, cx + 36, 190, 12);
  x.save(); x.translate(w * .75, 150); x.strokeStyle = col; x.lineWidth = 5; x.beginPath(); x.ellipse(0, 0, 60, 16, -.3, 0, TAU); x.stroke(); fillC(x, col, 0, 0, 30); x.restore();
}
function glowPantsArt(x, w, h, H, col) { const R = H.rng(78); x.fillStyle = col; for (let i = 0; i < 26; i++) star(x, H, R() * w, 44 + R() * (h - 50), 6 + R() * 8); x.strokeStyle = col; x.lineWidth = 6; [0, w * .5, w].forEach(u => { x.beginPath(); x.moveTo(u, 30); x.lineTo(u, h); x.stroke(); }); }

/* ======================= shirt prints ======================= */
const SP = {};
// football (soccer) shirt: V neck, side panels, number front (small) and back (big)
SP.soccer = (x, w, h, p) => {
  const a = p.acc; x.fillStyle = a; sides(w).forEach(u => x.fillRect(u - 14, 0, 28, h));
  x.fillStyle = "rgba(0,0,0,.18)"; sides(w).forEach(u => x.fillRect(u - 4, 0, 8, h));
  const cx = w * .25; x.fillStyle = a; x.beginPath(); x.moveTo(cx - 46, 70); x.lineTo(cx, 128); x.lineTo(cx + 46, 70); x.lineTo(cx + 30, 70); x.lineTo(cx, 108); x.lineTo(cx - 30, 70); x.closePath(); x.fill();
  bigNum(x, p.num, cx, 172, 70, a, "rgba(0,0,0,.25)");
  bigNum(x, p.num, w * .75, 170, 110, a, "rgba(0,0,0,.25)");
};
// basketball tank: thick trim round the neck and arm holes, big number
SP.bball = (x, w, h, p) => {
  const a = p.acc, n = p.acc2 || "#ffffff"; x.strokeStyle = a; x.lineWidth = 16;
  [w * .25, w * .75].forEach((cx, k) => { x.beginPath(); x.moveTo(cx - 90, 60); x.quadraticCurveTo(cx, k ? 120 : 150, cx + 90, 60); x.stroke(); });
  x.fillStyle = a; sides(w).forEach(u => { ell(x, u, 70, 60, 70); x.fill(); });
  x.fillStyle = p.fill; sides(w).forEach(u => { ell(x, u, 62, 46, 58); x.fill(); });
  x.fillStyle = n; sides(w).forEach(u => x.fillRect(u - 5, 120, 10, h));
  bigNum(x, p.num, w * .25, 178, 92, n, a);
  bigNum(x, p.num, w * .75, 172, 104, n, a);
};
SP.hawaii = (x, w, h, p, H) => {
  const R = H.rng(12);
  for (let i = 0; i < 46; i++) leaf(x, R() * w, R() * h, 34 + R() * 26, R() * TAU, i % 2 ? "#2f9d55" : "#47b86a");
  for (let i = 0; i < 26; i++) hibiscus(x, R() * w, 10 + R() * (h - 20), 20 + R() * 12, i % 3 === 2 ? "#ffffff" : p.acc, "#ffe14d", R() * TAU);
  hibiscus(x, w * .25 + 60, 160, 30, p.acc, "#ffe14d", .4);
  x.fillStyle = "rgba(0,0,0,.12)"; x.fillRect(w * .25 - 2, 0, 4, h); buttons(x, w * .25 + 10, 120, 210, 3, "#fff6dd", 6);
};
SP.denimjacket = (x, w, h, p, H) => {
  denim(x, w, h, p.fill, H, 5);
  const cx = w * .25;
  stitchLine(x, [[0, 96], [w, 96]]); stitchLine(x, [[cx - 8, 0], [cx - 8, h]]); stitchLine(x, [[cx + 8, 0], [cx + 8, h]]);
  [-1, 1].forEach(s => { const px = cx + s * 70; x.fillStyle = "rgba(0,0,0,.14)"; x.beginPath(); x.roundRect(px - 34, 120, 68, 50, 8); x.fill();
    stitchLine(x, [[px - 32, 122], [px - 32, 168], [px + 32, 168], [px + 32, 122]]);
    x.fillStyle = "rgba(255,255,255,.08)"; x.beginPath(); x.moveTo(px - 36, 118); x.lineTo(px + 36, 118); x.lineTo(px + 36, 138); x.lineTo(px, 148); x.lineTo(px - 36, 138); x.closePath(); x.fill();
    stitchLine(x, [[px - 34, 138], [px, 148], [px + 34, 138]]); fillC(x, "#c99a3a", px, 140, 5);
    stitchLine(x, [[cx + s * 140, 96], [cx + s * 140, h]]); });
  buttons(x, cx, 118, 214, 4, "#c99a3a", 6);
  const bx = w * .75; stitchLine(x, [[bx - 150, 150], [bx + 150, 150]]); stitchLine(x, [[bx - 90, 96], [bx - 90, 150]]); stitchLine(x, [[bx + 90, 96], [bx + 90, 150]]);
};
// quilted winter coat (the fur is 3D)
SP.wintercoat = (x, w, h, p) => {
  for (let y = 0; y < h; y += 34) { const g = x.createLinearGradient(0, y, 0, y + 34); g.addColorStop(0, "rgba(255,255,255,.18)"); g.addColorStop(.5, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(0,0,0,.22)"); x.fillStyle = g; x.fillRect(0, y, w, 34); }
  zipper(x, w * .25, 90, h - 26);
  [-1, 1].forEach(s => { x.fillStyle = "rgba(0,0,0,.18)"; x.beginPath(); x.roundRect(w * .25 + s * 90 - 30, 176, 60, 8, 4); x.fill(); });
};
SP.leather = (x, w, h, p, H) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#3a3a46"); g.addColorStop(1, p.fill); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const R = H.rng(4); for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${.03 + R() * .05})`; ell(x, R() * w, R() * h, 30 + R() * 50, 4 + R() * 6, R()); x.fill(); }
  const cx = w * .25;
  x.fillStyle = "#f2f2f2"; x.beginPath(); x.moveTo(cx - 44, 60); x.lineTo(cx + 30, 60); x.lineTo(cx - 24, h); x.lineTo(cx - 60, h); x.closePath(); x.fill();   // the white tee peeking out
  x.save(); x.translate(cx + 22, 96); x.rotate(.36); zipper(x, 0, 0, 150, "#dfe3ea"); x.restore();
  [-1, 1].forEach(s => { x.save(); x.translate(cx + s * 86 + 10, 178); x.rotate(-s * .25); x.fillStyle = "#cfd4dc"; x.fillRect(-24, -2, 48, 4); x.restore(); });
  x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(0, h - 44, w, 6); [cx - 120, cx + 120].forEach(u => fillC(x, "#dfe3ea", u, h - 40, 6));
};
const REINDEER = ["x.x.............", ".xx.x...........", "..xx............", ".xxxx...........", "xxxxx...........", "...xxxxxxxxxxx..", "...xxxxxxxxxxxxx", "...xxxxxxxxxxx..", "....x.x....x.x..", "....x.x....x.x.."];
SP.reindeer = (x, w, h, p) => {
  knit(x, w, h); const a = p.acc || "#ffffff";
  x.fillStyle = a; [100, 216].forEach(y => { for (let u = 0; u < w; u += 16) { x.fillRect(u, y, 8, 8); x.fillRect(u + 8, y - 8, 8, 8); } });
  [w * .25, w * .75].forEach(cx => { stitch(x, REINDEER, cx - 62, 160, 7, "#7a4a2c", true); stitch(x, REINDEER, cx + 62, 160, 7, "#7a4a2c", false);
    fillC(x, "#ff3b3b", cx - 62 + 7 * 7.5, 160 - 7 * 1.5, 4); fillC(x, "#ff3b3b", cx + 62 - 7 * 7.5, 160 - 7 * 1.5, 4); snowflake(x, cx, 152, 16, a, 4); });
  for (let u = 40; u < w; u += 128) if (Math.abs(u - w * .25) > 140 && Math.abs(u - w * .75) > 140) snowflake(x, u, 160, 12, a, 3);
  knit(x, w, h, "rgba(0,0,0,.08)", "rgba(255,255,255,.06)");
};
SP.pinetree = (x, w, h, p, H) => {
  knit(x, w, h); const R = H.rng(8);
  x.fillStyle = "#ffffff"; for (let i = 0; i < 70; i++) { circ(x, R() * w, R() * (h - 30), 2 + R() * 3); x.fill(); }
  x.fillStyle = p.acc || "#c8253a"; for (let u = 0; u < w; u += 16) { x.fillRect(u, 92, 8, 8); x.fillRect(u + 8, 100, 8, 8); }
  [[w * .25, 1], [w * .75, 1.1]].forEach(([cx, k]) => {
    x.save(); x.translate(cx, 166); x.scale(k, k);
    x.fillStyle = "#6b3f1f"; x.fillRect(-9, 40, 18, 14);
    [[-56, 44, -10], [-46, 18, -34], [-34, -6, -56]].forEach(([hw, y0, y1], i) => { x.fillStyle = i % 2 ? "#3fa84a" : "#2f8f3c"; x.beginPath(); x.moveTo(hw, y0); x.lineTo(0, y1); x.lineTo(-hw, y0); x.closePath(); x.fill(); x.strokeStyle = "#ffffff"; x.lineWidth = 2.5; x.stroke(); });
    [[-26, 30, "#ff3b3b"], [22, 34, "#ffd23a"], [-10, 10, "#3fb8ff"], [16, 0, "#ff5fb4"], [-4, -24, "#ffd23a"], [30, 20, "#ffffff"]].forEach(([a, b, c]) => fillC(x, c, a, b, 5));
    x.fillStyle = "#ffd23a"; star(x, H, 0, -62, 14); x.restore(); });
  knit(x, w, h, "rgba(0,0,0,.07)", "rgba(255,255,255,.05)");
};
// sporty tank with two stripes down each side
SP.sporttank = (x, w, h, p, H) => {
  x.fillStyle = p.acc; sides(w).forEach(u => { x.fillRect(u - 26, 0, 12, h); x.fillRect(u + 14, 0, 12, h); });
  x.strokeStyle = p.acc; x.lineWidth = 10; [w * .25, w * .75].forEach((cx, k) => { x.beginPath(); x.moveTo(cx - 80, 50); x.quadraticCurveTo(cx, k ? 110 : 140, cx + 80, 50); x.stroke(); });
  x.fillStyle = p.acc; sides(w).forEach(u => { ell(x, u, 60, 58, 64); x.fill(); }); x.fillStyle = p.fill; sides(w).forEach(u => { ell(x, u, 54, 48, 56); x.fill(); });
  x.fillStyle = p.acc; star(x, H, w * .25, 170, 18);
};
SP.polo = (x, w, h, p) => {
  const cx = w * .25; x.fillStyle = "rgba(0,0,0,.08)"; x.fillRect(cx - 14, 60, 28, 92); x.strokeStyle = "rgba(0,0,0,.18)"; x.lineWidth = 2; x.strokeRect(cx - 14, 60, 28, 92);
  buttons(x, cx, 118, 142, 2, p.btn || "#f6f6f6", 5.5);
  x.fillStyle = p.acc; x.beginPath(); x.ellipse(cx + 82, 150, 12, 7, 0, 0, TAU); x.fill();    // a tiny embroidered fish (not a logo)
  x.beginPath(); x.moveTo(cx + 72, 150); x.lineTo(cx + 62, 143); x.lineTo(cx + 62, 157); x.closePath(); x.fill();
};
SP.buttonup = (x, w, h, p) => {
  const cx = w * .25; x.strokeStyle = "rgba(0,0,0,.18)"; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 12, 0); x.lineTo(cx - 12, h); x.moveTo(cx + 12, 0); x.lineTo(cx + 12, h); x.stroke();
  buttons(x, cx, 112, 218, 5, p.btn || "#ffffff", 5);
  x.strokeStyle = "rgba(0,0,0,.15)"; x.beginPath(); x.roundRect(cx - 108, 130, 50, 46, 4); x.stroke();     // chest pocket
  x.strokeStyle = "rgba(0,0,0,.12)"; x.beginPath(); x.moveTo(w * .75 - 120, 70); x.quadraticCurveTo(w * .75, 90, w * .75 + 120, 70); x.stroke();
};
SP.shirttie = SP.buttonup;
// circus: big stripes and pompom buttons (the ruff and the puffed sleeves are 3D)
SP.circus = (x, w, h, p) => {
  x.fillStyle = p.acc; for (let u = 0; u < w; u += 64) x.fillRect(u, 0, 32, h);
  [w * .25, w * .75].forEach(cx => buttons(x, cx, 124, 210, 3, "#3fb8ff", 11));
};
SP.cat = (x, w, h, p, H) => {
  const R = H.rng(2); x.fillStyle = "rgba(255,255,255,.55)"; for (let i = 0; i < 30; i++) { const u = R() * w, v = 20 + R() * (h - 60); [[0, 0, 5], [-6, -7, 2.5], [0, -9, 2.5], [6, -7, 2.5]].forEach(([a, b, r]) => { circ(x, u + a, v + b, r); x.fill(); }); }
  drawCat(x, w * .25, 172, .9, p.acc || "#ff9a3c");
  word(x, "MEOW", w * .75, 172, 56, "rgba(255,255,255,.8)");
};
SP.puppy = (x, w, h, p, H) => {
  const R = H.rng(6); for (let i = 0; i < 26; i++) { x.save(); x.translate(R() * w, 20 + R() * (h - 60)); x.rotate(R() * TAU); x.fillStyle = "rgba(255,255,255,.6)"; x.beginPath(); x.roundRect(-10, -3, 20, 6, 3); x.fill(); [[-10, -4], [-10, 4], [10, -4], [10, 4]].forEach(([a, b]) => { circ(x, a, b, 4); x.fill(); }); x.restore(); }
  drawPuppy(x, w * .25, 170, .95);
  word(x, "WOOF!", w * .75, 172, 56, "rgba(255,255,255,.85)");
};
SP.dino = (x, w, h, p, H) => {
  const R = H.rng(9); for (let i = 0; i < 18; i++) { x.fillStyle = "rgba(60,120,40,.25)"; const u = R() * w, v = 20 + R() * (h - 60); ell(x, u, v, 10, 7, R()); x.fill(); [-1, 0, 1].forEach(d => { circ(x, u + d * 7, v - 10, 3); x.fill(); }); }
  drawDino(x, w * .25 - 4, 168, .95);
  drawDino(x, w * .75, 172, .7);
};
SP.avocado = (x, w, h, p, H) => {
  const R = H.rng(14); for (let i = 0; i < 30; i++) { const u = R() * w, v = 20 + R() * (h - 60); fillE(x, "rgba(120,180,60,.25)", u, v, 8, 11); fillC(x, "rgba(160,100,46,.3)", u, v + 3, 4); }
  drawAvocado(x, w * .25, 166, .88);
  word(x, "AVO-CUTE", w * .75, 172, 46, "#6aa84f");
};
SP.pizza = (x, w, h, p) => {
  x.fillStyle = "rgba(216,51,58,.18)"; for (let j = 0; j < h; j += 32) for (let u = (j / 32) % 2 ? 0 : 32; u < w; u += 64) x.fillRect(u, j, 32, 32);
  drawPizza(x, w * .25, 166, .9);
  drawPizza(x, w * .75, 170, .75);
};
SP.rainbowtee = (x, w, h, p, H) => {
  const R = H.rng(21); for (let i = 0; i < 14; i++) cloud(x, R() * w, 20 + R() * 120, .35 + R() * .2, "rgba(255,255,255,.75)");
  drawRainbow(x, w * .25, 168, .95); drawRainbow(x, w * .75, 168, .8);
};
SP.waves = (x, w, h, p) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#ffe9b8"); g.addColorStop(1, p.fill); x.fillStyle = g; x.fillRect(0, 0, w, h);
  drawSun(x, w * .25 + 40, 140, .62); drawSun(x, w * .75, 140, .62);
  waveBand(x, w, 178, 7, 64, "#7fd3f5"); waveBand(x, w, 194, 7, 64, "#3fb0e8"); waveBand(x, w, 210, 7, 64, "#1f8fd0");
  x.strokeStyle = "rgba(255,255,255,.8)"; x.lineWidth = 3; x.beginPath(); for (let u = 0; u <= w; u += 4) x.lineTo(u, 178 + Math.sin(u / 64 * TAU) * 7); x.stroke();
};
const PAD = ["..xxxxxxxxxxxxxx..", ".xxxxxxxxxxxxxxxx.", "xxxwxxxxxxxxxxyxxx", "xxwwwxxxxxxxxrxbxx", "xxxwxxxkkxkkxxgxxx", "xxxxxxxxxxxxxxxxxx", "xxxxxx......xxxxxx", ".xxxx........xxxx."];
const PADC = { x: "#9b5cff", w: "#ffffff", y: "#ffd23a", r: "#ff3b5c", b: "#1fb6ff", g: "#2fd36b", k: "#3a2a6a" };
function pix(x, rows, cx, cy, px, map) { const W = rows[0].length, Hh = rows.length; rows.forEach((r, j) => [...r].forEach((b, i) => { if (!map[b]) return; x.fillStyle = map[b]; x.fillRect(Math.round(cx + (i - W / 2) * px), Math.round(cy + (j - Hh / 2) * px), px - 1, px - 1); })); }
const PHEART = [".xx.xx.", "xxxxxxx", "xxxxxxx", ".xxxxx.", "..xxx..", "...x..."];
SP.pixelgame = (x, w, h, p, H) => {
  const R = H.rng(31), cols = ["#2fd36b", "#1fb6ff", "#ffd23a", "#ff5fb4"];
  for (let i = 0; i < 40; i++) { x.fillStyle = cols[i % 4]; x.globalAlpha = .55; x.fillRect(Math.round(R() * w / 8) * 8, Math.round(R() * (h - 40) / 8) * 8, 8, 8); } x.globalAlpha = 1;
  [w * .25, w * .75].forEach(cx => { pix(x, PAD, cx, 182, 8, PADC); [-1, 0, 1].forEach(d => stitch(x, PHEART, cx + d * 40, 128, 5, "#ff3b5c")); });
};
SP.cow = (x, w, h, p, H) => {
  const R = H.rng(44); x.fillStyle = p.acc || "#1d1d24";
  for (let i = 0; i < 26; i++) { const cx = R() * w, cy = R() * (h - 20), r = 18 + R() * 22; if (Math.abs(cx - w * .25) < 60 && cy > 160) continue; x.beginPath();
    for (let a = 0; a <= TAU + .01; a += .3) { const rr = r * (1 + .25 * Math.sin(a * 3 + i) + .12 * Math.sin(a * 5 + i * 2)); x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * .8); } x.fill(); }
  fillE(x, "#ffb3c1", w * .25, 196, 34, 18); fillE(x, "#e07a93", w * .25 - 12, 196, 5, 7); fillE(x, "#e07a93", w * .25 + 12, 196, 5, 7);   // a little cow nose
};
SP.citynight = (x, w, h, p, H) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#101a3a"); g.addColorStop(1, p.fill); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const R = H.rng(51); x.fillStyle = "#ffffff"; for (let i = 0; i < 90; i++) { x.globalAlpha = .4 + R() * .6; circ(x, R() * w, R() * 150, .8 + R() * 1.6); x.fill(); } x.globalAlpha = 1;
  fillC(x, "#fff3b0", w * .25 + 70, 124, 16); fillC(x, "#101a3a", w * .25 + 78, 118, 14);
  for (let u = -10; u < w;) { const bw = 26 + R() * 40, top = 128 + R() * 70; x.fillStyle = ["#2a3a72", "#33468a", "#24305e"][Math.floor(R() * 3)]; x.fillRect(u, top, bw, h - top);
    if (R() < .3) { x.fillRect(u + bw / 2 - 2, top - 14, 4, 14); fillC(x, "#ff4f5f", u + bw / 2, top - 15, 2.5); }
    for (let yy = top + 8; yy < h - 34; yy += 12) for (let xx = u + 5; xx < u + bw - 8; xx += 10) if (R() < .55) { x.fillStyle = R() < .8 ? "#ffd84a" : "#9fe8ff"; x.fillRect(xx, yy, 5, 6); }
    u += bw + 2; }
};
SP.abstractdye = (x, w, h, p, H) => {
  const R = H.rng(63), cols = p.cols || ["#ff7ad9", "#7fd8ff", "#ffe066", "#a98bff", "#7ff0b0"];
  x.fillStyle = "#fbf3ff"; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { const cx = R() * w, cy = R() * h, r = 30 + R() * 70, g = x.createRadialGradient(cx, cy, 0, cx, cy, r), c = cols[i % cols.length];
    g.addColorStop(0, c); g.addColorStop(.6, c + "aa"); g.addColorStop(1, c + "00"); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); }
  x.globalAlpha = .45; x.lineCap = "round"; for (let i = 0; i < 26; i++) { x.strokeStyle = cols[(i + 2) % cols.length]; x.lineWidth = 6 + R() * 10; x.beginPath(); const u = R() * w, v = R() * h; x.moveTo(u, v);
    x.bezierCurveTo(u + 180 * (R() - .5), v + 60 * (R() - .5), u + 240 * (R() - .5), v + 80 * (R() - .5), u + 240 * (R() - .5), v + 40 * (R() - .5)); x.stroke(); } x.globalAlpha = 1;
};
SP.bubbles = (x, w, h, p, H) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#7fd0ff"); g.addColorStop(1, p.fill); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const R = H.rng(71); for (let i = 0; i < 40; i++) bubble(x, R() * w, 10 + R() * (h - 50), 6 + R() * 22);
  bubble(x, w * .25 - 20, 172, 40); bubble(x, w * .25 + 40, 140, 20); bubble(x, w * .25 + 44, 198, 14);
};
// a vest of clouds over a white tee
SP.cloudvest = (x, w, h, p, H) => {
  x.fillStyle = p.vest; x.fillRect(0, 0, w, h);
  const R = H.rng(81); for (let i = 0; i < 40; i++) cloud(x, R() * w, 20 + R() * (h - 50), .4 + R() * .35, "rgba(255,255,255,.92)");
  const cx = w * .25; x.fillStyle = p.fill; x.beginPath(); x.moveTo(cx - 50, 0); x.lineTo(cx + 50, 0); x.lineTo(cx + 12, h); x.lineTo(cx - 12, h); x.closePath(); x.fill();
  x.strokeStyle = "#ffffff"; x.lineWidth = 8; x.beginPath(); x.moveTo(cx - 50, 0); x.lineTo(cx - 12, h); x.moveTo(cx + 50, 0); x.lineTo(cx + 12, h); x.stroke();
  [-1, 1].forEach(sd => { x.save(); x.translate(cx + sd * 56, 196); x.fillStyle = "rgba(0,0,0,.12)"; x.beginPath(); x.roundRect(-24, -4, 48, 8, 4); x.fill(); x.restore(); });
  // the arm holes
  x.fillStyle = p.fill; sides(w).forEach(u => { ell(x, u, 40, 46, 70); x.fill(); }); x.strokeStyle = "#ffffff"; x.lineWidth = 8; sides(w).forEach(u => { ell(x, u, 40, 46, 70); x.stroke(); });
};
SP.raincoat = (x, w, h) => {
  const g = x.createLinearGradient(0, 0, w, 0); for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, i % 2 ? "rgba(255,255,255,.14)" : "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const cx = w * .25; x.fillStyle = "rgba(0,0,0,.12)"; x.fillRect(cx - 3, 0, 6, h);
  for (let y = 124; y < 220; y += 34) { x.fillStyle = "#3a2a1a"; x.fillRect(cx - 22, y - 2, 44, 4); x.fillStyle = "#e9e2d0"; x.beginPath(); x.roundRect(cx - 7, y - 10, 14, 20, 6); x.fill(); }
  [-1, 1].forEach(s => { x.fillStyle = "rgba(0,0,0,.12)"; x.beginPath(); x.roundRect(cx + s * 100 - 34, 180, 68, 12, 6); x.fill(); });
};
SP.labcoat = (x, w) => {
  const cx = w * .25; x.fillStyle = "rgba(0,0,0,.08)"; x.fillRect(cx - 2, 0, 4, 256); buttons(x, cx + 10, 150, 214, 3, "#dfe4ec", 6);
  x.strokeStyle = "rgba(0,0,0,.18)"; x.lineWidth = 2.5; x.beginPath(); x.roundRect(cx - 104, 140, 50, 52, 4); x.stroke();
  [["#1f6bff", -96], ["#ff3b3b", -86], ["#2fd36b", -76]].forEach(([c, u]) => { x.fillStyle = c; x.fillRect(cx + u, 126, 5, 22); fillC(x, c, cx + u + 2.5, 126, 3); });
  x.fillStyle = "#ffffff"; x.beginPath(); x.roundRect(cx + 54, 138, 54, 30, 5); x.fill(); x.strokeStyle = "#1f6bff"; x.lineWidth = 3; x.stroke();
  x.fillStyle = "#1f6bff"; x.fillRect(cx + 54, 138, 54, 9); x.fillStyle = "#9aa5b8"; x.fillRect(cx + 62, 154, 38, 4); x.fillRect(cx + 62, 160, 26, 4);
  x.save(); x.translate(cx + 80, 200); x.fillStyle = "#7fe0a0"; x.beginPath(); x.moveTo(-5, -16); x.lineTo(5, -16); x.lineTo(5, -6); x.lineTo(14, 10); x.lineTo(-14, 10); x.lineTo(-5, -6); x.closePath(); x.fill(); x.restore();   // a little flask
};
SP.chef = (x, w, h, p, H) => {
  const cx = w * .25; x.strokeStyle = "rgba(0,0,0,.12)"; x.lineWidth = 2.5; x.beginPath(); x.moveTo(cx + 60, 70); x.quadraticCurveTo(cx + 64, 170, cx + 56, h); x.stroke();
  glitter(x, w, h, 88, 160, ["#ffd23a", "#ff9ad5", "#9fe8ff", "#e0c0ff"], H, 0, h - 28);
  [-1, 1].forEach(s => buttons(x, cx + s * 34, 116, 212, 4, p.acc, 7));
};
SP.referee = (x, w, h) => {
  x.fillStyle = "#1d1d24"; for (let u = 0; u < w; u += 48) x.fillRect(u, 0, 24, h);
  const cx = w * .25; x.beginPath(); x.moveTo(cx - 40, 70); x.lineTo(cx, 120); x.lineTo(cx + 40, 70); x.closePath(); x.fill();
  x.fillStyle = "#ffffff"; x.beginPath(); x.roundRect(cx - 104, 134, 52, 46, 6); x.fill(); x.strokeStyle = "#1d1d24"; x.lineWidth = 3; x.stroke();
  x.fillStyle = "#ffd23a"; x.fillRect(cx - 98, 126, 14, 20); x.fillStyle = "#e8423b"; x.fillRect(cx - 80, 124, 14, 20);    // the yellow and red cards in the pocket
  x.fillStyle = "#ffffff"; x.fillRect(cx - 104, 134, 52, 14);
};
SP.kangaroo = (x, w, h, p, H) => {
  const cx = w * .25; x.strokeStyle = p.hem; x.lineWidth = 8; x.lineCap = "round"; [-22, 22].forEach(d => { x.beginPath(); x.moveTo(cx + d, 60); x.lineTo(cx + d * 1.1, 128); x.stroke(); fillC(x, p.hem, cx + d * 1.1, 132, 6); });
  x.fillStyle = "rgba(0,0,0,.1)"; for (let y = h - 70; y < h - 26; y += 6) x.fillRect(0, y, w, 2);
  x.fillStyle = "rgba(255,255,255,.85)"; star(x, H, w * .75, 140, 26);
};
SP.twotone = (x, w, h, p) => {
  x.fillStyle = p.sleeve; [w * .5, 0, w].forEach(u => { x.beginPath(); x.moveTo(u - 120, 0); x.lineTo(u + 120, 0); x.lineTo(u + 50, 110); x.lineTo(u - 50, 110); x.closePath(); x.fill(); });
  x.strokeStyle = p.sleeve; x.lineWidth = 10; [w * .25, w * .75].forEach(cx => { x.beginPath(); x.arc(cx, 40, 70, .2, Math.PI - .2); x.stroke(); });
  bigNum(x, "01", w * .25, 176, 54, p.sleeve, null);
};
// puffer vest (3D quilts) over a tee: the tee shows above it
SP.puffervest = (x, w, h, p) => {
  x.fillStyle = p.vest; x.fillRect(0, 100, w, h);
};
SP.hoodzip = (x, w, h, p) => {
  const cx = w * .25; zipper(x, cx, 70, h - 26, p.zip || "#9aa5b8");
  x.fillStyle = "rgba(0,0,0,.07)"; [-1, 1].forEach(s => { x.beginPath(); x.moveTo(cx + s * 12, 172); x.lineTo(cx + s * 76, 172); x.lineTo(cx + s * 92, 230); x.lineTo(cx + s * 12, 230); x.closePath(); x.fill(); });
  x.strokeStyle = p.cord || "#c9ced8"; x.lineWidth = 6; x.lineCap = "round"; [-26, 26].forEach(d => { x.beginPath(); x.moveTo(cx + d, 70); x.lineTo(cx + d * 1.15, 140); x.stroke(); fillC(x, p.cord || "#c9ced8", cx + d * 1.15, 143, 5); });
};
// --- members ---
SP.glowbolt = (x, w, h, p, H) => {
  const R = H.rng(5); for (let i = 0; i < 9; i++) bolt(x, R() * w, 30 + R() * 160, .45 + R() * .25, "#4a3cbf");
  bolt(x, w * .25, 170, 1.1, p.acc, p.acc); bolt(x, w * .75, 170, 1.05, p.acc, p.acc);
};
SP.sparkrainbow = (x, w, h, p, H) => {
  const cols = ["#ff5f7a", "#ff9a3c", "#ffe14d", "#4fd36b", "#3fb8ff", "#9a5cff"], bh = (h - 20) / cols.length;
  cols.forEach((c, i) => { x.fillStyle = c; x.fillRect(0, i * bh, w, bh + 1); });
  x.globalAlpha = .25; x.fillStyle = "#ffffff"; for (let i = 0; i < cols.length; i++) x.fillRect(0, i * bh, w, 4); x.globalAlpha = 1;
  glitter(x, w, h, 17, 140, ["#ffffff", "#fff6b0"], H, 0, h - 28);
  x.fillStyle = "#ffffff"; x.strokeStyle = "rgba(0,0,0,.15)"; x.lineWidth = 5; H.starPath(x, w * .25, 168, 34, 15); x.fill(); x.stroke();
};
SP.starjacket = (x, w, h, p, H) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#2a1f5c"); g.addColorStop(1, p.fill); x.fillStyle = g; x.fillRect(0, 0, w, h);
  starField(x, w, h, H, "#ffffff");
  zipper(x, w * .25, 90, h - 26, "#e0e4ff");
};
SP.princegold = (x, w, h, p, H) => {
  const g = x.createLinearGradient(0, 0, w, 0); for (let i = 0; i <= 16; i++) g.addColorStop(i / 16, i % 2 ? "#ffd65a" : "#e8b020"); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const cx = w * .25;
  [-1, 1].forEach(s => { for (let y = 124; y < 220; y += 30) { x.fillStyle = "#fff6d6"; x.fillRect(cx + s * 16 - (s < 0 ? 46 : 0), y, 46, 7); fillC(x, "#fff6d6", cx + s * 62, y + 3.5, 6); } });
  buttons(x, cx, 122, 212, 4, "#ffffff", 6);
  x.beginPath(); x.moveTo(cx - 150, 60); x.lineTo(cx - 100, 60); x.lineTo(cx + 120, h - 26); x.lineTo(cx + 64, h - 26); x.closePath(); x.fillStyle = p.acc; x.fill();   // the royal sash
  x.strokeStyle = "#ffffff"; x.lineWidth = 3; x.stroke();
  x.fillStyle = "#ffffff"; star(x, H, cx + 20, 180, 14);
  x.fillStyle = p.acc; x.fillRect(w * .75 - 3, 0, 6, h);
};
SP.magicrobe = (x, w, h, p, H) => {
  H.galaxySky(x, w, h, 33); x.globalAlpha = .55; x.fillStyle = p.fill; x.fillRect(0, 0, w, h); x.globalAlpha = 1;
  starField(x, w, h, H, "#ffe46b");
  const cx = w * .25; x.strokeStyle = "#ffd23a"; x.lineWidth = 6; x.beginPath(); x.moveTo(cx - 60, 60); x.lineTo(cx, 200); x.lineTo(cx + 60, 60); x.stroke();
  fillC(x, "#ffd23a", cx, 200, 9); x.fillStyle = "#5fe0ff"; x.beginPath(); x.moveTo(cx, 191); x.lineTo(cx + 6, 200); x.lineTo(cx, 209); x.lineTo(cx - 6, 200); x.closePath(); x.fill();
};
SP.pearlsea = (x, w, h, p, H) => {
  const g = x.createLinearGradient(0, 0, w, h); ["#e9f6ff", "#f6e9ff", "#e6fff6", "#fff2e6", "#e9f6ff"].forEach((c, i) => g.addColorStop(i / 4, c)); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = "rgba(120,170,220,.35)"; x.lineWidth = 3; for (let y = 20; y < h; y += 26) for (let u = (y / 26) % 2 ? 0 : 20; u < w + 40; u += 40) { x.beginPath(); x.arc(u, y, 20, 0, Math.PI); x.stroke(); }
  const R = H.rng(19); for (let i = 0; i < 24; i++) { const r = 3 + R() * 5, u = R() * w, v = 20 + R() * (h - 60); const gg = x.createRadialGradient(u - r * .3, v - r * .3, 1, u, v, r); gg.addColorStop(0, "#ffffff"); gg.addColorStop(1, "#d9c8ff"); x.fillStyle = gg; circ(x, u, v, r); x.fill(); }
  x.save(); x.translate(w * .25, 186); x.fillStyle = "#ffb3c8"; x.beginPath(); x.moveTo(0, 30); for (let k = 0; k <= 8; k++) { const a = Math.PI + k / 8 * Math.PI; x.lineTo(Math.cos(a) * 48, Math.sin(a) * 44); } x.closePath(); x.fill(); outline(x, 4, "#d97a9a");
  x.strokeStyle = "#d97a9a"; x.lineWidth = 3; for (let k = 1; k < 8; k++) { const a = Math.PI + k / 8 * Math.PI; x.beginPath(); x.moveTo(0, 30); x.lineTo(Math.cos(a) * 44, Math.sin(a) * 40); x.stroke(); }
  fillC(x, "#ffffff", 0, 18, 10); fillC(x, "rgba(200,180,255,.6)", 3, 21, 5); x.restore();   // a scallop shell with a pearl
};
SP.goldjersey = (x, w, h, p, H) => {
  const g = x.createLinearGradient(0, 0, w, 0); for (let i = 0; i <= 12; i++) g.addColorStop(i / 12, i % 2 ? "#ffe27a" : "#e2a91c"); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = p.acc; sides(w).forEach(u => x.fillRect(u - 16, 0, 32, h)); x.fillRect(0, h - 60, w, 10);
  [-1, 0, 1].forEach(d => star(x, H, w * .25 + d * 30, 126, 9));
  bigNum(x, "1", w * .25, 180, 80, "#ffffff", p.acc); bigNum(x, "1", w * .75, 170, 116, "#ffffff", p.acc);
  glitter(x, w, h, 7, 60, ["#ffffff"], H, 0, h - 28);
};
SP.glowdark = (x, w, h, p, H) => {
  const R = H.rng(91); for (let i = 0; i < 60; i++) { x.fillStyle = "rgba(160,255,200,.25)"; circ(x, R() * w, R() * h, 1 + R() * 2); x.fill(); }
  glowArt(x, w, h, H, "#aef7c8", p.fill);
};

/* ======================= sleeves (256 x 128; front at u = .25, the cuff at the bottom) ======================= */
const SL = {};
SL.soccer = (x, w, h, p) => { x.fillStyle = p.acc; x.fillRect(0, h - 40, w, 12); };
SL.hawaii = (x, w, h, p, H) => { const R = H.rng(3); for (let i = 0; i < 8; i++) leaf(x, R() * w, R() * h, 30, R() * TAU, "#2f9d55"); for (let i = 0; i < 5; i++) hibiscus(x, R() * w, 20 + R() * 80, 18, p.acc, "#ffe14d", R() * 6); };
SL.denimjacket = (x, w, h, p, H) => { denim(x, w, h, p.fill, H, 9); stitchLine(x, [[0, h - 30], [w, h - 30]]); stitchLine(x, [[w * .75, 0], [w * .75, h]]); };
SL.wintercoat = (x, w, h) => { for (let y = 0; y < h; y += 30) { const g = x.createLinearGradient(0, y, 0, y + 30); g.addColorStop(0, "rgba(255,255,255,.18)"); g.addColorStop(1, "rgba(0,0,0,.2)"); x.fillStyle = g; x.fillRect(0, y, w, 30); } };
SL.leather = (x, w, h, p) => { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, "#3a3a46"); g.addColorStop(.5, p.fill); g.addColorStop(1, "#3a3a46"); x.fillStyle = g; x.fillRect(0, 0, w, h); x.save(); x.translate(w * .25, 50); x.rotate(.2); zipper(x, 0, 0, 40, "#dfe3ea"); x.restore(); };
SL.reindeer = (x, w, h, p) => { knit(x, w, h); x.fillStyle = p.acc || "#ffffff"; for (let u = 0; u < w; u += 16) { x.fillRect(u, h - 44, 8, 8); x.fillRect(u + 8, h - 36, 8, 8); } snowflake(x, w * .25, 44, 12, p.acc || "#fff", 3); snowflake(x, w * .75, 44, 12, p.acc || "#fff", 3); };
SL.pinetree = (x, w, h, p) => { knit(x, w, h); x.fillStyle = "#ffffff"; for (let i = 0; i < 14; i++) { circ(x, (i * 53) % w, 10 + (i * 37) % 80, 3); x.fill(); } x.fillStyle = p.acc || "#c8253a"; for (let u = 0; u < w; u += 16) { x.fillRect(u, h - 44, 8, 8); x.fillRect(u + 8, h - 36, 8, 8); } };
SL.polo = (x, w, h) => { x.fillStyle = "rgba(0,0,0,.06)"; x.fillRect(0, h - 34, w, 16); };
SL.buttonup = (x, w, h, p) => { x.strokeStyle = "rgba(0,0,0,.15)"; x.lineWidth = 2; x.beginPath(); x.moveTo(0, h - 36); x.lineTo(w, h - 36); x.stroke(); fillC(x, p.btn || "#ffffff", w * .25, h - 28, 4); };
SL.shirttie = SL.buttonup;
SL.circus = (x, w, h, p) => { x.fillStyle = p.acc; for (let u = 0; u < w; u += 32) x.fillRect(u, 0, 16, h); };
SL.cat = (x, w) => { x.fillStyle = "rgba(255,255,255,.6)"; [[w * .25, 60], [w * .7, 50]].forEach(([u, v]) => [[0, 0, 7], [-8, -9, 3], [0, -12, 3], [8, -9, 3]].forEach(([a, b, r]) => { circ(x, u + a, v + b, r); x.fill(); })); };
SL.puppy = (x, w) => { x.fillStyle = "rgba(255,255,255,.6)"; x.save(); x.translate(w * .25, 56); x.rotate(.5); x.beginPath(); x.roundRect(-14, -4, 28, 8, 4); x.fill(); [[-14, -5], [-14, 5], [14, -5], [14, 5]].forEach(([a, b]) => { circ(x, a, b, 5); x.fill(); }); x.restore(); };
SL.dino = (x, w, h) => { x.fillStyle = "#ff8a3c"; for (let u = 0; u < w; u += 32) { x.beginPath(); x.moveTo(u, h - 18); x.lineTo(u + 16, h - 36); x.lineTo(u + 32, h - 18); x.fill(); } };
SL.avocado = (x, w) => { fillE(x, "#3f7d2a", w * .25, 54, 14, 18); fillE(x, "#d7ef8a", w * .25, 56, 11, 14); fillC(x, "#a0652e", w * .25, 60, 6); };
SL.pizza = (x, w, h) => { x.fillStyle = "rgba(216,51,58,.18)"; for (let j = 0; j < h; j += 32) for (let u = (j / 32) % 2 ? 0 : 32; u < w; u += 64) x.fillRect(u, j, 32, 32); };
SL.rainbowtee = (x, w, h) => { ["#ff4f5f", "#ff9a1f", "#ffe14d", "#4fd36b", "#3fb8ff", "#9a5cff"].forEach((c, i) => { x.fillStyle = c; x.fillRect(0, h - 18 - 6 * (6 - i), w, 6); }); };
SL.waves = (x, w, h) => { waveBand(x, w, h - 46, 5, 64, "#7fd3f5"); waveBand(x, w, h - 34, 5, 64, "#1f8fd0"); };
SL.pixelgame = (x) => { [["#2fd36b", 30, 30], ["#1fb6ff", 120, 60], ["#ffd23a", 200, 36], ["#ff5fb4", 70, 80]].forEach(([c, a, b]) => { x.fillStyle = c; x.fillRect(a, b, 10, 10); }); };
SL.cow = (x, w, h, p, H) => { const R = H.rng(5); x.fillStyle = p.acc || "#1d1d24"; for (let i = 0; i < 5; i++) { ell(x, R() * w, R() * (h - 30), 16 + R() * 10, 12 + R() * 6, R()); x.fill(); } };
SL.citynight = (x, w, h, p, H) => { const R = H.rng(4); x.fillStyle = "#fff"; for (let i = 0; i < 18; i++) { x.globalAlpha = .4 + R() * .6; circ(x, R() * w, R() * h, 1 + R()); x.fill(); } x.globalAlpha = 1; };
SL.abstractdye = (x, w, h, p, H) => SP.abstractdye(x, w, h, p, H);
SL.bubbles = (x, w, h, p, H) => { const R = H.rng(8); for (let i = 0; i < 7; i++) bubble(x, R() * w, 10 + R() * (h - 40), 6 + R() * 12); };
SL.raincoat = (x, w, h) => { x.fillStyle = "rgba(0,0,0,.1)"; x.fillRect(0, h - 40, w, 6); };
SL.labcoat = (x, w, h) => { x.fillStyle = "rgba(0,0,0,.06)"; x.fillRect(0, h - 36, w, 18); };
SL.chef = (x, w, h, p, H) => { glitter(x, w, h, 5, 30, ["#ffd23a", "#ff9ad5", "#9fe8ff"], H, 0, h - 30); };
SL.referee = (x, w, h) => { x.fillStyle = "#1d1d24"; for (let u = 0; u < w; u += 32) x.fillRect(u, 0, 16, h); };
SL.kangaroo = (x, w, h) => { x.fillStyle = "rgba(0,0,0,.1)"; for (let y = h - 44; y < h - 18; y += 6) x.fillRect(0, y, w, 2); };
SL.twotone = (x, w, h, p) => { x.fillStyle = p.sleeve; x.fillRect(0, 0, w, h); };
SL.hoodzip = (x, w, h) => { x.fillStyle = "rgba(0,0,0,.08)"; for (let y = h - 40; y < h - 18; y += 6) x.fillRect(0, y, w, 2); };
SL.glowbolt = (x, w, h, p) => { bolt(x, w * .25, h * .42, .5, p.acc, p.acc); };
SL.sparkrainbow = (x, w, h, p, H) => { const cols = ["#ff5f7a", "#ff9a3c", "#ffe14d", "#4fd36b", "#3fb8ff", "#9a5cff"], bh = (h - 18) / cols.length; cols.forEach((c, i) => { x.fillStyle = c; x.fillRect(0, i * bh, w, bh + 1); }); glitter(x, w, h, 3, 30, ["#ffffff"], H, 0, h - 18); };
SL.starjacket = (x, w, h, p, H) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#2a1f5c"); g.addColorStop(1, p.fill); x.fillStyle = g; x.fillRect(0, 0, w, h); sleeveStars(x, w, h, H, "#ffffff"); };
SL.princegold = (x, w, h, p) => { const g = x.createLinearGradient(0, 0, w, 0); for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, i % 2 ? "#ffd65a" : "#e8b020"); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = p.acc; x.fillRect(0, h - 40, w, 10); x.fillStyle = "#fff6d6"; x.fillRect(0, h - 28, w, 4); };
SL.magicrobe = (x, w, h, p, H) => { H.galaxySky(x, w, h, 5); x.globalAlpha = .55; x.fillStyle = p.fill; x.fillRect(0, 0, w, h); x.globalAlpha = 1; sleeveStars(x, w, h, H, "#ffe46b"); x.fillStyle = "#ffd23a"; x.fillRect(0, h - 30, w, 8); };
SL.pearlsea = (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); ["#e9f6ff", "#f6e9ff", "#e6fff6"].forEach((c, i) => g.addColorStop(i / 2, c)); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let u = 8; u < w; u += 16) { fillC(x, "#ffffff", u, h - 30, 6); fillC(x, "rgba(200,180,255,.5)", u + 2, h - 28, 3); } };
SL.goldjersey = (x, w, h, p) => { const g = x.createLinearGradient(0, 0, w, 0); for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, i % 2 ? "#ffe27a" : "#e2a91c"); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = p.acc; x.fillRect(0, h - 40, w, 12); };
SL.glowdark = (x, w, h, p, H) => { sleeveStars(x, w, h, H, "#aef7c8"); };

/* ======================= pants (512 x 256; front of the hips at u = .25; top 30 px = waistband) ======================= */
const PP = {};
const seams = (x, w, h, c = "rgba(255,210,120,.9)") => { x.save(); x.strokeStyle = c; x.lineWidth = 3; x.setLineDash([10, 8]); [w * .25, w * .75].forEach(u => { x.beginPath(); x.moveTo(u, 40); x.lineTo(u, h); x.stroke(); }); x.restore(); };
const sideStripe = (x, w, h, col, n = 1, gap = 14, sw = 10) => { x.fillStyle = col; [0, w * .5, w].forEach(u => { for (let k = 0; k < n; k++) x.fillRect(u - (n * sw + (n - 1) * (gap - sw)) / 2 + k * gap, 30, sw, h); }); };
PP.ripped = (x, w, h, p, H) => {
  denim(x, w, h, p.base, H, 7); seams(x, w, h);
  [[w * .25 - 60, 96], [w * .25 + 64, 196], [w * .25 - 40, 226], [w * .75 + 40, 120], [w * .25 + 46, 118]].forEach(([cx, cy]) => {
    fillE(x, "rgba(255,255,255,.35)", cx, cy, 30, 15); x.fillStyle = "#f6f2e8"; for (let k = -2; k <= 2; k++) x.fillRect(cx - 24 + Math.abs(k) * 4, cy + k * 5 - 1.5, 48 - Math.abs(k) * 8, 3);
    x.strokeStyle = "rgba(255,255,255,.6)"; x.lineWidth = 2; for (let k = 0; k < 7; k++) { x.beginPath(); x.moveTo(cx - 24 + k * 8, cy - 12); x.lineTo(cx - 22 + k * 8, cy - 18); x.stroke(); } });
};
PP.cargo = (x, w, h) => { seams(x, w, h, "rgba(0,0,0,.25)"); x.fillStyle = "rgba(0,0,0,.15)"; [w * .25 - 70, w * .25 + 70].forEach(u => { x.beginPath(); x.moveTo(u - 30, 34); x.quadraticCurveTo(u, 70, u + 30, 34); x.fill(); }); };
PP.bballshorts = (x, w, h, p) => { x.fillStyle = p.acc; [0, w * .5, w].forEach(u => x.fillRect(u - 26, 30, 52, h)); x.fillStyle = p.acc2 || "#ffffff"; [0, w * .5, w].forEach(u => x.fillRect(u - 4, 30, 8, h)); x.fillStyle = p.acc; x.fillRect(0, h - 22, w, 10); bigNum(x, p.num || "23", w * .25 - 70, 120, 34, p.acc, null); };
PP.soccershorts = (x, w, h, p) => { sideStripe(x, w, h, p.acc, 2, 16, 8); bigNum(x, p.num || "9", w * .25 - 60, 200, 40, p.acc, null); x.fillStyle = p.acc; x.fillRect(0, h - 16, w, 6); };
PP.pleated = (x, w, h, p) => { x.fillStyle = "rgba(0,0,0,.12)"; for (let u = 0; u < w; u += 512 / 22) x.fillRect(u, 30, 4, h); if (p.acc) { x.fillStyle = p.acc; x.fillRect(0, h - 30, w, 6); x.fillRect(0, h - 20, w, 3); } };
PP.tutu = (x, w, h, p) => { x.fillStyle = p.base; x.fillRect(0, 0, w, h); };
PP.denimskirt = (x, w, h, p, H) => { denim(x, w, h, p.base, H, 13); stitchLine(x, [[w * .25 - 6, 34], [w * .25 - 6, h]]); [-1, 1].forEach(s => { stitchLine(x, [[w * .25 + s * 60, 34], [w * .25 + s * 40, 90], [w * .25 + s * 90, 90]]); }); x.fillStyle = "rgba(255,255,255,.5)"; x.fillRect(0, h - 10, w, 10); };
PP.overalls = (x, w, h, p, H) => { denim(x, w, h, p.base, H, 21); seams(x, w, h); x.fillStyle = "rgba(0,0,0,.12)"; [w * .75 - 60, w * .75 + 60].forEach(u => { x.beginPath(); x.roundRect(u - 28, 60, 56, 54, 6); x.fill(); stitchLine(x, [[u - 26, 62], [u - 26, 112], [u + 26, 112], [u + 26, 62]]); }); };
PP.surfshorts = (x, w, h, p, H) => { const R = H.rng(5); for (let i = 0; i < 30; i++) leaf(x, R() * w, 30 + R() * h, 30, R() * TAU, "#2f9d55"); for (let i = 0; i < 22; i++) hibiscus(x, R() * w, 40 + R() * (h - 40), 16 + R() * 8, i % 2 ? p.acc : "#ffffff", "#ffe14d", R() * 6); x.fillStyle = "#ffffff"; x.fillRect(0, h - 18, w, 8); };
PP.leggings = (x, w, h, p) => { sideStripe(x, w, h, p.acc, 1, 0, 14); x.fillStyle = "rgba(255,255,255,.08)"; x.fillRect(w * .25 - 50, 30, 100, h); };
PP.suitpants = (x, w, h, p) => { x.strokeStyle = "rgba(255,255,255,.18)"; x.lineWidth = 3; [w * .25 - 50, w * .25 + 50, w * .75 - 50, w * .75 + 50].forEach(u => { x.beginPath(); x.moveTo(u, 30); x.lineTo(u, h); x.stroke(); });
  x.strokeStyle = "rgba(0,0,0,.25)"; x.lineWidth = 2; [-1, 1].forEach(s => { x.beginPath(); x.moveTo(w * .25 + s * 90, 32); x.lineTo(w * .25 + s * 110, 76); x.stroke(); }); };
PP.patches = (x, w, h, p, H) => { denim(x, w, h, p.base, H, 17); seams(x, w, h); const R = H.rng(23), cols = ["#ff5f7a", "#ffd23a", "#4fd36b", "#9a5cff", "#ff9a3c", "#3fb8ff"];
  [[w * .25 - 60, 80], [w * .25 + 64, 120], [w * .25 - 10, 200], [w * .75 - 50, 90], [w * .75 + 60, 180], [w * .25 + 70, 220], [w * .5 + 10, 150], [20, 140]].forEach(([u, v], i) => { x.save(); x.translate(u, v); x.rotate((R() - .5) * .5); x.fillStyle = cols[i % 6]; x.fillRect(-24, -20, 48, 40);
    if (i % 2) { x.fillStyle = "rgba(255,255,255,.35)"; for (let k = -24; k < 24; k += 10) x.fillRect(k, -20, 5, 40); } else { x.fillStyle = "rgba(255,255,255,.4)"; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { circ(x, a * 14, b * 12, 3); x.fill(); } }
    stitchLine(x, [[-21, -17], [21, -17], [21, 17], [-21, 17], [-21, -17]], "#ffffff", 2); x.restore(); }); };
PP.polka = (x, w, h, p) => { x.fillStyle = p.acc; for (let j = 0, r = 0; j < h + 20; j += 30, r++) for (let u = r % 2 ? 16 : 0; u < w + 20; u += 32) { circ(x, u, j + 30, 7); x.fill(); } };
PP.chefpants = (x, w, h, p) => { x.fillStyle = p.acc || "#1d1d24"; const S = 16; for (let j = 0; j * S < h; j++) for (let i = 0; i * S < w; i++) if ((i + j) % 2) x.fillRect(i * S, j * S, S, S); };
PP.vstripes = (x, w, h, p) => { const c = p.stripes; for (let u = 0, k = 0; u < w; u += 16, k++) { x.fillStyle = c[k % c.length]; x.fillRect(u, 0, 16, h); } };
PP.corduroy = (x, w, h) => { for (let u = 0; u < w; u += 6) { const g = x.createLinearGradient(u, 0, u + 6, 0); g.addColorStop(0, "rgba(0,0,0,.18)"); g.addColorStop(.5, "rgba(255,255,255,.12)"); g.addColorStop(1, "rgba(0,0,0,.18)"); x.fillStyle = g; x.fillRect(u, 0, 6, h); }
  x.strokeStyle = "rgba(0,0,0,.3)"; x.lineWidth = 3; [w * .25 - 30, w * .25 + 30, w * .75 - 30, w * .75 + 30].forEach(u => { x.beginPath(); x.moveTo(u, 30); x.quadraticCurveTo(u + 4, 80, u, 130); x.stroke(); }); };
PP.starjeans = (x, w, h, p, H) => { denim(x, w, h, p.base, H, 29); seams(x, w, h); const cols = ["#ffd23a", "#ff5fb4", "#ffffff", "#5fe0ff"];
  [[w * .25 - 56, 90, 22], [w * .25 + 64, 150, 18], [w * .25 - 20, 214, 16], [w * .75 + 40, 100, 20], [w * .75 - 70, 190, 16], [w * .5 + 20, 130, 14], [30, 200, 14], [w * .25 + 50, 232, 12]].forEach(([u, v, r], i) => {
    x.fillStyle = cols[i % 4]; star(x, H, u, v, r); x.save(); x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = 2; x.setLineDash([4, 3]); H.starPath(x, u, v, r - 3, (r - 3) * .45); x.stroke(); x.restore(); }); };
PP.snowpants = (x, w, h, p) => { for (let y = 30; y < h; y += 34) { const g = x.createLinearGradient(0, y, 0, y + 34); g.addColorStop(0, "rgba(255,255,255,.2)"); g.addColorStop(1, "rgba(0,0,0,.18)"); x.fillStyle = g; x.fillRect(0, y, w, 34); } x.fillStyle = p.acc; x.fillRect(0, h - 40, w, 12); };
PP.pineapple = (x, w, h, p, H) => { const R = H.rng(41); for (let i = 0; i < 18; i++) { const u = (i * 97 + R() * 40) % w, v = 60 + (i * 53) % (h - 80); pineappleIcon(x, u, v, .6 + R() * .2, R() * .6 - .3); } x.fillStyle = p.acc || "#ffffff"; x.fillRect(0, h - 18, w, 8); };
PP.flares = (x, w, h, p, H) => { denim(x, w, h, p.base, H, 33); seams(x, w, h); };
PP.denimflowers = (x, w, h, p, H) => { denim(x, w, h, p.base, H, 37); seams(x, w, h); const cols = ["#ff5f7a", "#ffd23a", "#ffffff", "#ff9ad5"];
  [[w * .25 - 50, 110], [w * .25 + 60, 90], [w * .75 + 30, 120], [w * .25 + 20, 200], [w * .25 - 70, 210], [w * .75 - 60, 200], [40, 130], [w * .5 + 30, 210]].forEach(([u, v], i) => {
    leaf(x, u + 6, v + 8, 16, .5, "#4fa83a"); x.fillStyle = cols[i % 4]; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; circ(x, u + Math.cos(a) * 8, v + Math.sin(a) * 8, 6.5); x.fill(); } fillC(x, i % 4 === 1 ? "#ff8a1c" : "#ffd23a", u, v, 4.5); });
  x.fillStyle = "rgba(255,255,255,.6)"; x.fillRect(0, h - 8, w, 8); };
PP.trackstars = (x, w, h, p, H) => { sideStripe(x, w, h, p.acc, 1, 0, 26); x.fillStyle = p.star || "#ffffff"; [0, w * .5, w].forEach(u => { for (let v = 50; v < h; v += 34) star(x, H, u, v, 10); }); };
PP.plaidskirt = (x, w, h, p) => { x.globalAlpha = .4; x.fillStyle = p.acc || "#1d2b4f"; for (let i = 0; i < w; i += 64) x.fillRect(i, 0, 26, h); for (let j = 30; j < h; j += 64) x.fillRect(0, j, w, 26);
  x.globalAlpha = .7; x.fillStyle = p.acc2 || "#ffd23a"; for (let i = 36; i < w; i += 64) x.fillRect(i, 0, 3, h); for (let j = 66; j < h; j += 64) x.fillRect(0, j, w, 3); x.globalAlpha = 1; };
PP.rainbowskirt = (x, w, h) => { const c = ["#ff5f7a", "#ff9a3c", "#ffe14d", "#4fd36b", "#3fb8ff", "#9a5cff"]; c.forEach((col, i) => { x.fillStyle = col; x.fillRect(0, 30 + i * (h - 30) / 6, w, (h - 30) / 6 + 1); }); };
PP.princess = (x, w, h, p) => { const g = x.createLinearGradient(0, 30, 0, h); g.addColorStop(0, p.base); g.addColorStop(1, p.base2 || "#ffd6f0"); x.fillStyle = g; x.fillRect(0, 30, w, h); };
PP.glowbolts = (x, w, h, p) => { [[w * .25 - 44, 84, .75], [w * .25 + 50, 96, .7], [w * .25, 200, .6], [w * .75 - 40, 90, .75], [w * .75 + 46, 100, .7], [w * .5, 90, .7], [8, 96, .7], [w * .75, 200, .6]].forEach(([u, v, k]) => bolt(x, u, v, k, p.acc, p.acc)); };
PP.goldshine = (x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); for (let i = 0; i <= 10; i++) g.addColorStop(i / 10, i % 2 ? "#ffe680" : "#e0a818"); x.fillStyle = g; x.fillRect(0, 0, w, h); seams(x, w, h, "rgba(255,255,255,.6)"); };
PP.nightsky = (x, w, h, p, H) => { H.galaxySky(x, w, h, 57); const R = H.rng(58); x.fillStyle = "#ffe46b"; for (let i = 0; i < 12; i++) star(x, H, R() * w, 40 + R() * (h - 50), 5 + R() * 5); };
PP.icecrystal = (x, w, h, p, H) => {
  const R = H.rng(61); x.fillStyle = p.base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { const u = R() * w, v = 30 + R() * h, s = 14 + R() * 24; x.fillStyle = ["#bfeeff", "#e8fbff", "#8fd8ff", "#d9e6ff"][i % 4]; x.beginPath(); x.moveTo(u, v - s); x.lineTo(u + s * .6, v); x.lineTo(u, v + s); x.lineTo(u - s * .6, v); x.closePath(); x.fill();
    x.strokeStyle = "rgba(255,255,255,.7)"; x.lineWidth = 1.5; x.stroke(); }
  for (let i = 0; i < 20; i++) snowflake(x, R() * w, 40 + R() * (h - 40), 7, "#ffffff", 2);
};
PP.glowpants = (x, w, h, p, H) => { const R = H.rng(77); x.fillStyle = "rgba(160,255,200,.3)"; for (let i = 0; i < 50; i++) { circ(x, R() * w, 30 + R() * h, 1 + R() * 2); x.fill(); } glowPantsArt(x, w, h, H, "#aef7c8"); };

/* ======================= exports: painters by id ======================= */
export const SHIRT_PRINTS = {};    // id -> (ctx, w, h, item, H)
export const SLEEVE_PRINTS = {};   // id -> (ctx, w, h, item, H)
export const PANTS_PRINTS = {};    // id -> (ctx, w, h, item, H)
const wrap = f => (x, w, h, p, H) => { x.save(); f(x, w, h, p, H); x.restore(); };
Object.entries(SP).forEach(([id, f]) => { SHIRT_PRINTS[id] = wrap(f); });
Object.entries(SL).forEach(([id, f]) => { SLEEVE_PRINTS[id] = wrap(f); });
Object.entries(PP).forEach(([id, f]) => { PANTS_PRINTS[id] = wrap(f); });

/* ======================= 3D helpers (body space: body ellipsoid centre (0,.52,0), radii .38 .46 .33) ======================= */
// a surface patch: f(u, v) -> Vector3, u and v in 0..1 (uv = (u, 1 - v))
function patch(H, f, nu, nv, mat) {
  const T = H.THREE, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const p = f(i / nu, j / nv); pos.push(p.x, p.y, p.z); uv.push(i / nu, 1 - j / nv); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new T.Mesh(g, mat); m.castShadow = true; return m;
}
// a flat strap lying on the body along points (ph, vy, S): width w
function strap(H, pts, w, mat, n = 24) {
  const T = H.THREE, P = pts.map(([ph, vy, S]) => H.bodyPt(ph, vy, S)), curve = new T.CatmullRomCurve3(P), C = new T.Vector3(0, .52, 0);
  return patch(H, (u, v) => { const p = curve.getPointAt(v), tg = curve.getTangentAt(v), nrm = p.clone().sub(C); nrm.set(nrm.x / .1444, nrm.y / .2116, nrm.z / .1089).normalize();
    const side = tg.clone().cross(nrm).normalize(); return p.clone().addScaledVector(side, (u - .5) * w); }, 2, n, mat);
}
const dbl = (H, m) => { m.side = H.THREE.DoubleSide; return m; };
// the chin meets the shirt at about vy .56 all round
const NECK = .56;
// a turned-down shirt collar (two halves meeting at the back, pointed tips at the front)
// collar cloth: the shirt colour with a soft fold highlight at the top and a darker stitched edge (so a white collar still reads on a white shirt)
function collarMat(H, col, rough = .8) {
  const tex = H.canvasTex(128, 64, (x, w, h) => { x.fillStyle = col; x.fillRect(0, 0, w, h); const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "rgba(255,255,255,.25)"); g.addColorStop(.5, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(0,0,0,.18)"); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(0, h - 6, w, 6); x.fillRect(0, 0, 4, h); x.fillStyle = "rgba(0,0,0,.18)"; for (let u = 0; u < w; u += 8) x.fillRect(u, h - 13, 4, 2); });
  return new H.THREE.MeshStandardMaterial({ map: tex, roughness: rough, side: H.THREE.DoubleSide });
}
function shirtCollar(H, mat, o = {}) {
  const { top = NECK + .04, bot = NECK - .15, drop = .2, gap = .1, S0 = 1.11, S1 = 1.085, tip = .04 } = o;
  return [-1, 1].map(s => patch(H, (u, v) => { const g = gap * (1 - v) + tip * v, ph = s * (g + u * (Math.PI - g)), f = Math.pow(Math.max(0, 1 - u * 3), 2);
    return H.bodyPt(ph, top + (bot - drop * f - top) * v, S0 + (S1 - S0) * v); }, 24, 4, mat));
}
// a standing (mandarin) collar
function standCollar(H, mat, o = {}) {
  const { top = NECK + .06, bot = NECK - .12, S0 = 1.105, S1 = 1.09, gap = .08 } = o;
  return patch(H, (u, v) => H.bodyPt(gap + u * (TAU - 2 * gap), top + (bot - top) * v, S0 + (S1 - S0) * v), 48, 3, mat);
}
// wide jacket lapels on the chest, each side: from the neck down to the button point
function lapels(H, mat, o = {}) {
  const { y0 = NECK, y1 = .02, w = .34, S = 1.085, inner = .2 } = o;
  return [-1, 1].map(s => patch(H, (u, v) => { const vy = y0 + (y1 - y0) * u, pin = inner * (1 - u) + .03 * u, wid = w * Math.sin(Math.PI * Math.min(1, u * 1.15 + .08)) * (1 - u * .35);
    return H.bodyPt(s * (pin + v * wid), vy, S + .012 * (1 - v) * (1 - u)); }, 14, 4, mat));
}
// a hood lying down on the upper back: a soft pouch, its (darker) opening near the top and a rolled rim round it
function hood(H, mat, rimMat, inMat) {
  const T = H.THREE, out = [];
  const at = (a, b, lift = 0) => { const half = .8 * (1 - .35 * b), ph = Math.PI + a * half, vy = .42 - b * .62,
    S = 1.065 + .13 * Math.pow(Math.max(0, 1 - a * a), .6) * Math.pow(Math.sin(Math.PI * (.12 + .88 * b)), .7); return H.bodyPt(ph, vy, S + lift); };
  out.push(patch(H, (u, v) => at(u * 2 - 1, v), 20, 14, mat));
  const ea = .6, eb = .26, ec = .26;
  out.push(patch(H, (u, v) => { const t = u * TAU, r = 1 - v; return at(ea * r * Math.cos(t), ec + eb * r * Math.sin(t), .006 + .02 * r); }, 32, 4, inMat || rimMat || mat));
  const pts = []; for (let i = 0; i < 32; i++) { const t = i / 32 * TAU; pts.push(at(ea * Math.cos(t), ec + eb * Math.sin(t), .012)); }
  out.push(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts, true), 48, .022, 8, true), rimMat || mat));
  return out;
}
// lumpy fur along a curve
function furRing(H, curve, r, mat, seg = 90, closed = true) {
  const T = H.THREE, rad = 10, g = new T.TubeGeometry(curve, seg, r, rad, closed), a = g.attributes.position, R = H.rng(7), v = new T.Vector3();
  const noise = []; for (let i = 0; i <= seg; i++) noise.push(.75 + R() * .5); if (closed) noise[seg] = noise[0];
  for (let i = 0; i <= seg; i++) { const c = curve.getPointAt(closed ? (i % seg) / seg : i / seg); for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; v.fromBufferAttribute(a, k).sub(c);
    v.multiplyScalar(noise[i] * (1 + .25 * Math.sin((j % rad) * 2.1 + i * 1.3))).add(c); a.setXYZ(k, v.x, v.y, v.z); } }
  g.computeVertexNormals(); const m = new T.Mesh(g, mat); m.castShadow = true; return m;
}
const ringCurve = (H, vyOf, S = 1.1, n = 48) => { const pts = []; for (let i = 0; i < n; i++) { const ph = i / n * TAU; pts.push(H.bodyPt(ph, vyOf(ph), S)); } return new H.THREE.CatmullRomCurve3(pts, true); };
// the sleeve's cuff ring (in arm space, side s = -1 left / 1 right)
function cuffCurve(H, s, grow = 1.0, th = 1.18) {
  const T = H.THREE, pts = [], e = new T.Euler(0, 0, s * .18);
  for (let i = 0; i < 32; i++) { const a = i / 32 * TAU, v = new T.Vector3(-Math.cos(a) * Math.sin(th) * .1 * 1.16 * grow, Math.cos(th) * .24 * 1.16, Math.sin(a) * Math.sin(th) * .11 * 1.16 * grow).applyEuler(e); pts.push(v.add(new T.Vector3(s * .03, -.2, 0))); }
  return new T.CatmullRomCurve3(pts, true);
}
// a skirt round the hips: from the waist (t = 0) to the hem (t = 1), optional pleats / ruffles; front at u = .25 like the pants canvas
function skirtGeo(H, o) {
  const T = H.THREE, { yTop = .45, yBot = .14, rTop = .41, rBot = .5, seg = 96, rings = 12, pleats = 0, depth = 0, wave = 0, waveAmp = 0, zs = .87, phi0 = 0, phiLen = TAU, bow = 0 } = o;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= rings; j++) { const t = j / rings, y = yTop + (yBot - yTop) * t, r0 = rTop + (rBot - rTop) * (bow ? Math.sin(t * Math.PI / 2) : t);
    for (let i = 0; i <= seg; i++) { const ph = phi0 + i / seg * phiLen; let r = r0;
      if (pleats) { const q = ((ph / TAU * pleats) % 1 + 1) % 1; r *= 1 + depth * t * (Math.abs(q - .5) * 2 - .5); }
      const yy = y + (wave ? Math.sin(ph * wave) * waveAmp * t : 0);
      pos.push(Math.sin(ph) * r, yy, Math.cos(ph) * r * zs); uv.push(.25 + ph / TAU, 1 - t); } }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/* find the shirt's own body / sleeve mesh once this marker is added next to it, so a shirt can restyle its own cloth
   (shine, glow, no sleeves, puffed sleeves). kind: "body" or "L" / "R" (the arm). Markers must come first in shirt3D's list. */
let OWN = null;   // the shirt's own meshes {body, L, R}, handed over by index.html (then no searching is needed)
function grab(H, kind, fn) {
  const o = new H.THREE.Object3D(); if (kind !== "body") o.userData.arm = kind;
  if (OWN && OWN[kind]) { fn(OWN[kind]); return o; }
  const h = () => { o.removeEventListener("added", h); const ch = o.parent.children;
    for (let i = ch.indexOf(o) - 1; i >= 0; i--) { const m = ch[i], im = m.isMesh && m.material && m.material.map && m.material.map.image;
      if (im && (kind === "body" ? im.width === 1024 && im.height === 256 : im.width === 256 && im.height === 128)) { fn(m); break; } } };
  o.addEventListener("added", h); return o;
}
const grabAll = (H, fn) => [grab(H, "body", m => fn(m, "body")), grab(H, "L", m => fn(m, "L")), grab(H, "R", m => fn(m, "R"))];
const noSleeves = H => [grab(H, "L", m => m.geometry.setDrawRange(0, 0)), grab(H, "R", m => m.geometry.setDrawRange(0, 0))];
// puff the sleeve out in the middle (same uv, so the sleeve print still fits)
function puffSleeves(H, amt = .55) {
  const T = H.THREE; return ["L", "R"].map(k => grab(H, k, m => { const s = k === "L" ? -1 : 1, g = m.geometry.clone(), a = g.attributes.position, uvA = g.attributes.uv, c = new T.Vector3(s * .03, -.2, 0), e = new T.Euler(0, 0, -s * .18), e2 = new T.Euler(0, 0, s * .18), v = new T.Vector3();
    for (let i = 0; i < a.count; i++) { const t = 1 - uvA.getY(i), f = 1 + amt * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1)), .8); v.fromBufferAttribute(a, i).sub(c).applyEuler(e); v.x *= f; v.z *= f; v.y += .02 * f; v.applyEuler(e2).add(c); a.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); m.geometry = g; }));
}
// emissive maps painted like a shirt / sleeve (black = no glow); the sleeve one is 129 high so grab() never mistakes it for a sleeve
const shirtCanvas = (H, draw) => H.canvasTex(1024, 256, (x, w, h) => { x.fillStyle = "#000"; x.fillRect(0, 0, w, h); draw(x, w, h); x.fillStyle = "#000"; x.fillRect(0, h - 26, w, 26); });
const sleeveCanvas = (H, draw) => H.canvasTex(256, 129, (x, w, h) => { x.fillStyle = "#000"; x.fillRect(0, 0, w, h); draw(x, w, h); x.fillStyle = "#000"; x.fillRect(0, h - 18, w, 18); });
function setGlow(m, tex, col, k) { m.material.emissive.set(col); m.material.emissiveMap = tex; m.material.emissiveIntensity = k; m.material.needsUpdate = true; }

/* ======================= shirt 3D ======================= */
export function shirt3D(item, H, own = null) {
  OWN = own; try { return shirt3DParts(item, H); } finally { OWN = null; }
}
function shirt3DParts(item, H) {
  const T = H.THREE, id = item.id, S = H.solid, out = [];
  const cloth = (c, r = .8) => dbl(H, S(c, r));
  switch (id) {
    case "bball": case "sporttank": out.push(...noSleeves(H)); break;
    case "hawaii": out.push(...shirtCollar(H, collarMat(H, item.fill), { gap: .2, tip: .12, drop: .26, bot: NECK - .18 })); break;
    case "denimjacket": out.push(...shirtCollar(H, collarMat(H, item.hem), { gap: .1, tip: .06, drop: .22, bot: NECK - .2, S0: 1.12, S1: 1.09 })); break;
    case "wintercoat": { const fur = S(item.fur || "#f4efe6", 1);
      out.push(furRing(H, ringCurve(H, ph => NECK - .02 - .05 * Math.max(0, Math.cos(ph)), 1.1), .06, fur));
      out.push(furRing(H, ringCurve(H, () => -.25, 1.07), .035, fur, 96));
      [["L", -1], ["R", 1]].forEach(([k, s]) => { const c = furRing(H, cuffCurve(H, s, 1.06), .028, fur, 40); c.userData.arm = k; out.push(c); });
      break; }
    case "leather": out.push(...grabAll(H, m => { m.material.roughness = .45; m.material.metalness = .08; }));
      out.push(...lapels(H, cloth("#2c2c36", .45), { w: .3, inner: .16, y1: .2 })); break;
    case "reindeer": case "pinetree": out.push(standCollar(H, collarMat(H, item.hem, .9), { gap: 0 })); break;
    case "polo": out.push(...shirtCollar(H, collarMat(H, item.fill), { gap: .12, tip: .07, drop: .16 })); break;
    case "buttonup": out.push(...shirtCollar(H, collarMat(H, item.collar || item.fill), { gap: .1, tip: .04, drop: .2 })); break;
    case "shirttie": { out.push(...shirtCollar(H, collarMat(H, item.fill), { gap: .1, tip: .04, drop: .2 }));
      const tm = dbl(H, S(item.acc, .55));
      out.push(patch(H, (u, v) => { const wv = .06 + .05 * v, ph = (u - .5) * 2 * wv * (v > .9 ? (1 - v) * 10 : 1); return H.bodyPt(ph, .42 - v * .5, 1.075 + .01 * Math.sin(Math.PI * u)); }, 4, 16, tm));
      const knot = new T.Mesh(new T.SphereGeometry(.045, 12, 8), tm); knot.position.copy(H.bodyPt(0, .47, 1.1)); knot.scale.set(1.1, .9, .6); out.push(knot); break; }
    case "circus": { out.push(...puffSleeves(H, .6));
      out.push(new T.Mesh(skirtGeo(H, { yTop: .79, yBot: .72, rTop: .33, rBot: .43, zs: .9, rings: 3, seg: 120, wave: 14, waveAmp: .035 }), dbl(H, S("#ffffff", .7))));
      out.push(new T.Mesh(skirtGeo(H, { yTop: .76, yBot: .7, rTop: .35, rBot: .39, zs: .92, rings: 2, seg: 120, wave: 14, waveAmp: -.02 }), dbl(H, S(item.acc, .7))));
      break; }
    case "raincoat": out.push(...grabAll(H, m => { m.material.roughness = .35; })); out.push(...hood(H, cloth(item.fill, .4), cloth(item.fill, .4), cloth(item.hem, .6))); break;
    case "hoodzip": out.push(...hood(H, cloth(item.fill), cloth(item.fill), cloth(item.hem))); break;
    case "labcoat": { const wm = cloth(item.fill, .8);
      out.push(...lapels(H, wm, { w: .26, inner: .14, y1: .18 }));
      out.push(new T.Mesh(skirtGeo(H, { yTop: .45, yBot: .14, rTop: .405, rBot: .47, phi0: .28, phiLen: TAU - .56, rings: 6, seg: 64 }), wm));
      break; }
    case "chef": out.push(standCollar(H, collarMat(H, item.fill, .7))); break;
    case "referee": out.push(...shirtCollar(H, collarMat(H, "#1d1d24"), { gap: .14, tip: .08, drop: .14 })); break;
    case "kangaroo": out.push(patch(H, (u, v) => { const half = .62 - .14 * v; return H.bodyPt((u - .5) * 2 * half, .12 - v * .32, 1.075 + .012 * Math.sin(Math.PI * u)); }, 12, 5, dbl(H, S(item.hem, .85)))); break;
    case "puffervest": { const vm = H.mat(item.vest, { roughness: .45, side: T.DoubleSide }), sh = H.shell({ center: [0, .52, 0], radii: [.38, .46, .33], scale: 1.075, pear: .12, t0: .85, t1: 1.8, mat: vm, seg: [64, 20] });
      const a = sh.geometry.attributes.position, uvA = sh.geometry.attributes.uv, v = new T.Vector3();
      for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i); const k = 1 + .028 * Math.abs(Math.sin(uvA.getY(i) * Math.PI * 4.5)); v.x *= k; v.z *= k; a.setXYZ(i, v.x, v.y, v.z); }
      sh.geometry.computeVertexNormals(); out.push(sh);
      out.push(strap(H, [[0, .45, 1.115], [0, .1, 1.115], [0, -.24, 1.1]], .025, S("#e6e9f0", .3, { metalness: .5 }))); break; }
    case "glowbolt": { const tb = shirtCanvas(H, (x, w) => { bolt(x, w * .25, 170, 1.1, "#fff"); bolt(x, w * .75, 170, 1.05, "#fff"); }), ts = sleeveCanvas(H, (x, w, h) => bolt(x, w * .25, h * .42, .5, "#fff"));
      const mats = []; out.push(...grabAll(H, (m, k) => { setGlow(m, k === "body" ? tb : ts, item.acc, 1); mats.push(m.material); }));
      H.anim(t => { const k = .55 + .45 * Math.pow(Math.abs(Math.sin(t * 2.2)), 3) + (Math.sin(t * 13) > .97 ? .6 : 0); mats.forEach(mm => mm.emissiveIntensity = k); }); break; }
    case "sparkrainbow": { const tb = shirtCanvas(H, (x, w, h) => glitter(x, w, h, 17, 140, ["#ffffff"], H, 0, h - 28)); tb.wrapS = T.RepeatWrapping; tb.needsUpdate = true;
      const mats = []; out.push(grab(H, "body", m => { setGlow(m, tb, "#ffffff", .8); m.material.roughness = .4; mats.push(m.material); }));
      H.anim(t => { tb.offset.x = (t * .02) % 1; mats.forEach(mm => mm.emissiveIntensity = .5 + .4 * Math.sin(t * 3)); }); break; }
    case "starjacket": { const tb = shirtCanvas(H, (x, w, h) => starField(x, w, h, H, "#ffffff")), ts = sleeveCanvas(H, (x, w, h) => sleeveStars(x, w, h, H, "#ffffff"));
      const mats = []; out.push(...grabAll(H, (m, k) => { setGlow(m, k === "body" ? tb : ts, "#ff5fd2", 1.1); mats.push(m.material); }));
      out.push(standCollar(H, collarMat(H, "#2a1f5c", .5)));
      H.anim(t => { mats.forEach(mm => mm.emissive.setHSL((t * .08) % 1, .95, .55)); }); break; }
    case "princegold": { const gold = S("#ffcf3a", .3, { metalness: .55, emissive: "#6b4a00", emissiveIntensity: .35 });
      out.push(...grabAll(H, m => { m.material.roughness = .4; m.material.metalness = .3; m.material.emissive.set("#3a2a00"); }));
      out.push(standCollar(H, dbl(H, S(item.acc, .5))));
      [["L", -1], ["R", 1]].forEach(([k, s]) => { const g = new T.Group(); g.userData.arm = k; g.position.set(s * .045, .05, 0); g.rotation.z = -s * .35;
        const pad = new T.Mesh(new T.CylinderGeometry(.11, .125, .035, 24), gold); pad.scale.z = 1.1; g.add(pad);
        for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, f = new T.Mesh(new T.CylinderGeometry(.01, .01, .07, 5), gold); f.position.set(Math.cos(a) * .118, -.045, Math.sin(a) * .13); g.add(f); }
        H.mergeByMaterial(g); out.push(g); }); break; }
    case "magicrobe": { const tex = H.canvasTex(512, 300, (x, w, h) => { H.galaxySky(x, w, h, 41); x.globalAlpha = .5; x.fillStyle = item.fill; x.fillRect(0, 0, w, h); x.globalAlpha = 1; const R = H.rng(43); x.fillStyle = "#ffe46b"; for (let i = 0; i < 40; i++) star(x, H, R() * w, R() * h, 5 + R() * 10); });
      tex.wrapS = tex.wrapT = T.RepeatWrapping; const cm = new T.MeshStandardMaterial({ map: tex, roughness: .55, side: T.DoubleSide, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: .25 });
      const drape = new T.CylinderGeometry(.38, .58, .74, 40, 10, true, Math.PI * .66, Math.PI * .68), pa = drape.attributes.position;
      for (let k = 0; k < pa.count; k++) { const y = pa.getY(k), xx = pa.getX(k), z = pa.getZ(k), t = (.5 - y), wv = 1 + Math.sin(Math.atan2(xx, z) * 9) * .05 * t; pa.setX(k, xx * wv); pa.setZ(k, z * wv - .05 * t); }
      drape.computeVertexNormals(); const d1 = new T.Mesh(drape, cm); d1.position.set(0, .48, -.03); out.push(d1);
      out.push(new T.Mesh(skirtGeo(H, { yTop: .45, yBot: .12, rTop: .405, rBot: .46, phi0: .3, phiLen: TAU - .6, rings: 6, seg: 64 }), cm));
      out.push(standCollar(H, dbl(H, S(item.acc, .4, { metalness: .4 }))));
      H.anim(t => { tex.offset.y = (t * .03) % 1; cm.emissiveIntensity = .2 + .12 * Math.sin(t * 2); }); break; }
    case "pearlsea": { out.push(...grabAll(H, m => { m.material.roughness = .3; m.material.metalness = .15; }));
      const pm = S("#fbf6ff", .15, { metalness: .2, emissive: "#d9c8ff", emissiveIntensity: .15 }), b = new T.SphereGeometry(.028, 12, 8), g = new T.Group();
      for (let i = 0; i <= 26; i++) { const ph = -1.35 + i / 26 * 2.7, m = new T.Mesh(b, pm); m.position.copy(H.bodyPt(ph, NECK - .09 - .2 * Math.pow(Math.cos(ph / 1.35 * Math.PI / 2), 2), 1.1)); g.add(m); }
      H.mergeByMaterial(g); out.push(g); break; }
    case "goldjersey": out.push(...grabAll(H, m => { m.material.roughness = .38; m.material.metalness = .3; m.material.emissive.set("#4a3200"); })); break;
    case "glowdark": { const tb = shirtCanvas(H, (x, w, h) => glowArt(x, w, h, H, "#ffffff", "#000000")), ts = sleeveCanvas(H, (x, w, h) => sleeveStars(x, w, h, H, "#ffffff"));
      const mats = []; out.push(...grabAll(H, (m, k) => { setGlow(m, k === "body" ? tb : ts, "#7dffb0", .9); mats.push(m.material); }));
      H.anim(t => { const k = .7 + .3 * Math.sin(t * 1.6); mats.forEach(mm => mm.emissiveIntensity = k); }); break; }
  }
  return out.length ? out : null;
}

/* ======================= pants 3D ======================= */
export function pants3D(item, mat, H) {
  const T = H.THREE, id = item.id, out = [], S = H.solid;
  const strapsAndBib = (m, btn, puffy) => {
    out.push(patch(H, (u, v) => { const half = .5 - .1 * v; return H.bodyPt((u - .5) * 2 * half, .24 - v * .5, 1.075 + (puffy ? .02 : .008) * Math.sin(Math.PI * u)); }, 12, 6, m));
    [-1, 1].forEach(s => { out.push(strap(H, [[s * .38, .22, 1.08], [s * .42, .5, 1.085], [s * .55, .8, 1.06], [s * 2.2, .7, 1.07], [s * 2.6, .2, 1.08], [s * 2.7, -.2, 1.08]], .085, m, 40));
      const b = new T.Mesh(new T.CylinderGeometry(.025, .025, .015, 14), btn); b.position.copy(H.bodyPt(s * .36, .2, 1.1)); b.rotation.x = Math.PI / 2 - .3; out.push(b); });
  };
  switch (id) {
    case "pleated": case "plaidskirt": out.push(new T.Mesh(skirtGeo(H, { yTop: .46, yBot: .15, rTop: .41, rBot: .5, pleats: 22, depth: .12, rings: 8, seg: 132 }), mat)); break;
    case "denimskirt": out.push(new T.Mesh(skirtGeo(H, { yTop: .46, yBot: .17, rTop: .41, rBot: .46, rings: 6, seg: 72 }), mat));
      { const b = new T.Mesh(new T.CylinderGeometry(.022, .022, .012, 14), S("#c99a3a", .3, { metalness: .6 })); b.position.set(0, .43, .37); b.rotation.x = Math.PI / 2; out.push(b); } break;
    case "rainbowskirt": out.push(new T.Mesh(skirtGeo(H, { yTop: .46, yBot: .14, rTop: .41, rBot: .5, rings: 8, seg: 96, wave: 10, waveAmp: .02, bow: 1 }), mat));
      { const tm = new T.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: .35, roughness: .4, side: T.DoubleSide, depthWrite: false, emissive: "#ffffff", emissiveIntensity: .25 });
        out.push(new T.Mesh(skirtGeo(H, { yTop: .44, yBot: .13, rTop: .42, rBot: .53, rings: 6, seg: 96, wave: 13, waveAmp: .03, bow: 1 }), tm)); } break;
    case "tutu": { const cols = [item.base, item.base2 || item.base, item.base];
      [[.4, .3, .62], [.42, .27, .58], [.44, .24, .52]].forEach(([yT, yB, rB], k) => { const m = new T.MeshStandardMaterial({ color: cols[k], transparent: true, opacity: .72, roughness: .7, side: T.DoubleSide, depthWrite: k === 2 });
        out.push(new T.Mesh(skirtGeo(H, { yTop: yT, yBot: yB, rTop: .41, rBot: rB, rings: 4, seg: 120, wave: 18 + k * 3, waveAmp: .025, bow: 1 }), m)); });
      out.push(new T.Mesh(skirtGeo(H, { yTop: .46, yBot: .4, rTop: .41, rBot: .415, rings: 1, seg: 72 }), S(item.waist, .6, { side: T.DoubleSide }))); break; }
    case "princess": { const sp = H.canvasTex(512, 256, (x, w, h) => { x.fillStyle = "#000"; x.fillRect(0, 0, w, h); glitter(x, w, h, 11, 220, ["#ffffff", "#fff2b0", "#ffd6f5"], H); });
      sp.wrapS = T.RepeatWrapping; sp.needsUpdate = true; mat.emissive = new T.Color("#ffffff"); mat.emissiveMap = sp; mat.emissiveIntensity = .35; mat.roughness = .5; mat.needsUpdate = true;
      out.push(new T.Mesh(skirtGeo(H, { yTop: .46, yBot: .09, rTop: .41, rBot: .55, rings: 12, seg: 128, pleats: 10, depth: .08, bow: 1 }), mat));
      const tm = new T.MeshStandardMaterial({ color: item.base2 || "#ffffff", transparent: true, opacity: .4, roughness: .4, side: T.DoubleSide, depthWrite: false, emissive: "#ffffff", emissiveMap: sp, emissiveIntensity: .35 });
      out.push(new T.Mesh(skirtGeo(H, { yTop: .44, yBot: .2, rTop: .43, rBot: .54, rings: 6, seg: 128, wave: 9, waveAmp: .035, bow: 1, phi0: -.9, phiLen: 1.8 }), tm));
      const bow = new T.Group(), bm = S(item.waist, .4); [-1, 1].forEach(s => { const c = new T.Mesh(new T.ConeGeometry(.06, .11, 4), bm); c.rotation.z = s * Math.PI / 2; c.position.x = s * .055; c.scale.z = .5; bow.add(c); });
      bow.add(new T.Mesh(new T.SphereGeometry(.03, 10, 8), bm)); bow.position.set(0, .43, .38); bow.rotation.x = -.2; H.mergeByMaterial(bow); out.push(bow);
      H.anim(t => { sp.offset.x = (t * .015) % 1; mat.emissiveIntensity = .3 + .15 * Math.sin(t * 2.4); }); break; }
    case "overalls": strapsAndBib(mat, S("#c99a3a", .3, { metalness: .6 })); break;
    case "snowpants": strapsAndBib(mat, S("#e6e9f0", .3, { metalness: .4 }), true); break;
    case "cargo": [-1, 1].forEach(s => { out.push(patch(H, (u, v) => H.bodyPt(s * (1.2 + u * .5), -.42 - v * .3, 1.075 + .025 * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.4 + .2))), 6, 5, mat));
      out.push(patch(H, (u, v) => H.bodyPt(s * (1.18 + u * .54), -.4 - v * .09, 1.11), 6, 1, mat)); }); break;
    case "flares": [-1, 1].forEach(s => { const m = new T.Mesh(new T.CylinderGeometry(.17, .24, .14, 32, 1, true), mat); m.position.set(s * .16, .07, .03); m.scale.z = 1.1; out.push(m); }); break;
    case "goldshine": mat.metalness = .45; mat.roughness = .3; mat.emissive = new T.Color("#5a3f00"); mat.emissiveIntensity = .6; mat.needsUpdate = true; break;
    case "icecrystal": mat.roughness = .25; mat.metalness = .15; mat.emissive = new T.Color("#5fc8ff"); mat.emissiveIntensity = .15; mat.needsUpdate = true; H.anim(t => { mat.emissiveIntensity = .12 + .1 * Math.sin(t * 1.7); }); break;
    case "nightsky": { const tx = mat.map; tx.wrapS = T.RepeatWrapping; tx.needsUpdate = true; mat.emissive = new T.Color("#ffffff"); mat.emissiveMap = tx; mat.emissiveIntensity = .25; mat.needsUpdate = true;
      H.anim(t => { tx.offset.x = (t * .02) % 1; }); break; }
    case "glowbolts": { const gt = H.canvasTex(512, 256, (x, w, h) => { x.fillStyle = "#000"; x.fillRect(0, 0, w, h); PP.glowbolts(x, w, h, { acc: "#ffffff" }); x.fillStyle = "#000"; x.fillRect(0, 0, w, 30); });
      mat.emissive = new T.Color(item.acc); mat.emissiveMap = gt; mat.emissiveIntensity = 1; mat.needsUpdate = true;
      H.anim(t => { mat.emissiveIntensity = .55 + .45 * Math.pow(Math.abs(Math.sin(t * 2.2 + 1)), 3) + (Math.sin(t * 11) > .97 ? .6 : 0); }); break; }
    case "glowpants": { const gt = H.canvasTex(512, 256, (x, w, h) => { x.fillStyle = "#000"; x.fillRect(0, 0, w, h); glowPantsArt(x, w, h, H, "#ffffff"); x.fillStyle = "#000"; x.fillRect(0, 0, w, 30); });
      mat.emissive = new T.Color("#7dffb0"); mat.emissiveMap = gt; mat.emissiveIntensity = .9; mat.needsUpdate = true; H.anim(t => { mat.emissiveIntensity = .7 + .3 * Math.sin(t * 1.6 + 2); }); break; }
  }
  return out.length ? out : null;
}
