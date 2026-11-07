import { useEffect, useRef, useId, type ReactNode } from "react";
import {
  Check,
  AlertCircle,
  HelpCircle,
  UserCheck,
  ArrowUpRight,
} from "lucide-react";
export function Goblin({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "goblin small" : "goblin"}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <path d="M22 35L17 10 40 26M60 26L83 10 78 35" fill="#b6e6a6" />
      <rect x="15" y="25" width="70" height="61" rx="25" fill="#b6e6a6" />
      <path
        d="M30 47h10m20 0h10"
        stroke="#193d36"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M35 64q15 16 30 0"
        stroke="#193d36"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M44 67v8" stroke="#fffdf6" strokeWidth="5" />
      <circle cx="24" cy="61" r="5" fill="#e0a080" />
      <circle cx="76" cy="61" r="5" fill="#e0a080" />
    </svg>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
    ref.current
      ?.querySelector<HTMLElement>(
        "input:not([disabled]),textarea:not([disabled])",
      )
      ?.focus();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      aria-labelledby={titleId}
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="닫기">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function CheckIcon({ status }: { status: string }) {
  return status === "pass" ? (
    <Check size={17} />
  ) : status === "fail" ? (
    <AlertCircle size={17} />
  ) : status === "manual" ? (
    <UserCheck size={17} />
  ) : (
    <HelpCircle size={17} />
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <Goblin />
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function Source({ source }: { source: string }) {
  return (
    <span className={"source " + source}>
      {source === "sample"
        ? "체험 데이터"
        : source === "notion"
          ? "Notion"
          : source === "google"
            ? "Google Calendar"
            : source === "import"
              ? "가져온 일정"
              : "직접 입력"}
    </span>
  );
}
export function External({
  url,
  children,
}: {
  url: string;
  children: ReactNode;
}) {
  return (
    <button
      className="text-btn"
      onClick={() => {
        if (window.shipone) void window.shipone.openExternal(url);
        else window.open(url, "_blank", "noopener,noreferrer");
      }}
    >
      {children}
      <ArrowUpRight size={14} />
    </button>
  );
}
export const time = (s: string) =>
  new Date(s).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
