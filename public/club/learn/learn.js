/* Jumpi Club learning games (just for fun, no coins): ?m=math (sums), ?m=he (Hebrew), ?m=en (English).
   Every round is 10 questions with 4 big answers; a word can be read out loud (the browser's own voice). */
const $ = (id) => document.getElementById(id);
const MODE = ["math", "he", "en"].includes(new URLSearchParams(location.search).get("m")) ? new URLSearchParams(location.search).get("m") : "math";
let lang = "en"; try { lang = localStorage.getItem("jumpi-lang") === "he" ? "he" : "en"; } catch (e) {}
document.documentElement.lang = lang; document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
const he = lang === "he";
const T = (en, hebrew) => (he ? hebrew : en);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const rnd = (n) => Math.floor(Math.random() * n), pick = (a) => a[rnd(a.length)];
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const emo = (n) => { const i = el("img", "ln-emo"); i.src = `/club/emoji/${n}.png`; i.alt = ""; return i; };

/* ---------- the words (a picture each) ---------- */
const WORDS = [
  ["🐶", "dog", "כלב"], ["🐱", "cat", "חתול"], ["🐟", "fish", "דג"], ["🐦", "bird", "ציפור"], ["🐴", "horse", "סוס"], ["🐮", "cow", "פרה"], ["🐰", "rabbit", "ארנב"], ["🐻", "bear", "דוב"],
  ["🦁", "lion", "אריה"], ["🐘", "elephant", "פיל"], ["🐒", "monkey", "קוף"], ["🐸", "frog", "צפרדע"], ["🐢", "turtle", "צב"], ["🦋", "butterfly", "פרפר"], ["🐝", "bee", "דבורה"], ["🐍", "snake", "נחש"],
  ["🍎", "apple", "תפוח"], ["🍌", "banana", "בננה"], ["🍇", "grapes", "ענבים"], ["🍓", "strawberry", "תות"], ["🍉", "watermelon", "אבטיח"], ["🥕", "carrot", "גזר"], ["🍞", "bread", "לחם"], ["🧀", "cheese", "גבינה"],
  ["🥚", "egg", "ביצה"], ["🍕", "pizza", "פיצה"], ["🍦", "ice cream", "גלידה"], ["🥛", "milk", "חלב"], ["🏠", "house", "בית"], ["🚗", "car", "מכונית"], ["🚌", "bus", "אוטובוס"], ["✈️", "plane", "מטוס"],
  ["🚲", "bike", "אופניים"], ["⚽", "ball", "כדור"], ["📚", "books", "ספרים"], ["✏️", "pencil", "עיפרון"], ["⏰", "clock", "שעון"], ["🔑", "key", "מפתח"], ["☀️", "sun", "שמש"], ["🌙", "moon", "ירח"],
  ["⭐", "star", "כוכב"], ["🌳", "tree", "עץ"], ["🌸", "flower", "פרח"], ["🌧️", "rain", "גשם"], ["🔥", "fire", "אש"], ["💧", "water", "מים"], ["👟", "shoe", "נעל"], ["👕", "shirt", "חולצה"],
  ["🎩", "hat", "כובע"], ["👁️", "eye", "עין"], ["👂", "ear", "אוזן"], ["👃", "nose", "אף"], ["✋", "hand", "יד"], ["❤️", "heart", "לב"], ["🎂", "cake", "עוגה"], ["🎁", "gift", "מתנה"],
];
// the letters' names as kids say them in Israel (with nikud, so they're read out right too)
const HE_LETTERS = [["א", "אָלֶף"], ["ב", "בֵּית"], ["ג", "גִּימֶל"], ["ד", "דָּלֶת"], ["ה", "הֵי"], ["ו", "וָו"], ["ז", "זַיִן"], ["ח", "חֵית"], ["ט", "טֵית"], ["י", "יוּד"], ["כ", "כַּף"], ["ל", "לָמֶד"], ["מ", "מֵם"], ["נ", "נוּן"],
  ["ס", "סָמֶךְ"], ["ע", "עַיִן"], ["פ", "פֵּא"], ["צ", "צָדִיק"], ["ק", "קוּף"], ["ר", "רֵישׁ"], ["ש", "שִׁין"], ["ת", "תָּו"]];
const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const COLORS_EN = [["red", "אדום", "#ff3b3b"], ["blue", "כחול", "#1f7fff"], ["green", "ירוק", "#2fd36b"], ["yellow", "צהוב", "#ffd23a"], ["orange", "כתום", "#ff8a1c"], ["purple", "סגול", "#9b5cff"], ["pink", "ורוד", "#ff6fb4"],
  ["black", "שחור", "#1d1a24"], ["white", "לבן", "#ffffff"], ["brown", "חום", "#8a5a2c"], ["gray", "אפור", "#8a8fa8"]];
