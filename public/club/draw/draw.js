/* The Jumpi Club colouring book: colour a page (the lines stay on top) or draw on a blank page.
   Tools: brush, fill (stops at the lines), eraser, Jumpi stickers; sizes, colours, undo / redo, clear.
   Pictures are saved to my account (routes/drawings.js): only the paint is saved, the page's lines are drawn over it. */
import { PAGES } from "/club/draw/pages.js?v=2";
import { EMOJI } from "/shared/blogdoc.js";

const $ = (id) => document.getElementById(id);
const W = 1200, H = 840;   // the paper (the pages are drawn at 1000 x 700 and scaled)
let lang = "en"; try { lang = localStorage.getItem("jumpi-lang") === "he" ? "he" : "en"; } catch (e) {}
document.documentElement.lang = lang; document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
const TX = {
  en: { back: "Back", new: "New page", mine: "My pictures", save: "Save", brush: "Brush", fill: "Fill", eraser: "Eraser", stamp: "Stickers", undo: "Undo", redo: "Redo", clear: "Clear",
    pick: "Choose a page", close: "Close", saved: "Saved! It's in My pictures.", saving: "Saving…", noMine: "No pictures yet. Colour something and press Save!", del: "Delete",
    delAsk: "Delete this picture?", yes: "Yes", no: "No", clearAsk: "Start this page again?", leaveAsk: "Save your picture before you go?", saveGo: "Save", dontSave: "Don't save", stay: "Cancel",
    newAsk: "Save this picture first?", fail: "Something went wrong. Please try again.", login: "Log in to the Club to save your pictures.", custom: "Another colour" },
  he: { back: "חזרה", new: "דף חדש", mine: "הציורים שלי", save: "שמירה", brush: "מכחול", fill: "דלי צבע", eraser: "מחק", stamp: "מדבקות", undo: "ביטול", redo: "שוב", clear: "ניקוי",
    pick: "בחרו דף", close: "סגירה", saved: "נשמר! הציור נמצא ב'הציורים שלי'.", saving: "שומרים…", noMine: "עוד אין ציורים. צבעו משהו ולחצו 'שמירה'!", del: "מחיקה",
    delAsk: "למחוק את הציור הזה?", yes: "כן", no: "לא", clearAsk: "להתחיל את הדף מההתחלה?", leaveAsk: "לשמור את הציור לפני שיוצאים?", saveGo: "לשמור", dontSave: "לא לשמור", stay: "ביטול",
    newAsk: "לשמור קודם את הציור הזה?", fail: "משהו השתבש. נסו שוב.", login: "צריך להתחבר לקלאב כדי לשמור ציורים.", custom: "צבע אחר" },
};
const t = (k) => TX[lang][k] || k;
document.querySelectorAll("[data-t]").forEach((e) => (e.textContent = t(e.dataset.t)));

/* ---------- the canvases: paint (bottom), the page's lines, and one on top for the finger / mouse ---------- */
const paint = $("dwPaint"), lines = $("dwLines"), touch = $("dwTouch");
[paint, lines, touch].forEach((c) => { c.width = W; c.height = H; });
const P = paint.getContext("2d", { willReadFrequently: true }), Lc = lines.getContext("2d", { willReadFrequently: true });
let page = PAGES[1], drawingId = null, dirty = false, lineMask = null;
function white() { P.fillStyle = "#ffffff"; P.fillRect(0, 0, W, H); }
async function setPage(p, keepPaint = false) {
  page = p; $("dwTitle").textContent = lang === "he" ? p.he : p.en;
  Lc.clearRect(0, 0, W, H); lineMask = null;
  if (p.svg) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" width="${W}" height="${H}">${p.svg}</svg>`;
    const im = new Image(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await im.decode().catch(() => {}); Lc.drawImage(im, 0, 0, W, H);
    // the walls for the fill: where the lines are
    const d = Lc.getImageData(0, 0, W, H).data; lineMask = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) lineMask[i] = d[i * 4 + 3] > 90 ? 1 : 0;
  }
  if (!keepPaint) { white(); history.length = 0; future.length = 0; snap(); }
}

