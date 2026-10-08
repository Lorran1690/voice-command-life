import { useEffect, useState } from "react";
import { Brain, CheckCircle2, Circle, Clock3, NotebookPen, Plus, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { taskState } from "@/components/jarvis/hud-state";
import { cn } from "@/lib/utils";

type Task = { id: string; title: string; done: boolean; due_at?: string | null };
type Note = { id: string; title: string; content: string };
type Memory = { id: string; fact: string };
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newTask, setNewTask] = useState("");
  const [now, setNow] = useState(0);
  useEffect(() => {
    const refresh = () => {
      setTasks(read<Task[]>(TASKS, []));
      setNotes(read<Note[]>(NOTES, []));
      setMemories(read<Memory[]>(MEMORIES, []));
      setNow(Date.now());
    };
    refresh();
    window.addEventListener("storage", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("storage", refresh);
      window.clearInterval(timer);
    };
  }, []);
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
  const pending = tasks.filter((task) => !task.done).length;
  return (
    <aside className="command-rail" aria-label="Organização pessoal">
      <div className="rail-heading">
        <span className="hud-eyebrow">MISSION CONTROL</span>
        <ListTodo className="size-4 text-hud-amber" />
      </div>
      <Tabs defaultValue="tasks" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="memory-tabs mx-4 mb-4 grid grid-cols-3">
          <TabsTrigger value="tasks" title="Tarefas" className="gap-1.5">
            <CheckCircle2 className="size-3.5" />
            <span>Tarefas</span>
            <small>{tasks.length}</small>
          </TabsTrigger>
          <TabsTrigger value="notes" title="Notas" className="gap-1.5">
            <NotebookPen className="size-3.5" />
            <span>Notas</span>
            <small>{notes.length}</small>
          </TabsTrigger>
          <TabsTrigger value="memories" title="Memória" className="gap-1.5">
            <Brain className="size-3.5" />
            <span>Memória</span>
            <small>{memories.length}</small>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tasks" className="memory-content">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addTask();
            }}
            className="task-composer"
          >
            <input
              aria-label="Nova tarefa"
              value={newTask}
              onChange={(event) => setNewTask(event.target.value)}
              placeholder="Adicionar tarefa…"
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              title="Adicionar tarefa"
              aria-label="Adicionar tarefa"
            >
              <Plus />
            </Button>
          </form>
          <div className="flex justify-between py-4">
            <span className="hud-eyebrow text-muted-foreground">OBJETIVOS</span>
            <span className="hud-eyebrow text-hud-amber">{pending} pendentes</span>
          </div>
          <ul className="space-y-2">
            {tasks.map((task) => {
              const state = taskState(task, now);
              return (
                <li key={task.id} className={cn("mission-item", `mission-item--${state}`)}>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      persist(
                        tasks.map((item) =>
                          item.id === task.id ? { ...item, done: !item.done } : item,
                        ),
                      )
                    }
                    className="mission-toggle"
                    aria-label={`${task.done ? "Reabrir" : "Concluir"} tarefa: ${task.title}`}
                  >
                    {task.done ? <CheckCircle2 /> : state === "overdue" ? <Clock3 /> : <Circle />}
                    <span className="min-w-0">
                      <span className={cn("block break-words", task.done && "line-through")}>
                        {task.title}
                      </span>
                      {task.due_at && (
                        <small className="mt-1 block">
                          {state === "overdue" ? "Atrasada · " : ""}
                          {new Date(task.due_at).toLocaleDateString("pt-BR")}
                        </small>
                      )}
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
          {!tasks.length && <Empty icon={<ListTodo />} text="Nenhuma tarefa registrada" />}
        </TabsContent>
        <TabsContent value="notes" className="memory-content">
          <p className="hud-eyebrow mb-4 text-muted-foreground">REGISTROS</p>
          {notes.map((note) => (
            <article key={note.id} className="memory-item">
              <NotebookPen className="size-4 text-hud-amber" />
              <h3>{note.title}</h3>
              <p>{note.content}</p>
            </article>
          ))}
          {!notes.length && <Empty icon={<NotebookPen />} text="Nenhuma nota registrada" />}
        </TabsContent>
        <TabsContent value="memories" className="memory-content">
          <p className="hud-eyebrow mb-4 text-muted-foreground">SYSTEM MEMORY</p>
          {memories.map((memory) => (
            <article key={memory.id} className="memory-item">
              <Brain className="size-4 text-primary" />
              <p>{memory.fact}</p>
            </article>
          ))}
          {!memories.length && <Empty icon={<Brain />} text="Nenhuma memória registrada" />}
        </TabsContent>
      </Tabs>
      <div className="rail-footer">
        <Brain className="size-3.5" />
        <span>Organização neste dispositivo</span>
      </div>
    </aside>
  );
}
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="rail-empty">
      {icon}
      <p>{text}</p>
    </div>
  );
}
