import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Thread = { id: string; title: string; updated_at: string };

export function ThreadSidebar() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const [threads, setThreads] = useState<Thread[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("threads")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("Não foi possível carregar as conversas.");
      return;
    }
    setThreads(data ?? []);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("threads-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "threads" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  async function createThread() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("threads")
      .insert({ user_id: user.id, title: "Nova conversa" })
      .select("id")
      .single();
    if (error || !data) {
      toast.error("Não foi possível criar a conversa.");
      return;
    }
    navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
  }

  async function deleteThread(id: string) {
    const { error } = await supabase.from("threads").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível apagar a conversa.");
      return;
    }
    if (params.threadId === id) navigate({ to: "/" });
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="border-b border-sidebar-border p-3">
        <button
          onClick={createThread}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-sidebar-primary px-3 py-2 text-sm font-semibold text-sidebar-primary-foreground transition-opacity hover:opacity-90"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Nova conversa
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {threads.map((thread) => (
          <div
            key={thread.id}
            className={cn(
              "group mb-1 flex items-center gap-1 rounded-md px-2 py-2 text-sm transition-colors",
              params.threadId === thread.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
            )}
          >
            <button
              onClick={() => navigate({ to: "/chat/$threadId", params: { threadId: thread.id } })}
              className="flex-1 truncate text-left"
              title={thread.title}
            >
              {thread.title}
            </button>
            <button
              onClick={() => void deleteThread(thread.id)}
              className="rounded p-1 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              aria-label="Apagar conversa"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {!threads.length && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nenhuma conversa ainda.</p>
        )}
      </div>
    </aside>
  );
}
