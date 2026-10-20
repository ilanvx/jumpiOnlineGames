/* Jumpi Club puzzles: ?g=memory (find the pairs) or ?g=match3 (three in a row).
   Coin rounds like the arcade: the server keeps the board (routes/puzzles.js), the page only shows it.
   Start screen (how to play, play, leaderboard), the game, and the end screen with the leaderboard. */
const $ = (id) => document.getElementById(id);
const GAME = new URLSearchParams(location.search).get("g") === "match3" ? "match3" : "memory";
let lang = "en"; try { lang = localStorage.getItem("jumpi-lang") === "he" ? "he" : "en"; } catch (e) {}
document.documentElement.lang = lang; document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
const T = (en, he) => (lang === "he" ? he : en);
const num = (n) => Number(n || 0).toLocaleString(lang === "he" ? "he-IL" : "en-US");
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const emo = (n, cls = "") => { const i = el("img", cls); i.src = `/club/emoji/${n}.png`; i.alt = ""; i.draggable = false; return i; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (s) => "⁨" + s + "⁩";
async function api(p, body) {
  let res;
  try { res = await fetch(p, body === undefined ? { credentials: "same-origin" } : { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
  catch (e) { return { ok: false, status: 0, data: { error: T("Can't reach the server.", "אין חיבור לשרת.") } }; }
  let data = {}; try { data = await res.json(); } catch (e) {}
  return { ok: res.ok, status: res.status, data };
}
function toast(t) { const e = $("pzToast"); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (e.hidden = true), 2600); }
const tell = (m) => parent.postMessage(m, location.origin);

const INFO = {
  memory: { title: ["Memory Match", "משחק הזיכרון"], color: "#ff5fa8", dark: "#b0306f", hero: "jumpi_think",
    how: [["Flip two cards. Same picture? They're yours!", "הופכים שני קלפים. אותה תמונה? הם שלכם!"],
      ["Find all 10 pairs before the time runs out.", "מצאו את כל 10 הזוגות לפני שהזמן נגמר."],
      ["Fewer mistakes and a faster finish = more points.", "פחות טעויות וסיום מהיר = יותר נקודות."]] },
  match3: { title: ["Pet Match", "שלוש בשורה"], color: "#1fb6ff", dark: "#0b5fa8", hero: "pet_dragon",
    how: [["Swap two pets side by side to make a row of 3.", "מחליפים שתי חיות צמודות ויוצרים שורה של 3."],
      ["Rows of 4 or 5, and chains, give extra points.", "שורות של 4 או 5, ותגובות שרשרת, נותנות בונוס."],
      ["You have 25 moves. Make them count!", "יש לכם 25 מהלכים. תנצלו אותם!"]] },
};
const G = INFO[GAME];
document.documentElement.style.setProperty("--gc", G.color); document.documentElement.style.setProperty("--gd", G.dark);
$("pzTitle").textContent = T(...G.title);
$("pzBackT").textContent = T("Back", "חזרה");

/* ---------- sound (the same switch as the Club's toolbar) ---------- */
const soundOn = () => { try { return localStorage.getItem("jumpi-club-sound") !== "off"; } catch (e) { return true; } };
let ac = null;
function tone(f, d = .12, type = "triangle", v = .07, delay = 0) { if (!soundOn()) return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + delay; o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .02); } catch (e) {} }
const S = { flip: () => tone(520, .07, "sine", .05), yes: () => { tone(660); tone(990, .16, "triangle", .07, .09); }, no: () => tone(220, .2, "sawtooth", .04),
  pop: (c) => tone(440 * Math.pow(1.19, Math.min(c, 8)), .14, "triangle", .06), win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .2, "triangle", .07, i * .1)) };
