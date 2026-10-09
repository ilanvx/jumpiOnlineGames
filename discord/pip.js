/*
  Pip, the Jumpi Discord bot, talking from the game server (Discord's REST API, no extra package).
  Turned on only when .env has DISCORD_LIVE=1 + DISCORD_BOT_TOKEN + DISCORD_GUILD_ID, so a copy of the game running
  on a home computer doesn't post into the real server. Everything here is fire-and-forget: if Discord is slow or
  down, the game never waits for it or breaks.

  - postGiftCode(code)  → #updates      (from the admin panel: "Post in Discord")
  - modLog(...)         → #mod-log      (kick / ban / mute / unban / unmute / coins by moderators and admins)
  - staffAlert(msg)     → #staff-chat   (a new Contact message or bug report; no email address, private info hidden)
  - teamAlert(app)      → #staff-chat   (a new application from the /team page; first name + role only)
  - startDiscordStats() → renames the "🎮 Playing now: N" and "👥 Members: N" channels every 10 minutes
  - agreeToRules()      → the ✅ button in #rules (discord/interactions.js): gives the "Jumpi Friend" role, which
                          opens the server, and posts a welcome card with their avatar and name in #welcome
  The channels themselves are made by tools/discord (npm run discord:apply).
*/
import { Worker } from "node:worker_threads";
import { PUBLIC_URL } from "../mail/send.js";

const API = "https://discord.com/api/v10";
export const FRIEND_ROLE = "Jumpi Friend";   // given by the ✅ in #rules; made by tools/discord
export const env = () => ({ token: process.env.DISCORD_BOT_TOKEN, guild: process.env.DISCORD_GUILD_ID });
export const discordOn = () => process.env.DISCORD_LIVE === "1" && !!env().token && !!env().guild;
const PIP = () => `${PUBLIC_URL()}/site/discord/pip.png`;
const key = (s) => String(s).toLowerCase().replace(/[^a-z0-9֐-׿]/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function api(method, path, body) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(API + path, {
      method, signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bot ${env().token}`, "User-Agent": "JumpiGame (https://jumpigames.com, 1.0)", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429) { const j = await r.json().catch(() => ({})); await sleep(Math.min(30, j.retry_after || 2) * 1000 + 100); continue; }
    if (r.status === 204) return null;
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
    return j;
  }
  throw new Error(`${method} ${path}: rate limited`);
}

// the server's channels, read again at most every 10 minutes (or when one isn't found)
let chans = { at: 0, list: [] };
async function channel(name, { prefix = false } = {}) {
  const k = key(name);
  const find = () => chans.list.find((c) => (prefix ? key(c.name).startsWith(k) : key(c.name) === k));
  if (Date.now() - chans.at > 10 * 60_000 || !find()) chans = { at: Date.now(), list: await api("GET", `/guilds/${env().guild}/channels`) };
  return find() || null;
}

// a role's id by its name (read again at most every 10 minutes)
let roles = { at: 0, list: [] };
export async function roleId(name) {
  if (Date.now() - roles.at > 10 * 60_000 || !roles.list.some((r) => r.name === name)) roles = { at: Date.now(), list: await api("GET", `/guilds/${env().guild}/roles`) };
  return roles.list.find((r) => r.name === name)?.id || null;
}
export const channelId = async (name) => (await channel(name))?.id || null;
// the server's own emoji by name, as text for a message ("" if it isn't there)
let emojis = { at: 0, list: [] };
export async function emojiTag(name) {
  try {
    if (Date.now() - emojis.at > 30 * 60_000) emojis = { at: Date.now(), list: await api("GET", `/guilds/${env().guild}/emojis`) };
    const e = emojis.list.find((x) => x.name === name);
    return e ? `<${e.animated ? "a" : ""}:${e.name}:${e.id}>` : "";
  } catch { return ""; }
}

// one message at a time, in order
let queue = Promise.resolve();
function send(channelName, body) {
  if (!discordOn()) return Promise.resolve(false);
  const job = queue.then(async () => {
    const c = await channel(channelName);
    if (!c) { console.warn(`[discord] no #${channelName} channel (run npm run discord:apply)`); return false; }
    await api("POST", `/channels/${c.id}/messages`, { allowed_mentions: { parse: [] }, ...body });
    return true;
  }).catch((err) => { console.warn("[discord]", err.message); return false; });
  queue = job;
  return job;
}

