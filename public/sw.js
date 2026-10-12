/*
  Jumpi Games service worker: keeps the heavy files on the device so the second visit starts almost at once.
  Only pictures, the 3D model, music and fonts (no scripts, no pages, no /api): they come from the device right away
  and are fetched again quietly in the background, so a changed file is there on the next visit.
  The game page, the scripts and everything the server answers always come from the server as before.
*/
const CACHE = "jumpi-assets-v1";
const ASSET = /\.(glb|png|webp|jpe?g|gif|svg|mp3|ogg|wav|woff2?|ttf)$/i;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || r.headers.has("range")) return;   // (music streams in pieces: those go straight to the server)
  const u = new URL(r.url);
  if (u.origin !== self.location.origin || u.search || !ASSET.test(u.pathname) || u.pathname.startsWith("/api/")) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(r);
    const net = fetch(r).then((res) => { if (res.status === 200 && res.type === "basic") c.put(r, res.clone()).catch(() => {}); return res; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  })());
});
