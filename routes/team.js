import express from "express";
import { TeamApplication, TEAM_ROLES, TEAM_MIN_AGE, TEAM_MOD_ROLES } from "../models/TeamApplication.js";
import { currentUser, requireJson } from "./auth.js";
import { teamAlert } from "../discord/pip.js";

/*
  The /team page form (public/site/team.html + team.js): apply to the first Community Team.
  Youngest age per role (TEAM_MIN_AGE): Community Manager 16, Guide 15, Beta Tester 13 — checked here, not only on
  the page. Everyone under 18, in every role, must tick that a parent approves.
*/
const router = express.Router();
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const LANGS = new Set(["he", "en", "ar", "ru", "fr", "es", "other"]);
const HOURS = new Set(["1-3", "3-6", "6-10", "10+"]);
const DEVICES = new Set(["android", "iphone", "pc", "mac", "tablet"]);
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
const pick = (v, set, max = 8) => [...new Set((Array.isArray(v) ? v : []).map(String).filter((x) => set.has(x)))].slice(0, max);

// at most 4 applications an hour from one connection
const recent = new Map();
function allowed(key) {
  const now = Date.now(), list = (recent.get(key) || []).filter((t) => now - t < 3600_000);
  if (list.length >= 4) return false;
  list.push(now);
  recent.set(key, list);
  if (recent.size > 5000) recent.clear();
  return true;
}

router.post("/team/apply", requireJson, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (b.website) return res.json({ ok: true });   // hidden field only robots fill in
    const he = b.lang === "he";
    const bad = (field, en, hebrew) => res.status(400).json({ field, error: he ? hebrew : en });

    const role = TEAM_ROLES.includes(b.role) ? b.role : null;
    if (!role) return bad("role", "Pick the role you want first.", "קודם בחרו תפקיד.");
    const name = clean(b.name, 60);
    if (name.length < 2) return bad("name", "Please write your name.", "נא לכתוב את השם שלכם.");
    const email = clean(b.email, 200).toLowerCase();
    if (!EMAIL.test(email)) return bad("email", "Please enter a valid email address.", "נא להקליד כתובת מייל תקינה.");
    const age = Math.floor(Number(b.age));
    if (!Number.isFinite(age) || age < 13 || age > 99) return bad("age", "Please enter your age (13 or older).", "נא להקליד את הגיל שלכם (13 ומעלה).");
    const ROLE_EN = { manager: "Community Manager", guide: "Guide", beta: "Beta Tester" }, ROLE_HE = { manager: "מנהל/ת קהילה", guide: "משגיח/ה", beta: "בודק/ת בטא" };
    if (age < TEAM_MIN_AGE[role]) return bad("age", `${ROLE_EN[role]} is from age ${TEAM_MIN_AGE[role]}.`, `התפקיד ${ROLE_HE[role]} הוא מגיל ${TEAM_MIN_AGE[role]}.`);
    const parentOk = b.parentOk === true;
    if (age < 18 && !parentOk) return bad("parentOk", "Under 18? Please tick that your parent approves.", "מתחת לגיל 18? נא לסמן שהורה מאשר.");

    const adult = TEAM_MOD_ROLES.includes(role);   // moderation roles answer more questions
    const why = clean(b.why, 2000), about = clean(b.about, 2000), scenario = clean(b.scenario, 1500);
    if (why.length < 30) return bad("why", "Tell us a little more about why you want to join (at least 30 characters).", "ספרו לנו קצת יותר למה אתם רוצים להצטרף (לפחות 30 תווים).");
    if (adult && about.length < 30) return bad("about", "Tell us a little about your experience (at least 30 characters).", "ספרו לנו קצת על הניסיון שלכם (לפחות 30 תווים).");
    if (adult && scenario.length < 20) return bad("scenario", "Please answer the situation question.", "נא לענות על שאלת המקרה.");
    const devices = pick(b.devices, DEVICES);
    if (role === "beta" && !devices.length) return bad("devices", "Which devices can you test on? Pick at least one.", "על אילו מכשירים תוכלו לבדוק? בחרו לפחות אחד.");
    const hours = HOURS.has(b.hours) ? b.hours : "";
    if (!hours) return bad("hours", "How much time could you give each week?", "כמה זמן תוכלו להקדיש בשבוע?");
    let link = clean(b.link, 200);
    if (link && !/^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i.test(link)) return bad("link", "That link doesn't look right (start it with https://).", "הקישור לא נראה תקין (התחילו ב־https://).");
    if (b.consent !== true) return bad("consent", "Please agree that we can keep your application to contact you.", "נא לאשר שנשמור את הבקשה כדי לחזור אליכם.");

    if (!allowed(req.ip || "?")) return res.status(429).json({ error: he ? "שלחתם הרבה בקשות. נסו שוב בעוד שעה." : "You've sent a lot of applications. Please try again in an hour." });
    const open = await TeamApplication.exists({ email, role, status: { $in: ["new", "reviewing"] } });
    if (open) return res.status(409).json({ error: he ? "כבר קיבלנו ממכם בקשה לתפקיד הזה, והיא אצלנו בבדיקה. נחזור אליכם במייל." : "We already have your application for this role and we're looking at it. We'll get back to you by email." });

    const user = await currentUser(req).catch(() => null);
    const saved = await TeamApplication.create({
      role, name, email, age, parentOk: age < 18 && parentOk, country: clean(b.country, 60), username: clean(b.username, 24), account: user ? user.username : "",
      discord: clean(b.discord, 40), languages: pick(b.languages, LANGS), hours, devices, about, why, scenario: adult ? scenario : "", link, lang: he ? "he" : "en",
    });
    teamAlert(saved);   // heads-up in Discord #staff-chat (no email, no age details beyond 18+/under 18)
    console.log(`[team] new ${role} application${user ? " from " + user.username : ""}`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
