/*
  The help center (/help): topics, guides with pictures from the game (numbered marks on the picture),
  and a search that understands English and Hebrew together: every guide is searched in both languages,
  with synonyms (SYN), Hebrew prefixes (ה ו ב ל מ ש כ), plurals, typos (one letter off) and word starts.
  Guides and pictures: help-data.js; pictures: /site/help/shots/<id>.jpg (taken from the real game).
*/
import { TOPICS, GUIDES, SYN, TRY } from "/site/help-data.js";
import "/site/guide-lang.js";

// where each mark sits on its picture, measured when the pictures were taken (help/shots/marks.json)
// the Hebrew pictures (help/shots/he/, taken from the game in Hebrew) have their own marks file
const [MARKS, MARKS_HE] = await Promise.all(["marks", "he/marks"].map((f) => fetch(`/site/help/shots/${f}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))));
const heShot = (id) => lang === "he" && !!MARKS_HE[id];
const shotSrc = (id) => `/site/help/shots/${heShot(id) ? "he/" : ""}${id}.jpg`;
const rectOf = (g, m) => (heShot(g.shot) ? (m.r ? (MARKS_HE["r:" + g.id] || [])[g.marks.indexOf(m)] || m.r : (MARKS_HE[g.shot] || [])[m.i]) : m.r || (MARKS[g.shot] || [])[m.i]) || null;

const $ = (id) => document.getElementById(id);
let lang = document.documentElement.lang === "he" ? "he" : "en";
const tx = (o) => (o == null ? "" : typeof o === "string" ? o : o[lang] ?? o.en ?? "");
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plain = (html) => String(html).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const topicOf = (id) => TOPICS.find((t) => t.id === id);
const marksOf = (g) => (g.marks || []).map((m) => ({ ...m, rect: rectOf(g, m) })).filter((m) => m.rect);

/* ---------- the words ---------- */
const STOP = new Set("a an the to of in on at is are i my me you your it do does can how what where why when and or for with be this that from by get".split(" ")
  .concat("של את על עם אני אתה את זה זו מה איך איפה למה מתי יש אין לא כן או גם רק כל אם הוא היא הם אנחנו לי לך שלי שלך".split(" ")));
function norm(s) {
  return String(s).toLowerCase().normalize("NFKD").replace(/[̀-֑ͯ-ׇ]/g, "")
    .replace(/[׳'`’"״]/g, "").replace(/ך/g, "כ").replace(/ם/g, "מ").replace(/ן/g, "נ").replace(/ף/g, "פ").replace(/ץ/g, "צ")
    .replace(/[^a-z0-9א-ת]+/g, " ").trim();
}
const isHe = (w) => /[א-ת]/.test(w);
// a word and its simpler forms: Hebrew without prefixes / plural, English without -s / -ing / -ed
function forms(w) {
  const out = new Set([w]);
  if (isHe(w)) {
    for (const p of ["וה", "שה", "כש", "לה", "מה", "בה", "וב", "ול", "ומ", "וש"]) if (w.length >= 5 && w.startsWith(p)) out.add(w.slice(2));
    if (w.length >= 4 && "הובלמשכ".includes(w[0])) out.add(w.slice(1));
    for (const x of [...out]) { if (x.length >= 5 && /(ימ|ות)$/.test(x)) out.add(x.slice(0, -2)); if (x.length >= 4 && /ה$/.test(x)) out.add(x.slice(0, -1)); }
  } else if (w.length > 3) {
    if (w.endsWith("ies")) out.add(w.slice(0, -3) + "y");
    if (w.endsWith("ing") && w.length > 5) out.add(w.slice(0, -3));
    if (w.endsWith("ed") && w.length > 4) out.add(w.slice(0, -2));
    if (w.endsWith("es") && w.length > 4) out.add(w.slice(0, -2));
    if (w.endsWith("s") && !w.endsWith("ss")) out.add(w.slice(0, -1));
  }
  return [...out];
}
const words = (s) => norm(s).split(" ").filter((w) => w.length >= 2 && !STOP.has(w));
// synonym groups, across the two languages
const SYN_OF = new Map();
SYN.forEach((g, i) => g.split("|").map((x) => x.trim()).filter(Boolean).forEach((x) => { for (const f of forms(norm(x))) { if (!SYN_OF.has(f)) SYN_OF.set(f, new Set()); SYN_OF.get(f).add(i); } }));
const SYN_WORDS = SYN.map((g) => g.split("|").flatMap((x) => words(x)));
function lev1(a, b, max) {   // edit distance up to max (small, fast)
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length; let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= n; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); best = Math.min(best, cur[j]); }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[n];
}

