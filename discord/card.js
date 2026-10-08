/*
  The welcome card Pip posts in #welcome when someone agrees to the rules: the studio picture "welcomeCard"
  (discord/assets/welcome-card.png) + their Discord avatar in the ring + their name on the plate + "MEMBER #N".
  No packages: PNG is read and written here with Node's zlib, and the letters come from two pictures of
  letters made in the studio (assets/font-name.png / font-small.png + .json; `__studio.atlas(style)` in index.html).
  Names can be English or Hebrew; letters that aren't in the pictures (emoji…) are left out, and if too little
  is left, the Discord username (always a-z 0-9 _ .) is used instead.
*/
import { readFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "assets");

/* ---------- PNG ---------- */
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };

// any 8-bit PNG (grey, RGB, palette, grey+alpha, RGBA; palette also 1/2/4-bit), not interlaced → {w, h, data: RGBA}
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error("not a PNG");
  let p = 8, w, h, depth, type, interlace, plte = null, trns = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), kind = buf.toString("ascii", p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (kind === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; interlace = d[12]; }
    else if (kind === "PLTE") plte = d;
    else if (kind === "tRNS") trns = d;
    else if (kind === "IDAT") idat.push(d);
    else if (kind === "IEND") break;
    p += 12 + len;
  }
  if (interlace) throw new Error("interlaced PNG");
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!ch || (depth !== 8 && !(type === 3 && depth < 8)) || w * h > 4096 * 4096) throw new Error(`PNG type ${type}/${depth} not supported`);
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = Math.max(1, (ch * depth) >> 3), stride = Math.ceil((w * ch * depth) / 8);
  const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, row = y * stride, prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[row + x - bpp] : 0, b = y ? px[prev + x] : 0, c = x >= bpp && y ? px[prev + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[row + x] = v & 255;
    }
  }
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4, i = y * stride + x * ch;
    if (type === 6) { out[o] = px[i]; out[o + 1] = px[i + 1]; out[o + 2] = px[i + 2]; out[o + 3] = px[i + 3]; }
    else if (type === 2) { out[o] = px[i]; out[o + 1] = px[i + 1]; out[o + 2] = px[i + 2]; out[o + 3] = 255; }
    else if (type === 0) { out[o] = out[o + 1] = out[o + 2] = px[i]; out[o + 3] = 255; }
    else if (type === 4) { out[o] = out[o + 1] = out[o + 2] = px[i]; out[o + 3] = px[i + 1]; }
    else {
      const bit = x * depth, k = depth === 8 ? px[y * stride + x] : (px[y * stride + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
      out[o] = plte[k * 3]; out[o + 1] = plte[k * 3 + 1]; out[o + 2] = plte[k * 3 + 2]; out[o + 3] = trns && k < trns.length ? trns[k] : 255;
    }
  }
  return { w, h, data: out };
}

