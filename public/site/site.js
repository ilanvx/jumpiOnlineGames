/* Jumpi website: menu, auras, pets button. The 3D scenes live in site3d.js. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /* ---------- toast ---------- */
  let toastT = 0;
  function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("show"), 2600);
  }
  window.siteToast = toast;

  /* ---------- top bar ---------- */
  const top = $("#top"), nav = $("#nav"), menuBtn = $("#menuBtn");
  const onScroll = () => top.classList.toggle("scrolled", scrollY > 30);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  function setMenu(open) {
    nav.classList.toggle("open", open);
    top.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", open);
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  menuBtn.onclick = () => setMenu(!nav.classList.contains("open"));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  /* ---------- things that aren't ready yet ---------- */
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-soon]");
    if (!a) return;
    e.preventDefault();
    toast(`${a.dataset.soon} is coming soon! For now, press Play online.`);
  });

  /* ---------- legendary auras ---------- */
  const TAU = Math.PI * 2;
  const AURAS = [
    ["flame", "Flame Aura", 3000, "#ff3d00", "#ffc400"], ["frost", "Frost Storm", 3500, "#1d7fd6", "#c9f3ff"],
    ["hearts", "Heart Swirl", 3000, "#ff2f86", "#ffc2e0"], ["thunder", "Thunder Storm", 4500, "#1f4fff", "#bfe6ff"],
    ["rainbow", "Rainbow Burst", 5000, "#ff5f5f", "#ffe14d"], ["galaxy", "Galaxy Orbit", 6000, "#3a1a8a", "#ff9cf0"],
    ["void", "Shadow Void", 7000, "#12052a", "#b26bff"], ["gold", "Golden Glory", 10000, "#c98a00", "#fff3b0"],
  ];
  const GLYPH = {
    flame: '<path d="M0 -6 C3 -2 4 1 2.5 4 C1.5 6 -1.5 6 -2.5 4 C-4 1 -2 -1 0 -6Z"/>',
    frost: '<path d="M0 -5V5M-4.3 -2.5L4.3 2.5M-4.3 2.5L4.3 -2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    hearts: '<path d="M0 4.5 C-6 0 -4.5 -5 -1.5 -4.5 C-.5 -4.3 0 -3.5 0 -3 C0 -3.5 .5 -4.3 1.5 -4.5 C4.5 -5 6 0 0 4.5Z"/>',
    thunder: '<path d="M1 -6 L-3 1 H0 L-1 6 L3 -1 H0 Z"/>',
    rainbow: '<path d="M0 -5 Q1 -1 5 0 Q1 1 0 5 Q-1 1 -5 0 Q-1 -1 0 -5Z"/>',
    galaxy: '<circle r="2.6"/><ellipse rx="5" ry="1.5" fill="none" stroke="currentColor" stroke-width="1"/>',
    void: '<circle r="3"/>',
    gold: '<circle r="3.4"/><circle r="1.6" fill="#c98a00"/>',
  };
  const RB = ["#ff5f5f", "#ffb21f", "#ffe14d", "#2fd36b", "#1f9bff", "#9b5cff", "#ff5fb4", "#ffffff"];
  function auraSVG([id, , , c0, c1], i) {
    let g = "";
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU, x = 24 + Math.cos(a) * 17, y = 24 + Math.sin(a) * 17, col = id === "rainbow" ? RB[k] : c1;
      g += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k % 2 ? 0.8 : 1.05})" fill="${col}" style="color:${col}">${GLYPH[id]}</g>`;
    }
    const rays = id === "gold" ? `<g class="aura-spin" opacity=".55">${Array.from({ length: 10 }, (_, k) => {
      const p = (d) => `${(24 + Math.cos((k / 10) * TAU + d) * 23).toFixed(1)} ${(24 + Math.sin((k / 10) * TAU + d) * 23).toFixed(1)}`;
      return `<path d="M24 24 L${p(-0.12)} L${p(0.12)}Z" fill="#fff3b0"/>`;
    }).join("")}</g>` : "";
    return `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><radialGradient id="sag${i}"><stop offset="0" stop-color="${c1}" stop-opacity=".95"/><stop offset=".55" stop-color="${c0}"/><stop offset="1" stop-color="${c0}" stop-opacity=".2"/></radialGradient></defs>
      <circle cx="24" cy="24" r="23" fill="url(#sag${i})"/>${rays}<g class="aura-spin" style="animation-duration:${6 + (i % 3)}s">${g}</g>
      <ellipse cx="24" cy="38" rx="9" ry="2.6" fill="rgb(0 0 0 / .25)"/><circle cx="24" cy="17.5" r="6" fill="#fff"/><rect x="17.5" y="23" width="13" height="14" rx="6" fill="#fff"/></svg>`;
  }
  $("#auraGrid").innerHTML = AURAS.map((a, i) =>
    `<article class="aura reveal" style="--glow:${a[4]}">${auraSVG(a, i)}<h3>${a[1]}</h3><span class="price"><i aria-hidden="true"></i>${a[2].toLocaleString("en-US")} coins</span></article>`).join("");

  /* ---------- adopt (pets are coming soon) ---------- */
  let pet = "Puppy";
  addEventListener("petchange", (e) => { pet = e.detail; $("#adoptName").textContent = pet; $("#adoptNote").textContent = ""; });
  $("#adoptBtn").onclick = () => {
    $("#adoptNote").textContent = `Pets are coming soon to Jumpi. Stay tuned!`;
    dispatchEvent(new CustomEvent("petlove"));
  };

  /* ---------- sections slide in as you scroll ---------- */
  $$(".feat,.safe-row,.safety,.final-card,.pets-copy").forEach((el) => el.classList.add("reveal"));
  const io = new IntersectionObserver((list) => list.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { rootMargin: "0px 0px -8% 0px" });
  $$(".reveal").forEach((el, i) => { el.style.transitionDelay = (i % 4) * 70 + "ms"; io.observe(el); });
})();
