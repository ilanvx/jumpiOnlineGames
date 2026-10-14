/*
  Jumpi load test: many bot players in the game at once, to see how the server holds up.
  Run it ON THE SERVER, from the game folder (it uses the server's own .env, so no secrets are ever typed or shown):

      cd ~/jumpi && node tools/loadtest/loadtest.js
      node tools/loadtest/loadtest.js --stages 50,100,200 --secs 45     (a shorter run)
      node tools/loadtest/loadtest.js --clean                           (only removes leftover bots)

  What it does:
  1. makes test accounts in the database: LoadBot0001…, email loadbotNNNN@loadtest.invalid (verified, never usable to log in
     with a password); leftovers from an earlier run are removed first;
  2. connects them to the game on this machine (http://127.0.0.1:PORT) in stages (default 50, 100, 200, 400, 800 at once).
     Each bot walks around the Plaza like a player, stands still now and then, says one of the ready-made chat lines,
     does free emotes, and about 1 in 10 goes into the Dance Club;
  3. measures in every stage: how fast the server answers (an emote's reply time), how many bots stay connected,
     the server's CPU and memory, and how much each player receives;
  4. disconnects the bots and deletes them and everything they left in the database (chat logs, play time…);
  5. prints a table, and saves it to ~/loadtest-result.txt.
  Stop any time with Ctrl+C: the bots are still cleaned up.
*/
import { fork, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ME = fileURLToPath(import.meta.url);
const arg = (name, def) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : def; };
const has = (name) => process.argv.includes("--" + name);

if (process.env.LOADTEST_WORKER === "1") await worker();
else await main();

