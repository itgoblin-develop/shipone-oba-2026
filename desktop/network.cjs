const dns = require("node:dns/promises");
const https = require("node:https");
const http = require("node:http");
const net = require("node:net");
function isPublicAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  // IPv6 is deliberately not fetched: avoid mapped-address and local-network ambiguity.
  return false;
}
async function publicRequest(raw, redirects = 0) {
  const u = new URL(raw);
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    (u.port && !["80", "443"].includes(u.port))
  )
    throw new Error("공개 HTTP(S) 주소와 기본 포트만 검사할 수 있습니다.");
  const addresses = await dns.lookup(u.hostname, { all: true });
  const ips = addresses.filter((a) => a.family === 4);
  if (!ips.length || ips.some((a) => !isPublicAddress(a.address)))
    throw new Error(
      "로컬·사설 네트워크 주소는 검사하지 않습니다. 공개 URL을 입력해주세요.",
    );
  const pinned = ips[0];
  return new Promise((resolve, reject) => {
    const req = (u.protocol === "https:" ? https : http).get(
      u,
      {
        lookup: (_host, opts, cb) =>
          opts?.all ? cb(null, [pinned]) : cb(null, pinned.address, 4),
        headers: {
          "User-Agent": "ShipOne/0.1 verification",
          Accept: "text/html,text/plain,application/json",
        },
        timeout: 12000,
      },
      (res) => {
        if (
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          res.resume();
          if (redirects >= 4) {
            reject(new Error("리디렉션이 너무 많습니다."));
            return;
          }
          publicRequest(
            new URL(res.headers.location, u).href,
            redirects + 1,
          ).then(resolve, reject);
          return;
        }
        const ct = res.headers["content-type"] || "";
        if (!/text\/|application\/json/.test(ct)) {
          res.resume();
          reject(new Error("HTML·텍스트·JSON 페이지를 입력해주세요."));
          return;
        }
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > 1024 * 1024) {
            req.destroy(
              new Error("검사 가능한 페이지 크기(1MB)를 넘었습니다."),
            );
            return;
          }
          chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () =>
          resolve({
            body: Buffer.concat(chunks).toString("utf8"),
            status: res.statusCode,
            url: u.href,
          }),
        );
      },
    );
    req.on("timeout", () =>
      req.destroy(new Error("페이지 응답 시간이 초과되었습니다.")),
    );
    req.on("error", reject);
  });
}
function htmlText(raw) {
  return raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) =>
      Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : "�",
    )
    .replace(/\s+/g, " ")
    .trim();
}
module.exports = { isPublicAddress, publicRequest, htmlText };
