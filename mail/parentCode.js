/*
  The code for the parents' page (/parents, routes/parents.js): a short, plain email in English and Hebrew.
  Tables and inline styles, like the other emails.
*/
import { PUBLIC_URL } from "./send.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function parentCodeEmail({ username, code, minutes = 15 }) {
  const site = PUBLIC_URL(), name = esc(username);
  const H = "'Lilita One','Arial Black',Arial,sans-serif;font-weight:900", B = "'Fredoka','Trebuchet MS',Arial,sans-serif";
  const cells = String(code).split("").map((d) => `<td align="center" width="46" height="58" style="width:46px;height:58px;background:#1f9bff;border-radius:12px;border-bottom:5px solid #06488a;font-family:${H};font-size:32px;color:#ffffff;">${esc(d)}</td><td width="6" style="width:6px;font-size:0;">&nbsp;</td>`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only">
<title>Your Jumpi parents' code</title></head><body style="margin:0;padding:0;background:#eef6ff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your Jumpi parents' page code is ${esc(code)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef6ff" style="background:#eef6ff;"><tr><td align="center" style="padding:28px 12px 36px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:560px;max-width:100%;background:#ffffff;border-radius:24px;box-shadow:0 8px 0 #c9dcf2;">
    <tr><td align="center" style="padding:28px 32px 6px;">
      <img src="${site}/jumpi-logo.png" width="120" alt="Jumpi Games" style="display:block;width:120px;height:auto;border:0;">
      <div style="font-family:${H};font-size:28px;line-height:34px;color:#1d2b4f;padding-top:14px;">PARENTS' PAGE CODE</div>
      <div style="font-family:${B};font-size:16px;line-height:24px;color:#4a5a7a;padding-top:10px;">Someone asked to open the parents' page for the Jumpi account <b style="color:#1d2b4f;">${name}</b>. Here is the code:</div>
    </td></tr>
    <tr><td align="center" style="padding:18px 20px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table></td></tr>
    <tr><td align="center" style="padding:0 32px 8px;font-family:${B};font-size:14px;line-height:21px;color:#6a7a9a;">It works for ${minutes} minutes and only once. If you didn't ask for it, you can ignore this email: nothing changes without the code.</td></tr>
    <tr><td align="center" dir="rtl" style="padding:14px 32px 26px;font-family:${B};font-size:15px;line-height:23px;color:#4a5a7a;border-top:2px dashed #e3ecf7;">
      ביקשו לפתוח את עמוד ההורים של החשבון <b style="color:#1d2b4f;">${name}</b> בג'אמפי. הקוד שלמעלה עובד ${minutes} דקות ופעם אחת בלבד. אם לא אתם ביקשתם, אפשר להתעלם מהמייל.
    </td></tr>
  </table>
  <div style="font-family:${B};font-size:12px;color:#8a9ab8;padding-top:16px;">© Jumpi Games · <a href="${site}/parents" style="color:#1f7fd1;">jumpigames.com/parents</a></div>
</td></tr></table></body></html>`;
  const text = `Your Jumpi parents' page code for ${username}: ${code}\nIt works for ${minutes} minutes and only once. If you didn't ask for it, ignore this email.\n\nהקוד לעמוד ההורים של ${username} בג'אמפי: ${code}\nהקוד עובד ${minutes} דקות ופעם אחת בלבד.\n\n${site}/parents`;
  return { subject: `Jumpi parents' page code: ${code}`, html, text };
}
