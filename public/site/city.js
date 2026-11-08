/*
  /city page: reads GET /api/city every 30 seconds (routes/city.js) and fills the card (followers, the bar to the next goal,
  "it's a secret") and the 3D city (city3d.js → window.JumpiCity.update). View buttons fly the camera.
*/
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString("en-US");
let shown = 0, target = 0, last = null;

function paint(d) {
  last = d;
  target = Number(d.followers) || 0;
  const from = d.next ? d.next.from || 0 : 0;
  const goalBox = $("ctGoal"), text = $("ctGoalText"), secret = $("ctSecret");
  if (d.build) {
    goalBox.hidden = false;
    $("ctBar").style.width = "100%";
    $("ctBar").classList.add("go");
    text.innerHTML = `<span data-l="en">Goal reached! The builders are working.</span><span data-l="he">הגענו ליעד! הפועלים כבר בונים.</span>`;
    secret.innerHTML = `<span data-l="en">What is it? You'll see when it opens!</span><span data-l="he">מה זה? תגלו כשזה ייפתח!</span>`;
  } else if (d.next) {
    goalBox.hidden = false;
    $("ctBar").classList.remove("go");
    const left = Math.max(0, d.next.goal - target);
    $("ctBar").style.width = `${Math.max(4, Math.min(100, ((target - from) / Math.max(1, d.next.goal - from)) * 100))}%`;
    text.innerHTML = `<span data-l="en"><b dir="ltr">${fmt(left)}</b> more followers until the builders arrive</span><span data-l="he">עוד <b dir="ltr">${fmt(left)}</b> עוקבים והפועלים מגיעים</span>`;
    secret.innerHTML = `<span data-l="en">What are we building next? It's a secret!</span><span data-l="he">מה נבנה עכשיו? סוד!</span>`;
  } else {
    goalBox.hidden = true;
    secret.innerHTML = `<span data-l="en">The whole city is built. Thank you!</span><span data-l="he">כל העיר בנויה. תודה!</span>`;
  }
  if (window.JumpiCity) window.JumpiCity.update(d);
}

// the counter rolls up to the new number
function roll() {
  if (shown !== target) { shown += Math.ceil((target - shown) * 0.12) || Math.sign(target - shown); $("ctFollowers").textContent = fmt(shown); }
  requestAnimationFrame(roll);
}

async function load() {
  try {
    const r = await fetch("/api/city", { cache: "no-store" });
    if (!r.ok) throw 0;
    const d = await r.json();
    if (d.followers === null || d.followers === undefined) { $("ctFollowers").textContent = "…"; }
    paint(d);
  } catch { /* keep the last numbers */ }
}

addEventListener("city:ready", () => { if (last) window.JumpiCity.update(last); });
document.querySelectorAll(".ct-views button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".ct-views button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  window.JumpiCity?.fly(b.dataset.view);
}));
/* find your house (Followers Village): the same name again = the next house with that name; ?home=<number> opens a house */
const findIn = $("ctFindIn"), findMsg = $("ctFindMsg");
let lastQ = "", nth = 0;
const he = () => document.documentElement.lang === "he";
const say = (en, hb) => { findMsg.innerHTML = `<span data-l="en">${en}</span><span data-l="he">${hb}</span>`; };
const paintPh = () => { findIn.placeholder = he() ? findIn.dataset.phHe : findIn.dataset.phEn; };
paintPh();
addEventListener("gd:lang", paintPh);
new MutationObserver(paintPh).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
const pressView = (v) => document.querySelectorAll(".ct-views button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.view === v)));
$("ctFind").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = findIn.value.trim();
  if (!q || !window.JumpiCity) return;
  nth = q === lastQ ? nth + 1 : 0; lastQ = q;
  const r = window.JumpiCity.findHome(q, nth);
  pressView("");
  if (!r.found) { say("We didn't find that name yet.", "עוד לא מצאנו את השם הזה."); return; }
  history.replaceState(null, "", `?home=${r.home}`);
  if (r.found > 1) say(`${r.at} of ${r.found} houses with this name. Press again for the next.`, `בית ${r.at} מתוך ${r.found} בתים עם השם הזה. לחצו שוב לבא.`);
  else findMsg.textContent = "";
});
function openFromLink() {
  const no = Number(new URLSearchParams(location.search).get("home"));
  if (no > 0 && window.JumpiCity && window.JumpiCity.goHome(no)) pressView("");
}
if (window.JumpiCity) openFromLink(); else addEventListener("city:ready", openFromLink, { once: true });

load();
setInterval(load, 30000);
roll();
