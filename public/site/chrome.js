/* The top bar and footer of every website page (chrome.css): the phone menu, which page you're on,
   and inside the Jumpi app (JumpiApp in the user agent) no Discord, store or download links.
   Runs right after the header, so the app class is set before the footer is drawn. */
(() => {
  const html = document.documentElement;
  if (/JumpiApp/.test(navigator.userAgent)) html.classList.add("in-app");
  // the app downloads are closed for now (APP_DOWNLOADS_OPEN in /shared/app.js): the Android and Microsoft Store buttons do nothing
  let dlClosed = true;
  import("/shared/app.js").then((m) => { dlClosed = !m.APP_DOWNLOADS_OPEN; }).catch(() => {});
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (dlClosed && a && /\/download\/android|\.apk(\?|$)|apps\.microsoft\.com/i.test(a.getAttribute("href"))) e.preventDefault();
  }, true);
  const nav = document.getElementById("nav"), btn = document.getElementById("menuBtn");
  if (!nav || !btn) return;
  const isOpen = () => nav.classList.contains("open");
  const set = (open) => { nav.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); };
  btn.addEventListener("click", () => set(!isOpen()));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
  document.addEventListener("click", (e) => { if (isOpen() && !e.target.closest(".hm-top")) set(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen()) { set(false); btn.focus(); } });
  // the page you're on
  const here = location.pathname.replace(/\/+$/, "") || "/";
  nav.querySelectorAll('a[href^="/"]').forEach((a) => { if (a.getAttribute("href") === here) a.setAttribute("aria-current", "page"); });
})();
