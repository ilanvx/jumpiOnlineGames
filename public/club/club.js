/* Jumpi Club: log in with the same Jumpi account as the game (the server's /api/auth), then the Club itself:
   - one side: who is online (in the game or here), friend requests, and the chat with friends (the game's JumpiChat)
   - the middle: the Games Center; the other side: the categories
   - the top: coins, notifications (friend requests, new messages), settings, and my Jumpi in a circle with my level
   Friends, chat, block and report are the game's own routes (routes/social.js), so a block here works in the game too.
   The language is the same choice as the rest of the site (localStorage "jumpi-lang"). */
import { levelBadgeURL } from "/club/badge.js";

const $ = (id) => document.getElementById(id);
const btns = [...document.querySelectorAll(".lang-sw [data-set]")];
const T = {
  en: { empty: "Type your username and password.", fail: "Something went wrong. Please try again.", net: "No connection. Check your internet and try again.",
    verify: "Please check your email first: open the Jumpi game to finish making your account.", show: "Show password", hide: "Hide password", wait: "Logging in…", soon: "Opening soon!",
    find: "Find a player", you: "you", inGame: "In the game", inClub: "In the Club", add: "Add friend", sent: "Sent", accept: "Accept", decline: "Decline", chat: "Chat", more: "More",
    friend: "Friend", staff: "Jumpi team", nobody: "Nobody here right now. Invite your friends!", noFriends: "None of your friends are online right now.", noMatch: "No player with that name is online.",
    toNext: (n, l) => `${n} XP to level ${l}`, maxLv: "Top level!", level: (l) => `Level ${l}`, coins: (n) => `${n} coins`,
    noNotes: "Nothing new. Friend requests and new messages show up here.", wantsFriend: (u) => `${u} wants to be your friend`, newMsgs: (n, u) => n === 1 ? `A new message from ${u}` : `${n} new messages from ${u}`,
    nowFriends: (u) => `You and ${u} are friends now!`, reqSent: (u) => `Friend request sent to ${u}.`, declined: "Request declined.",
    blockT: (u) => `Block ${u}?`, blocked: (u) => `${u} is blocked. You won't see each other any more, here and in the game.`, unblock: "Unblock", unblocked: (u) => `${u} is unblocked.`, noBlocked: "You haven't blocked anyone.",
    reportT: (u) => `Report ${u}`, pick: "Choose what happened.", reported: "Thanks! The Jumpi team will check it.", typeMsg: "Type a message…", chatHello: (u) => `Say hi to ${u}!`,
    catEmpty: "There are no games here yet. 1v1 games, battles, quizzes and more are coming soon!", catEmptyOne: (c) => `There are no ${c} games yet. They're coming soon!`,
    online: "online", offline: "not online",
    gateT: (u) => `Sorry, ${u}!`, gateAge: "Jumpi Club is for ages 13 and up. Until then, the whole Jumpi world is waiting for you in the game!", gateBd: "To come into Jumpi Club we need to know your birthday. Open the Jumpi game once: it will ask you, and then come back here.", gateBdT: "One more thing",
    noPosts: "No posts yet. The Jumpi team will write here soon!", nComments: (n) => n === 1 ? "1 comment" : `${n} comments`, by: (a) => `by ${a}`, edited: "edited",
    noComments: "No comments yet. Be the first!", waiting: "Waiting for approval", logToComment: "Log in to write a comment.", ageComment: "Comments on the blog are for ages 13 and up.",
    bdComment: "To comment, open the Jumpi game once so it can ask for your birthday.", commentSent: "Thanks! Your comment will show after an admin approves it.", writeComment: "Write a comment…",
    newPost: "New post", editPost: "Edit post", needTitle: "Give the post a title.", needPic: "Every post needs a picture.", needBody: "Write something in the post.", uploading: "Uploading the picture…",
    published: "The post is up!", delAsk: "Delete this post and its comments?", deleted: "The post was deleted.", noPending: "No comments are waiting. All done!", approve: "Approve", reject: "Reject",
    approved: "Approved: it shows on the post now.", rejected: "Rejected.", pendingNote: (n) => n === 1 ? "1 blog comment is waiting for approval" : `${n} blog comments are waiting for approval`, onPost: (t) => `on "${t}"` },
  he: { empty: "צריך למלא שם משתמש וסיסמה.", fail: "משהו השתבש. נסו שוב.", net: "אין חיבור. בדקו את האינטרנט ונסו שוב.",
    verify: "צריך לאשר קודם את האימייל: פתחו את המשחק של ג'אמפי כדי לסיים לפתוח את החשבון.", show: "הצגת הסיסמה", hide: "הסתרת הסיסמה", wait: "מתחברים…", soon: "נפתח בקרוב!",
    find: "חיפוש שחקן", you: "את/ה", inGame: "במשחק", inClub: "בקלאב", add: "הוספת חבר", sent: "נשלחה", accept: "אישור", decline: "ביטול", chat: "צ'אט", more: "עוד",
    friend: "חבר/ה", staff: "צוות ג'אמפי", nobody: "אין כאן אף אחד כרגע. הזמינו חברים!", noFriends: "אף אחד מהחברים שלך לא מחובר כרגע.", noMatch: "אין שחקן מחובר בשם הזה.",
    toNext: (n, l) => `עוד ${n} XP לרמה ${l}`, maxLv: "הרמה הכי גבוהה!", level: (l) => `רמה ${l}`, coins: (n) => `${n} מטבעות`,
    noNotes: "אין משהו חדש. בקשות חברות והודעות חדשות יופיעו כאן.", wantsFriend: (u) => `${u} רוצה להיות חבר/ה שלך`, newMsgs: (n, u) => n === 1 ? `הודעה חדשה מ-${u}` : `${n} הודעות חדשות מ-${u}`,
    nowFriends: (u) => `את/ה ו-${u} חברים עכשיו!`, reqSent: (u) => `בקשת חברות נשלחה ל-${u}.`, declined: "הבקשה בוטלה.",
    blockT: (u) => `לחסום את ${u}?`, blocked: (u) => `${u} חסום/ה. לא תראו יותר אחד את השני, גם כאן וגם במשחק.`, unblock: "ביטול חסימה", unblocked: (u) => `החסימה של ${u} בוטלה.`, noBlocked: "לא חסמת אף אחד.",
    reportT: (u) => `דיווח על ${u}`, pick: "צריך לבחור מה קרה.", reported: "תודה! צוות ג'אמפי יבדוק את זה.", typeMsg: "כתבו הודעה…", chatHello: (u) => `תגידו היי ל-${u}!`,
    catEmpty: "כרגע אין כאן משחקים. בקרוב יגיעו משחקי 1 על 1, קרבות, חידונים ועוד!", catEmptyOne: (c) => `עדיין אין משחקי ${c}. הם בדרך!`,
    online: "מחובר/ת", offline: "לא מחובר/ת",
    gateT: (u) => `מצטערים, ${u}!`, gateAge: "הכניסה לג'אמפי קלאב היא מגיל 13 ומעלה. עד אז, כל העולם של ג'אמפי מחכה לך במשחק!", gateBd: "כדי להיכנס לג'אמפי קלאב צריך לדעת מתי יום ההולדת שלך. פתחו פעם אחת את המשחק של ג'אמפי, הוא ישאל, ואז חזרו לכאן.", gateBdT: "עוד דבר קטן",
    noPosts: "עוד אין פוסטים. צוות ג'אמפי יכתוב כאן בקרוב!", nComments: (n) => n === 1 ? "תגובה אחת" : `${n} תגובות`, by: (a) => `מאת ${a}`, edited: "נערך",
    noComments: "עוד אין תגובות. תהיו הראשונים!", waiting: "ממתינה לאישור", logToComment: "צריך להתחבר כדי לכתוב תגובה.", ageComment: "תגובות בבלוג הן מגיל 13 ומעלה.",
    bdComment: "כדי להגיב, פתחו פעם אחת את המשחק של ג'אמפי כדי שישאל מתי יום ההולדת שלכם.", commentSent: "תודה! התגובה תופיע אחרי שמנהל יאשר אותה.", writeComment: "כתבו תגובה…",
    newPost: "פוסט חדש", editPost: "עריכת פוסט", needTitle: "צריך לתת לפוסט כותרת.", needPic: "לכל פוסט צריך תמונה.", needBody: "צריך לכתוב משהו בפוסט.", uploading: "מעלים את התמונה…",
    published: "הפוסט עלה!", delAsk: "למחוק את הפוסט ואת התגובות שלו?", deleted: "הפוסט נמחק.", noPending: "אין תגובות שמחכות. הכול מאושר!", approve: "אישור", reject: "דחייה",
    approved: "אושרה: היא מופיעה עכשיו בפוסט.", rejected: "נדחתה.", pendingNote: (n) => n === 1 ? "תגובה אחת בבלוג מחכה לאישור" : `${n} תגובות בבלוג מחכות לאישור`, onPost: (t) => `על "${t}"` },
};
const REASONS = [
  ["grooming", "Asked for personal details, photos, or to meet", "ביקש פרטים אישיים, תמונות או להיפגש"],
  ["bullying", "Bullying or mean messages", "בריונות או הודעות פוגעות"],
  ["language", "Bad language", "שפה גסה"],
  ["sexual", "Inappropriate content", "תוכן לא מתאים"],
  ["scam", "A scam, or tried to take my things", "הונאה, או ניסיון לקחת לי דברים"],
  ["other", "Something else", "משהו אחר"],
];
const CATS = { all: ["All games", "כל המשחקים", "/club/img/nav/club.png"], duel: ["1v1", "1 על 1", "/club/img/cat/duel.png"], battle: ["Battles", "קרבות", "/club/img/cat/battle.png"],
  quiz: ["Quizzes", "חידונים", "/club/img/cat/quiz.png"], race: ["Races", "מרוצים", "/club/img/cat/race.png"], puzzle: ["Puzzles", "פאזלים", "/club/img/cat/puzzle.png"] };
