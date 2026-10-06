/* Contact page: English ⇄ Hebrew, the form, and little signals for the 3D helper (contact3d.js). */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  let lang = "en";
  const T = {
    en: {
      bubble: { general: "Ask me anything about Jumpi!", safety: "Thanks for keeping Jumpi safe. Tell me what happened.", privacy: "Privacy questions? I'll pass it to the right person.",
        account: "Trouble with your account? Let's fix it.", bug: "Uh-oh! Tell me what broke and where.", idea: "Ooh, an idea! I love ideas!" },
      typing: "I'm listening…", sending: "Sending…", sent: "Got it! We'll reply to your email soon. 💌", again: "Want to send another one?",
      email: "Please enter a valid email address.", short: "Please write a little more (at least 10 characters).", fail: "Couldn't send. Please try again, or email support@jumpigames.com.",
    },
    he: {
      bubble: { general: "תשאלו אותי כל דבר על ג'אמפי!", safety: "תודה ששומרים על ג'אמפי בטוח. ספרו לי מה קרה.", privacy: "שאלות על פרטיות? אעביר לאדם הנכון.",
        account: "בעיה עם החשבון? בואו נסדר את זה.", bug: "אוי! ספרו לי מה נשבר ואיפה.", idea: "וואו, רעיון! אני אוהב רעיונות!" },
      typing: "אני מקשיב…", sending: "שולח…", sent: "קיבלנו! נענה לכם במייל בקרוב. 💌", again: "רוצים לשלוח עוד הודעה?",
      email: "נא להקליד כתובת מייל תקינה.", short: "נא לכתוב קצת יותר (לפחות 10 תווים).", fail: "השליחה לא הצליחה. נסו שוב, או כתבו ל־support@jumpigames.com.",
    },
  };
  const bubble = $("#ctBubble"), form = $("#ctForm"), out = $("#ctMsgOut"), send = $("#ctSend"), msg = $("#ctMsg"), email = $("#ctEmail");
  const topic = () => (form.querySelector('input[name="topic"]:checked') || {}).value || "general";
  let bubbleT = 0;
  function say(text, hold) {
    bubble.textContent = text;
    bubble.classList.remove("pop"); void bubble.offsetWidth; bubble.classList.add("pop");
    clearTimeout(bubbleT);
    if (!hold) bubbleT = setTimeout(() => bubble.classList.remove("pop"), 300);
  }
  const signal = (name, detail) => dispatchEvent(new CustomEvent(name, { detail }));

  function setLang(l) {
    lang = l === "he" ? "he" : "en";
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
    document.querySelectorAll(".lang-sw [data-l]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.l === lang));
    document.querySelectorAll("[data-en]").forEach((el) => (el.textContent = el.dataset[lang]));
    document.querySelectorAll("[data-en-ph]").forEach((el) => (el.placeholder = el.dataset[lang + "Ph"]));
    document.title = lang === "he" ? "צור קשר · ג'אמפי גיימס" : "Contact · Jumpi Games";
    if (out.textContent) out.textContent = "";
    try { localStorage.setItem("jumpi-lang", lang); } catch (e) {}
  }
  document.querySelectorAll(".lang-sw [data-l]").forEach((b) => (b.onclick = () => setLang(b.dataset.l)));
  let start = "en";
  try { start = new URLSearchParams(location.search).get("lang") || localStorage.getItem("jumpi-lang") || "en"; } catch (e) {}
  setLang(start);

  form.addEventListener("change", (e) => {
    if (e.target.name !== "topic") return;
    const t = topic();
    $("#safetyTip").hidden = t !== "safety";
    say(T[lang].bubble[t]);
    signal("ct:topic", t);
  });
  let typingT = 0, typingSaid = false;
  msg.addEventListener("input", () => {
    $("#ctCount").textContent = msg.value.length;
    msg.closest(".field").classList.remove("bad");
    if (!typingSaid) { typingSaid = true; say(T[lang].typing); }
    signal("ct:typing", true);
    clearTimeout(typingT);
    typingT = setTimeout(() => { typingSaid = false; signal("ct:typing", false); }, 1500);
  });
  email.addEventListener("input", () => email.closest(".field").classList.remove("bad"));

  let busy = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const L = T[lang];
    out.className = "form-msg err";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) { out.textContent = L.email; email.closest(".field").classList.add("bad"); email.focus(); return; }
    if (msg.value.trim().length < 10) { out.textContent = L.short; msg.closest(".field").classList.add("bad"); msg.focus(); return; }
    busy = true; send.disabled = true; out.className = "form-msg"; out.textContent = L.sending;
    try {
      const r = await fetch("/api/contact", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: $("#ctName").value, email: email.value, topic: topic(), message: msg.value, website: form.website.value, lang }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || L.fail);
      out.className = "form-msg ok"; out.textContent = L.sent;
      say(L.sent, true);
      signal("ct:sent");
      msg.value = ""; $("#ctCount").textContent = "0";
      setTimeout(() => say(L.again), 5000);
    } catch (err) {
      out.className = "form-msg err";
      out.textContent = lang === "he" ? L.fail : err.message || L.fail;
    }
    busy = false; send.disabled = false;
  });
})();