const NUM_EN = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"], NUM_HE = ["אפס", "אחת", "שתיים", "שלוש", "ארבע", "חמש", "שש", "שבע", "שמונה", "תשע", "עשר"];
const firstHe = (w) => w[0];   // a Hebrew word's first letter (as written)

/* ---------- reading out loud ---------- */
const soundOn = () => { try { return localStorage.getItem("jumpi-club-sound") !== "off"; } catch (e) { return true; } };
function say(text, l) { if (!soundOn()) return; try { if (!("speechSynthesis" in window)) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = l === "he" ? "he-IL" : "en-US"; u.rate = .85; speechSynthesis.speak(u); } catch (e) {} }
const canSay = "speechSynthesis" in window;

/* ---------- sounds ---------- */
let ac = null;
function tone(f, d = .12, type = "triangle", v = .07) { if (!soundOn()) return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .02); } catch (e) {} }
const yay = () => { tone(660); setTimeout(() => tone(880), 90); setTimeout(() => tone(1175, .18), 180); }, nope = () => tone(200, .25, "sawtooth", .05);

/* ---------- the games and their kinds ---------- */
const GAMES = {
  math: { title: ["Math Challenge", "תרגילי חשבון"], emoji: "jumpi_think", kinds: [
    ["add", ["Plus", "חיבור"], "➕"], ["sub", ["Minus", "חיסור"], "➖"], ["mul", ["Times", "כפל"], "✖️"], ["div", ["Divide", "חילוק"], "➗"], ["mix", ["Everything", "הכול ביחד"], "🎲"]], levels: true },
  he: { title: ["Learn Hebrew", "לומדים עברית"], emoji: "jumpi_hi", kinds: [
    ["letters", ["Letters", "אותיות"], "א"], ["words", ["Words", "מילים"], "🐶"], ["first", ["First letter", "האות הראשונה"], "🍎"], ["colors", ["Colours", "צבעים"], "🎨"], ["numbers", ["Numbers", "מספרים"], "🔢"]] },
  en: { title: ["Learn English", "לומדים אנגלית"], emoji: "jumpi_cool", kinds: [
    ["abc", ["ABC", "ABC"], "🔤"], ["words", ["Words", "מילים"], "🐱"], ["first", ["First letter", "האות הראשונה"], "🍌"], ["colors", ["Colours", "צבעים"], "🎨"], ["numbers", ["Numbers", "מספרים"], "🔢"]] },
};
const G = GAMES[MODE];
$("lnTitle").textContent = T(...G.title);
$("lnBackT").textContent = T("Back", "חזרה");
// the sound switch (also in the Club's toolbar: the same setting)
const SND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>';
function paintSnd() { const on = soundOn(), b = $("lnSnd"); b.innerHTML = on ? SND_ON : SND_OFF; b.setAttribute("aria-pressed", on); b.title = on ? T("Sound on", "צלילים פועלים") : T("Sound off", "צלילים כבויים"); b.setAttribute("aria-label", b.title); }
$("lnSnd").onclick = () => { try { localStorage.setItem("jumpi-club-sound", soundOn() ? "off" : "on"); } catch (e) {} if (!soundOn()) try { speechSynthesis.cancel(); } catch (e) {} paintSnd(); };
addEventListener("storage", (e) => { if (e.key === "jumpi-club-sound") paintSnd(); });
paintSnd();
$("lnBack").onclick = () => (R && R.i < R.n && R.i > 0 ? menu() : parent.postMessage({ jumpiArcade: "close" }, location.origin));

