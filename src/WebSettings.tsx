import { useEffect, useState } from "react";
import type { Settings, CalendarEvent } from "./types";
import { enableNotifications } from "./notifications";
export default function WebSettings({
  onEvents,
  notify,
}: {
  onEvents: (e: CalendarEvent[], at: string, s: "import") => void;
  notify: (s: string) => void;
}) {
  const [status, setStatus] = useState<Settings | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    window
      .shipone!.settings()
      .then(setStatus)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="settings-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1>가볍게 연결하고, 하나씩 끝내요.</h1>
          <p>PC·모바일 브라우저에서 쓰는 나만의 작업 공간.</p>
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="connection-grid">
        <section className="panel">
          <h2>AI 도깨비 준비 완료</h2>
          <span className="pill green">
            {status?.hasOpenAI ? "서버 연결 준비됨" : "연결 확인 중"}
          </span>
          <p>
            추천과 막힘 해결은 실제 OpenAI API로 처리합니다. 키는 서버에만
            보관하며 브라우저에 전달하지 않습니다.
          </p>
          <p>
            계획을 함께 세우는 모델:{" "}
            <strong>{status?.model || "gpt-6.1-sol"}</strong>
          </p>
          <div className="usage">
            <span>
              이 브라우저 요청 <strong>{status?.requests || 0}회</strong>
            </span>
            <span>
              입력 <strong>{status?.inputTokens || 0}</strong>
            </span>
            <span>
              출력 <strong>{status?.outputTokens || 0}</strong>
            </span>
          </div>
          <small>
            공개 체험은 서버의 요청 제한을 적용합니다. 한도에 도달해도
            시간·우선순위 추천과 결과 검증은 사용할 수 있어요.
          </small>
        </section>
        <section className="panel">
          <h2>Google Calendar</h2>
          <span className="pill">계정 연결 준비 중</span>
          <p>
            버튼으로 Google 계정을 연결하고 오늘 일정을 읽는 기능을 준비하고
            있어요. 해커톤 체험은 샘플 일정·직접 입력으로 바로 사용할 수
            있습니다.
          </p>
          <button
            className="primary"
            onClick={() =>
              notify(
                "Google Calendar 계정 연결은 출시 준비 중입니다. 샘플 일정 또는 일정 JSON 가져오기를 이용해주세요.",
              )
            }
          >
            Google Calendar 연결
          </button>
        </section>
        <section className="panel">
          <h2>Notion</h2>
          <span className="pill">계정 연결 준비 중</span>
          <p>
            공유할 작업 데이터베이스를 선택하는 계정 연결을 준비하고 있어요.
            토큰을 복사할 필요 없는 방식으로 제공할 예정입니다.
          </p>
          <button
            className="secondary"
            onClick={() =>
              notify(
                "Notion 계정 연결은 출시 준비 중입니다. 지금은 할 일을 직접 추가해 체험해주세요.",
              )
            }
          >
            Notion 연결
          </button>
        </section>
        <section className="panel">
          <h2>일정 가져오기</h2>
          <p>
            직접 일정을 추가하거나 title, start, end를 담은 JSON 배열을
            가져오세요. Notion·Google 계정의 웹 연결은 다음 단계입니다.
          </p>
          <button
            className="primary"
            onClick={async () => {
              try {
                const e = await window.shipone!.importCalendar();
                if (e) {
                  onEvents(e, new Date().toISOString(), "import");
                  notify(`${e.length}개 일정을 가져왔습니다.`);
                }
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            일정 JSON 가져오기
          </button>
        </section>
        <section className="panel">
          <h2>도깨비 알림</h2>
          <p>
            웹앱이 열려 있는 동안 집중 시간 종료와 작업 완료를 알려드려요.
            브라우저의 백그라운드 제한에 따라 알림이 늦어질 수 있습니다.
          </p>
          <button
            className="primary"
            onClick={async () => {
              try {
                await enableNotifications();
                notify("브라우저 알림을 켰습니다.");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            알림 켜기 · 테스트 보내기
          </button>
          <button
            className="text-btn"
            onClick={() => {
              localStorage.setItem("shipone-notifications", "off");
              notify("ShipOne 알림을 껐습니다.");
            }}
          >
            알림 끄기
          </button>
          <p>
            <small>
              탭을 닫은 뒤에도 받는 서버 푸시는 다음 버전에서 제공합니다.
            </small>
          </p>
        </section>
        <section className="panel">
          <h2>내 데이터와 도깨비</h2>
          <p>
            작업과 완료 기록은 이 브라우저에 저장됩니다. 기기 간 동기화는 아직
            지원하지 않습니다. AI 버튼을 누르면 작업 제목·일정 구간·질문이
            OpenAI로 전달됩니다. 직접 제출한 결과물 검사는 브라우저에서
            수행합니다.
          </p>
          <p>
            도깨비의 스피커 버튼으로 기기 음성을 켜거나 끌 수 있습니다. 마이크나
            화면 녹화 권한을 요구하지 않습니다.
          </p>
        </section>
        <section className="panel">
          <h2>ShipOne 더 알아보기</h2>
          <p>
            <a href="./pitch/">발표자료 보기 →</a>
          </p>
          <p>
            <a href="./video/">60초 사용 영상 →</a>
          </p>
          <p>
            <a
              href="https://github.com/itgoblin-develop/shipone-oba-2026"
              target="_blank"
              rel="noreferrer"
            >
              공개 GitHub →
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
