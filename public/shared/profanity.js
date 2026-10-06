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
export function checkText(text) {
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

export const FRIENDLY_MESSAGE = "Let's keep Jumpi friendly! That word isn't allowed here.";
