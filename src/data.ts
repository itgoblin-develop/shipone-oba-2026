import type { AppState } from "./types";
export function initialState(sample = false): AppState {
  const start = new Date();
  if (sample) start.setHours(13, 0, 0, 0);
  else start.setSeconds(0, 0);
  const at = (m: number) => new Date(+start + m * 60000).toISOString();
  return {
    version: 1,
    tasks: sample
      ? [
          {
            id: "sample-launch",
            title: "ShipOne 소개 페이지 마무리",
            minutes: 45,
            priority: 3,
            energy: "low",
            source: "sample",
            due: at(240),
          },
          {
            id: "sample-deck",
            title: "데모 발표 흐름 정리하기",
            minutes: 25,
            priority: 2,
            energy: "low",
            source: "sample",
          },
          {
            id: "sample-feature",
            title: "새로운 모바일 기능 구상하기",
            minutes: 90,
            priority: 1,
            energy: "high",
            source: "sample",
          },
        ]
      : [],
    events: sample
      ? [
          {
            id: "event-1",
            title: "LETS · 빌더와 이야기 나누기",
            start: at(60),
            end: at(90),
            source: "sample",
          },
          {
            id: "event-2",
            title: "팀 데모 리허설",
            start: at(150),
            end: at(180),
            source: "sample",
          },
        ]
      : [],
    mission: null,
    receipts: [],
    energy: "medium",
    availableMinutes: 60,
    windowStart: at(0),
    windowEnd: at(240),
  };
}
export const demoPlan = {
  taskId: "sample-launch",
  reason:
    "첫 세션까지 60분이 비어 있어요. 오늘 마감인 소개 페이지는 45분이면 마무리할 수 있고, 15분의 여유가 남습니다.",
  minutes: 45,
  steps: [
    "핵심 메시지와 서비스 이름 정리",
    "사전 신청 안내 문구 추가",
    "완료 조건과 결과물 대조",
  ],
  criteria: [
    {
      label: "서비스 이름이 명시되어 있다",
      kind: "contains",
      expected: "ShipOne",
    },
    {
      label: "소개 내용에 ‘사전 신청’ 문구가 있다",
      kind: "contains",
      expected: "사전 신청",
    },
    { label: "소개 내용이 80자 이상이다", kind: "minLength", expected: "80" },
  ],
  source: "미리 작성한 체험 시나리오",
};
export const sampleEvidenceBroken =
  "ShipOne은 오늘 끝낼 하나를 고르고 끝까지 함께하는 개인 에이전트입니다. 흩어진 할 일과 일정을 연결하고, 지금 할 수 있는 Mission을 제안합니다. 작업이 끝나면 완료 조건과 결과물을 대조해 근거가 담긴 완료 기록을 남깁니다.";
export const sampleEvidenceFixed =
  sampleEvidenceBroken +
  "\n\n사전 신청: 소개 페이지 하단의 신청 버튼을 눌러 이메일을 남겨주세요. Windows 버전부터 차례로 초대합니다.";
