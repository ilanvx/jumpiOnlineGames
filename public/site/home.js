/* The home page (/): language, the phone menu, a few questions from the help center, and the weekly poll (routes/poll.js). */
import "/site/guide-lang.js";

const $ = (id) => document.getElementById(id);
const lang = () => (document.documentElement.lang === "he" ? "he" : "en");
const L = (en, he) => (lang() === "he" ? he : en);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };


/* ---------- the two friends play catch on the island ----------
   Where their hands and feet are in the picture comes from the 3D scene (studio "islandHero", __islandLayout). */
const BALL = { from: [55.4, 51.6], to: [68.3, 51.2], g1: [55.11, 72.08], g2: [68.43, 71.42], arc: 11, secs: 1.45, rest: .4 };
const ball = $("ball"), shadow = $("ballShadow");
const still = () => !!window.JUMPI_REDUCE_MOTION || matchMedia("(prefers-reduced-motion: reduce)").matches;
function ballAt(k, dir) {   // k 0..1 along the throw, dir 1 = to the right
  const a = dir > 0 ? BALL.from : BALL.to, b = dir > 0 ? BALL.to : BALL.from, ga = dir > 0 ? BALL.g1 : BALL.g2, gb = dir > 0 ? BALL.g2 : BALL.g1;
  const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;   // a little slower at the hands
  const up = 4 * e * (1 - e) * BALL.arc;
  ball.style.left = a[0] + (b[0] - a[0]) * e + "%";
  ball.style.top = a[1] + (b[1] - a[1]) * e - up + "%";
  ball.style.transform = `rotate(${(dir > 0 ? 1 : -1) * e * 540}deg)`;
  shadow.style.left = ga[0] + (gb[0] - ga[0]) * e + "%";
  shadow.style.top = ga[1] + (gb[1] - ga[1]) * e + "%";
  const s = 1 - up / BALL.arc * .45; shadow.style.transform = `scale(${s})`; shadow.style.opacity = .35 + .65 * s;
}
let t0 = performance.now(), seen = true;
new IntersectionObserver((es) => { seen = es.some((x) => x.isIntersecting); }).observe($("stage"));
function ballLoop(now) {
  if (seen) {
    if (still()) ballAt(.5, 1);
    else {
      const cycle = (BALL.secs + BALL.rest) * 2, t = ((now - t0) / 1000) % cycle, half = BALL.secs + BALL.rest;
      const dir = t < half ? 1 : -1, tt = t < half ? t : t - half;
      ballAt(Math.min(1, tt / BALL.secs), dir);
    }
  }
  requestAnimationFrame(ballLoop);
}
requestAnimationFrame(ballLoop);

// "stop animations" in the accessibility menu (public/shared/a11y.js)
const motion = () => document.body.classList.toggle("no-motion", !!window.JUMPI_REDUCE_MOTION);
motion(); addEventListener("a11y:change", motion); setInterval(motion, 2000);

/* ---------- questions and answers: a few guides from the help center (help-data.js) ---------- */
const FAQ_IDS = ["signup", "buy", "pcontrols", "safe", "earn", "forgot"];
let GUIDES = null;
async function paintFaq() {
  if (!GUIDES) GUIDES = (await import("/site/help-data.js")).GUIDES;
  const box = $("faqList"), open = new Set([...box.querySelectorAll("details[open]")].map((d) => d.dataset.id));
  box.replaceChildren(...FAQ_IDS.map((id) => GUIDES.find((g) => g.id === id)).filter(Boolean).map((g) => {
    const d = el("details", "hm-q"); d.dataset.id = g.id; if (open.has(g.id)) d.open = true;
    const s = el("summary"); s.append(el("span", null, g.q[lang()]));
    // the answer's first paragraph, and a link to the full guide with pictures
    const html = String(g.a[lang()]).match(/<p>([\s\S]*?)<\/p>/), p = el("p");
    p.innerHTML = (html ? html[1] : g.a[lang()]) + ` <a href="/help?lang=${lang()}#g-${g.id}">${L("More", "עוד")}</a>`;
    d.append(s, p); return d;
  }));
}
// the FAQ loads when it comes near the screen
const fio = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { fio.disconnect(); paintFaq(); } }, { rootMargin: "400px" });
fio.observe($("faq"));

/* ---------- the weekly poll ---------- */
let poll = null, busy = false;
async function loadPoll() {
  try { const r = await fetch("/api/poll", { credentials: "same-origin" }); if (r.ok) { poll = await r.json(); paintPoll(); } else pollFail(); } catch (e) { pollFail(); }
}
function pollFail() { $("pollQ").textContent = L("The poll will be back soon.", "הסקר יחזור בקרוב."); }
function paintPoll(msg) {
  if (!poll) return;
  const he = lang() === "he", voted = poll.myVote != null;
  $("pollQ").textContent = poll.question[lang()];
  const days = Math.max(0, Math.ceil((poll.endsAt - Date.now()) / 864e5));
  $("pollWhen").textContent = days <= 1 ? L("A new question tomorrow", "שאלה חדשה מחר") : L(`A new question in ${days} days`, `שאלה חדשה בעוד ${days} ימים`);
  const box = $("pollOpts");
  box.replaceChildren(...poll.options.map((o, i) => {
    const b = el("button", "hm-opt" + (poll.myVote === i ? " mine" : "")); b.type = "button";
    const bar = el("span", "bar"), t = el("span", "t", o[lang()]);
    b.append(bar, t);
    if (voted) {
      const pct = poll.total ? Math.round((poll.counts[i] / poll.total) * 100) : 0;
      b.append(el("span", "n", pct + "%")); b.disabled = true;
      b.setAttribute("aria-label", `${o[lang()]}: ${pct}%`);
      requestAnimationFrame(() => requestAnimationFrame(() => (bar.style.width = pct + "%")));
    } else b.onclick = () => vote(i);
    t.dir = "auto";
    return b;
  }));
  $("pollMsg").textContent = msg || (voted ? L(`Thanks for voting! ${poll.total.toLocaleString("en-US")} players answered so far.`, `תודה שהצבעתם! עד עכשיו ענו ${poll.total.toLocaleString("en-US")} שחקנים.`) : L("Pick one answer. You can vote once a week.", "בחרו תשובה אחת. אפשר להצביע פעם בשבוע."));
  if (he) box.dir = "rtl"; else box.removeAttribute("dir");
}
async function vote(i) {
  if (busy) return; busy = true;
  try {
    const r = await fetch("/api/poll/vote", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ option: i }) });
    const d = await r.json().catch(() => ({}));
    if (d.poll) poll = d.poll;
    paintPoll(r.ok ? null : r.status === 409 ? L("You already voted this week. Come back next week for a new question!", "כבר הצבעתם השבוע. חזרו בשבוע הבא לשאלה חדשה!") : L("Couldn't save your vote. Try again in a moment.", "לא הצלחנו לשמור את ההצבעה. נסו שוב עוד רגע."));
  } catch (e) { paintPoll(L("Couldn't save your vote. Try again in a moment.", "לא הצלחנו לשמור את ההצבעה. נסו שוב עוד רגע.")); }
  busy = false;
}
const pio = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { pio.disconnect(); loadPoll(); } }, { rootMargin: "600px" });
pio.observe($("poll"));

addEventListener("gd:lang", () => { if (GUIDES) paintFaq(); paintPoll(); });
