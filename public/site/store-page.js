/* Jumpi Store page: the cards, who is signed in, and buying (a grown-up check first, then payment). */
import { PRODUCTS, PRODUCT_BY_ID, MEMBER_PERKS } from "/shared/store.js";

const $ = (id) => document.getElementById(id);
let lang = "en", ME = null, busy = false;
const T = (en, he) => (lang === "he" ? he : en);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (p) => "₪" + p.price.toFixed(2);
const num = (n) => n.toLocaleString(lang === "he" ? "he-IL" : "en-US");
const ITEM_NAMES = {
  "hair:4": ["Electric Spiky hair", "שיער ספייקי חשמלי"], "hair:6": ["Pink Pigtails", "קוקיות ורודות"], "shirt:4": ["Jumpi tee", "חולצת ג'אמפי"], "shirt:7": ["Tuxedo", "טוקסידו"],
  "pants:4": ["Pink jeans", "ג'ינס ורוד"], "pants:7": ["Gold shorts", "מכנסי זהב"], "glasses:4": ["Heart glasses", "משקפי לבבות"], "glasses:5": ["Neon shades", "משקפי ניאון"],
  "aura:8": ["Sakura Breeze aura", "הילת סאקורה"], "aura:9": ["Crown of Stars aura", "הילת כתר הכוכבים"], "tag:8": ["Crown name tag", "תג כתר"],
};
const itemName = (id) => (ITEM_NAMES[id] ? T(...ITEM_NAMES[id]) : id);

/* ---------- language (same choice as the rest of the site) ---------- */
const btns = [...document.querySelectorAll(".lang-sw [data-l]")];
function setLang(l) {
  lang = l === "he" ? "he" : "en";
  btns.forEach((b) => b.setAttribute("aria-pressed", b.dataset.l === lang));
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  document.querySelectorAll("[data-en]").forEach((el) => (el.textContent = lang === "he" ? el.dataset.he : el.dataset.en));
  try { localStorage.setItem("jumpi-lang", lang); } catch (e) {}
  render();
}
btns.forEach((b) => (b.onclick = () => setLang(b.dataset.l)));

/* ---------- the cards ---------- */
// the picture of each product (made ahead of time: coins and memberships in img/store/, bundles in img/)
const artOf = (p) => (p ? (p.kind === "bundle" ? `/site/img/${p.id}.png` : `/site/img/store/${p.id}.webp`) : "/site/img/store/coins-1400.webp");
const PASS_COLOR = { 7: "#1fb6ff", 30: "#8a4dff", 90: "#ff8a1c", 365: "#ff4f8b" };
const tag = (p) => (p.tag === "popular" ? `<span class="st-tag">${T("Most popular", "הכי פופולרי")}</span>` : p.tag === "best" ? `<span class="st-tag best">${T("Best value", "הכי משתלם")}</span>` : "");
const priceBtn = (p) => `<button class="st-buy" type="button" data-p="${p.id}" aria-label="${esc(T(`Buy ${p.name.en} for ${money(p)}`, `לקנות ${p.name.he} ב־${money(p)}`))}">${money(p)}</button>`;
function render() {
  const owned = new Set(ME?.owned || []);
  // coins
  $("stCoins").innerHTML = PRODUCTS.filter((p) => p.kind === "coins").map((p) => `
    <article class="st-pack${p.tag === "best" ? " best" : ""}" id="${p.id}">${tag(p)}
      <img src="${artOf(p)}" alt="${esc(T(`${num(p.give.coins)} coins`, `${num(p.give.coins)} מטבעות`))}" width="520" height="456" loading="lazy">
      <p class="st-pname">${esc(p.name[lang])}</p>
      <p class="st-bonus">${p.bonus ? `<span>${T(`+${num(p.bonus)} bonus coins`, `+${num(p.bonus)} מטבעות בונוס`)}</span>` : "&nbsp;"}</p>
      ${priceBtn(p)}
    </article>`).join("");
  // membership
  $("stPerks").querySelector("ul").innerHTML = MEMBER_PERKS.map((k) => `<li>${esc(k[lang])}</li>`).join("");
  $("stPasses").innerHTML = PRODUCTS.filter((p) => p.kind === "member").map((p) => `
    <article class="st-pass${p.tag === "popular" ? " hot" : ""}" id="${p.id}" style="--pc:${PASS_COLOR[p.days] || "#8a4dff"}">${tag(p)}${p.save ? `<span class="st-save">${T(`Save ${p.save}%`, `חיסכון ${p.save}%`)}</span>` : ""}
      <img src="${artOf(p)}" alt="" width="520" height="434" loading="lazy">
      <h3>${esc(p.name[lang])}</h3>
      <p class="st-pdays">${T(`${num(p.days)} days · ${num(p.give.coins)} welcome coins`, `${num(p.days)} ימים · ${num(p.give.coins)} מטבעות מתנה`)}</p>
      <p class="st-pday">${T(`only ₪${(p.price / p.days).toFixed(2)} a day`, `רק ₪${(p.price / p.days).toFixed(2)} ליום`)}</p>
      ${priceBtn(p)}
    </article>`).join("");
  // bundles
  $("stBundles").innerHTML = PRODUCTS.filter((p) => p.kind === "bundle").map((p) => {
    const g = p.give, has = owned.has(p.id);
    const list = [...(g.items || []).map((id) => `<li class="${id.startsWith("aura:") ? "aura" : ""}">${esc(itemName(id))}</li>`),
      g.coins ? `<li class="coins">${num(g.coins)} ${T("coins", "מטבעות")}</li>` : "", g.memberDays ? `<li class="member">${T(`${g.memberDays} days of membership`, `${g.memberDays} ימי מנוי`)}</li>` : ""].join("");
    return `<article class="st-bundle" id="${p.id}" style="--bc:${p.color}">
      <div class="st-art"><img src="${artOf(p)}" alt="" width="460" height="460" loading="lazy"></div>
      <div class="st-bbody"><h3>${esc(p.name[lang])}</h3><p>${esc(p.blurb[lang])}</p><ul class="st-list">${list}</ul>
      <div class="st-buyrow">${has ? `<span class="st-owned">${T("You have this bundle", "החבילה כבר שלך")}</span>` : priceBtn(p)}</div></div></article>`;
  }).join("");
  paintWho();
}
function paintWho() {
  const box = $("stWho"), note = $("stNote");
  note.hidden = !(ME && ME.open === false && ME.admin);
  if (!note.hidden) note.textContent = T("The store is closed to players. You see it because you're an admin, and payments here are real (or pretend, in test mode).", "החנות סגורה לשחקנים. אתם רואים אותה כי אתם מנהלים, והתשלומים כאן אמיתיים (או מדומים, במצב בדיקה).");
  if (!ME) {
    box.innerHTML = `<span>${T("Log in to the game first, so we know whose Jumpi gets the goodies.", "קודם מתחברים למשחק, כדי שנדע לאיזה ג'אמפי לשלוח את ההפתעות.")}</span><a class="st-login" href="/play">${T("Log in", "התחברות")}</a>`;
    return;
  }
  const until = ME.memberUntil ? new Date(ME.memberUntil).toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  box.innerHTML = `<span class="st-me">${T("Shopping for", "קונים בשביל")} <b>${esc(ME.username)}</b></span><span class="st-coinsnow">${num(ME.coins)}</span>${ME.member && until ? `<span class="st-memb">${T("Member until", "מנוי עד")} ${until}</span>` : ""}`;
}

