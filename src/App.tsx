import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Flame,
  History,
  Inbox,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  Plus,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
  Undo2,
  X,
  ParkingCircle,
} from "lucide-react";
import type {
  AppState,
  Task,
  Mission,
  PlanResult,
  Receipt,
  Criterion,
} from "./types";
import {
  uid,
  freeSlots,
  rankTasks,
  rulePlan,
  canShip,
  receiptMarkdown,
} from "../shared/core.mjs";
import { initialState, demoPlan } from "./data";
import { Goblin, Modal, Empty, Source, time } from "./components";
import Settings from "./Settings";
import Review from "./Review";
import { nativeDesktop } from "./web-api";
import Companion from "./Companion";
import WebSettings from "./WebSettings";

type Tab = "today" | "tasks" | "review" | "history" | "settings";
const asLocal = (s: string) => {
  return new Date(+new Date(s) + 9 * 60 * 60000).toISOString().slice(0, 16);
};
function loadBrowser(key: string, fallback: AppState) {
  try {
    const s = JSON.parse(localStorage.getItem(key) || "null");
    return s?.version === 1 &&
      Array.isArray(s.tasks) &&
      Array.isArray(s.events) &&
      Array.isArray(s.receipts)
      ? s
      : fallback;
  } catch {
    return fallback;
  }
}
export default function App() {
  const desktop = nativeDesktop;
  const [sample, setSample] = useState(!desktop),
    [state, setState] = useState<AppState>(() => initialState(!desktop)),
    [loaded, setLoaded] = useState(false),
    [tab, setTab] = useState<Tab>("today"),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [modal, setModal] = useState<
      | "task"
      | "event"
      | "park"
      | "block"
      | "criteria"
      | "reset"
      | "cancel"
      | null
    >(null),
    [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null),
    [now, setNow] = useState(Date.now()),
    [draft, setDraft] = useState(""),
    [suggestion, setSuggestion] = useState("");
  const [taskForm, setTaskForm] = useState({
    title: "",
    minutes: 30,
    priority: 2,
    energy: "medium" as Task["energy"],
  });
  const [eventForm, setEventForm] = useState({
    title: "",
    start: asLocal(new Date().toISOString()),
    end: asLocal(new Date(Date.now() + 1800000).toISOString()),
  });
  const [editCriteria, setEditCriteria] = useState<Criterion[]>([]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);
  useEffect(() => {
    let live = true;
    setLoaded(false);
    (async () => {
      let next = sample
        ? loadBrowser("shipone-demo-v1", initialState(true))
        : (await window.shipone!.load()) || initialState(false);
      if (!sample && +new Date(next.windowEnd) <= Date.now()) {
        const fresh = initialState(false);
        next = {
          ...next,
          windowStart: fresh.windowStart,
          windowEnd: fresh.windowEnd,
        };
      }
      if (live) {
        setState(next);
        setLoaded(true);
        setTab("today");
      }
    })().catch((e) => {
      setError(e.message);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [sample]);
  useEffect(() => {
    if (!loaded) return;
    if (sample) {
      try {
        localStorage.setItem("shipone-demo-v1", JSON.stringify(state));
      } catch {
        setError("브라우저 저장 공간이 부족합니다. 완료 기록을 내보내주세요.");
      }
    } else window.shipone!.save(state).catch((e) => setError(e.message));
  }, [state, loaded, sample]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const mission = state.mission;
  const openTasks = state.tasks.filter((t) => !t.done);
  const planningStart = sample
    ? state.windowStart
    : new Date(Math.max(+new Date(state.windowStart), now)).toISOString();
  const slots = freeSlots(planningStart, state.windowEnd, state.events);
  const longest = Math.min(
    state.availableMinutes,
    Math.max(0, ...slots.map((s) => s.minutes)),
  );
  const elapsed = mission?.startedAt
    ? Math.max(
        0,
        Math.floor(
          ((mission.completedAt ? +new Date(mission.completedAt) : now) -
            +new Date(mission.startedAt)) /
            1000,
        ),
      )
    : 0;
  const updateMission = (m: Mission, create = false) =>
    setState((s) =>
      create || s.mission?.id === m.id ? { ...s, mission: m } : s,
    );
  async function recommend(useAI = true) {
    setError("");
    setBusy(true);
    try {
      const ranked = rankTasks(
        state.tasks,
        state.events,
        planningStart,
        state.windowEnd,
        state.availableMinutes,
        state.energy,
      );
      if (!ranked.length)
        throw new Error(
          openTasks.length
            ? "지금 확보한 연속 시간에 맞는 작업이 없습니다. 예상시간이나 작업 가능 구간을 조정해주세요."
            : "먼저 오늘 할 일을 하나 추가해주세요.",
        );
      let plan: PlanResult;
      if (sample && !useAI && ranked[0].task.id === "sample-launch")
        plan = {
          ...demoPlan,
          reason: `지정한 구간에서 ${ranked[0].slot.minutes}분의 연속 시간이 있어요. 45분짜리 소개 페이지를 마무리하고 완료 조건을 검사해요.`,
        } as PlanResult;
      else if (useAI)
        plan = await window.shipone!.plan({
          feasibleTasks: ranked.slice(0, 20).map((r: { task: Task }) => r.task),
          timezone: "Asia/Seoul",
          slots,
          maxMinutes: longest,
          energy: state.energy,
          history: state.receipts.slice(0, 5).map((r) => ({
            title: r.title,
            estimated: r.minutes,
            actual: r.actualMinutes,
          })),
        });
      else plan = rulePlan(ranked[0].task, state.energy) as PlanResult;
      const task = state.tasks.find((t) => t.id === plan.taskId)!;
      updateMission(
        {
          id: uid(),
          taskId: task.id,
          title: task.title,
          reason: plan.reason,
          minutes: plan.minutes,
          steps: plan.steps.map((title) => ({ id: uid(), title, done: false })),
          criteria: plan.criteria.map((c) => ({ ...c, id: uid() })),
          status: "ready",
          createdAt: new Date().toISOString(),
          planSource: plan.source,
          parked: [],
          replans: [],
        },
        true,
      );
      setTab("today");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function start() {
    if (!mission) return;
    updateMission({
      ...mission,
      status: "active",
      startedAt: new Date().toISOString(),
    });
    setToast("오늘의 하나를 시작했어요. 다른 아이디어는 주차해두세요.");
  }
  function ship() {
    if (!mission || !canShip(mission)) return;
    const at = new Date().toISOString();
    const r: Receipt = {
      id: uid(),
      title: mission.title,
      completedAt: at,
      minutes: mission.minutes,
      actualMinutes: Math.max(1, Math.ceil(elapsed / 60)),
      checks: mission.checks!,
      evidence: mission.evidence
        ? { ...mission.evidence, text: mission.evidence.text.slice(0, 4000) }
        : undefined,
      mode: sample ? "샘플 체험" : "실제 작업",
      planSource: mission.planSource,
    };
    setState((s) => ({
      ...s,
      mission: { ...mission, status: "shipped", completedAt: at },
      tasks: s.tasks.map((t) =>
        t.id === mission.taskId ? { ...t, done: true } : t,
      ),
      receipts: [r, ...s.receipts],
    }));
    setTab("today");
    setToast("오늘의 하나, 근거와 함께 완료했어요.");
    if (desktop && !sample)
      void window.shipone!.notify(
        "ShipOne · 오늘의 하나를 끝냈어요",
        mission.title,
      );
  }
  async function exportReceipt(r: Receipt) {
    const text = receiptMarkdown(r);
    try {
      if (desktop) {
        if (await window.shipone!.exportReceipt(text))
          setToast("완료 기록을 저장했습니다.");
      } else {
        const u = URL.createObjectURL(
          new Blob([text], { type: "text/markdown;charset=utf-8" }),
        );
        const a = document.createElement("a");
        a.href = u;
        a.download = "ShipOne-receipt.md";
        a.click();
        setTimeout(() => URL.revokeObjectURL(u), 1000);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function replan() {
    if (!mission || !draft.trim()) return;
    setBusy(true);
    setError("");
    try {
      const r =
        sample && mission.planSource === "체험 안내"
          ? {
              suggestion:
                "현재 완료 조건은 유지해요. 먼저 빠진 사전 신청 안내를 한 문장으로 추가한 뒤 다시 검증해보세요.",
              source: "체험 안내",
            }
          : await window.shipone!.replan({
              mission: {
                title: mission.title,
                criteria: mission.criteria,
                steps: mission.steps,
              },
              blocker: draft,
              elapsedMinutes: Math.floor(elapsed / 60),
            });
      setSuggestion(r.suggestion);
      updateMission({
        ...mission,
        replans: [
          ...mission.replans,
          {
            at: new Date().toISOString(),
            blocker: draft,
            suggestion: r.suggestion,
          },
        ],
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const nav: { id: Tab; label: string; icon: typeof Target; count?: number }[] =
    [
      { id: "today", label: "오늘의 하나", icon: LayoutDashboard },
      {
        id: "tasks",
        label: "할 일 모아보기",
        icon: Inbox,
        count: openTasks.length,
      },
      { id: "review", label: "완료 검증", icon: ShieldCheck },
      {
        id: "history",
        label: "완료 기록",
        icon: History,
        count: state.receipts.length,
      },
    ];
  if (!loaded)
    return (
      <div className="boot">
        <Goblin />
        <p>오늘의 하나를 준비하고 있어요.</p>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setTab("today")}>
          <Goblin small />
          <span>
            ShipOne<small>CHOOSE ONE. SHIP IT.</small>
          </span>
        </button>
        <div className="workspace-label">
          MY WORKSPACE <span>01</span>
        </div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              aria-current={tab === n.id ? "page" : undefined}
              className={tab === n.id ? "active" : ""}
              onClick={() => setTab(n.id)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.count !== undefined && <b>{n.count}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="companion">
            <Goblin />
            <p>
              할 일을 늘리지 말고,
              <br />
              <strong>하나를 끝내요.</strong>
            </p>
            <span>당신 곁의 조언자 도깨비</span>
          </div>
          <button
            className={"settings-nav " + (tab === "settings" ? "active" : "")}
            onClick={() => setTab("settings")}
          >
            <SettingsIcon size={18} />
            연결 및 설정
          </button>
          <div className="profile">
            <span className="avatar">IT</span>
            <div>
              <strong>나의 작업 공간</strong>
              <small>
                {sample
                  ? "샘플 체험 중"
                  : desktop
                    ? "이 PC에 안전하게 저장"
                    : "이 브라우저에 저장"}
              </small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span className="breadcrumb">워크스페이스</span>
            <ChevronRight size={14} />
            <strong>
              {tab === "settings"
                ? "연결 및 설정"
                : nav.find((n) => n.id === tab)?.label}
            </strong>
          </div>
          <div className="top-actions">
            <button
              className="icon-btn"
              aria-label="연결 및 설정 열기"
              onClick={() => setTab("settings")}
            >
              <SettingsIcon size={18} />
            </button>
            <span className={"mode-badge " + (sample ? "demo" : "")}>
              {sample
                ? "DEMO · 샘플 데이터"
                : desktop
                  ? "DESKTOP · 실제 작업"
                  : "WEB · 내 작업"}
            </span>
            {true ? (
              <button
                className="text-btn"
                disabled={busy}
                onClick={() => {
                  setLoaded(false);
                  setError("");
                  setSample(!sample);
                }}
              >
                {sample ? "내 작업으로 돌아가기" : "샘플로 체험하기"}
              </button>
            ) : (
              <span className="desktop-hint">설치형 앱 미리보기</span>
            )}
          </div>
        </header>
        <div className="page-content">
          {sample && (
            <div className="demo-banner">
              <Sparkles size={16} />
              <span>
                <strong>샘플 데이터로 바로 시작하세요.</strong> AI 추천은 실제
                OpenAI 호출입니다. 무료로 흐름만 살펴보려면 ‘샘플 시나리오
                체험’을 선택하세요.
              </span>
              <button onClick={() => setModal("reset")}>
                체험 초기화
                <Undo2 size={13} />
              </button>
            </div>
          )}
          {error && (
            <div className="error global-error" role="alert">
              <TriangleAlert size={18} />
              <span>{error}</span>
              <button
                className="icon-btn"
                aria-label="오류 닫기"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {tab === "today" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {sample
                      ? "SATURDAY, NOVEMBER 7 · 샘플 하루"
                      : new Date()
                          .toLocaleDateString("en-US", {
                            timeZone: "Asia/Seoul",
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                          })
                          .toUpperCase()}
                  </span>
                  <h1>
                    오늘은, <span>하나만 끝내요.</span>
                  </h1>
                  <p>
                    할 일과 일정 사이에서, 지금 끝낼 수 있는 가장 중요한 하나.
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => {
                    setTaskForm({
                      title: "",
                      minutes: 30,
                      priority: 2,
                      energy: "medium",
                    });
                    setModal("task");
                  }}
                >
                  <Plus size={16} />할 일 추가
                </button>
              </div>
              <div className="dashboard-grid">
                <div className="main-column">
                  {!mission ? (
                    <section className="mission-card choose-card">
                      <div className="mission-top">
                        <span className="pill">TODAY’S ONE</span>
                        <span>
                          <Target size={16} />
                          시작할 준비
                        </span>
                      </div>
                      <div className="choose-art">
                        <div className="orbit orbit-one" />
                        <div className="orbit orbit-two" />
                        <Goblin />
                        <span className="spark spark-one">✦</span>
                        <span className="spark spark-two">✧</span>
                      </div>
                      <h2>
                        머릿속엔 여러 개.
                        <br />
                        오늘 끝낼 건 하나.
                      </h2>
                      <p>
                        {openTasks.length
                          ? `${openTasks.length}개의 할 일과 오늘의 빈 시간을 함께 살펴볼게요.`
                          : "해야 할 일을 하나 추가하면, 지금 가능한 계획을 함께 세워요."}
                      </p>
                      <button
                        className="primary large"
                        onClick={() => recommend()}
                        disabled={busy}
                      >
                        {busy ? (
                          <LoaderCircle className="spin" size={18} />
                        ) : (
                          <Sparkles size={18} />
                        )}
                        오늘의 하나 골라줘
                        <ArrowRight size={18} />
                      </button>
                      {
                        <button
                          className="text-btn local-plan"
                          disabled={busy}
                          onClick={() => recommend(false)}
                        >
                          {sample
                            ? "샘플 시나리오 체험 · API 사용 없음"
                            : "API 없이 시간·우선순위로 추천"}
                        </button>
                      }
                      <div className="mission-foot">
                        <span>
                          <ShieldCheck size={15} />
                          완료 조건부터 약속해요
                        </span>
                        <span>
                          <Clock3 size={15} />
                          최대 {longest}분 연속 집중
                        </span>
                      </div>
                    </section>
                  ) : mission.status === "shipped" ? (
                    <section className="mission-card shipped-card">
                      <div className="shipped-stamp">
                        <CheckCircle2 size={40} />
                      </div>
                      <span className="eyebrow">ONE THING. TRULY DONE.</span>
                      <h2>
                        오늘의 하나,
                        <br />
                        끝냈어요.
                      </h2>
                      <p className="shipped-title">{mission.title}</p>
                      <div className="ship-stats">
                        <div>
                          <strong>
                            {
                              mission.checks?.filter((c) => c.status === "pass")
                                .length
                            }
                          </strong>
                          <span>자동 검사 통과</span>
                        </div>
                        <div>
                          <strong>
                            {
                              mission.checks?.filter(
                                (c) => c.status === "manual",
                              ).length
                            }
                          </strong>
                          <span>사용자 확인</span>
                        </div>
                        <div>
                          <strong>
                            {Math.max(1, Math.ceil(elapsed / 60))}
                            <small>분</small>
                          </strong>
                          <span>시작 후 경과</span>
                        </div>
                      </div>
                      <div className="button-row">
                        <button
                          className="primary"
                          onClick={() => exportReceipt(state.receipts[0])}
                        >
                          <Download size={17} />
                          완료 기록 저장
                        </button>
                        <button
                          className="secondary"
                          onClick={() =>
                            setState((s) => ({ ...s, mission: null }))
                          }
                        >
                          다음 하나 고르기
                          <ArrowRight size={17} />
                        </button>
                      </div>
                      <small>
                        {sample
                          ? "샘플 결과물에 대한 체험 기록입니다."
                          : "검증한 조건과 확인 시각이 완료 기록에 남았습니다."}
                      </small>
                    </section>
                  ) : (
                    <section className="mission-card active-mission">
                      <div className="mission-top">
                        <span className="pill">TODAY’S ONE</span>
                        <span className="mission-status">
                          <span className="online-dot" />
                          {mission.status === "ready"
                            ? "계획 준비됨"
                            : mission.status === "review"
                              ? "완료 조건 확인 중"
                              : "집중하는 중"}
                        </span>
                      </div>
                      <h2>{mission.title}</h2>
                      <div className="mission-context">
                        <span>
                          <Clock3 size={16} />
                          {mission.minutes}분 계획
                        </span>
                        <span>
                          <Flame size={16} />
                          {
                            { low: "가볍게", medium: "차분하게", high: "깊게" }[
                              state.energy
                            ]
                          }
                        </span>
                        <span>{mission.planSource}</span>
                      </div>
                      <div className="agent-note">
                        <Goblin small />
                        <p>{mission.reason}</p>
                      </div>
                      <div className="steps">
                        <div className="section-label">
                          작은 단계, 확실한 진전{" "}
                          <span>
                            {mission.steps.filter((s) => s.done).length}/
                            {mission.steps.length}
                          </span>
                        </div>
                        {mission.steps.map((step, i) => (
                          <label
                            className={"step " + (step.done ? "done" : "")}
                            key={step.id}
                          >
                            <input
                              type="checkbox"
                              checked={step.done}
                              disabled={mission.status === "ready"}
                              onChange={(e) =>
                                updateMission({
                                  ...mission,
                                  steps: mission.steps.map((s) =>
                                    s.id === step.id
                                      ? { ...s, done: e.target.checked }
                                      : s,
                                  ),
                                })
                              }
                            />
                            <span className="step-num">
                              {step.done ? (
                                <Check size={14} />
                              ) : (
                                String(i + 1).padStart(2, "0")
                              )}
                            </span>
                            <span>{step.title}</span>
                          </label>
                        ))}
                      </div>
                      <div className="criteria-preview">
                        <div className="section-label">
                          <ShieldCheck size={15} />
                          이렇게 되면 완료예요
                          {mission.status === "ready" && (
                            <button
                              className="text-btn"
                              onClick={() => {
                                setEditCriteria(
                                  mission.criteria.map((c) => ({ ...c })),
                                );
                                setModal("criteria");
                              }}
                            >
                              조건 수정
                            </button>
                          )}
                        </div>
                        {mission.criteria.map((c) => (
                          <div key={c.id}>
                            <span className="tiny-dot" />
                            {c.label}
                            <small>
                              {c.kind === "manual" ? "직접 확인" : "자동 검사"}
                            </small>
                          </div>
                        ))}
                      </div>
                      <div className="mission-buttons">
                        {mission.status === "ready" ? (
                          <button className="primary large" onClick={start}>
                            이 하나에 집중하기
                            <ArrowRight size={18} />
                          </button>
                        ) : (
                          <>
                            <div className="elapsed">
                              <span className="pulse-dot" />
                              {String(Math.floor(elapsed / 60)).padStart(
                                2,
                                "0",
                              )}
                              <span>:</span>
                              {String(elapsed % 60).padStart(2, "0")}
                              <small>경과</small>
                            </div>
                            <button
                              className="primary"
                              onClick={() => setTab("review")}
                            >
                              <ShieldCheck size={17} />
                              끝났는지 확인하기
                            </button>
                          </>
                        )}
                      </div>
                      <button
                        className="text-btn"
                        onClick={() => setModal("cancel")}
                      >
                        {mission.status === "ready"
                          ? "다른 하나 다시 고르기"
                          : "현재 Mission 보류하기"}
                      </button>
                      {mission.status !== "ready" && (
                        <div className="focus-actions">
                          <button
                            className="text-btn"
                            onClick={() => {
                              setDraft("");
                              setSuggestion("");
                              setModal("block");
                            }}
                          >
                            <TriangleAlert size={15} />
                            막혔어요
                          </button>
                          <button
                            className="text-btn"
                            onClick={() => {
                              setDraft("");
                              setModal("park");
                            }}
                          >
                            <ParkingCircle size={16} />
                            떠오른 생각 주차
                          </button>
                        </div>
                      )}
                    </section>
                  )}
                  <section className="panel inbox-preview">
                    <div className="card-title">
                      <h2>지금 머릿속에 있는 일</h2>
                      <button
                        className="text-btn"
                        onClick={() => setTab("tasks")}
                      >
                        모두 보기
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                    {openTasks.length ? (
                      openTasks.slice(0, 3).map((t) => (
                        <div className="task-row" key={t.id}>
                          <span className={"priority-dot p" + t.priority} />
                          <div>
                            <strong>{t.title}</strong>
                            <Source source={t.source} />
                          </div>
                          <span>{t.minutes}분</span>
                          {mission?.taskId === t.id ? (
                            <span className="pill green">오늘의 하나</span>
                          ) : (
                            <span className="subtle">대기</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="muted">
                        모든 일을 한 번에 끝낼 필요 없어요. 먼저 하나를
                        적어보세요.
                      </p>
                    )}
                  </section>
                  {mission?.parked.length ? (
                    <section className="panel parking">
                      <div className="card-title">
                        <ParkingCircle size={19} />
                        <h2>잠깐 주차한 생각</h2>
                        <span className="pill">{mission.parked.length}</span>
                      </div>
                      {mission.parked.map((s, i) => (
                        <p key={i}>{s}</p>
                      ))}
                    </section>
                  ) : null}
                </div>
                <aside className="context-column">
                  <section className="panel energy-panel">
                    <div className="card-title">
                      <h2>지금 나의 상태</h2>
                      <span>✦</span>
                    </div>
                    <label>
                      쓸 수 있는 집중 시간
                      <select
                        value={state.availableMinutes}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            availableMinutes: Number(e.target.value),
                          }))
                        }
                      >
                        {[15, 25, 30, 45, 60, 90, 120, 180].map((n) => (
                          <option key={n} value={n}>
                            {n}분
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="field-label">오늘의 에너지</span>
                    <div className="energy-options">
                      {(["low", "medium", "high"] as const).map((e, i) => (
                        <button
                          key={e}
                          className={state.energy === e ? "selected" : ""}
                          aria-pressed={state.energy === e}
                          onClick={() => setState((s) => ({ ...s, energy: e }))}
                        >
                          <span>{["◔", "◑", "●"][i]}</span>
                          {["가벼움", "보통", "충분함"][i]}
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className="panel timeline-panel">
                    <div className="card-title">
                      <h2>오늘의 흐름</h2>
                      <CalendarDays size={18} />
                    </div>
                    <div className="timeline-summary">
                      <strong>
                        {longest}
                        <small>분</small>
                      </strong>
                      <span>
                        지금 계획할 수 있는
                        <br />
                        가장 긴 집중 구간
                      </span>
                    </div>
                    <details>
                      <summary>작업 가능한 시간 조정</summary>
                      <label>
                        시작 (KST)
                        <input
                          type="datetime-local"
                          value={asLocal(state.windowStart)}
                          onChange={(e) => {
                            if (e.target.value)
                              setState((s) => ({
                                ...s,
                                windowStart: new Date(
                                  `${e.target.value}+09:00`,
                                ).toISOString(),
                              }));
                          }}
                        />
                      </label>
                      <label>
                        종료 (KST)
                        <input
                          type="datetime-local"
                          value={asLocal(state.windowEnd)}
                          onChange={(e) => {
                            if (e.target.value)
                              setState((s) => ({
                                ...s,
                                windowEnd: new Date(
                                  `${e.target.value}+09:00`,
                                ).toISOString(),
                              }));
                          }}
                        />
                      </label>
                    </details>
                    <div className="timeline">
                      {[
                        ...state.events
                          .filter(
                            (e) =>
                              +new Date(e.end) > +new Date(state.windowStart) &&
                              +new Date(e.start) < +new Date(state.windowEnd),
                          )
                          .map((e) => ({ ...e, free: false })),
                        ...slots.map((s, i) => ({
                          id: "free" + i,
                          title: "집중할 수 있는 시간",
                          start: s.start,
                          end: s.end,
                          source: "free",
                          free: true,
                        })),
                      ]
                        .sort((a, b) => +new Date(a.start) - +new Date(b.start))
                        .slice(0, 8)
                        .map((e) => (
                          <div
                            className={
                              "timeline-entry " + (e.free ? "free" : "")
                            }
                            key={e.id}
                          >
                            <span>{time(e.start)}</span>
                            <div>
                              <strong>{e.title}</strong>
                              <small>
                                {time(e.start)}–{time(e.end)}
                                {!e.free &&
                                  " · " +
                                    (e.source === "sample"
                                      ? "샘플"
                                      : e.source === "google"
                                        ? "Google"
                                        : "직접 입력")}
                              </small>
                            </div>
                          </div>
                        ))}
                    </div>
                    <details className="event-manager">
                      <summary>입력한 일정 관리</summary>
                      {state.events
                        .filter(
                          (e) => e.source === "manual" || e.source === "import",
                        )
                        .map((e) => (
                          <div key={e.id}>
                            <span>{e.title}</span>
                            <button
                              className="icon-btn"
                              aria-label={`${e.title} 일정 삭제`}
                              onClick={() =>
                                setState((s) => ({
                                  ...s,
                                  events: s.events.filter((x) => x.id !== e.id),
                                }))
                              }
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                    </details>
                    <button
                      className="text-btn"
                      onClick={() => {
                        setError("");
                        setEventForm({
                          title: "",
                          start: asLocal(new Date().toISOString()),
                          end: asLocal(
                            new Date(Date.now() + 1800000).toISOString(),
                          ),
                        });
                        setModal("event");
                      }}
                    >
                      <Plus size={15} />
                      일정 직접 추가
                    </button>
                    <button
                      className="text-btn"
                      onClick={() => setTab("settings")}
                    >
                      <Link2 size={15} />
                      캘린더 연결
                    </button>
                    {state.calendarSyncedAt && (
                      <small className="sync-time">
                        마지막 읽기{" "}
                        {new Date(state.calendarSyncedAt).toLocaleString(
                          "ko-KR",
                          { timeZone: "Asia/Seoul" },
                        )}
                        {now - +new Date(state.calendarSyncedAt) > 15 * 60000 &&
                          " · 새 일정이 있다면 다시 읽어주세요."}
                      </small>
                    )}
                  </section>
                  <div className="quote-note">
                    <span>“</span>
                    <p>
                      바빴던 하루보다,
                      <br />
                      <strong>하나를 끝낸 하루.</strong>
                    </p>
                    <small>YOUR DAILY COMPLETION COMPANION</small>
                  </div>
                </aside>
              </div>
            </>
          )}
          {tab === "tasks" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">CLEAR YOUR MIND</span>
                  <h1>생각은 모으고, 실행은 하나씩.</h1>
                  <p>
                    우선순위와 예상시간을 바탕으로 오늘의 Mission을 고릅니다.
                  </p>
                </div>
                <button className="primary" onClick={() => setModal("task")}>
                  <Plus size={17} />할 일 추가
                </button>
              </div>
              <section className="panel all-tasks">
                {state.tasks.length ? (
                  state.tasks.map((t) => (
                    <div
                      className={"task-row " + (t.done ? "task-done" : "")}
                      key={t.id}
                    >
                      <span className={"priority-dot p" + t.priority} />
                      <div>
                        <strong>{t.title}</strong>
                        <Source source={t.source} />
                      </div>
                      <span>{t.minutes}분</span>
                      <span className="pill">
                        {t.done ? "완료" : t.priority >= 3 ? "우선" : "대기"}
                      </span>
                      <button
                        className="icon-btn"
                        aria-label={`${t.title} 삭제`}
                        disabled={
                          mission?.taskId === t.id &&
                          mission.status !== "shipped"
                        }
                        onClick={() =>
                          setState((s) => ({
                            ...s,
                            tasks: s.tasks.filter((x) => x.id !== t.id),
                          }))
                        }
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <Empty title="머릿속의 첫 번째 일을 적어보세요.">
                    작은 일도 좋아요. 끝낼 수 있는 크기부터 시작해요.
                  </Empty>
                )}
                <button className="text-btn" onClick={() => setTab("settings")}>
                  <Link2 size={16} />
                  Notion에서 가져오기
                </button>
                {state.syncedAt && (
                  <small>
                    마지막 읽기{" "}
                    {new Date(state.syncedAt).toLocaleString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })}
                  </small>
                )}
              </section>
            </>
          )}
          {tab === "review" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">DON’T JUST CHECK. VERIFY.</span>
                  <h1>끝났나요? 확인해볼게요.</h1>
                  <p>
                    {mission?.title ||
                      "오늘의 Mission을 시작하면 결과를 검증할 수 있어요."}
                  </p>
                </div>
              </div>
              {mission &&
              mission.status !== "ready" &&
              mission.status !== "shipped" ? (
                <Review
                  key={mission.id}
                  mission={mission}
                  sample={sample}
                  onChange={updateMission}
                  onShip={ship}
                />
              ) : (
                <section className="panel">
                  <Empty
                    title={
                      mission?.status === "shipped"
                        ? "이미 근거와 함께 완료했어요."
                        : "먼저 오늘의 하나를 시작해주세요."
                    }
                  >
                    {mission?.status === "shipped"
                      ? "완료 기록에서 검사 결과를 다시 볼 수 있습니다."
                      : "완료 조건을 먼저 정해야 결과를 정직하게 확인할 수 있어요."}
                  </Empty>
                  <button
                    className="primary centered"
                    onClick={() =>
                      setTab(
                        mission?.status === "shipped" ? "history" : "today",
                      )
                    }
                  >
                    {mission?.status === "shipped"
                      ? "완료 기록 보기"
                      : "오늘의 하나로"}
                    <ArrowRight size={16} />
                  </button>
                </section>
              )}
            </>
          )}
          {tab === "history" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">SMALL WINS, REAL PROOF</span>
                  <h1>끝낸 일은 남습니다.</h1>
                  <p>
                    약속한 조건, 확인한 근거, 실제 경과시간을 함께 기록해요.
                  </p>
                </div>
                <span className="history-count">
                  {state.receipts.length}
                  <small>SHIPPED</small>
                </span>
              </div>
              {state.receipts.length ? (
                <div className="receipt-list">
                  {state.receipts.map((r) => (
                    <section className="panel receipt-card" key={r.id}>
                      <span className="receipt-icon">
                        <CheckCircle2 />
                      </span>
                      <div>
                        <div className="receipt-kicker">
                          {r.mode} ·{" "}
                          {new Date(r.completedAt).toLocaleDateString("ko-KR", {
                            timeZone: "Asia/Seoul",
                          })}
                        </div>
                        <h2>{r.title}</h2>
                        <p>
                          계획 {r.minutes}분 · 실제 경과 {r.actualMinutes}분 ·
                          조건 {r.checks.length}개 확인
                        </p>
                      </div>
                      <button
                        className="secondary"
                        onClick={() => setSelectedReceipt(r)}
                      >
                        근거 보기
                      </button>
                      <button
                        className="icon-btn"
                        aria-label="완료 기록 다운로드"
                        onClick={() => exportReceipt(r)}
                      >
                        <Download size={19} />
                      </button>
                    </section>
                  ))}
                </div>
              ) : (
                <section className="panel">
                  <Empty title="첫 번째 완료를 기다리고 있어요.">
                    오늘의 하나를 끝내면, 체크 표시보다 확실한 기록이 여기에
                    쌓입니다.
                  </Empty>
                </section>
              )}
            </>
          )}
          {tab === "settings" && !desktop && (
            <WebSettings
              notify={setToast}
              onEvents={(events, at, source) =>
                setState((s) => ({
                  ...s,
                  events: [
                    ...s.events.filter((e) => e.source !== source),
                    ...events,
                  ],
                  calendarSyncedAt: at,
                }))
              }
            />
          )}
          {tab === "settings" && desktop && (
            <Settings
              sample={sample}
              notify={setToast}
              onTasks={(tasks, at) => {
                if (sample) {
                  setToast("실제 작업 모드로 전환한 뒤 가져와주세요.");
                  return;
                }
                setState((s) => ({
                  ...s,
                  tasks: [
                    ...s.tasks.filter((t) => t.source !== "notion"),
                    ...tasks.map((t) => ({
                      ...t,
                      done:
                        t.done || s.tasks.find((old) => old.id === t.id)?.done,
                    })),
                  ],
                  syncedAt: at,
                }));
              }}
              onEvents={(events, at, source) => {
                if (sample) {
                  setToast("실제 작업 모드로 전환한 뒤 가져와주세요.");
                  return;
                }
                setState((s) => ({
                  ...s,
                  events: [
                    ...s.events.filter((e) => e.source !== source),
                    ...events,
                  ],
                  calendarSyncedAt: at,
                }));
              }}
            />
          )}
          <footer>
            ShipOne <span>Choose one. Prove it. Ship it.</span>
            <small>
              <a href="./pitch/">발표자료</a> · <a href="./video/">60초 영상</a>{" "}
              · OBA 2026
            </small>
          </footer>
        </div>
      </main>
      <Companion
        mission={mission}
        elapsed={elapsed}
        onOpen={() => setTab(mission?.status === "review" ? "review" : "today")}
      />
      {toast && (
        <div role="status" className="toast">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {modal === "task" && (
        <Modal title="머릿속의 할 일 꺼내놓기" onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!taskForm.title.trim()) return;
              setState((s) => ({
                ...s,
                tasks: [
                  ...s.tasks,
                  {
                    ...taskForm,
                    title: taskForm.title.trim(),
                    id: uid(),
                    source: "manual",
                  },
                ],
              }));
              setTaskForm({
                title: "",
                minutes: 30,
                priority: 2,
                energy: "medium",
              });
              setModal(null);
              setToast("할 일을 추가했어요.");
            }}
          >
            <label>
              무엇을 끝내고 싶나요?
              <input
                autoFocus
                required
                maxLength={200}
                value={taskForm.title}
                onChange={(e) =>
                  setTaskForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="예: 서비스 소개 페이지 마무리"
              />
            </label>
            <div className="form-grid">
              <label>
                예상시간 (분)
                <input
                  required
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={taskForm.minutes}
                  onChange={(e) =>
                    setTaskForm((f) => ({
                      ...f,
                      minutes: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label>
                우선순위
                <select
                  value={taskForm.priority}
                  onChange={(e) =>
                    setTaskForm((f) => ({
                      ...f,
                      priority: Number(e.target.value),
                    }))
                  }
                >
                  <option value={3}>높음 · 먼저 끝내기</option>
                  <option value={2}>보통</option>
                  <option value={1}>낮음 · 여유 있을 때</option>
                </select>
              </label>
            </div>
            <label>
              필요한 에너지
              <select
                value={taskForm.energy}
                onChange={(e) =>
                  setTaskForm((f) => ({
                    ...f,
                    energy: e.target.value as Task["energy"],
                  }))
                }
              >
                <option value="low">가벼운 작업</option>
                <option value="medium">보통 집중</option>
                <option value="high">깊은 집중</option>
              </select>
            </label>
            <button className="primary wide" type="submit">
              할 일 추가
              <Plus size={17} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "event" && (
        <Modal title="오늘의 일정 추가" onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                new Date(`${eventForm.end}+09:00`) <=
                new Date(`${eventForm.start}+09:00`)
              ) {
                setError("일정 종료는 시작보다 늦어야 합니다.");
                return;
              }
              setState((s) => ({
                ...s,
                events: [
                  ...s.events,
                  {
                    id: uid(),
                    title: eventForm.title,
                    start: new Date(`${eventForm.start}+09:00`).toISOString(),
                    end: new Date(`${eventForm.end}+09:00`).toISOString(),
                    source: "manual",
                  },
                ],
              }));
              setModal(null);
              setToast("일정을 반영했습니다.");
            }}
          >
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <label>
              일정 이름
              <input
                autoFocus
                required
                maxLength={200}
                value={eventForm.title}
                onChange={(e) =>
                  setEventForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </label>
            <label>
              시작 (KST)
              <input
                type="datetime-local"
                required
                value={eventForm.start}
                onChange={(e) =>
                  setEventForm((f) => ({ ...f, start: e.target.value }))
                }
              />
            </label>
            <label>
              종료 (KST)
              <input
                type="datetime-local"
                required
                value={eventForm.end}
                onChange={(e) =>
                  setEventForm((f) => ({ ...f, end: e.target.value }))
                }
              />
            </label>
            <button className="primary wide">일정 반영</button>
          </form>
        </Modal>
      )}
      {modal === "park" && (
        <Modal
          title="생각은 놓치지 말고, 잠깐 주차."
          onClose={() => setModal(null)}
        >
          <p>현재 Mission을 지키면서, 떠오른 생각은 여기에 보관해요.</p>
          <textarea
            aria-label="주차할 생각"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="다음에 하고 싶은 일…"
          />
          <button
            className="primary wide"
            disabled={!draft.trim()}
            onClick={() => {
              updateMission({
                ...mission!,
                parked: [...mission!.parked, draft.trim()],
              });
              setModal(null);
              setToast("생각을 주차했어요. 지금의 하나로 돌아가요.");
            }}
          >
            주차하고 돌아가기
          </button>
        </Modal>
      )}
      {modal === "block" && (
        <Modal
          title="막혔다면, 길을 다시 찾아요."
          onClose={() => setModal(null)}
        >
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <label>
            어디에서 막혔나요?
            <textarea
              autoFocus
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2000}
            />
          </label>
          <button
            className="primary wide"
            disabled={!draft.trim() || busy}
            onClick={replan}
          >
            {busy ? "다음 한 걸음을 찾고 있어요…" : "다음 한 걸음 제안받기"}
          </button>
          {suggestion && (
            <div className="replan-result">
              <Goblin small />
              <p>{suggestion}</p>
              <small>합의한 완료 조건은 그대로 유지합니다.</small>
              <button
                className="secondary"
                onClick={() => {
                  updateMission({
                    ...mission!,
                    steps: [
                      { id: uid(), title: suggestion, done: false },
                      ...mission!.steps,
                    ],
                  });
                  setModal(null);
                }}
              >
                실행 단계에 추가
              </button>
            </div>
          )}
        </Modal>
      )}
      {modal === "criteria" && (
        <Modal
          title="무엇을 확인하면 완료일까요?"
          onClose={() => setModal(null)}
        >
          <p>
            시작 후에는 조건을 바꿀 수 없어요. 검사 가능한 조건을 약속해주세요.
          </p>
          {editCriteria.map((c, i) => (
            <div className="criterion-editor" key={c.id}>
              <label>
                조건 {i + 1}
                <input
                  value={c.label}
                  onChange={(e) =>
                    setEditCriteria((cs) =>
                      cs.map((x) =>
                        x.id === c.id ? { ...x, label: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <div className="form-grid">
                <select
                  aria-label={`조건 ${i + 1} 검사 방법`}
                  value={c.kind}
                  onChange={(e) =>
                    setEditCriteria((cs) =>
                      cs.map((x) =>
                        x.id === c.id
                          ? {
                              ...x,
                              kind: e.target.value as Criterion["kind"],
                              expected: "",
                            }
                          : x,
                      ),
                    )
                  }
                >
                  <option value="contains">문구 포함</option>
                  <option value="minLength">최소 글자 수</option>
                  <option value="http">HTTP 접속 성공</option>
                  <option value="manual">사용자 직접 확인</option>
                </select>
                <input
                  aria-label={`조건 ${i + 1} 기준값`}
                  disabled={["manual", "http"].includes(c.kind)}
                  value={c.expected}
                  placeholder={c.kind === "minLength" ? "80" : "확인할 문구"}
                  onChange={(e) =>
                    setEditCriteria((cs) =>
                      cs.map((x) =>
                        x.id === c.id ? { ...x, expected: e.target.value } : x,
                      ),
                    )
                  }
                />
              </div>
            </div>
          ))}
          <button
            className="primary wide"
            disabled={editCriteria.some(
              (c) =>
                !c.label.trim() ||
                (c.kind === "contains" && !c.expected.trim()) ||
                (c.kind === "minLength" && !(Number(c.expected) > 0)),
            )}
            onClick={() => {
              updateMission({
                ...mission!,
                criteria: editCriteria,
                checks: undefined,
                evidence: undefined,
                verifiedSignature: undefined,
              });
              setModal(null);
            }}
          >
            이 조건으로 약속하기
          </button>
        </Modal>
      )}
      {modal === "cancel" && (
        <Modal title="이 Mission을 보류할까요?" onClose={() => setModal(null)}>
          <p>
            할 일은 목록에 남겨둡니다. 현재 실행 단계와 검증 결과는 초기화되며,
            주차한 생각은 새로운 할 일로 보관합니다.
          </p>
          <button
            className="primary wide"
            onClick={() => {
              setState((s) => ({
                ...s,
                mission: null,
                tasks: [
                  ...s.tasks,
                  ...(s.mission?.parked || []).map((title) => ({
                    id: uid(),
                    title,
                    minutes: 30,
                    priority: 1,
                    energy: "low" as const,
                    source: "manual" as const,
                  })),
                ],
              }));
              setModal(null);
              setTab("today");
            }}
          >
            보류하고 다시 고르기
          </button>
        </Modal>
      )}
      {modal === "reset" && (
        <Modal
          title="샘플 체험을 처음부터 시작할까요?"
          onClose={() => setModal(null)}
        >
          <p>
            샘플 Mission과 체험 기록을 초기화합니다. 실제 작업 데이터는 바뀌지
            않습니다.
          </p>
          <button
            className="primary wide"
            onClick={() => {
              setState(initialState(true));
              setTab("today");
              setModal(null);
              setError("");
            }}
          >
            체험 초기화
          </button>
        </Modal>
      )}
      {selectedReceipt && (
        <Modal
          title="근거가 담긴 완료 기록"
          onClose={() => setSelectedReceipt(null)}
        >
          <h3>{selectedReceipt.title}</h3>
          <p>
            {selectedReceipt.mode} ·{" "}
            {new Date(selectedReceipt.completedAt).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}
          </p>
          {selectedReceipt.checks.map((c) => (
            <div className="receipt-check" key={c.criterionId}>
              <CheckCircle2 size={17} />
              <div>
                <strong>{c.label}</strong>
                <p>{c.detail}</p>
              </div>
            </div>
          ))}
          <small>
            근거: {selectedReceipt.evidence?.label}
            <br />
            계획: {selectedReceipt.planSource}
          </small>
          <button
            className="primary wide"
            onClick={() => exportReceipt(selectedReceipt)}
          >
            <Download size={16} />
            Markdown으로 저장
          </button>
        </Modal>
      )}
    </div>
  );
}
