import crypto from "crypto";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";
import { LookPic } from "../models/LookPic.js";

/*
  Pictures of Jumpis in their clothes, for the Club website (the online list, the chat, my circle at the top).
  The server makes them itself from the saved look, so a picture can only ever show a real Jumpi in real game clothes:
  a hidden browser (Playwright + Chromium, on this same computer) opens the game page with ?portraits, which draws a
  Jumpi exactly like the game does (index.html: clubPortraitURL) and hands back the picture.
  - One picture per look (models/LookPic.js), shared by everyone who wears the same things; made once, then kept.
  - One picture at a time; the browser closes by itself after 10 quiet minutes (it takes memory).
  - No Playwright / Chromium on the server: no pictures (the Club shows a face in the Jumpi's colour instead).
    It lives outside the app (so "npm ci" on an update never removes it). To turn it on, once on the server:
      mkdir -p ~/jumpi-tools && cd ~/jumpi-tools && npm i playwright@1.56.0 && sudo npx playwright install-deps chromium && npx playwright install chromium
*/
const SLOTS = ["color", "eyes", "hair", "shirt", "pants", "glasses", "hat", "neck", "beard"];
const int = (v, d) => (Number.isInteger(v) && v >= -1 && v < 10000 ? v : d);
export const cleanLook = (look = {}) => Object.fromEntries(SLOTS.map((k) => [k, int(look[k], k === "color" || k === "eyes" ? 0 : -1)]));
export const lookKey = (look) => crypto.createHash("sha1").update("v1:" + JSON.stringify(cleanLook(look))).digest("hex").slice(0, 16);

const PORT = Number(process.env.PORT) || 3000;
const IDLE_MS = 10 * 60_000;
let browser = null, page = null, opening = null, idleT = null, off = false, failedAt = 0;
let chain = Promise.resolve();
const mem = new Map();   // key -> png (the newest few hundred)
const remember = (k, b) => { mem.set(k, b); if (mem.size > 400) mem.delete(mem.keys().next().value); };

async function open() {
  if (page) return page;
  if (opening) return opening;
  opening = (async () => {
    let chromium;
    const where = [process.env.PORTRAITS_PLAYWRIGHT, path.join(os.homedir(), "jumpi-tools/node_modules/playwright/index.mjs"), "playwright"].filter(Boolean);
    for (const w of where) { try { ({ chromium } = await import(w.startsWith("/") ? pathToFileURL(w).href : w)); break; } catch {} }
    if (!chromium) { off = true; console.log("[portraits] Playwright isn't installed: the Club shows faces instead of pictures"); throw new Error("off"); }
    // our own page from this computer only; the sandbox needs things a plain server user often doesn't have
    browser = await chromium.launch({ chromiumSandbox: false, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--mute-audio"] });
    browser.on("disconnected", () => { browser = page = null; });
    const p = await browser.newPage({ viewport: { width: 320, height: 320 } });
    // no game loop: the page only draws when it's asked for a picture
    await p.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await p.goto(`http://127.0.0.1:${PORT}/play?game&portraits`, { waitUntil: "load", timeout: 90_000 });
    await p.waitForFunction(() => window.__portraitReady === true, null, { timeout: 90_000 });
    page = p;
    return p;
  })();
  try { return await opening; }
  catch (err) { await close(); failedAt = Date.now(); if (!off) console.error("[portraits] couldn't open the drawing page:", err.message); throw err; }
  finally { opening = null; }
}
async function close() { const b = browser; browser = page = null; if (b) await b.close().catch(() => {}); }
const idle = () => { clearTimeout(idleT); idleT = setTimeout(close, IDLE_MS); idleT.unref?.(); };

async function draw(look) {
  const p = await open();
  const url = await Promise.race([p.evaluate((l) => window.__portrait(l), look), new Promise((_, no) => setTimeout(() => no(new Error("too slow")), 20_000))]);
  idle();
  const m = /^data:image\/png;base64,(.+)$/.exec(String(url || ""));
  if (!m) throw new Error("no picture");
  return Buffer.from(m[1], "base64");
}

// the picture for a look: from memory, from the database, or drawn now (one at a time). null = can't make pictures now.
export async function portraitFor(look, mayDraw = () => true) {
  const clean = cleanLook(look), key = lookKey(clean);
  if (mem.has(key)) return { key, png: mem.get(key) };
  const saved = await LookPic.findOne({ key }).lean();
  if (saved) { const png = Buffer.from(saved.png.buffer || saved.png); remember(key, png); return { key, png }; }
  if (off || Date.now() - failedAt < 60_000 || !mayDraw()) return null;
  const job = chain.then(async () => {
    if (mem.has(key)) return mem.get(key);
    const png = await draw(clean);
    remember(key, png);
    await LookPic.updateOne({ key }, { $set: { png, at: new Date() } }, { upsert: true }).catch(() => {});
    return png;
  });
  chain = job.catch(() => {});
  try { return { key, png: await job }; }
  catch (err) { if (!off) { console.error("[portraits]", err.message); failedAt = Date.now(); await close(); } return null; }
}
