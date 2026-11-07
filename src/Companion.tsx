import { useEffect, useRef, useState } from "react";
import { Goblin } from "./components";
import type { Mission } from "./types";
import { MessageCircle, Volume2, VolumeX, X, ArrowRight } from "lucide-react";
import { sendNotification } from "./notifications";
export default function Companion({
  mission,
  elapsed,
  onOpen,
}: {
  mission: Mission | null;
  elapsed: number;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false),
    [voice, setVoice] = useState(false),
    [message, setMessage] = useState(
      "오늘은 하나만. 내가 마무리까지 같이 갈게요.",
    ),
    [question, setQuestion] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const dismiss = (e: Event) => {
      if (e.target instanceof Element && !e.target.closest(".ship-companion"))
        setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const last = useRef("");
  const notified = useRef("");
  useEffect(() => {
    const event =
      mission?.status === "shipped"
        ? "done"
        : mission?.status === "active" && elapsed >= mission.minutes * 60
          ? "time"
          : "";
    if (!mission || !event) return;
    const id = mission.id + event;
    if (
      notified.current === id ||
      localStorage.getItem("shipone-last-notification") === id
    )
      return;
    notified.current = id;
    localStorage.setItem("shipone-last-notification", id);
    void sendNotification(
      event === "done" ? "하나 끝냈어요!" : "끝났나요?",
      event === "done"
        ? mission.title + " 완료 기록을 남겼어요."
        : "집중 시간이 끝났어요. 결과물을 확인하거나 다음 단계를 정해요.",
    ).catch(() => {});
  }, [mission, elapsed]);
  function speak(text: string) {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ko-KR";
      u.rate = 1;
      speechSynthesis.speak(u);
    }
  }
  useEffect(() => {
    let key = "",
      text = "";
    if (mission?.status === "shipped") {
      key = mission.id + "done";
      text = "하나 끝냈네요! 완료 기록까지 남겼어요. 잠깐 쉬어도 좋아요.";
    } else if (
      mission?.status === "active" &&
      elapsed >= mission.minutes * 60
    ) {
      key = mission.id + "time";
      text =
        "끝났나요? 결과물을 함께 확인해요. 아직이면 막힌 부분을 말해주세요.";
    } else if (mission?.status === "active") {
      key = mission.id + "start";
      text =
        "좋아요. 지금은 이 하나에 집중해요. 다른 생각은 잠깐 보관해둘게요.";
    } else if (mission?.status === "ready") {
      key = mission.id + "ready";
      text = "지금 끝낼 하나를 골랐어요. 완료 조건을 살펴보고 시작해볼까요?";
    }
    if (key && key !== last.current) {
      last.current = key;
      setMessage(text);
      if (matchMedia("(min-width: 768px)").matches) setOpen(true);
      if (voice) speak(text);
    }
  }, [mission?.id, mission?.status, elapsed, voice]);
  useEffect(
    () => () => {
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    },
    [],
  );
  async function ask() {
    if (!question.trim() || busy) return;
    setBusy(true);
    try {
      const r = await window.shipone!.replan({
        mission: mission
          ? {
              title: mission.title,
              criteria: mission.criteria,
              steps: mission.steps,
            }
          : null,
        blocker: question,
        elapsedMinutes: Math.floor(elapsed / 60),
      });
      setMessage(r.suggestion);
      setQuestion("");
      if (voice) speak(r.suggestion);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside
      className={"ship-companion " + (open ? "expanded" : "")}
      aria-label="도깨비 동료"
    >
      {open && (
        <div className="companion-bubble" id="shipone-companion-panel">
          <div className="companion-head">
            <strong>곁에 있는 도깨비</strong>
            <button
              aria-label={voice ? "음성 끄기" : "음성 켜기"}
              title="기기 음성으로 읽기"
              onClick={() => {
                if (voice) {
                  speechSynthesis.cancel();
                  setVoice(false);
                } else {
                  setVoice(true);
                  speak(message);
                }
              }}
            >
              {voice ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
            <button aria-label="말풍선 접기" onClick={() => setOpen(false)}>
              <X size={17} />
            </button>
          </div>
          <p role="status">{message}</p>
          <button className="companion-action" onClick={onOpen}>
            내 작업 보기 <ArrowRight size={14} />
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask();
            }}
          >
            <input
              aria-label="도깨비에게 질문"
              placeholder="막힌 부분을 이야기해요"
              value={question}
              maxLength={1500}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button
              disabled={busy || !question.trim()}
              aria-label="도깨비에게 보내기"
            >
              {busy ? "…" : "↑"}
            </button>
          </form>
          <small>답변: OpenAI · 음성: 기기 TTS · 마이크 사용 안 함</small>
        </div>
      )}
      <button
        className="companion-pet"
        onClick={() => setOpen(!open)}
        aria-label="도깨비와 이야기하기"
        aria-expanded={open}
        aria-controls="shipone-companion-panel"
      >
        <Goblin />
        <span>
          <MessageCircle size={13} />
          {mission?.status === "shipped" ? "해냈다!" : "끝났나요?"}
        </span>
      </button>
    </aside>
  );
}
