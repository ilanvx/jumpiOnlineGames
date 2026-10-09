/* /team page: English ⇄ Hebrew, the role picker (tabs ⇄ form ⇄ the 3D crew in team3d.js) and the application form. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const MODS = ["manager", "guide"];                   // roles with moderation powers: they also answer the experience + situation questions
  const MIN = { manager: 16, guide: 15, beta: 13 };    // youngest age for each role (routes/team.js checks the same)
  const NAME = { en: { manager: "Community Manager", guide: "Guide", beta: "Beta Tester" }, he: { manager: "מנהל/ת קהילה", guide: "משגיח/ה", beta: "בודק/ת בטא" } };
  let lang = "en", role = "manager";

  const T = {
    en: {
      title: "Join the Team · Jumpi Games",
      say: { manager: "I keep the Jumpi community happy, busy and safe!", guide: "Welcome to the Plaza! Need a hand finding something?", beta: "Found one! A bug, hiding behind the fountain…" },
      aboutAdult: "Tell us about your experience with communities, moderation or kids",
      aboutBeta: "Have you tested games or apps before? (optional)",
      sending: "Sending…",
      young: (r, min, a, best) => `${r} is from age ${min}.` + (best ? ` At ${a} you can apply as ${best}.` : ""), switchTo: (b) => `Switch to ${b}`,
      need: { role: "Pick a role first.", name: "Please write your name.", email: "Please enter a valid email address.", age: "Please enter your age (13 or older).", young: (r, min) => `${r} is from age ${min}.`,
        hours: "How many hours a week could you give?", devices: "Pick at least one device to test on.", why: "Tell us a little more about why you want to join (at least 30 characters).",
        about: "Tell us a little about your experience (at least 30 characters).", scenario: "Please answer the situation question.", link: "That link doesn't look right (start it with https://).",
        parentOk: "Under 18? Please tick that your parent approves.", consent: "Please agree that we can keep your application." },
      fail: "Couldn't send. Please try again in a moment.",
    },
    he: {
      title: "הצטרפו לצוות · ג'אמפי גיימס",
      say: { manager: "אני דואג שקהילת ג'אמפי תהיה שמחה, פעילה ובטוחה!", guide: "ברוכים הבאים לפלאזה! צריכים עזרה למצוא משהו?", beta: "מצאתי! באג שהתחבא מאחורי המזרקה…" },
      aboutAdult: "ספרו לנו על הניסיון שלכם עם קהילות, מודרציה או ילדים",
      aboutBeta: "בדקתם משחקים או אפליקציות בעבר? (לא חובה)",
      sending: "שולח…",
      young: (r, min, a, best) => `התפקיד ${r} הוא מגיל ${min}.` + (best ? ` בגיל ${a} אפשר להגיש לתפקיד ${best}.` : ""), switchTo: (b) => `מעבר לתפקיד ${b}`,
      need: { role: "קודם בחרו תפקיד.", name: "נא לכתוב את השם שלכם.", email: "נא להקליד כתובת מייל תקינה.", age: "נא להקליד את הגיל שלכם (13 ומעלה).", young: (r, min) => `התפקיד ${r} הוא מגיל ${min}.`,
        hours: "כמה שעות בשבוע תוכלו להקדיש?", devices: "בחרו לפחות מכשיר אחד לבדיקה.", why: "ספרו לנו קצת יותר למה אתם רוצים להצטרף (לפחות 30 תווים).",
        about: "ספרו לנו קצת על הניסיון שלכם (לפחות 30 תווים).", scenario: "נא לענות על שאלת המקרה.", link: "הקישור לא נראה תקין (התחילו ב־https://).",
        parentOk: "מתחת לגיל 18? נא לסמן שהורה מאשר.", consent: "נא לאשר שנשמור את הבקשה." },
      fail: "השליחה לא הצליחה. נסו שוב עוד רגע.",
    },
  };
  const signal = (name, detail) => dispatchEvent(new CustomEvent(name, { detail }));

  /* ---------- language ---------- */
  function setLang(l) {
    lang = l === "he" ? "he" : "en";
    const html = document.documentElement;
    html.lang = lang; html.dir = lang === "he" ? "rtl" : "ltr";
    $$(".lang-sw [data-l]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.l === lang));
    $$("[data-en]").forEach((el) => (el.textContent = el.dataset[lang]));
    $$("[data-en-h]").forEach((el) => (el.innerHTML = el.dataset[lang + "H"]));   // our own static strings only
    $$("[data-en-ph]").forEach((el) => (el.placeholder = el.dataset[lang + "Ph"]));
    document.title = T[lang].title;
    syncForm();
    say(true);
    $("#tmOut").textContent = "";
    signal("tm:lang", lang);
    try { localStorage.setItem("jumpi-lang", lang); } catch (e) {}
  }
  $$(".lang-sw [data-l]").forEach((b) => (b.onclick = () => setLang(b.dataset.l)));

  /* ---------- the role: one choice shared by the tabs, the form and the 3D crew ---------- */
  const view = $("#roleView"), bubble = $("#roleSay");
  function say(quiet) {
    bubble.textContent = T[lang].say[role];
    if (!quiet) { bubble.classList.remove("pop"); void bubble.offsetWidth; bubble.classList.add("pop"); }
  }
  function setRole(r, from) {
    if (!["manager", "guide", "beta"].includes(r)) return;
    const changed = r !== role;
    role = r;
    view.dataset.role = r;
    $$(".rtab").forEach((t) => t.setAttribute("aria-selected", t.dataset.role === r));
    $$(".role-panel").forEach((p) => {
      const on = p.dataset.role === r;
      p.hidden = !on;
      if (on && changed) { p.classList.remove("enter"); void p.offsetWidth; p.classList.add("enter"); }
    });
    const radio = $(`#tmForm input[name="role"][value="${r}"]`);
    if (radio) radio.checked = true;
    $$(".tag3d").forEach((t) => t.classList.toggle("on", t.dataset.role === r));
    syncForm();
    if (changed || from === "3d") say();
    if (from !== "3d") signal("tm:role", r);
  }
  $$(".rtab").forEach((t) => t.addEventListener("click", () => setRole(t.dataset.role, "tab")));
  // arrow keys move between the tabs
  $(".role-tabs").addEventListener("keydown", (e) => {
    const tabs = $$(".rtab"), i = tabs.findIndex((t) => t.dataset.role === role);
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    const n = tabs[(i + (document.documentElement.dir === "rtl" && e.key.startsWith("Arrow") && /Left|Right/.test(e.key) ? -dir : dir) + tabs.length) % tabs.length];
    n.focus(); setRole(n.dataset.role, "tab");
  });
  $$("[data-pick]").forEach((a) => a.addEventListener("click", () => setRole(a.dataset.pick, "tab")));
  $$(".tag3d").forEach((t) => t.addEventListener("click", () => { setRole(t.dataset.role, "tag"); }));
  addEventListener("tm:pick", (e) => setRole(e.detail, "3d"));   // a Jumpi was clicked in 3D

  /* ---------- the form ---------- */
  const form = $("#tmForm"), out = $("#tmOut"), send = $("#tmSend");
  const val = (n) => (form.elements[n] ? String(form.elements[n].value || "").trim() : "");
  const many = (n) => $$(`input[name="${n}"]:checked`, form).map((i) => i.value);
  const age = () => { const a = parseInt(val("age"), 10); return Number.isFinite(a) ? a : null; };

  // the oldest-age role this age can apply for (manager → guide → beta)
  const bestFor = (a) => ["manager", "guide", "beta"].find((r) => a >= MIN[r]);
  function syncForm() {
    const mod = MODS.includes(role), a = age();
    $("#fDevices").hidden = role !== "beta";
    $("#fScenario").hidden = !mod;
    $("#aboutLbl").textContent = mod ? T[lang].aboutAdult : T[lang].aboutBeta;
    const young = a != null && a >= 13 && a < MIN[role], best = young ? bestFor(a) : null;
    $("#ageWarn").hidden = !young;
    if (young) {
      $("#ageWarnTxt").textContent = T[lang].young(NAME[lang][role], MIN[role], a, best && NAME[lang][best]);
      $("#ageSwitch").textContent = best ? T[lang].switchTo(NAME[lang][best]) : "";
      $("#ageSwitch").hidden = !best; $("#ageSwitch").dataset.role = best || "";
    }
    $("#fParent").hidden = !(a != null && a >= 13 && a < 18);
  }
  form.addEventListener("change", (e) => {
    if (e.target.name === "role") setRole(e.target.value, "form");
    clearBad(e.target);
  });
  form.addEventListener("input", (e) => {
    clearBad(e.target);
    if (e.target.name === "age") syncForm();
    const c = $(`.count[data-for="${e.target.name}"]`, form);
    if (c) c.textContent = `${e.target.value.length}/${e.target.maxLength}`;
  });
  $("#ageSwitch").addEventListener("click", (e) => { const r = e.currentTarget.dataset.role; if (!r) return; setRole(r, "form"); $(`#tmForm input[name="role"][value="${r}"]`).focus(); });

  function clearBad(el) { const f = el.closest("[data-f]"); if (f) f.classList.remove("bad"); }
  function bad(field, msg) {
    out.className = "form-msg err"; out.textContent = msg;
    const f = $(`[data-f="${field}"]`, form) || (field === "role" ? $("#fRoles") : null);
    if (f) {
      f.classList.add("bad");
      const inp = f.querySelector("input,textarea");
      f.scrollIntoView({ behavior: "smooth", block: "center" });
      if (inp) setTimeout(() => inp.focus({ preventScroll: true }), 350);
    }
    return false;
  }
  function check() {
    const N = T[lang].need, adult = MODS.includes(role), a = age();
    if (val("name").length < 2) return bad("name", N.name);
    if (a == null || a < 13 || a > 99) return bad("age", N.age);
    if (a < MIN[role]) return bad("age", N.young(NAME[lang][role], MIN[role]));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val("email"))) return bad("email", N.email);
    if (!many("hours").length) return bad("hours", N.hours);
    if (role === "beta" && !many("devices").length) return bad("devices", N.devices);
    if (val("why").length < 30) return bad("why", N.why);
    if (adult && val("about").length < 30) return bad("about", N.about);
    if (adult && val("scenario").length < 20) return bad("scenario", N.scenario);
    if (val("link") && !/^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i.test(val("link"))) return bad("link", N.link);
    if (a < 18 && !form.elements.parentOk.checked) return bad("parentOk", N.parentOk);
    if (!form.elements.consent.checked) return bad("consent", N.consent);
    return true;
  }

  let busy = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy || !check()) return;
    busy = true; send.disabled = true; out.className = "form-msg"; out.textContent = T[lang].sending;
    const body = {
      role, name: val("name"), age: age(), email: val("email"), country: val("country"), languages: many("languages"), username: val("username"), discord: val("discord"),
      hours: many("hours")[0] || "", devices: role === "beta" ? many("devices") : [], why: val("why"), about: val("about"), scenario: MODS.includes(role) ? val("scenario") : "",
      link: val("link"), parentOk: !!form.elements.parentOk.checked && age() < 18, consent: !!form.elements.consent.checked, website: val("website"), lang,
    };
    try {
      const r = await fetch("/api/team/apply", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { if (d.field) bad(d.field, d.error || T[lang].fail); else { out.className = "form-msg err"; out.textContent = d.error || T[lang].fail; } }
      else done();
    } catch (err) {
      out.className = "form-msg err"; out.textContent = T[lang].fail;
    }
    busy = false; send.disabled = false;
  });
  function done() {
    out.textContent = "";
    form.hidden = true;
    const d = $("#tmDone");
    d.hidden = false;
    d.querySelectorAll(".done-burst i").forEach((i) => { i.style.animation = "none"; void i.offsetWidth; i.style.animation = ""; });
    d.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => d.focus({ preventScroll: true }), 400);
    signal("tm:sent");
  }
  $("#tmAgain").addEventListener("click", () => {
    // keep who they are, clear the answers and the role-specific bits
    ["why", "about", "scenario"].forEach((n) => { form.elements[n].value = ""; const c = $(`.count[data-for="${n}"]`, form); if (c) c.textContent = `0/${form.elements[n].maxLength}`; });
    $$('input[name="devices"]', form).forEach((i) => (i.checked = false));
    $("#tmDone").hidden = true; form.hidden = false;
    $("#fRoles").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  /* ---------- sections float in as you scroll ---------- */
  const io = "IntersectionObserver" in window ? new IntersectionObserver((list) => list.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -12% 0px" }) : null;
  $$(".sec-head, .role-tabs, .role-view, .safe-card, .levels li, .tm-form, .faq details").forEach((el, i) => {
    if (!io) return;
    el.classList.add("reveal");
    if (el.matches(".levels li")) el.style.transitionDelay = `${(i % 4) * 0.1}s`;
    io.observe(el);
  });

  /* ---------- start ---------- */
  let start = "en", startRole = "";
  try {
    const q = new URLSearchParams(location.search);
    start = q.get("lang") || localStorage.getItem("jumpi-lang") || "en";
    startRole = q.get("role") || "";
  } catch (e) {}
  setLang(start);
  if (startRole) setRole(startRole, "url");
})();