/* ======================================================================= the bots (one worker process runs many) */
async function worker() {
  let WS;
  try { WS = (await import("ws")).default; } catch { WS = globalThis.WebSocket; }   // "ws" comes with the server (socket.io uses it)
  const QUICK = ["Hi!", "Hello friend!", "How are you?", "Let's play!", "Follow me!", "Nice outfit!", "Good game!", "Well done!", "Thank you!", "Cool pet!"];
  const EMOTES = ["happy", "wow", "sad"];   // free for everyone
  const bots = new Map();
  let S = fresh();
  function fresh() { return { msgsIn: 0, bytesIn: 0, msgsOut: 0, rtt: [], slow: 0, connectMs: [], fail: 0, drop: 0, errors: {} }; }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const err = (k) => { S.errors[k] = (S.errors[k] || 0) + 1; };

  class Bot {
    constructor(token, n) { this.token = token; this.n = n; this.x = rnd(-14, 14); this.z = rnd(-12, 16); this.face = 0; this.ack = 0; this.wait = new Map(); this.stopped = false; }
    start(url) {
      this.t0 = Date.now();
      let ws;
      try { ws = WS === globalThis.WebSocket ? new WS(url) : new WS(url, { headers: { "user-agent": "JumpiLoadTest/1" }, perMessageDeflate: false }); }
      catch (e) { S.fail++; err("open: " + e.message); return; }
      this.ws = ws;
      ws.onmessage = (ev) => this.onMsg(typeof ev.data === "string" ? ev.data : String(ev.data));
      ws.onclose = () => { this.clear(); if (!this.stopped) { if (this.up) S.drop++; else S.fail++; } this.up = false; bots.delete(this.n); };
      ws.onerror = () => { if (!this.up) err("websocket error"); };
    }
    send(s) { if (this.ws && this.ws.readyState === 1) { this.ws.send(s); S.msgsOut++; } }
    emit(name, data, onAck) {
      if (onAck) { const id = ++this.ack; this.wait.set(id, { t: Date.now(), fn: onAck }); this.send("42" + id + JSON.stringify([name, data])); }
      else this.send("42" + JSON.stringify([name, data]));
    }
    onMsg(m) {
      S.msgsIn++; S.bytesIn += m.length;
      const t = m[0];
      if (t === "0") return this.send("40" + JSON.stringify({ tab: this.token, v: 2 }));   // engine.io open -> socket.io connect with the login
      if (t === "2") return this.send("3");   // ping -> pong
      if (t !== "4") return;
      const k = m[1];
      if (k === "0") { this.up = true; S.connectMs.push(Date.now() - this.t0); this.joined(); }
      else if (k === "4") { let why = "refused"; try { why = JSON.parse(m.slice(2)).message || why; } catch {} err("login refused: " + why); this.stopped = true; S.fail++; this.ws.close(); }
      else if (k === "3") { const r = /^43(\d+)/.exec(m); const w = r && this.wait.get(+r[1]); if (w) { this.wait.delete(+r[1]); S.rtt.push(Date.now() - w.t); } }
      else if (k === "2" && m.startsWith('42["kicked') ) err("kicked");
    }
    joined() {
      const club = this.n % 10 === 3;   // about 1 in 10 is in the Dance Club
      this.emit("join", club ? { x: 0, z: 2, face: 0, pose: null, place: "club" } : { x: this.x, z: this.z, face: 0, pose: null });
      this.room = club ? "club" : "plaza";
      if (club) { this.x = 0; this.z = 2; }
      this.target = null; this.idleUntil = Date.now() + rnd(500, 3000); this.lastSend = 0;
      this.tick = setInterval(() => this.step(), 100);
      this.chatT = setTimeout(() => this.chat(), rnd(5000, 40000));
      this.emoteT = setTimeout(() => this.emote(), rnd(2000, 12000));
    }
    step() {
      const now = Date.now();
      if (!this.target && now > this.idleUntil) {
        this.target = this.room === "club" ? [rnd(-6, 6), rnd(-4, 4)] : [rnd(-18, 18), rnd(-15, 18)];
        this.run = Math.random() < 0.3;
      }
      if (this.target) {
        const [tx, tz] = this.target, dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz), sp = (this.run ? 9.4 : 5.2) * 0.1;
        if (d <= sp) { this.x = tx; this.z = tz; this.target = null; this.idleUntil = now + rnd(1500, 8000); this.emit("move", { x: +this.x.toFixed(3), z: +this.z.toFixed(3), face: +this.face.toFixed(3), pose: null, moving: false, run: false }); this.lastSend = now; return; }
        this.x += (dx / d) * sp; this.z += (dz / d) * sp; this.face = Math.atan2(dx, dz);
        this.emit("move", { x: +this.x.toFixed(3), z: +this.z.toFixed(3), face: +this.face.toFixed(3), pose: null, moving: true, run: this.run });
        this.lastSend = now;
      } else if (now - this.lastSend > 2000) { this.emit("move", { x: +this.x.toFixed(3), z: +this.z.toFixed(3), face: +this.face.toFixed(3), pose: null, moving: false, run: false }); this.lastSend = now; }   // heartbeat
    }
    chat() { if (this.stopped) return; this.emit("chat", QUICK[(Math.random() * QUICK.length) | 0]); this.chatT = setTimeout(() => this.chat(), rnd(30000, 60000)); }
    emote() {
      if (this.stopped) return;
      this.emit("emote", EMOTES[(Math.random() * 3) | 0], () => {});
      // a reply that never comes within 10 s counts as "slow"
      for (const [id, w] of this.wait) if (Date.now() - w.t > 10000) { this.wait.delete(id); S.slow++; }
      this.emoteT = setTimeout(() => this.emote(), rnd(9000, 15000));
    }
    clear() { clearInterval(this.tick); clearTimeout(this.chatT); clearTimeout(this.emoteT); }
    stop() { this.stopped = true; this.clear(); try { this.ws && this.ws.close(); } catch {} }
  }

  let tokens = [], url = "";
  process.on("message", async (msg) => {
    if (msg.type === "init") { tokens = msg.tokens; url = msg.url; }
    else if (msg.type === "target") {
      // reach `n` bots, opening at most `rate` a second
      const want = Math.min(msg.n, tokens.length);
      while (bots.size > want) { const [n, b] = [...bots].pop(); b.stop(); bots.delete(n); }
      const per = Math.max(1, Math.round(msg.rate / 10));
      for (let n = 0; n < want && bots.size < want; n++) {
        if (bots.has(n)) continue;
        const b = new Bot(tokens[n], n); bots.set(n, b); b.start(url);
        if (bots.size % per === 0) await new Promise((r) => setTimeout(r, 100));
      }
    } else if (msg.type === "stats") {
      const up = [...bots.values()].filter((b) => b.up).length;
      process.send({ type: "stats", up, cpu: process.cpuUsage(), ...S }); S = fresh();
    } else if (msg.type === "stop") { bots.forEach((b) => b.stop()); bots.clear(); setTimeout(() => process.exit(0), 300); }
  });
  process.send({ type: "ready" });
}

