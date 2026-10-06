import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import jarvisCore from "@/assets/jarvis-core.png";
import { setLocalUser } from "@/lib/local-mode";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — J.A.R.V.I.S." },
      { name: "description", content: "Identificação local do J.A.R.V.I.S." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function enter() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Digite seu nome para continuar.");
      return;
    }

    setBusy(true);
    setLocalUser(trimmed);
    await new Promise((resolve) => window.setTimeout(resolve, 750));
    await navigate({ to: "/" });
  }

  return (
    <div className="jarvis-login-screen jarvis-grid-bg">
      <div className="jarvis-login-scan" aria-hidden="true" />
      <div className="jarvis-login-stars" aria-hidden="true" />

      <div className="jarvis-login-panel">
        <div className="jarvis-login-core" aria-hidden="true">
          <span className="jarvis-login-ring jarvis-login-ring--outer" />
          <span className="jarvis-login-ring jarvis-login-ring--inner" />
          <span className="jarvis-login-core-scan" />
          <span className="jarvis-login-pulse" />
          <img src={jarvisCore} alt="" />
        </div>

        <div className="jarvis-login-heading">
          <span className="jarvis-login-kicker">LOCAL SYSTEM // VIOLET CORE</span>
          <h1>J.A.R.V.I.S.</h1>
          <p>Identificação do operador</p>
        </div>

        <form
          className="jarvis-login-form"
          onSubmit={(event) => {
            event.preventDefault();
            void enter();
          }}
        >
          <label htmlFor="local-name">Como devo chamá-lo?</label>
          <div className="jarvis-login-input-wrap">
            <span className="jarvis-login-input-prefix">ID</span>
            <input
              id="local-name"
              type="text"
              autoFocus
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Seu nome"
              maxLength={40}
            />
            <span className="jarvis-login-cursor" aria-hidden="true" />
          </div>

          <button type="submit" disabled={busy}>
            <span>{busy ? "INICIALIZANDO NÚCLEO..." : "ENTRAR NO SISTEMA"}</span>
            <span className="jarvis-login-arrow" aria-hidden="true">↗</span>
          </button>
        </form>

        <div className="jarvis-login-status">
          <span className="jarvis-login-status-dot" />
          <span>CORE LOCAL</span>
          <span>OLLAMA // QWEN3 4B</span>
        </div>

        <p className="jarvis-login-note">Sem senha, sem Google e sem nuvem. Identidade mantida neste computador.</p>
      </div>
    </div>
  );
}
