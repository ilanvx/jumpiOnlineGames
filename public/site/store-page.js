/* Jumpi Store page: the cards, the cart (a panel on the right), and buying:
   cart → log in to the account that gets it (only for this purchase: nothing is saved, the game's login doesn't count)
   → the grown-up confirms and agrees → HYP's payment page. */
import { PRODUCTS, PRODUCT_BY_ID, MEMBER_PERKS } from "/shared/store.js";

const $ = (id) => document.getElementById(id);
let lang = "en";
const T = (en, he) => (lang === "he" ? he : en);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ils = (n) => "₪" + n.toFixed(2);
const money = (p) => ils(p.price);
const num = (n) => n.toLocaleString(lang === "he" ? "he-IL" : "en-US");
const ITEM_NAMES = {
  "hair:4": ["Electric Spiky hair", "שיער ספייקי חשמלי"], "hair:6": ["Pink Pigtails", "קוקיות ורודות"], "shirt:4": ["Jumpi tee", "חולצת ג'אמפי"], "shirt:7": ["Tuxedo", "טוקסידו"],
  "pants:4": ["Pink jeans", "ג'ינס ורוד"], "pants:7": ["Gold shorts", "מכנסי זהב"], "glasses:4": ["Heart glasses", "משקפי לבבות"], "glasses:5": ["Neon shades", "משקפי ניאון"],
  "aura:8": ["Sakura Breeze aura", "הילת סאקורה"], "aura:9": ["Crown of Stars aura", "הילת כתר הכוכבים"], "tag:8": ["Crown name tag", "תג כתר"],
};
const itemName = (id) => (ITEM_NAMES[id] ? T(...ITEM_NAMES[id]) : id);
const ICON = {
  cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2.2l2.1 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 1.9-1.4L21 8H6.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="19.5" r="1.6" fill="currentColor"/><circle cx="17" cy="19.5" r="1.6" fill="currentColor"/></svg>',
  lock: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5a4.5 4.5 0 0 0-4.5 4.5v2H5a2 2 0 0 0-2 2v6.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-.5V6A4.5 4.5 0 0 0 10 1.5zm-2.5 4.5a2.5 2.5 0 0 1 5 0v2h-5z"/></svg>',
  x: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5 L15 15 M15 5 L5 15" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4 L6.5 10 L12.5 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2M6 6l.8 10h6.4L14 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

/* ---------- language (same choice as the rest of the site) ---------- */
const btns = [...document.querySelectorAll(".lang-sw [data-l]")];
function setLang(l) {
  lang = l === "he" ? "he" : "en";
  btns.forEach((b) => b.setAttribute("aria-pressed", b.dataset.l === lang));
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  document.querySelectorAll("[data-en]").forEach((el) => (el.textContent = lang === "he" ? el.dataset.he : el.dataset.en));
  try { localStorage.setItem("jumpi-lang", lang); } catch (e) {}
  render(); paintCart();
}
btns.forEach((b) => (b.onclick = () => setLang(b.dataset.l)));

/* ---------- the cart: [{ id, qty }], kept for this tab only (the login is never kept) ---------- */
let CART = [];
try { CART = (JSON.parse(sessionStorage.getItem("jumpi-cart") || "[]") || []).filter((l) => PRODUCT_BY_ID[l.id] && l.qty >= 1).slice(0, 12); } catch (e) { CART = []; }
const saveCart = () => { try { sessionStorage.setItem("jumpi-cart", JSON.stringify(CART)); } catch (e) {} };
const inCart = (id) => CART.find((l) => l.id === id);
const cartTotal = () => Math.round(CART.reduce((a, l) => a + PRODUCT_BY_ID[l.id].price * 100 * l.qty, 0)) / 100;
const cartCount = () => CART.reduce((a, l) => a + l.qty, 0);
function addToCart(id) {
  const P = PRODUCT_BY_ID[id]; if (!P) return;
  const l = inCart(id);
  if (l) { if (!P.once && l.qty < 10) l.qty++; }
  else { if (CART.length >= 12) return openCart("cart"); CART.push({ id, qty: 1 }); }
  saveCart(); render(); openCart("cart", id);
  const n = $("cartN"); n.classList.remove("pop"); void n.offsetWidth; n.classList.add("pop");
}
function setQty(id, q) {
  const l = inCart(id); if (!l) return;
  if (q <= 0) CART = CART.filter((x) => x.id !== id); else l.qty = Math.min(10, q);
  saveCart(); render(); paintCart();
}

/* ---------- the cards ---------- */
// the picture of each product (made ahead of time: coins and memberships in img/store/, bundles in img/)
const artOf = (p) => (p ? (p.kind === "bundle" ? `/site/img/${p.id}.png` : `/site/img/store/${p.id}.webp`) : "/site/img/store/coins-4000.webp");
const PASS_COLOR = { 7: "#1fb6ff", 30: "#8a4dff", 90: "#ff8a1c", 365: "#ff4f8b" };
const tag = (p) => (p.tag === "popular" ? `<span class="st-tag">${T("Most popular", "הכי פופולרי")}</span>` : p.tag === "best" ? `<span class="st-tag best">${T("Best value", "הכי משתלם")}</span>` : "");
function addBtn(p) {
  const l = inCart(p.id);
  if (p.once && l) return `<button class="st-buy in" type="button" data-open-cart>${T("In your cart", "כבר בסל")} ✓</button>`;
  return `<button class="st-buy" type="button" data-add="${p.id}" aria-label="${esc(T(`Add ${p.name.en} to the cart, ${money(p)}`, `להוסיף לסל: ${p.name.he}, ${money(p)}`))}"><span>${money(p)}</span><span class="st-addic">${ICON.cart}<b>+</b></span>${l ? `<span class="st-qbadge">${l.qty}</span>` : ""}</button>`;
}
function render() {
  // coins
  $("stCoins").innerHTML = PRODUCTS.filter((p) => p.kind === "coins").map((p) => `
    <article class="st-pack${p.tag === "best" ? " best" : ""}" id="${p.id}">${tag(p)}
      <img src="${artOf(p)}" alt="${esc(T(`${num(p.give.coins)} coins`, `${num(p.give.coins)} מטבעות`))}" width="520" height="456" loading="lazy">
      <p class="st-pname">${esc(p.name[lang])}</p>
      <p class="st-bonus">${p.bonus ? `<span>${T(`+${num(p.bonus)} bonus coins`, `+${num(p.bonus)} מטבעות בונוס`)}</span>` : "&nbsp;"}</p>
      ${addBtn(p)}
    </article>`).join("");
  // membership
  $("stPerks").querySelector("ul").innerHTML = MEMBER_PERKS.map((k) => `<li>${esc(k[lang])}</li>`).join("");
  $("stPasses").innerHTML = PRODUCTS.filter((p) => p.kind === "member").map((p) => `
    <article class="st-pass${p.tag === "popular" ? " hot" : ""}" id="${p.id}" style="--pc:${PASS_COLOR[p.days] || "#8a4dff"}">${tag(p)}${p.save ? `<span class="st-save">${T(`Save ${p.save}%`, `חיסכון ${p.save}%`)}</span>` : ""}
      <img src="${artOf(p)}" alt="" width="520" height="434" loading="lazy">
      <h3>${esc(p.name[lang])}</h3>
      <p class="st-pdays">${T(`${num(p.days)} days · ${num(p.give.coins)} welcome coins`, `${num(p.days)} ימים · ${num(p.give.coins)} מטבעות מתנה`)}</p>
      <p class="st-pday">${T(`only ₪${(p.price / p.days).toFixed(2)} a day`, `רק ₪${(p.price / p.days).toFixed(2)} ליום`)}</p>
      ${addBtn(p)}
    </article>`).join("");
  // bundles
  $("stBundles").innerHTML = PRODUCTS.filter((p) => p.kind === "bundle").map((p) => {
    const g = p.give;
    const list = [...(g.items || []).map((id) => `<li class="${id.startsWith("aura:") ? "aura" : ""}">${esc(itemName(id))}</li>`),
      g.coins ? `<li class="coins">${num(g.coins)} ${T("coins", "מטבעות")}</li>` : "", g.memberDays ? `<li class="member">${T(`${g.memberDays} days of membership`, `${g.memberDays} ימי מנוי`)}</li>` : ""].join("");
    return `<article class="st-bundle" id="${p.id}" style="--bc:${p.color}">
      <div class="st-art"><img src="${artOf(p)}" alt="" width="460" height="460" loading="lazy"></div>
      <div class="st-bbody"><h3>${esc(p.name[lang])}</h3><p>${esc(p.blurb[lang])}</p><ul class="st-list">${list}</ul>
      <p class="st-once">${T("One per account", "אחת לכל חשבון")}</p>
      <div class="st-buyrow">${addBtn(p)}</div></div></article>`;
  }).join("");
  const n = cartCount();
  $("cartN").textContent = n; $("cartN").hidden = !n;
  $("cartBtn").setAttribute("aria-label", T(`Cart, ${n} items`, `הסל, ${n} פריטים`));
}

/* ---------- the panel on the right: cart → log in → pay ---------- */
const S = { step: "cart", token: null, me: null, timer: 0, busy: false, msg: "", flash: null, pay: null };
const panel = $("stCart"), body = $("stCartBody");
let lastFocus = null;
function openCart(step = "cart", flash = null) {
  if (step === "pay" && !S.token) step = "login";
  S.step = step; S.flash = flash; S.msg = "";
  if (panel.hidden) { lastFocus = document.activeElement; panel.hidden = false; document.body.classList.add("st-cart-on"); requestAnimationFrame(() => panel.classList.add("on")); }
  paintCart(true);
}
function closeCart() {
  panel.classList.remove("on"); document.body.classList.remove("st-cart-on");
  setTimeout(() => { if (!panel.classList.contains("on")) panel.hidden = true; }, 260);
  lastFocus && lastFocus.focus && lastFocus.focus();
}
// the login is for this purchase only: forget it (here and on the server)
function forgetLogin() {
  if (S.token) fetch("/api/store/logout", { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: S.token }), keepalive: true }).catch(() => {});
  S.token = null; S.me = null; clearTimeout(S.timer);
}
addEventListener("pagehide", forgetLogin);
$("cartBtn").onclick = () => openCart("cart");
panel.addEventListener("click", (e) => { if (e.target.closest("[data-cclose]")) closeCart(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden && modal.hidden) closeCart(); });

