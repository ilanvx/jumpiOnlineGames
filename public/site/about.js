/* /about: the Jumpi trailer. Nothing loads from YouTube until someone presses play; then the no-cookie player
   (youtube-nocookie.com, allowed by the page's CSP frame-src) takes the place of the picture and starts. */
(() => {
  const btn = document.getElementById("trailerPlay"), box = document.getElementById("trailer");
  if (!btn || !box) return;
  btn.addEventListener("click", () => {
    const f = document.createElement("iframe");
    f.src = `https://www.youtube-nocookie.com/embed/${btn.dataset.video}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
    f.title = document.documentElement.lang === "he" ? "הטריילר של ג'אמפי" : "The Jumpi trailer";
    f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    f.allowFullscreen = true;
    f.referrerPolicy = "strict-origin-when-cross-origin";
    box.replaceChildren(f);
    f.focus();
  });
})();
