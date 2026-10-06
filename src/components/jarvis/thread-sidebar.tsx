import { useEffect, useState } from "react";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const THREADS_KEY = "jarvis-local-threads";

type Thread = { id: string; title: string };

function readThreads(): Thread[] {
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    if (raw) return JSON.parse(raw) as Thread[];
  } catch {}
  return [{ id: "local", title: "Sessão principal" }];
}

export function ThreadSidebar() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const [threads, setThreads] = useState<Thread[]>(readThreads);

  useEffect(() => {
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
  }, [threads]);

  function createThread() {
    const id = "local-" + Date.now().toString(36);
    setThreads((current) => [{ id, title: "Nova conversa" }, ...current]);
    navigate({ to: "/chat/$threadId", params: { threadId: id } });
  }

  function deleteThread(id: string) {
    if (id === "local") return;
    setThreads((current) => current.filter((thread) => thread.id !== id));
    if (params.threadId === id) {
      navigate({ to: "/chat/$threadId", params: { threadId: "local" }, replace: true });
    }
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="border-b border-sidebar-border p-3">
        <button onClick={createThread} className="flex w-full items-center justify-center gap-2 rounded-md bg-sidebar-primary px-3 py-2 text-sm font-semibold text-sidebar-primary-foreground">
          <MessageSquarePlus className="h-4 w-4" /> Nova conversa
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {threads.map((thread) => (
          <div key={thread.id} className={cn("group mb-1 flex items-center gap-1 rounded-md px-2 py-2 text-sm", params.threadId === thread.id ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60")}>
            <button onClick={() => navigate({ to: "/chat/$threadId", params: { threadId: thread.id } })} className="flex-1 truncate text-left">{thread.title}</button>
            {thread.id !== "local" && <button onClick={() => deleteThread(thread.id)} className="rounded p-1 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100" aria-label="Apagar conversa"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        ))}
      </div>
    </aside>
  );
}