/* ---------- tools ---------- */
let tool = "brush", size = 2, color = "#ff4f8f", stamp = "jumpi_hi";
const SIZES = [6, 12, 22, 38, 60];
const COLORS = ["#1d1a24", "#ffffff", "#8a8fa8", "#ff3b3b", "#ff4f8f", "#ff9ec8", "#ff8a1c", "#ffb26b", "#ffd23a", "#fff27a", "#2fd36b", "#9be86b", "#17803a", "#1fb6ff", "#8fdcff",
  "#0d63c9", "#6a35f0", "#b79bff", "#9b5cff", "#7a4a1c", "#c27a3a", "#f6c4a0", "#5b3420", "#2a2f72"];
// the stickers' window opens with the Stickers tool (again to choose another) and closes when one is picked
document.querySelectorAll("[data-tool]").forEach((b) => b.onclick = () => { const again = tool === b.dataset.tool; tool = b.dataset.tool; document.querySelectorAll("[data-tool]").forEach((x) => x.setAttribute("aria-pressed", x === b));
  $("dwStamps").hidden = tool !== "stamp" || (again && !$("dwStamps").hidden); });
SIZES.forEach((s, i) => { const b = document.createElement("button"); b.type = "button"; b.className = "dw-size"; b.setAttribute("aria-pressed", i === size); b.title = String(s);
  const d = document.createElement("i"); d.style.width = d.style.height = Math.max(6, Math.round(s * .55)) + "px"; b.append(d);
  b.onclick = () => { size = i; document.querySelectorAll(".dw-size").forEach((x, j) => x.setAttribute("aria-pressed", j === i)); }; $("dwSizes").append(b); });
function paintColors() {
  const box = $("dwColors"); box.textContent = "";
  COLORS.forEach((c) => { const b = document.createElement("button"); b.type = "button"; b.className = "dw-c"; b.style.background = c; b.title = c; b.setAttribute("aria-pressed", c === color);
    b.onclick = () => { color = c; if (tool === "eraser" || tool === "stamp") document.querySelector('[data-tool="brush"]').click(); paintColors(); }; box.append(b); });
  const own = document.createElement("label"); own.className = "dw-c own"; own.title = t("custom"); const inp = document.createElement("input"); inp.type = "color"; inp.value = color;
  inp.oninput = () => { color = inp.value; paintColors(); }; own.append(inp); box.append(own);
}
paintColors();
// the stickers: Jumpi's own emojis
EMOJI.forEach((n) => { const b = document.createElement("button"); b.type = "button"; b.className = "dw-st" + (n === stamp ? " on" : ""); const im = new Image(); im.src = `/club/emoji/${n}.png`; im.alt = ""; b.append(im);
  b.onclick = () => { stamp = n; document.querySelectorAll(".dw-st").forEach((x) => x.classList.toggle("on", x === b)); $("dwStamps").hidden = true; document.querySelector('[data-tool="stamp"] img').src = im.src; }; $("dwStamps").append(b); });
const stampImgs = {};
const stampImg = (n) => stampImgs[n] || (stampImgs[n] = Object.assign(new Image(), { src: `/club/emoji/${n}.png` }));

/* ---------- undo / redo (pictures of the paint) ---------- */
const history = [], future = [];
function snap() { history.push(P.getImageData(0, 0, W, H)); if (history.length > 14) history.shift(); future.length = 0; paintUndo(); }
function paintUndo() { $("dwUndo").disabled = history.length < 2; $("dwRedo").disabled = !future.length; }
$("dwUndo").onclick = () => { if (history.length < 2) return; future.push(history.pop()); P.putImageData(history[history.length - 1], 0, 0); dirty = true; paintUndo(); };
$("dwRedo").onclick = () => { if (!future.length) return; const d = future.pop(); history.push(d); P.putImageData(d, 0, 0); dirty = true; paintUndo(); };
$("dwClear").onclick = () => ask(t("clearAsk"), [[t("yes"), () => { white(); snap(); dirty = true; }, "go"], [t("no"), null]]);

