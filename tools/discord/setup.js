// Jumpi Discord tool. `npm run discord` = look only (writes last-report.txt), `npm run discord:apply` = make the server
// match server.config.js. Deletes only what config.remove lists. Needs DISCORD_BOT_TOKEN and DISCORD_GUILD_ID in .env.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import config from "./server.config.js";

const HERE = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(HERE, "../../.env") });
const APPLY = process.argv.includes("--apply");
const TOKEN = process.env.DISCORD_BOT_TOKEN, GUILD = process.env.DISCORD_GUILD_ID;
const API = "https://discord.com/api/v10";
const STATE_FILE = join(HERE, "state.json"), REPORT_FILE = join(HERE, "last-report.txt");

const P = {
  CREATE_INSTANT_INVITE: 0, KICK_MEMBERS: 1, BAN_MEMBERS: 2, ADMINISTRATOR: 3, MANAGE_CHANNELS: 4, MANAGE_GUILD: 5,
  ADD_REACTIONS: 6, VIEW_AUDIT_LOG: 7, VIEW_CHANNEL: 10, SEND_MESSAGES: 11, MANAGE_MESSAGES: 13, EMBED_LINKS: 14,
  ATTACH_FILES: 15, READ_MESSAGE_HISTORY: 16, MENTION_EVERYONE: 17, USE_EXTERNAL_EMOJIS: 18, CONNECT: 20, SPEAK: 21,
  CHANGE_NICKNAME: 26, MANAGE_NICKNAMES: 27, MANAGE_ROLES: 28, USE_APPLICATION_COMMANDS: 31, MANAGE_THREADS: 34,
  CREATE_PUBLIC_THREADS: 35, CREATE_PRIVATE_THREADS: 36, SEND_MESSAGES_IN_THREADS: 38, MODERATE_MEMBERS: 40,
};
const bits = (names) => names.reduce((a, n) => {
  if (!(n in P)) throw new Error(`Unknown permission "${n}" in server.config.js`);
  return a | (1n << BigInt(P[n]));
}, 0n);
const color = (hex) => parseInt(String(hex).replace("#", ""), 16);
const hash = (v) => createHash("sha256").update(typeof v === "string" || Buffer.isBuffer(v) ? v : JSON.stringify(v)).digest("hex").slice(0, 16);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lc = (s) => String(s).toLowerCase();
// Discord rewrites channel names (lowercase, spaces → dashes, sometimes emoji details), so names are compared by
// their letters and digits only: "🛠️updates" and "🛠updates" are the same channel
const key = (s) => lc(s).replace(/[^a-z0-9\u0590-\u05ff]/g, "");

const lines = [];
const log = (s = "") => { lines.push(s); console.log(s); };
let changes = 0, problems = 0;
const plan = (s) => { changes++; log(`  ${APPLY ? "✔" : "→"} ${s}`); };
const warn = (s) => { problems++; log(`  ⚠ ${s}`); };