// RGB PNG (no transparency needed for the card); each row picks the filter that packs best
export function encodePng({ w, h, data }) {
  const raw = Buffer.alloc((w * 3 + 1) * h), row = Buffer.alloc(w * 3), prev = Buffer.alloc(w * 3), cand = [0, 1, 2, 4].map(() => Buffer.alloc(w * 3));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; row[x * 3] = data[i]; row[x * 3 + 1] = data[i + 1]; row[x * 3 + 2] = data[i + 2]; }
    let best = 0, bestSum = Infinity;
    [0, 1, 2, 4].forEach((f, n) => {
      const c = cand[n]; let sum = 0;
      for (let x = 0; x < row.length; x++) {
        const a = x >= 3 ? row[x - 3] : 0, b = y ? prev[x] : 0, cc = x >= 3 && y ? prev[x - 3] : 0;
        let v = row[x];
        if (f === 1) v -= a; else if (f === 2) v -= b;
        else if (f === 4) { const pp = a + b - cc, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - cc); v -= pa <= pb && pa <= pc ? a : pb <= pc ? b : cc; }
        c[x] = v & 255; sum += c[x] < 128 ? c[x] : 256 - c[x];
      }
      if (sum < bestSum) { bestSum = sum; best = n; }
    });
    raw[y * (w * 3 + 1)] = [0, 1, 2, 4][best];
    cand[best].copy(raw, y * (w * 3 + 1) + 1);
    row.copy(prev);
  }
  const chunk = (kind, d) => { const head = Buffer.alloc(8); head.writeUInt32BE(d.length); head.write(kind, 4, "ascii"); const tail = Buffer.alloc(4); tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), d]))); return Buffer.concat([head, d, tail]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------- drawing ---------- */
// premultiplied bilinear sample of an RGBA image at (x, y)
function sample(img, x, y, out) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  let r = 0, g = 0, b = 0, a = 0;
  for (const [dx, dy, wt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
    const X = x0 + dx, Y = y0 + dy;
    if (wt === 0 || X < 0 || Y < 0 || X >= img.w || Y >= img.h) continue;
    const i = (Y * img.w + X) * 4, al = (img.data[i + 3] / 255) * wt;
    r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al; a += al;
  }
  out[0] = r; out[1] = g; out[2] = b; out[3] = a;
}
// put src (premultiplied colour, alpha 0..1) over the destination pixel
function blend(dst, i, r, g, b, a) {
  if (a <= 0) return;
  dst.data[i] = Math.round(r + dst.data[i] * (1 - a));
  dst.data[i + 1] = Math.round(g + dst.data[i + 1] * (1 - a));
  dst.data[i + 2] = Math.round(b + dst.data[i + 2] * (1 - a));
}
// draw part of an image (sx, sy, sw, sh) scaled into (dx, dy, dw, dh); `mask(x, y)` → 0..1 optional
function drawImage(dst, img, sx, sy, sw, sh, dx, dy, dw, dh, mask) {
  const s = [0, 0, 0, 0], kx = sw / dw, ky = sh / dh;
  for (let y = Math.max(0, Math.floor(dy)); y < Math.min(dst.h, Math.ceil(dy + dh)); y++)
    for (let x = Math.max(0, Math.floor(dx)); x < Math.min(dst.w, Math.ceil(dx + dw)); x++) {
      const m = mask ? mask(x + .5, y + .5) : 1;
      if (m <= 0) continue;
      // average 2x2 points inside the pixel when shrinking a lot, so small letters stay smooth
      let r = 0, g = 0, b = 0, a = 0;
      for (const [ox, oy] of [[.25, .25], [.75, .25], [.25, .75], [.75, .75]]) {
        sample(img, sx + (x + ox - dx) * kx - .5, sy + (y + oy - dy) * ky - .5, s);
        r += s[0]; g += s[1]; b += s[2]; a += s[3];
      }
      blend(dst, (y * dst.w + x) * 4, (r / 4) * m, (g / 4) * m, (b / 4) * m, (a / 4) * m);
    }
}

/* ---------- letters ---------- */
const HE = /[א-ת]/;
// Hebrew runs right-to-left: visual order = runs reversed, Hebrew letters inside a run reversed
function visualOrder(text) {
  if (!HE.test(text)) return text;
  const runs = [];
  for (const ch of text) {
    const kind = HE.test(ch) ? "he" : /[A-Za-z0-9]/.test(ch) ? "lat" : "n";
    const last = runs[runs.length - 1];
    if (last && (last.kind === kind || kind === "n")) last.s += ch; else runs.push({ kind, s: ch });
  }
  return runs.reverse().map((r) => (r.kind === "lat" ? r.s : [...r.s].reverse().join(""))).join("");
}
function textWidth(font, text) { let w = 0; for (const ch of text) w += font.meta.glyphs[ch]?.adv || 0; return w; }
function drawText(dst, font, text, cx, baseY, scale) {
  let x = cx - (textWidth(font, text) * scale) / 2;
  const { pad, base } = font.meta;
  for (const ch of text) {
    const g = font.meta.glyphs[ch];
    if (!g) continue;
    if (ch !== " ") drawImage(dst, font.img, g.x, g.y, g.w, g.h, x - pad * scale, baseY - base * scale, g.w * scale, g.h * scale);
    x += g.adv * scale;
  }
}

/* ---------- assets ---------- */
let A = null;
function assets() {
  if (A) return A;
  const font = (n) => ({ img: decodePng(readFileSync(join(DIR, `font-${n}.png`))), meta: JSON.parse(readFileSync(join(DIR, `font-${n}.json`), "utf8")) });
  A = { bg: decodePng(readFileSync(join(DIR, "welcome-card.png"))), name: font("name"), small: font("small"), layout: JSON.parse(readFileSync(join(DIR, "layout.json"), "utf8")) };
  return A;
}

// the name to write: display name if the letters exist, else the username
export function cardName(displayName, username) {
  const { glyphs } = assets().name.meta;
  const tidy = (s) => [...String(s || "").normalize("NFC")].filter((ch) => glyphs[ch]).join("").replace(/\s+/g, " ").trim();
  const shown = tidy(displayName), orig = [...String(displayName || "").replace(/\s/g, "")].length;
  let name = shown && shown.replace(/\s/g, "").length >= Math.max(2, orig * .6) ? shown : tidy(username) || "Jumpi friend";
  if ([...name].length > 22) name = [...name].slice(0, 20).join("").trim() + "...";
  return name;
}

/**
 * welcomeCard({ displayName, username, avatar: PNG Buffer | null, number }) → PNG Buffer
 */
export function welcomeCard({ displayName, username, avatar, number }) {
  const { bg, name: big, small, layout: L } = assets();
  const card = { w: bg.w, h: bg.h, data: Buffer.from(bg.data) };
  const W = card.w, H = card.h;
  // the avatar, round
  if (avatar) {
    try {
      const img = decodePng(avatar), cx = W * L.ring.cx, cy = H * L.ring.cy, r = H * L.ring.r;
      drawImage(card, img, 0, 0, img.w, img.h, cx - r, cy - r, r * 2, r * 2, (x, y) => Math.max(0, Math.min(1, r - Math.hypot(x - cx, y - cy) + .5)));
    } catch (err) { console.warn("[discord] avatar:", err.message); }
  }
  // the name and the member number on the plate
  const p = L.plate, px0 = W * p.x0, px1 = W * p.x1, py0 = H * p.y0, py1 = H * p.y1, ph = py1 - py0, cx = (px0 + px1) / 2;
  const text = visualOrder(cardName(displayName, username));
  const scale = Math.min((ph * (HE.test(text) ? .4 : .48)) / (big.meta.size * .75), ((px1 - px0) * .86) / Math.max(1, textWidth(big, text)));
  const line2 = number ? `MEMBER #${Number(number).toLocaleString("en-US")}` : "";
  const nameBase = line2 ? py0 + ph * (HE.test(text) ? .5 : .55) : py0 + ph * .66;
  drawText(card, big, text, cx, nameBase, scale);
  if (line2) drawText(card, small, line2, cx, py0 + ph * .88, (ph * .2) / (small.meta.size * .72));
  return encodePng(card);
}
