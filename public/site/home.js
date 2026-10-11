/* The home page (/): language, the phone menu, a few questions from the help center, and the weekly poll (routes/poll.js). */
import "/site/guide-lang.js";

const $ = (id) => document.getElementById(id);
const lang = () => (document.documentElement.lang === "he" ? "he" : "en");
const L = (en, he) => (lang() === "he" ? he : en);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/* ---------- the menu on phones ---------- */
const nav = $("nav"), menuBtn = $("menuBtn");
menuBtn.onclick = () => { const open = !nav.classList.contains("open"); nav.classList.toggle("open", open); menuBtn.setAttribute("aria-expanded", open); };
nav.addEventListener("click", (e) => { if (e.target.closest("a")) { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); } });

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