/* ======================================================================= the conductor */
async function main() {
  await import("dotenv/config");
  const mongoose = (await import("mongoose")).default;
  const jwt = (await import("jsonwebtoken")).default;
  const { MONGODB_URI, MONGODB_DB = "jumpi", JWT_SECRET, PORT = 3000 } = process.env;
  if (!MONGODB_URI || !JWT_SECRET) { console.error("Run this from the game folder on the server (cd ~/jumpi): the .env there is needed."); process.exit(1); }
  const STAGES = String(arg("stages", "50,100,200,400,800")).split(",").map(Number).filter((n) => n > 0);
  const SECS = Math.max(20, +arg("secs", 60)), WARM = 15, PER_WORKER = 150, RATE = +arg("rate", 40);
  const MAX = Math.max(...STAGES, 0);
  const url = `ws://127.0.0.1:${PORT}/socket.io/?EIO=4&transport=websocket`;

  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB, serverSelectionTimeoutMS: 10000 });
  const { User } = await import(path.join(process.cwd(), "models/User.js"));   // the real accounts model (its defaults fill each bot in)
  const db = mongoose.connection.db, users = User.collection;
  // a bot = this name pattern AND this email domain (both), so no real account can ever match
  const BOT = { usernameLower: /^loadbot\d{4}$/, email: /@loadtest\.invalid$/ };
  async function clean() {
    const ids = (await users.find(BOT, { projection: { _id: 1 } }).toArray()).map((u) => u._id);
    if (!ids.length) return 0;
    for (const c of await db.listCollections().toArray()) {
      if (c.type !== "collection" || c.name === users.collectionName) continue;
      const col = db.collection(c.name);
      await col.deleteMany({ $or: [{ userId: { $in: ids } }, { "a.userId": { $in: ids } }, { "b.userId": { $in: ids } }] }).catch(() => {});
    }
    await users.deleteMany({ _id: { $in: ids } });
    return ids.length;
  }
  const left = await clean();
  if (left) console.log(`Removed ${left} bots left from an earlier run.`);
  if (has("clean")) { await mongoose.disconnect(); return; }
  if (!MAX) { console.log("No stages."); process.exit(1); }

  // ---- the bot accounts
  const now = new Date(), docs = [];
  for (let i = 1; i <= MAX; i++) {
    const n = String(i).padStart(4, "0");
    docs.push({ username: "LoadBot" + n, usernameLower: "loadbot" + n, email: `loadbot${n}@loadtest.invalid`, passwordHash: "!no-password-login", emailVerified: true,
      acceptedTermsAt: now, ageConfirmedAt: now, birthDate: new Date("2014-01-01"), createdAt: now, tutorialAt: now, coins: 0, role: "player", tokenVersion: 0,
      look: { color: i % 8, eyes: i % 8, hair: i % 4, shirt: i % 4, pants: i % 4, glasses: -1, hat: -1, neck: -1, beard: -1, tag: -1, aura: -1 }, inventory: [] });
  }
  await User.insertMany(docs, { ordered: false });
  const made = await users.find(BOT, { projection: { _id: 1, usernameLower: 1 } }).sort({ usernameLower: 1 }).toArray();
  const tokens = made.map((u) => jwt.sign({ sub: u._id.toString(), v: 0, tab: 1, typ: "tab" }, JWT_SECRET, { expiresIn: "3h", jwtid: "lt" + u._id }));
  console.log(`Made ${made.length} bot accounts. The game on this machine: port ${PORT}.`);

  // ---- the game server's process (to read its CPU and memory)
  let pid = 0;
  try { pid = +execSync("pm2 pid jumpi", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || 0; } catch {}
  const TICK = 100;
  const proc = () => { try { const f = readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1].split(" "); const rss = /VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, "utf8")); return { cpu: (+f[11] + +f[12]) / TICK, rss: rss ? +rss[1] / 1024 : 0 }; } catch { return null; } };
  if (!proc()) console.log("(Couldn't find the game's process with pm2: server CPU and memory won't be shown.)");

  // ---- the workers
  const nW = Math.ceil(MAX / PER_WORKER), W = [];
  for (let w = 0; w < nW; w++) {
    const c = fork(ME, [], { env: { ...process.env, LOADTEST_WORKER: "1" }, stdio: ["ignore", "inherit", "inherit", "ipc"] });
    await new Promise((r) => c.once("message", r));
    c.send({ type: "init", url, tokens: tokens.filter((_, i) => i % nW === w) });
    W.push(c);
  }
  let stopping = false;
  async function finish(code) {
    if (stopping) return; stopping = true;
    console.log("\nDisconnecting the bots and cleaning up…");
    W.forEach((c) => { try { c.send({ type: "stop" }); } catch {} });
    await new Promise((r) => setTimeout(r, 7000));   // the server finishes their play time / needs first
    const n = await clean();
    console.log(`Deleted ${n} bot accounts and what they left behind.`);
    await mongoose.disconnect(); process.exit(code);
  }
  process.on("SIGINT", () => finish(130));

  const statsNow = () => Promise.all(W.map((c) => new Promise((r) => { c.once("message", (m) => r(m)); c.send({ type: "stats" }); })));
  const pct = (a, p) => (a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0);
  const rows = [];
  for (const target of STAGES) {
    console.log(`\n▶ ${target} bots: connecting…`);
    W.forEach((c, w) => c.send({ type: "target", n: Math.floor(target / nW) + (w < target % nW ? 1 : 0), rate: RATE / nW }));
    // wait until they're in (or 60 s), then let things settle
    for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 1000)); const s = await statsNow(); if (s.reduce((a, x) => a + x.up, 0) >= target) break; }
    await new Promise((r) => setTimeout(r, WARM * 1000)); await statsNow();
    // measure
    const p0 = proc(), b0 = W.map(() => 0), agg = { msgsIn: 0, bytesIn: 0, msgsOut: 0, rtt: [], slow: 0, connectMs: [], fail: 0, drop: 0, errors: {}, up: [] }, cpu0 = await statsNow();
    const rssList = [], load = [];
    for (let s = 0; s < SECS; s++) {
      await new Promise((r) => setTimeout(r, 1000));
      const st = await statsNow(); const p = proc(); if (p) rssList.push(p.rss); load.push(os.loadavg()[0]);
      agg.up.push(st.reduce((a, x) => a + x.up, 0));
      for (const x of st) { agg.msgsIn += x.msgsIn; agg.bytesIn += x.bytesIn; agg.msgsOut += x.msgsOut; agg.rtt.push(...x.rtt); agg.slow += x.slow; agg.fail += x.fail; agg.drop += x.drop; for (const k in x.errors) agg.errors[k] = (agg.errors[k] || 0) + x.errors[k]; }
      if (s === SECS - 1) var cpu1 = st;
    }
    const p1 = proc(), up = Math.round(agg.up.reduce((a, b) => a + b, 0) / Math.max(1, agg.up.length));
    const botCpu = cpu1.reduce((a, x, i) => a + (x.cpu.user + x.cpu.system - cpu0[i].cpu.user - cpu0[i].cpu.system), 0) / 1e6 / SECS * 100;
    const row = {
      bots: target, connected: up, srvCpu: p0 && p1 ? Math.round(((p1.cpu - p0.cpu) / SECS) * 100) : null, srvMem: rssList.length ? Math.round(Math.max(...rssList)) : null,
      p50: pct(agg.rtt, 0.5), p95: pct(agg.rtt, 0.95), max: agg.rtt.length ? Math.max(...agg.rtt) : 0, slow: agg.slow,
      inPerBot: up ? +(agg.msgsIn / SECS / up).toFixed(1) : 0, kbPerBot: up ? +(agg.bytesIn / SECS / up / 1024).toFixed(1) : 0,
      drops: agg.drop, fails: agg.fail, load: +Math.max(...load).toFixed(2), botCpu: Math.round(botCpu), errors: agg.errors,
    };
    rows.push(row);
    console.log(`  connected ${row.connected}/${target} · reply time ${row.p50}ms (95%: ${row.p95}ms, slowest ${row.max}ms) · server CPU ${row.srvCpu ?? "?"}% · memory ${row.srvMem ?? "?"}MB · dropped ${row.drops}`);
    if (Object.keys(row.errors).length) console.log("  problems:", JSON.stringify(row.errors));
    if (row.connected < target * 0.8 || row.p95 > 3000) { console.log("  The server is struggling: stopping here (no bigger stages)."); break; }
  }

  // ---- the report
  const cores = os.cpus().length, mem = Math.round(os.totalmem() / 1024 / 1024);
  const L = [];
  L.push(`Jumpi load test · ${new Date().toISOString()} · this machine: ${cores} CPU cores, ${mem} MB memory`);
  L.push(`Each stage: ${WARM}s to settle, then ${SECS}s measured. Bots walk, run, stand, chat (ready-made lines), emote; ~10% in the Dance Club.`);
  L.push("");
  L.push("bots | in game | reply ms (half / 95% / slowest) | server CPU % | server MB | msgs/s per player | KB/s per player | dropped | failed | load | bots' CPU %");
  for (const r of rows) L.push(`${r.bots} | ${r.connected} | ${r.p50} / ${r.p95} / ${r.max} | ${r.srvCpu ?? "?"} | ${r.srvMem ?? "?"} | ${r.inPerBot} | ${r.kbPerBot} | ${r.drops} | ${r.fails} | ${r.load} | ${r.botCpu}`);
  const errs = rows.flatMap((r) => Object.entries(r.errors).map(([k, v]) => `${r.bots} bots: ${k} ×${v}`));
  if (errs.length) { L.push(""); L.push("problems:"); errs.forEach((e) => L.push("  " + e)); }
  L.push(""); L.push("(server CPU 100% = one full core: the game runs on one core, so near 100% means it is at its limit. The bots run on the same machine and use CPU too: see the last column.)");
  const text = L.join("\n");
  console.log("\n" + text);
  try { writeFileSync(path.join(os.homedir(), "loadtest-result.txt"), text + "\n"); console.log(`\nSaved to ${path.join(os.homedir(), "loadtest-result.txt")}`); } catch {}
  await finish(0);
}
