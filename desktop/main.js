/*
  Jumpi Games for Windows: the game (https://jumpigames.com/play) in its own window.
  - a Jumpi splash window first (the banner + a loading bar); it also shows the update progress
  - updates: on every start it checks GitHub Releases (electron-updater). A new version is downloaded with a
    progress bar in the splash, installed silently and the game opens again by itself. While playing it checks
    again every few hours and installs the update the next time the game is closed.
  - the page knows it's in the app: "JumpiApp/<version>" in the user agent (body.app: no paid store, no Discord)
  - only /play stays inside the app; every other page or site opens in the normal browser
  - no connection: the Jumpi "no internet" page (offline.html) with TRY AGAIN
*/
const { app, BrowserWindow, ipcMain, shell, Menu, session } = require("electron");
const path = require("path");

const HOST = "jumpigames.com";
const START = "https://jumpigames.com/play";
const BLUE = "#1f8fff";
const UPDATE_WAIT_MS = 7000;          // how long the splash waits for "is there an update?" before opening the game
const UPDATE_EVERY_MS = 3 * 3600e3;   // while playing

let splash = null, game = null, updating = false, started = false;

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => { const w = game || splash; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
Menu.setApplicationMenu(null);

function say(state) { if (splash && !splash.isDestroyed()) splash.webContents.send("splash:state", state); }

function makeSplash() {
  splash = new BrowserWindow({
    width: 900, height: 480, frame: false, resizable: false, transparent: true, show: false, center: true,
    backgroundColor: "#00000000", skipTaskbar: false, title: "Jumpi Games", icon: path.join(__dirname, "assets", "head.png"),
    webPreferences: { preload: path.join(__dirname, "splash-preload.js"), contextIsolation: true, sandbox: true },
  });
  splash.loadFile(path.join(__dirname, "splash.html"), { query: { v: app.getVersion() } });
  splash.once("ready-to-show", () => splash.show());
  splash.on("closed", () => { splash = null; if (!game && !updating) app.quit(); });
}

// ---------- updates ----------
function checkUpdates() {
  if (!app.isPackaged) return startGame();
  let autoUpdater;
  try { ({ autoUpdater } = require("electron-updater")); } catch { return startGame(); }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  const timer = setTimeout(() => { if (!updating) startGame(); }, UPDATE_WAIT_MS);
  autoUpdater.on("update-available", (info) => {
    if (started) return;   // found while playing: it downloads quietly and installs when the game is closed
    updating = true; clearTimeout(timer);
    say({ mode: "update", title: "Updating Jumpi Games", text: `Getting version ${info.version} ready…`, pct: 0 });
  });
  autoUpdater.on("download-progress", (p) => {
    if (!updating) return;
    const mb = (n) => (n / 1048576).toFixed(1);
    say({ mode: "update", pct: p.percent, text: `Downloading the new version · ${mb(p.transferred)} of ${mb(p.total)} MB` });
  });
  autoUpdater.on("update-downloaded", () => {
    if (!updating) return;
    say({ mode: "update", pct: 100, text: "Installing the update… Jumpi will open again in a moment." });
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 1200);
  });
  autoUpdater.on("update-not-available", () => { clearTimeout(timer); startGame(); });
  autoUpdater.on("error", () => { clearTimeout(timer); if (updating) { updating = false; } startGame(); });
  autoUpdater.checkForUpdates().catch(() => { clearTimeout(timer); startGame(); });
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), UPDATE_EVERY_MS).unref?.();
}

// ---------- the game ----------
function ours(u) {
  try { const x = new URL(u); return x.protocol === "https:" && (x.hostname === HOST || x.hostname === "www." + HOST); } catch { return false; }
}
function isGame(u) {
  try { const x = new URL(u); return x.protocol === "file:" || (ours(u) && (x.pathname === "/play" || x.pathname === "/play/")); } catch { return false; }
}
function openOutside(u) {
  try { const x = new URL(u); if (x.protocol === "https:" || x.protocol === "http:" || x.protocol === "mailto:") shell.openExternal(x.toString()); } catch {}
}

function startGame() {
  if (started) return; started = true;
  say({ mode: "load", text: "Loading the Plaza…" });
  game = new BrowserWindow({
    width: 1280, height: 760, minWidth: 900, minHeight: 560, show: false, backgroundColor: BLUE, title: "Jumpi Games",
    icon: path.join(__dirname, "assets", "head.png"), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  const wc = game.webContents;
  wc.setUserAgent(`${wc.getUserAgent()} JumpiApp/${app.getVersion()} JumpiDesktop/${app.getVersion()}`);

  wc.on("will-navigate", (e, u) => { if (!isGame(u)) { e.preventDefault(); openOutside(u); } });
  wc.setWindowOpenHandler(({ url }) => { openOutside(url); return { action: "deny" }; });
  wc.on("did-fail-load", (e, code, desc, url, isMain) => { if (isMain && code !== -3) game.loadFile(path.join(__dirname, "offline.html")); });
  wc.on("did-finish-load", () => {
    say({ mode: "load", pct: 100, text: "Let's play!" });
    setTimeout(() => {
      if (!game) return;
      game.maximize(); game.show(); game.focus();
      if (splash) splash.close();
    }, 500);
  });
  // F11: full screen, Ctrl+R / F5: reload
  wc.on("before-input-event", (e, i) => {
    if (i.type !== "keyDown") return;
    if (i.key === "F11") { game.setFullScreen(!game.isFullScreen()); e.preventDefault(); }
    else if (i.key === "F5" || (i.control && i.key.toLowerCase() === "r")) { wc.reloadIgnoringCache(); e.preventDefault(); }
  });
  game.on("closed", () => { game = null; });
  wc.loadURL(START, { extraHeaders: "Cache-Control: no-cache\n" });
}

ipcMain.on("app:retry", () => { if (game) game.webContents.loadURL(START); });
ipcMain.on("app:open", (e, u) => { if (game && e.sender === game.webContents && ours(e.sender.getURL())) openOutside(String(u || "")); });
ipcMain.on("splash:close", () => app.quit());
ipcMain.handle("app:version", () => app.getVersion());

app.whenReady().then(() => {
  // no camera / mic / location etc. for the page
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(perm === "fullscreen" || perm === "clipboard-sanitized-write"));
  makeSplash();
  splash.webContents.once("did-finish-load", () => { say({ mode: "load", text: "Checking for updates…" }); checkUpdates(); });
});
app.on("window-all-closed", () => { if (!updating) app.quit(); });
