import { useState } from "react";
import {
  FileText,
  Globe,
  Upload,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import type { Mission, Evidence } from "./types";
import { evaluate, signature, canShip } from "../shared/core.mjs";
import { sampleEvidenceBroken, sampleEvidenceFixed } from "./data";
import { CheckIcon, time } from "./components";
export default function Review({
  mission,
  sample,
  onChange,
  onShip,
}: {
  mission: Mission;
  sample: boolean;
  onChange: (m: Mission) => void;
  onShip: () => void;
}) {
  const [kind, setKind] = useState<"text" | "url" | "file">(
      mission.evidence?.kind || "text",
    ),
    [text, setText] = useState(
      mission.evidence?.kind === "text" ? mission.evidence.text : "",
    ),
    [url, setUrl] = useState(
      mission.evidence?.kind === "url" ? mission.evidence.label : "",
    ),
    [manual, setManual] = useState<Record<string, boolean>>(
      Object.fromEntries(
        (mission.checks || [])
          .filter((c) => c.status === "manual")
          .map((c) => [c.criterionId, true]),
      ),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function invalidate() {
    if (mission.checks)
      onChange({
        ...mission,
        checks: undefined,
        evidence: undefined,
        verifiedSignature: undefined,
      });
  }
  function changeText(value: string) {
    setText(value);
    invalidate();
  }
  function changeKind(value: "text" | "url" | "file") {
    setKind(value);
    invalidate();
  }
  async function verify() {
    setError("");
    setBusy(true);
    try {
      let evidence: Evidence | null = null;
      if (kind === "text") {
        if (!text.trim() && !Object.values(manual).some(Boolean))
          throw new Error("결과물을 붙여넣거나 직접 확인 항목을 체크해주세요.");
        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(text),
        );
        const hash = Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        evidence = {
          kind: "text",
          text,
          hash,
          label: sample ? "체험용 소개 문서" : "붙여넣은 결과물",
          checkedAt: new Date().toISOString(),
        };
      } else if (kind === "file") {
        evidence = await window.shipone!.readFile();
      } else {
        evidence = await window.shipone!.verifyUrl(url);
      }
      if (!evidence) return;
      const checks = evaluate(mission.criteria, evidence, manual);
      onChange({
        ...mission,
        status: "review",
        checks,
        evidence,
        verifiedSignature: signature(mission.criteria),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const passed =
    mission.checks?.filter((c) => ["pass", "manual"].includes(c.status))
      .length || 0;
  return (
    <div className="review-layout">
      <section className="panel evidence-panel">
        <span className="eyebrow">PROVE YOUR PROGRESS</span>
        <h2>‘완료’를 근거로 확인해요.</h2>
        <p>작업을 시작할 때 약속한 조건으로 검사합니다.</p>
        <div className="segmented" aria-label="근거 종류">
          <button
            disabled={busy}
            aria-pressed={kind === "text"}
            onClick={() => changeKind("text")}
          >
            <FileText size={16} />
            텍스트
          </button>
          <button
            aria-pressed={kind === "url"}
            disabled={busy || !window.shipone || sample}
            onClick={() => changeKind("url")}
          >
            <Globe size={16} />
            공개 URL
          </button>
          <button
            aria-pressed={kind === "file"}
            disabled={busy || !window.shipone || sample}
            onClick={() => changeKind("file")}
          >
            <Upload size={16} />
            파일
          </button>
        </div>
        {kind === "text" && (
          <label>
            결과 내용
            <textarea
              maxLength={100000}
              disabled={busy}
              value={text}
              onChange={(e) => changeText(e.target.value)}
              rows={9}
              placeholder="완성한 문서·안내 문구·결과 설명을 붙여넣으세요."
            />
          </label>
        )}
        {kind === "url" && (
          <>
            <label>
              공개 웹 주소
              <input
                disabled={busy}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  invalidate();
                }}
                placeholder="https://…"
                type="url"
              />
            </label>
            <div className="notice">
              HTTP 응답과 서버가 반환한 텍스트를 검사합니다. 로그인, 동적
              렌더링, 버튼·폼 동작은 자동으로 검증하지 않습니다.
            </div>
          </>
        )}
        {kind === "file" && (
          <div className="file-drop">
            <Upload />
            <p>검사 버튼을 누르면 파일 선택창이 열립니다.</p>
            <small>TXT · MD · HTML · JSON · CSV / 최대 1MB</small>
          </div>
        )}
        {sample && (
          <div className="sample-actions">
            <span>시연용 결과물 불러오기</span>
            <button
              disabled={busy}
              className="secondary"
              onClick={() => changeText(sampleEvidenceBroken)}
            >
              1. 신청 안내 누락
            </button>
            <button
              disabled={busy}
              className="secondary"
              onClick={() => changeText(sampleEvidenceFixed)}
            >
              2. 수정된 결과물
            </button>
          </div>
        )}
        {mission.criteria
          .filter((c) => c.kind === "manual")
          .map((c) => (
            <label className="check-label" key={c.id}>
              <input
                disabled={busy}
                type="checkbox"
                checked={!!manual[c.id]}
                onChange={(e) => {
                  setManual((m) => ({ ...m, [c.id]: e.target.checked }));
                  invalidate();
                }}
              />
              <span>
                {c.label}
                <small>사용자 확인으로 별도 기록됩니다.</small>
              </span>
            </label>
          ))}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <button className="primary wide" disabled={busy} onClick={verify}>
          <ShieldCheck size={18} />
          {busy
            ? "근거를 확인하고 있어요…"
            : mission.checks
              ? "다시 검증하기"
              : "완료 조건 검증하기"}
        </button>
      </section>
      <section className="panel proof-panel">
        <div className="card-title">
          <h2>약속한 완료 조건</h2>
          <span className="pill">
            {passed} / {mission.criteria.length}
          </span>
        </div>
        <div className="proof-list">
          {mission.criteria.map((c) => {
            const check = mission.checks?.find((x) => x.criterionId === c.id);
            return (
              <div
                className={"proof-row " + (check?.status || "pending")}
                key={c.id}
              >
                <span className="proof-icon">
                  <CheckIcon status={check?.status || "unknown"} />
                </span>
                <div>
                  <strong>{c.label}</strong>
                  <p>
                    {check?.detail ||
                      (c.kind === "manual"
                        ? "직접 확인이 필요한 조건"
                        : "검증할 결과물을 기다리고 있어요.")}
                  </p>
                  <span className="proof-tag">
                    {check
                      ? {
                          pass: "자동 검사 통과",
                          fail: "수정 필요",
                          unknown: "확인 불가",
                          manual: "사용자 확인",
                        }[check.status]
                      : "검사 대기"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {mission.evidence && (
          <div className="evidence-meta">
            <FileText size={16} />
            <div>
              <strong>{mission.evidence.label}</strong>
              <small>
                {time(mission.evidence.checkedAt)}에 검사 ·{" "}
                {mission.evidence.hash ? "SHA-256 기록" : "텍스트 근거 기록"}
              </small>
            </div>
          </div>
        )}
        {canShip(mission) ? (
          <div className="proof-success">
            <CheckCircle2 />
            <h3>약속한 조건을 충족했어요.</h3>
            <p>
              {mission.checks?.some((c) => c.status === "manual")
                ? "사용자 확인 항목을 포함합니다."
                : "제출한 근거에서 모든 자동 검사 조건을 확인했습니다."}
            </p>
            <button className="primary wide" onClick={onShip}>
              완료 기록 남기기
              <ArrowRight size={17} />
            </button>
          </div>
        ) : (
          <div className="proof-next">
            <strong>
              {mission.checks ? "조금만 더, 끝까지." : "확인한 만큼만, 완료."}
            </strong>
            <p>
              {mission.checks
                ? "실패하거나 확인하지 못한 항목을 해결한 뒤 다시 검증해주세요."
                : "체크 표시만으로 끝내지 않고, 확인 근거를 함께 남깁니다."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
