export type VoicePhase = "ready" | "connecting" | "listening" | "processing" | "speaking" | "error";

export const voiceLabels: Record<VoicePhase, string> = {
  ready: "Pronto para ouvir",
  connecting: "Ativando microfone",
  listening: "Ouvindo você",
  processing: "Processando comando",
  speaking: "J.A.R.V.I.S. falando",
  error: "Canal interrompido",
};

export function taskState(task: { done: boolean; due_at?: string | null }, now: number): "completed" | "overdue" | "pending" {
  if (task.done) return "completed";
  const deadline = task.due_at ? Date.parse(task.due_at) : NaN;
  return Number.isFinite(deadline) && deadline < now ? "overdue" : "pending";
}