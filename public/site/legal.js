/* Terms / Privacy pages: English ⇄ Hebrew switch (same choice as the game) and a table of contents that follows you. */
(function () {
  "use strict";
  const arts = [...document.querySelectorAll("article[data-lang]")];
  const btns = [...document.querySelectorAll(".lang-sw [data-l]")];
  function buildToc(art) {
    const toc = document.getElementById("toc");
    const heads = [...art.querySelectorAll("h2[id]")];
    toc.querySelector("b").textContent = art.dataset.toc;
    toc.querySelector("ol").innerHTML = heads.map((h) => `<li><a href="#${h.id}">${h.textContent.replace(/^\d+\.\s*/, "")}</a></li>`).join("");
    const links = [...toc.querySelectorAll("a")];
    const io = new IntersectionObserver((list) => {
      list.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    heads.forEach((h) => io.observe(h));
  }
  function setLang(l) {
    if (!arts.some((a) => a.dataset.lang === l)) l = "en";
    arts.forEach((a) => (a.hidden = a.dataset.lang !== l));
    btns.forEach((b) => b.setAttribute("aria-pressed", b.dataset.l === l));
    document.documentElement.lang = l;
    document.documentElement.dir = l === "he" ? "rtl" : "ltr";
    document.querySelectorAll("[data-en]").forEach((el) => (el.textContent = l === "he" ? el.dataset.he : el.dataset.en));
    buildToc(arts.find((a) => a.dataset.lang === l));
    try { localStorage.setItem("jumpi-lang", l); } catch (e) {}
  }
  btns.forEach((b) => (b.onclick = () => setLang(b.dataset.l)));
  let start = "en";
  try { start = new URLSearchParams(location.search).get("lang") || localStorage.getItem("jumpi-lang") || "en"; } catch (e) {}
  setLang(start);
})();
