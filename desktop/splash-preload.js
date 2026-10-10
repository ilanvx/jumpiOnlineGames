const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("splash", {
  onState: (fn) => ipcRenderer.on("splash:state", (e, s) => fn(s)),
  close: () => ipcRenderer.send("splash:close"),
});
