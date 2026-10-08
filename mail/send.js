/*
  Sending email with Resend (https://resend.com). The key lives only in .env: RESEND_API_KEY.
  MAIL_FROM is the sender (its domain has to be verified in Resend), PUBLIC_URL is the site address used for pictures/links.
*/
export const EMAIL_ON = () => !!process.env.RESEND_API_KEY;
export const PUBLIC_URL = () => (process.env.PUBLIC_URL || "https://jumpigames.com").replace(/\/+$/, "");

export async function sendMail({ to, subject, html, text }) {
  if (!EMAIL_ON()) return { ok: false, error: "Email is not set up on the server." };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM || "Jumpi Games <hello@jumpigames.com>", to: [to], subject, html, text }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.error("resend", r.status, body.slice(0, 300));
      return { ok: false, error: "We couldn't send the email right now. Please try again in a minute." };
    }
    return { ok: true };
  } catch (err) {
    console.error("resend", err.message);
    return { ok: false, error: "We couldn't send the email right now. Please try again in a minute." };
  }
}