const SND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>';
function paintSnd() { const on = soundOn(), b = $("pzSnd"); b.innerHTML = on ? SND_ON : SND_OFF; b.setAttribute("aria-pressed", on); b.title = on ? T("Sound on", "צלילים פועלים") : T("Sound off", "צלילים כבויים"); b.setAttribute("aria-label", b.title); }
$("pzSnd").onclick = () => { try { localStorage.setItem("jumpi-club-sound", soundOn() ? "off" : "on"); } catch (e) {} paintSnd(); };
addEventListener("storage", (e) => { if (e.key === "jumpi-club-sound") paintSnd(); });
paintSnd();

/* ---------- screens ---------- */
let R = null;          // the round being played
let best = 0;
$("pzBack").onclick = () => (R && !R.over ? finish() : tell({ jumpiArcade: "close" }));
addEventListener("keydown", (e) => { if (e.key === "Escape") $("pzBack").click(); });

function hud(items) {
  const h = $("pzHud"); h.textContent = ""; h.hidden = !items;
  (items || []).forEach(([k, v, id]) => { const s = el("span", "pz-chip"); s.append(el("small", "", k)); const b = el("b", "", v); if (id) b.id = id; s.append(b); h.append(s); });
}
function startScreen() {
  R = null; hud(null);
  const m = $("pzMain"); m.textContent = ""; m.className = "pz-main";
  const card = el("section", "pz-start");
  const pic = el("div", "pz-cover"); const im = el("img"); im.src = `/club/puzzle/${GAME}.webp`; im.alt = ""; pic.append(im); card.append(pic);
  const tx = el("div", "pz-intro");
  tx.append(el("h2", "", T(...G.title)));
  const ol = el("ol", "pz-how"); G.how.forEach((l, i) => { const li = el("li"); li.append(el("i", "", String(i + 1)), el("span", "", T(...l))); ol.append(li); }); tx.append(ol);
  if (best) tx.append(el("p", "pz-best", T("Your best: ", "השיא שלך: ") + num(best)));
  const btns = el("div", "pz-btns");
  const play = el("button", "pz-btn go", T("Play!", "לשחק!")); play.type = "button"; play.onclick = start;
  const lb = el("button", "pz-btn gold", "🏆 " + T("Leaderboard", "טבלת מובילים")); lb.type = "button"; lb.onclick = boardScreen;
  btns.append(play, lb); tx.append(btns); card.append(tx); m.append(card);
  play.focus();
}
async function boardScreen() {
  const m = $("pzMain"); m.textContent = ""; m.className = "pz-main";
  const wrap = el("div", "pz-end"); const b = await leaderboard(); wrap.append(b);
  const btns = el("div", "pz-btns"), back = el("button", "pz-btn ghost", T("Back", "חזרה")), play = el("button", "pz-btn go", T("Play!", "לשחק!"));
  back.type = play.type = "button"; back.onclick = startScreen; play.onclick = start; btns.append(back, play);
  const side = el("div", "pz-side"); side.append(btns); wrap.append(side); m.append(wrap);
}
// the 10 best single rounds (gold, silver, bronze), and my place
async function leaderboard() {
  const box = el("div", "arc-board"); box.append(el("h4", "", "🏆 " + T("Leaderboard", "טבלת מובילים")), el("small", "", T("The 10 best single rounds", "10 הסיבובים הכי טובים (בסיבוב אחד)")));
  const ol = el("ol"); box.append(ol);
  const r = await api("/api/club/leaders?game=" + GAME);
  if (!r.ok) { ol.append(el("li", "lb-none", r.data.error || T("Couldn't load it.", "לא הצלחנו לטעון."))); return box; }
  if (!r.data.top.length) ol.append(el("li", "lb-none", T("Nobody's here yet. Be the first!", "עוד אין פה אף אחד. היו הראשונים!")));
  r.data.top.forEach((p) => {
    const li = el("li", "lb-row r" + Math.min(p.rank, 4) + (p.me ? " me" : ""));
    const av = el("span", "lb-av"); const i = new Image(); i.alt = ""; i.decoding = "async"; i.onload = () => av.append(i); i.src = "/api/club/pic/" + encodeURIComponent(p.username);
    li.append(el("span", "lb-rank", String(p.rank)), av, el("b", "lb-name", iso(p.username)), el("span", "lb-score", num(p.score))); ol.append(li);
  });
  box.append(el("p", "lb-mine", r.data.mine > 0 ? T(`Your best: ${num(r.data.mine)} · place ${r.data.rank}`, `השיא שלך: ${num(r.data.mine)} · מקום ${r.data.rank}`) : T("Play a round to get on the board!", "שחקו סיבוב כדי להיכנס לטבלה!")));
  return box;
}

