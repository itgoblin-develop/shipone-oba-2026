export const uid = () => globalThis.crypto.randomUUID();
export function freeSlots(start, end, events) {
  const a = +new Date(start),
    b = +new Date(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return [];
  const busy = events
    .map((e) => [+new Date(e.start), +new Date(e.end)])
    .filter(
      ([s, e]) =>
        Number.isFinite(s) && Number.isFinite(e) && e > s && e > a && s < b,
    )
    .sort((x, y) => x[0] - y[0]);
  const slots = [];
  let cursor = a;
  for (const [s, e] of busy) {
    if (s > cursor)
      slots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(Math.min(s, b)).toISOString(),
        minutes: Math.floor((Math.min(s, b) - cursor) / 60000),
      });
    cursor = Math.max(cursor, e);
    if (cursor >= b) break;
  }
  if (cursor < b)
    slots.push({
      start: new Date(cursor).toISOString(),
      end: new Date(b).toISOString(),
      minutes: Math.floor((b - cursor) / 60000),
    });
  return slots.filter((s) => s.minutes > 0);
}
export function rankTasks(
  tasks,
  events,
  start,
  end,
  available,
  energy = "medium",
) {
  const slots = freeSlots(start, end, events);
  const largest = Math.min(
    Number(available) || 0,
    ...[Math.max(0, ...slots.map((s) => s.minutes))],
  );
  const rank = { low: 0, medium: 1, high: 2 };
  return tasks
    .filter((t) => !t.done && t.minutes > 0 && t.minutes <= largest)
    .map((t) => ({
      task: t,
      score:
        t.priority * 20 +
        (t.due && new Date(t.due) <= new Date(end) ? 30 : 0) +
        (rank[t.energy] <= rank[energy] ? 12 : -15) -
        t.minutes / 20,
      slot: slots.find((s) => s.minutes >= t.minutes),
    }))
    .sort((a, b) => b.score - a.score);
}
export function rulePlan(task, energy) {
  return {
    taskId: task.id,
    reason: `확보한 시간 안에 ${task.minutes}분 작업을 끝낼 수 있어요. ${task.priority >= 3 ? "우선순위가 높은 일부터 마무리해요." : "작은 완료를 먼저 만들어봐요."}${energy === "low" ? " 지금은 범위를 늘리지 않는 편이 좋아요." : ""}`,
    minutes: task.minutes,
    steps: [
      "완료 조건을 확인하고 필요한 자료 모으기",
      "핵심 작업 하나에 집중하기",
      "결과물을 제출하고 완료 조건 확인하기",
    ],
    criteria: [
      {
        label: "결과물에 작업 제목이 포함되어 있다",
        kind: "contains",
        expected: task.title,
      },
      {
        label: "결과 설명이 80자 이상 작성되어 있다",
        kind: "minLength",
        expected: "80",
      },
      {
        label: "내가 합의한 핵심 작업을 직접 확인했다",
        kind: "manual",
        expected: "",
      },
    ],
    source: "규칙 기반 추천",
  };
}
export function signature(criteria) {
  return JSON.stringify(
    criteria.map((c) => [c.id, c.label, c.kind, c.expected]),
  );
}
export function evaluate(criteria, evidence, manual = {}) {
  return criteria.map((c) => {
    let status = "unknown",
      detail = "이 근거로는 자동 확인할 수 없어요.";
    if (c.kind === "manual") {
      status = manual[c.id] ? "manual" : "unknown";
      detail = manual[c.id]
        ? "사용자가 직접 확인했습니다. 자동 검증이 아닙니다."
        : "사용자의 직접 확인이 필요합니다.";
    } else if (c.kind === "http" && evidence.kind === "url") {
      status =
        evidence.status >= 200 && evidence.status < 300 ? "pass" : "fail";
      detail = `HTTP 응답 ${evidence.status ?? "확인 불가"} · 폼 동작은 검사하지 않습니다.`;
    } else if (c.kind === "contains" && c.expected.trim()) {
      const yes = evidence.text
        .normalize("NFC")
        .toLowerCase()
        .includes(c.expected.normalize("NFC").toLowerCase());
      status = yes ? "pass" : "fail";
      detail = yes
        ? `“${c.expected}” 문구를 확인했습니다.`
        : `“${c.expected}” 문구가 없습니다.`;
    } else if (c.kind === "minLength" && Number(c.expected) > 0) {
      const n = [...evidence.text.trim()].length;
      status = n >= Number(c.expected) ? "pass" : "fail";
      detail = `${n}자 / 최소 ${Number(c.expected)}자`;
    }
    return { criterionId: c.id, label: c.label, status, detail };
  });
}
export function canShip(mission) {
  return Boolean(
    mission?.checks?.length === mission?.criteria?.length &&
    mission.checks.length > 0 &&
    mission.verifiedSignature === signature(mission.criteria) &&
    mission.criteria.every((c) => {
      const matches = mission.checks.filter(
        (check) => check.criterionId === c.id,
      );
      return (
        matches.length === 1 && ["pass", "manual"].includes(matches[0].status)
      );
    }),
  );
}
export function receiptMarkdown(receipt) {
  return `# ShipOne 완료 기록\n\n## ${receipt.title}\n\n- 완료: ${receipt.completedAt}\n- 모드: ${receipt.mode}\n- 계획: ${receipt.planSource}\n- 예상 ${receipt.minutes}분 / 실제 ${receipt.actualMinutes}분\n- 근거: ${receipt.evidence?.label ?? "사용자 확인"}\n- 근거 확인 시각: ${receipt.evidence?.checkedAt ?? "-"}\n${receipt.evidence?.hash ? "- SHA-256: " + receipt.evidence.hash + "\n" : ""}\n## 완료 조건\n\n${receipt.checks.map((c) => `- [${c.status}] ${c.label}\n  ${c.detail}`).join("\n")}\n\n검증은 위 조건과 확인 시점에 한정됩니다. 사용자 확인은 자동 검사와 구분됩니다.\n`;
}
export function validatePlan(plan, tasks, maxMinutes) {
  const task = tasks.find((t) => t.id === plan?.taskId && !t.done);
  if (
    !task ||
    typeof plan.reason !== "string" ||
    !Number.isFinite(plan.minutes) ||
    plan.minutes < 1 ||
    plan.minutes > maxMinutes ||
    !Array.isArray(plan.steps) ||
    plan.steps.length < 1 ||
    plan.steps.length > 6 ||
    plan.steps.some((s) => typeof s !== "string" || !s.trim()) ||
    !Array.isArray(plan.criteria) ||
    plan.criteria.length < 1 ||
    plan.criteria.length > 5
  )
    throw new Error(
      "AI 계획이 유효한 작업·시간·완료 조건을 반환하지 않았습니다. 다시 시도해주세요.",
    );
  for (const c of plan.criteria)
    if (
      !["contains", "minLength", "http", "manual"].includes(c.kind) ||
      typeof c.label !== "string" ||
      !c.label.trim() ||
      typeof c.expected !== "string" ||
      (c.kind === "contains" && !c.expected.trim()) ||
      (c.kind === "minLength" &&
        (!Number.isFinite(Number(c.expected)) || Number(c.expected) < 1))
    )
      throw new Error("AI 완료 조건 형식이 올바르지 않습니다.");
  return plan;
}
