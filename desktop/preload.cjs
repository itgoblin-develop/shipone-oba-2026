const { contextBridge, ipcRenderer } = require("electron");
const methods = [
  "load",
  "save",
  "settings",
  "configure",
  "plan",
  "replan",
  "notion",
  "googleConnect",
  "calendar",
  "readFile",
  "importCalendar",
  "verifyUrl",
  "exportReceipt",
  "notify",
  "openExternal",
];
contextBridge.exposeInMainWorld(
  "shipone",
  Object.fromEntries(
    methods.map((name) => [
      name,
      async (...args) => {
        try {
          return await ipcRenderer.invoke("shipone:" + name, ...args);
        } catch (error) {
          const message = String(error.message || error).replace(
            /^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/,
            "",
          );
          throw new Error(message);
        }
      },
    ]),
  ),
);
