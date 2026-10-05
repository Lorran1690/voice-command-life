import { useCallback, useEffect, useState } from "react";
import { Brain, CheckCircle2, Circle, NotebookPen } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Task = { id: string; title: string; status: string; due_at: string | null };
type Note = { id: string; title: string; content: string };
type Memory = { id: string; fact: string };

type Tab = "tasks" | "notes" | "memories";

export function TasksPanel() {
  const [tab, setTab] = useState<Tab>("tasks");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);

  const load = useCallback(async () => {
    const [tasksResult, notesResult, memoriesResult] = await Promise.all([
      supabase.from("tasks").select("id, title, status, due_at").order("created_at", { ascending: false }).limit(30),
      supabase.from("notes").select("id, title, content").order("updated_at", { ascending: false }).limit(20),
      supabase.from("memories").select("id, fact").order("created_at", { ascending: false }).limit(30),
    ]);
    if (tasksResult.data) setTasks(tasksResult.data);
    if (notesResult.data) setNotes(notesResult.data);
    if (memoriesResult.data) setMemories(memoriesResult.data);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("jarvis-panels")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "memories" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  async function toggleTask(task: Task) {
    const next = task.status === "done" ? "pending" : "done";
    const { error } = await supabase
      .from("tasks")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", task.id);
    if (error) toast.error("Não foi possível atualizar a tarefa.");
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "tasks", label: "Tarefas", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    { id: "notes", label: "Notas", icon: <NotebookPen className="h-3.5 w-3.5" /> },
    { id: "memories", label: "Memória", icon: <Brain className="h-3.5 w-3.5" /> },
  ];

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card/30">
      <div className="flex border-b border-border">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors",
              tab === item.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "tasks" && (
          <ul className="space-y-1">
            {tasks.map((task) => (
              <li key={task.id}>
                <button
                  onClick={() => void toggleTask(task)}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/50"
                >
                  {task.status === "done" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={cn(task.status === "done" && "text-muted-foreground line-through")}>
                    {task.title}
                    {task.due_at && (
                      <span className="block text-xs text-muted-foreground">
                        {new Date(task.due_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
            {!tasks.length && <p className="px-2 py-4 text-center text-xs text-muted-foreground">Nenhuma tarefa. Peça ao Jarvis para criar uma.</p>}
          </ul>
        )}

        {tab === "notes" && (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id} className="rounded-md border border-border bg-background/60 p-2">
                <p className="text-sm font-medium text-foreground">{note.title}</p>
                <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">{note.content}</p>
              </li>
            ))}
            {!notes.length && <p className="px-2 py-4 text-center text-xs text-muted-foreground">Nenhuma anotação ainda.</p>}
          </ul>
        )}

        {tab === "memories" && (
          <ul className="space-y-1.5">
            {memories.map((memory) => (
              <li key={memory.id} className="rounded-md bg-background/60 px-2 py-1.5 text-xs text-foreground/90">
                {memory.fact}
              </li>
            ))}
            {!memories.length && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                O Jarvis ainda não memorizou nada sobre você.
              </p>
            )}
          </ul>
        )}
      </div>
    </aside>
  );
}