const line = (l, small) => {
  const P = PRODUCT_BY_ID[l.id];
  return `<li class="st-line${S.flash === l.id ? " new" : ""}">
    <img src="${artOf(P)}" alt="">
    <div class="st-lmain"><b>${esc(P.name[lang])}</b><span>${P.kind === "coins" ? T(`${num(P.give.coins)} coins`, `${num(P.give.coins)} מטבעות`) : P.kind === "member" ? T(`${num(P.days)} days of membership`, `${num(P.days)} ימי מנוי`) : T("Special bundle", "חבילה מיוחדת")} · ${money(P)}</span>
      ${small ? (l.qty > 1 ? `<span>× ${l.qty}</span>` : "") : P.once ? `<span class="st-lone">${T("One per account", "אחת לכל חשבון")}</span>` : `<div class="st-qty" role="group" aria-label="${T("How many", "כמות")}"><button type="button" data-q="${l.id}" data-d="-1" aria-label="${T("One less", "פחות אחד")}">−</button><output>${l.qty}</output><button type="button" data-q="${l.id}" data-d="1" aria-label="${T("One more", "עוד אחד")}" ${l.qty >= 10 ? "disabled" : ""}>+</button></div>`}
    </div>
    <div class="st-lend"><b>${ils(P.price * l.qty)}</b>${small ? "" : `<button type="button" class="st-del" data-del="${l.id}" aria-label="${T("Remove", "להסיר")}">${ICON.trash}</button>`}</div>
  </li>`;
};
const total = (label) => `<div class="st-total"><span>${label}</span><b>${ils(cartTotal())}</b></div>`;
function paintCart(focus) {
  if (panel.hidden) return;
  const title = { cart: T("Your cart", "הסל שלך"), login: T("Log in to buy", "התחברות לרכישה"), pay: T("Checkout", "סיום הרכישה"), test: T("Test payment", "תשלום בדיקה") }[S.step];
  $("stCartTitle").textContent = title;
  $("stCartBack").hidden = S.step === "cart";
  const msg = S.msg ? `<p class="st-err" role="alert">${esc(S.msg)}</p>` : "";
  if (S.step === "cart") {
    if (!CART.length) body.innerHTML = `<div class="st-empty"><img src="/site/img/store/coins-800.webp" alt=""><p>${T("Your cart is empty. Pick some coins, a membership or a bundle!", "הסל ריק. בחרו מטבעות, מנוי או חבילה!")}</p><button class="st-buy big" type="button" data-cclose>${T("Back to the store", "חזרה לחנות")}</button></div>`;
    else body.innerHTML = `${msg}<ul class="st-lines">${CART.map((l) => line(l)).join("")}</ul>
      <div class="st-cfoot">${total(T("Total", "סה״כ"))}
        <p class="st-cnote">${T("One payment, nothing renews by itself. Memberships add up. All purchases are final.", "תשלום אחד, שום דבר לא מתחדש לבד. מנויים מצטברים. כל הרכישות סופיות.")}</p>
        <button class="st-buy big" type="button" id="stGo">${T("Continue to checkout", "המשך לרכישה")}</button>
        <button class="st-link" type="button" data-cclose>${T("Keep shopping", "להמשיך לקנות")}</button></div>`;
  } else if (S.step === "login") {
    body.innerHTML = `<form id="stLogin" class="st-login-f" novalidate autocomplete="off">
      <p class="st-ltext">${T("Log in to the Jumpi account that should get the purchase.", "התחברו לחשבון הג'אמפי שיקבל את הרכישה.")}</p>
      <p class="st-lnote">${ICON.lock}<span>${T("This login is only for this purchase. It isn't saved, and it's separate from the game: even if you're playing, log in here.", "ההתחברות הזאת היא רק לרכישה הזאת. היא לא נשמרת, והיא נפרדת מהמשחק: גם אם אתם מחוברים במשחק, מתחברים כאן.")}</span></p>
      <label class="st-field"><span>${T("Username or email", "שם משתמש או אימייל")}</span><input id="stUser" name="jumpi-buy-user" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="80" dir="ltr" required></label>
      <label class="st-field"><span>${T("Password", "סיסמה")}</span><input id="stPass" name="jumpi-buy-pass" type="password" autocomplete="off" maxlength="72" dir="ltr" required></label>
      ${msg}
      <button class="st-buy big" type="submit" ${S.busy ? "disabled" : ""}>${S.busy ? T("Checking…", "בודקים…") : T("Log in", "התחברות")}</button>
      <a class="st-link" href="/forgot-password" target="_blank" rel="noopener">${T("Forgot the password?", "שכחתם סיסמה?")}</a>
    </form>`;
  } else if (S.step === "pay") {
    const me = S.me;
    body.innerHTML = `<div class="st-who2"><span>${T("Buying for", "קונים בשביל")} <b>${esc(me.username)}</b></span><span class="st-coinsnow">${num(me.coins)}</span><button class="st-link" type="button" id="stSwitch">${T("Not this account?", "לא החשבון הזה?")}</button></div>
      ${me.open === false && me.admin ? `<p class="st-note sm">${T("The store is closed to players. You can buy because you're an admin, and payments here are real (or pretend, in test mode).", "החנות סגורה לשחקנים. אפשר לקנות כי אתם מנהלים, והתשלומים כאן אמיתיים (או מדומים, במצב בדיקה).")}</p>` : ""}
      <ul class="st-lines small">${CART.map((l) => line(l, true)).join("")}</ul>
      <form id="stPay" class="st-cfoot" novalidate>${total(T("To pay", "לתשלום"))}
        <label class="st-agree"><input type="checkbox" id="stOk"> <span>${T("I'm the parent or guardian of this player, or over 18, and I agree to the", "אני ההורה או האפוטרופוס של השחקן, או מעל גיל 18, ואני מסכים/ה ל")} <a href="/terms#t-purchases" target="_blank">${T("purchase terms", "תנאי הרכישה")}</a>. ${T("I understand that the purchase is added to the account right away and is <b>final, with no refund</b>.", "ידוע לי שהרכישה מתווספת לחשבון מיד והיא <b>סופית, ללא החזר כספי</b>.")}</span></label>
        ${msg}
        <button class="st-buy big" type="submit" ${S.busy ? "disabled" : ""}>${S.busy ? T("One moment…", "רגע…") : T(`Pay ${ils(cartTotal())}`, `לתשלום ${ils(cartTotal())}`)}</button>
        <p class="st-secure">${ICON.lock}${T("Secure payment by HYP. The card is typed only on HYP's page.", "תשלום מאובטח של HYP. את הכרטיס מקלידים רק בעמוד של HYP.")}</p>
      </form>`;
  } else if (S.step === "test") {
    body.innerHTML = `<p class="st-text">${T("HYP isn't switched on here. As an admin you can finish this order with a pretend payment to test the store. No money moves.", "HYP לא מופעל כאן. בתור מנהל אפשר לסיים את ההזמנה בתשלום מדומה כדי לבדוק את החנות. שום כסף לא עובר.")}</p>${msg}
      <button class="st-buy big" type="button" id="stFake">${T("Pretend to pay", "תשלום מדומה")} ${ils(S.pay.amount)}</button>`;
  } else if (S.step === "soon") {
    body.innerHTML = `<div class="st-empty"><img src="/site/img/store/coins-9000.webp" alt=""><h3>${T("Opening soon!", "נפתח בקרוב!")}</h3><p>${T("The store is almost ready. Nothing was charged. Your cart will wait for you here.", "החנות כמעט מוכנה. שום דבר לא חויב. הסל יחכה לכם כאן.")}</p><button class="st-buy big" type="button" data-cclose>${T("OK", "אישור")}</button></div>`;
  }
  wire();
  if (focus) setTimeout(() => (body.querySelector("input,#stGo,button") || $("stCartX")).focus(), 60);
}
function wire() {
  body.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => setQty(b.dataset.q, inCart(b.dataset.q).qty + +b.dataset.d)));
  body.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => setQty(b.dataset.del, 0)));
  if ($("stGo")) $("stGo").onclick = () => openCart(S.token ? "pay" : "login");
  if ($("stSwitch")) $("stSwitch").onclick = () => { forgetLogin(); openCart("login"); };
  if ($("stLogin")) $("stLogin").onsubmit = login;
  if ($("stPay")) $("stPay").onsubmit = pay;
  if ($("stFake")) $("stFake").onclick = fakePay;
}
$("stCartBack").onclick = () => openCart(S.step === "pay" || S.step === "test" || S.step === "login" ? "cart" : "cart");

