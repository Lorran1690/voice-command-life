import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import { LogOut } from "lucide-react";

import jarvisCore from "@/assets/jarvis-core.png";
import { ChatWindow } from "@/components/jarvis/chat-window";
import { TasksPanel } from "@/components/jarvis/tasks-panel";
import { ThreadSidebar } from "@/components/jarvis/thread-sidebar";
import { VoicePanel } from "@/components/jarvis/voice-panel";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Conversa — J.A.R.V.I.S." },
      { name: "description", content: "Converse por texto ou voz com seu assistente pessoal J.A.R.V.I.S." },
      { property: "og:title", content: "Conversa — J.A.R.V.I.S." },
      { property: "og:description", content: "Converse por texto ou voz com seu assistente pessoal J.A.R.V.I.S." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);

  useEffect(() => {
    let active = true;
    setInitialMessages(null);
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, role, parts")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (!active) return;
      if (error) {
        navigate({ to: "/", replace: true });
        return;
      }
      setInitialMessages(
        (data ?? []).map((row) => ({
          id: row.id,
          role: row.role as UIMessage["role"],
          parts: (row.parts as UIMessage["parts"]) ?? [],
        })),
      );
    })();
    return () => {
      active = false;
    };
  }, [threadId, navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="jarvis-grid-bg flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <img src={jarvisCore} alt="" width={1024} height={1024} className="h-7 w-7" />
          <span className="text-sm font-semibold tracking-[0.25em] text-primary">J.A.R.V.I.S.</span>
        </div>
        <button
          onClick={() => void signOut()}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <ThreadSidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <VoicePanel />
          {initialMessages ? (
            <ChatWindow key={threadId} threadId={threadId} initialMessages={initialMessages} />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </main>
        <TasksPanel />
      </div>
    </div>
  );
}