const hex = (h) => parseInt(h.replace("#", ""), 16);
const ts = (d) => `<t:${Math.floor(new Date(d).getTime() / 1000)}:R>`;
// hides anything that looks like an email or a phone number before it goes to Discord
const hidePrivate = (t) => String(t || "").replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email hidden]").replace(/\+?\d[\d\s\-().]{6,}\d/g, "[number hidden]");
const cut = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

/* ---------- gift codes → #gift-codes ---------- */
export async function postGiftCode(c) {
  const [coin, gift] = await Promise.all([emojiTag("jumpi_coin"), emojiTag("jumpi_gift")]);
  const fields = [
    { name: "🪙 Coins", value: `${coin} **${Number(c.coins).toLocaleString("en-US")}**`, inline: true },
    { name: "👥 Players", value: c.maxUses ? `First **${Number(c.maxUses).toLocaleString("en-US")}**` : "Everyone!", inline: true },
    { name: "⏰ Ends", value: c.expiresAt ? ts(c.expiresAt) : "Never", inline: true },
  ];
  return send("updates", { embeds: [{
    color: hex("#2fd36b"), title: "🎁 New gift code!", thumbnail: { url: PIP() },
    description: `${gift} \`\`\`\n${c.code}\n\`\`\`Open Jumpi → on the start screen press **Codes** → type the code on my sign → **REDEEM**!\nבמסך הפתיחה לוחצים **Codes**, מקלידים את הקוד ולוחצים **REDEEM**.\n\n🎮 ${PUBLIC_URL()}/play`,
    fields, footer: { text: "Every player can use a code once · Pip" }, timestamp: new Date().toISOString(),
  }] });
}

/* ---------- moderation → #mod-log ---------- */
const MOD_LOOK = {
  kick: ["👢 Kick", "#ff8a1c"], ban: ["🔨 Ban", "#ff4545"], unban: ["🕊️ Unban", "#2fd36b"], mute: ["🔇 Mute", "#ffb21f"],
  unmute: ["🔊 Unmute", "#2fd36b"], coins: ["🪙 Coins", "#ffd23a"],
  "make-mod": ["⭐ New moderator", "#3d9bff"], "remove-mod": ["Moderator role removed", "#8a94a6"],
};
export function modLog({ by, byRole, action, target, details = "", via = "game" }) {
  const look = MOD_LOOK[action];
  if (!look) return Promise.resolve(false);
  return send("mod-log", { embeds: [{
    color: hex(look[1]), title: look[0],
    fields: [
      { name: byRole === "mod" ? "Moderator" : "Admin", value: by || "?", inline: true },
      { name: "Player", value: target || "?", inline: true },
      { name: "Where", value: via === "panel" ? "Admin panel" : "In the game", inline: true },
      ...(details ? [{ name: "Details", value: cut(hidePrivate(details), 1000) }] : []),
    ],
    timestamp: new Date().toISOString(),
  }] });
}

/* ---------- Contact page → #staff-chat ---------- */
const TOPIC = { general: "💬 Question", safety: "🛡️ Safety", privacy: "🔒 Privacy", account: "👤 Account", bug: "🐞 Bug report", idea: "💡 Idea" };
// a new application from the /team page (routes/team.js): role and first name only, never the email
const TEAM_ROLE = { manager: "📣 Community Manager", guide: "🛡️ Guide (moderator)", beta: "🧪 Beta Tester" };
export function teamAlert({ role, name, age, account }) {
  return send("staff-chat", { embeds: [{
    color: hex(role === "manager" ? "#e0262f" : role === "guide" ? "#1f5fe0" : "#8a4dff"),
    title: `🙋 New team application · ${TEAM_ROLE[role] || role}`,
    fields: [
      { name: "From", value: cut(String(name || "—").split(/\s+/)[0], 40) || "—", inline: true },
      { name: "Age", value: age >= 18 ? "18+" : "under 18", inline: true },
      { name: "Player", value: account || "not logged in", inline: true },
    ],
    footer: { text: "Read it in the admin panel → Team applications" },
    url: `${PUBLIC_URL()}/admin#team`, timestamp: new Date().toISOString(),
  }] });
}
export function staffAlert({ topic, name, username, message, lang }) {
  return send("staff-chat", { embeds: [{
    color: hex(topic === "safety" ? "#ff4545" : topic === "bug" ? "#ff8a1c" : "#1fb6ff"),
    title: `📬 New message · ${TOPIC[topic] || topic}`,
    description: cut(hidePrivate(message), 700),
    fields: [
      { name: "From", value: cut(String(name || "—").split(/\s+/)[0], 40) || "—", inline: true },
      { name: "Player", value: username || "not logged in", inline: true },
      { name: "Language", value: lang === "he" ? "Hebrew" : "English", inline: true },
    ],
    footer: { text: "Answer it in the admin panel → Contact (the email address is only there)" },
    url: `${PUBLIC_URL()}/admin`, timestamp: new Date().toISOString(),
  }] });
}

