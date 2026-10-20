/* Jumpi Club: log in with the same Jumpi account as the game (the server's /api/auth), then the Club itself:
   - one side: who is online (in the game or here), friend requests, and the chat with friends (the game's JumpiChat)
   - the middle: the Games Center; the other side: the categories
   - the top: coins, notifications (friend requests, new messages), settings, and my Jumpi in a circle with my level
   Friends, chat, block and report are the game's own routes (routes/social.js), so a block here works in the game too.
   The language is the same choice as the rest of the site (localStorage "jumpi-lang"). */
import { levelBadgeURL } from "/club/badge.js";
import { EMOJI, FONTS, SIZES, isEmoji, EMOJI_CODE } from "/shared/blogdoc.js";
import { EMOJI_GROUPS } from "/club/emoji-list.js";
import { ARCADE } from "/club/arcade/list.js";

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
    catEmpty: "Pick a game and play!", catEmptyOne: (c) => `There are no ${c} games yet. They're coming soon!`,
    online: "online", offline: "not online", gmLocked: "Open the Future City in the game to play this one.", noCoins: "Just for fun · no coins", leaders: "Leaderboard", lbSub: "The 10 best rounds ever (one round, not added up)", lbEmpty: "No rounds yet. Be the first!",
    lbMine: (n, r) => `Your best round: ${n} · you're #${r}`, lbNone: "Play a round to get on the board!",
    gateT: (u) => `Sorry, ${u}!`, gateAge: "Jumpi Club is for ages 6 and up. Until then, the whole Jumpi world is waiting for you in the game!", gateBd: "To come into Jumpi Club we need to know your birthday. Open the Jumpi game once: it will ask you, and then come back here.", gateBdT: "One more thing",
    noPosts: "No posts yet. The Jumpi team will write here soon!", nComments: (n) => n === 1 ? "1 comment" : `${n} comments`, by: (a) => `by ${a}`, edited: "edited",
    noComments: "No comments yet. Be the first!", waiting: "Waiting for approval", logToComment: "Log in to write a comment.", ageComment: "Comments on the blog are for ages 6 and up.", shootAge: "The shooting games are for ages 13 and up.",
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
    catEmpty: "בחרו משחק ושחקו!", catEmptyOne: (c) => `עדיין אין משחקי ${c}. הם בדרך!`,
    online: "מחובר/ת", offline: "לא מחובר/ת", gmLocked: "פתחו את העיר העתידית במשחק כדי לשחק במשחק הזה.", noCoins: "לכיף · בלי מטבעות", leaders: "טבלת מובילים", lbSub: "10 הסיבובים הכי טובים (בסיבוב אחד, לא מצטבר)", lbEmpty: "עוד אין סיבובים. תהיו הראשונים!",
    lbMine: (n, r) => `השיא שלך בסיבוב אחד: ${n} · מקום ${r}`, lbNone: "שחקו סיבוב כדי להיכנס לטבלה!",
    gateT: (u) => `מצטערים, ${u}!`, gateAge: "הכניסה לג'אמפי קלאב היא מגיל 6 ומעלה. עד אז, כל העולם של ג'אמפי מחכה לך במשחק!", gateBd: "כדי להיכנס לג'אמפי קלאב צריך לדעת מתי יום ההולדת שלך. פתחו פעם אחת את המשחק של ג'אמפי, הוא ישאל, ואז חזרו לכאן.", gateBdT: "עוד דבר קטן",
    noPosts: "עוד אין פוסטים. צוות ג'אמפי יכתוב כאן בקרוב!", nComments: (n) => n === 1 ? "תגובה אחת" : `${n} תגובות`, by: (a) => `מאת ${a}`, edited: "נערך",
    noComments: "עוד אין תגובות. תהיו הראשונים!", waiting: "ממתינה לאישור", logToComment: "צריך להתחבר כדי לכתוב תגובה.", ageComment: "תגובות בבלוג הן מגיל 6 ומעלה.", shootAge: "משחקי היריות הם מגיל 13 ומעלה.",
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
const CATS = { all: ["All games", "כל המשחקים", "/club/img/nav/club.png"], arcade: ["Arcade", "ארקייד", "/club/img/cat/arcade.png"], fun: ["Just for fun", "לכיף", "/club/img/cat/fun.png"], duel: ["1v1", "1 על 1", "/club/img/cat/duel.png"], battle: ["Shooting", "יריות", "/club/img/cat/battle.png"],
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
  paintGate(); paintSnd(); if (typeof fillSelects === "function") fillSelects(); if (typeof route === "function" && !$("blog").hidden) route();
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
  } catch (err) { console.error(err); msg(t("fail")); }   // (no connection is caught in call(): this is anything else)
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
  if (me.ok) { const was = ME.pic, hadW = JSON.stringify(ME.worlds || null), hadT = ME.teen; Object.assign(ME, me.data); paintMe(); if (JSON.stringify(ME.worlds || null) !== hadW || ME.teen !== hadT) paintCat();
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

/* ---------- sound on / off for every game in the Club (the arcade, the learning games): one switch, kept in this browser ---------- */
const soundOn = () => { try { return localStorage.getItem("jumpi-club-sound") !== "off"; } catch (e) { return true; } };
function paintSnd() { const on = soundOn(), b = $("clSnd"); b.innerHTML = on ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>'
  : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>';
  b.setAttribute("aria-pressed", on); b.classList.toggle("off", !on); b.title = on ? (lang === "he" ? "צלילים פועלים" : "Sound on") : (lang === "he" ? "צלילים כבויים" : "Sound off"); b.setAttribute("aria-label", b.title); }
$("clSnd").onclick = () => { try { localStorage.setItem("jumpi-club-sound", soundOn() ? "off" : "on"); } catch (e) {} paintSnd(); };
addEventListener("storage", (e) => { if (e.key === "jumpi-club-sound") paintSnd(); });

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
// the game's own mini-games (public/club/arcade: made from the game by tools/club/build-arcade.mjs), each in a category
const GAME_CAT = { fruit: "arcade", shell: "arcade", flap: "arcade", rooftops: "arcade", drone: "race", dig: "puzzle", robot: "puzzle" };
const FUTURE_GAMES = ["drone", "robot", "rooftops"];
// just for fun (no coins): the Club's own
const FUN = {
  math: { title: "Math Challenge", titleHe: "תרגילי חשבון", sub: "Plus, minus, times and divide: how many can you get right?", subHe: "חיבור, חיסור, כפל וחילוק: כמה תצליחו?", color: "#1fb6ff", dark: "#0b5fa8", page: "/club/learn?m=math", pic: "/club/learn/math.webp" },
  hebrew: { title: "Learn Hebrew", titleHe: "לומדים עברית", sub: "Letters, words, colours and numbers in Hebrew.", subHe: "אותיות, מילים, צבעים ומספרים בעברית.", color: "#2fd36b", dark: "#17803a", page: "/club/learn?m=he", pic: "/club/learn/he.webp" },
  english: { title: "Learn English", titleHe: "לומדים אנגלית", sub: "ABC, words, colours and numbers in English.", subHe: "ABC, מילים, צבעים ומספרים באנגלית.", color: "#ff8a1c", dark: "#b0560a", page: "/club/learn?m=en", pic: "/club/learn/en.webp" },
  draw: { title: "Colouring Book", titleHe: "חוברת ציור", sub: "Colour the pages or draw your own. Your pictures are saved!", subHe: "צובעים דפים או מציירים חופשי. הציורים נשמרים לכם!", color: "#ff5fa8", dark: "#b0306f", page: "/club/draw", pic: "/club/draw/pic.webp" } };
// the Club's own puzzles (coin rounds with leaderboards, the server keeps the board: routes/puzzles.js)
const PUZZ = {
  memory: { title: "Memory Match", titleHe: "משחק הזיכרון", sub: "Flip the cards and find all the pairs!", subHe: "הופכים קלפים ומוצאים את כל הזוגות!", color: "#ff5fa8", dark: "#b0306f", page: "/club/puzzle?g=memory", pic: "/club/puzzle/memory.webp" },
  match3: { title: "Pet Match", titleHe: "שלוש בשורה", sub: "Swap the pets and make rows of three!", subHe: "מחליפים חיות ויוצרים שורות של שלוש!", color: "#1fb6ff", dark: "#0b5fa8", page: "/club/puzzle?g=match3", pic: "/club/puzzle/match3.webp" } };
Object.keys(PUZZ).forEach((g) => (GAME_CAT[g] = "puzzle"));
const ALL_GAMES = { ...ARCADE, ...PUZZ, ...FUN }; Object.keys(FUN).forEach((g) => (GAME_CAT[g] = "fun"));   // they open with the Future City (routes/rewards.js FUTURE_GAMES)
function paintCat() {
  const c = CATS[CAT] || CATS.all, name = lang === "he" ? c[1] : c[0];
  $("hubCatT").textContent = name; $("hubCatIc").src = c[2];
  const tooYoung = CAT === "battle" && !(ME && ME.teen);   // the shooting games: 13 and up
  const list = tooYoung ? [] : Object.keys(ALL_GAMES).filter((g) => (CAT === "all" ? GAME_CAT[g] !== "battle" || (ME && ME.teen) : GAME_CAT[g] === CAT)), box = $("hubGames");
  box.textContent = ""; $("hubEmpty").hidden = !!list.length; box.hidden = !list.length;
  $("hubEmptyP").textContent = tooYoung ? t("shootAge") : CAT === "all" ? t("catEmpty") : t("catEmptyOne", name);
  list.forEach((g, i) => {
    const G = ALL_GAMES[g], locked = FUTURE_GAMES.includes(g) && ME && Array.isArray(ME.worlds) && !ME.worlds.includes("future");
    const b = el("button", "gm" + (locked ? " locked" : "")); b.type = "button"; b.style.setProperty("--gc", G.color); b.style.setProperty("--gd", G.dark); b.style.setProperty("--i", i);
    const pic = el("span", "gm-pic"); const im = el("img"); im.src = G.pic || `/club/arcade/pics/${g}.webp`; im.alt = ""; im.loading = "lazy"; pic.append(im);
    pic.append(el("span", "gm-play", locked ? "🔒" : "▶")); b.append(pic);
    if (!locked) preview(b, pic, g);
    const tx = el("span", "gm-tx"); tx.append(el("b", "", lang === "he" ? G.titleHe : G.title), el("small", "", locked ? t("gmLocked") : lang === "he" ? G.subHe : G.sub));
    if (FUN[g]) tx.append(el("i", "gm-fun", t("noCoins"))); b.append(tx);
    b.onclick = () => (locked ? toast(t("gmLocked")) : openGame(g));
    const w = el("div", "gm-w"); w.append(b);
    box.append(w);
  });
}
// the mouse over a game: a few seconds of it being played (public/club/vid, recorded from the real games); nothing is downloaded before that
const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
function preview(card, pic, g) {
  if (!canHover) return;
  let v = null, on = false;
  const play = () => {
    on = true;
    if (!v) { v = document.createElement("video"); v.className = "gm-vid"; v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto"; v.disablePictureInPicture = true; v.setAttribute("aria-hidden", "true");
      const base = `/club/vid/${g}${lang === "he" ? ".he" : ""}`;
      for (const [ext, type] of [["webm", "video/webm"], ["mp4", "video/mp4"]]) { const s = document.createElement("source"); s.src = `${base}.${ext}`; s.type = type; v.append(s); }
      v.onplaying = () => on && pic.classList.add("vid"); pic.prepend(v); }
    const r = v.play(); if (r && r.catch) r.catch(() => {});
  };
  const stop = () => { on = false; pic.classList.remove("vid"); if (v) { v.pause(); setTimeout(() => { if (!on && v) v.currentTime = 0; }, 250); } };
  card.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && play());
  card.addEventListener("pointerleave", stop);
  card.addEventListener("focus", play); card.addEventListener("blur", stop);
}
// playing: the arcade page full screen in a frame; it tells us when it's closed and when my coins change
function openGame(g) {
  const f = $("arcFrame"), ifr = $("arcIf");
  ifr.src = FUN[g] ? FUN[g].page : PUZZ[g] ? PUZZ[g].page : `/club/arcade?g=${encodeURIComponent(g)}${FUTURE_GAMES.includes(g) ? "&w=future" : ""}`;
  f.hidden = false; document.body.classList.add("gaming"); setTimeout(() => ifr.focus(), 300);
}
function closeGame() { const f = $("arcFrame"); if (f.hidden) return; f.hidden = true; $("arcIf").src = "about:blank"; document.body.classList.remove("gaming"); if (ME) refresh(); }
// a game's leaderboard: the 10 best single rounds (not added up: one round), 1st / 2nd / 3rd in gold, silver, bronze
let lbGame = null;
async function openLeaders(g) {
  lbGame = g; const G = ALL_GAMES[g]; $("lbT").textContent = (lang === "he" ? G.titleHe : G.title) + " · " + t("leaders");
  $("lbSub").textContent = t("lbSub"); $("lbList").textContent = ""; $("lbMine").textContent = "";
  $("lbPlay").hidden = !$("arcFrame").hidden;
  openModal("mLeaders");
  const r = await call("/api/club/leaders?game=" + encodeURIComponent(g));
  if (lbGame !== g) return;
  const ul = $("lbList");
  if (!r.ok) { ul.append(el("li", "lb-none", say(r.data.error) || t("fail"))); return; }
  if (!r.data.top.length) ul.append(el("li", "lb-none", t("lbEmpty")));
  r.data.top.forEach((p) => { const li = el("li", "lb-row r" + Math.min(p.rank, 4) + (p.me ? " me" : ""));
    li.append(el("span", "lb-rank", String(p.rank)), face({ color: p.color }, 40, p.username)); const nm = el("b", "lb-name", iso(p.username)); li.append(nm);
    li.append(el("span", "lb-score", p.score.toLocaleString(lang === "he" ? "he-IL" : "en-US"))); ul.append(li); });
  $("lbMine").textContent = r.data.mine > 0 ? t("lbMine", r.data.mine.toLocaleString(lang === "he" ? "he-IL" : "en-US"), r.data.rank) : t("lbNone");
}
$("lbPlay").onclick = () => { closeModal($("mLeaders")); if (lbGame) openGame(lbGame); };

