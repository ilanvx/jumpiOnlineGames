/*
  Jumpi accessibility menu (every site page loads this in <head>: <script src="/shared/a11y.js"></script>).
  - a round button (bottom corner) opens a friendly panel: bigger text, high contrast, grayscale, underline links,
    readable font, stop animations, big cursor, more spacing, strong keyboard focus, reset, and the accessibility statement.
  - choices are kept on this device (localStorage "jumpi-a11y") and applied before the page paints, on every page.
  - "skip to content" link for keyboard users; Alt+A opens the menu; Esc closes it; the panel keeps focus inside.
  - English / Hebrew follows the site's language choice ("jumpi-lang", same as the game and the legal pages).
  - 3D scenes read window.JUMPI_REDUCE_MOTION (set here) as well as the system "reduce motion" setting.
  Class names start with "jacc-" (never "ad-"/"ads"/"banner"/"sponsor").
*/
(function () {
  "use strict";
  var KEY = "jumpi-a11y";
  var root = document.documentElement;
  var S = {};
  try { S = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { S = {}; }

  // ---------- "stop animations" for the 3D scenes and every other frame-by-frame animation ----------
  // All moving 3D pictures on the site draw with requestAnimationFrame. While animations are stopped we hold
  // their next frame (the picture stays as it is) and give it back the moment animations are turned on again.
  // When the page opens with animations already stopped, the scenes may draw for a moment first (until the
  // page has loaded) so they appear at all; they draw their calm pose then (window.JUMPI_REDUCE_MOTION).
  var rafNative = window.requestAnimationFrame && window.requestAnimationFrame.bind(window);
  var cafNative = window.cancelAnimationFrame && window.cancelAnimationFrame.bind(window);
  var held = new Map(), heldId = 0, frozen = false, allowUntil = Infinity, DBG = [];
  // when animations are stopped in the middle of a visit, the scenes' clock stops too, so the few frames that are
  // still drawn (a scroll, a resize, a picture that just loaded) show exactly the same moment
  var pnNative = performance.now.bind(performance), timeStop = null;
  try { performance.now = function () { return timeStop !== null ? timeStop : pnNative(); }; } catch (e) {}
  if (rafNative) {
    window.requestAnimationFrame = function (cb) {
      if (frozen && pnNative() > allowUntil) { heldId++; held.set(heldId, cb); return -heldId; }
      return rafNative(timeStop === null ? cb : function () { cb(timeStop); });
    };
    window.cancelAnimationFrame = function (id) { if (id < 0) held.delete(-id); else cafNative(id); };
    window.addEventListener("load", function () { if (allowUntil === Infinity) allowUntil = pnNative() + 900; });
    // while stopped, still draw a picture when something new is needed: a model or texture just finished loading,
    // the page was scrolled (a scene came into view) or resized. Only a frame or two, so nothing keeps moving.
    var pulse = function (ms, why) {
      if (!frozen) return;
      DBG.push([Math.round(pnNative()), why || '', ms]);
      allowUntil = Math.max(allowUntil === Infinity ? 0 : allowUntil, pnNative() + ms);
      if (allowUntil === Infinity) return;
      var cbs = Array.from(held.values()); held.clear();
      cbs.forEach(function (cb) { rafNative(timeStop === null ? cb : function () { cb(timeStop); }); });
    };
    var pend = 0;
    var later = function (ms, why) { if (pend) return; pend = setTimeout(function () { pend = 0; pulse(ms, why); }, 60); };
    window.addEventListener("scroll", function () { later(80, 'scroll'); }, { passive: true, capture: true });
    window.addEventListener("resize", function () { later(120, 'resize'); });
    var ART = /\.(glb|gltf|bin|png|jpe?g|webp|avif|ktx2|hdr)(\?|#|$)/i;   // models and pictures (not API calls)
    try { new PerformanceObserver(function (list) { if (frozen && allowUntil !== Infinity && list.getEntries().some(function (e) { return ART.test(e.name); })) pulse(900, 'load'); }).observe({ type: "resource" }); } catch (e) {}
  }
  function setFrozen(on, now) {
    if (!rafNative) return;
    if (on && !frozen) { frozen = true; if (now) { timeStop = pnNative(); allowUntil = timeStop + 50; } }   // one more frame, then hold
    else if (!on && frozen) {
      frozen = false; allowUntil = 0; timeStop = null;
      var cbs = Array.from(held.values()); held.clear();
      cbs.forEach(function (cb) { rafNative(cb); });
    }
  }
  var SIZES = [1, 1.12, 1.25, 1.4];

  function apply() {
    var on = function (cls, v) { root.classList.toggle(cls, !!v); };
    on("jacc-contrast", S.contrast);
    on("jacc-gray", S.gray);
    on("jacc-links", S.links);
    on("jacc-font", S.font);
    on("jacc-noanim", S.noanim);
    on("jacc-cursor", S.cursor);
    on("jacc-spacing", S.spacing);
    on("jacc-focus", S.focus);
    var z = SIZES[S.size || 0] || 1;
    root.style.setProperty("--jacc-zoom", z);
    on("jacc-zoom", z !== 1);
    window.JUMPI_REDUCE_MOTION = !!S.noanim || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    setFrozen(!!S.noanim, document.readyState === "complete");
    if (S.noanim) document.querySelectorAll && document.querySelectorAll("video").forEach(function (v) { try { v.pause(); } catch (e) {} });
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} apply(); paint(); }

  // ---------- styles (in <head> right away so the choices show before the page paints) ----------
  var css = [
    /* the effects */
    "html.jacc-zoom body>*:not(.jacc-root){zoom:var(--jacc-zoom)}",
    "html.jacc-contrast body,html.jacc-contrast body *:not(.jacc-root):not(.jacc-root *):not(img):not(svg):not(svg *):not(canvas):not(video):not([aria-hidden=true]):not(:has(> canvas)){background-color:#000!important;background-image:none!important;color:#fff!important;border-color:#fff!important;text-shadow:none!important;box-shadow:none!important}",
    "html.jacc-contrast a:not(.jacc-root *),html.jacc-contrast a *:not(.jacc-root *){color:#ffe94d!important}",
    "html.jacc-contrast button:not(.jacc-root *){outline:2px solid #fff!important}",
    "html.jacc-contrast a[class*=btn]:not(.jacc-root *),html.jacc-contrast a[class*=cta]:not(.jacc-root *),html.jacc-contrast a.store:not(.jacc-root *){border:2px solid #ffe94d!important;border-radius:12px}",
    /* (layers over the 3D pictures and the boxes that hold them keep their own look, so the pictures still show) */
    "html.jacc-gray body>*:not(.jacc-root){filter:grayscale(1)}",
    "html.jacc-links a:not(.jacc-root *){text-decoration:underline!important;text-underline-offset:3px;text-decoration-thickness:2px!important;outline:2px dashed currentColor;outline-offset:2px}",
    "html.jacc-font body *:not(.jacc-root *):not(svg *){font-family:Arial,Helvetica,'Rubik',sans-serif!important;letter-spacing:normal}",
    "html.jacc-noanim *,html.jacc-noanim *::before,html.jacc-noanim *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}",
    "html.jacc-cursor,html.jacc-cursor *{cursor:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cpath d='M6 4 L6 40 L15 31 L21 45 L28 42 L22 28 L35 28 Z' fill='%23000' stroke='%23fff' stroke-width='3' stroke-linejoin='round'/%3E%3C/svg%3E\") 6 4,auto!important}",
    "html.jacc-spacing body *:not(.jacc-root *){line-height:1.8!important;letter-spacing:.06em!important;word-spacing:.12em!important}",
    "html.jacc-focus *:focus{outline:4px solid #ffb21f!important;outline-offset:3px!important;box-shadow:0 0 0 7px #1d4fbf!important}",
    "html :focus-visible{outline:3px solid #ffb21f;outline-offset:2px}",
    /* skip link */
    ".jacc-skip{position:fixed;top:-60px;left:12px;z-index:2147483647;background:#1d4fbf;color:#fff;font:600 16px/1 'Fredoka',Arial,sans-serif;padding:12px 18px;border-radius:12px;text-decoration:none;transition:top .15s}",
    ".jacc-skip:focus{top:12px}",
    /* the button */
    ".jacc-root{position:fixed;z-index:2147483646;bottom:18px;right:18px;font-family:'Fredoka',Arial,sans-serif}",
    ".jacc-fab{width:58px;height:58px;border-radius:50%;border:4px solid #fff;background:radial-gradient(circle at 35% 30%,#4fb3ff,#1d6fe0 70%);box-shadow:0 6px 0 #0f4aa8,0 10px 22px rgba(10,40,110,.35);cursor:pointer;display:grid;place-items:center;padding:0;transition:transform .15s}",
    ".jacc-fab:hover{transform:translateY(-2px) scale(1.05)}",
    ".jacc-fab:active{transform:translateY(2px);box-shadow:0 2px 0 #0f4aa8,0 6px 14px rgba(10,40,110,.35)}",
    ".jacc-fab svg{width:32px;height:32px}",
    ".jacc-fab .jacc-dot{position:absolute;top:-2px;right:-2px;width:16px;height:16px;border-radius:50%;background:#ffb21f;border:3px solid #fff;display:none}",
    ".jacc-root.jacc-active .jacc-dot{display:block}",
    /* the panel */
    ".jacc-panel{position:absolute;bottom:72px;right:0;width:min(360px,calc(100vw - 36px));max-height:min(640px,calc(100vh - 110px));overflow:auto;background:#fff;border-radius:24px;box-shadow:0 18px 48px rgba(10,40,110,.35);border:4px solid #fff;color:#1d2b4f}",
    ".jacc-panel[hidden]{display:none}",
    ".jacc-head{background:linear-gradient(135deg,#1d6fe0,#1450b8);color:#fff;padding:16px 18px 18px;border-radius:20px 20px 0 0;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:1}",
    ".jacc-head h2{margin:0;font:400 22px/1.1 'Lilita One','Fredoka',Arial,sans-serif;letter-spacing:.3px;flex:1;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.18)}",
    ".jacc-head p{margin:2px 0 0;font-size:13px}",
    ".jacc-x{width:36px;height:36px;border-radius:50%;border:2px solid rgba(255,255,255,.6);background:rgba(255,255,255,.18);color:#fff;font:600 22px/36px Arial,sans-serif;cursor:pointer;flex:none}",
    ".jacc-x:hover{background:rgba(255,255,255,.35)}",
    ".jacc-body{padding:12px 14px}",
    ".jacc-size{display:flex;align-items:center;gap:8px;background:#eef6ff;border-radius:16px;padding:10px 12px;margin-bottom:12px}",
    ".jacc-size b{flex:1;font-weight:600;font-size:15px}",
    ".jacc-size button{width:42px;height:42px;border-radius:12px;border:0;background:#1d6fe0;color:#fff;font:400 22px/1 'Lilita One',Arial,sans-serif;cursor:pointer;box-shadow:0 3px 0 #0f4aa8}",
    ".jacc-size button:disabled{background:#c9d6ea;color:#4a5568;box-shadow:none;cursor:default}",
    ".jacc-size output{min-width:46px;text-align:center;font-weight:600}",
    ".jacc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}",
    ".jacc-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:76px;padding:8px 6px;border-radius:18px;border:3px solid #dbe9fb;background:#f7fbff;color:#1d2b4f;font:600 14px/1.15 'Fredoka',Arial,sans-serif;cursor:pointer;text-align:center;transition:transform .12s,border-color .12s}",
    ".jacc-tile:hover{transform:translateY(-1px);border-color:#9cc8ff}",
    ".jacc-tile svg{width:26px;height:26px;direction:ltr}",
    ".jacc-tile[aria-pressed=true]{background:#fff4d1;border-color:#ffb21f;box-shadow:0 3px 0 #f0a000}",
    ".jacc-tile[aria-pressed=true]::after{content:'✓';position:absolute;transform:translate(34px,-28px);background:#ffb21f;color:#fff;width:20px;height:20px;border-radius:50%;font:700 13px/20px Arial,sans-serif}",
    ".jacc-foot{display:flex;flex-direction:column;gap:8px;padding:0 14px 16px}",
    ".jacc-reset{border:0;border-radius:14px;background:#c2410c;color:#fff;font:400 17px/1 'Lilita One','Fredoka',Arial,sans-serif;padding:13px;cursor:pointer;box-shadow:0 4px 0 #8a2d06}",
    ".jacc-link{display:block;text-align:center;color:#1d4fbf;font-weight:600;font-size:14px;padding:6px;text-decoration:underline}",
    ".jacc-lang{display:flex;gap:6px;justify-content:center}",
    ".jacc-lang button{border:2px solid #dbe9fb;background:#fff;border-radius:999px;padding:5px 12px;font:600 13px 'Fredoka',Arial,sans-serif;color:#1d2b4f;cursor:pointer}",
    ".jacc-lang button[aria-pressed=true]{background:#1d6fe0;border-color:#1d6fe0;color:#fff}",
    ".jacc-note{font-size:12px;color:#5b6577;text-align:center;margin:0}",
    "@media (max-width:480px){.jacc-root{bottom:12px;right:12px}.jacc-fab{width:52px;height:52px}}",
    "@media print{.jacc-root,.jacc-skip{display:none!important}}"
  ].join("\n");
  var st = document.createElement("style");
  st.id = "jacc-style";
  st.textContent = css;
  (document.head || root).appendChild(st);
  apply();

  // ---------- texts ----------
  var T = {
    en: { open: "Accessibility menu", title: "Accessibility", sub: "Make Jumpi easier for you", close: "Close", size: "Text size", smaller: "Smaller text", bigger: "Bigger text",
      contrast: "High contrast", gray: "Grayscale", links: "Underline links", font: "Readable font", noanim: "Stop animations", cursor: "Big cursor",
      spacing: "More spacing", focus: "Keyboard focus", reset: "Reset all", statement: "Accessibility statement", skip: "Skip to main content",
      note: "Your choices are saved on this device. Shortcut: Alt + A" },
    he: { open: "תפריט נגישות", title: "נגישות", sub: "להפוך את ג'אמפי לנוח יותר בשבילכם", close: "סגירה", size: "גודל טקסט", smaller: "הקטנת טקסט", bigger: "הגדלת טקסט",
      contrast: "ניגודיות גבוהה", gray: "גווני אפור", links: "הדגשת קישורים", font: "גופן קריא", noanim: "עצירת אנימציות", cursor: "סמן גדול",
      spacing: "ריווח טקסט", focus: "מיקוד מקלדת", reset: "איפוס הכל", statement: "הצהרת נגישות", skip: "דילוג לתוכן הראשי",
      note: "הבחירות נשמרות במכשיר הזה. קיצור מקלדת: Alt + A" }
  };
  function lang() {
    var l = "";
    try { l = localStorage.getItem("jumpi-lang") || ""; } catch (e) {}
    if (!l) l = (root.lang || "").slice(0, 2);
    return l === "he" ? "he" : "en";
  }

  // ---------- icons (simple, friendly, in the site's colours) ----------
  var I = {
    person: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="5.5" r="3.2" fill="#fff"/><path d="M5 10.5 L16 13 L27 10.5" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M16 13 V19 L11 29 M16 19 L21 29" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    contrast: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12" fill="#fff" stroke="#1d2b4f" stroke-width="3"/><path d="M16 4 A12 12 0 0 1 16 28 Z" fill="#1d2b4f"/></svg>',
    gray: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3 C16 3 6 14 6 20 A10 10 0 0 0 26 20 C26 14 16 3 16 3 Z" fill="#9aa4b5" stroke="#1d2b4f" stroke-width="2.5"/><path d="M11 21 A5 5 0 0 0 16 26" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>',
    links: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13 19 L19 13" stroke="#1d6fe0" stroke-width="3" stroke-linecap="round"/><path d="M14 9 L17 6 A5 5 0 0 1 26 15 L23 18 M18 23 L15 26 A5 5 0 0 1 6 17 L9 14" stroke="#1d2b4f" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M5 30 H27" stroke="#ffb21f" stroke-width="3" stroke-linecap="round"/></svg>',
    font: '<svg viewBox="0 0 32 32" aria-hidden="true" direction="ltr"><text x="3" y="25" font-family="Arial" font-weight="700" font-size="22" fill="#1d2b4f">A</text><text x="17" y="25" font-family="Arial" font-size="15" fill="#1d6fe0">a</text></svg>',
    noanim: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12" fill="#ff7a2f"/><rect x="11" y="10" width="3.6" height="12" rx="1.5" fill="#fff"/><rect x="17.4" y="10" width="3.6" height="12" rx="1.5" fill="#fff"/></svg>',
    cursor: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 3 L7 26 L13 20 L17 29 L21 27 L17 18.5 L25 18.5 Z" fill="#1d2b4f" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    spacing: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 8 H26 M6 16 H26 M6 24 H20" stroke="#1d2b4f" stroke-width="3" stroke-linecap="round"/><path d="M29 5 V27 M27 7 L29 5 L31 7 M27 25 L29 27 L31 25" stroke="#1d6fe0" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    focus: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="9" width="26" height="15" rx="3" fill="none" stroke="#1d2b4f" stroke-width="2.6"/><rect x="7" y="13" width="4" height="3" rx="1" fill="#1d2b4f"/><rect x="14" y="13" width="4" height="3" rx="1" fill="#1d2b4f"/><rect x="21" y="13" width="4" height="3" rx="1" fill="#1d2b4f"/><rect x="9" y="18.5" width="14" height="2.5" rx="1" fill="#ffb21f"/></svg>'
  };
  var TILES = ["contrast", "gray", "links", "font", "noanim", "cursor", "spacing", "focus"];

  var ui = null;
  function build() {
    if (ui || !document.body) return;
    var t = T[lang()];
    // skip link: to <main>, or the first big heading
    var target = document.querySelector("main") || document.querySelector("h1");
    if (target) {
      if (!target.id) target.id = "jacc-main";
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      var skip = document.createElement("a");
      skip.className = "jacc-skip"; skip.href = "#" + target.id; skip.textContent = t.skip;
      document.body.insertBefore(skip, document.body.firstChild);
    }
    var wrap = document.createElement("div");
    wrap.className = "jacc-root";
    wrap.innerHTML =
      '<button type="button" class="jacc-fab" aria-haspopup="dialog" aria-expanded="false" aria-controls="jacc-panel">' + I.person + '<span class="jacc-dot"></span></button>' +
      '<div class="jacc-panel" id="jacc-panel" role="dialog" aria-modal="false" aria-labelledby="jacc-title" hidden>' +
        '<div class="jacc-head"><div style="flex:1"><h2 id="jacc-title"></h2><p class="jacc-sub"></p></div><button type="button" class="jacc-x">×</button></div>' +
        '<div class="jacc-body">' +
          '<div class="jacc-size" role="group"><b class="jacc-size-l"></b><button type="button" class="jacc-minus">A−</button><output class="jacc-out" aria-live="polite"></output><button type="button" class="jacc-plus">A+</button></div>' +
          '<div class="jacc-grid">' + TILES.map(function (k) { return '<button type="button" class="jacc-tile" data-k="' + k + '" aria-pressed="false">' + I[k] + '<span></span></button>'; }).join("") + '</div>' +
        '</div>' +
        '<div class="jacc-foot"><button type="button" class="jacc-reset"></button><a class="jacc-link" href="/accessibility"></a>' +
          '<div class="jacc-lang" role="group" aria-label="Language / שפה"><button type="button" data-l="he" lang="he">עברית</button><button type="button" data-l="en" lang="en">English</button></div>' +
          '<p class="jacc-note"></p></div>' +
      '</div>';
    document.body.appendChild(wrap);
    var q = function (s) { return wrap.querySelector(s); };
    ui = { wrap: wrap, fab: q(".jacc-fab"), panel: q(".jacc-panel"), q: q };

    ui.fab.onclick = function () { toggle(); };
    q(".jacc-x").onclick = function () { toggle(false); };
    q(".jacc-minus").onclick = function () { S.size = Math.max(0, (S.size || 0) - 1); save(); };
    q(".jacc-plus").onclick = function () { S.size = Math.min(SIZES.length - 1, (S.size || 0) + 1); save(); };
    wrap.querySelectorAll(".jacc-tile").forEach(function (b) { b.onclick = function () { var k = b.dataset.k; S[k] = !S[k]; save(); }; });
    q(".jacc-reset").onclick = function () { S = {}; save(); };
    wrap.querySelectorAll(".jacc-lang button").forEach(function (b) {
      b.onclick = function () { try { localStorage.setItem("jumpi-lang", b.dataset.l); } catch (e) {} paint(); };
    });
    // Esc closes, focus stays inside the open panel
    ui.panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { toggle(false); return; }
      if (e.key !== "Tab") return;
      var f = [].slice.call(ui.panel.querySelectorAll("button:not([disabled]),a[href]"));
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    document.addEventListener("click", function (e) { if (!ui.panel.hidden && !wrap.contains(e.target)) toggle(false); });
    paint();
  }
  function toggle(open) {
    if (!ui) return;
    if (open === undefined) open = ui.panel.hidden;
    ui.panel.hidden = !open;
    ui.fab.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) { var first = ui.panel.querySelector(".jacc-x"); if (first) first.focus(); }
    else ui.fab.focus();
  }
  function paint() {
    if (!ui) return;
    var l = lang(), t = T[l], q = ui.q;
    ui.wrap.setAttribute("lang", l);
    ui.panel.setAttribute("dir", l === "he" ? "rtl" : "ltr");
    ui.fab.setAttribute("aria-label", t.open);
    ui.fab.title = t.open + " (Alt+A)";
    q("#jacc-title").textContent = t.title;
    q(".jacc-sub").textContent = t.sub;
    q(".jacc-x").setAttribute("aria-label", t.close);
    q(".jacc-size-l").textContent = t.size;
    q(".jacc-size").setAttribute("aria-label", t.size);
    q(".jacc-minus").setAttribute("aria-label", t.smaller);
    q(".jacc-plus").setAttribute("aria-label", t.bigger);
    q(".jacc-minus").disabled = !(S.size > 0);
    q(".jacc-plus").disabled = (S.size || 0) >= SIZES.length - 1;
    q(".jacc-out").textContent = Math.round((SIZES[S.size || 0] || 1) * 100) + "%";
    ui.wrap.querySelectorAll(".jacc-tile").forEach(function (b) { var k = b.dataset.k; b.querySelector("span").textContent = t[k]; b.setAttribute("aria-pressed", S[k] ? "true" : "false"); });
    q(".jacc-reset").textContent = t.reset;
    q(".jacc-link").textContent = t.statement;
    q(".jacc-note").textContent = t.note;
    ui.wrap.querySelectorAll(".jacc-lang button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.l === l ? "true" : "false"); });
    var any = TILES.some(function (k) { return S[k]; }) || (S.size || 0) > 0;
    ui.wrap.classList.toggle("jacc-active", any);
  }
  document.addEventListener("keydown", function (e) {
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "a" || e.key === "A" || e.code === "KeyA")) { e.preventDefault(); build(); toggle(); }
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
  window.JumpiA11y = { open: function () { build(); toggle(true); }, settings: function () { return JSON.parse(JSON.stringify(S)); }, _dbg: function () { return { frozen: frozen, allowUntil: allowUntil, timeStop: timeStop, now: pnNative(), held: held.size, log: DBG.slice(-12) }; } };
})();
