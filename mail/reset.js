/*
  "Forgot your password?" email with the button to /reset-password?token=… (routes/auth.js /forgot).
  Same look as the welcome email: tables and inline styles so it works in Gmail, Outlook and phone apps.
  Picture: public/site/email/reset-hero.jpg (the 3D scene of the reset page, /reset-password?hero).
*/
import { PUBLIC_URL } from "./send.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function resetEmail({ username, link, minutes = 30 }) {
  const site = PUBLIC_URL(), name = esc(username), url = esc(link);
  const H = "'Lilita One','Arial Black','Arial Rounded MT Bold',Arial,sans-serif;font-weight:900", B = "'Fredoka','Trebuchet MS',Arial,sans-serif";
  const step = (n, col, text) => `<tr><td valign="top" width="44" style="padding:0 12px 12px 0;"><div style="width:36px;height:36px;line-height:36px;border-radius:50%;background:${col};font-family:${H};font-size:18px;color:#ffffff;text-align:center;">${n}</div></td>
      <td valign="middle" style="padding:0 0 12px;font-family:${B};font-size:15px;line-height:22px;color:#3a4a6a;">${text}</td></tr>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only">
<title>Make a new Jumpi password</title>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&family=Lilita+One&display=swap" rel="stylesheet">
<style>@media (max-width:620px){.wrap{width:100%!important}.pad{padding-left:20px!important;padding-right:20px!important}.cta a{display:block!important;padding:16px 10px!important}}</style>
</head><body style="margin:0;padding:0;background:#1fb6ff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Hi ${name}! Here's the link to make a new Jumpi password. It works for ${minutes} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1fb6ff" style="background:#1fb6ff;background-image:radial-gradient(circle at 15% 10%,#7ddcff 0,transparent 40%),radial-gradient(circle at 85% 30%,#5fc8ff 0,transparent 35%),linear-gradient(180deg,#1fb6ff,#0b8fe0);">
<tr><td align="center" style="padding:28px 12px 36px;">
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;"><tr><td align="center" style="padding:0 0 18px;">
    <span style="font-family:${H};font-size:40px;line-height:44px;color:#ffffff;letter-spacing:1px;text-shadow:0 4px 0 #0b5fa8;">JUMPI</span><span style="font-family:${H};font-size:40px;line-height:44px;color:#9cff5a;letter-spacing:1px;text-shadow:0 4px 0 #2f8f1f;"> GAMES</span>
  </td></tr></table>
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:600px;background:#ffffff;border-radius:30px;overflow:hidden;box-shadow:0 10px 0 #0b6fb8;">
    <tr><td style="padding:0;"><img src="${site}/site/email/reset-hero.jpg" width="600" height="320" alt="A Jumpi with a big golden key next to a padlock" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:30px 30px 0 0;"></td></tr>
    <tr><td class="pad" align="center" style="padding:30px 44px 4px;">
      <div style="font-family:${H};font-size:34px;line-height:38px;color:#7a5cff;letter-spacing:.5px;">FORGOT YOUR PASSWORD?</div>
      <div style="font-family:${B};font-size:18px;line-height:27px;color:#3a4a6a;padding-top:14px;">Hi <b style="color:#1d2b4f;">${name}</b>! No worries, it happens to everyone. Press the button to make a new password for your Jumpi account.</div>
    </td></tr>
    <tr><td class="cta" align="center" style="padding:26px 40px 10px;">
      <a href="${url}" style="display:inline-block;padding:18px 44px;border-radius:30px;background:#2fd36b;background-image:linear-gradient(180deg,#5fe08a,#2fd36b);border-bottom:6px solid #17913f;font-family:${H};font-size:22px;letter-spacing:1px;color:#ffffff;text-decoration:none;">MAKE A NEW PASSWORD</a>
    </td></tr>
    <tr><td align="center" style="padding:6px 40px 0;font-family:${B};font-size:14px;line-height:20px;color:#8a6a4a;">
      <span style="display:inline-block;padding:8px 16px;border-radius:20px;background:#fff6e8;border:2px dashed #ffc98a;">⏰ The button works for ${minutes} minutes and only once.</span>
    </td></tr>
    <tr><td class="pad" style="padding:26px 52px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${step(1, "#1fb6ff", "Press <b>MAKE A NEW PASSWORD</b>.")}
        ${step(2, "#ff8a1c", "Pick a new password you'll remember (8 characters or more).")}
        ${step(3, "#2fd36b", "Log in with it and jump back into the Plaza!")}
      </table>
    </td></tr>
    <tr><td class="pad" style="padding:6px 44px 6px;font-family:${B};font-size:13px;line-height:19px;color:#8a97ab;">
      Button not working? Copy this link into your browser:<br><a href="${url}" style="color:#0b72c9;word-break:break-all;">${url}</a>
    </td></tr>
    <tr><td class="pad" align="center" style="padding:16px 44px 30px;">
      <div style="height:2px;background:#eef2f8;margin-bottom:18px;"></div>
      <div style="font-family:${B};font-size:13px;line-height:20px;color:#8a97ab;"><b style="color:#5a6a8a;">Didn't ask for this?</b> You can safely ignore this email: your password stays the same. Jumpi will never ask for your password by email or chat.</div>
    </td></tr>
  </table>
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;"><tr><td align="center" style="padding:22px 20px 0;font-family:${B};font-size:12px;line-height:19px;color:#dff4ff;">
    Questions? <a href="mailto:support@jumpigames.com" style="color:#ffffff;">support@jumpigames.com</a> · <a href="${site}" style="color:#ffffff;">jumpigames.com</a><br>© Jumpi Games
  </td></tr></table>
</td></tr></table>
</body></html>`;
  const text = `Hi ${username}!\n\nSomeone (hopefully you) asked to make a new password for your Jumpi account.\nOpen this link to pick a new one (it works for ${minutes} minutes and only once):\n${link}\n\nDidn't ask for this? You can ignore this email: your password stays the same.\nQuestions? support@jumpigames.com`;
  return { subject: "Make a new Jumpi password", html, text };
}