addEventListener("message", (e) => {
  if (e.origin !== location.origin || !e.data || !e.data.jumpiArcade) return;
  const m = e.data;
  if (m.jumpiArcade === "close") closeGame();
  else if (m.jumpiArcade === "coins" && ME && Number.isFinite(m.coins)) { ME.coins = m.coins; paintMe(); }
  else if (m.jumpiArcade === "login") { closeGame(); signedOut(); }
  else if (m.jumpiArcade === "leaders" && ARCADE[m.game]) openLeaders(m.game);
});

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
  renderDoc(p.doc, $("bpBody"));
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
    const tx = el("p"); tx.dir = "auto"; withEmoji(tx, c.text); w.append(hd, tx); li.append(w); ul.append(li);
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
    const tx = el("p"); tx.dir = "auto"; withEmoji(tx, c.text);
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
  $("mpTitle").value = post ? post.title : ""; renderDoc(post ? post.doc : { blocks: [{ t: "p", runs: [] }] }, $("mpBody")); $("mpMsg").hidden = true; $("mpFile").value = "";
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
  const m = $("mpMsg"), title = $("mpTitle").value.trim(), doc = domToDoc($("mpBody"));
  const bad = !title ? t("needTitle") : !picId ? t("needPic") : !doc.blocks.length ? t("needBody") : "";
  if (bad) { m.textContent = bad; m.classList.remove("ok"); m.hidden = false; return; }
  $("mpGo").disabled = true;
  const r = await call(editing ? `/api/blog/post/${editing}` : "/api/blog", { title, doc, image: picId });
  $("mpGo").disabled = false;
  if (!r.ok) { m.textContent = say(r.data.error) || t("fail"); m.classList.remove("ok"); m.hidden = false; return; }
  closeModal($("mPost")); toast(t("published"));
  if (location.hash === "#blog/" + r.data.post.id) loadPost(r.data.post.id); else location.hash = "#blog/" + r.data.post.id;
};