/* ---------- the ✅ in #rules: open the server + a welcome card in #welcome ---------- */
const cardMade = new Map();   // userId → when, so leaving and joining again doesn't post a card every time
function makeCard(data) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./card-worker.js", import.meta.url), { workerData: data });
    const t = setTimeout(() => { w.terminate(); reject(new Error("card took too long")); }, 20_000);
    w.once("message", (png) => { clearTimeout(t); resolve(Buffer.from(png)); w.terminate(); });
    w.once("error", (e) => { clearTimeout(t); reject(e); });
  });
}
async function avatarPng(user) {
  const url = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
    : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  } catch { return null; }
}
async function postWelcomeCard(user) {
  if (Date.now() - (cardMade.get(user.id) || 0) < 24 * 3600_000) return;
  cardMade.set(user.id, Date.now());
  if (cardMade.size > 5000) cardMade.clear();
  const [avatar, g, chatId, wave] = await Promise.all([avatarPng(user), api("GET", `/guilds/${env().guild}?with_counts=true`).catch(() => null), channelId("chat").catch(() => null), emojiTag("pip_hi")]);
  const png = await makeCard({ displayName: user.global_name || "", username: user.username, avatar, number: g?.approximate_member_count || 0 });
  const c = await channel("welcome");
  if (!c) return;
  const form = new FormData();
  form.append("payload_json", JSON.stringify({
    content: `${wave || "👋"} Welcome to Jumpi, <@${user.id}>! ${chatId ? `Come say hi in <#${chatId}> 💬` : ""}`,
    embeds: [{ color: hex("#7b5cff"), image: { url: "attachment://welcome.png" } }],
    attachments: [{ id: 0, filename: "welcome.png" }],
    allowed_mentions: { users: [user.id] },
  }));
  form.append("files[0]", new Blob([png], { type: "image/png" }), "welcome.png");
  const r = await fetch(`${API}/channels/${c.id}/messages`, { method: "POST", headers: { Authorization: `Bot ${env().token}`, "User-Agent": "JumpiGame (https://jumpigames.com, 1.0)" }, body: form, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`welcome card → ${r.status} ${(await r.text()).slice(0, 200)}`);
}
// → "added" | "already" | "error"
export async function agreeToRules(member) {
  const user = member?.user;
  if (!discordOn() || !user) return "error";
  const rid = await roleId(FRIEND_ROLE);
  if (!rid) { console.warn(`[discord] no "${FRIEND_ROLE}" role (run npm run discord:apply)`); return "error"; }
  if ((member.roles || []).includes(rid)) return "already";
  await api("PUT", `/guilds/${env().guild}/members/${user.id}/roles/${rid}`);
  queue = queue.then(() => postWelcomeCard(user)).catch((err) => console.warn("[discord]", err.message));
  return "added";
}

/* ---------- live counters (voice channels nobody can join, only read) ---------- */
// Discord allows 2 renames of a channel per 10 minutes, so: every 10 minutes, and only when the number changed
export function startDiscordStats(playingNow) {
  if (!discordOn()) { if (env().token) console.log("· Discord: set DISCORD_LIVE=1 in .env to let Pip post from this server"); return; }
  console.log("✓ Discord: Pip is on (gift codes, mod log, staff alerts, live counters)");
  const tick = async () => {
    try {
      const g = await api("GET", `/guilds/${env().guild}?with_counts=true`);
      const want = [["playing now", `🎮 Playing now: ${playingNow()}`], ["members", `👥 Members: ${g.approximate_member_count ?? "?"}`]];
      for (const [prefix, name] of want) {
        const c = await channel(prefix, { prefix: true });
        if (c && c.name !== name) { await api("PATCH", `/channels/${c.id}`, { name }); c.name = name; }
      }
    } catch (err) { console.warn("[discord] counters:", err.message); }
  };
  setTimeout(tick, 15_000);
  setInterval(tick, 10 * 60_000).unref();
}
