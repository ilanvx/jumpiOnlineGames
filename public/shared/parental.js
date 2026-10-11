/*
  Parental controls (the /parents page, routes/parents.js). Used by the server and by the game.

  - Quiet hours: times when the game doesn't work for this child (they can't log in, and a game that is open closes).
    A rule = { days: [0-6] (0 = Sunday), from: "HH:MM", to: "HH:MM" } in Israel time; "from" later than "to" runs past
    midnight (21:00 → 07:00), "from" = "to" closes 24 hours (00:00 → 00:00 = the whole day). Up to MAX_RULES rules.
  - Chat lock: no typing in the chat and no JumpiChat (private messages). The child can still say hello with the
    ready-made messages below (QUICK_CHAT), so they still feel part of the game.
*/
export const MAX_RULES = 6;
export const TZ = "Asia/Jerusalem";

// ready-made messages for a child whose chat is locked: [English, Hebrew]
export const QUICK_CHAT = [
  ["Hi!", "היי!"], ["Hello friend!", "שלום חבר!"], ["How are you?", "מה שלומך?"], ["I'm good, thanks!", "אני בסדר, תודה!"],
  ["Want to be friends?", "רוצה להיות חברים?"], ["Let's play!", "בוא נשחק!"], ["Follow me!", "בוא אחריי!"], ["Wait for me!", "חכה לי!"],
  ["Nice outfit!", "בגדים יפים!"], ["Cool pet!", "חיית מחמד מגניבה!"], ["Want to trade?", "רוצה להחליף?"], ["Want to play Tic-Tac-Toe?", "רוצה לשחק איקס עיגול?"],
  ["Good game!", "משחק טוב!"], ["Well done!", "כל הכבוד!"], ["Thank you!", "תודה!"], ["Sorry!", "סליחה!"],
  ["Yes", "כן"], ["No", "לא"], ["LOL", "חחח"], ["Wow!", "וואו!"],
  ["Let's go to the beach!", "בוא נלך לחוף!"], ["Let's go to the park!", "בוא נלך לפארק!"], ["I love Jumpi!", "אני אוהב את ג'אמפי!"], ["Happy birthday!", "יום הולדת שמח!"],
  ["I have to go, bye!", "אני צריך ללכת, ביי!"], ["See you tomorrow!", "נתראה מחר!"],
];
const QUICK_SET = new Set(QUICK_CHAT.flat());
export const isQuickChat = (text) => QUICK_SET.has(String(text ?? "").trim());

const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const mins = (hm) => { const m = HM.exec(hm); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

// a clean copy of the settings (whatever the page sent), or null when something is wrong
export function cleanParental(p) {
  const out = { chatLock: p?.chatLock === true, quiet: [] };
  const rules = Array.isArray(p?.quiet) ? p.quiet : [];
  if (rules.length > MAX_RULES) return null;
  for (const r of rules) {
    const days = Array.isArray(r?.days) ? [...new Set(r.days.map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort() : [];
    const from = String(r?.from || ""), to = String(r?.to || "");
    if (!days.length || mins(from) === null || mins(to) === null) return null;   // from == to: closed the whole day (24 hours from "from")
    out.quiet.push({ days, from, to });
  }
  return out;
}

// day of the week (0 = Sunday) and minutes since midnight in Israel time
function israelNow(d = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { day, min: Number(parts.hour) * 60 + Number(parts.minute) };
}

// the quiet-hours rule in force right now (or null). A rule past midnight belongs to the day it starts on.
export function quietNow(parental, d = new Date()) {
  const rules = parental && Array.isArray(parental.quiet) ? parental.quiet : [];
  if (!rules.length) return null;
  const { day, min } = israelNow(d), yesterday = (day + 6) % 7;
  for (const r of rules) {
    const a = mins(r.from), b = mins(r.to);
    if (a === null || b === null) continue;
    if (a < b) { if (r.days.includes(day) && min >= a && min < b) return r; }   // the same day; a >= b runs past midnight (a == b: 24 hours)
    else if ((r.days.includes(day) && min >= a) || (r.days.includes(yesterday) && min < b)) return r;
  }
  return null;
}
