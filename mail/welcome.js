/*
  The sign-up email with the 6-digit code (sent after sign-up, and again when someone asks for a new code).
  - The banner on top is the Jumpi banner (public/site/email/mail-hero.jpg, the same one as the site's og-image).
  - English or Hebrew (the language the game was in).
  - kid: true (under 18): the email is written to the parents. It says what Jumpi is, gives the code to type,
    and says a few words about parental controls with links to /for-parents (the full explanation) and /parents.
  Built with tables and inline styles so it looks right in Gmail, Outlook and phone apps.
*/
import { PUBLIC_URL } from "./send.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const T = {
  en: {
    title: "Welcome to the Jumpi family!", banner: "Jumpi Games: four smiling Jumpis waving hello in the Plaza",
    headNew: "WELCOME TO THE FAMILY!", headAgain: "HERE'S YOUR NEW CODE!",
    hi: (n) => `Hi <b style="color:#1d2b4f;">${n}</b>!`,
    introNew: "We're so happy you're here. Your Jumpi is all dressed up and waiting for you in the Plaza!",
    introAgain: "You asked for a new code, here it is.",
    codeTitle: "YOUR SECRET CODE", codeText: (m) => `Type it in the game to open your account. It works for ${m} minutes.`,
    waiting: "What's waiting for you",
    perks: [["Your home", "Decorate it, add a garden, a pool and a second floor."], ["Cute pets", "Adopt a puppy, a kitten or even a baby dragon."], ["Fun jobs", "Deliver pizza, serve food and earn coins."]],
    play: "LET'S PLAY!", safe: "Remember: never share your password, and only make friends you feel good about. Be kind, have fun!",
    // to the parents
    pHead: "YOUR CHILD JOINED JUMPI!", pHeadAgain: "A NEW CODE FOR YOUR CHILD",
    pHi: "Hello!",
    pIntro: (n) => `Your child just signed up to <b style="color:#1d2b4f;">Jumpi Games</b> with the name <b style="color:#1d2b4f;">${n}</b>. Jumpi is a free 3D world for kids: they make friends, care for pets, work at fun jobs and save the coins they earn.`,
    pCodeTitle: "THE CODE TO OPEN THE ACCOUNT", pCodeText: (m) => `Your child types it in the game. The account is made only after this. It works for ${m} minutes.`,
    pNot: "Didn't your child sign up? Then do nothing: without this code no account is made.",
    pcTitle: "Parental controls, free",
    pcText: "With the email of the account you can log in to the parents' page, any time, no password needed:",
    pcItems: ["See what your child writes in the chat and in private messages", "See every trade: what they gave and what they got", "See when and how long they played", "Choose hours when Jumpi is closed", "Turn the chat off (ready-made messages stay)"],
    pcMore: "How it works, in detail", pcOpen: "Open parental controls",
    pay: "Jumpi is free to play. Extras can be bought by a parent; card details are never saved on Jumpi.",
    foot: "Didn't make a Jumpi account? You can safely ignore this email.", q: "Questions?",
    subjNew: (c) => `Welcome to the Jumpi family! Your code: ${c}`, subjAgain: (c) => `Your new Jumpi code: ${c}`,
    pSubj: (c, n) => `${n} joined Jumpi Games. The code: ${c}`,
    preview: (c, n) => `Your Jumpi code is ${c}. Welcome to the family, ${n}!`, pPreview: (c) => `The code to open your child's Jumpi account: ${c}`,
  },
  he: {
    title: "ברוכים הבאים למשפחת ג'אמפי!", banner: "ג'אמפי גיימס: ארבעה ג'אמפים מחייכים מנופפים לשלום בפלאזה",
    headNew: "ברוכים הבאים למשפחה!", headAgain: "הנה הקוד החדש שלך!",
    hi: (n) => `היי <b style="color:#1d2b4f;">${n}</b>!`,
    introNew: "אנחנו שמחים שהגעת. הג'אמפי שלך כבר לבוש ומחכה לך בפלאזה!",
    introAgain: "ביקשת קוד חדש, הנה הוא.",
    codeTitle: "הקוד הסודי שלך", codeText: (m) => `הקלידו אותו במשחק כדי לפתוח את החשבון. הוא עובד ${m} דקות.`,
    waiting: "מה מחכה לך",
    perks: [["הבית שלך", "לקשט, להוסיף גינה, בריכה וקומה שנייה."], ["חיות מחמד", "לאמץ כלבלב, חתלתול ואפילו דרקון קטן."], ["עבודות כיפיות", "לחלק פיצות, להגיש אוכל ולהרוויח מטבעות."]],
    play: "יאללה לשחק!", safe: "זכרו: לעולם לא משתפים סיסמה, ומתחברים רק לחברים שמרגישים איתם טוב. היו נחמדים ותיהנו!",
    pHead: "הילד שלכם הצטרף לג'אמפי!", pHeadAgain: "קוד חדש לילד שלכם",
    pHi: "שלום!",
    pIntro: (n) => `הילד שלכם נרשם עכשיו ל-<b style="color:#1d2b4f;">Jumpi Games</b> עם השם <b style="color:#1d2b4f;" dir="ltr">${n}</b>. ג'אמפי הוא עולם תלת-ממדי חינמי לילדים: מכירים חברים, מטפלים בחיות מחמד, עובדים בעבודות כיפיות וחוסכים את המטבעות שמרוויחים.`,
    pCodeTitle: "הקוד לפתיחת החשבון", pCodeText: (m) => `הילד מקליד אותו במשחק. החשבון נוצר רק אחרי זה. הקוד עובד ${m} דקות.`,
    pNot: "הילד שלכם לא נרשם? אל תעשו כלום: בלי הקוד הזה לא נוצר חשבון.",
    pcTitle: "בקרת הורים, בחינם",
    pcText: "עם האימייל של החשבון אפשר להיכנס לעמוד ההורים בכל זמן, בלי סיסמה:",
    pcItems: ["לראות מה הילד כותב בצ'אט ובהודעות פרטיות", "לראות כל החלפה: מה נתן ומה קיבל", "לראות מתי וכמה זמן שיחק", "לבחור שעות שבהן ג'אמפי סגור", "לכבות את הצ'אט (ההודעות המוכנות נשארות)"],
    pcMore: "איך זה עובד, בפירוט", pcOpen: "לבקרת ההורים",
    pay: "המשחק בחינם. תוספות אפשר לקנות דרך ההורים, ופרטי הכרטיס לא נשמרים אצלנו.",
    foot: "לא פתחתם חשבון בג'אמפי? אפשר פשוט להתעלם מהמייל הזה.", q: "שאלות?",
    subjNew: (c) => `ברוכים הבאים לג'אמפי! הקוד שלך: ${c}`, subjAgain: (c) => `הקוד החדש שלך לג'אמפי: ${c}`,
    pSubj: (c, n) => `${n} הצטרף לג'אמפי גיימס. הקוד: ${c}`,
    preview: (c, n) => `הקוד שלך לג'אמפי: ${c}. ברוכים הבאים, ${n}!`, pPreview: (c) => `הקוד לפתיחת החשבון של הילד בג'אמפי: ${c}`,
  },
};

