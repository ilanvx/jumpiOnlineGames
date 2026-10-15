/*
  The answer to an application from the /team page (Community Team: manager, guide, beta tester), sent from the admin
  panel (Team applications → Accept / Decline). English or Hebrew, the language the application was sent in.
  The admin sees the real letter with a ready text inside (defaultTeamText) and can change it before sending,
  or mark the application without sending anything. Same build as the other emails (tables + inline styles).
  `text` is plain text (escaped here); TEAM_SLOT lets the admin panel put its text box in the same spot.
*/
import { PUBLIC_URL } from "./send.js";

export const TEAM_SLOT = "JUMPITEAMSLOT";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const para = (s) => esc(s).replace(/\r?\n/g, "<br>");
// only the first name, short; links in it are broken on purpose (the name is typed by whoever sent the form)
const firstName = (n) => (String(n || "").trim().split(/\s+/)[0] || "").replace(/\bhttps?:\/\//gi, "").replace(/\./g, " ").slice(0, 20).trim();
export const TEAM_ROLE_NAME = {
  en: { manager: "Community Manager", guide: "Guide", beta: "Beta Tester" },
  he: { manager: "מנהל/ת קהילה", guide: "משגיח/ה", beta: "בודק/ת בטא" },
};

// the ready text the admin starts from
export function defaultTeamText({ role, decision, age, lang = "en" }) {
  const he = lang === "he", r = (TEAM_ROLE_NAME[he ? "he" : "en"] || {})[role] || role;
  if (decision === "accepted") {
    const kid = age < 18
      ? (he ? "\n\nחשוב: הראו את המייל הזה להורים שלכם, כדי שגם הם יידעו." : "\n\nImportant: please show this email to your parent, so they know too.")
      : "";
    return he
      ? `בשורות טובות: התקבלתם לצוות הקהילה של ג'אמפי בתפקיד ${r}!\n\nתודה שאתם רוצים לעזור להפוך את ג'אמפי למקום בטוח ושמח. בימים הקרובים מישהו מהצוות שלנו יכתוב לכם עם הצעדים הבאים: איך אנחנו עובדים יחד, כללי הצוות ואיך מתחילים.${kid}\n\nברוכים הבאים לצוות!`
      : `Great news: you've been accepted to the Jumpi Community Team as a ${r}!\n\nThank you for wanting to help make Jumpi a safe and happy place. In the next few days someone from our team will write to you with the next steps: how we work together, the team rules and how to get started.${kid}\n\nWelcome to the team!`;
  }
  return he
    ? `תודה רבה שהגשתם מועמדות לתפקיד ${r} בצוות הקהילה של ג'אמפי, ועל הזמן שהשקעתם בבקשה.\n\nהפעם החלטנו לא להתקדם עם הבקשה שלכם. קיבלנו הרבה בקשות מצוינות, ובצוות הראשון יש רק מעט מקומות.\n\nאפשר להגיש בקשה חדשה בעתיד, חודש אחרי הבקשה הזאת. עד אז, נתראה בג'אמפי!`
    : `Thank you so much for applying to be a ${r} on the Jumpi Community Team, and for the time you put into your application.\n\nThis time we've decided not to move forward with your application. We got a lot of great applications, and the first team only has a few places.\n\nYou're welcome to apply again in the future, one month after this application. Until then, see you in Jumpi!`;
}

export function teamDecisionEmail({ name, decision, text, lang = "en" }) {
  const he = lang === "he", site = PUBLIC_URL(), dir = he ? "rtl" : "ltr", al = he ? "right" : "left", yes = decision === "accepted";
  const T = (en, h) => (he ? h : en);
  const H = he ? "'Secular One','Arial Black',Arial,sans-serif;font-weight:900" : "'Lilita One','Arial Black','Arial Rounded MT Bold',Arial,sans-serif;font-weight:900";
  const B = he ? "'Rubik','Fredoka',Arial,sans-serif" : "'Fredoka','Trebuchet MS',Arial,sans-serif";
  const nm = esc(firstName(name)), hello = nm ? `${T("Hi", "היי")} <b>${nm}</b>,` : T("Hi there,", "שלום,");
  const body = text === TEAM_SLOT ? TEAM_SLOT : para(text);
  const title = yes ? T("WELCOME TO THE TEAM!", "ברוכים הבאים לצוות!") : T("THANK YOU FOR APPLYING", "תודה על הבקשה שלכם");
  const accent = yes ? "#2fbf4a" : "#ff8a1c";
  const stripes = Array.from({ length: 20 }, (_, i) => `<td height="10" style="height:10px;font-size:0;line-height:0;background:${(yes ? ["#2fbf4a", "#ffffff", "#ffd23a", "#ffffff"] : ["#ff5a5a", "#ffffff", "#1fb6ff", "#ffffff"])[i % 4]};">&nbsp;</td>`).join("");
  const html = `<!doctype html><html lang="${he ? "he" : "en"}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&family=Lilita+One&family=Rubik:wght@400;600&family=Secular+One&display=swap" rel="stylesheet">
<style>@media (max-width:620px){.wrap{width:100%!important}.pad{padding-left:22px!important;padding-right:22px!important}}</style>
</head><body style="margin:0;padding:0;background:#1fb6ff;" dir="${dir}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${yes ? T("You're on the Jumpi Community Team!", "התקבלתם לצוות הקהילה של ג'אמפי!") : T("An answer about your Jumpi team application.", "תשובה לגבי הבקשה שלכם לצוות ג'אמפי.")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1fb6ff" style="background:#1fb6ff;background-image:radial-gradient(circle at 15% 10%,#7ddcff 0,transparent 40%),linear-gradient(180deg,#1fb6ff,#0b8fe0);">
<tr><td align="center" style="padding:26px 12px 36px;">
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;"><tr><td align="center" style="padding:0 0 18px;">
    <img src="${site}/jumpi-logo.png" width="150" alt="Jumpi Games" style="display:block;width:150px;height:auto;border:0;">
  </td></tr></table>
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" bgcolor="#fffdf7" style="width:600px;background:#fffdf7;border-radius:26px;overflow:hidden;box-shadow:0 10px 0 #0b6fb8;">
    <tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${stripes}</tr></table></td></tr>
    <tr><td class="pad" dir="${dir}" style="padding:30px 46px 0;text-align:${al};">
      <div style="font-family:${H};font-size:32px;line-height:38px;color:${accent};letter-spacing:.4px;">${title}</div>
      <div style="font-family:${B};font-size:18px;line-height:28px;color:#1d2b4f;padding-top:18px;">${hello}</div>
    </td></tr>
    <tr><td class="pad" dir="${dir}" style="padding:12px 46px 0;text-align:${al};">
      <div style="font-family:${B};font-size:17px;line-height:28px;color:#33456e;">${body}</div>
    </td></tr>
    <tr><td class="pad" dir="${dir}" style="padding:22px 46px 0;text-align:${al};">
      <div style="font-family:${B};font-size:17px;line-height:26px;color:#33456e;">${T("Big hugs,", "חיבוקים,")}<br><b style="font-family:${H};font-size:20px;color:#1fb6ff;letter-spacing:.3px;">${T("The Jumpi Team", "צוות ג'אמפי")}</b></div>
    </td></tr>
    <tr><td class="pad" style="padding:26px 46px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff6e8;border:3px dashed #ffc98a;border-radius:20px;"><tr><td align="center" dir="${dir}" style="padding:18px 18px 20px;">
        <div style="font-family:${H};font-size:18px;color:#c25e00;letter-spacing:.3px;">${T("Please don't reply to this email", "אין להשיב לאימייל זה")}</div>
        <div style="font-family:${B};font-size:14px;line-height:21px;color:#8a6a4a;padding:6px 0 14px;">${T("Answers to this email don't reach us. Have a question? Write to us on the Contact page.", "תשובות לאימייל הזה לא מגיעות אלינו. יש לכם שאלה? כתבו לנו בעמוד צור קשר.")}</div>
        <a href="${site}/contact${he ? "?lang=he" : ""}" style="display:inline-block;padding:13px 30px;border-radius:26px;background:#1fb6ff;background-image:linear-gradient(180deg,#5fd0ff,#1fb6ff);border-bottom:5px solid #06488a;font-family:${H};font-size:17px;letter-spacing:.6px;color:#ffffff;text-decoration:none;">${T("CONTACT US", "לצור קשר")}</a>
      </td></tr></table>
    </td></tr>
  </table>
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;"><tr><td align="center" dir="${dir}" style="padding:22px 20px 0;font-family:${B};font-size:12px;line-height:19px;color:#dff4ff;">
    ${T("You're getting this because you applied to the Community Team on", "קיבלתם את המייל כי הגשתם בקשה לצוות הקהילה בעמוד")} <a href="${site}/team" style="color:#ffffff;">jumpigames.com/team</a><br>© Jumpi Games
  </td></tr></table>
</td></tr></table>
</body></html>`;
  const fn = firstName(name);
  const plain = `${fn ? T("Hi", "היי") + " " + fn + "," : T("Hi there,", "שלום,")}\n\n${text}\n\n${T("Big hugs,\nThe Jumpi Team", "חיבוקים,\nצוות ג'אמפי")}\n\n---\n${T("Please don't reply to this email. Have a question? Write to us on the Contact page:", "אין להשיב לאימייל זה. יש לכם שאלה? כתבו לנו בעמוד צור קשר:")} ${site}/contact`;
  const subject = yes ? T("You're on the Jumpi Community Team!", "התקבלתם לצוות הקהילה של ג'אמפי!") : T("About your Jumpi team application", "לגבי הבקשה שלכם לצוות ג'אמפי");
  return { subject, html, text: plain };
}
