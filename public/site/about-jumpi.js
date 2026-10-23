/*
  About Jumpi Games (about-jumpi.html):
  - the opening's video (a cut of the trailer): wide or tall by the screen, and only when motion is welcome (with less
    motion or data saver the still picture stays). A button pauses it; it rests while off screen.
  - things come in as they reach the screen; the numbers count up once
  - the bar: the part you are in is marked; on small screens a menu
  - words for screen readers and the tab's title follow the language
*/
const root = document.documentElement;
window.AJ_OK = true;   // (the page head shows everything anyway if this script never runs)
const calm = () => !!window.JUMPI_REDUCE_MOTION || matchMedia("(prefers-reduced-motion: reduce)").matches;
if (calm()) root.classList.add("aj-calm");

/* ---------- the opening's video ---------- */
const video = document.querySelector(".aj-video");
const pauseBtn = document.querySelector(".aj-pause");
let userPaused = false, heroSeen = true;
function setupVideo() {
  if (!video) return;
  const tall = matchMedia("(max-width: 640px), (max-aspect-ratio: 4/5)").matches;
  if (navigator.connection && navigator.connection.saveData) return;
  const base = tall ? video.dataset.tall : video.dataset.wide;
  for (const [ext, type] of [["webm", "video/webm"], ["mp4", "video/mp4"]]) { const s = document.createElement("source"); s.src = `${base}.${ext}`; s.type = type; video.append(s); }
  const go = () => { if (!userPaused && heroSeen && !calm()) video.play().catch(() => {}); };
  if (!calm()) { video.preload = "auto"; video.load(); video.addEventListener("canplay", go, { once: true }); }
  pauseBtn.hidden = false;
  const sync = () => pauseBtn.classList.toggle("paused", video.paused);
  video.addEventListener("play", sync); video.addEventListener("pause", sync); sync();
  pauseBtn.addEventListener("click", () => {
    if (video.paused) { userPaused = false; if (!video.currentSrc) { video.preload = "auto"; video.load(); } video.play().catch(() => {}); }
    else { userPaused = true; video.pause(); }
  });
  new IntersectionObserver(([e]) => { heroSeen = e.isIntersecting; if (!heroSeen) video.pause(); else go(); }, { threshold: .05 }).observe(video);
}
setupVideo();

/* ---------- things come in; numbers count up ---------- */
const fmt = (n) => n.toLocaleString("en-US");
function countUp(b) {
  if (b.dataset.done) return; b.dataset.done = "1";
  const n = +b.dataset.n, plus = b.dataset.plus || "";
  if (calm()) { b.textContent = fmt(n) + plus; return; }
  const t0 = performance.now(), dur = 1200 + Math.min(900, n * 2);
  const step = (now) => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); b.textContent = fmt(Math.round(n * e)) + (k === 1 || plus === "x" ? plus : ""); if (k < 1) requestAnimationFrame(step); };
  b.textContent = "0" + (plus === "x" ? "x" : ""); requestAnimationFrame(step);
}
const io = new IntersectionObserver((list) => {
  for (const e of list) {
    if (!e.isIntersecting) continue;
    e.target.classList.add("on"); io.unobserve(e.target);
    e.target.querySelectorAll("[data-n]").forEach(countUp);
  }
}, { rootMargin: "0px 0px -8% 0px", threshold: .12 });
document.querySelectorAll(".aj-in").forEach((el) => io.observe(el));

/* ---------- the bar ---------- */
const nav = document.getElementById("ajNav"), menu = document.querySelector(".aj-menu");
const links = [...nav.querySelectorAll("a")];
const setMenu = (open) => { nav.classList.toggle("open", open); menu.setAttribute("aria-expanded", String(open)); if (open) links[0].focus(); };
menu.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
links.forEach((a) => a.addEventListener("click", () => setMenu(false)));
addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("open")) { setMenu(false); menu.focus(); } });
document.addEventListener("click", (e) => { if (nav.classList.contains("open") && !e.target.closest(".aj-bar")) setMenu(false); });
const parts = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
const mark = () => {
  const y = innerHeight * .35; let cur = null;
  for (const s of parts) { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) cur = s; }
  links.forEach((a) => { if (cur && a.getAttribute("href") === "#" + cur.id) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
};
addEventListener("scroll", mark, { passive: true }); mark();

/* ---------- language: labels and the tab's title ---------- */
const TITLE = { en: "About Jumpi Games · Live Your Story", he: "ג'אמפי גיימס · מי אנחנו" };
function lang() {
  const l = root.lang === "he" ? "he" : "en";
  document.querySelectorAll("[data-aria-en]").forEach((el) => el.setAttribute("aria-label", el.dataset["aria" + (l === "he" ? "He" : "En")]));
  document.title = TITLE[l];
}
addEventListener("gd:lang", lang); lang();
