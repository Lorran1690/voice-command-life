import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import {
  LogOut,
  MessagesSquare,
  ListTodo,
  Settings2,
  PanelLeftClose,
  PanelRightClose,
  PanelLeftOpen,
  PanelRightOpen,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import jarvisCore from "@/assets/jarvis-core.png";
import { AssistantSettings } from "@/components/jarvis/assistant-settings";
import { ChatWindow } from "@/components/jarvis/chat-window";
import { TasksPanel } from "@/components/jarvis/tasks-panel";
import { ThreadSidebar } from "@/components/jarvis/thread-sidebar";
import { VoicePanel } from "@/components/jarvis/voice-panel";
import { voiceLabels, type VoicePhase } from "@/components/jarvis/hud-state";
import { clearLocalUser, getLocalUser } from "@/lib/local-mode";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Centro de comando — J.A.R.V.I.S." },
      {
        name: "description",
        content: "Centro de comando pessoal J.A.R.V.I.S.: conversas, voz e organização.",
      },
      { property: "og:title", content: "Centro de comando — J.A.R.V.I.S." },
      {
        property: "og:description",
        content: "Conversas, voz e organização em uma interface de comando original.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});
const EMPTY_MESSAGES: UIMessage[] = [];
function ChatPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const [operator, setOperator] = useState("Operador");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [phase, setPhase] = useState<VoicePhase>("ready");
  const [coreOnline, setCoreOnline] = useState<boolean | null>(null);
  const [clock, setClock] = useState<Date | null>(null);
  useEffect(() => {
    setOperator(getLocalUser()?.name ?? "Operador");
    setClock(new Date());
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  function signOut() {
    clearLocalUser();
    void navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="command-shell jarvis-grid-bg">
      <div className="viewport-corners" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <header className="command-header">
        <div className="command-brand">
          <img src={jarvisCore} alt="" width={1024} height={1024} />
          <div className="min-w-0">
            <h1>J.A.R.V.I.S.</h1>
            <p>PERSONAL COMMAND CENTER</p>
          </div>
        </div>
        <div className="connection-readout" data-online={coreOnline === true}>
          <span className="hud-status-dot" />
          <div>
            <span>
              {coreOnline === null
                ? "Verificando conexão"
                : coreOnline
                  ? "Núcleo conectado"
                  : "Núcleo desconectado"}
            </span>
            <small>{phase === "ready" ? "CANAL LOCAL" : voiceLabels[phase]}</small>
          </div>
        </div>
        <div className="command-header-actions">
          <div className="system-clock">
            <time>{clock?.toLocaleTimeString("pt-BR") ?? "—"}</time>
            <span>
              {clock?.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }) ?? "—"}
            </span>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" title="Configurações" aria-label="Configurações">
                <Settings2 />
              </Button>
            </SheetTrigger>
            <SheetContent className="hud-drawer flex flex-col p-0" aria-describedby={undefined}>
              <SheetHeader className="border-b border-border p-5">
                <SheetTitle>Configurações</SheetTitle>
              </SheetHeader>
              <AssistantSettings />
            </SheetContent>
          </Sheet>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            aria-label="Sair"
            title="Sair"
            className="text-muted-foreground"
          >
            <LogOut />
          </Button>
        </div>
      </header>
      <div className="command-toolbar">
        <div className="desktop-rail-controls">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLeftOpen((value) => !value)}
            aria-label={leftOpen ? "Recolher conversas" : "Expandir conversas"}
            title={leftOpen ? "Recolher conversas" : "Expandir conversas"}
          >
            {leftOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </Button>
          <span className="hud-eyebrow text-muted-foreground">CONVERSAS</span>
        </div>
        <div className="mobile-rail-controls">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Conversas">
                <MessagesSquare />
                Conversas
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="hud-drawer flex flex-col p-0"
              aria-describedby={undefined}
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Conversas</SheetTitle>
              </SheetHeader>
              <ThreadSidebar />
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Organização">
                <ListTodo />
                Organização
              </Button>
            </SheetTrigger>
            <SheetContent className="hud-drawer flex flex-col p-0" aria-describedby={undefined}>
              <SheetHeader className="sr-only">
                <SheetTitle>Organização</SheetTitle>
              </SheetHeader>
              <TasksPanel />
            </SheetContent>
          </Sheet>
        </div>
        <div className="operator-label">
          <Activity className="size-3" />
          <span className="truncate">OPERADOR / {operator}</span>
        </div>
        <div className="desktop-rail-controls">
          <span className="hud-eyebrow text-muted-foreground">SYSTEM MEMORY</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setRightOpen((value) => !value)}
            aria-label={rightOpen ? "Recolher organização" : "Expandir organização"}
            title={rightOpen ? "Recolher organização" : "Expandir organização"}
          >
            {rightOpen ? <PanelRightClose /> : <PanelRightOpen />}
          </Button>
        </div>
      </div>
      <div
        className={cn(
          "command-workspace",
          !leftOpen && "command-workspace--no-left",
          !rightOpen && "command-workspace--no-right",
        )}
      >
        <div className={cn("desktop-rail desktop-rail--left", !leftOpen && "hidden-rail")}>
          <ThreadSidebar />
        </div>
        <main className="command-main">
          <VoicePanel onPhaseChange={setPhase} />
          <ChatWindow
            key={threadId}
            threadId={threadId}
            initialMessages={EMPTY_MESSAGES}
            onConnectionChange={setCoreOnline}
          />
        </main>
        <div className={cn("desktop-rail desktop-rail--right", !rightOpen && "hidden-rail")}>
          <TasksPanel />
        </div>
      </div>
      <footer className="command-footer">
        <span>
          <span className="hud-status-dot" />
          J.A.R.V.I.S. / LOCAL
        </span>
        <span>PERSONAL INTELLIGENCE</span>
      </footer>
    </div>
  );
}