async function api(path, data) {
  try {
    const r = await fetch(path, { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    let d = {}; try { d = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, data: d };
  } catch (e) { return { ok: false, status: 0, data: {} }; }
}
async function login(e) {
  e.preventDefault(); if (S.busy) return;
  const u = $("stUser").value.trim(), pw = $("stPass").value;
  if (!u || !pw) { S.msg = T("Enter the username and password.", "הקלידו שם משתמש וסיסמה."); return paintCart(); }
  S.busy = true; paintCart();
  const r = await api("/api/store/login", { username: u, password: pw });
  S.busy = false;
  if (!r.ok) { S.msg = r.status === 0 ? T("No connection. Please try again.", "אין חיבור. נסו שוב.") : (r.data.error || T("Wrong username or password.", "שם משתמש או סיסמה שגויים.")); paintCart(); $("stUser").value = u; return; }
  S.token = r.data.token; S.me = r.data.me;
  clearTimeout(S.timer); S.timer = setTimeout(() => { forgetLogin(); if (S.step === "pay") { S.msg = T("For safety, the login ended. Please log in again.", "מטעמי בטיחות ההתחברות הסתיימה. התחברו שוב."); openCart("login"); } }, (r.data.minutes || 20) * 60_000 - 30_000);
  // bundles this account already has come out of the cart
  const had = CART.filter((l) => S.me.owned.includes(l.id));
  if (had.length) { CART = CART.filter((l) => !S.me.owned.includes(l.id)); saveCart(); render(); }
  if (!CART.length) { S.step = "cart"; S.msg = T("This account already has everything that was in the cart.", "לחשבון הזה כבר יש את כל מה שהיה בסל."); return paintCart(); }
  openCart("pay");
  if (had.length) { S.msg = T(`Removed from the cart: ${had.map((l) => PRODUCT_BY_ID[l.id].name.en).join(", ")} (this account already has it).`, `הוסר מהסל: ${had.map((l) => PRODUCT_BY_ID[l.id].name.he).join(", ")} (כבר יש לחשבון הזה).`); paintCart(); }
}
async function pay(e) {
  e.preventDefault(); if (S.busy) return;
  if (!$("stOk").checked) { S.msg = T("Please tick the box to agree.", "יש לסמן את התיבה כדי להסכים."); return paintCart(); }
  S.busy = true; S.msg = ""; paintCart();
  const r = await api("/api/store/checkout", { token: S.token, cart: CART.map((l) => ({ id: l.id, qty: l.qty })), agree: true, lang });
  S.busy = false;
  if (r.status === 401 || r.data.login) { forgetLogin(); S.msg = T("Please log in again to buy.", "התחברו שוב כדי לקנות."); return openCart("login"); }
  if (r.data.comingSoon) { forgetLogin(); return openCart("soon"); }
  if (r.data.owned) { CART = CART.filter((l) => l.id !== r.data.owned); saveCart(); render(); }
  if (!r.ok) { S.msg = r.data.error || T("Something went wrong. Nothing was charged. Please try again.", "משהו השתבש. שום דבר לא חויב. נסו שוב."); return paintCart(); }
  if (r.data.url) {
    S.token = null; clearTimeout(S.timer);   // the server already ended this login
    body.innerHTML = `<div class="st-empty"><img src="/site/img/store/coins-4000.webp" alt=""><h3>${T("To the payment page…", "לעמוד התשלום…")}</h3><p>${T("Taking you to HYP's secure payment page.", "עוברים לעמוד התשלום המאובטח של HYP.")}</p></div>`;
    location.href = r.data.url; return;
  }
  if (r.data.test) { S.token = null; S.pay = r.data; openCart("test"); }
}
async function fakePay() {
  const t = await api("/api/store/test-pay", { orderId: S.pay.orderId });
  if (t.ok && t.data.ok) { closeCart(); return done(t.data.product); }
  S.msg = t.data.error || (t.data.duplicate ? T("Already bought.", "כבר נקנה.") : T("Didn't work.", "לא עבד.")); paintCart();
}

/* ---------- messages in the middle of the page ---------- */
const modal = $("stModal"), dlg = $("stDlg");
function openModal(html) { dlg.innerHTML = html; modal.hidden = false; setTimeout(() => (dlg.querySelector("a,button") || $("stClose")).focus(), 30); }
function closeModal() { modal.hidden = true; }
$("stClose").onclick = closeModal;
modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest("[data-close]")) closeModal(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });
function done(id) {
  const p = PRODUCT_BY_ID[id];
  CART = []; saveCart(); render();
  openModal(`<div class="st-yay"><img src="${artOf(p)}" alt=""><h2>${T("Thank you!", "תודה!")}</h2>
    <p class="st-text">${p ? T(`${p.name.en} is in the Jumpi account. If the game is open, it's already there!`, `${p.name.he} כבר בחשבון הג'אמפי. אם המשחק פתוח, זה כבר שם!`) : T("Everything you bought is in the Jumpi account. If the game is open, it's already there!", "כל מה שקניתם כבר בחשבון הג'אמפי. אם המשחק פתוח, זה כבר שם!")}</p><a class="st-buy big" href="/play">${T("Play now", "לשחק עכשיו")}</a></div>`);
}

