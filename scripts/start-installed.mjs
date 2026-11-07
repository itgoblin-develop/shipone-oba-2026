import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn } from "node:child_process";
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);
if (process.platform !== "win32" || !process.env.LOCALAPPDATA)
  throw Error("이 실행 도우미는 Windows 설치 앱용입니다.");
const exe = path.join(
  process.env.LOCALAPPDATA,
  "Programs",
  "ShipOne",
  "ShipOne.exe",
);
if (!existsSync(exe)) throw Error("ShipOne을 먼저 설치해주세요.");
const child = spawn(exe, [], {
  env: process.env,
  detached: true,
  stdio: "ignore",
});
child.on("error", () => console.error("ShipOne 실행에 실패했습니다."));
child.unref();
console.log(
  "ShipOne 실행 요청 완료. 이미 열려 있다면 종료 후 다시 실행해야 .env 변경이 반영됩니다.",
);
