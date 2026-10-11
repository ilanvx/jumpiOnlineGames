/* English ⇄ Hebrew for the guide pages (/for-parents, /help): text lives in pairs of
   <x data-l="en"> / <x data-l="he">, CSS shows the one for <html lang>. Same choice as the rest of the site. */
const btns = [...document.querySelectorAll(".lang-sw [data-set]")];
export function setLang(l) {
  const lang = l === "he" ? "he" : "en";
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  btns.forEach((b) => b.setAttribute("aria-pressed", b.dataset.set === lang));
  // links to Contact / parental controls open in the same language
  document.querySelectorAll('a[href^="/contact"], a[href^="/parents"], a[href^="/for-parents"], a[href^="/help"]').forEach((a) => {
    const u = new URL(a.getAttribute("href"), location.origin);
    u.searchParams.set("lang", lang);
    a.setAttribute("href", u.pathname + u.search + u.hash);
  });
  try { localStorage.setItem("jumpi-lang", lang); } catch (e) {}
  dispatchEvent(new CustomEvent("gd:lang", { detail: lang }));
}
btns.forEach((b) => (b.onclick = () => setLang(b.dataset.set)));
let start = "en";
try { start = new URLSearchParams(location.search).get("lang") || localStorage.getItem("jumpi-lang") || "en"; } catch (e) {}
setLang(start);
