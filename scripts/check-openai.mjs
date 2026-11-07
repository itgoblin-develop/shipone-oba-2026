import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY가 .env에 아직 없습니다.");
  process.exit(2);
}
const require = createRequire(import.meta.url);
const { aiCall } = require("../desktop/providers.cjs");
const { validatePlan } = await import("../shared/core.mjs");
const tasks = [
  {
    id: "live-check",
    title: "ShipOne 시연 안내 작성",
    minutes: 15,
    priority: 3,
    energy: "low",
  },
];
const start = new Date(),
  end = new Date(+start + 30 * 60000);
try {
  const response = await aiCall(
    {},
    process.env.OPENAI_MODEL || "gpt-6.1-sol",
    "plan",
    {
      feasibleTasks: tasks,
      slots: [
        { start: start.toISOString(), end: end.toISOString(), minutes: 30 },
      ],
      maxMinutes: 30,
      energy: "medium",
      history: [],
    },
  );
  const plan = validatePlan(response.result, tasks, 30);
  console.log(
    JSON.stringify(
      {
        ok: true,
        source: plan.source,
        taskId: plan.taskId,
        minutes: plan.minutes,
        reason: plan.reason,
        criteria: plan.criteria,
        usage: response.usage,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(String(error.message));
  process.exitCode = 1;
}
