import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import jarvisCore from "@/assets/jarvis-core.png";
import { getLocalUser, isLocalMode, setLocalUser } from "@/lib/local-mode";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — J.A.R.V.I.S." },
      { name: "description", content: "Acesse seu assistente pessoal J.A.R.V.I.S." },
      { property: "og:title", content: "Entrar — J.A.R.V.I.S." },
      { property: "og:description", content: "Acesse seu assistente pessoal J.A.R.V.I.S." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const local = isLocalMode();

function LocalAuthPage() {
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
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    await navigate({ to: "/" });
  }

  return (
    <div className="jarvis-login-screen jarvis-grid-bg">
      <div className="jarvis-login-scan" aria-hidden="true" />
      <div className="jarvis-login-circuit jarvis-login-circuit--a" aria-hidden="true" />
      <div className="jarvis-login-circuit jarvis-login-circuit--b" aria-hidden="true" />

      <div className="jarvis-login-panel">
        <div className="jarvis-login-core" aria-hidden="true">
          <span className="jarvis-login-ring jarvis-login-ring--outer" />
          <span className="jarvis-login-ring jarvis-login-ring--inner" />
          <span className="jarvis-login-pulse" />
          <img src={jarvisCore} alt="" />
        </div>

        <div className="jarvis-login-heading">
          <span className="jarvis-login-kicker">STARK // LOCAL SYSTEM</span>
          <h1>J.A.R.V.I.S.</h1>
          <p>Identificação pessoal</p>
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
          </div>

          <button type="submit" disabled={busy}>
            <span>{busy ? "INICIALIZANDO..." : "ENTRAR NO SISTEMA"}</span>
            <span className="jarvis-login-arrow" aria-hidden="true">↗</span>
          </button>
        </form>

        <div className="jarvis-login-status">
          <span className="jarvis-login-status-dot" />
          <span>CORE LOCAL ONLINE</span>
          <span>OLLAMA // QWEN3 4B</span>
        </div>

        <p className="jarvis-login-note">Sem senha. Sem Google. Identidade mantida localmente neste computador.</p>
      </div>
    </div>
  );
}

  async function handleEmail(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      toast.success("Link de acesso enviado para seu e-mail.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o acesso.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Não foi possível entrar com o Google.");
      return;
    }
    if (result.redirected) return; // browser is navigating to Google
    setBusy(false);
    navigate({ to: "/" });
  }

  if (local) return <LocalAuthPage />;

  return (
    <div className="jarvis-grid-bg relative flex min-h-screen items-center justify-center px-4">
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={jarvisCore} alt="J.A.R.V.I.S." width={1024} height={1024} className="h-20 w-20" />
          <h1 className="mt-4 text-2xl font-semibold tracking-[0.3em] text-primary">J.A.R.V.I.S.</h1>
          <p className="mt-1 text-sm text-muted-foreground">Seu assistente pessoal. Acesso por link seguro.</p>
        </div>

        <div className="rounded-xl border border-border bg-card/80 p-6 shadow-2xl backdrop-blur">
          <form onSubmit={handleEmail} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                placeholder="voce@exemplo.com"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Senha
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Enviar link de acesso
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            ou
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            Continuar com Google
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            {mode === "signin" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