/* ---------- the index: every guide in both languages ---------- */
const INDEX = GUIDES.map((g) => {
  const terms = new Map();
  const add = (text, w) => { for (const word of words(text)) for (const f of forms(word)) terms.set(f, Math.max(terms.get(f) || 0, w)); };
  for (const L of ["en", "he"]) {
    add(g.q[L], 6);
    add(plain(g.a[L]), 1.2);
    (g.steps || []).forEach((s) => add(s[L === "en" ? 0 : 1], 1.6));
    (g.marks || []).forEach((m) => add(m[L], 2));
  }
  add(g.kw || "", 6);
  const t = topicOf(g.t); if (t) { add(t.en, 2); add(t.he, 2); }
  return { g, terms, list: [...terms.keys()] };
});

function search(query) {
  const qs = words(query);
  if (!qs.length) return [];
  const res = [];
  for (const it of INDEX) {
    let score = 0, hit = 0;
    for (const q of qs) {
      let best = 0;
      const qf = forms(q);
      for (const f of qf) {
        const w = it.terms.get(f); if (w) best = Math.max(best, w);
      }
      if (best < 6) for (const term of it.list) {   // a word start ("pas" → password), or one letter off
        const w = it.terms.get(term);
        for (const f of qf) {
          if (f.length >= 2 && term.startsWith(f)) best = Math.max(best, w * (f.length >= 4 ? 0.85 : 0.6));
          else if (f.length >= 4 && lev1(f, term, f.length >= 7 ? 2 : 1) <= (f.length >= 7 ? 2 : 1)) best = Math.max(best, w * 0.6);
        }
      }
      // the same thing in other words (or in the other language)
      const groups = new Set(); qf.forEach((f) => (SYN_OF.get(f) || []).forEach((i) => groups.add(i)));
      for (const i of groups) for (const sw of SYN_WORDS[i]) for (const f of forms(sw)) { const w = it.terms.get(f); if (w) best = Math.max(best, w * 0.75); }
      if (best > 0) { hit++; score += best; }
    }
    // two words that are one name ("jumpi chat" = jumpichat)
    for (let k = 0; k + 1 < qs.length; k++) { const w = it.terms.get(qs[k] + qs[k + 1]); if (w) score += w * 1.5; }
    if (hit && hit >= Math.ceil(qs.length * 0.5)) res.push({ g: it.g, score: score * (hit === qs.length ? 1.5 : 1) });
  }
  res.sort((a, b) => b.score - a.score);
  const top = res.length ? res[0].score : 0;
  return res.filter((r) => r.score >= top * 0.4).slice(0, 10);   // only the ones close to the best answer
}

