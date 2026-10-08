import { useEffect, useState } from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const THREADS_KEY = "jarvis-local-threads";
type Thread = { id: string; title: string };
function readThreads(): Thread[] {
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    if (raw) return JSON.parse(raw) as Thread[];
  } catch { /* Keep the existing local session available. */ }
  return [{ id: "local", title: "Sessão principal" }];
}
export function ThreadSidebar() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setThreads(readThreads()); setLoaded(true); }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
  }, [threads, loaded]);
  function createThread() {
    const id = "local-" + Date.now().toString(36);
    setThreads(current => [{ id, title: "Nova conversa" }, ...current]);
    void navigate({ to: "/chat/$threadId", params: { threadId: id } });
  }
  function deleteThread(id: string) {
    if (id === "local") return;
    setThreads(current => current.filter(thread => thread.id !== id));
    if (params.threadId === id) void navigate({ to: "/chat/$threadId", params: { threadId: "local" }, replace: true });
  }
  return (
    <aside className="command-rail" aria-label="Histórico de conversas">
      <div className="rail-heading"><span className="hud-eyebrow">ARQUIVO DE CONVERSAS</span><span className="rail-count">{threads.length}</span></div>
      <div className="px-4 pb-4"><Button onClick={createThread} variant="outline" className="new-conversation w-full"><Plus />Nova conversa</Button></div>
      <div className="rail-list">
        <p className="hud-eyebrow mb-3 px-2 text-muted-foreground">SESSÕES</p>
        {threads.map(thread => (
          <div key={thread.id} className={cn("thread-item group", params.threadId === thread.id && "thread-item--active")}>
            <Button variant="ghost" onClick={() => void navigate({ to: "/chat/$threadId", params: { threadId: thread.id } })} className="thread-link" aria-current={params.threadId === thread.id ? "page" : undefined}>
              <MessageSquare className="shrink-0"/><span className="truncate">{thread.title}</span>
            </Button>
            {thread.id !== "local" && <Button size="icon" variant="ghost" onClick={() => deleteThread(thread.id)} className="thread-delete" aria-label="Apagar conversa" title="Apagar conversa"><Trash2 /></Button>}
          </div>
        ))}
      </div>
      <div className="rail-footer"><MessageSquare className="size-3.5"/><span>Histórico neste dispositivo</span></div>
    </aside>
  );
}
