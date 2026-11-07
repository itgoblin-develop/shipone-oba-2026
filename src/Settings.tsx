import { useEffect, useState } from "react";
import { KeyRound, Link2, ShieldCheck, RefreshCw } from "lucide-react";
import type { Settings as SettingsType, Task, CalendarEvent } from "./types";
import { External } from "./components";
export default function Settings({
  sample,
  onTasks,
  onEvents,
  notify,
}: {
  sample: boolean;
  onTasks: (t: Task[], at: string) => void;
  onEvents: (
    e: CalendarEvent[],
    at: string,
    source: "google" | "import",
  ) => void;
  notify: (s: string) => void;
}) {
  const api = window.shipone;
  const [status, setStatus] = useState<SettingsType | null>(null),
    [form, setForm] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (api)
      api
        .settings()
        .then(setStatus)
        .catch((e) => setError(e.message));
  }, []);
  async function run(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setError("");
    try {
      await fn();
      if (api) setStatus(await api.settings());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const field = (
    key: string,
    label: string,
    type = "text",
    placeholder = "",
  ) => (
    <label>
      {label}
      <input
        disabled={!api || !!busy || sample}
        type={type}
        autoComplete="off"
        value={
          form[key] ?? (status?.[key as keyof SettingsType] as string) ?? ""
        }
        placeholder={placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </label>
  );
  return (
    <div className="settings-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR CONNECTIONS</span>
          <h1>도깨비에게 맥락을 주세요.</h1>
          <p>필요한 자료만 연결하고, 오늘 끝낼 일을 더 정확하게 고르세요.</p>
        </div>
        <ShieldCheck size={32} />
      </div>
      {!api && (
        <div className="notice">
          웹은 설치 없이 살펴보는 체험판입니다. API 키와 실제 계정 연결은
          Windows 앱에서만 설정할 수 있습니다.
        </div>
      )}
      {api && sample && (
        <div className="notice">
          샘플 체험 중입니다. 실제 연결은 상단의 ‘내 작업으로 돌아가기’를 눌러
          설정해주세요.
        </div>
      )}
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <div className="connection-grid">
        <section className="panel">
          <div className="card-title">
            <KeyRound />
            <h2>OpenAI</h2>
            <span className={"pill " + (status?.hasOpenAI ? "green" : "")}>
              {status?.hasOpenAI ? "키 저장됨" : "연결 필요"}
            </span>
          </div>
          <p>
            Mission 추천과 막힘 해결에 사용합니다. 연결 성공은 실제 요청을
            완료한 뒤 확인할 수 있어요.
          </p>
          {field(
            "openaiKey",
            "API 키",
            "password",
            "sk-… · 기존 키는 표시하지 않음",
          )}
          {field("model", "사용 모델", "text", "gpt-4.1-mini")}
          <small>
            키는 Windows 보안 저장소로 암호화합니다. 웹 데모와 Git에는 포함되지
            않습니다.
            {status &&
              (status.secureStorage
                ? " 이 PC의 암호화 저장소를 사용할 수 있습니다."
                : " 이 PC의 암호화 저장소가 준비되지 않아 키를 저장할 수 없습니다.")}
          </small>
          <button
            className="primary"
            disabled={!api || !!busy || sample}
            onClick={() =>
              run("openai", async () => {
                await api!.configure(form);
                setForm((f) => ({
                  ...f,
                  openaiKey: "",
                  notionToken: "",
                  googleClientSecret: "",
                }));
                notify("연결 설정을 저장했습니다.");
              })
            }
          >
            설정 저장
          </button>
          <div className="usage">
            <span>
              실제 API 요청 <strong>{status?.requests ?? 0}회</strong>
            </span>
            <span>
              입력{" "}
              <strong>
                {(status?.inputTokens ?? 0).toLocaleString()} tokens
              </strong>
            </span>
            <span>
              출력{" "}
              <strong>
                {(status?.outputTokens ?? 0).toLocaleString()} tokens
              </strong>
            </span>
          </div>
        </section>
        <section className="panel">
          <div className="card-title">
            <span className="service-logo">N</span>
            <h2>Notion</h2>
            <span className={"pill " + (status?.hasNotion ? "green" : "")}>
              {status?.hasNotion ? "토큰 저장됨" : "연결 필요"}
            </span>
          </div>
          <p>
            지정한 데이터베이스의 제목·상태·마감·예상시간을 읽습니다. 원본을
            수정하지 않습니다.
          </p>
          {field(
            "notionToken",
            "Internal Integration 토큰",
            "password",
            "ntn_…",
          )}
          {field(
            "notionSource",
            "데이터베이스 / 데이터 소스 ID",
            "text",
            "32자리 ID 또는 하이픈 포함 ID",
          )}
          <small>
            Notion에서 해당 데이터베이스를 연결에 공유해주세요. 예상시간은
            이름에 ‘분’, ‘시간’, ‘minutes’, ‘duration’이 있는 숫자 속성을 분
            단위로 읽습니다. 없으면 30분입니다.
          </small>
          <div className="button-row">
            <button
              className="secondary"
              disabled={!api || !!busy || sample}
              onClick={() =>
                run("notion-save", async () => {
                  await api!.configure(form);
                  setForm((f) => ({ ...f, notionToken: "" }));
                  notify("Notion 설정을 저장했습니다.");
                })
              }
            >
              설정 저장
            </button>
            <button
              className="primary"
              disabled={!api || !!busy || sample}
              onClick={() =>
                run("notion", async () => {
                  const r = await api!.notion();
                  onTasks(r.tasks, r.syncedAt);
                  notify(
                    `${r.tasks.length}개 작업을 읽었습니다.${r.truncated ? " 첫 100개만 표시됩니다." : ""}`,
                  );
                })
              }
            >
              <RefreshCw size={16} />
              {busy === "notion" ? "읽는 중…" : "작업 불러오기"}
            </button>
          </div>
          <External url="https://www.notion.so/profile/integrations">
            Notion 연결 관리
          </External>
        </section>
        <section className="panel">
          <div className="card-title">
            <span className="service-logo calendar-logo">31</span>
            <h2>Google Calendar</h2>
            <span className={"pill " + (status?.hasGoogle ? "green" : "")}>
              {status?.hasGoogle ? "연결됨" : "연결 필요"}
            </span>
          </div>
          <p>
            오늘 기본 캘린더의 바쁜 시간을 읽어 연속된 집중 시간을 찾습니다.
            일정 생성·수정 권한은 요청하지 않습니다.
          </p>
          {field(
            "googleClientId",
            "Desktop OAuth Client ID",
            "text",
            "…apps.googleusercontent.com",
          )}
          {field(
            "googleClientSecret",
            "Desktop OAuth Client Secret",
            "password",
            "Google Cloud 데스크톱 앱 자격 증명",
          )}
          <small>
            초기 배포 설정: Google Cloud에서 Calendar API를 켜고 Desktop OAuth
            클라이언트를 생성해야 합니다. 테스트 모드에서는 테스트 사용자 등록이
            필요할 수 있습니다.
          </small>
          <div className="button-row">
            <button
              className="secondary"
              disabled={!api || !!busy || sample}
              onClick={() =>
                run("google", async () => {
                  await api!.configure(form);
                  setForm((f) => ({ ...f, googleClientSecret: "" }));
                  await api!.googleConnect();
                  notify("Google Calendar 연결을 완료했습니다.");
                })
              }
            >
              <Link2 size={16} />
              {busy === "google" ? "브라우저에서 연결 중…" : "Google 계정 연결"}
            </button>
            <button
              className="primary"
              disabled={!api || !!busy || sample || !status?.hasGoogle}
              onClick={() =>
                run("calendar", async () => {
                  const r = await api!.calendar();
                  onEvents(r.events, r.syncedAt, "google");
                  notify(`${r.events.length}개 일정을 읽었습니다.`);
                })
              }
            >
              <RefreshCw size={16} />
              일정 새로고침
            </button>
          </div>
        </section>
        <section className="panel">
          <h2>일정 파일로 시작하기</h2>
          <p>
            Google 연결 전에도 title, start, end를 담은 JSON 배열을 가져올 수
            있습니다. 같은 파일을 다시 읽으면 이전 파일 일정을 대체합니다.
          </p>
          <button
            className="secondary"
            disabled={!api || !!busy || sample}
            onClick={() =>
              run("import", async () => {
                const events = await api!.importCalendar();
                if (events) {
                  onEvents(events, new Date().toISOString(), "import");
                  notify(`${events.length}개 일정을 파일에서 읽었습니다.`);
                }
              })
            }
          >
            일정 JSON 파일 가져오기
          </button>
        </section>
        <section className="panel privacy-panel">
          <ShieldCheck size={30} />
          <h2>당신의 일은 당신 곁에.</h2>
          <p>
            현재 Windows 버전의 작업 기록은 이 PC에 저장됩니다. 추천할 때 선택한
            작업·일정이 OpenAI에 전달됩니다. 결과물 검사는 기본적으로 로컬에서
            수행합니다.
          </p>
          <ul>
            <li>계정 키는 OS 암호화 저장</li>
            <li>Notion과 Calendar는 읽기 전용</li>
            <li>파일은 직접 선택한 것만 검사</li>
            <li>모바일 동기화와 스토어 출시는 다음 단계</li>
          </ul>
          {api && (
            <div className="disconnect">
              <span>연결 해제</span>
              {["openai", "notion", "google"].map((x) => (
                <button
                  className="text-btn"
                  disabled={!!busy}
                  key={x}
                  onClick={() =>
                    run("disconnect", async () => {
                      await api.configure({ disconnect: x });
                      notify(`${x} 연결 정보를 삭제했습니다.`);
                    })
                  }
                >
                  {x}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