/* one question: { ask: node or text, big?: true, choices: [{label, ok}], speak?: [text, lang] } */
function makeQ(kind, level) {
  const four = (right, pool, show = (x) => x) => shuffle([right, ...shuffle(pool.filter((x) => x !== right)).slice(0, 3)]).map((x) => ({ label: show(x), ok: x === right }));
  if (MODE === "math") {
    const op = kind === "mix" ? pick(level < 1 ? ["add", "sub"] : ["add", "sub", "mul", "div"]) : kind;
    const top = [10, 20, 100][level], tt = [5, 10, 12][level];
    let a, b, ans, sign;
    if (op === "add") { a = rnd(top) + 1; b = rnd(top - a + 1); ans = a + b; sign = "+"; }
    else if (op === "sub") { a = rnd(top) + 1; b = rnd(a + 1); ans = a - b; sign = "−"; }
    else if (op === "mul") { a = rnd(tt) + 1; b = rnd(tt) + 1; ans = a * b; sign = "×"; }
    else { b = rnd(tt) + 1; ans = rnd(tt) + 1; a = b * ans; sign = "÷"; }
    const near = new Set([ans]); while (near.size < 4) { const d = ans + (rnd(2) ? 1 : -1) * (rnd(Math.max(3, Math.round(ans * .3) + 2)) + 1); if (d >= 0) near.add(d); }
    return { ask: `${a} ${sign} ${b} = ?`, big: true, choices: shuffle([...near]).map((x) => ({ label: String(x), ok: x === ans })) };
  }
  const L = MODE;   // the language being learned
  if (kind === "letters") { const [ch, name] = pick(HE_LETTERS); return { ask: ch, big: true, prompt: T("What's this letter called?", "איך קוראים לאות הזאת?"), choices: four(name, HE_LETTERS.map((x) => x[1])), speak: [name, "he"] }; }
  if (kind === "abc") { const up = pick(ABC), flip = rnd(2); return flip ? { ask: up, big: true, prompt: T("Find the small letter", "מצאו את האות הקטנה"), choices: four(up.toLowerCase(), ABC.map((x) => x.toLowerCase())), speak: [up, "en"] }
    : { ask: up.toLowerCase(), big: true, prompt: T("Find the big letter", "מצאו את האות הגדולה"), choices: four(up, ABC), speak: [up, "en"] }; }
  if (kind === "words") { const w = pick(WORDS), idx = L === "he" ? 2 : 1; return { ask: w[0], pic: true, prompt: T("What is it?", "מה זה?"), choices: four(w[idx], WORDS.map((x) => x[idx])), speak: [w[idx], L] }; }
  if (kind === "first") { const w = pick(WORDS.filter((x) => (L === "he" ? true : /^[a-z]/.test(x[1])))), word = L === "he" ? w[2] : w[1], f = L === "he" ? firstHe(word) : word[0].toUpperCase();
    const pool = L === "he" ? HE_LETTERS.map((x) => x[0]) : ABC; return { ask: w[0], pic: true, prompt: T("Which letter does it start with?", "באיזו אות זה מתחיל?"), choices: four(f, pool), speak: [word, L], show: word }; }
  if (kind === "colors") { const c = pick(COLORS_EN), idx = L === "he" ? 1 : 0; return { ask: c[2], swatch: true, prompt: T("What colour is it?", "איזה צבע זה?"), choices: four(c[idx], COLORS_EN.map((x) => x[idx])), speak: [c[idx], L] }; }
  if (kind === "numbers") { const n = rnd(10) + 1, names = L === "he" ? NUM_HE : NUM_EN; return { ask: String(n), big: true, count: n, prompt: T("How do you say this number?", "איך אומרים את המספר הזה?"), choices: four(names[n], names.slice(1)), speak: [names[n], L] }; }
}