/* ---------- drawing with the finger / mouse ---------- */
const at = (e) => { const r = touch.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
let down = null;
touch.addEventListener("pointerdown", (e) => {
  e.preventDefault(); touch.setPointerCapture(e.pointerId); const [x, y] = at(e);
  if (tool === "fill") { fill(Math.round(x), Math.round(y), color); snap(); dirty = true; return; }
  if (tool === "stamp") { const im = stampImg(stamp), s = SIZES[size] * 3 + 90; const go = () => { P.drawImage(im, x - s / 2, y - s / 2, s, s); snap(); dirty = true; }; im.complete ? go() : (im.onload = go); return; }
  down = { x, y }; dot(x, y);
});
touch.addEventListener("pointermove", (e) => { if (!down) return; const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; for (const ev of evs) { const [x, y] = at(ev); seg(down.x, down.y, x, y); down = { x, y }; } });
const up = () => { if (!down) return; down = null; snap(); dirty = true; };
touch.addEventListener("pointerup", up); touch.addEventListener("pointercancel", up);
function brush() { P.strokeStyle = P.fillStyle = tool === "eraser" ? "#ffffff" : color; P.lineWidth = SIZES[size] * (tool === "eraser" ? 1.6 : 1); P.lineCap = P.lineJoin = "round"; }
function dot(x, y) { brush(); P.beginPath(); P.arc(x, y, P.lineWidth / 2, 0, Math.PI * 2); P.fill(); }
function seg(a, b, c, d) { brush(); P.beginPath(); P.moveTo(a, b); P.lineTo(c, d); P.stroke(); }

/* ---------- fill: the area around the tap, up to the page's lines (and up to other colours) ---------- */
function fill(x, y, hex) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const img = P.getImageData(0, 0, W, H), d = img.data, i0 = (y * W + x) * 4;
  const n = parseInt(hex.slice(1), 16), R = n >> 16, G = (n >> 8) & 255, B = n & 255;
  const r0 = d[i0], g0 = d[i0 + 1], b0 = d[i0 + 2];
  if (lineMask && lineMask[y * W + x]) return;
  if (Math.abs(r0 - R) + Math.abs(g0 - G) + Math.abs(b0 - B) < 8) return;
  const TOL = 90, same = (p) => Math.abs(d[p] - r0) + Math.abs(d[p + 1] - g0) + Math.abs(d[p + 2] - b0) <= TOL;
  const seen = new Uint8Array(W * H), stack = [x, y];
  while (stack.length) {
    const sy = stack.pop(), sx0 = stack.pop(); let sx = sx0;
    let k = sy * W + sx; while (sx >= 0 && !seen[k] && !(lineMask && lineMask[k]) && same(k * 4)) { sx--; k--; } sx++; k++;
    let upOpen = false, dnOpen = false;
    while (sx < W && !seen[k] && !(lineMask && lineMask[k]) && same(k * 4)) {
      seen[k] = 1; const p = k * 4; d[p] = R; d[p + 1] = G; d[p + 2] = B; d[p + 3] = 255;
      if (sy > 0) { const u = k - W, ok = !seen[u] && !(lineMask && lineMask[u]) && same(u * 4); if (ok && !upOpen) { stack.push(sx, sy - 1); upOpen = true; } else if (!ok) upOpen = false; }
      if (sy < H - 1) { const v = k + W, ok = !seen[v] && !(lineMask && lineMask[v]) && same(v * 4); if (ok && !dnOpen) { stack.push(sx, sy + 1); dnOpen = true; } else if (!ok) dnOpen = false; }
      sx++; k++;
    }
  }
  // the thin edge under the lines takes the colour too (no white rim along the lines)
  if (lineMask) for (let pass = 0; pass < 2; pass++) for (let q = W; q < W * H - W; q++) if (lineMask[q] && !seen[q] && (seen[q - 1] || seen[q + 1] || seen[q - W] || seen[q + W])) { seen[q] = 2; const p = q * 4; d[p] = R; d[p + 1] = G; d[p + 2] = B; }
  P.putImageData(img, 0, 0);
}

