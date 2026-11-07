import { aiCall } from "../shared/openai.mjs";
import { validatePlan } from "../shared/core.mjs";
const buckets = new Map();
let total = 0;
const origins = new Set([
  "https://itgoblin-develop.github.io",
  "https://shipone-oba-2026-itgoblin.creamclover.chatgpt.site",
  "http://127.0.0.1:4173",
]);
export default {
  async fetch(request, env) {
    const url = new URL(request.url),
      origin = request.headers.get("Origin");
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    if (origin && origins.has(origin))
      Object.assign(headers, {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    if (origin && !origins.has(origin))
      return json({ error: "허용되지 않은 출처입니다." }, 403);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (url.pathname === "/api/status")
      return json({
        hasOpenAI: !!env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL || "gpt-6.1-sol",
      });
    if (!["/api/plan", "/api/replan"].includes(url.pathname))
      return new Response(null, {
        status: 302,
        headers: {
          Location: "https://itgoblin-develop.github.io/shipone-oba-2026/",
        },
      });
    if (request.method !== "POST")
      return json({ error: "POST 요청이 필요합니다." }, 405);
    if (!env.OPENAI_API_KEY)
      return json(
        {
          error:
            "AI 서버 연결을 준비 중입니다. 시간·우선순위 추천이나 샘플 체험을 이용해주세요.",
        },
        503,
      );
    const ip = request.headers.get("cf-connecting-ip") || "local";
    const now = Date.now();
    if (buckets.size > 10000)
      return json(
        { error: "체험 요청이 많습니다. 잠시 후 다시 시도해주세요." },
        429,
      );
    const b = buckets.get(ip) || { count: 0, at: now, busy: false };
    if (now - b.at > 3600000) {
      b.count = 0;
      b.at = now;
    }
    if (b.busy || b.count >= 20 || total >= 1000)
      return json(
        {
          error:
            "공개 AI 체험 한도에 도달했습니다. 잠시 후 다시 시도하거나 API 없는 추천을 이용해주세요.",
        },
        429,
      );
    b.busy = true;
    buckets.set(ip, b);
    try {
      const reader = request.body?.getReader();
      let size = 0;
      const chunks = [];
      if (reader)
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 48000) {
            await reader.cancel();
            return json(
              { error: "작업은 20개 이내, 짧은 설명으로 입력해주세요." },
              413,
            );
          }
          chunks.push(value);
        }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const raw = new TextDecoder().decode(bytes);
      if (raw.length > 16000)
        return json(
          { error: "작업은 20개 이내, 짧은 설명으로 입력해주세요." },
          413,
        );
      const input = JSON.parse(raw),
        kind = url.pathname.slice(5);
      if (
        kind === "plan" &&
        (!Array.isArray(input.feasibleTasks) ||
          input.feasibleTasks.length < 1 ||
          input.feasibleTasks.length > 20 ||
          !Number.isFinite(input.maxMinutes) ||
          input.maxMinutes < 1 ||
          input.maxMinutes > 480)
      )
        return json({ error: "추천할 작업과 시간을 확인해주세요." }, 400);
      if (
        kind === "replan" &&
        (typeof input.blocker !== "string" ||
          input.blocker.length > 1500 ||
          !input.blocker.trim())
      )
        return json({ error: "질문을 1~1500자로 입력해주세요." }, 400);
      b.count++;
      b.busy = true;
      buckets.set(ip, b);
      total++;
      const response = await aiCall(
        { openaiKey: env.OPENAI_API_KEY },
        env.OPENAI_MODEL || "gpt-6.1-sol",
        kind,
        input,
      );
      if (kind === "plan")
        validatePlan(response.result, input.feasibleTasks, input.maxMinutes);
      return json(response);
    } catch (e) {
      return json({ error: String(e.message || e).slice(0, 350) }, 502);
    } finally {
      b.busy = false;
    }
  },
};