// the Jumpis' body colours (the same list as the game's COLORS, index.html)
const SKIN = ["#ff8a1c", "#1fb6ff", "#2fd36b", "#ff5fb4", "#9b5cff", "#ffd23a", "#ff4545", "#f2f6ff", "#5b3420", "#c27a3a", "#f6c4a0", "#8a5a3c", "#2a2f72", "#c8102e", "#39ff14", "#f2c230", "#e8a39a", "#f4f0ff", "#ff4a1c", "#9ff5dd", "#5a22b0", "#1fb6ff"];
// the server's messages in Hebrew (the ones the Club can get); anything else is shown as it comes
const HE_ERR = [
  [/^Wrong username or password\.$/, "שם משתמש או סיסמה לא נכונים."],
  [/^Enter your username and password\.$/, "צריך למלא שם משתמש וסיסמה."],
  [/^Too many wrong passwords for this account/, "יותר מדי סיסמאות שגויות לחשבון הזה. חכו 15 דקות, או אפסו את הסיסמה."],
  [/^Too many (tries|attempts)/, "יותר מדי ניסיונות. חכו כמה דקות ונסו שוב."],
  [/^Please check your email first\.$/, "צריך לאשר קודם את האימייל."],
  [/^Please log in (again|first)\.$/, "צריך להתחבר שוב."],
  [/^Your parents set a no-Jumpi time/, "ההורים קבעו זמן בלי ג'אמפי עכשיו. נתראה אחר כך!"],
  [/^This account is banned/, "החשבון הזה חסום."],
  [/^Your parents turned off JumpiChat/, "ההורים כיבו את הצ'אט. עדיין אפשר להגיד היי במשחק עם ההודעות המוכנות!"],
  [/^Slow down/, "לאט לאט… חכו רגע ונסו שוב."],
  [/can't be blocked/, "זה חבר בצוות ג'אמפי, אז אי אפשר לחסום אותו. אם משהו לא בסדר, דווחו ומישהו אחר מהצוות יבדוק."],
  [/^There's no player with that name\.$/, "אין שחקן בשם הזה."],
  [/^You sent a lot of reports/, "שלחת הרבה דיווחים. חכו כמה דקות ונסו שוב."],
  [/^You can only message friends/, "אפשר לשלוח הודעות רק לחברים."],
  [/^You're muted/, "את/ה מושתק/ת לכמה דקות בגלל מילים לא יפות."],
  [/^Let's keep Jumpi friendly/, "בואו נשמור על ג'אמפי נחמד! המילה הזו לא מותרת כאן."],
  [/^You used bad words too many times/, "השתמשת במילים לא יפות יותר מדי פעמים, אז את/ה מושתק/ת ל-5 דקות."],
  [/^You wrote a lot of comments/, "כתבת הרבה תגובות. חכו כמה דקות ונסו שוב."],
  [/^Write a comment first/, "צריך לכתוב תגובה קודם."],
  [/^There's no such post/, "הפוסט הזה לא קיים."],
];
let lang = "en";
const t = (k, ...a) => { const v = T[lang][k]; return typeof v === "function" ? v(...a) : v; };
function setLang(l) {
  lang = l === "he" ? "he" : "en";
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  btns.forEach((b) => b.setAttribute("aria-pressed", b.dataset.set === lang));
  $("clEye").setAttribute("aria-label", $("clEye").getAttribute("aria-pressed") === "true" ? t("hide") : t("show"));
  try { localStorage.setItem("jumpi-lang", lang); } catch (e) {}
  paintGate(); if (typeof route === "function" && !$("blog").hidden) route();
  if (ME) { paintMe(); paintOnline(); paintNotes(); paintCat(); $("hubFind").placeholder = t("find"); $("chatIn").placeholder = t("typeMsg"); }
}
btns.forEach((b) => (b.onclick = () => setLang(b.dataset.set)));
const say = (text) => { if (lang !== "he" || !text) return text; for (const [re, he] of HE_ERR) if (re.test(text)) return /^This account is banned/.test(text) && /Reason: (.+)$/.test(text) ? he + " " + text.match(/Reason: (.+)$/)[1] : he; return text; };

/* ---------- talking to the server ---------- */
let ME = null, gate = null, ONLINE = [], NOTES = { requests: [], chats: [] }, filter = "all", CHAT = null, CAT = "all", pollT = 0, chatT = 0;
async function call(path, body) {
  let r;
  try { r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) } : { credentials: "same-origin", cache: "no-store" }); }
  catch (e) { return { ok: false, status: 0, data: { error: t("net") } }; }
  let data = {}; try { data = await r.json(); } catch (e) {}
  if (r.status === 401 && ME && !/\/api\/auth\//.test(path)) signedOut();
  return { ok: r.ok, status: r.status, data };
}
const api = (path, body) => call("/api/auth/" + path, body);

/* ---------- log in ---------- */
function msg(text, ok = false) { text = say(text); const m = $("clMsg"); m.textContent = text || ""; m.hidden = !text; m.classList.toggle("ok", ok); }
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
    if (r.ok && r.data.user) { $("clPass").value = ""; signedIn(r.data.user); return; }
    if (r.data && r.data.needVerify) { msg(t("verify")); return; }
    msg((r.data && r.data.error) || t("fail"));
    $("clPass").select();
  } catch (err) { msg(t("net")); }
  finally { go.disabled = false; go.innerHTML = label; }
});

