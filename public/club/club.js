/* Jumpi Club: log in with the same Jumpi account as the game (the server's /api/auth). The language is the same choice
   as the rest of the site (localStorage "jumpi-lang"); someone who never picked one and whose phone is in Hebrew sees Hebrew. */
const $ = (id) => document.getElementById(id);
const btns = [...document.querySelectorAll(".lang-sw [data-set]")];
const T = {
  en: { empty: "Type your username and password.", fail: "Something went wrong. Please try again.", net: "No connection. Check your internet and try again.",
    verify: "Please check your email first: open the Jumpi game to finish making your account.", show: "Show password", hide: "Hide password", wait: "Logging in…" },
  he: { empty: "צריך למלא שם משתמש וסיסמה.", fail: "משהו השתבש. נסו שוב.", net: "אין חיבור. בדקו את האינטרנט ונסו שוב.",
    verify: "צריך לאשר קודם את האימייל: פתחו את המשחק של ג'אמפי כדי לסיים לפתוח את החשבון.", show: "הצגת הסיסמה", hide: "הסתרת הסיסמה", wait: "מתחברים…" },
};
let lang = "en";
const t = (k) => T[lang][k];
function setLang(l) {
  lang = l === "he" ? "he" : "en";
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  btns.forEach((b) => b.setAttribute("aria-pressed", b.dataset.set === lang));
  $("clEye").setAttribute("aria-label", $("clEye").getAttribute("aria-pressed") === "true" ? t("hide") : t("show"));
  try { localStorage.setItem("jumpi-lang", lang); } catch (e) {}
}
btns.forEach((b) => (b.onclick = () => setLang(b.dataset.set)));
{ let start = null; try { start = new URLSearchParams(location.search).get("lang") || localStorage.getItem("jumpi-lang"); } catch (e) {}
  setLang(start || (/^he|^iw/i.test(navigator.language || "") ? "he" : "en")); }

async function api(path, body) {
  const r = await fetch("/api/auth/" + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) } : { credentials: "same-origin" });
  let data = {}; try { data = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, data };
}
// the server's messages in Hebrew (the ones a log-in can give); anything else is shown as it comes
const HE_ERR = [
  [/^Wrong username or password\.$/, "שם משתמש או סיסמה לא נכונים."],
  [/^Enter your username and password\.$/, "צריך למלא שם משתמש וסיסמה."],
  [/^Too many wrong passwords for this account/, "יותר מדי סיסמאות שגויות לחשבון הזה. חכו 15 דקות, או אפסו את הסיסמה."],
  [/^Too many (tries|attempts)/, "יותר מדי ניסיונות. חכו כמה דקות ונסו שוב."],
  [/^Please check your email first\.$/, "צריך לאשר קודם את האימייל."],
  [/^Please log in (again|first)\.$/, "צריך להתחבר שוב."],
  [/^Your parents set a no-Jumpi time/, "ההורים קבעו זמן בלי ג'אמפי עכשיו. נתראה אחר כך!"],
  [/^This account is banned/, "החשבון הזה חסום."],
];
const say = (text) => { if (lang !== "he" || !text) return text; for (const [re, he] of HE_ERR) if (re.test(text)) return /^This account is banned/.test(text) && /Reason: (.+)$/.test(text) ? he + " " + text.match(/Reason: (.+)$/)[1] : he; return text; };
function msg(text, ok = false) { text = say(text); const m = $("clMsg"); m.textContent = text || ""; m.hidden = !text; m.classList.toggle("ok", ok); }
function signedIn(user) {
  $("clName").textContent = user.username || "";
  $("clLogin").hidden = true; $("clHi").hidden = false;
}
function signedOut() { $("clHi").hidden = true; $("clLogin").hidden = false; $("clPass").value = ""; }

// already logged in on this site?
api("me").then((r) => { if (r.ok && r.data.user) signedIn(r.data.user); else if (r.data && r.data.error) msg(r.data.error); }).catch(() => {});

$("clEye").onclick = () => {
  const on = $("clEye").getAttribute("aria-pressed") !== "true";
  $("clEye").setAttribute("aria-pressed", on); $("clPass").type = on ? "text" : "password";
  $("clEye").setAttribute("aria-label", on ? t("hide") : t("show"));
};

$("clForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = $("clUser").value.trim(), password = $("clPass").value;
  if (!username || !password) { msg(t("empty")); (username ? $("clPass") : $("clUser")).focus(); return; }
  const go = $("clGo"), label = go.innerHTML; go.disabled = true; go.textContent = t("wait"); msg("");
  try {
    const r = await api("login", { username, password, remember: $("clRemember").checked });
    if (r.ok && r.data.user) { signedIn(r.data.user); return; }
    if (r.data && r.data.needVerify) { msg(t("verify")); return; }
    msg((r.data && r.data.error) || t("fail"));
    $("clPass").select();
  } catch (err) { msg(t("net")); }
  finally { go.disabled = false; go.innerHTML = label; }
});

$("clOut").onclick = async () => { try { await api("logout", {}); } catch (e) {} signedOut(); $("clUser").focus(); };
