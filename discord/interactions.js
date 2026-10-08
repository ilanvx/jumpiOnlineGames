/*
  Discord buttons → POST /api/discord/interactions (set as "Interactions Endpoint URL" in the Discord developer
  portal → the app → General Information). Every request is signed by Discord; it's checked with the app's
  public key (DISCORD_PUBLIC_KEY in .env) and anything not signed is refused, as Discord requires.
  Buttons:
    jumpi:agree  → the ✅ under the rules in #rules: gives the "Jumpi Friend" role (opens the server) + welcome card
*/
import { createPublicKey, verify } from "node:crypto";
import { agreeToRules, channelId, discordOn, env } from "./pip.js";

let keyCache = null;
function publicKey() {
  const hex = (process.env.DISCORD_PUBLIC_KEY || "").trim();
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
  if (keyCache?.hex !== hex) keyCache = { hex, key: createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(hex, "hex").toString("base64url") }, format: "jwk" }) };
  return keyCache.key;
}
export function signedByDiscord(raw, sig, ts) {
  const key = publicKey();
  if (!key || !/^[0-9a-f]{128}$/i.test(sig || "") || !ts) return false;
  try { return verify(null, Buffer.concat([Buffer.from(String(ts)), raw]), key, Buffer.from(sig, "hex")); } catch { return false; }
}

const EPHEMERAL = 64;
const say = (content) => ({ type: 4, data: { content, flags: EPHEMERAL, allowed_mentions: { parse: [] } } });
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

// the reply for one (already checked) interaction
export async function answer(i) {
  if (i.type === 1) return { type: 1 };   // Discord's PING when the URL is saved
  if (i.type !== 3) return say("🤔");
  if (i.guild_id !== env().guild) return say("This button only works in the Jumpi server.");
  if (i.data?.custom_id === "jumpi:agree") {
    if (!discordOn()) return say("⏳ The doors aren't open yet, try again soon! · עוד רגע זה יעבוד, נסו שוב בקרוב!");
    let res = "error";
    try { res = await withTimeout(agreeToRules(i.member), 2200); } catch (err) { console.warn("[discord] agree:", err.message); }
    const chat = await withTimeout(channelId("chat"), 600).catch(() => null);
    const hi = chat ? `<#${chat}>` : "the chat";
    if (res === "added") return say(`✅ **You're in! Welcome to Jumpi!** 🎉\nAll the channels are open now. Come say hi in ${hi} 💬\n\n✅ **נכנסתם! ברוכים הבאים לג'אמפי!** כל החדרים פתוחים, בואו להגיד היי ב־${hi}`);
    if (res === "already") return say(`💛 You already agreed to the rules, you're all set! · כבר אישרתם את החוקים, הכל פתוח!`);
    return say("😕 Something went wrong, please press it again in a minute. · משהו השתבש, נסו שוב בעוד דקה.");
  }
  return say("🤔 This button doesn't do anything any more.");
}

// express handler; mounted in server.js with express.raw() BEFORE express.json(), the signature is over the raw body
export async function discordInteractions(req, res) {
  if (!publicKey()) return res.status(404).json({ error: "Not found." });
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!signedByDiscord(raw, req.get("x-signature-ed25519"), req.get("x-signature-timestamp"))) return res.status(401).send("invalid request signature");
  let i;
  try { i = JSON.parse(raw.toString("utf8")); } catch { return res.status(400).send("bad json"); }
  res.json(await answer(i));
}