async function api(method, path, body, reason) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(API + path, {
      method,
      headers: {
        Authorization: `Bot ${TOKEN}`, "User-Agent": "JumpiSetup (https://jumpigames.com, 1.0)",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(reason ? { "X-Audit-Log-Reason": encodeURIComponent(reason) } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429) { const j = await r.json().catch(() => ({})); await sleep((j.retry_after || 1) * 1000 + 100); continue; }
    if (r.status === 204) return null;
    const j = await r.json().catch(() => null);
    if (!r.ok) { const e = new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j)}`); e.status = r.status; throw e; }
    return j;
  }
  throw new Error(`${method} ${path}: still rate limited`);
}
// a write: in check mode it only reports
async function write(desc, method, path, body) {
  plan(desc);
  if (!APPLY) return null;
  try { return await api(method, path, body, "Jumpi setup tool"); }
  catch (e) { warn(`FAILED: ${desc}: ${e.message}`); return null; }
}

function loadState() { try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch { return { messages: {} }; } }

async function main() {
  if (!TOKEN || !GUILD) { console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID in .env"); process.exit(1); }
  const state = loadState(); state.messages ||= {};
  log(`Jumpi Discord ${APPLY ? "SETUP (apply)" : "CHECK (nothing is changed)"} · ${new Date().toISOString()}`);

  const me = await api("GET", "/users/@me");
  const guild = await api("GET", `/guilds/${GUILD}?with_counts=true`);
  let roles = await api("GET", `/guilds/${GUILD}/roles`);
  let channels = await api("GET", `/guilds/${GUILD}/channels`);
  const botMember = await api("GET", `/guilds/${GUILD}/members/${me.id}`);
  const botTop = Math.max(0, ...roles.filter((r) => botMember.roles.includes(r.id)).map((r) => r.position));
  let rules = [];
  try { rules = await api("GET", `/guilds/${GUILD}/auto-moderation/rules`); } catch (e) { warn(`can't read AutoMod: ${e.message}`); }

  // ---------- what the server looks like now ----------
  log(`\n== SERVER NOW ==`);
  log(`Name: ${guild.name} · members ≈ ${guild.approximate_member_count} (online ${guild.approximate_presence_count})`);
  log(`Bot: ${me.username} (top role position ${botTop}) · features: ${(guild.features || []).join(", ") || "none"}`);
  log(`Verification ${guild.verification_level} · content filter ${guild.explicit_content_filter} · notifications ${guild.default_message_notifications}`);
  log(`Roles (top first):`);
  for (const r of [...roles].sort((a, b) => b.position - a.position))
    log(`  [${r.position}] ${r.name}${r.managed ? " (bot)" : ""} #${r.color.toString(16).padStart(6, "0")} perms=${r.permissions}`);
  log(`Channels:`);
  const typeName = { 0: "text", 2: "voice", 4: "category", 5: "news", 13: "stage", 15: "forum" };
  const cats = channels.filter((c) => c.type === 4).sort((a, b) => a.position - b.position);
  const show = (c, pad) => log(`${pad}${typeName[c.type] || c.type} ${c.name}${c.topic ? ` — ${c.topic}` : ""}`);
  for (const c of channels.filter((c) => c.type !== 4 && !c.parent_id).sort((a, b) => a.position - b.position)) show(c, "  ");
  for (const cat of cats) {
    log(`  ▸ ${cat.name}`);
    for (const c of channels.filter((c) => c.parent_id === cat.id).sort((a, b) => a.position - b.position)) show(c, "      ");
  }
  log(`AutoMod rules: ${rules.map((r) => `${r.name} (type ${r.trigger_type}${r.enabled ? "" : ", off"})`).join(" · ") || "none"}`);

  log(`\n== CHANGES ${APPLY ? "MADE" : "PLANNED"} ==`);

  // ---------- server settings ----------
  log(`Server settings:`);
  const gPatch = {};
  for (const [k, v] of Object.entries(config.guild || {})) if (guild[k] !== v) gPatch[k] = v;
  if (Object.keys(gPatch).length) await write(`settings ${JSON.stringify(gPatch)}`, "PATCH", `/guilds/${GUILD}`, gPatch);
  if (config.icon && existsSync(join(HERE, config.icon))) {
    const buf = readFileSync(join(HERE, config.icon)), h = hash(buf);
    if (state.iconHash !== h) {
      const ok = await write(`server picture ← ${config.icon}`, "PATCH", `/guilds/${GUILD}`, { icon: `data:image/png;base64,${buf.toString("base64")}` });
      if (ok) state.iconHash = h;
    }
  }

  // ---------- roles ----------
  log(`Roles:`);
  const everyoneRole = roles.find((r) => r.id === GUILD);
  if (config.everyone) {
    const want = bits(config.everyone).toString();
    if (everyoneRole.permissions !== want) await write(`@everyone permissions → ${config.everyone.join(", ")}`, "PATCH", `/guilds/${GUILD}/roles/${GUILD}`, { permissions: want });
  }
  const roleId = {};
  for (const want of config.roles) {
    const body = { name: want.name, color: color(want.color), hoist: !!want.hoist, mentionable: !!want.mentionable, permissions: bits(want.perms).toString() };
    const have = roles.find((r) => lc(r.name) === lc(want.name) && !r.managed);
    if (!have) {
      const made = await write(`create role ${want.name}`, "POST", `/guilds/${GUILD}/roles`, body);
      if (made) { roles.push(made); roleId[want.name] = made.id; }
      continue;
    }
    roleId[want.name] = have.id;
    if (have.position >= botTop) { warn(`role ${want.name} is above the bot's role: drag the bot's role above it in Server Settings → Roles`); continue; }
    const diff = Object.keys(body).filter((k) => String(have[k]) !== String(body[k]));
    if (diff.length) await write(`update role ${want.name} (${diff.join(", ")})`, "PATCH", `/guilds/${GUILD}/roles/${have.id}`, body);
  }
  // order: the first role in the config on top, right under the bot
  if (APPLY) roles = await api("GET", `/guilds/${GUILD}/roles`);
  const ours = config.roles.map((w) => roles.find((r) => r.id === roleId[w.name])).filter(Boolean);
  const okOrder = ours.every((r, i) => i === 0 || ours[i - 1].position > r.position);
  if (!okOrder && ours.length > 1) {
    const slots = ours.map((r) => r.position).sort((a, b) => b - a);
    await write(`reorder roles: ${ours.map((r) => r.name).join(" > ")}`, "PATCH", `/guilds/${GUILD}/roles`, ours.map((r, i) => ({ id: r.id, position: slots[i] })));
  }

  // ---------- categories and channels ----------
  log(`Channels:`);
  const E = GUILD, TEAM = roleId["Jumpi Team"], MOD = roleId["Moderator"], FRIEND = roleId[config.friendRole];
  const staffIds = [TEAM, MOD].filter(Boolean);
  const NOTHREADS = ["CREATE_PUBLIC_THREADS", "CREATE_PRIVATE_THREADS", "SEND_MESSAGES_IN_THREADS"];
  const ow = (id, allow, deny = []) => ({ id, type: 0, allow: bits(allow).toString(), deny: bits(deny).toString() });
  const staffTalk = ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY", "ADD_REACTIONS", "EMBED_LINKS", "ATTACH_FILES", "MANAGE_MESSAGES"];
  const READ = ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "ADD_REACTIONS"], TALK = [...READ, "SEND_MESSAGES"];
  const staff = () => staffIds.map((id) => ow(id, staffTalk));
  // everyone without the friend role sees only the "open" channels (and the live counters)
  function overwrites(mode) {
    const friend = (allow, deny) => (FRIEND ? [ow(FRIEND, allow, deny)] : []);
    if (mode === "open") return [ow(E, READ, ["SEND_MESSAGES", ...NOTHREADS]), ...staff()];
    if (mode === "read") return [ow(E, [], ["VIEW_CHANNEL"]), ...friend(READ, ["SEND_MESSAGES", ...NOTHREADS]), ...staff()];
    if (mode === "chat") return [ow(E, [], ["VIEW_CHANNEL"]), ...friend(TALK, ["ATTACH_FILES", "EMBED_LINKS", "MENTION_EVERYONE", ...NOTHREADS]), ...staff()];
    if (mode === "media") return [ow(E, [], ["VIEW_CHANNEL"]), ...friend([...TALK, "ATTACH_FILES"], ["EMBED_LINKS", "MENTION_EVERYONE", ...NOTHREADS]), ...staff()];
    if (mode === "staff") return [ow(E, [], ["VIEW_CHANNEL"]), ...staff()];
    if (mode === "stat") return [ow(E, ["VIEW_CHANNEL"], ["CONNECT", "SEND_MESSAGES"])];
    throw new Error(`unknown channel mode ${mode}`);
  }
  const owKey = (list) => JSON.stringify((list || []).map((o) => [o.id, String(o.type), String(o.allow), String(o.deny)]).sort());
  const missingRoles = !TEAM || !MOD || !FRIEND;
  if (missingRoles && !APPLY) log("  (the roles don't exist yet, so channel permissions are checked after they're made)");
  const noFE = (n) => String(n).replace(/️/g, "");
  // a channel/category matches by the letters of its name, an old name in `was`, or (counters) the start of its name
  const same = (ch, want) => (want.match ? key(ch.name).startsWith(key(want.match))
    : key(ch.name) === key(want.name) || (want.was || []).some((w) => key(w) === key(ch.name)));
  const used = new Set();   // channels already matched to something in the config
  const pick = (want, cat) => {   // the same name first, an old name (`was`) only if there's none
    const ok = (x) => !used.has(x.id) && (cat ? x.type === 4 : x.type !== 4);
    return channels.find((x) => ok(x) && (want.match ? same(x, want) : key(x.name) === key(want.name))) || channels.find((x) => ok(x) && same(x, want));
  };

  const chanId = {};
  for (const [ci, cat] of config.categories.entries()) {
    let c = pick(cat, true);
    const allStaff = cat.channels.every((ch) => ch.mode === "staff"), allStat = cat.channels.every((ch) => ch.mode === "stat");
    const catOw = allStaff ? overwrites("staff") : allStat ? overwrites("stat") : [];
    if (!c) {
      c = await write(`create category ${cat.name}`, "POST", `/guilds/${GUILD}/channels`, { name: cat.name, type: 4, permission_overwrites: catOw, position: ci });
      if (c) channels.push(c);
    } else {
      const patch = {};
      if (noFE(c.name) !== noFE(cat.name)) patch.name = cat.name;
      if (!missingRoles && owKey(c.permission_overwrites) !== owKey(catOw)) patch.permission_overwrites = catOw;
      if (Object.keys(patch).length) await write(`${patch.name ? `rename category ${c.name} → ${cat.name}` : `permissions of category ${cat.name}`}`, "PATCH", `/channels/${c.id}`, patch);
    }
    if (c) used.add(c.id);
    const parent = c?.id;
    for (const [i, want] of cat.channels.entries()) {
      const stat = want.mode === "stat";
      const body = stat ? { name: want.name, type: 2, permission_overwrites: overwrites("stat"), parent_id: parent }
        : { name: want.name, type: 0, topic: want.topic || "", rate_limit_per_user: want.slow || 0, permission_overwrites: overwrites(want.mode), parent_id: parent };
      const have = pick(want);
      if (!have) {
        if (missingRoles && APPLY) { warn(`skipped ${want.name}: roles missing`); continue; }
        const made = await write(`create #${want.name} in ${cat.name} (${want.mode})`, "POST", `/guilds/${GUILD}/channels`, { ...body, position: i });
        if (made) { channels.push(made); used.add(made.id); chanId[key(want.match || want.name)] = made.id; }
        continue;
      }
      used.add(have.id);
      chanId[key(want.match || want.name)] = have.id;
      const patch = {};
      if (!stat && noFE(have.name) !== noFE(want.name)) patch.name = want.name;
      if (!stat && (have.topic || "") !== body.topic) patch.topic = body.topic;
      if (!stat && (have.rate_limit_per_user || 0) !== body.rate_limit_per_user) patch.rate_limit_per_user = body.rate_limit_per_user;
      if (parent && have.parent_id !== parent) patch.parent_id = parent;
      if (!missingRoles && owKey(have.permission_overwrites) !== owKey(body.permission_overwrites)) patch.permission_overwrites = body.permission_overwrites;
      if (Object.keys(patch).length) await write(`${patch.name ? `rename #${have.name} → #${want.name}` : `update #${want.name}`} (${Object.keys(patch).join(", ")})`, "PATCH", `/channels/${have.id}`, patch);
    }
  }

  // the old layout: only the names listed in config.remove, and never something the config uses
  const rm = config.remove || {};
  const rmChan = new Set((rm.channels || []).map(key)), rmCat = new Set((rm.categories || []).map(key));
  for (const c of channels.filter((x) => !used.has(x.id) && x.type !== 4 && rmChan.has(key(x.name))))
    await write(`delete #${c.name} (old layout)`, "DELETE", `/channels/${c.id}`);
  for (const c of channels.filter((x) => !used.has(x.id) && x.type === 4 && rmCat.has(key(x.name))))
    await write(`delete category ${c.name} (old layout)`, "DELETE", `/channels/${c.id}`);

  // order: only fixed when the config's categories/channels are not in the config's order (other channels don't matter)
  const positions = [];
  const inOrder = (list) => list.every((c, i) => i === 0 || list[i - 1].position < c.position);
  if (APPLY) channels = await api("GET", `/guilds/${GUILD}/channels`);
  const byId = (id) => channels.find((x) => x.id === id);
  const catList = config.categories.map((cat) => channels.find((x) => x.type === 4 && same(x, cat))).filter(Boolean);
  if (!inOrder(catList)) catList.forEach((c, i) => positions.push({ id: c.id, position: i }));
  for (const cat of config.categories) {
    const list = cat.channels.map((w) => byId(chanId[key(w.match || w.name)])).filter(Boolean);
    if (!inOrder(list)) list.forEach((c, i) => positions.push({ id: c.id, position: i }));
  }
  if (positions.length) await write(`fix the order of ${positions.length} channel(s)/categories`, "PATCH", `/guilds/${GUILD}/channels`, positions);
  const extra = channels.filter((c) => !used.has(c.id) && !(c.type === 4 ? rmCat : rmChan).has(key(c.name)));
  if (extra.length) log(`  (not in the config, left as they are: ${extra.map((c) => (c.type === 4 ? "▸" : "#") + c.name).join(", ")})`);

  // ---------- AutoMod ----------
  log(`AutoMod:`);
  const TYPES = { keyword: 1, spam: 3, preset: 4, mentions: 5 };
  for (const want of config.automod || []) {
    const t = TYPES[want.type];
    const meta = want.type === "keyword" ? { keyword_filter: want.words || [], regex_patterns: want.regex || [], allow_list: want.allow || [] }
      : want.type === "preset" ? { presets: want.presets, allow_list: want.allow || [] }
      : want.type === "mentions" ? { mention_total_limit: want.limit, mention_raid_protection_enabled: true } : {};
    const actions = [{ type: 1, metadata: want.message ? { custom_message: want.message.slice(0, 150) } : {} }];
    const body = { name: want.name, event_type: 1, trigger_type: t, trigger_metadata: meta, actions, enabled: true, exempt_roles: staffIds };
    // keyword rules are matched by name; Discord allows only one preset rule and one mention rule, so those by type
    const have = rules.find((r) => r.trigger_type === t && (t !== 1 || r.name === want.name));
    if (!have) { await write(`create AutoMod "${want.name}"`, "POST", `/guilds/${GUILD}/auto-moderation/rules`, body); continue; }
    const cur = { name: have.name, trigger_metadata: have.trigger_metadata, enabled: have.enabled, exempt_roles: [...(have.exempt_roles || [])].sort(), msg: have.actions?.[0]?.metadata?.custom_message || "" };
    const nxt = { name: body.name, trigger_metadata: meta, enabled: true, exempt_roles: [...staffIds].sort(), msg: actions[0].metadata.custom_message || "" };
    const curMeta = Object.fromEntries(Object.keys(meta).map((k) => [k, cur.trigger_metadata?.[k]]));
    if (hash({ ...cur, trigger_metadata: curMeta }) !== hash(nxt)) {
      const { trigger_type, ...patch } = body;
      await write(`update AutoMod "${want.name}"`, "PATCH", `/guilds/${GUILD}/auto-moderation/rules/${have.id}`, patch);
    }
  }

  // ---------- Pip's messages ----------
  log(`Messages:`);
  const links = (t) => (t == null ? t : String(t).replace(/\{#([^}]+)\}/g, (m, n) => (chanId[key(n)] ? `<#${chanId[key(n)]}>` : `#${n}`)));
  const button = (b) => ({ type: 2, label: b.label, ...(b.emoji ? { emoji: { name: b.emoji } } : {}),
    ...(b.url ? { style: 5, url: b.url } : { style: b.style || 1, custom_id: b.id }) });
  for (const m of config.messages || []) {
    const embeds = m.embeds.map((e) => ({
      title: links(e.title), description: links(e.description), color: e.color ? color(e.color) : undefined, url: e.url,
      thumbnail: e.thumbnail ? { url: e.thumbnail } : undefined, image: e.image ? { url: e.image } : undefined,
      fields: e.fields?.map((f) => ({ name: links(f.name), value: links(f.value), inline: !!f.inline })),
      footer: e.footer ? { text: e.footer } : undefined,
    }));
    const components = (m.buttons || []).map((row) => ({ type: 1, components: row.map(button) }));
    const body = { content: links(m.content || ""), embeds, components, allowed_mentions: { parse: [] } };
    const h = hash(body), cid = chanId[key(m.channel)], saved = state.messages[m.key];
    if (!cid) { plan(`post "${m.key}" in #${m.channel} (after the channel is made)`); continue; }
    let exists = false;
    if (saved?.id && saved.channel === cid) {
      try { await api("GET", `/channels/${cid}/messages/${saved.id}`); exists = true; } catch { exists = false; }
    }
    if (exists && saved.hash === h) continue;
    if (exists) {
      const r = await write(`edit "${m.key}" in #${m.channel}`, "PATCH", `/channels/${cid}/messages/${saved.id}`, body);
      if (r) state.messages[m.key] = { channel: cid, id: saved.id, hash: h };
    } else {
      const r = await write(`post "${m.key}" in #${m.channel}`, "POST", `/channels/${cid}/messages`, body);
      if (r) state.messages[m.key] = { channel: cid, id: r.id, hash: h };
    }
  }
  // messages no longer in the config (in channels that stay) are left alone; forget them
  for (const k of Object.keys(state.messages)) if (!(config.messages || []).some((m) => m.key === k)) delete state.messages[k];

  if (APPLY) writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  log(`\n${changes ? `${changes} change(s) ${APPLY ? "made" : "to make — run: npm run discord:apply"}` : "Everything already matches the config ✔"}${problems ? ` · ${problems} warning(s) above` : ""}`);
}

main().catch((e) => { log(`\nERROR: ${e.message}`); if (e.status === 401) log("The token in .env is wrong (DISCORD_BOT_TOKEN)."); if (e.status === 403 || e.status === 404) log("Check DISCORD_GUILD_ID and that the bot is in the server with Administrator."); process.exitCode = 1; })
  .finally(() => { try { writeFileSync(REPORT_FILE, lines.join("\n") + "\n"); } catch {} });
