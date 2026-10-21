// every page (routes/fresh.js adds it): pictures, links and videos can't be dragged out, and text can't be selected
// (a double click or a drag over the page selects nothing). Inputs, text boxes and editable areas work as usual.
(() => {
  const free = (t) => t && t.closest && t.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),.sel-ok');
  addEventListener("dragstart", (e) => { const t = e.target.nodeType === 1 ? e.target : e.target.parentElement; if (!free(t) && !(t && t.closest && t.closest('[draggable="true"]'))) e.preventDefault(); }, true);
  addEventListener("selectstart", (e) => { const t = e.target.nodeType === 1 ? e.target : e.target.parentElement; if (!free(t)) e.preventDefault(); }, true);
})();
