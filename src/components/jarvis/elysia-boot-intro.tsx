import { useCallback, useEffect, useRef, useState } from "react";

type ElysiaBootIntroProps = {
  onFinished: () => void;
};

/**
 * Visual boot overlay. The app mounts underneath and remains available if the
 * renderer fails or the user skips. The iframe runs a self-contained local HTML
 * animation, with no network resources or AI/backend dependencies.
 */
export function ElysiaBootIntro({ onFinished }: ElysiaBootIntroProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const finishedRef = useRef(false);
  const callbackRef = useRef(onFinished);
  const closeTimeoutRef = useRef<number | undefined>(undefined);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    callbackRef.current = onFinished;
  }, [onFinished]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => callbackRef.current(), 600);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "ELYSIA_BOOT_FINISHED") finish();
    };
    window.addEventListener("message", onMessage);

    // Never block access to the assistant if GPU animation or the iframe fails.
    const safetyTimeout = window.setTimeout(finish, 11500);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(safetyTimeout);
      window.clearTimeout(closeTimeoutRef.current);
    };
  }, [finish]);

  return (
    <div
      role="dialog"
      aria-label="Inicialização da E.L.Y.S.I.A."
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        backgroundColor: "#030204",
        opacity: closing ? 0 : 1,
        pointerEvents: closing ? "none" : "auto",
        transition: "opacity 600ms ease",
      }}
    >
      <iframe
        ref={iframeRef}
        title="Despertar da E.L.Y.S.I.A."
        src="/intro/elysia-intro.html?embedded=1"
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
      />
      <button
        type="button"
        onClick={finish}
        style={{
          position: "absolute",
          left: "1.2rem",
          bottom: "1rem",
          color: "#debc80",
          fontSize: "11px",
          background: "#170f0bd9",
          border: "1px solid #f7c06a50",
          padding: "0.55rem 0.9rem",
          borderRadius: "99px",
          cursor: "pointer",
        }}
      >
        Pular animação
      </button>
    </div>
  );
}
