import { useEffect, useState } from "react";
import { Brain, CheckCircle2, Circle, NotebookPen, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Task = { id: string; title: string; done: boolean };
type Note = { id: string; title: string; content: string };
type Memory = { id: string; fact: string };
type Tab = "tasks" | "notes" | "memories";

const TASKS = "jarvis-local-tasks";
const NOTES = "jarvis-local-notes";
const MEMORIES = "jarvis-local-memories";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function TasksPanel() {
  const [tab, setTab] = useState<Tab>("tasks");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes] = useState<Note[]>([]);
  const [memories] = useState<Memory[]>([]);
  const [newTask, setNewTask] = useState("");

  useEffect(() => setTasks(read<Task[]>(TASKS, [])), []);

  function persist(next: Task[]) {
    setTasks(next);
    localStorage.setItem(TASKS, JSON.stringify(next));
  }

  function addTask() {
    const title = newTask.trim();
    if (!title) {
      toast.error("Digite uma tarefa.");
      return;
    }
    persist([{ id: Date.now().toString(), title, done: false }, ...tasks]);
    setNewTask("");
  }

  function toggle(task: Task) {
    persist(tasks.map((item) => item.id === task.id ? { ...item, done: !item.done } : item));
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "tasks", label: "Tarefas", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    { id: "notes", label: "Notas", icon: <NotebookPen className="h-3.5 w-3.5" /> },
    { id: "memories", label: "Memória", icon: <Brain className="h-3.5 w-3.5" /> },
  ];

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card/30">
      <div className="flex border-b border-border">
        {tabs.map((item) => (
          <button key={item.id} onClick={() => setTab(item.id)} className={cn("flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors", tab === item.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground")}>
            {item.icon}{item.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "tasks" && (
          <>
            <div className="mb-3 flex gap-2">
              <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTask(); }} placeholder="Nova tarefa" className="min-w-0 flex-1 rounded-md border border-primary/15 bg-background px-2 py-2 text-xs text-foreground outline-none focus:border-primary/40" />
              <button type="button" onClick={addTask} className="rounded-md border border-primary/25 px-2 text-primary" title="Adicionar"><Plus className="h-4 w-4" /></button>
            </div>
            <ul className="space-y-1">
              {tasks.map((task) => (
                <li key={task.id}>
                  <button onClick={() => toggle(task)} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/50">
                    {task.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                    <span className={cn(task.done && "text-muted-foreground line-through")}>{task.title}</span>
                  </button>
                </li>
              ))}
              {!tasks.length && <p className="px-2 py-4 text-center text-xs text-muted-foreground">Nenhuma tarefa local.</p>}
            </ul>
          </>
        )}

        {tab === "notes" && <p className="px-2 py-4 text-center text-xs text-muted-foreground">Notas locais entram na próxima camada do JARVIS.</p>}
        {tab === "memories" && <p className="px-2 py-4 text-center text-xs text-muted-foreground">Memória local entra na próxima camada do JARVIS.</p>}
      </div>
    </aside>
  );
}