/* ---------- screens ---------- */
let R = null, level = 0;
function menu() {
  R = null; $("lnScore").hidden = true; const m = $("lnMain"); m.textContent = "";
  const hero = el("div", "ln-hero"); hero.append(emo(G.emoji)); const h = el("div"); h.append(el("h2", "", T(...G.title)), el("p", "", MODE === "math" ? T("Pick a kind of sum and a level!", "בחרו סוג תרגיל ורמה!") : T("Pick what to practise!", "בחרו מה מתרגלים!"))); hero.append(h); m.append(hero);
  if (G.levels) { const lv = el("div", "ln-levels"); [["Easy", "קל"], ["Medium", "בינוני"], ["Hard", "קשה"]].forEach((n, i) => { const b = el("button", "ln-lv", T(...n)); b.type = "button"; b.setAttribute("aria-pressed", i === level);
    b.onclick = () => { level = i; lv.querySelectorAll("button").forEach((x, j) => x.setAttribute("aria-pressed", j === i)); }; lv.append(b); }); m.append(lv); }
  const grid = el("div", "ln-kinds");
  G.kinds.forEach(([k, name, ic], i) => { const b = el("button", "ln-kind"); b.type = "button"; b.style.setProperty("--i", i); b.append(el("span", "ic", ic), el("b", "", T(...name)));
    const best = (() => { try { return +localStorage.getItem(`jumpi-learn:${MODE}:${k}${G.levels ? ":" + level : ""}`) || 0; } catch (e) { return 0; } })();
    if (best) b.append(el("small", "", "★ " + best + "/10")); b.onclick = () => start(k); grid.append(b); });
  m.append(grid);
}
function start(kind) { R = { kind, i: 0, n: 10, right: 0, streak: 0 }; next(); }
function next() {
  const m = $("lnMain"); m.textContent = "";
  if (R.i >= R.n) return done();
  const q = makeQ(R.kind, level); R.q = q;
  $("lnScore").hidden = false; $("lnScore").textContent = `${R.i + 1}/${R.n} · ★ ${R.right}`;
  const bar = el("div", "ln-bar"); const fill = el("i"); fill.style.width = (R.i / R.n * 100) + "%"; bar.append(fill); m.append(bar);
  const card = el("div", "ln-q");
  if (q.prompt) card.append(el("p", "ln-prompt", q.prompt));
  const ask = el("div", "ln-ask" + (q.big ? " big" : "") + (q.pic ? " pic" : ""));
  if (q.swatch) { const s = el("span", "ln-swatch"); s.style.background = q.ask; ask.append(s); } else ask.textContent = q.ask;
  ask.dir = MODE === "math" ? "ltr" : "auto";   // a sum always reads left to right
  card.append(ask);
  if (q.count) { const dots = el("div", "ln-dots"); for (let k = 0; k < q.count; k++) dots.append(el("span", "", "⭐")); card.append(dots); }
  m.append(card);
  const ch = el("div", "ln-choices" + (q.choices.some((c) => c.label.length > 9) ? " wide" : ""));
  q.choices.forEach((c) => { const b = el("button", "ln-c", c.label); b.type = "button"; b.dir = "auto"; b.onclick = () => answer(b, c, ch); ch.append(b); });
  m.append(ch);
}
function answer(b, c, box) {
  if (box.dataset.done) return; box.dataset.done = "1";
  const q = R.q; box.querySelectorAll("button").forEach((x, k) => { if (q.choices[k].ok) x.classList.add("right"); x.disabled = true; });
  if (c.ok) { R.right++; R.streak++; b.classList.add("right"); yay(); pop(R.streak >= 3 ? "jumpi_party" : pick(["jumpi_love", "jumpi_cool", "jumpi_wink", "jumpi_star"])); }
  else { R.streak = 0; b.classList.add("wrong"); nope(); }
  if (q.speak && canSay) setTimeout(() => say(q.speak[0], q.speak[1]), 250);
  const nx = el("button", "ln-next", R.i + 1 >= R.n ? T("See my score", "לתוצאה") : T("Next", "הבא")); nx.type = "button";
  const row = el("div", "ln-after");
  if (q.speak && canSay) { const s = el("button", "ln-say", "🔊 " + (q.show || q.speak[0])); s.type = "button"; s.dir = "auto"; s.onclick = () => say(q.speak[0], q.speak[1]); row.append(s); }
  nx.onclick = () => { R.i++; next(); }; row.append(nx); $("lnMain").append(row); nx.focus();
}
function pop(name) { const p = emo(name); p.className = "ln-pop"; document.body.append(p); setTimeout(() => p.remove(), 1100); }
function done() {
  const m = $("lnMain"); m.textContent = ""; $("lnScore").hidden = true;
  const stars = R.right >= 10 ? 3 : R.right >= 8 ? 2 : R.right >= 5 ? 1 : 0;
  const key = `jumpi-learn:${MODE}:${R.kind}${G.levels ? ":" + level : ""}`; try { if (R.right > (+localStorage.getItem(key) || 0)) localStorage.setItem(key, String(R.right)); } catch (e) {}
  const card = el("div", "ln-end"); card.append(emo(stars === 3 ? "jumpi_party" : stars ? "jumpi_love" : "jumpi_hi"));
  card.append(el("h2", "", stars === 3 ? T("Amazing!", "מדהים!") : stars === 2 ? T("Great job!", "כל הכבוד!") : stars === 1 ? T("Nice!", "יפה!") : T("Good try!", "ניסיון יפה!")));
  const st = el("div", "ln-stars"); for (let k = 0; k < 3; k++) st.append(el("i", k < stars ? "on" : "")); card.append(st);
  card.append(el("p", "", T(`${R.right} right out of ${R.n}`, `${R.right} נכונות מתוך ${R.n}`)));
  const btns = el("div", "ln-btns"), again = el("button", "ln-next", T("Play again", "עוד פעם")), back = el("button", "ln-ghost", T("Menu", "תפריט"));
  again.type = back.type = "button"; again.onclick = () => start(R.kind); back.onclick = menu; btns.append(back, again); card.append(btns); m.append(card);
  if (stars) yay();
}
addEventListener("keydown", (e) => { const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[e.code]; if (n === undefined) return; const b = document.querySelectorAll(".ln-c")[n]; if (b && !b.disabled) b.click(); });
menu();
