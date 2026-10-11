/* /play on the website: the game sits in a frame in the middle of the page (site/play.html).
   - what was asked of /play (?lang, ?staff, ?soon…) goes on to the game in the frame
   - the frame gets the keyboard right away, and a button puts the game in full screen
   - the language buttons in the top bar change the game's language too */
(() => {
  const f = document.getElementById("game"), box = document.getElementById("plFrame");
  const q = location.search.slice(1);
  if (q) f.src = "/play?game&" + q + location.hash;
  f.addEventListener("load", () => { try { f.contentWindow.focus(); } catch (e) {} });
  box.addEventListener("pointerdown", () => { try { f.contentWindow.focus(); } catch (e) {} });
  document.getElementById("plFull").onclick = () => {
    const el = box;
    (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
    setTimeout(() => { try { f.contentWindow.focus(); } catch (e) {} }, 300);
  };
  addEventListener("gd:lang", (e) => { try { const I = f.contentWindow.I18N; if (I && I.lang !== e.detail) I.setLang(e.detail); } catch (err) {} });
})();
