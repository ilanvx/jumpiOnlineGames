/* /play on a phone or a small screen: the game itself, full screen, without the website around it (site/play.html) */
(() => {
  if (matchMedia("(max-width: 900px), (max-height: 560px), (pointer: coarse) and (hover: none)").matches) {
    const q = location.search.slice(1);
    location.replace("/play?game" + (q ? "&" + q : "") + location.hash);
  }
})();
