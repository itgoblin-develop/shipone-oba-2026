const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  safeStorage,
  shell,
  Notification,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const {
  aiCall,
  notionTasks,
  connectGoogle,
  calendarEvents,
} = require("./providers.cjs");
const { publicRequest, htmlText } = require("./network.cjs");
const dev = process.argv.includes("--dev");
let win;
let googlePending = false;
if (process.env.SHIPONE_TEST_DATA)
  app.setPath("userData", process.env.SHIPONE_TEST_DATA);
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}
const readJSON = (name, fallback) => {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(app.getPath("userData"), name), "utf8"),
    );
  } catch {
    return fallback;
  }
};
function writeJSON(name, value) {
  const dir = app.getPath("userData");
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, name),
    temp = dest + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(value, null, 2));
  fs.renameSync(temp, dest);
}
function secrets() {
  try {
    return JSON.parse(
      safeStorage.decryptString(
        Buffer.from(readJSON("credentials.json", {}).cipher || "", "base64"),
      ),
    );
  } catch {
    return {};
  }
}
function writeSecrets(value) {
  if (!safeStorage.isEncryptionAvailable())
    throw new Error(
      "OS 보안 저장소를 사용할 수 없습니다. 키를 저장하지 않았습니다.",
    );
  writeJSON("credentials.json", {
    cipher: safeStorage.encryptString(JSON.stringify(value)).toString("base64"),
  });
}
function settings() {
  const s = secrets(),
    c = readJSON("config.json", {}),
    usage = readJSON("usage.json", {
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
  return {
    hasOpenAI: Boolean(s.openaiKey || process.env.OPENAI_API_KEY),
    keySource: s.openaiKey
      ? "stored"
      : process.env.OPENAI_API_KEY
        ? "environment"
        : "none",
    hasNotion: Boolean(s.notionToken),
    hasGoogle: Boolean(s.googleTokens),
    model: c.model || process.env.OPENAI_MODEL || "gpt-6.1-sol",
    notionSource: c.notionSource || "",
    googleClientId: c.googleClientId || "",
    secureStorage: safeStorage.isEncryptionAvailable(),
    ...usage,
  };
}
function checkSender(event) {
  const url = event.senderFrame?.url;
  const good = dev
    ? url?.startsWith("http://127.0.0.1:4173/")
    : url?.split("#")[0] ===
      pathToFileURL(path.join(__dirname, "../dist/index.html")).href;
  if (!good || event.sender !== win?.webContents)
    throw new Error("허용되지 않은 요청입니다.");
}
function handler(name, fn) {
  ipcMain.handle("shipone:" + name, async (event, ...args) => {
    checkSender(event);
    try {
      return await fn(...args);
    } catch (e) {
      throw new Error(String(e.message || e).slice(0, 500));
    }
  });
}
const smallString = (v, max = 10000) => {
  if (typeof v !== "string" || v.length > max)
    throw new Error("입력 형식 또는 크기를 확인해주세요.");
  return v;
};
async function runAI(kind, input) {
  if (JSON.stringify(input).length > 80000)
    throw new Error("요청 내용이 너무 큽니다.");
  const result = await aiCall(
    secrets(),
    settings().model,
    kind,
    input,
    (usage) => {
      const u = readJSON("usage.json", {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
      });
      u.requests++;
      u.inputTokens += usage.input_tokens || 0;
      u.outputTokens += usage.output_tokens || 0;
      writeJSON("usage.json", u);
    },
  );
  return result.result;
}
app.whenReady().then(() => {
  handler("load", () => readJSON("workspace.json", null));
  handler("save", (state) => {
    if (
      !state ||
      state.version !== 1 ||
      !Array.isArray(state.tasks) ||
      !Array.isArray(state.events) ||
      JSON.stringify(state).length > 3000000
    )
      throw new Error("저장 데이터 형식이 올바르지 않습니다.");
    writeJSON("workspace.json", state);
  });
  handler("settings", settings);
  handler("configure", (input) => {
    if (!input || typeof input !== "object")
      throw new Error("설정이 올바르지 않습니다.");
    const s = secrets(),
      c = readJSON("config.json", {});
    for (const key of ["openaiKey", "notionToken", "googleClientSecret"]) {
      if (input[key] !== undefined && input[key] !== "")
        s[key] = smallString(input[key], 1000).trim();
    }
    for (const key of ["model", "notionSource", "googleClientId"])
      if (input[key] !== undefined)
        c[key] = smallString(input[key], 300).trim();
    if (input.disconnect === "google") delete s.googleTokens;
    if (input.disconnect === "notion") delete s.notionToken;
    if (input.disconnect === "openai") delete s.openaiKey;
    writeSecrets(s);
    writeJSON("config.json", c);
    return settings();
  });
  handler("plan", async (input) => {
    const { validatePlan } = await import("../shared/core.mjs");
    return validatePlan(
      await runAI("plan", input),
      input.feasibleTasks,
      input.maxMinutes,
    );
  });
  handler("replan", (input) => runAI("replan", input));
  handler("notion", () => notionTasks(secrets(), settings().notionSource));
  handler("googleConnect", async () => {
    if (googlePending)
      throw new Error(
        "Google 연결이 이미 진행 중입니다. 브라우저를 확인해주세요.",
      );
    googlePending = true;
    try {
      const tokens = await connectGoogle(
        { ...settings(), googleClientSecret: secrets().googleClientSecret },
        (url) => shell.openExternal(url),
      );
      const s = secrets();
      s.googleTokens = tokens;
      writeSecrets(s);
    } finally {
      googlePending = false;
    }
  });
  handler("calendar", () =>
    calendarEvents(secrets(), settings(), (tokens) => {
      const s = secrets();
      s.googleTokens = tokens;
      writeSecrets(s);
    }),
  );
  handler("readFile", async () => {
    const r = await dialog.showOpenDialog(win, {
      title: "검증할 텍스트 결과물 선택",
      properties: ["openFile"],
      filters: [
        {
          name: "텍스트 문서",
          extensions: ["txt", "md", "html", "json", "csv"],
        },
      ],
    });
    if (r.canceled) return null;
    const p = r.filePaths[0];
    if (fs.statSync(p).size > 1024 * 1024)
      throw new Error("1MB 이하 텍스트 파일을 선택해주세요.");
    const bytes = fs.readFileSync(p);
    const raw = bytes.toString("utf8");
    return {
      kind: "file",
      label: path.basename(p),
      text: /\.html?$/i.test(p) ? htmlText(raw) : raw,
      hash: crypto.createHash("sha256").update(bytes).digest("hex"),
      checkedAt: new Date().toISOString(),
    };
  });
  handler("importCalendar", async () => {
    const r = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "Calendar JSON", extensions: ["json"] }],
    });
    if (r.canceled) return null;
    if (fs.statSync(r.filePaths[0]).size > 1024 * 1024)
      throw new Error("파일이 너무 큽니다.");
    const events = JSON.parse(fs.readFileSync(r.filePaths[0], "utf8"));
    if (
      !Array.isArray(events) ||
      events.length > 250 ||
      events.some(
        (e) =>
          !e.title ||
          !Number.isFinite(+new Date(e.start)) ||
          !Number.isFinite(+new Date(e.end)) ||
          new Date(e.end) <= new Date(e.start),
      )
    )
      throw new Error("일정 배열에 title, start, end가 필요합니다.");
    return events.map((e) => ({
      id: crypto.randomUUID(),
      title: String(e.title).slice(0, 300),
      start: e.start,
      end: e.end,
      source: "import",
    }));
  });
  handler("verifyUrl", async (raw) => {
    const result = await publicRequest(smallString(raw, 2000));
    return {
      kind: "url",
      label: result.url,
      text: htmlText(result.body),
      status: result.status,
      hash: crypto.createHash("sha256").update(result.body).digest("hex"),
      checkedAt: new Date().toISOString(),
    };
  });
  handler("exportReceipt", async (text) => {
    const result = await dialog.showSaveDialog(win, {
      defaultPath: "ShipOne-receipt.md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (result.canceled) return false;
    fs.writeFileSync(result.filePath, smallString(text, 100000));
    return true;
  });
  handler("notify", (title, body) => {
    if (Notification.isSupported())
      new Notification({
        title: smallString(title, 100),
        body: smallString(body, 500),
      }).show();
  });
  handler("openExternal", (url) => {
    const u = new URL(smallString(url, 2000));
    if (!["https:", "http:"].includes(u.protocol))
      throw new Error("웹 주소만 열 수 있습니다.");
    return shell.openExternal(u.href);
  });
  win = new BrowserWindow({
    width: 1420,
    height: 950,
    minWidth: 800,
    minHeight: 640,
    title: "ShipOne",
    backgroundColor: "#f4f5f0",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e, url) => {
    if (url !== win.webContents.getURL()) e.preventDefault();
  });
  win.webContents.session.setPermissionRequestHandler((_wc, _perm, cb) =>
    cb(false),
  );
  if (dev) win.loadURL("http://127.0.0.1:4173/");
  else win.loadFile(path.join(__dirname, "../dist/index.html"));
});
app.on("window-all-closed", () => app.quit());