/* ---------- a round ---------- */
async function start() {
  const r = await api("/api/minigame/start", { game: GAME });
  if (r.status === 401) { tell({ jumpiArcade: "login" }); return; }
  if (!r.ok) { toast(r.data.error || T("Something went wrong.", "משהו השתבש.")); return; }
  best = r.data.best || best;
  R = { id: r.data.id, info: r.data, over: false, busy: false, score: 0 };
  const m = $("pzMain"); m.textContent = ""; m.className = "pz-main play";
  if (GAME === "memory") memory(m); else match3(m);
}
async function finish() {
  if (!R || R.over) return;
  R.over = true; clearInterval(R.tick);
  const r = await api("/api/minigame/finish", { id: R.id });
  const m = $("pzMain"); m.textContent = ""; m.className = "pz-main"; hud(null);
  const wrap = el("div", "pz-end"), card = el("section", "pz-result");
  if (!r.ok) { card.append(emo("jumpi_cry", "pz-emo"), el("h2", "", T("Oops!", "אופס!")), el("p", "", r.data.error || "")); }
  else {
    const d = r.data; best = d.best;
    if (Number.isFinite(d.total)) tell({ jumpiArcade: "coins", coins: d.total });
    card.append(emo(d.newBest ? "jumpi_party" : d.score > 0 ? "jumpi_love" : "jumpi_hi", "pz-emo"));
    card.append(el("h2", "", d.newBest ? T("New record!", "שיא חדש!") : d.score > 0 ? T("Well done!", "כל הכבוד!") : T("Good try!", "ניסיון יפה!")));
    const sc = el("div", "pz-score"); sc.append(el("small", "", T("Score", "ניקוד")), el("b", "", num(d.score))); card.append(sc);
    const coins = el("div", "pz-coins"); const ci = el("img"); ci.src = "/club/img/coin.png"; ci.alt = ""; coins.append(ci, el("b", "", "+" + num(d.coins))); card.append(coins);
    if (d.coins > 0) S.win();
  }
  const btns = el("div", "pz-btns"), again = el("button", "pz-btn go", T("Play again", "עוד סיבוב")), back = el("button", "pz-btn ghost", T("Back to the Club", "חזרה לקלאב"));
  again.type = back.type = "button"; again.onclick = start; back.onclick = () => tell({ jumpiArcade: "close" });
  btns.append(back, again); card.append(btns); wrap.append(card); m.append(wrap);
  wrap.append(await leaderboard());
  again.focus();
}

