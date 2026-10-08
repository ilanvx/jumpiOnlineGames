/*
  "Welcome to the Jumpi family!" email with the 6-digit code (sent after sign-up, and again when someone asks
  for a new code). Built with tables and inline styles so it looks right in Gmail, Outlook and phone apps.
*/
import { PUBLIC_URL } from "./send.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function welcomeEmail({ username, code, minutes = 15, again = false }) {
  const site = PUBLIC_URL(), name = esc(username), digits = String(code).split("");
  const H = "'Lilita One','Arial Black','Arial Rounded MT Bold',Arial,sans-serif;font-weight:900", B = "'Fredoka','Trebuchet MS',Arial,sans-serif";
  const dcells = digits.map((d) => `<td align="center" valign="middle" width="54" height="66" style="width:54px;height:66px;background:#ff8a1c;background-image:linear-gradient(180deg,#ffb04a,#ff8a1c);border-radius:14px;border-bottom:5px solid #c25e00;font-family:${H};font-size:38px;line-height:66px;color:#ffffff;text-align:center;">${d}</td><td width="8" style="width:8px;font-size:0;">&nbsp;</td>`).join("");
  const perk = (emoji, col, title, text) => `<td valign="top" width="33%" style="padding:0 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8ff;border-radius:18px;"><tr><td align="center" valign="top" height="150" style="padding:18px 10px 16px;height:150px;">
        <div style="width:56px;height:56px;line-height:56px;border-radius:50%;background:${col};font-size:28px;text-align:center;margin:0 auto 10px;">${emoji}</div>
        <div style="font-family:${H};font-size:17px;color:#1d2b4f;letter-spacing:.3px;">${title}</div>
        <div style="font-family:${B};font-size:13px;line-height:18px;color:#5a6a8a;padding-top:4px;">${text}</div>
      </td></tr></table></td>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only">
<title>Welcome to the Jumpi family!</title>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&family=Lilita+One&display=swap" rel="stylesheet">
<style>@media (max-width:620px){.wrap{width:100%!important}.pad{padding-left:20px!important;padding-right:20px!important}.perks td{display:block!important;width:100%!important;padding:6px 0!important}.hero{height:auto!important}}</style>
</head><body style="margin:0;padding:0;background:#1fb6ff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your Jumpi code is ${esc(code)}. Welcome to the family, ${name}!</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1fb6ff" style="background:#1fb6ff;background-image:radial-gradient(circle at 15% 10%,#7ddcff 0,transparent 40%),radial-gradient(circle at 85% 30%,#5fc8ff 0,transparent 35%),linear-gradient(180deg,#1fb6ff,#0b8fe0);">
<tr><td align="center" style="padding:28px 12px 36px;">
  <!-- logo -->
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;"><tr><td align="center" style="padding:0 0 18px;">
    <span style="font-family:${H};font-size:40px;line-height:44px;color:#ffffff;letter-spacing:1px;text-shadow:0 4px 0 #0b5fa8;">JUMPI</span><span style="font-family:${H};font-size:40px;line-height:44px;color:#9cff5a;letter-spacing:1px;text-shadow:0 4px 0 #2f8f1f;"> GAMES</span>
  </td></tr></table>
  <!-- the card -->
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:600px;background:#ffffff;border-radius:30px;overflow:hidden;box-shadow:0 10px 0 #0b6fb8;">
    <tr><td style="padding:0;"><img class="hero" src="${site}/site/email/welcome-hero.jpg" width="600" height="320" alt="Jumpis waving hello" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:30px 30px 0 0;"></td></tr>
    <tr><td class="pad" align="center" style="padding:30px 44px 6px;">
      <div style="font-family:${H};font-size:36px;line-height:40px;color:#ff8a1c;letter-spacing:.5px;">${again ? "HERE'S YOUR NEW CODE!" : "WELCOME TO THE FAMILY!"}</div>
      <div style="font-family:${B};font-size:18px;line-height:27px;color:#3a4a6a;padding-top:14px;">Hi <b style="color:#1d2b4f;">${name}</b>! ${again ? "You asked for a new code, here it is." : "We're so happy you're here. Your Jumpi is all dressed up and waiting for you in the Plaza!"}</div>
    </td></tr>
    <!-- the code -->
    <tr><td class="pad" align="center" style="padding:24px 44px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff6e8;border-radius:24px;border:3px dashed #ffc98a;"><tr><td align="center" style="padding:22px 12px 20px;">
        <div style="font-family:${H};font-size:18px;color:#c25e00;letter-spacing:1px;padding-bottom:14px;">YOUR SECRET CODE</div>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>${dcells}</tr></table>
        <div style="font-family:${B};font-size:14px;line-height:20px;color:#8a6a4a;padding-top:14px;">Type it in the game to unlock your account. It works for ${minutes} minutes.</div>
      </td></tr></table>
    </td></tr>
    <!-- what's waiting -->
    <tr><td class="pad" align="center" style="padding:26px 38px 6px;">
      <div style="font-family:${H};font-size:22px;color:#1d2b4f;padding-bottom:14px;">What's waiting for you</div>
      <table role="presentation" class="perks" width="100%" cellpadding="0" cellspacing="0"><tr>
        ${perk("🏠", "#ffe0bf", "Your home", "Decorate it, add a garden, a pool and a second floor.")}
        ${perk("🐶", "#ffd6e7", "Cute pets", "Adopt a puppy, a kitten or even a baby dragon.")}
        ${perk("🛵", "#d6f3ff", "Fun jobs", "Deliver pizza, catch pickpockets, serve food and earn coins.")}
      </tr></table>
    </td></tr>
    <!-- button -->
    <tr><td align="center" style="padding:28px 40px 34px;">
      <a href="${site}/play" style="display:inline-block;padding:16px 46px;border-radius:30px;background:#2fd36b;background-image:linear-gradient(180deg,#5fe08a,#2fd36b);border-bottom:6px solid #17913f;font-family:${H};font-size:22px;letter-spacing:1px;color:#ffffff;text-decoration:none;">LET'S PLAY!</a>
    </td></tr>
    <tr><td class="pad" align="center" style="padding:0 44px 30px;">
      <div style="height:2px;background:#eef2f8;margin-bottom:18px;"></div>
      <div style="font-family:${B};font-size:13px;line-height:20px;color:#8a97ab;">Remember: never share your password, and only make friends you feel good about. Be kind, have fun!</div>
    </td></tr>
  </table>
  <!-- footer -->
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;"><tr><td align="center" style="padding:22px 20px 0;font-family:${B};font-size:12px;line-height:19px;color:#dff4ff;">
    Didn't make a Jumpi account? You can safely ignore this email.<br>Questions? <a href="mailto:support@jumpigames.com" style="color:#ffffff;">support@jumpigames.com</a> · <a href="${site}" style="color:#ffffff;">jumpigames.com</a><br>© Jumpi Games
  </td></tr></table>
</td></tr></table>
</body></html>`;
  const text = `${again ? "Here's your new Jumpi code" : "Welcome to the Jumpi family"}, ${username}!\n\nYour code: ${code}\n(It works for ${minutes} minutes. Type it in the game to unlock your account.)\n\nPlay: ${site}/play\n\nDidn't make a Jumpi account? You can ignore this email.\nQuestions? support@jumpigames.com`;
  return { subject: again ? `Your new Jumpi code: ${code}` : `Welcome to the Jumpi family! Your code: ${code}`, html, text };
}