/* ---------- saving, my pictures, pages ---------- */
function toast(s) { const e = $("dwToast"); e.textContent = s; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (e.hidden = true), 2600); }
async function save() {
  toast(t("saving"));
  const blob = await new Promise((ok) => paint.toBlob(ok, "image/png"));
  const q = `?page=${encodeURIComponent(page.id)}` + (drawingId ? `&id=${drawingId}` : "");
  let r, data = {}; try { r = await fetch("/api/club/drawings" + q, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "image/png" }, body: blob }); data = await r.json().catch(() => ({})); } catch (e) {}
  if (!r || !r.ok) { toast(r && r.status === 401 ? t("login") : data.error || t("fail")); return false; }
  drawingId = data.drawing.id; dirty = false; toast(t("saved")); return true;
}
$("dwSave").onclick = save;
function ask(text, buttons) {
  $("askT").textContent = text; const box = $("askBtns"); box.textContent = "";
  buttons.forEach(([label, fn, cls]) => { const b = document.createElement("button"); b.type = "button"; b.className = "dw-b " + (cls || ""); b.textContent = label; b.onclick = () => { $("mAsk").hidden = true; if (fn) fn(); }; box.append(b); });
  $("mAsk").hidden = false;
}
const unsaved = (then) => (dirty ? ask(t("newAsk"), [[t("saveGo"), async () => { if (await save()) then(); }, "go"], [t("dontSave"), then], [t("stay"), null]]) : then());
const pageThumb = (p) => `<svg viewBox="0 0 1000 700" aria-hidden="true">${p.svg}</svg>`;
$("dwPages").onclick = () => {
  const g = $("pageGrid"); g.textContent = "";
  PAGES.forEach((p) => { const b = document.createElement("button"); b.type = "button"; b.className = "dw-card"; b.innerHTML = `<span class="pv">${pageThumb(p)}</span>`; const s = document.createElement("b"); s.textContent = lang === "he" ? p.he : p.en; b.append(s);
    b.onclick = () => { $("mPages").hidden = true; unsaved(() => { drawingId = null; dirty = false; setPage(p); }); }; g.append(b); });
  $("mPages").hidden = false;
};
$("dwMine").onclick = async () => {
  const g = $("mineGrid"); g.textContent = ""; $("mMine").hidden = false;
  let list = []; try { const r = await fetch("/api/club/drawings", { credentials: "same-origin" }); if (r.status === 401) { g.textContent = t("login"); return; } list = (await r.json()).drawings || []; } catch (e) {}
  if (!list.length) { const p = document.createElement("p"); p.className = "dw-none"; p.textContent = t("noMine"); g.append(p); return; }
  list.forEach((d) => { const p = PAGES.find((x) => x.id === d.page) || PAGES[0];
    const card = document.createElement("div"); card.className = "dw-card mine";
    const b = document.createElement("button"); b.type = "button"; b.className = "pv"; b.innerHTML = `<img alt="" src="/api/club/drawings/${d.id}.png?t=${d.updatedAt}">${pageThumb(p)}`;
    b.onclick = () => { $("mMine").hidden = true; unsaved(() => openDrawing(d, p)); };
    const s = document.createElement("small"); s.textContent = new Date(d.updatedAt).toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { day: "numeric", month: "short" });
    const del = document.createElement("button"); del.type = "button"; del.className = "dw-del"; del.textContent = t("del");
    del.onclick = () => ask(t("delAsk"), [[t("yes"), async () => { await fetch(`/api/club/drawings/${d.id}/delete`, { method: "POST", credentials: "same-origin" }).catch(() => {}); if (drawingId === d.id) drawingId = null; $("dwMine").onclick(); }, "danger"], [t("no"), null]]);
    card.append(b, s, del); g.append(card); });
};
async function openDrawing(d, p) {
  await setPage(p, true);
  const im = new Image(); im.src = `/api/club/drawings/${d.id}.png?t=${d.updatedAt}`; await im.decode().catch(() => {});
  white(); P.drawImage(im, 0, 0, W, H); history.length = 0; future.length = 0; snap(); drawingId = d.id; dirty = false;
}
document.querySelectorAll(".dw-modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("[data-close]")) m.hidden = true; }));

/* ---------- leaving: back to the Club (ask to save first) ---------- */
const leave = () => parent.postMessage({ jumpiArcade: "close" }, location.origin);
$("dwBack").onclick = () => (dirty ? ask(t("leaveAsk"), [[t("saveGo"), async () => { if (await save()) leave(); }, "go"], [t("dontSave"), leave], [t("stay"), null]]) : leave());
addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); (e.shiftKey ? $("dwRedo") : $("dwUndo")).click(); } });

setPage(PAGES[1]);
