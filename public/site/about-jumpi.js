/*
  About Jumpi Games (about-jumpi.html):
  - the opening's video (a cut of the trailer): the wide one or the tall one by the screen, and only when motion is
    welcome (no autoplay with less motion or data saver: the still picture stays); a button pauses it, and it rests
    while it is off screen
  - things come in as they reach the screen; the numbers count up once
  - the bar: a line under it once the page moves, the part you are in marked, the menu on small screens
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
  if (tall) video.poster = video.dataset.posterTall;
  const saver = navigator.connection && navigator.connection.saveData;
  if (calm() || saver) return;   // the still picture is enough
  const base = tall ? video.dataset.tall : video.dataset.wide;
  for (const [ext, type] of [["webm", "video/webm"], ["mp4", "video/mp4"]]) { const s = document.createElement("source"); s.src = `${base}.${ext}`; s.type = type; video.append(s); }
  video.preload = "auto"; video.load();
  const go = () => { if (!userPaused && heroSeen) video.play().catch(() => {}); };
  video.addEventListener("canplay", go, { once: true });
  pauseBtn.hidden = false;
  pauseBtn.addEventListener("click", () => {
    userPaused = !userPaused; pauseBtn.setAttribute("aria-pressed", String(userPaused));
    if (userPaused) video.pause(); else video.play().catch(() => {});
  });
  new IntersectionObserver(([e]) => { heroSeen = e.isIntersecting; if (!heroSeen) video.pause(); else go(); }, { threshold: .05 }).observe(video);
}
setupVideo();

/* ---------- things come in; numbers count up ---------- */
const fmt = (n) => n.toLocaleString(root.lang === "he" ? "he-IL" : "en-US");
function countUp(b) {
  if (b.dataset.done) return; b.dataset.done = "1";
  const n = +b.dataset.n, plus = b.dataset.plus || "";
  if (calm()) { b.textContent = fmt(n) + plus; return; }
  const t0 = performance.now(), dur = 1300 + Math.min(900, n);
  const step = (now) => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); b.textContent = fmt(Math.round(n * e)) + (k === 1 ? plus : ""); if (k < 1) requestAnimationFrame(step); };
  b.textContent = "0"; requestAnimationFrame(step);
}
const ins = [...document.querySelectorAll(".aj-in")];
const io = new IntersectionObserver((list) => {
  for (const e of list) {
    if (!e.isIntersecting) continue;
    e.target.classList.add("on"); io.unobserve(e.target);
    e.target.querySelectorAll("[data-n]").forEach(countUp);
  }
}, { rootMargin: "0px 0px -8% 0px", threshold: .12 });
ins.forEach((el) => io.observe(el));
// the opening comes in right away
requestAnimationFrame(() => document.querySelectorAll(".aj-hero .aj-in").forEach((el) => el.classList.add("on")));

/* ---------- the bar ---------- */
const bar = document.querySelector(".aj-bar");
const onScroll = () => bar.classList.toggle("scrolled", scrollY > 8);
addEventListener("scroll", onScroll, { passive: true }); onScroll();
const nav = document.getElementById("ajNav"), menu = document.querySelector(".aj-menu");
const links = [...nav.querySelectorAll("a")];
const setMenu = (open) => { nav.classList.toggle("open", open); menu.setAttribute("aria-expanded", String(open)); };
menu.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
links.forEach((a) => a.addEventListener("click", () => setMenu(false)));
addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("open")) { setMenu(false); menu.focus(); } });
document.addEventListener("click", (e) => { if (nav.classList.contains("open") && !e.target.closest(".aj-bar")) setMenu(false); });
// the part of the page you are in
const parts = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
const mark = () => {
  const y = innerHeight * .35; let cur = null;
  for (const s of parts) { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) cur = s; }
  links.forEach((a) => a.setAttribute("aria-current", String(!!cur && a.getAttribute("href") === "#" + cur.id)));
};
addEventListener("scroll", mark, { passive: true }); mark();

// numbers already shown get the new language's digits grouping
addEventListener("gd:lang", () => document.querySelectorAll("[data-n][data-done]").forEach((b) => { b.textContent = fmt(+b.dataset.n) + (b.dataset.plus || ""); }));
