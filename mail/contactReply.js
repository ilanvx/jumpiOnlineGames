/*
  The answer to a Contact page message, written by an admin in the admin panel (Contact messages → Reply).
  English or Hebrew, the same language the message was sent in. Replies to this email aren't read:
  it says so and points to the Contact page. Same build as the other emails (tables + inline styles).
  `answer` is plain text (escaped here); ANSWER_SLOT lets the admin panel put its text box in the same spot.
*/
import { PUBLIC_URL } from "./send.js";

export const ANSWER_SLOT = "JUMPIANSWERSLOT";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const para = (s) => esc(s).replace(/\r?\n/g, "<br>");
const TOPIC = {
  en: { general: "Question", safety: "Report a player", privacy: "Privacy / parents", account: "My account", bug: "Something's broken", idea: "An idea!" },
  he: { general: "שאלה", safety: "דיווח על שחקן", privacy: "פרטיות / הורים", account: "החשבון שלי", bug: "משהו לא עובד", idea: "יש לי רעיון!" },
};

export function contactReplyEmail({ name, message, topic, sentAt, answer, lang = "en" }) {
  const he = lang === "he", site = PUBLIC_URL(), dir = he ? "rtl" : "ltr", al = he ? "right" : "left";
  const T = (en, h) => (he ? h : en);
  const H = he ? "'Secular One','Arial Black',Arial,sans-serif;font-weight:900" : "'Lilita One','Arial Black','Arial Rounded MT Bold',Arial,sans-serif;font-weight:900";
  const B = he ? "'Rubik','Fredoka',Arial,sans-serif" : "'Fredoka','Trebuchet MS',Arial,sans-serif";
  const nm = esc(String(name || "").trim()), hello = nm ? `${T("Hi", "היי")} <b>${nm}</b>,` : T("Hi there,", "שלום,");
  const when = new Date(sentAt || Date.now()).toLocaleDateString(he ? "he-IL" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jerusalem" });
  const body = answer === ANSWER_SLOT ? ANSWER_SLOT : para(answer);
  // an airmail edge along the top of the letter
  const stripes = Array.from({ length: 20 }, (_, i) => `<td height="10" style="height:10px;font-size:0;line-height:0;background:${["#ff5a5a", "#ffffff", "#1fb6ff", "#ffffff"][i % 4]};">&nbsp;</td>`).join("");
  const html = `<!doctype html><html lang="${he ? "he" : "en"}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only">
<title>${T("An answer from Jumpi", "תשובה מג'אמפי")}</title>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&family=Lilita+One&family=Rubik:wght@400;600&family=Secular+One&display=swap" rel="stylesheet">
<style>@media (max-width:620px){.wrap{width:100%!important}.pad{padding-left:22px!important;padding-right:22px!important}}</style>
</head><body style="margin:0;padding:0;background:#1fb6ff;" dir="${dir}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${T("We read your message and wrote back!", "קראנו את ההודעה שלך וכתבנו תשובה!")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1fb6ff" style="background:#1fb6ff;background-image:radial-gradient(circle at 15% 10%,#7ddcff 0,transparent 40%),linear-gradient(180deg,#1fb6ff,#0b8fe0);">
<tr><td align="center" style="padding:26px 12px 36px;">
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;"><tr><td align="center" style="padding:0 0 18px;">
    <img src="${site}/jumpi-logo.png" width="150" alt="Jumpi Games" style="display:block;width:150px;height:auto;border:0;">
  </td></tr></table>
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" bgcolor="#fffdf7" style="width:600px;background:#fffdf7;border-radius:26px;overflow:hidden;box-shadow:0 10px 0 #0b6fb8;">
    <tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${stripes}</tr></table></td></tr>
    <tr><td class="pad" dir="${dir}" style="padding:30px 46px 0;text-align:${al};">
      <div style="font-family:${H};font-size:32px;line-height:38px;color:#ff8a1c;letter-spacing:.4px;">${T("WE'VE GOT AN ANSWER FOR YOU!", "יש לנו תשובה בשבילך!")}</div>
      <div style="font-family:${B};font-size:18px;line-height:28px;color:#1d2b4f;padding-top:18px;">${hello}</div>
    </td></tr>
    <tr><td class="pad" dir="${dir}" style="padding:12px 46px 0;text-align:${al};">
      <div style="font-family:${B};font-size:17px;line-height:28px;color:#33456e;">${body}</div>
    </td></tr>
    <tr><td class="pad" dir="${dir}" style="padding:22px 46px 0;text-align:${al};">
      <div style="font-family:${B};font-size:17px;line-height:26px;color:#33456e;">${T("Big hugs,", "חיבוקים,")}<br><b style="font-family:${H};font-size:20px;color:#1fb6ff;letter-spacing:.3px;">${T("The Jumpi Team", "צוות ג'אמפי")}</b></div>
    </td></tr>
    <!-- what they wrote -->
    <tr><td class="pad" style="padding:26px 46px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f6fd;border-radius:16px;"><tr><td dir="${dir}" style="padding:14px 18px;text-align:${al};border-${he ? "right" : "left"}:5px solid #b9cbe6;border-radius:16px;">
        <div style="font-family:${B};font-size:13px;line-height:18px;color:#7a89a8;font-weight:600;">${T("You wrote to us on " + esc(when), "כתבת לנו ב-" + esc(when))} · ${esc((TOPIC[he ? "he" : "en"] || {})[topic] || topic || "")}</div>
        <div style="font-family:${B};font-size:14px;line-height:21px;color:#5a6a8a;padding-top:6px;">${para(String(message || "").slice(0, 1500))}${String(message || "").length > 1500 ? "…" : ""}</div>
      </td></tr></table>
    </td></tr>
    <!-- don't reply -->
    <tr><td class="pad" style="padding:22px 46px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff6e8;border:3px dashed #ffc98a;border-radius:20px;"><tr><td align="center" dir="${dir}" style="padding:18px 18px 20px;">
        <div style="font-family:${H};font-size:18px;color:#c25e00;letter-spacing:.3px;">${T("Please don't reply to this email", "אין להשיב לאימייל זה")}</div>
        <div style="font-family:${B};font-size:14px;line-height:21px;color:#8a6a4a;padding:6px 0 14px;">${T("Answers to this email don't reach us. To write to us again, open a new message on the Contact page.", "תשובות לאימייל הזה לא מגיעות אלינו. כדי להשיב, יש לפתוח פנייה חדשה בעמוד צור קשר.")}</div>
        <a href="${site}/contact${he ? "?lang=he" : ""}" style="display:inline-block;padding:13px 30px;border-radius:26px;background:#1fb6ff;background-image:linear-gradient(180deg,#5fd0ff,#1fb6ff);border-bottom:5px solid #06488a;font-family:${H};font-size:17px;letter-spacing:.6px;color:#ffffff;text-decoration:none;">${T("OPEN A NEW MESSAGE", "לפנייה חדשה")}</a>
      </td></tr></table>
    </td></tr>
  </table>
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;"><tr><td align="center" dir="${dir}" style="padding:22px 20px 0;font-family:${B};font-size:12px;line-height:19px;color:#dff4ff;">
    ${T("You're getting this because you sent a message on", "קיבלת את המייל כי שלחת הודעה דרך")} <a href="${site}/contact" style="color:#ffffff;">jumpigames.com/contact</a><br>© Jumpi Games
  </td></tr></table>
</td></tr></table>
</body></html>`;
  const text = `${String(name || "").trim() ? T("Hi", "היי") + " " + String(name).trim() + "," : T("Hi there,", "שלום,")}\n\n${answer}\n\n${T("Big hugs,\nThe Jumpi Team", "חיבוקים,\nצוות ג'אמפי")}\n\n---\n${T("Please don't reply to this email. To write to us again, open a new message on the Contact page:", "אין להשיב לאימייל זה. כדי להשיב יש לפתוח פנייה חדשה בעמוד צור קשר:")} ${site}/contact`;
  return { subject: T("Re: your message to Jumpi", "תשובה להודעה שלך לג'אמפי"), html, text };
}
