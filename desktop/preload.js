// window.JumpiAppBridge in the game page and offline.html, like the Android and iPhone apps
const { contextBridge, ipcRenderer } = require("electron");
let version = "";
ipcRenderer.invoke("app:version").then((v) => { version = v; });
contextBridge.exposeInMainWorld("JumpiAppBridge", {
  retry: () => ipcRenderer.send("app:retry"),
  version: () => version,
  openOutside: (u) => ipcRenderer.send("app:open", String(u || "")),
});