/* ---------- the toolbar: the menu on phones, "opening soon", the log-in button ---------- */
const nav = $("clNav"), menu = $("clMenu");
const setMenu = (open) => { nav.classList.toggle("open", open); menu.setAttribute("aria-expanded", String(open)); };
menu.onclick = () => setMenu(!nav.classList.contains("open"));
let toastT = 0;
function toast(text) { const e = $("clToast"); e.textContent = text; e.hidden = false; e.style.animation = "none"; void e.offsetWidth; e.style.animation = ""; clearTimeout(toastT); toastT = setTimeout(() => (e.hidden = true), 2800); }
document.querySelectorAll("[data-soon]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); setMenu(false); toast(t("soon")); }));
const goLogin = (e) => { e.preventDefault(); setMenu(false); if (ME) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  $("clLogin").scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => $("clUser").focus({ preventScroll: true }), 350); };
[$("clTopGo"), ...document.querySelectorAll("[data-go]")].forEach((a) => a.addEventListener("click", goLogin));

/* =====================================================================
   THE CLUB (signed in)
   ===================================================================== */
// a player's name inside a sentence keeps its own direction (English names in Hebrew sentences and the other way)
const iso = (u) => "\u2068" + u + "\u2069";
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
// a little Jumpi face in the player's body colour (the list doesn't show other players' pictures: kids' safety)
const faceSVG = (c) => `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="20" cy="21" r="17" fill="${c}"/><ellipse cx="14" cy="12.5" rx="6" ry="3.2" fill="#fff" opacity=".35"/><circle cx="14.5" cy="20" r="4.6" fill="#fff"/><circle cx="25.5" cy="20" r="4.6" fill="#fff"/><circle cx="15.3" cy="20.6" r="2.6" fill="#24202e"/><circle cx="26.3" cy="20.6" r="2.6" fill="#24202e"/><circle cx="16.2" cy="19.4" r=".9" fill="#fff"/><circle cx="27.2" cy="19.4" r=".9" fill="#fff"/><path d="M16 27.5q4 3 8 0" fill="none" stroke="#24202e" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const skinOf = (look) => SKIN[(look && look.color) | 0] || SKIN[0];
// a Jumpi in the clothes they wear (a picture the server draws from their saved look); a face in their colour until it's there
const picURL = (username, pic) => "/api/club/pic/" + encodeURIComponent(username) + "?v=" + encodeURIComponent(pic || "");
function face(look, size = 40, username = "", pic = "") {
  const s = el("span", "ppl-av"); s.style.width = s.style.height = size + "px"; s.innerHTML = faceSVG(skinOf(look));
  if (username) { const i = new Image(); i.alt = ""; i.decoding = "async"; i.onload = () => { s.textContent = ""; s.append(i); s.classList.add("pic"); }; i.src = picURL(username, pic); }
  return s;
}

async function signedIn(user) {
  const r = await call("/api/club/me");
  if (r.status === 403 && (r.data.code === "age" || r.data.code === "birthday")) { showGate(user.username, r.data.code); return; }
  ME = { username: user.username, look: user.look, coins: user.coins || 0, levelXp: user.levelXp || 0, level: 1, into: 0, need: 0, pct: 0 };
  document.body.classList.add("in");
  $("clTopGo").hidden = true; $("clMe").hidden = false;
  document.querySelector(".cl-top-in > .lang-sw").hidden = true;
  $("hubFind").placeholder = t("find"); $("chatIn").placeholder = t("typeMsg");
  // my Jumpi: the picture my game window made; until there is one, a face in my colour
  const img = $("clAvImg"); img.onerror = () => { img.onerror = null; img.src = "data:image/svg+xml," + encodeURIComponent(faceSVG(skinOf(ME && ME.look))); img.classList.add("face"); };
  img.classList.remove("face"); img.src = picURL(ME.username, "");
  if (r.ok) Object.assign(ME, r.data);
  $("clGate").hidden = true; $("clLogin").hidden = false;
  paintMe(); paintCat(); route(); refresh(); clearInterval(pollT); pollT = setInterval(() => { if (!document.hidden) refresh(); }, 8000);
}
function showGate(username, code) {
  gate = { username, code };
  $("clLogin").hidden = true; $("clGate").hidden = false; $("clTopGo").hidden = true;
  paintGate(); route(); if (!$("blog").hidden) return; $("clGateGo").focus();
}
// "back to the game": the game on this same site (the test copy has its own); on club.jumpigames.com, the real game
if (!/^club\./.test(location.hostname)) $("clGateGo").href = "/play";
function paintGate() { if (!gate) return; $("clGateT").textContent = gate.code === "age" ? t("gateT", iso(gate.username)) : t("gateBdT"); $("clGateP").textContent = gate.code === "age" ? t("gateAge") : t("gateBd"); }
// another account: log this one out here (the login cookie is the same as the game's on this computer)
$("clGateOther").onclick = async () => { try { await api("logout", {}); } catch (e) {} gate = null; route(); $("clGate").hidden = true; $("clLogin").hidden = false; $("clTopGo").hidden = false; $("clUser").value = ""; $("clUser").focus(); };
function signedOut() {
  ME = null; clearInterval(pollT); closeChat(); closePops();
  document.body.classList.remove("in");
  $("clTopGo").hidden = false; $("clMe").hidden = true; route();
  document.querySelector(".cl-top-in > .lang-sw").hidden = false; $("clPass").value = "";
}
$("clOut").onclick = async () => { closePops(); try { await api("logout", {}); } catch (e) {} signedOut(); $("clUser").focus(); };

async function refresh() {
  const [me, on, fr, dm, bp] = await Promise.all([call("/api/club/me"), call("/api/club/online"), call("/api/friends"), call("/api/dm"), ME && ME.role === "admin" ? call("/api/blog/pending") : null]);
  if (!ME) return;
  if (me.ok) { const was = ME.pic; Object.assign(ME, me.data); paintMe();
    if (ME.pic && ME.pic !== was) { const img = $("clAvImg"), n = new Image(); n.onload = () => { img.classList.remove("face"); img.src = n.src; }; n.src = picURL(ME.username, ME.pic); } }
  if (on.ok) { ONLINE = on.data.players || []; paintOnline(); }
  if (fr.ok) NOTES.requests = fr.data.requests || [];
  NOTES.blog = bp && bp.ok ? bp.data.count || 0 : 0; $("blogPendN").textContent = String(NOTES.blog);
  NOTES.chats = dm.ok ? (dm.data.chats || []).filter((c) => c.unread > 0 && !(CHAT && CHAT.username === c.username)) : [];
  paintNotes();
}

/* ---------- the top: coins, my Jumpi, level and XP ---------- */
function paintMe() {
  if (!ME) return;
  $("clCoinN").textContent = (ME.coins || 0).toLocaleString(lang === "he" ? "he-IL" : "en-US");
  $("clCoins").title = t("coins", ME.coins || 0);
  $("clAvName").textContent = ME.username;
  $("clAvLv").src = levelBadgeURL(ME.level || 1, 96); $("clAvLv").alt = t("level", ME.level || 1); $("clAvLv").title = t("level", ME.level || 1);
  const left = Math.max(0, (ME.need || 0) - (ME.into || 0));
  $("clXpBar").style.width = Math.round((ME.need ? ME.pct || 0 : 1) * 100) + "%";
  $("clXpTxt").textContent = ME.need ? t("toNext", left, (ME.level || 1) + 1) : t("maxLv");
}

/* ---------- who is online ---------- */
$("hubFind").addEventListener("input", paintOnline);
document.querySelectorAll(".hub-tabs [data-f]").forEach((b) => b.onclick = () => { filter = b.dataset.f; document.querySelectorAll(".hub-tabs [data-f]").forEach((x) => x.setAttribute("aria-pressed", x === b)); paintOnline(); });
function paintOnline() {
  const ul = $("hubOnline"), q = $("hubFind").value.trim().toLowerCase();
  $("hubCount").textContent = String(ONLINE.filter((p) => !p.me).length);
  const list = ONLINE.filter((p) => (filter === "all" || p.friend || p.me) && (!q || p.me || p.username.toLowerCase().includes(q)));
  ul.textContent = "";
  list.forEach((p) => ul.append(row(p)));
  if (!list.some((p) => !p.me)) ul.append(el("li", "ppl-none", q ? t("noMatch") : filter === "friends" ? t("noFriends") : t("nobody")));
}
const svgBtn = (cls, title, svg) => { const b = el("button", "ppl-btn " + cls); b.type = "button"; b.title = title; b.innerHTML = svg; b.append(el("span", "sr", title)); return b; };
function row(p) {
  const li = el("li", "ppl" + (p.me ? " me" : "") + (p.friend ? " fr" : ""));
  li.append(face(p.look, 42, p.username, p.pic));
  const who = el("span", "ppl-who"); who.append(el("b", "", iso(p.username)));
  const tags = el("small"); tags.append(el("i", "ppl-at " + (p.at || "game"), p.me ? t("you") : p.at === "club" ? t("inClub") : t("inGame")));
  if (p.friend) tags.append(el("i", "ppl-tag fr", t("friend")));
  if (p.role === "admin" || p.role === "mod") tags.append(el("i", "ppl-tag staff", t("staff")));
  who.append(tags); li.append(who);
  if (p.me) return li;
  const acts = el("span", "ppl-acts");
  // the chat button is only there for friends; everyone else can get a friend request
  if (p.friend) { const b = svgBtn("chat", t("chat"), '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10H9.5L5 19.5v-4H4z"/></svg>'); b.onclick = () => openChat(p.username, p.look); acts.append(b); }
  else if (p.askedMe) { const b = el("button", "ppl-btn yes", t("accept")); b.type = "button"; b.onclick = () => respond(p.username, true); acts.append(b); }
  else if (p.sent) acts.append(el("span", "ppl-sent", t("sent")));
  else { const b = svgBtn("add", t("add"), '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="8.5" r="3.6"/><path d="M3.5 19c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M18.5 7v6M15.5 10h6"/></svg>'); b.onclick = () => addFriend(p.username, b); acts.append(b); }
  const m = el("button", "ppl-more"); m.type = "button"; m.title = t("more"); m.setAttribute("aria-haspopup", "true");
  m.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>'; m.append(el("span", "sr", t("more")));
  m.onclick = (e) => { e.stopPropagation(); openPplMenu(m, p.username, p.role, "card"); }; acts.append(m);
  li.append(acts); return li;
}

/* ---------- friends ---------- */
async function addFriend(username, b) {
  if (b) b.disabled = true;
  const r = await call("/api/friends/add", { username });
  if (r.ok) { toast(/friends now/i.test(r.data.message || "") ? t("nowFriends", iso(username)) : t("reqSent", iso(username))); refresh(); }
  else { toast(say(r.data.error) || t("fail")); if (b) b.disabled = false; }
}
async function respond(username, accept) {
  const r = await call("/api/friends/respond", { username, accept });
  toast(r.ok ? (accept ? t("nowFriends", iso(username)) : t("declined")) : say(r.data.error) || t("fail"));
  refresh();
}

/* ---------- notifications ---------- */
function paintNotes() {
  const n = NOTES.requests.length + NOTES.chats.length + (NOTES.blog ? 1 : 0), dot = $("clBellN");
  dot.hidden = !n; dot.textContent = n > 9 ? "9+" : String(n);
  const box = $("clNotes"); box.textContent = "";
  if (!n) { box.append(el("p", "note-none", t("noNotes"))); return; }
  NOTES.requests.forEach((q) => {
    const d = el("div", "note"); d.append(face(q.look, 38, q.username)); d.append(el("span", "note-t", t("wantsFriend", iso(q.username))));
    const a = el("span", "note-acts"); const y = el("button", "ppl-btn yes", t("accept")); y.type = "button"; y.onclick = (e) => { e.stopPropagation(); respond(q.username, true); };
    const no = el("button", "ppl-btn no", t("decline")); no.type = "button"; no.onclick = (e) => { e.stopPropagation(); respond(q.username, false); }; a.append(y, no); d.append(a); box.append(d);
  });
  if (NOTES.blog) { const d = el("button", "note msg"); d.type = "button"; const ic = el("span", "ppl-av note-ic"); ic.innerHTML = '<img src="/club/img/nav/blog.png" alt="">'; d.append(ic, el("span", "note-t", t("pendingNote", NOTES.blog)));
    d.onclick = () => { closePops(); location.hash = "#blog/pending"; }; box.append(d); }
  NOTES.chats.forEach((c) => {
    const d = el("button", "note msg"); d.type = "button"; d.append(face(c.look, 38, c.username)); d.append(el("span", "note-t", t("newMsgs", c.unread, iso(c.username))));
    d.onclick = () => { closePops(); openChat(c.username, c.look); }; box.append(d);
  });
}

/* ---------- pop-ups at the top (notifications, settings) ---------- */
const POPS = [["clBell", "clBellPop"], ["clGear", "clGearPop"]];
function closePops() { POPS.forEach(([b, p]) => { $(p).hidden = true; $(b).setAttribute("aria-expanded", "false"); }); $("pplMenu").hidden = true; }
POPS.forEach(([b, p]) => $(b).onclick = (e) => { e.stopPropagation(); const open = $(p).hidden; closePops(); if (open) { $(p).hidden = false; $(b).setAttribute("aria-expanded", "true"); if (b === "clBell") refresh(); } });
document.addEventListener("click", (e) => { if (!e.target.closest(".cl-pop") && !e.target.closest(".ppl-menu")) closePops(); });
addEventListener("keydown", (e) => { if (e.key !== "Escape") return; setMenu(false); closePops(); document.querySelectorAll(".cl-modal:not([hidden])").forEach(closeModal); });

/* ---------- a player's menu: report, block ---------- */
let pplFor = null;
function openPplMenu(anchor, username, role, where) {
  const m = $("pplMenu"); pplFor = { username, role, where };
  m.querySelector('[data-act="block"]').hidden = role === "admin" || role === "mod";   // the Jumpi team can't be blocked (they can be reported)
  m.hidden = false; const r = anchor.getBoundingClientRect(), w = m.offsetWidth;
  m.style.top = Math.min(innerHeight - m.offsetHeight - 8, r.bottom + 6) + "px";
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, lang === "he" ? r.left : r.right - w)) + "px";
  m.querySelector("button:not([hidden])").focus();
}
$("pplMenu").addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (!b || !pplFor) return; e.stopPropagation(); $("pplMenu").hidden = true;
  if (b.dataset.act === "block") askBlock(pplFor.username); else askReport(pplFor.username, pplFor.where, pplFor.role); });

/* ---------- windows (block, report, the blocked list) ---------- */
let lastFocus = null;
function openModal(id) { lastFocus = document.activeElement; const m = $(id); m.hidden = false; const f = m.querySelector(".cl-dlg button, .cl-dlg input"); if (f) f.focus(); }
function closeModal(m) { m.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
document.querySelectorAll(".cl-modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("[data-close]")) closeModal(m); }));

// blocking: a window that says clearly what happens (here AND in the game) before it's done
let blockWho = "";
function askBlock(username) { blockWho = username; $("mBlockT").textContent = t("blockT", iso(username)); openModal("mBlock"); }
$("mBlockGo").onclick = async () => { const u = blockWho; const r = await call("/api/block", { username: u }); closeModal($("mBlock"));
  if (r.ok) { toast(t("blocked", iso(u))); if (CHAT && CHAT.username.toLowerCase() === u.toLowerCase()) closeChat(); refresh(); } else toast(say(r.data.error) || t("fail")); };

let reportFor = null;
function askReport(username, where, role) {
  reportFor = { username, where }; $("mReportT").textContent = t("reportT", iso(username)); $("mDetails").value = ""; $("mAlsoBlock").checked = false; $("mReportMsg").hidden = true;
  const box = $("mReasons"); box.textContent = "";
  REASONS.forEach(([id, en, he]) => { const l = el("label", "dlg-reason"); const i = el("input"); i.type = "radio"; i.name = "reason"; i.value = id; l.append(i, el("span", "", lang === "he" ? he : en)); box.append(l); });
  $("mAlsoBlock").closest("label").hidden = role === "admin" || role === "mod";
  openModal("mReport");
}
$("mReportGo").onclick = async () => {
  const pick = document.querySelector("#mReasons input:checked"), m = $("mReportMsg");
  if (!pick) { m.textContent = t("pick"); m.hidden = false; return; }
  const u = reportFor.username, r = await call("/api/report", { username: u, reason: pick.value, details: $("mDetails").value.trim(), where: reportFor.where });
  if (!r.ok) { m.textContent = say(r.data.error) || t("fail"); m.hidden = false; return; }
  closeModal($("mReport")); toast(t("reported"));
  if ($("mAlsoBlock").checked && !$("mAlsoBlock").closest("label").hidden) { const b = await call("/api/block", { username: u }); if (b.ok) { toast(t("blocked", iso(u))); if (CHAT && CHAT.username === u) closeChat(); } }
  refresh();
};
$("clBlockedBtn").onclick = () => { closePops(); openModal("mBlocked"); paintBlocked(); };
async function paintBlocked() {
  const ul = $("mBlockedList"); ul.textContent = ""; const r = await call("/api/blocked"); const list = (r.ok && r.data.blocked) || [];
  if (!list.length) { ul.append(el("li", "ppl-none", t("noBlocked"))); return; }
  list.forEach((p) => { const li = el("li", "ppl"); li.append(face(p.look, 38, p.username)); const w = el("span", "ppl-who"); w.append(el("b", "", iso(p.username))); li.append(w);
    const u = el("button", "ppl-btn no", t("unblock")); u.type = "button"; u.onclick = async () => { const x = await call("/api/unblock", { username: p.username }); toast(x.ok ? t("unblocked", iso(p.username)) : say(x.data.error) || t("fail")); paintBlocked(); refresh(); };
    const a = el("span", "ppl-acts"); a.append(u); li.append(a); ul.append(li); });
}

/* ---------- the chat with a friend (JumpiChat: the same messages as on the in-game phone) ---------- */
function openChat(username, look) {
  CHAT = { username, look, last: "" };
  $("hubList").hidden = true; $("hubChat").hidden = false; document.body.classList.add("chatting");
  const av = face(look, 40, username, (ONLINE.find((p) => p.username === username) || {}).pic); av.id = "chatAv"; $("chatAv").replaceWith(av);
  $("chatName").textContent = username; $("chatWhere").textContent = "";
  $("chatLog").textContent = ""; $("chatIn").value = ""; $("chatIn").focus({ preventScroll: true });
  if (matchMedia("(max-width: 900px)").matches) $("hubChat").scrollIntoView({ behavior: "smooth", block: "start" });
  loadChat(); clearInterval(chatT); chatT = setInterval(() => { if (!document.hidden) loadChat(); }, 3500);
}
function closeChat() { CHAT = null; clearInterval(chatT); $("hubChat").hidden = true; $("hubList").hidden = false; document.body.classList.remove("chatting"); }
$("chatBack").onclick = () => { closeChat(); refresh(); };
$("chatMore").onclick = (e) => { e.stopPropagation(); if (CHAT) openPplMenu($("chatMore"), CHAT.username, (ONLINE.find((p) => p.username === CHAT.username) || {}).role, "chat"); };
async function loadChat() {
  if (!CHAT) return; const who = CHAT.username;
  const r = await call("/api/dm/with/" + encodeURIComponent(who));
  if (!CHAT || CHAT.username !== who) return;
  const log = $("chatLog");
  if (!r.ok) { log.textContent = ""; log.append(el("li", "chat-sys", say(r.data.error) || t("fail"))); $("chatForm").hidden = true; return; }
  $("chatForm").hidden = false;
  const w = r.data.with || {}; $("chatWhere").textContent = w.where ? t("online") : t("offline"); $("chatWhere").classList.toggle("on", !!w.where);
  const msgs = r.data.messages || [], lastId = msgs.length ? msgs[msgs.length - 1].id : "-";
  if (lastId === CHAT.last) return;
  CHAT.last = lastId; log.textContent = "";
  if (!msgs.length) log.append(el("li", "chat-sys", t("chatHello", iso(who))));
  let day = "";
  msgs.forEach((m) => { const d = new Date(m.at), k = d.toDateString();
    if (k !== day) { day = k; log.append(el("li", "chat-day", d.toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { weekday: "long", day: "numeric", month: "short" }))); }
    const mine = !!(m.from && ME && m.from.toLowerCase() === ME.username.toLowerCase());
    const li = el("li", "bub" + (mine ? " mine" : "")); const p = el("span", "bub-t", m.text); p.dir = "auto"; li.append(p);
    li.append(el("time", "", d.toLocaleTimeString(lang === "he" ? "he-IL" : "en-US", { hour: "2-digit", minute: "2-digit" }))); log.append(li); });
  log.scrollTop = log.scrollHeight;
}
$("chatForm").addEventListener("submit", async (e) => {
  e.preventDefault(); if (!CHAT) return;
  const text = $("chatIn").value.trim(); if (!text) return;
  const b = $("chatForm").querySelector("button"); b.disabled = true;
  const r = await call("/api/dm", { to: CHAT.username, text });
  b.disabled = false;
  if (r.ok) { $("chatIn").value = ""; CHAT.last = ""; loadChat(); } else toast(say(r.data.error) || t("fail"));
  $("chatIn").focus();
});

/* ---------- the games center and its categories ---------- */
document.querySelectorAll("#hubCats [data-cat]").forEach((b) => b.onclick = () => { CAT = b.dataset.cat; document.querySelectorAll("#hubCats [data-cat]").forEach((x) => x.setAttribute("aria-pressed", x === b)); paintCat();
  if (matchMedia("(max-width: 900px)").matches) document.querySelector(".hub-games").scrollIntoView({ behavior: "smooth", block: "start" }); });
function paintCat() {
  const c = CATS[CAT] || CATS.all, name = lang === "he" ? c[1] : c[0];
  $("hubCatT").textContent = name; $("hubCatIc").src = c[2];
  $("hubEmptyP").textContent = CAT === "all" ? t("catEmpty") : t("catEmptyOne", name);
}

/* =====================================================================
   THE BLOG (#blog, #blog/<post>, #blog/pending): everyone can read; admins write; comments wait for an admin
   ===================================================================== */
const isAdm = () => !!(ME && ME.role === "admin");
const fmtDay = (ms) => new Date(ms).toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { day: "numeric", month: "long", year: "numeric" });
function route() {
  const h = location.hash.replace(/^#/, ""), blog = /^blog(\/|$)/.test(h);
  document.querySelectorAll("[data-nav]").forEach((a) => { if (a.dataset.nav === (blog ? "blog" : "club")) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  $("blog").hidden = !blog;
  document.querySelector(".cl-win").hidden = blog || !!ME;
  $("hub").hidden = blog || !ME;
  document.body.classList.toggle("on-blog", blog);
  if (blog) showBlog(h.split("/")[1] || "");
}
addEventListener("hashchange", () => { setMenu(false); route(); });
document.querySelectorAll('[data-nav="club"]').forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); history.pushState(null, "", location.pathname + location.search); route(); }));
function showBlog(id) {
  $("blogAdmin").hidden = !isAdm();
  document.querySelector(".blog-top").hidden = !!id;
  $("blogList").hidden = !!id; $("blogPost").hidden = !id || id === "pending"; $("blogPending").hidden = id !== "pending";
  if (!id) loadPosts(); else if (id === "pending") loadPending(); else loadPost(id);
  window.scrollTo(0, 0);
}
async function loadPosts() {
  const box = $("blogList"), r = await call("/api/blog"); box.textContent = "";
  const posts = (r.ok && r.data.posts) || [];
  if (!posts.length) { box.append(el("p", "blog-none", t("noPosts"))); return; }
  posts.forEach((p, i) => {
    const a = el("a", "bl-card" + (i === 0 ? " first" : "")); a.href = "#blog/" + p.id;
    if (p.image) { const im = el("img"); im.src = p.image; im.alt = ""; im.loading = "lazy"; a.append(im); }
    const tx = el("div", "bl-tx"); tx.append(el("h2", "", p.title), el("p", "", p.excerpt + (p.body.length > p.excerpt.length ? "…" : "")));
    tx.append(el("small", "", fmtDay(p.at) + " · " + t("nComments", p.comments))); a.append(tx); box.append(a);
  });
}
let POST = null;
async function loadPost(id) {
  const r = await call("/api/blog/post/" + encodeURIComponent(id));
  if (!r.ok) { $("bpTitle").textContent = say(r.data.error) || t("fail"); $("bpBody").textContent = ""; $("bcList").textContent = ""; $("bpImg").hidden = true; $("bpTools").hidden = true; return; }
  const p = POST = r.data.post;
  $("bpImg").hidden = !p.image; if (p.image) $("bpImg").src = p.image;
  $("bpTitle").textContent = p.title;
  $("bpMeta").textContent = fmtDay(p.at) + " · " + t("by", iso(p.author)) + (p.updatedAt ? " · " + t("edited") : "");
  $("bpTools").hidden = !isAdm();
  const body = $("bpBody"); body.textContent = ""; p.body.split(/\n\s*\n/).forEach((para) => { const q = el("p", "", para); q.dir = "auto"; body.append(q); });
  paintComments(r.data.comments || []);
}
function paintComments(list) {
  const ul = $("bcList"); ul.textContent = "";
  $("bcN").textContent = String(list.filter((c) => c.status === "approved").length || "");
  if (!list.length) ul.append(el("li", "bc-none", t("noComments")));
  list.forEach((c) => {
    const li = el("li", "bc" + (c.status === "pending" ? " pending" : "")); li.append(face({ color: 0 }, 40, ME ? c.username : ""));
    const w = el("div", "bc-w"), hd = el("div", "bc-h"); hd.append(el("b", "", iso(c.username)), el("time", "", fmtDay(c.at)));
    if (c.status === "pending") hd.append(el("i", "bc-wait", t("waiting")));
    const tx = el("p", "", c.text); tx.dir = "auto"; w.append(hd, tx); li.append(w); ul.append(li);
  });
  // who can write: logged in, 13+ (the Club's age)
  const f = $("bcForm"), note = $("bcNote");
  f.hidden = !ME; note.hidden = !!ME;
  if (!ME) { note.textContent = gate ? (gate.code === "age" ? t("ageComment") : t("bdComment")) : t("logToComment"); note.classList.toggle("link", !gate); }
  $("bcText").placeholder = t("writeComment");
}
$("bcNote").onclick = () => { if (!ME && !gate) { history.pushState(null, "", location.pathname + location.search); route(); setTimeout(() => $("clUser").focus(), 200); } };
$("bcForm").addEventListener("submit", async (e) => {
  e.preventDefault(); if (!POST) return;
  const text = $("bcText").value.trim(); if (!text) return;
  const b = $("bcForm").querySelector("button"); b.disabled = true;
  const r = await call(`/api/blog/post/${POST.id}/comment`, { text }); b.disabled = false;
  if (r.ok) { $("bcText").value = ""; toast(t("commentSent")); loadPost(POST.id); } else toast(say(r.data.error) || t("fail"));
});
// admins: the comments that wait
async function loadPending() {
  const ul = $("pendList"); ul.textContent = "";
  if (!isAdm()) { ul.append(el("li", "bc-none", t("fail"))); return; }
  const r = await call("/api/blog/pending"), list = (r.ok && r.data.comments) || [];
  NOTES.blog = list.length; $("blogPendN").textContent = String(list.length); paintNotes();
  if (!list.length) { ul.append(el("li", "bc-none", t("noPending"))); return; }
  list.forEach((c) => {
    const li = el("li", "bc pend"); li.append(face({ color: 0 }, 40, c.username));
    const w = el("div", "bc-w"), hd = el("div", "bc-h"); hd.append(el("b", "", iso(c.username)), el("time", "", fmtDay(c.at)));
    const on = el("a", "bc-on", t("onPost", c.postTitle)); on.href = "#blog/" + c.post; hd.append(on);
    const tx = el("p", "", c.text); tx.dir = "auto";
    const acts = el("div", "bc-acts"), y = el("button", "ppl-btn yes", t("approve")), n = el("button", "ppl-btn no", t("reject")); y.type = n.type = "button";
    const act = async (what) => { y.disabled = n.disabled = true; const x = await call(`/api/blog/comment/${c.id}/${what}`, {}); toast(x.ok ? t(what === "approve" ? "approved" : "rejected") : say(x.data.error) || t("fail")); loadPending(); };
    y.onclick = () => act("approve"); n.onclick = () => act("reject"); acts.append(y, n);
    w.append(hd, tx, acts); li.append(w); ul.append(li);
  });
}
// admins: writing / changing a post (the picture is made smaller in the browser, then sent first)
let editing = null, picId = "";
function openEditor(post) {
  editing = post ? post.id : null; picId = "";
  $("mPostT").textContent = post ? t("editPost") : t("newPost");
  $("mpTitle").value = post ? post.title : ""; $("mpBody").value = post ? post.body : ""; $("mpMsg").hidden = true; $("mpFile").value = "";
  if (post && post.image) { picId = post.image.split("/").pop(); $("mpPrev").src = post.image; $("mpPrev").hidden = false; } else { $("mpPrev").hidden = true; $("mpPrev").removeAttribute("src"); }
  openModal("mPost"); $("mpTitle").focus();
}
$("blogNew").onclick = () => openEditor(null);
$("bpEdit").onclick = () => POST && openEditor(POST);
$("bpDel").onclick = async () => { if (!POST || !confirm(t("delAsk"))) return; const r = await call(`/api/blog/post/${POST.id}/delete`, {}); toast(r.ok ? t("deleted") : say(r.data.error) || t("fail")); if (r.ok) location.hash = "#blog"; };
function shrink(file) {
  return new Promise((ok, no) => { const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { const k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob((b) => (b ? ok(b) : no(new Error("no"))), "image/jpeg", .86); };
    im.onerror = () => { URL.revokeObjectURL(url); no(new Error("bad")); }; im.src = url; });
}
$("mpFile").addEventListener("change", async () => {
  const f = $("mpFile").files[0]; if (!f) return; const m = $("mpMsg");
  m.textContent = t("uploading"); m.classList.add("ok"); m.hidden = false; $("mpGo").disabled = true;
  try {
    const blob = await shrink(f);
    const r = await fetch("/api/blog/img", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "image/jpeg" }, body: blob });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(say(d.error) || t("fail"));
    picId = d.id; $("mpPrev").src = d.url; $("mpPrev").hidden = false; m.hidden = true;
  } catch (err) { m.textContent = err.message || t("fail"); m.classList.remove("ok"); }
  finally { $("mpGo").disabled = false; }
});
$("mpGo").onclick = async () => {
  const m = $("mpMsg"), title = $("mpTitle").value.trim(), body = $("mpBody").value.trim();
  const bad = !title ? t("needTitle") : !picId ? t("needPic") : !body ? t("needBody") : "";
  if (bad) { m.textContent = bad; m.classList.remove("ok"); m.hidden = false; return; }
  $("mpGo").disabled = true;
  const r = await call(editing ? `/api/blog/post/${editing}` : "/api/blog", { title, body, image: picId });
  $("mpGo").disabled = false;
  if (!r.ok) { m.textContent = say(r.data.error) || t("fail"); m.classList.remove("ok"); m.hidden = false; return; }
  closeModal($("mPost")); toast(t("published"));
  if (location.hash === "#blog/" + r.data.post.id) loadPost(r.data.post.id); else location.hash = "#blog/" + r.data.post.id;
};

// the start: the same language as the rest of the site, then: am I logged in already?
{ let start = null; try { start = new URLSearchParams(location.search).get("lang") || localStorage.getItem("jumpi-lang"); } catch (e) {}
  setLang(start || (/^he|^iw/i.test(navigator.language || "") ? "he" : "en")); }
route();
api("me").then((r) => { if (r.ok && r.data.user) signedIn(r.data.user); else if (r.data && r.data.error) msg(r.data.error); }).catch(() => {});
