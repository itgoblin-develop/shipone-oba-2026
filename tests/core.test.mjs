import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  freeSlots,
  rankTasks,
  evaluate,
  signature,
  canShip,
  validatePlan,
  receiptMarkdown,
} from "../shared/core.mjs";
const require = createRequire(import.meta.url);
const { isPublicAddress, htmlText } = require("../desktop/network.cjs");
const { aiCall, notionTasks } = require("../desktop/providers.cjs");
const at = (m) => new Date(Date.UTC(2026, 10, 7, 4, m)).toISOString();
test("a duplicate successful check cannot replace a missing criterion", () => {
  const criteria = [
    { id: "a", label: "a", kind: "contains", expected: "A" },
    { id: "b", label: "b", kind: "contains", expected: "B" },
  ];
  const check = evaluate([criteria[0]], { kind: "text", text: "A" })[0];
  assert.equal(
    canShip({
      criteria,
      checks: [check, check],
      verifiedSignature: signature(criteria),
    }),
    false,
  );
  assert.equal(
    canShip({ criteria: [], checks: [], verifiedSignature: signature([]) }),
    false,
  );
});
test("malformed numeric HTML entities do not crash verification", () => {
  assert.equal(htmlText("<p>A &#999999999; B</p>"), "A � B");
});
test("overlapping calendar meetings merge; free time is contiguous not total", () => {
  const slots = freeSlots(at(0), at(180), [
    { start: at(20), end: at(60) },
    { start: at(40), end: at(80) },
    { start: at(100), end: at(120) },
  ]);
  assert.deepEqual(
    slots.map((s) => s.minutes),
    [20, 20, 60],
  );
  const tasks = [
    { id: "big", minutes: 90, priority: 3, energy: "low" },
    { id: "fit", minutes: 45, priority: 2, energy: "medium" },
  ];
  assert.equal(
    rankTasks(
      tasks,
      [
        { start: at(20), end: at(80) },
        { start: at(100), end: at(120) },
      ],
      at(0),
      at(180),
      120,
    )[0].task.id,
    "fit",
  );
});
test("invalid or inverted schedule and full-day event produce no availability", () => {
  assert.deepEqual(freeSlots(at(60), at(0), []), []);
  assert.deepEqual(
    freeSlots(at(0), at(60), [{ start: at(-60), end: at(120) }]),
    [],
  );
  assert.deepEqual(freeSlots("bad", at(60), []), []);
});
test("available minutes caps recommended task even if calendar has a larger gap", () => {
  assert.equal(
    rankTasks(
      [{ id: "x", minutes: 40, priority: 3, energy: "low" }],
      [],
      at(0),
      at(120),
      30,
    ).length,
    0,
  );
});
test("literal evidence checks fail missing content and pass after correction", () => {
  const criteria = [
    { id: "a", label: "Name", kind: "contains", expected: "ShipOne" },
    { id: "b", label: "Apply", kind: "contains", expected: "사전 신청" },
  ];
  const broken = evaluate(criteria, { kind: "text", text: "ShipOne 소개" });
  assert.deepEqual(
    broken.map((c) => c.status),
    ["pass", "fail"],
  );
  const good = evaluate(criteria, { kind: "text", text: "ShipOne 사전 신청" });
  const mission = {
    criteria,
    checks: good,
    verifiedSignature: signature(criteria),
  };
  assert.equal(canShip(mission), true);
  mission.criteria = [
    ...criteria,
    { id: "c", label: "More", kind: "minLength", expected: "80" },
  ];
  assert.equal(canShip(mission), false);
});
test("changed criteria invalidate previous successful checks even with equal count", () => {
  const criteria = [{ id: "x", label: "A", kind: "contains", expected: "A" }];
  const m = {
    criteria,
    checks: evaluate(criteria, { kind: "text", text: "A" }),
    verifiedSignature: signature(criteria),
  };
  m.criteria = [{ ...criteria[0], expected: "B" }];
  assert.equal(canShip(m), false);
});
test("manual is never auto pass and missing HTTP evidence remains unknown", () => {
  const c = [
    { id: "a", label: "tested", kind: "manual", expected: "" },
    { id: "b", label: "reachable", kind: "http", expected: "" },
  ];
  assert.deepEqual(
    evaluate(c, { kind: "text", text: "tested" }, { a: true }).map(
      (v) => v.status,
    ),
    ["manual", "unknown"],
  );
  assert.equal(
    evaluate([c[1]], { kind: "url", status: 503, text: "" })[0].status,
    "fail",
  );
});
test("invalid or invented AI task IDs and excessive durations are rejected", () => {
  const t = [{ id: "a" }];
  const base = {
    taskId: "a",
    reason: "Fits",
    minutes: 15,
    steps: ["work"],
    criteria: [{ label: "x", kind: "manual", expected: "" }],
  };
  assert.equal(validatePlan(base, t, 30), base);
  assert.throws(() => validatePlan({ ...base, taskId: "invented" }, t, 30));
  assert.throws(() => validatePlan({ ...base, minutes: 45 }, t, 30));
  assert.throws(() =>
    validatePlan(
      { ...base, criteria: [{ label: "x", kind: "contains", expected: "" }] },
      t,
      30,
    ),
  );
});
test("network targets exclude private ranges and IPv6 ambiguity", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.2",
    "192.168.0.1",
    "172.16.0.2",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::ffff:127.0.0.1",
  ])
    assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress("93.184.216.34"), true);
});
test("HTML checks ignore scripts and styles; no source execution", () => {
  assert.equal(
    htmlText(
      "<style>secret</style><script>pass()</script><p>ShipOne &amp; proof</p>",
    ),
    "ShipOne & proof",
  );
});
test("receipt states manual status and sample origin explicitly", () => {
  const s = receiptMarkdown({
    title: "Task",
    completedAt: "now",
    mode: "샘플 체험",
    planSource: "fixture",
    minutes: 10,
    actualMinutes: 5,
    checks: [{ status: "manual", label: "Tested", detail: "User confirmed" }],
  });
  assert.match(s, /샘플 체험/);
  assert.match(s, /\[manual\]/);
  assert.match(s, /자동 검사와 구분/);
});
test("provider reports missing credentials rather than fabricating results", async () => {
  await assert.rejects(() => notionTasks({}, "anything"), /토큰/);
  if (!process.env.OPENAI_API_KEY)
    await assert.rejects(
      () => aiCall({}, "gpt-4.1-mini", "plan", {}),
      /API 키/,
    );
});
test("OpenAI adapter sends strict schema and captures real usage shape", async () => {
  const old = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, opts) => {
    sent = JSON.parse(opts.body);
    return {
      ok: true,
      json: async () => ({
        status: "completed",
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  taskId: "a",
                  reason: "reason",
                  minutes: 15,
                  steps: ["work"],
                  criteria: [{ label: "check", kind: "manual", expected: "" }],
                }),
              },
            ],
          },
        ],
        usage: { input_tokens: 100, output_tokens: 40 },
      }),
    };
  };
  try {
    const r = await aiCall(
      { openaiKey: "test-not-a-real-key" },
      "gpt-4.1-mini",
      "plan",
      { feasibleTasks: [{ id: "a" }] },
    );
    assert.equal(sent.store, false);
    assert.equal(sent.text.format.strict, true);
    assert.equal(r.usage.output_tokens, 40);
    assert.equal(r.result.taskId, "a");
  } finally {
    globalThis.fetch = old;
  }
});
