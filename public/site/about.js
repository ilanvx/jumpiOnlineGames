/* /about: the big button starts the Jumpi trailer (our own video file, nothing from other sites) */
(() => {
  const btn = document.getElementById("trailerPlay"), v = document.getElementById("trailerVideo"), box = document.getElementById("trailer");
  if (!btn || !v) return;
  btn.addEventListener("click", () => { box.classList.add("on"); v.play().catch(() => {}); v.focus(); });
  v.addEventListener("play", () => box.classList.add("on"));
})();