/* ---------- memory ---------- */
function memory(m) {
  const { cols, rows, secs } = R.info, n = cols * rows, pairsAll = n / 2;
  const t0 = Date.now(); let pairs = 0, misses = 0, first = null;
  const paint = () => hud([[T("Pairs", "זוגות"), `${pairs}/${pairsAll}`], [T("Mistakes", "טעויות"), String(misses)], [T("Time", "זמן"), "", "pzTime"]]);
  paint();
  const timeLeft = () => Math.max(0, Math.ceil(secs - (Date.now() - t0) / 1000));
  const showTime = () => { const t = timeLeft(), e = $("pzTime"); if (e) { e.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; e.classList.toggle("low", t <= 15); } if (!t) finish(); };
  R.tick = setInterval(showTime, 250); showTime();
  const grid = el("div", "mm-grid"); grid.style.setProperty("--cols", cols); grid.style.setProperty("--rows", rows);
  const cards = [];
  for (let i = 0; i < n; i++) {
    const c = el("button", "mm-card"); c.type = "button"; c.style.setProperty("--i", i); c.setAttribute("aria-label", T("Card", "קלף") + " " + (i + 1));
    const inner = el("span", "mm-in"), back = el("span", "mm-back"), face = el("span", "mm-face");
    back.append(emo("jumpi_star", "mm-logo")); inner.append(back, face); c.append(inner);
    c.onclick = () => flip(i); cards.push(c); grid.append(c);
  }
  m.append(grid);
  const show = (i, pic) => { const f = cards[i].querySelector(".mm-face"); f.textContent = ""; f.append(emo(pic)); cards[i].classList.add("up"); };
  const hide = (i) => cards[i].classList.remove("up");
  async function flip(i) {
    if (!R || R.over || R.busy || cards[i].classList.contains("up")) return;
    R.busy = true;
    const r = await api("/api/minigame/flip", { id: R.id, cell: i });
    if (!R || R.over) return;
    if (!r.ok) { R.busy = false; if (r.status === 404 || r.data.error === "Time's up!") finish(); else if (r.status !== 429) toast(r.data.error); return; }
    const d = r.data; show(i, d.pic); S.flip();
    if (d.other == null) { first = i; R.busy = false; return; }
    pairs = d.pairs; misses = d.misses; first = null;
    if (d.match) { await sleep(250); cards[i].classList.add("got"); cards[d.other].classList.add("got"); S.yes(); }
    else { await sleep(750); S.no(); hide(i); hide(d.other); await sleep(200); }
    paint(); showTime(); R.busy = false;
    if (d.done) { await sleep(500); finish(); }
  }
}

