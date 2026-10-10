import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import { Activity, Cpu, Gauge, LogOut, MessagesSquare, ListTodo, Settings2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import jarvisCore from "@/assets/jarvis-core.png";
import { AssistantSettings } from "@/components/jarvis/assistant-settings";
import { ChatWindow } from "@/components/jarvis/chat-window";
import { TasksPanel } from "@/components/jarvis/tasks-panel";
import { ThreadSidebar } from "@/components/jarvis/thread-sidebar";
import { VoicePanel } from "@/components/jarvis/voice-panel";
import { clearLocalUser, getLocalUser } from "@/lib/local-mode";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "J.A.R.V.I.S. — Local" },
      { name: "description", content: "J.A.R.V.I.S. rodando localmente." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);

  useEffect(() => {
    setInitialMessages([]);
  }, [threadId]);

  function signOut() {
    clearLocalUser();
    navigate({ to: "/auth", replace: true });
  }

  const operator = getLocalUser()?.name ?? "Operador";

  return (
    <div className="jarvis-grid-bg hud-shell flex h-dvh flex-col bg-background">
      <header className="hud-header hud-enter flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-8">
        <div className="flex items-center gap-2.5">
          <img src={jarvisCore} alt="" width={1024} height={1024} className="h-7 w-7" />
          <div>
            <h1 className="font-display text-base font-semibold text-primary sm:text-lg">J.A.R.V.I.S.</h1>
            <p className="font-display text-[8px] uppercase tracking-[0.14em] text-muted-foreground">Operador: {operator}</p>
          </div>
        </div>

        <div className="jarvis-header-status" aria-label="Demonstração visual">
          <span className="jarvis-status-led" />
          <span className="jarvis-header-status-title">HUD // DEMO VISUAL</span>
          <span className="jarvis-header-divider" />
          <span className="jarvis-header-status-detail">BLACK / VIOLET SYSTEM</span>
        </div>

        <nav className="flex items-center gap-1" aria-label="Painéis do Jarvis">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Configurações" title="Configurações">
                <Settings2 /><span className="hidden sm:inline">Configurar</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="hud-drawer flex flex-col p-0" aria-describedby={undefined}>
              <SheetHeader className="border-b border-border p-5">
                <SheetTitle className="font-display text-primary">Configurações locais</SheetTitle>
              </SheetHeader>
              <AssistantSettings />
            </SheetContent>
          </Sheet>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Conversas" title="Conversas">
                <MessagesSquare /><span className="hidden sm:inline">Conversas</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="hud-drawer flex flex-col p-0" aria-describedby={undefined}>
              <SheetHeader className="border-b border-border p-5"><SheetTitle className="font-display text-primary">Conversas locais</SheetTitle></SheetHeader>
              <ThreadSidebar />
            </SheetContent>
          </Sheet>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Organização" title="Tarefas, notas e memória">
                <ListTodo /><span className="hidden sm:inline">Organização</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="hud-drawer flex flex-col p-0" aria-describedby={undefined}>
              <SheetHeader className="border-b border-border p-5"><SheetTitle className="font-display text-primary">Organização local</SheetTitle></SheetHeader>
              <TasksPanel />
            </SheetContent>
          </Sheet>

          <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sair" title="Sair" className="text-muted-foreground">
            <LogOut /><span className="hidden sm:inline">Sair</span>
          </Button>
        </nav>
      </header>

      <main className="jarvis-command-layout hud-main">
        <aside className="jarvis-side-rail jarvis-side-rail--left" aria-label="Painel do operador">
          <div className="jarvis-panel-heading">
            <span>01 / OPERATOR</span>
            <span className="jarvis-panel-live">SESSION</span>
          </div>

          <section className="jarvis-operator-card">
            <div className="jarvis-operator-emblem"><ShieldCheck size={22} /></div>
            <span className="jarvis-micro-label">IDENTIDADE DO OPERADOR</span>
            <strong>{operator.toUpperCase()}</strong>
            <span className="jarvis-operator-foot">LOCAL PROFILE // ACTIVE</span>
            <div className="jarvis-card-corners" aria-hidden="true" />
          </section>

          <section className="jarvis-module-panel">
            <div className="jarvis-panel-heading">
              <span>MÓDULOS</span>
              <span>04</span>
            </div>
            <div className="jarvis-module-row">
              <span className="jarvis-module-index">01</span>
              <span className="jarvis-module-icon"><Cpu size={15} /></span>
              <span className="jarvis-module-copy"><strong>NÚCLEO JARVIS</strong><small>ARQUITETURA LOCAL</small></span>
              <span className="jarvis-module-dot" />
            </div>
            <div className="jarvis-module-row">
              <span className="jarvis-module-index">02</span>
              <span className="jarvis-module-icon"><Activity size={15} /></span>
              <span className="jarvis-module-copy"><strong>INTERFACE HUD</strong><small>CAMADA VISUAL</small></span>
              <span className="jarvis-module-dot jarvis-module-dot--active" />
            </div>
            <div className="jarvis-module-row">
              <span className="jarvis-module-index">03</span>
              <span className="jarvis-module-icon"><MessagesSquare size={15} /></span>
              <span className="jarvis-module-copy"><strong>CONVERSAS</strong><small>PAINEL DE SESSÃO</small></span>
              <span className="jarvis-module-dot" />
            </div>
            <div className="jarvis-module-row">
              <span className="jarvis-module-index">04</span>
              <span className="jarvis-module-icon"><Gauge size={15} /></span>
              <span className="jarvis-module-copy"><strong>DIAGNÓSTICO</strong><small>VISUALIZAÇÃO</small></span>
              <span className="jarvis-module-dot" />
            </div>
          </section>

          <section className="jarvis-rail-footer">
            <div className="jarvis-panel-heading"><span>DESIGN PROFILE</span><Sparkles size={13} /></div>
            <div className="jarvis-color-profile">
              <span className="jarvis-color-swatch jarvis-color-swatch--black" />
              <span className="jarvis-color-swatch jarvis-color-swatch--violet" />
              <span className="jarvis-color-swatch jarvis-color-swatch--ice" />
              <div><strong>VIOLET CORE</strong><small>VISUAL PRESET / 01</small></div>
            </div>
            <div className="jarvis-rail-grid" aria-hidden="true" />
          </section>
        </aside>

        <section className="jarvis-center-stage" aria-label="Centro de comando JARVIS">
          <div className="jarvis-stage-heading">
            <div>
              <span className="jarvis-eyebrow">TACTICAL INTERFACE <i /> BUILD 01.07</span>
              <h2>Centro de comando</h2>
            </div>
            <div className="jarvis-stage-chip"><span className="jarvis-status-led" /> VISUAL PREVIEW</div>
          </div>

          <VoicePanel />

          <section className="jarvis-chat-frame">
            <div className="jarvis-chat-frame-header">
              <div><span className="jarvis-frame-icon"><Zap size={13} /></span><span>CONSOLE // INTERAÇÃO</span></div>
              <span className="jarvis-frame-mode">INTERFACE DEMO</span>
            </div>
            {initialMessages ? (
              <ChatWindow key={threadId} threadId={threadId} initialMessages={initialMessages} />
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </section>
        </section>

        <aside className="jarvis-side-rail jarvis-side-rail--right" aria-label="Telemetria visual demonstrativa">
          <div className="jarvis-panel-heading">
            <span>02 / SYSTEM VIEW</span>
            <span className="jarvis-panel-live">PREVIEW</span>
          </div>

          <section className="jarvis-orbit-panel">
            <div className="jarvis-orbit-caption"><span>CORE VISUALIZER</span><span>FIG. 01</span></div>
            <div className="jarvis-mini-orbit" aria-hidden="true">
              <span className="jarvis-mini-orbit-ring jarvis-mini-orbit-ring--one" />
              <span className="jarvis-mini-orbit-ring jarvis-mini-orbit-ring--two" />
              <span className="jarvis-mini-orbit-ring jarvis-mini-orbit-ring--three" />
              <span className="jarvis-mini-orbit-core"><span /></span>
              <span className="jarvis-mini-orbit-node jarvis-mini-orbit-node--one" />
              <span className="jarvis-mini-orbit-node jarvis-mini-orbit-node--two" />
              <span className="jarvis-mini-orbit-node jarvis-mini-orbit-node--three" />
            </div>
            <div className="jarvis-orbit-readout"><span>ORBITAL VISUAL</span><strong>ACTIVE LAYER</strong></div>
          </section>

          <section className="jarvis-telemetry-panel">
            <div className="jarvis-panel-heading"><span>INTERFACE TELEMETRY</span><Activity size={13} /></div>
            <div className="jarvis-telemetry-row"><span>VISUAL LAYER</span><strong>ACTIVE</strong></div>
            <div className="jarvis-telemetry-row"><span>COLOR SYSTEM</span><strong>VIOLET / BLACK</strong></div>
            <div className="jarvis-telemetry-row"><span>MOTION PROFILE</span><strong>ORBITAL</strong></div>
            <div className="jarvis-telemetry-row"><span>VOICE / AI</span><strong>NOT IN DEMO</strong></div>
            <div className="jarvis-telemetry-bars" aria-hidden="true">
              <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
            </div>
            <p className="jarvis-telemetry-note">Elementos gráficos demonstrativos. Os dados não representam medições reais do computador.</p>
          </section>

          <section className="jarvis-status-card">
            <div className="jarvis-panel-heading"><span>DESIGN INTENT</span><ShieldCheck size={13} /></div>
            <div className="jarvis-status-title">Inteligência em foco.</div>
            <p>Uma interface cinematográfica, modular e legível. O visual não depende de conexão com serviços externos.</p>
            <div className="jarvis-status-rule"><span /><span /><span /></div>
          </section>
        </aside>
      </main>
    </div>
  );
}