/* ---------- start ---------- */
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-add]"); if (a) return addToCart(a.dataset.add);
  if (e.target.closest("[data-open-cart]")) openCart("cart");
});
let start = "en";
try { start = new URLSearchParams(location.search).get("lang") || localStorage.getItem("jumpi-lang") || "en"; } catch (e) {}
setLang(start);
{
  const q = new URLSearchParams(location.search);
  if (q.get("payment") === "ok") done(q.get("product"));
  else if (q.get("payment") === "check") openModal(`<h2>${T("We're checking your payment", "אנחנו בודקים את התשלום")}</h2><p class="st-text">${T("The payment company didn't confirm it yet. If you were charged, the purchase will reach the account soon. Didn't get it? Write to us on the Contact page.", "חברת הסליקה עוד לא אישרה את התשלום. אם חויבתם, הרכישה תגיע לחשבון בקרוב. לא קיבלתם? כתבו לנו בעמוד צור קשר.")}</p><a class="st-buy big" href="/contact">${T("Contact us", "צור קשר")}</a>`);
  else if (q.get("payment") === "failed") openModal(`<h2>${T("Payment didn't go through", "התשלום לא עבר")}</h2><p class="st-text">${T("Nothing was charged. Your cart is still here, you can try again.", "שום דבר לא חויב. הסל עדיין כאן, אפשר לנסות שוב.")}</p>`);
  // links from the game: /store#bundle-sakura → scroll there and light it up
  const id = location.hash.slice(1), el = id && document.getElementById(id);
  if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("flash"); }
}
