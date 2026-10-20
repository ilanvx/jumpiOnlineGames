import path from "node:path";
import { readFileSync, statSync } from "node:fs";

/*
  Always the newest files, for everyone, without "clear the cache" (Cloudflare may tell browsers to keep scripts and
  pictures for hours, whatever we say).
  Every page we send gets a version on its own files: src / href / poster of local .js .css and pictures become
  "/x.js?v=<the file's time>", and the page's module scripts get an import map that does the same for everything they
  import ("./a.js", "/shared/b.js"…, followed all the way down). A changed file = a new address = fetched again at once;
  an unchanged one keeps its address and stays in the browser (served with a long, "immutable" cache: see versioned()).
*/
export function makeFresh(PUBLIC_DIR) {
  const files = new Map();   // "/club/x.js" -> { t, mtime, v, text? }
  const info = (p) => {
    const now = Date.now(), c = files.get(p);
    if (c && now - c.t < 3000) return c;
    const full = path.join(PUBLIC_DIR, p);
    let n = { t: now, mtime: 0, v: "" };
    if (full.startsWith(PUBLIC_DIR + path.sep)) try { const m = statSync(full).mtimeMs; n = { t: now, mtime: m, v: Math.round(m).toString(36), text: c && c.mtime === m ? c.text : undefined }; } catch {}
    files.set(p, n);
    return n;
  };
  const textOf = (p) => { const i = info(p); if (!i.v) return ""; if (i.text === undefined) { try { i.text = readFileSync(path.join(PUBLIC_DIR, p), "utf8"); } catch { i.text = ""; } } return i.text; };
  const local = (s) => /^\/(?!\/)/.test(s);
  // import "x" · import a from "x" · import { a } from "x" · export … from "x" · import("x")
  const IMPORTS = /(?:\bimport\s*(?:[\w*{}\s,$]+?\s*from\s*)?|\bexport\s*[\w*{}\s,$]+?\s*from\s*|\bimport\s*\(\s*)(["'])([^"'\s]+?\.m?js)\1/g;
  function graph(entries) {
    const seen = new Set(), todo = [...entries];
    while (todo.length) {
      const p = todo.pop(); if (seen.has(p)) continue; seen.add(p);
      for (const m of textOf(p).matchAll(IMPORTS)) { const s = m[2]; if (!local(s) && !/^\.\.?\//.test(s)) continue;
        const abs = new URL(s, "http://x" + p).pathname; if (!seen.has(abs)) todo.push(abs); }
    }
    return seen;
  }
  const ASSET = /\b(src|href|poster)=(["'])(\/(?!\/)[^"'?#\s]+\.(?:m?js|css|png|webp|jpe?g|gif|svg|ico|mp4|webm|json|woff2?))\2/gi;
  const cache = new Map();   // page file -> { key, html }
  return function freshPage(file, html) {
    const hit = cache.get(file); if (hit && hit.src === html && Date.now() - hit.at < 2000) return hit.html;   // (busy pages: work it out at most every 2 s)
    // the scripts the page starts from (their src, and what its inline modules import)
    const entries = [];
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const src = (m[1].match(/\ssrc=["']([^"'?#]+)/i) || [])[1];   // (a classic script's import("…") goes through the import map too)
      if (!src && !/type=["']module["']/i.test(m[1])) continue;
      if (src && local(src)) entries.push(src);
      else for (const i of m[2].matchAll(IMPORTS)) if (local(i[2])) entries.push(i[2]);
    }
    const mods = [...graph(entries)].filter((p) => info(p).v).sort();
    const assets = [...new Set([...html.matchAll(ASSET)].map((m) => m[3]))];
    const key = mods.concat(assets).map((p) => p + info(p).v).join("|");
    const c = cache.get(file); if (c && c.key === key && c.src === html) { c.at = Date.now(); return c.html; }
    let out = html.replace(ASSET, (all, attr, q, p) => { const v = info(p).v; return v ? `${attr}=${q}${p}?v=${v}${q}` : all; });
    if (mods.length) {
      const imports = Object.fromEntries(mods.map((p) => [p, `${p}?v=${info(p).v}`]));
      const old = out.match(/<script type=["']importmap["']>([\s\S]*?)<\/script>/i);
      if (old) {
        let map = {}; try { map = JSON.parse(old[1]); } catch {}
        const mine = { ...(map.imports || {}) };
        for (const [k, v] of Object.entries(mine)) if (typeof v === "string" && local(v) && !v.endsWith("/") && !v.includes("?") && info(v).v) mine[k] = `${v}?v=${info(v).v}`;
        out = out.replace(old[0], `<script type="importmap">${JSON.stringify({ ...map, imports: { ...mine, ...imports } })}</script>`);
      } else {
        const at = out.search(/<script\b[^>]*type=["']module["']/i);
        if (at >= 0) out = out.slice(0, at) + `<script type="importmap">${JSON.stringify({ imports })}</script>\n` + out.slice(at);
      }
    }
    cache.set(file, { key, src: html, html: out, at: Date.now() });
    return out;
  };
}
// a request for a file with ?v=: its address changes whenever the file does, so the browser may keep it for a year
export const versioned = (req) => typeof req.query?.v === "string" && /^[0-9a-z]{4,14}$/.test(req.query.v);
