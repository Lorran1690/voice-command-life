import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import { LogOut, MessagesSquare, ListTodo, Settings2 } from "lucide-react";
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

      <main className="hud-main mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <VoicePanel />
        {initialMessages ? (
          <ChatWindow key={threadId} threadId={threadId} initialMessages={initialMessages} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </main>
    </div>
  );
}