/* ---------- buying ---------- */
const modal = $("stModal"), dlg = $("stDlg");
let lastFocus = null;
function openModal(html) { dlg.innerHTML = html; modal.hidden = false; lastFocus = document.activeElement; setTimeout(() => (dlg.querySelector("input,button") || $("stClose")).focus(), 30); }
function closeModal() { modal.hidden = true; busy = false; lastFocus && lastFocus.focus(); }
$("stClose").onclick = closeModal;
modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest("[data-close]")) closeModal(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

function grownUpCheck(p) {
  const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
  openModal(`<h2>${T("Grown-ups only", "רק למבוגרים")}</h2>
    <div class="st-sum"><img src="${artOf(p)}" alt=""><div><b>${esc(p.name[lang])}</b><span>${money(p)}${p.kind === "member" ? " · " + T("one payment, no renewal", "תשלום אחד, בלי חידוש") : ""}</span></div></div>
    <form id="stGate" novalidate>
      <label class="st-q"><span>${T(`To continue, a parent please answer: ${a} × ${b} =`, `כדי להמשיך, הורה בבקשה יענה: ${a} × ${b} =`)}</span><input id="stAns" inputmode="numeric" autocomplete="off" maxlength="3" dir="ltr"></label>
      <label class="st-agree"><input type="checkbox" id="stOk"> <span>${T("I'm the parent or guardian (or over 18) and I agree to the", "אני ההורה או האפוטרופוס (או מעל גיל 18) ומסכים/ה ל")} <a href="/terms#t-purchases" target="_blank">${T("purchase terms", "תנאי הרכישה")}</a>.</span></label>
      <p class="st-err" id="stErr" role="alert"></p>
      <button class="st-buy big" type="submit">${T("Continue to payment", "המשך לתשלום")}</button>
      <p class="st-secure"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5a4.5 4.5 0 0 0-4.5 4.5v2H5a2 2 0 0 0-2 2v6.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-.5V6A4.5 4.5 0 0 0 10 1.5zm-2.5 4.5a2.5 2.5 0 0 1 5 0v2h-5z"/></svg>${T("Secure payment by HYP. The card is typed only on HYP's page.", "תשלום מאובטח של HYP. את הכרטיס מקלידים רק בעמוד של HYP.")}</p>
    </form>`);
  $("stGate").onsubmit = (e) => {
    e.preventDefault();
    if (+$("stAns").value !== a * b) { $("stErr").textContent = T("That's not right. Please ask a grown-up to help.", "התשובה לא נכונה. בקשו ממבוגר לעזור."); return; }
    if (!$("stOk").checked) { $("stErr").textContent = T("Please tick the box to agree.", "יש לסמן את התיבה כדי להסכים."); return; }
    checkout(p);
  };
}
async function api(path, body) {
  try {
    const r = await fetch(path, body ? { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { credentials: "same-origin" });
    let data = {}; try { data = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, data };
  } catch (e) { return { ok: false, status: 0, data: {} }; }
}
async function checkout(p) {
  if (busy) return; busy = true;
  const r = await api("/api/store/checkout", { product: p.id, lang });
  busy = false;
  if (r.status === 401) return openModal(`<h2>${T("Log in first", "קודם להתחבר")}</h2><p class="st-text">${T("Log in to Jumpi in this browser, then come back to the store.", "התחברו לג'אמפי בדפדפן הזה וחזרו לחנות.")}</p><a class="st-buy big" href="/play">${T("Go to the game", "למשחק")}</a>`);
  if (r.data.comingSoon) return openModal(`<h2>${T("Opening soon!", "נפתח בקרוב!")}</h2><img class="st-soon" src="/site/img/store/coins-3200.webp" alt=""><p class="st-text">${T("The store is almost ready. Payments aren't switched on yet, so nothing was charged. Come back soon!", "החנות כמעט מוכנה. התשלומים עוד לא פעילים, אז שום דבר לא חויב. חזרו בקרוב!")}</p><button class="st-buy big" type="button" data-close>${T("OK", "אישור")}</button>`);
  if (!r.ok) return openModal(`<h2>${T("Oops", "אופס")}</h2><p class="st-text">${esc(r.data.error || T("Something went wrong. Nothing was charged. Please try again.", "משהו השתבש. שום דבר לא חויב. נסו שוב."))}</p>`);
  if (r.data.url) { openModal(`<h2>${T("To the payment page…", "לעמוד התשלום…")}</h2><p class="st-text">${T("Taking you to HYP's secure payment page.", "עוברים לעמוד התשלום המאובטח של HYP.")}</p>`); location.href = r.data.url; return; }
  if (r.data.test) {
    openModal(`<h2>${T("Test payment", "תשלום בדיקה")}</h2><p class="st-text">${T("Payments aren't connected yet. As an admin you can finish this order with a pretend payment to test the store. No money moves.", "הסליקה עוד לא מחוברת. בתור מנהל אפשר לסיים את ההזמנה בתשלום מדומה כדי לבדוק את החנות. שום כסף לא עובר.")}</p><button class="st-buy big" id="stFake" type="button">${T("Pretend to pay", "תשלום מדומה")} ${money(p)}</button>`);
    $("stFake").onclick = async () => {
      const t = await api("/api/store/test-pay", { orderId: r.data.orderId });
      if (t.ok && t.data.ok) return done(p.id);
      openModal(`<h2>${T("Oops", "אופס")}</h2><p class="st-text">${esc(t.data.error || (t.data.duplicate ? "Already bought." : "Didn't work."))}</p>`);
    };
  }
}
async function done(id) {
  const p = PRODUCT_BY_ID[id];
  await loadMe();
  openModal(`<div class="st-yay"><img src="${artOf(p)}" alt=""><h2>${T("Thank you!", "תודה!")}</h2>
    <p class="st-text">${p ? T(`${p.name.en} is in your Jumpi account. If the game is open, it's already there!`, `${p.name.he} כבר בחשבון שלכם. אם המשחק פתוח, זה כבר שם!`) : ""}</p><a class="st-buy big" href="/play">${T("Play now", "לשחק עכשיו")}</a></div>`);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest(".st-buy[data-p]"); if (!b) return;
  const p = PRODUCT_BY_ID[b.dataset.p]; if (p) grownUpCheck(p);
});

async function loadMe() {
  const r = await api("/api/store/me");
  ME = r.ok ? r.data : null;
  render();
}

let start = "en";
try { start = new URLSearchParams(location.search).get("lang") || localStorage.getItem("jumpi-lang") || "en"; } catch (e) {}
setLang(start);
loadMe().then(() => {
  const q = new URLSearchParams(location.search);
  if (q.get("payment") === "ok") done(q.get("product"));
  else if (q.get("payment") === "check") openModal(`<h2>${T("We're checking your payment", "אנחנו בודקים את התשלום")}</h2><p class="st-text">${T("The payment company didn't confirm it yet. If you were charged, the goodies will reach your account soon. Questions? Write to support@jumpigames.com", "חברת הסליקה עוד לא אישרה את התשלום. אם חויבתם, ההפתעות יגיעו לחשבון בקרוב. שאלות? כתבו ל־support@jumpigames.com")}</p>`);
  else if (q.get("payment") === "failed") openModal(`<h2>${T("Payment didn't go through", "התשלום לא עבר")}</h2><p class="st-text">${T("Nothing was charged. You can try again.", "שום דבר לא חויב. אפשר לנסות שוב.")}</p>`);
  // links from the game: /store#bundle-sakura → scroll there and light it up
  const id = location.hash.slice(1), el = id && document.getElementById(id);
  if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("flash"); }
});
