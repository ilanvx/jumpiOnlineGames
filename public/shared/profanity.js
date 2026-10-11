/*
  Jumpi word filter (English + Hebrew). Used by the server (the real check) and by the page
  (so a blocked message never even shows up on your own screen).

  It catches the usual tricks:
    - CAPS, accents, Hebrew vowel points, invisible characters, look-alike letters (Cyrillic а/е/о…)
    - leet speak: sh1t, $hit, @ss, f4ck, b!tch
    - stretched letters: fuuuuck, shiiit, זוווונה
    - letters split up: f.u.c.k, f-u-c-k, f u c k, ז ו נ ה
    - masked letters: f*ck, sh#t, b**ch
    - Hebrew prefixes and final letters: והזונה, ושרמוטה, זין/זיין, כוסאמק
  …while letting normal words through ("class", "assume", "hello", "Scunthorpe", "כוס מים").
*/

// whole words only (they are innocent inside longer words)
const EXACT = `
ass asses arse arses damn dammit crap crappy dick dicks cock cocks tit tits titty titties boob boobs cum cumming sex sexy porn porno horny nude nudes naked
penis vagina anal anus rape raped rapist raping kys stfu wtf gtfo fck fcking fk fuk fuq fukin sht btch biatch hoe hoes thot slag prick piss pissed pissing
wanker twat bollocks bastard bastards douche douchebag jackass dumbass smartass badass retard retarded tard nazi nazis hitler dildo boner blowjob handjob orgasm milf
xxx nsfw jizz skank pedo pedophile incest
kus kusit kusemek kusemak kusamak kusomo kusaomo kusemok kusochten sharmuta sharmut sharmuta zona zonot benzona yabenzona manyak maniak manyaki tizdayen
mizdayen lechtizdayen zayen shmok shmuk kibinimat kibenimat
זין זיין זינים זיינים חרא חארה זונה זונות שרמוטה שרמוטות שרמוט שרמוטים מניאק מניאקים מניאקית מזדיין מזדיינת מזדיינים תזדיין תזדייני תזדיינו להזדיין
אמשכ זיון זיונים כוסית כוסיות כוסון כוסאמק כוסאמא כוסעמק כוסעמאק כוסאומו כוסומו כוסאמאשך כוסאמך שמוק שמוקים פאק פאקינג פאקיו שיט ביצ בטצ ביטצ קוקסינל
מפגר מפגרת מפגרים מפגרות דביל דבילית דבילים אידיוט אידיוטית אידיוטים מטומטם מטומטמת מטומטמים תסתום תסתמי תסתמו קיבינימט קבינימט נאצי נאצים היטלר
`;
// these start a bad word (fucking, shitty, bitches, שרמוטות…)
const STEMS = `
fuck phuck phuk motherf shit bullshit bitch cunt whore slut nigg fagg pussy porn dickhead asshole dipshit jackoff jerkoff wank cocksuck sexting horni
שרמוט מזדיי תזדיי כוסאמ כוסעמ מניאק
`;
// so bad they are blocked anywhere, even glued to other words ("youfuckingidiot", usernames)
const ANYWHERE = `fuck motherfuck nigger nigga faggot cunt whore bitch shit pussy dickhead asshole porn שרמוט כוסאמ כוסעמק מזדיינ`;
// phrases (checked on the cleaned text with single spaces)
const PHRASES = [
  /\bkill (your ?self|ur ?self|yo ?self|urslf)\b/, /\bgo (die|kill)\b/, /\bgo to hell\b/, /\bsuck my\b/, /\bson of a\b/, /\bshut the\b/,
  /(^| )כוס ?(אמ|עמ|אומ|האמ|אחות)/, /(^| )בנ? ?זונ/, /(^| )בת (זונ|כלב)/, /(^| )לכ? ?ת(מות|זדיינ)/, /(^| )ש?תמות( |$)/, /(^| )סתומ? ?(ת|את) ?ה?פה/, /(^| )אמא שלכ זונ/,
];
// threats, "your mom…" insults and asking for someone's address / phone (kids' safety).
// The text here is already cleaned: final letters are regular (ך→כ, ם→מ, ן→נ), no apostrophes (i'll → ill).
const VERB_HURT = "ארצח|נרצח|ירצח|ירצחו|ארצחו|תרצח|אהרוג|נהרוג|יהרוג|יהרגו|אהרוגו|אשחט|ישחטו|נשחט|אדקור|ידקרו|נדקור|אפוצצ|נפוצצ|אכסח|נכסח|יכסחו|אחנוק|אחסל|נחסל|אפרק|נפרק|אזיינ|נזיינ|אשרופ|ארסק|אשבור|נשבור|אדפוק|אכה|ארביצ|נרביצ|אקבור|אעלימ|ארוצצ|אנקומ|אירה|ניירה";
const FAMILY = "אמא|אמכ|אמשכ|אימא|אמא שלכ|אמא שלכמ|אמ שלכ|אחות שלכ|אחותכ|סבתא שלכ|אבא שלכ|דודה שלכ|המשפחה שלכ";
const THREATS = [
  new RegExp(`(^| )(אני |אנחנו )?(${VERB_HURT})( (את|אותכ|אותכמ|אותה|אותו|לכ|לכמ|בכ|לה|לו)|$)`),
  /(^| )(אני |אנחנו )?(הורג|הורגת|רוצח|רוצחת|שוחט|דוקר|מפוצצ|מכסח|הורגימ|רוצחימ) (אותכ|אותכמ|אותה|אותו)/,
  /(^| )(תקבל|תקבלי|תחטופ|תחטפי|תאכל|תאכלי|אתנ לכ|אביא לכ|נביא לכ|ניתנ לכ) (מכות|כאפה|כאפות|סטירה|אגרופ|בוקס)/,
  new RegExp(`(^| )(${FAMILY}) ?(עלי|עליי|עלינו|בפה|על הזינ|על הזיינ|מתה|תמות|בקבר|זונ|שרמוט|כלבה|מוצצ|מזדיינ|נזדיינ|שמנה|מכוערת)`),
  /(^| )(ש|ש?י)?(תמות|תמותי|תמותו|תישרפ|תישרפי|יישרפ|תחלה|תחלי|תיחנק|תחטופ סרטנ)( |$)/, /(^| )ימח שמ/, /(^| )שתקבל סרטנ/,
  /(^| )(אני )?(יודע|יודעת) איפה (אתה|את|אתמ) (גר|גרה|גרימ)/, /(^| )איפה (אתה|את|אתמ) (גר|גרה|גרימ)/, /(^| )(מה|תנ לי|שלח לי|תשלח לי) (את )?(הכתובת|כתובת|מספר הטלפונ|הטלפונ|מספר טלפונ|הכתובת שלכ|הטלפונ שלכ)/,
  /\b(ill|i will|im gonna|i am gonna|gonna|im going to|i am going to|we will|well|imma|ima) (kill|murder|stab|shoot|hurt|punch|rape|strangle|choke|burn|slap) (you|u|ya|your|yall|him|her)\b/,
  /\b(kill|murder|stab|shoot|strangle|choke) (you|u|ya|yourself|urself)\b/, /\b(you|u|ya) (should|gonna|will|must) (die|be dead)\b/, /\b(hope|wish) (you|u) (die|get cancer|were dead)\b/, /\b(die in a|just die|drop dead)\b/,
  /\b(your|ur|yo|you) (mom|mum|mama|momma|mother|sister|sis)( is| was|s)? ?(a |so )?(whore|slut|hoe|ho|bitch|fat|ugly|dead|gay)\b/,
  /\b(where do (you|u) live|wheres? (you|u|ur) (live|house)|i know where (you|u) live|(what is|whats|send me|give me|tell me) (your|ur) (address|adress|number|phone|phone number|home address))\b/,
];
// real words that would otherwise trip the Hebrew prefix rule (מזין = nutritious, הזין = typed in)
const ALLOW_RAW = ["מזין", "מזינה", "מזינים", "מזינות", "הזין", "הזינו", "הזינה", "להזין", "ומזין", "שמזין", "תזין", "יזין", "נזין", "מזונה", "מזונות", "במזונות", "assume", "class", "pass", "mass", "glass", "grass", "bass", "brass", "cockpit", "peacock", "cocktail", "hancock", "dickens", "scunthorpe", "shitake", "shiitake", "hello", "shell", "assess", "cumulative", "document", "sextant", "essex", "sussex", "middlesex", "therapist", "grape", "drape", "scrape", "snigger", "analysis", "analyst"];