/* ---------- a post's text: drawn from its data (public/shared/blogdoc.js), and turned back into data from the editor ----------
   The same drawing is used to read a post and to edit it: <b> <i> <u> <s>, <font face/size/color> (the editor's own
   commands make those), a highlight <span>, and the Jumpi emojis as pictures. Every style comes from a short list. */
const SIZE_CODE = { s: "2", l: "5", xl: "7" }, CODE_SIZE = { 1: "s", 2: "s", 5: "l", 6: "l", 7: "xl" };
const emoImg = (name) => { const i = el("img", "emo"); i.src = `/club/emoji/${name}.png`; i.alt = ":" + name + ":"; i.dataset.e = name; i.draggable = false; return i; };
function runNode(r) {
  if (r.e) return isEmoji(r.e) ? emoImg(r.e) : document.createTextNode("");
  let n = document.createTextNode(r.x);
  const wrap = (tag) => { const w = document.createElement(tag); w.append(n); n = w; };
  if (r.h) { const w = el("span", "hl"); w.style.backgroundColor = r.h; w.append(n); n = w; }
  if (r.c || r.z || r.f) { const f = document.createElement("font"); if (r.c) f.setAttribute("color", r.c); if (r.z) f.setAttribute("size", SIZE_CODE[r.z]); if (r.f) f.setAttribute("face", r.f); f.append(n); n = f; }
  if (r.s) wrap("s"); if (r.u) wrap("u"); if (r.i) wrap("i"); if (r.b) wrap("b");
  return n;
}
function renderDoc(doc, box) {
  box.textContent = "";
  (doc && doc.blocks || []).forEach((b) => {
    const tag = b.t === "quote" ? "blockquote" : b.t, e = document.createElement(tag);
    if (b.a) e.style.textAlign = b.a;
    if (b.items) b.items.forEach((it) => { const li = document.createElement("li"); it.forEach((r) => li.append(runNode(r))); e.append(li); });
    else { b.runs.forEach((r) => e.append(runNode(r))); if (!b.runs.length) e.append(document.createElement("br")); }
    if (tag !== "ul" && tag !== "ol") e.dir = "auto";
    box.append(e);
  });
}
const toHex = (c) => { if (!c) return ""; if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase(); if (/^#[0-9a-f]{3}$/i.test(c)) return ("#" + c.slice(1).split("").map((x) => x + x).join("")).toLowerCase();
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c); if (!m || m[4] === "0") return ""; return "#" + [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, "0")).join(""); };
const fontKey = (face) => { const f = String(face || "").toLowerCase().replace(/["']/g, "").split(",")[0].trim(); return Object.keys(FONTS).find((k) => k === f || FONTS[k][0].toLowerCase() === f) || ""; };
function domToDoc(root) {
  const blocks = []; let cur = null;
  const block = (t, a) => { cur = { t, runs: [] }; if (a) cur.a = a; blocks.push(cur); return cur; };
  const alignOf = (n) => { const v = (n.style && n.style.textAlign) || (n.getAttribute && n.getAttribute("align")) || ""; const rtl = document.documentElement.dir === "rtl";
    return v === "center" ? "center" : v === "end" || (v === "right" && !rtl) || (v === "left" && rtl) ? "end" : ""; };
  const BLK = /^(P|DIV|H[1-6]|BLOCKQUOTE|UL|OL|LI|SECTION|ARTICLE)$/;
  function inline(n, runs, st) {
    if (n.nodeType === 3) { if (n.data) runs.push({ x: n.data, ...st }); return; }
    if (n.nodeType !== 1) return;
    if (n.tagName === "BR") { runs.push({ x: "\n" }); return; }
    if (n.tagName === "IMG") { if (isEmoji(n.dataset.e)) runs.push({ e: n.dataset.e }); return; }
    const o = { ...st }, T = n.tagName, cs = n.style || {};
    if (T === "B" || T === "STRONG" || /^(bold|[6-9]00)$/.test(cs.fontWeight)) o.b = true;
    if (T === "I" || T === "EM" || cs.fontStyle === "italic") o.i = true;
    if (T === "U" || /underline/.test(cs.textDecoration || cs.textDecorationLine || "")) o.u = true;
    if (T === "S" || T === "STRIKE" || T === "DEL" || /line-through/.test(cs.textDecoration || cs.textDecorationLine || "")) o.s = true;
    if (T === "FONT") { const c = toHex(n.getAttribute("color")); if (c) o.c = c; const z = CODE_SIZE[n.getAttribute("size")]; if (z) o.z = z; else if (n.getAttribute("size")) delete o.z; const f = fontKey(n.getAttribute("face")); if (f) o.f = f; }
    if (cs.color) { const c = toHex(cs.color); if (c) o.c = c; }
    if (cs.backgroundColor) { const h = toHex(cs.backgroundColor); if (h && h !== "#ffffff") o.h = h; }
    if (cs.fontFamily) { const f = fontKey(cs.fontFamily); if (f) o.f = f; }
    for (const ch of n.childNodes) { if (ch.nodeType === 1 && BLK.test(ch.tagName)) { walk(ch); cur = null; } else inline(ch, cur ? cur.runs : runs, o); }
  }
  function walk(n) {
    const T = n.tagName;
    if (T === "UL" || T === "OL") { const b = { t: T.toLowerCase(), items: [] }; blocks.push(b); cur = null;
      for (const li of n.children) { if (li.tagName !== "LI") continue; const runs = []; for (const ch of li.childNodes) inline(ch, runs, {}); b.items.push(runs); } return; }
    const t = /^H[12]$/.test(T) ? "h2" : /^H[3-6]$/.test(T) ? "h3" : T === "BLOCKQUOTE" ? "quote" : "p";
    if ([...n.children].some((c) => BLK.test(c.tagName))) {   // a box with blocks in it: its own lines before/after them are paragraphs
      cur = null; for (const ch of n.childNodes) { if (ch.nodeType === 1 && BLK.test(ch.tagName)) { walk(ch); cur = null; } else { if (!cur) block(t, alignOf(n)); inline(ch, cur.runs, {}); } } cur = null; return; }
    block(t, alignOf(n)); for (const ch of n.childNodes) inline(ch, cur.runs, {}); cur = null;
  }
  for (const n of root.childNodes) {
    if (n.nodeType === 1 && BLK.test(n.tagName)) { walk(n); continue; }
    if (n.nodeType === 1 && n.tagName === "BR") { cur = null; continue; }
    if (!cur) block("p"); inline(n, cur.runs, {});
  }
  // tidy: join neighbours with the same style, drop empty lines at the ends of a block, drop empty blocks
  const same = (a, b) => !a.e && !b.e && ["b", "i", "u", "s", "c", "h", "z", "f"].every((k) => a[k] === b[k]);
  const tidy = (runs) => { const out = []; runs.forEach((r) => { if (!r.e && !r.x) return; const last = out[out.length - 1]; if (last && same(last, r)) last.x += r.x; else out.push({ ...r }); });
    while (out.length && !out[0].e && !out[0].x.trim()) out.shift(); while (out.length && !out[out.length - 1].e && !out[out.length - 1].x.trim()) out.pop();
    if (out.length && !out[out.length - 1].e) out[out.length - 1].x = out[out.length - 1].x.replace(/\s+$/, ""); if (out.length && !out[0].e) out[0].x = out[0].x.replace(/^\s+/, ""); return out; };
  return { v: 1, blocks: blocks.map((b) => (b.items ? { ...b, items: b.items.map(tidy).filter((x) => x.length) } : { ...b, runs: tidy(b.runs) })).filter((b) => (b.items ? b.items.length : b.runs.length)) };
}
// a comment's text with its Jumpi emojis (written :jumpi_hi:) as pictures
function withEmoji(box, text) {
  let at = 0; String(text).replace(EMOJI_CODE, (m, name, i) => { if (!isEmoji(name)) return m; box.append(document.createTextNode(text.slice(at, i)), emoImg(name)); at = i + m.length; return m; });
  box.append(document.createTextNode(text.slice(at)));
}

/* ---------- the editor's buttons ---------- */
const COLORS = ["#6a35f0", "#9b5cff", "#1fb6ff", "#0d63c9", "#2fd36b", "#17803a", "#ffd23a", "#ff8a1c", "#ff4f8f", "#e0284a", "#1d2147", "#5d6390"];
const MARKS = ["#fff1a8", "#ffe0b8", "#ffd6e8", "#e9e1ff", "#d4f5ff", "#dcfbe4"];
const ed = $("mpBody");
let edRange = null;
const keepSel = () => { const s2 = getSelection(); if (s2.rangeCount && ed.contains(s2.anchorNode)) edRange = s2.getRangeAt(0).cloneRange(); };
const backSel = () => { ed.focus({ preventScroll: true }); if (edRange) { const s2 = getSelection(); s2.removeAllRanges(); s2.addRange(edRange); } };
document.addEventListener("selectionchange", keepSel);
const exec = (cmd, val) => { backSel(); try { document.execCommand("styleWithCSS", false, false); } catch (e) {} document.execCommand(cmd, false, val); keepSel(); paintBar(); };
document.querySelectorAll(".ed-bar [data-cmd]").forEach((b) => { b.onmousedown = (e) => e.preventDefault(); b.onclick = () => exec(b.dataset.cmd); });
document.querySelectorAll(".ed-bar [data-block]").forEach((b) => { b.onmousedown = (e) => e.preventDefault(); b.onclick = () => exec("formatBlock", "<" + b.dataset.block + ">"); });
document.querySelectorAll(".ed-bar [data-align]").forEach((b) => { b.onmousedown = (e) => e.preventDefault();
  b.onclick = () => { const rtl = document.documentElement.dir === "rtl", a = b.dataset.align; exec(a === "center" ? "justifyCenter" : (a === "start") !== rtl ? "justifyLeft" : "justifyRight"); }; });
function paintBar() { ["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList"].forEach((c) => { const b = document.querySelector(`.ed-bar [data-cmd="${c}"]`); try { b.classList.toggle("on", document.queryCommandState(c)); } catch (e) {} }); }
ed.addEventListener("keyup", paintBar); ed.addEventListener("mouseup", paintBar);
// paste: only the text (pasted pages bring their own styles and tags)
ed.addEventListener("paste", (e) => { e.preventDefault(); const txt = (e.clipboardData || window.clipboardData).getData("text/plain"); document.execCommand("insertText", false, txt); });
ed.addEventListener("drop", (e) => e.preventDefault());
function fillSelects() {
  const he = lang === "he";
  $("edFont").textContent = ""; Object.entries(FONTS).forEach(([k, v]) => { const o = el("option", "", he ? v[1] : v[0]); o.value = k; o.style.fontFamily = v[2]; $("edFont").append(o); });
  $("edSize").textContent = ""; [["m", he ? "רגיל" : "Normal"], ...Object.entries(SIZES).map(([k, v]) => [k, he ? v[1] : v[0]])].forEach(([k, n]) => { const o = el("option", "", n); o.value = k; $("edSize").append(o); });
}
$("edFont").onchange = () => { exec("fontName", $("edFont").value); };
$("edSize").onchange = () => { const z = $("edSize").value; exec("fontSize", z === "m" ? "3" : SIZE_CODE[z]); };
function pops(btnId, popId, fill) {
  const b = $(btnId), p = $(popId); b.onmousedown = (e) => e.preventDefault();
  b.onclick = (e) => { e.stopPropagation(); const open = p.hidden; document.querySelectorAll(".ed-pop").forEach((x) => (x.hidden = true)); if (open) { fill(p); p.hidden = false; const g = p.querySelector(".ed-emo-grid"); if (g && g.onscroll) g.onscroll(); } };
}
document.addEventListener("click", (e) => { if (!e.target.closest(".ed-pop-w")) document.querySelectorAll(".ed-pop").forEach((x) => (x.hidden = true)); });
const swatches = (p, list, onPick, none) => {
  p.textContent = ""; const g = el("span", "ed-sw");
  if (none) { const b = el("button", "sw none"); b.type = "button"; b.title = "×"; b.onmousedown = (e) => e.preventDefault(); b.onclick = () => { onPick(""); p.hidden = true; }; g.append(b); }
  list.forEach((c) => { const b = el("button", "sw"); b.type = "button"; b.style.background = c; b.title = c; b.onmousedown = (e) => e.preventDefault(); b.onclick = () => { onPick(c); p.hidden = true; }; g.append(b); });
  const own = el("label", "sw own"); own.title = lang === "he" ? "צבע אחר" : "Another colour"; const inp = el("input"); inp.type = "color"; inp.oninput = () => onPick(inp.value); own.append(inp); g.append(own);
  p.append(g);
};
pops("edColorB", "edColorP", (p) => swatches(p, COLORS, (c) => { exec("foreColor", c || "#1d2147"); $("edColorI").style.background = c || ""; }, true));
pops("edMarkB", "edMarkP", (p) => swatches(p, MARKS, (c) => { exec("hiliteColor", c || "transparent"); $("edMarkI").style.background = c || ""; }, true));
/* the emoji window: Jumpi's own first, then every emoji in the usual groups (tabs jump to a group) */
const EMO_CATS = [["jumpi", "Jumpi", "ג'אמפי", null], ["smileys", "Smileys", "סמיילים", "😀"], ["people", "People", "אנשים", "👋"], ["nature", "Animals & nature", "חיות וטבע", "🐶"],
  ["food", "Food", "אוכל", "🍕"], ["activity", "Activities", "פעילויות", "⚽"], ["travel", "Travel & places", "טיולים ומקומות", "✈️"], ["objects", "Objects", "חפצים", "💡"],
  ["symbols", "Symbols", "סמלים", "❤️"], ["flags", "Flags", "דגלים", "🏁"]];
function emoPicker(catsBox, grid, onPick) {
  if (grid.dataset.built === lang) return; grid.dataset.built = lang;
  catsBox.textContent = ""; grid.textContent = "";
  EMO_CATS.forEach(([k, en, he, ic]) => {
    const tab = el("button", "emo-cat"); tab.type = "button"; tab.title = lang === "he" ? he : en;
    if (ic) tab.textContent = ic; else tab.append(emoImg("jumpi_hi"));
    const head = el("span", "emo-h", lang === "he" ? he : en), sec = el("span", "emo-sec");
    tab.onmousedown = (e) => e.preventDefault(); tab.onclick = (e) => { e.stopPropagation(); grid.scrollTo({ top: head.offsetTop, behavior: "smooth" }); };
    catsBox.append(tab);
    const list = k === "jumpi" ? EMOJI : EMOJI_GROUPS[k] || [];
    list.forEach((v) => { const b = el("button", "emo-b" + (k === "jumpi" ? "" : " std")); b.type = "button";
      if (k === "jumpi") { b.title = ":" + v + ":"; b.append(emoImg(v)); } else b.textContent = v;
      b.onmousedown = (e) => e.preventDefault(); b.onclick = (e) => { e.stopPropagation(); onPick(v, k === "jumpi"); }; sec.append(b); });
    grid.append(head, sec);
  });
  // which group is showing: its tab lights up
  const tabs = [...catsBox.children], heads = [...grid.querySelectorAll(".emo-h")];
  grid.onscroll = () => { let i = 0; heads.forEach((h, j) => { if (h.offsetTop <= grid.scrollTop + 8) i = j; }); tabs.forEach((x, j) => x.classList.toggle("on", j === i)); };
  grid.onscroll();
}
const putEmoji = (v, jumpi) => { if (jumpi) { backSel(); const img = emoImg(v); const sel = getSelection(); if (!sel.rangeCount) ed.append(img); else { const r = sel.getRangeAt(0); r.deleteContents(); r.insertNode(img); r.setStartAfter(img); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); } keepSel(); }
  else exec("insertText", v); };
pops("edEmoB", "edEmoP", () => emoPicker($("edEmoC"), $("edEmoG"), putEmoji));
// the comment box: Jumpi emojis go in as :name:, the others as they are
pops("bcEmoB", "bcEmoP", () => emoPicker($("bcEmoC"), $("bcEmoG"), (n, jumpi) => { const ta = $("bcText"), a2 = ta.selectionStart ?? ta.value.length, b2 = ta.selectionEnd ?? a2, code = jumpi ? ":" + n + ":" : n;
  if (ta.value.length + code.length > 400) return; ta.value = ta.value.slice(0, a2) + code + ta.value.slice(b2); ta.focus(); ta.selectionStart = ta.selectionEnd = a2 + code.length; }));

// the start: the same language as the rest of the site, then: am I logged in already?
{ let start = null; try { start = new URLSearchParams(location.search).get("lang") || localStorage.getItem("jumpi-lang"); } catch (e) {}
  setLang(start || (/^he|^iw/i.test(navigator.language || "") ? "he" : "en")); }
route();
api("me").then((r) => { if (r.ok && r.data.user) signedIn(r.data.user); else if (r.data && r.data.error) msg(r.data.error); }).catch(() => {});
