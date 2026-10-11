/* Parental controls page (/parents). Server: routes/parents.js. Settings rules: public/shared/parental.js */
import { QUICK_CHAT, MAX_RULES } from "/shared/parental.js";

/* ---------- English ⇄ Hebrew (same choice as the rest of the site) ---------- */
let lang = "en";
const L = (en, he) => (lang === "he" ? he : en);
const btns = [...document.querySelectorAll(".lang-sw [data-l]")];
function setLang(l) {
  lang = l === "he" ? "he" : "en";
  btns.forEach((b) => b.setAttribute("aria-pressed", b.dataset.l === lang));
  document.documentElement.lang = lang; document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  document.querySelectorAll("[data-en]").forEach((el) => (el.textContent = lang === "he" ? el.dataset.he : el.dataset.en));
  try { localStorage.setItem("jumpi-lang", lang); } catch (e) {}
  if (kid) { paintKid(); paintRules(); paintQuick(); paintChat(); paintTrades(); paintPlay(); }
}
btns.forEach((b) => (b.onclick = () => setLang(b.dataset.l)));

const $ = (id) => document.getElementById(id);
async function api(path, body) {
  try {
    const r = await fetch("/api/parents/" + path, body === undefined ? { credentials: "same-origin" } : { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
  } catch (e) { return { ok: false, status: 0, data: { code: "net" } }; }
}
const ERR = {
  net: () => L("Can't reach Jumpi right now. Check the internet and try again.", "אי אפשר להתחבר לג'אמפי כרגע. בדקו את האינטרנט ונסו שוב."),
  off: () => L("Email codes aren't switched on yet. Write to support@jumpigames.com and we'll help.", "קודים במייל עוד לא פעילים. כתבו ל-support@jumpigames.com ונעזור."),
  email: () => L("Type the email of your child's Jumpi account.", "כתבו את האימייל של חשבון הג'אמפי של הילד."),
  busy: () => L("Too many tries. Please wait a few minutes.", "יותר מדי ניסיונות. חכו כמה דקות."),
  bad: () => L("That code isn't right, or it ran out. Ask for a new one.", "הקוד לא נכון או שפג תוקפו. בקשו קוד חדש."),
  send: () => L("We couldn't send the email right now. Please try again in a minute.", "לא הצלחנו לשלוח את המייל כרגע. נסו שוב בעוד דקה."),
  times: () => L("Some of the times aren't right: each one needs at least one day.", "חלק מהזמנים לא תקינים: לכל זמן צריך לפחות יום אחד."),
};
const errText = (r) => (ERR[r.data.code] ? ERR[r.data.code]() : r.status === 429 ? ERR.busy() : r.data.error || ERR.net());
function oops(form, el, text) { el.className = "pa-msg"; el.textContent = text; form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake"); }
function view(v) { document.querySelectorAll(".pa-view").forEach((el) => (el.hidden = el.dataset.v !== v)); const i = document.querySelector(`.pa-view[data-v="${v}"] input`); if (i) setTimeout(() => i.focus(), 50); }

/* ---------- logging in ---------- */
let email = "";
$("eForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  email = $("email").value.trim();
  if (!email) return oops($("eForm"), $("eMsg"), ERR.email());
  $("eGo").disabled = true; $("eMsg").textContent = "";
  const r = await api("code", { email });
  $("eGo").disabled = false;
  if (!r.ok) return oops($("eForm"), $("eMsg"), errText(r));
  $("cTo").textContent = email; $("code").value = ""; $("cMsg").textContent = "";
  view("code");
});
$("code").addEventListener("input", () => { $("code").value = $("code").value.replace(/\D/g, "").slice(0, 6); if ($("code").value.length === 6) $("cForm").requestSubmit(); });
$("cForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = $("code").value;
  if (code.length !== 6) return oops($("cForm"), $("cMsg"), ERR.bad());
  $("cGo").disabled = true;
  const r = await api("verify", { email, code });
  $("cGo").disabled = false;
  if (!r.ok) return oops($("cForm"), $("cMsg"), errText(r));
  openDash();
});
$("cBack").onclick = () => view("email");
$("logout").onclick = async () => { await api("logout", {}); location.reload(); };

/* ---------- the dashboard ---------- */
let kid = null, chat = [], chatMore = false, trades = [], rules = [], play = null;
// "1 h 35 min" / "שעה ו-35 דקות"
function fmtDur(m) {
  m = Math.max(0, Math.round(m));
  const h = Math.floor(m / 60), r = m % 60;
  if (lang !== "he") return h ? `${h} h${r ? ` ${r} min` : ""}` : `${r} min`;
  const hh = h === 1 ? "שעה" : h === 2 ? "שעתיים" : `${h} שעות`, mm = r === 1 ? "דקה" : `${r} דקות`;
  return h ? (r ? `${hh} ו-${mm}` : hh) : m === 0 ? "0 דקות" : mm;
}
const fmtShort = (m) => { m = Math.round(m); const h = Math.floor(m / 60); return h ? `${h}:${String(m % 60).padStart(2, "0")}` : L(`${m} min`, `${m} דק׳`); };
const DEVICE = { app: ["Jumpi app", "אפליקציית ג'אמפי"], phone: ["Phone", "טלפון"], tablet: ["Tablet", "טאבלט"], computer: ["Computer", "מחשב"] };
const DAYS = () => (lang === "he" ? ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
const fmtDate = (ms) => new Date(ms).toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jerusalem" });
const fmtTime = (ms) => new Date(ms).toLocaleTimeString(lang === "he" ? "he-IL" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

async function openDash() {
  view("wait");
  const r = await api("me");
  if (!r.ok) { $("gate").hidden = false; $("dash").hidden = true; view("email"); if (r.status !== 401) oops($("eForm"), $("eMsg"), errText(r)); return; }
  kid = r.data; rules = (kid.settings.quiet || []).map((x) => ({ ...x, days: [...x.days] }));
  $("gate").hidden = true; $("dash").hidden = false; $("logout").hidden = false;
  paintKid(); paintRules(); paintQuick();
  $("lockOn").checked = kid.settings.chatLock;
  loadChat(); loadTrades(); loadPlay();
}
function paintKid() {
  $("kAva").textContent = (kid.username[0] || "?").toUpperCase();
  $("kName").textContent = kid.username;
  const st = $("kStatus"); st.textContent = "";
  st.append(el("i", kid.online ? "on" : ""), document.createTextNode(kid.online ? L("Playing now", "משחק עכשיו") : kid.lastLoginAt ? L("Last played ", "שיחק לאחרונה ב-") + fmtDate(kid.lastLoginAt) : L("Not online", "לא מחובר")));
  const today = el("span", "pa-today"); today.append(L("Played today: ", "שיחק היום: "), el("b", null, fmtDur(kid.todayMin || 0)));
  st.append(today);
  const facts = [[L("Level", "רמה"), kid.level], [L("Coins", "מטבעות"), Number(kid.coins).toLocaleString("en-US")], [L("Friends", "חברים"), kid.friends],
    [L("Joined", "הצטרף"), fmtDate(kid.createdAt)], [L("Membership", "מנוי"), kid.member ? L("Yes", "כן") : L("No", "לא")], [L("Pets", "חיות"), kid.pets]];
  $("kFacts").replaceChildren(...facts.map(([k, v]) => { const d = el("div"); d.append(el("dt", null, k), el("dd", null, String(v))); return d; }));
  $("kClosed").hidden = !kid.quietNow;
}

// chat
async function loadChat(more) {
  const before = more && chat.length ? "?before=" + chat[chat.length - 1].at : "";
  const r = await api("chat" + before);
  if (!r.ok) return;
  chat = more ? [...chat, ...r.data.list] : r.data.list; chatMore = r.data.more;
  paintChat();
}
function paintChat() {
  const list = $("chatList");
  if (!chat.length) { list.replaceChildren(el("li", "pa-empty", L("Nothing written yet.", "עוד לא נכתב כלום."))); $("chatMore").hidden = true; return; }
  list.replaceChildren(...chat.map((m) => {
    const li = el("li", m.blocked ? "blk" : "");
    const w = el("div", "pa-when"); w.append(el("b", null, fmtDate(m.at)), document.createTextNode(fmtTime(m.at)));
    const t = el("div", "pa-text");
    t.append(el("span", "pa-badge" + (m.kind === "dm" ? " dm" : ""), m.kind === "dm" ? L("To ", "אל ") + m.where : m.where));
    if (m.blocked) t.append(el("span", "pa-badge blk", L("Stopped by the filter", "נעצר במסנן")));
    const txt = el("span", null, m.text); txt.dir = "auto"; t.append(txt);
    li.append(w, t); return li;
  }));
  $("chatMore").hidden = !chatMore;
}
$("chatMore").onclick = () => loadChat(true);

// trades
async function loadTrades() { const r = await api("trades"); if (r.ok) { trades = r.data.list; paintTrades(); } }
function paintTrades() {
  const list = $("tradeList");
  if (!trades.length) return list.replaceChildren(el("li", "pa-empty", L("No trades yet.", "עוד אין החלפות.")));
  list.replaceChildren(...trades.map((t) => {
    const li = el("li");
    const w = el("div", "pa-when"); w.append(el("b", null, fmtDate(t.at)), document.createTextNode(fmtTime(t.at)));
    const body = el("div", "pa-text");
    const who = el("span", "pa-badge", L("With ", "עם ") + t.with); who.dir = "auto"; body.append(who);
    const sw = el("div", "pa-swap");
    const gave = el("div"); gave.append(el("small", null, L("Gave", "נתן")), document.createTextNode(t.gave.join(", ") || "—"));
    const got = el("div"); got.append(el("small", null, L("Got", "קיבל")), document.createTextNode(t.got.join(", ") || "—"));
    sw.append(gave, got); body.append(sw); li.append(w, body); return li;
  }));
}

// logins and play time
async function loadPlay(more) {
  const before = more && play?.list.length ? "?before=" + play.list[play.list.length - 1].start : "";
  const r = await api("playtime" + before);
  if (!r.ok) return;
  play = more && play ? { ...r.data, days: play.days, list: [...play.list, ...r.data.list] } : r.data;
  paintPlay();
}
function paintPlay() {
  if (!play) return;
  const top = Math.max(60, ...play.days.map((d) => d.min));
  $("week").replaceChildren(...play.days.map((d, i) => {
    const col = el("div", "pa-day" + (i === play.days.length - 1 ? " now" : ""));
    const bar = el("div", "pa-bar"); const fill = el("span"); fill.style.height = Math.round((d.min / top) * 100) + "%"; bar.append(fill);
    const day = DAYS()[new Date(d.at + 12 * 3600e3).getUTCDay()];
    const v = el("b", null, d.min ? fmtShort(d.min) : "—");
    col.append(v, bar, el("small", null, i === play.days.length - 1 ? L("Today", "היום") : day));
    col.title = fmtDate(d.at) + (d.min ? " · " + fmtDur(d.min) : "");
    return col;
  }));
  const list = $("playList");
  if (!play.list.length) { list.replaceChildren(el("li", "pa-empty", L("No logins yet.", "עוד אין התחברויות."))); $("playMore").hidden = true; return; }
  list.replaceChildren(...play.list.map((s) => {
    const li = el("li", s.end ? "" : "live");
    const w = el("div", "pa-when"); w.append(el("b", null, fmtDate(s.start)));
    const span = el("span", null, fmtTime(s.start) + " – " + (s.end ? fmtTime(s.end) : L("now", "עכשיו"))); w.append(span);
    const t = el("div", "pa-text");
    t.append(el("span", "pa-badge", L(...DEVICE[s.device] || DEVICE.computer)));
    if (!s.end) t.append(el("span", "pa-badge on", L("Playing now", "משחק עכשיו")));
    t.append(el("b", null, fmtDur(s.min)));
    li.append(w, t); return li;
  }));
  $("playMore").hidden = !play.more;
}
$("playMore").onclick = () => loadPlay(true);

// play times
function paintRules() {
  const box = $("rules");
  $("rulesEmpty").hidden = rules.length > 0;
  box.replaceChildren(...rules.map((r, i) => {
    const li = el("li", "pa-rule");
    const days = el("div", "pa-days");
    DAYS().forEach((name, d) => { const b = el("button", null, name); b.type = "button"; b.setAttribute("aria-pressed", r.days.includes(d)); b.onclick = () => { r.days = r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d].sort(); paintRules(); }; days.append(b); });
    const times = el("div", "pa-times");
    const from = el("input"); from.type = "time"; from.dir = "ltr"; from.value = r.from; from.onchange = () => { r.from = from.value; paintRules(); };
    const to = el("input"); to.type = "time"; to.dir = "ltr"; to.value = r.to; to.onchange = () => { r.to = to.value; paintRules(); };
    from.setAttribute("aria-label", L("From", "משעה")); to.setAttribute("aria-label", L("Until", "עד שעה"));
    times.append(el("span", null, L("Closed from", "סגור מ-")), from, el("span", null, L("until", "עד")), to);
    const del = el("button", "pa-del", "×"); del.type = "button"; del.setAttribute("aria-label", L("Remove", "הסרה")); del.onclick = () => { rules.splice(i, 1); paintRules(); };
    if (r.from === r.to) times.append(el("span", "pa-allday", L("(the whole day)", "(כל היום)")));
    li.append(days, times, del); return li;
  }));
  ["qNight", "qSchool", "qDay", "qAdd"].forEach((id) => ($(id).disabled = rules.length >= MAX_RULES));
}
const addRule = (r) => { if (rules.length < MAX_RULES) { rules.push(r); paintRules(); } };
$("qNight").onclick = () => addRule({ days: [6, 0, 1, 2, 3, 4], from: "21:00", to: "07:00" });   // the nights before Sunday … Friday
$("qSchool").onclick = () => addRule({ days: [0, 1, 2, 3, 4, 5], from: "08:00", to: "13:00" });
$("qAdd").onclick = () => addRule({ days: [0, 1, 2, 3, 4, 5, 6], from: "22:00", to: "07:00" });
$("qDay").onclick = () => addRule({ days: [6], from: "00:00", to: "00:00" });
async function save(settings, msgEl, okText) {
  msgEl.className = "pa-msg"; msgEl.textContent = "";
  const r = await api("settings", settings);
  if (!r.ok) { msgEl.textContent = errText(r); if (r.status === 401) location.reload(); return false; }
  kid.settings = r.data.settings; kid.quietNow = r.data.quietNow; paintKid();
  msgEl.className = "pa-msg ok"; msgEl.textContent = okText; return true;
}
$("tSave").onclick = async () => {
  $("tSave").disabled = true;
  await save({ chatLock: kid.settings.chatLock, quiet: rules }, $("tMsg"), L("Saved! It works right away.", "נשמר! זה עובד מיד."));
  $("tSave").disabled = false;
};

// chat lock
function paintQuick() { $("quick").replaceChildren(...QUICK_CHAT.map(([en, he]) => { const li = el("li", null, lang === "he" ? he : en); li.dir = "auto"; return li; })); }
$("lockOn").onchange = async () => {
  const on = $("lockOn").checked;
  const ok = await save({ chatLock: on, quiet: kid.settings.quiet }, $("lMsg"), on ? L("The chat is off. Your child can use only the ready-made messages.", "הצ'אט כבוי. הילד יכול להשתמש רק בהודעות המוכנות.") : L("The chat is on again.", "הצ'אט פועל שוב."));
  if (!ok) $("lockOn").checked = !on;
};

// tabs
document.querySelectorAll(".pa-tabs [data-t]").forEach((b) => (b.onclick = () => {
  document.querySelectorAll(".pa-tabs [data-t]").forEach((x) => x.setAttribute("aria-selected", x === b));
  document.querySelectorAll(".pa-panel").forEach((p) => (p.hidden = p.dataset.p !== b.dataset.t));
}));

/* ---------- start ---------- */
let start = "en";
try { start = new URLSearchParams(location.search).get("lang") || localStorage.getItem("jumpi-lang") || "en"; } catch (e) {}
setLang(start);
openDash();   // already logged in (the parents' cookie lasts 2 hours)? straight to the dashboard