export function welcomeEmail({ username, code, minutes = 15, again = false, kid = false, lang = "en" }) {
  const t = T[lang === "he" ? "he" : "en"], he = lang === "he", dir = he ? "rtl" : "ltr", al = he ? "right" : "left";
  const site = PUBLIC_URL(), name = esc(username), digits = String(code).split("");
  const H = he ? "'Secular One','Lilita One','Arial Black',Arial,sans-serif;font-weight:900" : "'Lilita One','Arial Black','Arial Rounded MT Bold',Arial,sans-serif;font-weight:900";
  const B = he ? "'Rubik','Fredoka',Arial,sans-serif" : "'Fredoka','Trebuchet MS',Arial,sans-serif";
  const dcells = digits.map((d) => `<td align="center" valign="middle" width="54" height="66" style="width:54px;height:66px;background:#ff8a1c;background-image:linear-gradient(180deg,#ffb04a,#ff8a1c);border-radius:14px;border-bottom:5px solid #c25e00;font-family:'Lilita One','Arial Black',Arial,sans-serif;font-weight:900;font-size:38px;line-height:66px;color:#ffffff;text-align:center;">${d}</td><td width="8" style="width:8px;font-size:0;">&nbsp;</td>`).join("");
  const codeBox = (title, text) => `<tr><td class="pad" align="center" style="padding:24px 44px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff6e8;border-radius:24px;border:3px dashed #ffc98a;"><tr><td align="center" style="padding:22px 12px 20px;">
        <div style="font-family:${H};font-size:18px;color:#c25e00;letter-spacing:1px;padding-bottom:14px;">${title}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" dir="ltr"><tr>${dcells}</tr></table>
        <div style="font-family:${B};font-size:14px;line-height:20px;color:#8a6a4a;padding-top:14px;">${text}</div>
      </td></tr></table>
    </td></tr>`;
  const perk = (col, [title, text]) => `<td valign="top" width="33%" style="padding:0 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8ff;border-radius:18px;border-top:6px solid ${col};"><tr><td align="center" valign="top" height="110" style="padding:16px 10px 14px;height:110px;">
        <div style="font-family:${H};font-size:17px;color:#1d2b4f;letter-spacing:.3px;">${title}</div>
        <div style="font-family:${B};font-size:13px;line-height:18px;color:#5a6a8a;padding-top:4px;">${text}</div>
      </td></tr></table></td>`;
  const btn = (href, label, bg, edge, size = 20) => `<a href="${href}" style="display:inline-block;padding:14px 34px;border-radius:30px;background:${bg};border-bottom:6px solid ${edge};font-family:${H};font-size:${size}px;letter-spacing:.5px;color:#ffffff;text-decoration:none;">${label}</a>`;
  const check = `<td width="30" valign="top" style="width:30px;padding-top:2px;"><div style="width:22px;height:22px;line-height:22px;border-radius:50%;background:#2fd36b;color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;text-align:center;">&#10003;</div></td>`;

  const body = kid
    ? `
    <tr><td class="pad" align="center" style="padding:30px 44px 6px;">
      <div style="font-family:${H};font-size:32px;line-height:38px;color:#ff8a1c;letter-spacing:.5px;">${again ? t.pHeadAgain : t.pHead}</div>
      <div style="font-family:${B};font-size:17px;line-height:26px;color:#3a4a6a;padding-top:14px;text-align:${al};">${t.pHi} ${t.pIntro(name)}</div>
    </td></tr>
    ${codeBox(t.pCodeTitle, t.pCodeText(minutes))}
    <tr><td class="pad" align="center" style="padding:6px 44px 0;"><div style="font-family:${B};font-size:13px;line-height:19px;color:#8a97ab;">${t.pNot}</div></td></tr>
    <!-- parental controls, in short -->
    <tr><td class="pad" style="padding:24px 38px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef6ff;border-radius:24px;border:2px solid #cfe3fb;"><tr><td style="padding:22px 24px 24px;" dir="${dir}">
        <div style="font-family:${H};font-size:22px;color:#1d2b4f;text-align:${al};">${t.pcTitle}</div>
        <div style="font-family:${B};font-size:15px;line-height:22px;color:#4a5a80;padding:6px 0 12px;text-align:${al};">${t.pcText}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}">
          ${t.pcItems.map((x) => `<tr>${check}<td style="font-family:${B};font-size:15px;line-height:22px;color:#1d2b4f;padding:0 0 8px;text-align:${al};">${x}</td></tr>`).join("")}
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-top:12px;">
          ${btn(`${site}/for-parents${he ? "?lang=he" : ""}`, t.pcMore, "#1f9bff", "#06488a", 17)}
          <div style="padding-top:12px;"><a href="${site}/parents${he ? "?lang=he" : ""}" style="font-family:${B};font-size:15px;font-weight:600;color:#1f7fd1;">${t.pcOpen}</a></div>
        </td></tr></table>
      </td></tr></table>
    </td></tr>
    <tr><td class="pad" align="center" style="padding:18px 44px 30px;">
      <div style="height:2px;background:#eef2f8;margin-bottom:16px;"></div>
      <div style="font-family:${B};font-size:13px;line-height:20px;color:#8a97ab;">${t.pay}</div>
    </td></tr>`
    : `
    <tr><td class="pad" align="center" style="padding:30px 44px 6px;">
      <div style="font-family:${H};font-size:34px;line-height:40px;color:#ff8a1c;letter-spacing:.5px;">${again ? t.headAgain : t.headNew}</div>
      <div style="font-family:${B};font-size:18px;line-height:27px;color:#3a4a6a;padding-top:14px;">${t.hi(name)} ${again ? t.introAgain : t.introNew}</div>
    </td></tr>
    ${codeBox(t.codeTitle, t.codeText(minutes))}
    <tr><td class="pad" align="center" style="padding:26px 38px 6px;">
      <div style="font-family:${H};font-size:22px;color:#1d2b4f;padding-bottom:14px;">${t.waiting}</div>
      <table role="presentation" class="perks" width="100%" cellpadding="0" cellspacing="0" dir="${dir}"><tr>
        ${perk("#ff9a1f", t.perks[0])}${perk("#ff5fa2", t.perks[1])}${perk("#1fb6ff", t.perks[2])}
      </tr></table>
    </td></tr>
    <tr><td align="center" style="padding:28px 40px 34px;">${btn(`${site}/play`, t.play, "#2fd36b", "#17913f", 22)}</td></tr>
    <tr><td class="pad" align="center" style="padding:0 44px 30px;">
      <div style="height:2px;background:#eef2f8;margin-bottom:18px;"></div>
      <div style="font-family:${B};font-size:13px;line-height:20px;color:#8a97ab;">${t.safe}</div>
    </td></tr>`;

  const html = `<!doctype html><html lang="${he ? "he" : "en"}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only">
<title>${t.title}</title>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&family=Lilita+One&family=Rubik:wght@400;600&family=Secular+One&display=swap" rel="stylesheet">
<style>@media (max-width:620px){.wrap{width:100%!important}.pad{padding-left:18px!important;padding-right:18px!important}.perks td{display:block!important;width:100%!important;padding:6px 0!important}}</style>
</head><body style="margin:0;padding:0;background:#1fb6ff;" dir="${dir}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(kid ? t.pPreview(code) : t.preview(code, username))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1fb6ff" style="background:#1fb6ff;background-image:radial-gradient(circle at 15% 10%,#7ddcff 0,transparent 40%),radial-gradient(circle at 85% 30%,#5fc8ff 0,transparent 35%),linear-gradient(180deg,#1fb6ff,#0b8fe0);">
<tr><td align="center" style="padding:24px 12px 36px;">
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:600px;background:#ffffff;border-radius:30px;overflow:hidden;box-shadow:0 10px 0 #0b6fb8;" dir="${dir}">
    <tr><td style="padding:0;"><a href="${site}"><img src="${site}/site/email/mail-hero.jpg" width="600" height="250" alt="${t.banner}" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:30px 30px 0 0;"></a></td></tr>
    ${body}
  </table>
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;"><tr><td align="center" style="padding:22px 20px 0;font-family:${B};font-size:12px;line-height:19px;color:#dff4ff;">
    ${t.foot}<br>${t.q} <a href="mailto:support@jumpigames.com" style="color:#ffffff;">support@jumpigames.com</a> · <a href="${site}/help" style="color:#ffffff;">jumpigames.com/help</a><br>© Jumpi Games
  </td></tr></table>
</td></tr></table>
</body></html>`;

  const plain = kid
    ? (he
      ? `שלום!\n\nהילד שלכם נרשם לג'אמפי גיימס עם השם ${username}.\n\nהקוד לפתיחת החשבון: ${code}\n(הילד מקליד אותו במשחק. הקוד עובד ${minutes} דקות. החשבון נוצר רק אחרי זה.)\n\nבקרת הורים, בחינם: ${site}/parents\nאיך זה עובד: ${site}/for-parents?lang=he\n\nהילד לא נרשם? אל תעשו כלום, בלי הקוד לא נוצר חשבון.\nשאלות? support@jumpigames.com`
      : `Hello!\n\nYour child just signed up to Jumpi Games with the name ${username}.\n\nThe code to open the account: ${code}\n(Your child types it in the game. It works for ${minutes} minutes. The account is made only after this.)\n\nParental controls, free: ${site}/parents\nHow it works: ${site}/for-parents\n\nDidn't your child sign up? Do nothing: without this code no account is made.\nQuestions? support@jumpigames.com`)
    : (he
      ? `${again ? "הנה הקוד החדש שלך לג'אמפי" : "ברוכים הבאים למשפחת ג'אמפי"}, ${username}!\n\nהקוד שלך: ${code}\n(הוא עובד ${minutes} דקות. הקלידו אותו במשחק כדי לפתוח את החשבון.)\n\nלשחק: ${site}/play\n\nלא פתחתם חשבון? אפשר להתעלם מהמייל.\nשאלות? support@jumpigames.com`
      : `${again ? "Here's your new Jumpi code" : "Welcome to the Jumpi family"}, ${username}!\n\nYour code: ${code}\n(It works for ${minutes} minutes. Type it in the game to open your account.)\n\nPlay: ${site}/play\n\nDidn't make a Jumpi account? You can ignore this email.\nQuestions? support@jumpigames.com`);
  const subject = kid ? t.pSubj(code, username) : again ? t.subjAgain(code) : t.subjNew(code);
  return { subject, html, text: plain };
}