/* ---------- drawing ---------- */
function figure(g, big) {
  const f = el("figure", "hp-fig" + (big ? " big" : ""));
  const img = el("img"); img.src = shotSrc(g.shot); img.alt = tx(g.alt || g.q); img.loading = "lazy"; img.width = 1280; img.height = 720;
  f.append(img);
  marksOf(g).forEach((m, i) => {
    const [x, y, w, h] = m.rect, pad = 0.006;
    const box = el("span", "hp-mark" + (m.round ? " round" : ""));
    box.style.left = (x - pad) * 100 + "%"; box.style.top = (y - pad * 1.7) * 100 + "%"; box.style.width = (w + pad * 2) * 100 + "%"; box.style.height = (h + pad * 3.4) * 100 + "%";
    const pin = el("b", "hp-pin", String(i + 1)); if (x > 0.85) pin.classList.add("in");
    box.append(pin); f.append(box);
  });
  return f;
}
function guideBody(g) {
  const box = el("div", "hp-g-body");
  box.append(el("div", "hp-a", tx(g.a)));
  if (g.steps && g.steps.length) {
    const ol = el("ol", "hp-steps");
    g.steps.forEach((s) => ol.append(el("li", null, lang === "he" ? s[1] : s[0])));
    box.append(ol);
  }
  if (g.shot) {
    const wrap = el("div", "hp-fig-wrap");
    const fig = figure(g); fig.tabIndex = 0; fig.setAttribute("role", "button");
    fig.setAttribute("aria-label", lang === "he" ? "הגדלת התמונה" : "Make the picture bigger");
    fig.onclick = () => zoom(g); fig.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); zoom(g); } };
    wrap.append(fig);
    if (marksOf(g).length) {
      const leg = el("ol", "hp-legend");
      marksOf(g).forEach((m) => leg.append(el("li", null, esc(tx(m)))));
      wrap.append(leg);
    }
    box.append(wrap);
  }
  if (g.also && g.also.length) {
    const p = el("p", "hp-also"); p.append(lang === "he" ? "קשור: " : "Related: ");
    g.also.forEach((id, i) => { const o = GUIDES.find((x) => x.id === id); if (!o) return; const a = el("a", null, esc(tx(o.q))); a.href = "#g-" + id; a.onclick = (e) => { e.preventDefault(); openGuide(id); }; if (i) p.append(" · "); p.append(a); });
    box.append(p);
  }
  const help = el("p", "hp-still");
  help.innerHTML = lang === "he" ? `עדיין לא מסתדר? <a href="/contact?lang=he">כתבו לנו</a> ונעזור.` : `Still stuck? <a href="/contact?lang=en">Write to us</a> and we'll help.`;
  box.append(help);
  return box;
}
function paintTopics() {
  const box = $("topics"); box.replaceChildren();
  for (const t of TOPICS) {
    const n = GUIDES.filter((g) => g.t === t.id).length;
    const a = el("a", "hp-topic"); a.href = "#t-" + t.id;
    a.style.setProperty("--c", t.c || "#1f9bff");
    const pic = el("span", "hp-topic-pic"); const img = el("img"); img.src = shotSrc(t.shot); img.alt = ""; img.loading = "lazy"; pic.append(img);
    if (t.pos) img.style.objectPosition = t.pos;
    a.append(pic, el("b", null, esc(tx(t))), el("small", null, lang === "he" ? `${n} מדריכים` : `${n} guides`));
    box.append(a);
  }
}
function paintGuides() {
  const box = $("guides"); box.replaceChildren();
  for (const t of TOPICS) {
    const sec = el("section", "gd-sec hp-sec"); sec.id = "t-" + t.id;
    sec.style.setProperty("--c", t.c || "#1f9bff");
    const head = el("div", "hp-sec-head"); head.append(el("h2", null, esc(tx(t)))); if (t.sub) head.append(el("p", null, esc(tx(t.sub))));
    sec.append(head);
    const list = el("div", "hp-list");
    for (const g of GUIDES.filter((x) => x.t === t.id)) {
      const d = el("details", "hp-g"); d.id = "g-" + g.id;
      const s = el("summary"); s.append(el("span", null, esc(tx(g.q))));
      d.append(s);
      d.addEventListener("toggle", () => { if (d.open && !d.querySelector(".hp-g-body")) d.append(guideBody(g)); if (d.open) history.replaceState(null, "", "#g-" + g.id); });
      list.append(d);
    }
    sec.append(list); box.append(sec);
  }
}
function openGuide(id) {
  const d = $("g-" + id); if (!d) return;
  d.open = true;
  setTimeout(() => { d.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); d.querySelector("summary").focus({ preventScroll: true }); }, 30);
}