/* ---------- match 3 ---------- */
const PETS = [["pet_bunny", "#ffb3d6"], ["pet_panda", "#d9dde8"], ["pet_dragon", "#c6a8ff"], ["jumpi_blue", "#9fd8ff"], ["jumpi_coin", "#ffe07a"], ["pet_puppy", "#ffc98f"]];
function match3(m) {
  const { cols, rows } = R.info; let moves = R.info.moves, score = 0;
  const paint = () => hud([[T("Score", "ניקוד"), num(score)], [T("Moves", "מהלכים"), String(moves), "pzMoves"]]);
  paint();
  const box = el("div", "m3-board"); box.style.setProperty("--cols", cols); box.style.setProperty("--rows", rows);
  m.append(box);
  let tiles = new Array(cols * rows);   // cell -> element
  const place = (t, i) => { t.dataset.cell = i; t.style.setProperty("--x", i % cols); t.style.setProperty("--y", Math.floor(i / cols)); };
  const make = (k, i, fromY) => {
    const t = el("span", "m3-t"); t.dataset.k = k; t.style.setProperty("--bg", PETS[k][1]); t.append(emo(PETS[k][0]));
    if (fromY != null) { t.style.setProperty("--x", i % cols); t.style.setProperty("--y", fromY); t.classList.add("new"); box.append(t); t.getBoundingClientRect(); t.classList.remove("new"); }
    else box.append(t);
    place(t, i); return t;
  };
  const build = (b) => { box.querySelectorAll(".m3-t").forEach((t) => t.remove()); tiles = b.map((k, i) => make(k, i, Math.floor(i / cols) - rows)); };
  build(R.info.board);

  let sel = null;
  const select = (i) => { if (sel != null && tiles[sel]) tiles[sel].classList.remove("sel"); sel = i; if (i != null) tiles[i].classList.add("sel"); };
  const nextTo = (a, b) => Math.abs((a % cols) - (b % cols)) + Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) === 1;
  async function trySwap(a, b) {
    select(null);
    if (!R || R.over || R.busy || moves <= 0 || !nextTo(a, b)) return;
    R.busy = true;
    const ta = tiles[a], tb = tiles[b];
    place(ta, b); place(tb, a); tiles[a] = tb; tiles[b] = ta;   // looks swapped right away
    const r = await api("/api/minigame/swap", { id: R.id, a, b });
    if (!R || R.over) return;
    if (!r.ok) {
      await sleep(180); place(ta, a); place(tb, b); tiles[a] = ta; tiles[b] = tb;   // back again
      if (r.data.noMatch) { S.no(); ta.classList.add("no"); tb.classList.add("no"); setTimeout(() => { ta.classList.remove("no"); tb.classList.remove("no"); }, 400); }
      else if (r.status === 404) finish(); else if (r.status !== 429) toast(r.data.error);
      R.busy = false; return;
    }
    await sleep(200);
    for (const st of r.data.steps) await step(st);
    moves = r.data.moves; score = r.data.score; paint();
    if (r.data.shuffled) { toast(T("No moves left: new board!", "אין מהלכים: לוח חדש!")); await sleep(500); build(r.data.shuffled); await sleep(500); }
    R.busy = false;
    if (moves <= 0) { await sleep(600); finish(); }
  }
  async function step(st) {
    S.pop(st.chain);
    const gone = new Set(st.clear);
    for (const i of gone) tiles[i].classList.add("pop");
    floater("+" + num(st.add), st.clear, st.chain);
    await sleep(260);
    for (const i of gone) tiles[i].remove();
    const next = new Array(cols * rows);
    for (let x = 0; x < cols; x++) {
      const keep = [];
      for (let y = rows - 1; y >= 0; y--) { const i = y * cols + x; if (!gone.has(i)) keep.push(tiles[i]); }
      let k = 0;
      for (let y = rows - 1; y >= 0; y--, k++) {
        const i = y * cols + x, want = st.board[i];
        if (k < keep.length) { const t = keep[k]; if (+t.dataset.k !== want) { t.remove(); next[i] = make(want, i); } else { place(t, i); next[i] = t; } }
        else next[i] = make(want, i, -(k - keep.length) - 1);
      }
    }
    tiles = next;
    await sleep(300);
  }
  function floater(text, cells, chain) {
    let sx = 0, sy = 0; cells.forEach((i) => { sx += i % cols; sy += Math.floor(i / cols); });
    const f = el("span", "m3-pts" + (chain > 1 ? " chain" : ""), chain > 1 ? `${text} ×${chain}` : text);
    f.style.setProperty("--x", sx / cells.length); f.style.setProperty("--y", sy / cells.length); box.append(f); setTimeout(() => f.remove(), 900);
  }
  // tap one then a neighbour, or drag a pet onto its neighbour
  let down = null;
  box.addEventListener("pointerdown", (e) => { const t = e.target.closest(".m3-t"); if (!t || R.busy) return; down = { i: +t.dataset.cell, x: e.clientX, y: e.clientY, moved: false }; box.setPointerCapture?.(e.pointerId); });
  box.addEventListener("pointermove", (e) => {
    if (!down || down.moved) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y, w = box.clientWidth / cols * .35;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < w) return;
    down.moved = true; const i = down.i, x = i % cols, y = Math.floor(i / cols);
    let j = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? (x < cols - 1 ? i + 1 : -1) : (x > 0 ? i - 1 : -1)) : (dy > 0 ? (y < rows - 1 ? i + cols : -1) : (y > 0 ? i - cols : -1));
    if (j >= 0) trySwap(i, j);
  });
  box.addEventListener("pointerup", () => {
    if (!down) return; const { i, moved } = down; down = null; if (moved) return;
    if (sel == null) select(i); else if (sel === i) select(null); else if (nextTo(sel, i)) trySwap(sel, i); else select(i);
  });
  box.addEventListener("pointercancel", () => (down = null));
}

/* ---------- start ---------- */
(async () => {
  const r = await api("/api/auth/me");
  if (!r.ok || !r.data.user) { tell({ jumpiArcade: "login" }); return; }
  const s = await api("/api/minigame/status");
  if (s.ok && s.data.best) best = s.data.best[GAME] || 0;
  startScreen();
})();