const LEET = { "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s", "7": "t", "8": "b", "9": "g", "+": "t", "€": "e", "£": "l" };
const LOOKALIKE = { "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "к": "k", "м": "m", "т": "t", "в": "b", "н": "h", "і": "i", "ѕ": "s", "ј": "j", "α": "a", "ο": "o", "ε": "e", "ι": "i", "κ": "k", "ν": "v", "τ": "t", "υ": "u" };
const FINALS = { "ם": "מ", "ן": "נ", "ץ": "צ", "ף": "פ", "ך": "כ" };
const HEB_PREFIX = "והשבלמכ";
const LETTER = /[a-zא-ת]/;

function prep(text) {
  return String(text ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[֑-ׇ̀-ͯ]/g, "") // Hebrew points, Latin accents
    .replace(/[​-‏‪-‮⁠-⁤﻿­͏]/g, "") // invisible characters
    .replace(/[Ѐ-ӿͰ-Ͽ]/g, (ch) => LOOKALIKE[ch] || ch)
    .replace(/[םןץףך]/g, (ch) => FINALS[ch])
    .replace(/[׳'`´’"״]/g, ""); // ביץ' → ביצ
}
const words = (s) => [...new Set(prep(s).split(/\s+/).filter(Boolean))];
// "fuck" → f+u+c+k+ ; "ass" → a+s{2,}  (stretched letters still match, short words don't collide)
function stretchy(w) {
  let out = "";
  for (let i = 0; i < w.length; ) {
    let j = i;
    while (j < w.length && w[j] === w[i]) j++;
    const ch = w[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), n = j - i;
    out += n === 1 ? `${ch}+` : `${ch}{${n},}`;
    i = j;
  }
  return out;
}
const ALLOW = new Set(ALLOW_RAW.map((w) => prep(w)));
const EXACT_W = words(EXACT), STEM_W = words(STEMS), ANY_W = words(ANYWHERE);
const EXACT_RE = EXACT_W.map((w) => new RegExp(`^${stretchy(w)}$`));
const STEM_RE = STEM_W.map((w) => new RegExp(`^${stretchy(w)}`));
const ANY_RE = ANY_W.map((w) => new RegExp(stretchy(w)));

// one chunk of text → the letters to check ("sh1t!" → "shit"); masked chunks ("f*ck") stay as a pattern
function token(raw) {
  if (!LETTER.test(raw) && !/[0-9@$!|]/.test(raw)) return null;
  // leet only counts next to real letters ("sh1t"), or for symbol-only words ("@$$"); plain numbers like 455 stay numbers
  if (!LETTER.test(raw) && /[0-9]/.test(raw)) return null;
  const leet = raw.replace(/[0-9@$!|+€£]/g, (c) => LEET[c] || c);
  const masked = /[a-zא-ת][*#]+|[*#]+[a-zא-ת]/.test(leet);
  return { word: leet.replace(/[^a-zא-ת]/g, ""), mask: masked ? leet.replace(/[^a-zא-ת*#]/g, "") : null };
}
function badWord(w, anywhere = true) {
  if (!w || ALLOW.has(w)) return null;
  // also try without Hebrew prefixes: והזונה → הזונה → זונה
  const tries = [w];
  for (let i = 0; i < 3 && i < w.length - 2 && HEB_PREFIX.includes(w[i]); i++) tries.push(w.slice(i + 1));
  for (const t of tries) {
    if (ALLOW.has(t)) return null;
    for (let i = 0; i < EXACT_RE.length; i++) if (EXACT_RE[i].test(t)) return EXACT_W[i];
    for (let i = 0; i < STEM_RE.length; i++) if (STEM_RE[i].test(t)) return STEM_W[i];
  }
  if (anywhere) for (let i = 0; i < ANY_RE.length; i++) if (ANY_RE[i].test(w)) return ANY_W[i];
  return null;
}
// f*ck, sh#t, b**ch: the stars can be any letter
function badMask(m) {
  const letters = m.replace(/[*#]/g, "").length;
  if (letters < 1 || letters < m.length / 2) return null;
  const re = new RegExp(`^${m.replace(/[*#]/g, ".")}`);
  for (const w of [...EXACT_W, ...STEM_W]) if (w.length >= m.length - 1 && w.length <= m.length + 3 && re.test(w) && (w.length === m.length || STEM_W.includes(w))) return w;
  return null;
}

/** Is this text OK to show? → { ok: true } or { ok: false, word } */
/* ---------- personal info: phone numbers, home addresses, emails (kids' safety) ----------
   Blocked everywhere chat goes (Plaza, homes, JumpiChat, trade and game windows). These are not "bad words":
   the player gets a friendly "never share this" window instead of a strike. */
const NUM_WORDS = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  אפס: 0, אחד: 1, אחת: 1, שתיימ: 2, שתימ: 2, שניימ: 2, שנימ: 2, שתי: 2, שני: 2, שלוש: 3, שלש: 3, ארבע: 4, ארבעה: 4, חמש: 5, חמישה: 5, שש: 6, שישה: 6, שבע: 7, שבעה: 7, שמונה: 8, תשע: 9, תשעה: 9,
};
function digitsOf(p) {
  // number words → digits ("zero five four", "אפס חמש ארבע"), then keep runs of digits with separators between them
  const t = p.replace(/[a-zא-ת]+/g, (w) => (w in NUM_WORDS ? String(NUM_WORDS[w]) : w));
  const runs = t.match(/\+?\d[\d\s().\-_/\\|*,]{0,40}\d|\d/g) || [];
  return runs.map((r) => ({ raw: r, d: r.replace(/\D/g, ""), plus: r.startsWith("+") }));
}
const STREET = "רחוב|רחובות|רח|שדרות|שד|סמטת|סמטה|כיכר|street|st|road|rd|avenue|ave|av|lane|ln|blvd|boulevard|drive|dr|way|court|ct|place|pl";
const ADDRESS_RES = [
  new RegExp(`(^| )(${STREET})\\.? [a-zא-ת][a-zא-ת ]{0,24}\\d{1,4}`),            // "רחוב הרצל 12", "street herzl 5"
  new RegExp(`(^| )\\d{1,5} [a-zא-ת][a-zא-ת ]{0,24}(${STREET})\\.?( |$)`),       // "12 main street", "5 herzl st"
  new RegExp(`(^| )[a-zא-ת]{2,20} (${STREET})\\.? ?\\d{1,4}( |$)`),               // "herzl street 12"
  /(^| )(אני|אנחנו|אנו) ?(גר|גרה|גרים|גרות|גרימ)( |$)(ב|ליד|על|בעיר|ברחוב|בשכונת|בשכונה|בכתובת)/,
  /(^| )(גר|גרה|גרים|גרימ|גרות) ב?(רחוב|רח|שכונת|שדרות|בניינ|דירה|קומה)/,
  /(^| )(הכתובת|הכתובות|כתובת) (שלי|שלנו|של הבית)/, /(^| )הבית שלי (ב|נמצא|ליד|ברחוב)/, /(^| )(בואו|בוא|תבוא|תבואי) (אליי|אלי|אלינו) (הביתה|לבית)/,
  /(^| )(דירה|קומה|כניסה|בניינ|מיקוד)( מספר)? ?\d/, /(^| )מיקוד( |$)/,
  /\bi live (in|at|on|near|next to|by)\b/, /\bwe live (in|at|on|near)\b/, /\bmy (home |house |)(address|adress|adres)\b/, /\bmy (house|home|place) is (at|on|in|near)\b/,
  /\b(apartment|apt|flat|floor|unit|suite)( number| no| #)? ?\d/, /\b(zip|zipcode|zip code|postal code|postcode)\b/, /\bcome (to|over to) my (house|home|place)\b/,
];
const EMAIL_RES = [/[a-z0-9._%+-]+ ?@ ?[a-z0-9.-]+\.[a-z]{2,}/, /\b(gmail|hotmail|yahoo|walla|outlook|icloud|protonmail|proton|gmx|aol|yandex|mail\.ru)( ?(\.|dot) ?(com|co|net|org|il|me|ru))?\b/, /(ג[׳']?ימייל|גימייל|הוטמייל|וואלה מייל|שטרודל)/,
  // "kid at proton dot me", "kid (at) mail (dot) com"
  /\b[a-z0-9._-]{2,} ?[([]?(at|@)[)\]]? ?[a-z0-9-]{2,} ?[([]?(dot|\.)[)\]]? ?(com|net|org|me|il|co|io|ru|de|uk)\b/, /\bat [a-z0-9-]{2,} dot (com|net|org|me|il|co|io)\b/];
// links: other websites and invite links (kids' safety: nobody gets taken out of the game)
const LINK_RES = [/\b(https?|hxxps?) ?: ?\/\//, /\bwww ?\./, /\b[a-z0-9-]{2,}\.(com|net|org|gg|io|il|ly|xyz|tv|ru|info|biz|site|online)\b/, /\b[a-z0-9-]{2,}\.(co|me)\.[a-z]{2,3}\b/,
  /\b[a-z0-9-]{2,} ?(dot|\(dot\)|\[dot\]) ?(com|net|org|gg|me|io|co|il|tv|app|ru)\b/, /\b(discord ?\.? ?gg|bit ?\. ?ly|t ?\. ?me|wa ?\. ?me|tinyurl|linktr ?\.? ?ee)\b/];
// other apps where a stranger could talk to a child alone (English and Hebrew)
const APP_RE = /\b(snap ?chat|snapchat|(my|ur|your|on|add me on|follow me on) snap|snep|insta|instagram|insta ?gram|telegram|tele ?gram|tik ?tok|tiktok|kik|whats ?app|watsapp|watsap|facebook|messenger|discord|skype|wechat|signal app|omegle|yubo|houseparty)\b|(סנאפ|סנפצ|סנאפצ|אינסטה|אינסטגרמ|טלגרמ|טיקטוק|טיק טוק|דיסקורד|פייסבוק|מסנגר|סקייפ|וואטסאפ|ווטסאפ|ווצאפ|וצאפ|וואצאפ)/;
// asking a child for pictures, secrets, to be alone or to meet: never allowed (they get the "keep safe" window)
const UNSAFE_RES = [
  /\b(send|show|give) me (a |some |ur |your )?(pic|pics|picture|pictures|photo|photos|selfie|selfies|nudes|vid|video|face|body)\b/, /\b(send|show) (ur|your) (pic|pics|picture|pictures|photo|photos|selfie|face|body)\b/,
  /\b(pic|pics|photo|photos|selfie) of (you|u|yourself|urself)\b/, /\bnudes?\b/,
  /\b(dont|do not|never) tell (your|ur) (mom|mum|mommy|dad|daddy|parents|mother|father|family|teacher)\b/, /\bour (little )?secret\b/, /\b(just )?between (you and me|us two)\b/,
  /\b(are|r) (you|u) (home alone|alone (at|in) (home|the house|your room|ur room)|alone right now)\b/, /\b(is|are) (your|ur) (mom|mum|dad|parents) (home|there|around|out)\b/,
  /\bmeet (me |up )?(irl|in real life|in person|outside|after school)\b/, /\b(irl|in real life|in person) (meet|meetup|meet up|hang out)\b/,
  /(^| )(תשלח|תשלחי|שלח|שלחי|תראה|תראי)( לי) (תמונה|תמונות|סלפי|צילומ|סרטונ)/, /(^| )(אל|לא) (תספר|תספרי|תגיד|תגידי|לספר|להגיד) (להורימ|להורימ שלכ|לאמא שלכ|לאבא שלכ|למורה שלכ)/,
  /(^| )(זה )?(סוד|הסוד) (בינינו|שלנו|רק שלנו)/, /(^| )(אתה|את|אתמ) (לבד|לבדכ|לבדכמ) (בבית|בחדר)/, /(^| )(ההורימ|אמא|אבא) שלכ (בבית|לא בבית)( |$)/,
  /(^| )(ניפגש|נפגש|להיפגש|להפגש|ניפגשימ)( מחר| היומ)? (בחוצ|במציאות|באמת|בעולמ האמיתי|אחרי בית ספר|אחרי בית הספר)/,
];
// worth a look by the team, but not blocked (questions many kids ask each other): realtime/plaza.js and routes/social.js flag these
const RISK_RES = [
  /\b(how old (are|r) (you|u)|what is (your|ur) age|whats (your|ur) age|asl)\b/, /(^| )(בנ|בת) כמה (אתה|את)( |$)/, /(^| )מה הגיל שלכ/,
  /\b(what|which) school (do|are|r) (you|u)\b/, /\bwhere do (you|u) go to school\b/, /(^| )(באיזה|איזה) (בית ספר|ביספ|ביס) (אתה|את)/, /(^| )(מאיפה|מאיזו עיר) (אתה|את)( |$)/, /\bwhat city (do|are) (you|u)\b/,
  /\b(be my|wanna be my|you are my|ur my) (girlfriend|boyfriend|gf|bf)\b/, /(^| )(תהיה|תהיי|רוצה להיות) (החבר|החברה) שלי/,
  /\b(you are|ur|you r) (so |really |very )?(hot|sexy|cute|pretty|beautiful)( girl| boy)?$/, /\b(kiss|cuddle|touch) (me|you|u)\b/, /\b(older|grown up|adult) (friend|guy|man)\b/,
  /\b(are|r) (you|u) alone$/, /\b(dont|do not|never) tell (anyone|anybody|nobody) about (me|us|this)\b/,
];
const PHONE_WORDS = /\b(phone|fone|number|cell|mobile|whatsapp|whats app|watsap|call me|text me|sms|tel)\b|(טלפונ|פלאפונ|נייד|מספר|וואטסאפ|ווטסאפ|ווצאפ|וצאפ|תתקשר|תסמס)/;
// digits in any script (Arabic ٠٥٤, Persian ۰۵۴, Devanagari, full-width…) → 0-9, and invisible characters out
const DIGIT_ZEROS = [0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xde6, 0xe50, 0xed0, 0xf20, 0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80, 0x1a90, 0x1b50, 0x1bb0, 0x1c40, 0x1c50, 0xa620, 0xa8d0, 0xa900, 0xa9d0, 0xa9f0, 0xaa50, 0xabf0, 0xff10];
const INVISIBLE = /[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\u20d0-\u20ff\u3164\ufe00-\ufe0f\ufeff\uffa0]|\udb40[\udc00-\udcff]/g;
export function plainText(text) {
  return String(text ?? "").normalize("NFKC").replace(INVISIBLE, "").replace(/\p{Nd}/gu, (ch) => {
    const c = ch.codePointAt(0);
    if (c >= 48 && c <= 57) return ch;
    for (const z of DIGIT_ZEROS) if (c >= z && c <= z + 9) return String(c - z);
    return ch;
  });
}
export function privateInfo(text) {
  const raw = plainText(text);
  const p = raw.toLowerCase().replace(/[֑-ׇ]/g, "").replace(/[םןץףך]/g, (ch) => FINALS[ch]).replace(/[׳'`´’"״]/g, "").replace(/\s+/g, " ");
  // phone numbers: 9+ digits, or 7+ starting with 0 / +, or 5+ next to a word like "phone" / "טלפון"
  for (const r of digitsOf(p)) {
    const n = r.d.length;
    if (n >= 9 || (n >= 7 && (r.d[0] === "0" || r.plus || r.d.startsWith("972"))) || (n >= 5 && PHONE_WORDS.test(p))) {
      if (n >= 7 && /^1?0{6,}$/.test(r.d.replace(/^(\d)/, "1"))) continue;   // "1,000,000 coins" is just a big number
      return "phone";
    }
  }
  if (EMAIL_RES.some((re) => re.test(p))) return "email";
  if (LINK_RES.some((re) => re.test(p))) return "link";
  const words = " " + p.replace(/[^a-zא-ת0-9 ]+/g, " ").replace(/\s+/g, " ").trim() + " ";
  if (ADDRESS_RES.some((re) => re.test(words.trim()) || re.test(words))) return "address";
  if (APP_RE.test(p) || APP_RE.test(words)) return "app";
  if (UNSAFE_RES.some((re) => re.test(words.trim()) || re.test(words))) return "unsafe";
  return null;
}
// a phone number sent in pieces ("054", "123", "4567"): the server keeps the last digits of each player for a while
// prevDigits keeps the pieces of the last minute ("<time>:054|<time>:123"); a phone number can start at any of them.
// Only short messages that are mostly digits (or say "phone" / "מספר") count as pieces, so "I got 1000 coins" doesn't.
export function splitPhone(prevDigits, text) {
  const p = plainText(text).toLowerCase().replace(/[םןץףך]/g, (ch) => FINALS[ch]);
  const now = Date.now();
  const kept = String(prevDigits || "").split("|").map((x) => x.split(":")).filter(([t, d]) => /^\d+$/.test(d || "") && now - Number(t) < 60_000);
  const d = digitsOf(p).map((r) => r.d).join("");
  const letters = p.replace(/[^a-zא-ת]/g, "").length;
  const piece = d && (d.length >= letters || PHONE_WORDS.test(p));
  const pieces = (piece ? [...kept, [String(now), d]] : kept).slice(-8);
  let hit = false;
  if (piece)
    for (let i = 0; i < pieces.length && !hit; i++) {
      const all = pieces.slice(i).map(([, x]) => x).join("");
      hit = all.length >= 9 && all.length <= 16 && (all[0] === "0" || all.startsWith("972"));
    }
  return { digits: pieces.map(([t, x]) => t + ":" + x).join("|"), hit, changed: !!piece };
}
/** Something the team should look at (asking a child's age, school, "be my girlfriend"…): a reason, or null. Not blocked. */
export function riskText(text) {
  const p = " " + plainText(text).toLowerCase().replace(/[֑-ׇ]/g, "").replace(/[םןץףך]/g, (ch) => FINALS[ch]).replace(/[׳'`´’"״]/g, "").replace(/[^a-zא-ת0-9 ]+/g, " ").replace(/\s+/g, " ").trim() + " ";
  return RISK_RES.some((re) => re.test(p) || re.test(p.trim())) ? "risk" : null;
}
export const PRIVATE_MESSAGE = {
  phone: "Never share a phone number in Jumpi, not even with friends!",
  address: "Never share where you live or your address in Jumpi!",
  email: "Never share an email address in Jumpi!",
  link: "Links to other websites can't be sent in Jumpi.",
  app: "Let's keep chatting here in Jumpi! Other apps can't be shared.",
  unsafe: "That isn't safe to ask or share. If someone asks you this, tell a grown-up and report them.",
};

/* ---------- Russian (Cyrillic or Latin letters) and Arabic swear words ---------- */
const CYR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", і: "i", ї: "i", є: "e", ґ: "g" };
// these start a Russian swear word (written with Russian letters, or in Latin letters: "blyat", "pizdec")
const RU_STEMS = ["blya", "blyad", "blyat", "bljad", "suchk", "pizd", "pezd", "khuy", "khuj", "khue", "nakhuy", "nahuy", "nakhuj",
  "ebat", "eban", "ebal", "ebla", "eblo", "ebuch", "yeba", "yebl", "zaeb", "vyeb", "pidor", "pidar", "pidr", "mudak", "mudil", "zalup", "gandon", "shlyukh", "shluh", "dolboe", "dolboy", "govn"];
const RU_EXACT = new Set(["suka", "cyka", "huy", "huj", "hui", "xuy", "khui", "chmo", "debil", "debily", "debila"]);
const RU_SAFE = ["govnyashk"];
const AR_EXACT = new Set(["كس", "كسمك", "كسامك", "كسختك", "كسك", "شرموط", "شرموطه", "شراميط", "منيوك", "منيوكه", "متناك", "متناكه", "عرص", "عرصه", "قحبه", "قحاب", "زب", "زبي", "زبك", "طيز", "طيزك", "نيك", "نيكك", "انيك", "انيكك", "خول", "لوطي", "عاهره", "يلعن", "ملعون"]);
const AR_STEMS = ["شرموط", "منيوك", "متناك", "كسم", "كسخ", "قحب", "عاهر", "يلعن"];
function foreignBad(text) {
  const t = plainText(text).toLowerCase();
  // Russian: Cyrillic letters → Latin sounds ("блядь" → "blyad"), then the same check for words typed in Latin letters
  const ru = t.replace(/[\u0400-\u04ff]/g, (ch) => (ch in CYR ? CYR[ch] : ""));
  for (const w of ru.split(/[^a-z]+/)) {
    if (w.length < 3 || RU_SAFE.some((s) => w.startsWith(s))) continue;
    const sq = w.replace(/(.)\1+/g, "$1");
    if (RU_EXACT.has(w) || RU_EXACT.has(sq) || RU_STEMS.some((s) => w.startsWith(s) || sq.startsWith(s))) return "ru";
  }
  // Arabic: no vowel marks or stretching, one form of each letter, then the word with and without "و" / "ال" / "يا" in front
  if (/[\u0600-\u06ff]/.test(t)) {
    const ar = t.replace(/[\u064b-\u065f\u0670\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي");
    for (const w0 of ar.split(/[^\u0621-\u064a]+/)) {
      if (!w0) continue;
      for (const w of [w0, w0.replace(/^و/, ""), w0.replace(/^(و?ال|يا|و?ب)/, ""), w0.replace(/(.)\1{2,}/g, "$1")]) {
        if (AR_EXACT.has(w) || (w.length > 3 && AR_STEMS.some((s) => w.startsWith(s)))) return "ar";
      }
    }
  }
  return null;
}

export function checkText(text) {
  const priv = privateInfo(text);
  if (priv) return { ok: false, word: priv, kind: "private", info: priv };
  const foreign = foreignBad(text);
  if (foreign) return { ok: false, word: foreign };
  const p = prep(text);
  if (!p.trim()) return { ok: true };
  const chunks = p.split(/[\s,.;:?/\\()[\]{}<>~_=\-–—]+|(?<=[a-z])(?=[א-ת])|(?<=[א-ת])(?=[a-z])/).filter(Boolean);
  const toks = chunks.map(token).filter(Boolean);
  for (const t of toks) {
    const hit = badWord(t.word) || (t.mask && badMask(t.mask));
    if (hit) return { ok: false, word: hit };
  }
  // letters spread out with spaces or dots: "f u c k", "f.u.c.k", "ז ו נ ה", "fu ck"
  const spaced = p.split(/[^a-zא-ת0-9@$!|*#]+/).map((c) => token(c)?.word || "");
  for (let i = 0; i < spaced.length; i++) {
    if (!spaced[i] || spaced[i].length > 3) continue;
    let joined = "", n = 0;
    for (let j = i; j < spaced.length && spaced[j] && spaced[j].length <= 3 && n < 8; j++) {
      joined += spaced[j];
      n++;
      if (n >= 2 && joined.length >= 3) {
        const hit = badWord(joined, false);
        if (hit) return { ok: false, word: hit };
      }
    }
  }
  // phrases like "kill yourself", "כוס אמא", "לך תמות"
  const flat = toks.map((t) => t.word).join(" ");
  const squashed = flat.replace(/(.)\1{2,}/g, "$1"); // "ארצחחחח" → "ארצח", "kiiiill" → "kill"
  for (const re of [...PHRASES, ...THREATS]) if (re.test(flat) || re.test(squashed)) return { ok: false, word: "phrase" };
  return { ok: true };
}

/** Usernames are glued together ("bigfucker99"), so look for the worst words anywhere inside. */
export function checkName(name) {
  const r = checkText(String(name ?? "").replace(/_/g, " "));
  if (!r.ok) return r;
  const glued = token(prep(name))?.word || "";
  if (ALLOW.has(glued)) return { ok: true };
  for (let i = 0; i < ANY_RE.length; i++) if (ANY_RE[i].test(glued)) return { ok: false, word: ANY_W[i] };
  for (const w of ["sex", "porn", "dick", "cock", "penis", "rape", "nazi", "hitler", "anal", "boob", "tits", "kys", "pedo"]) if (new RegExp(stretchy(w)).test(glued) && !ALLOW.has(glued)) return { ok: false, word: w };
  return { ok: true };
}

// the same word lists for the Discord server's AutoMod (tools/discord/server.config.js)
export const WORD_LISTS = { exact: EXACT_W, stems: STEM_W, anywhere: ANY_W, allow: ALLOW_RAW };
export const FRIENDLY_MESSAGE = "Let's keep Jumpi friendly! That word isn't allowed here.";