/* ---------- search box ---------- */
let lastQ = "";
function runSearch() {
  const q = $("q").value.trim(); lastQ = q;
  $("qClear").hidden = !q;
  if (!q) { $("results").hidden = true; return; }
  const found = search(q);
  $("results").hidden = false;
  $("resTitle").textContent = found.length ? (lang === "he" ? `${found.length} תוצאות עבור "${q}"` : `${found.length} result${found.length === 1 ? "" : "s"} for "${q}"`) : (lang === "he" ? `אין תוצאות עבור "${q}"` : `No results for "${q}"`);
  $("resNone").hidden = !!found.length;
  $("resList").replaceChildren(...found.map(({ g }) => {
    const li = el("li"), a = el("a", "hp-res"); a.href = "#g-" + g.id;
    const t = topicOf(g.t);
    { const im = el("img"); im.src = shotSrc(g.shot || t.shot); im.alt = ""; im.loading = "lazy"; a.append(im); }
    const body = el("span", "hp-res-txt");
    body.append(el("small", null, esc(tx(t))), el("b", null, esc(tx(g.q))), el("span", null, esc(plain(tx(g.a)).slice(0, 150)) + "…"));
    a.append(body);
    a.onclick = (e) => { e.preventDefault(); openGuide(g.id); };
    li.append(a); return li;
  }));
  try { const u = new URL(location.href); u.searchParams.set("q", q); history.replaceState(null, "", u.pathname + u.search + location.hash); } catch (e) {}
}
let tmr = 0;
$("q").addEventListener("input", () => { clearTimeout(tmr); tmr = setTimeout(runSearch, 120); });
$("searchForm").addEventListener("submit", (e) => { e.preventDefault(); runSearch(); const first = $("resList").querySelector("a"); if (first) first.focus(); });
$("qClear").onclick = () => { $("q").value = ""; runSearch(); $("q").focus(); };
function paintTry() {
  $("q").placeholder = lang === "he" ? "למשל: איך מאמצים כלב?" : "For example: how do I adopt a pet?";
  const row = $("tryRow"); row.replaceChildren();
  TRY[lang].forEach((w) => { const b = el("button", null, esc(w)); b.type = "button"; b.onclick = () => { $("q").value = w; runSearch(); }; row.append(b); });
}

/* ---------- big picture ---------- */
function zoom(g) {
  const z = $("zoomIn"); z.replaceChildren(figure(g, true));
  if (marksOf(g).length) { const leg = el("ol", "hp-legend big"); marksOf(g).forEach((m) => leg.append(el("li", null, esc(tx(m))))); z.append(leg); }
  $("zoom").hidden = false; $("zoomX").focus();
}
const unzoom = () => { $("zoom").hidden = true; };
$("zoomX").onclick = unzoom;
$("zoom").addEventListener("click", (e) => { if (e.target === $("zoom")) unzoom(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("zoom").hidden) unzoom(); });

/* ---------- start, and language changes ---------- */
function paintAll() {
  const open = [...document.querySelectorAll(".hp-g[open]")].map((d) => d.id);
  paintTry(); paintTopics(); paintGuides();
  open.forEach((id) => { const d = $(id); if (d) d.open = true; });
  if (lastQ) runSearch();
}
addEventListener("gd:lang", (e) => { lang = e.detail; paintAll(); });
paintAll();
try { const q = new URLSearchParams(location.search).get("q"); if (q) { $("q").value = q; runSearch(); } } catch (e) {}
if (location.hash.startsWith("#g-")) openGuide(location.hash.slice(3));
else if (location.hash.startsWith("#t-")) setTimeout(() => $(location.hash.slice(1))?.scrollIntoView(), 50);
