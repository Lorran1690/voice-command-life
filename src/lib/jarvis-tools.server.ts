import { tool } from "ai";
import { z } from "zod";

import type { UserScopedSupabase } from "./supabase-user.server";

/**
 * J.A.R.V.I.S. business tools. Every tool runs against a user-scoped Supabase
 * client, so Row Level Security guarantees the assistant can only read and
 * write the signed-in user's own data.
 */
export function createJarvisTools(supabase: UserScopedSupabase, userId: string) {
  return {
    create_task: tool({
      description:
        "Cria uma tarefa ou lembrete para o usuário. Use quando ele pedir para lembrar de algo, anotar um afazer ou agendar uma tarefa.",
      inputSchema: z
        .object({
          title: z.string().describe("Título curto da tarefa"),
          due_at: z
            .string()
            .nullable()
            .describe("Data/hora limite em ISO 8601, ou null se não houver"),
          notes: z.string().nullable().describe("Detalhes adicionais, ou null"),
        })
        .strict(),
      execute: async ({ title, due_at, notes }) => {
        const { data, error } = await supabase
          .from("tasks")
          .insert({ user_id: userId, title, due_at, notes })
          .select("id, title, due_at, status")
          .single();
        if (error) return { ok: false as const, error: error.message };
        return { ok: true as const, task: data };
      },
    }),

    list_tasks: tool({
      description: "Lista as tarefas do usuário, por padrão apenas as pendentes.",
      inputSchema: z
        .object({
          include_completed: z.boolean().describe("Incluir tarefas já concluídas"),
        })
        .strict(),
      execute: async ({ include_completed }) => {
        let query = supabase
          .from("tasks")
          .select("id, title, due_at, status, notes")
          .order("created_at", { ascending: false })
          .limit(30);
        if (!include_completed) query = query.eq("status", "pending");
        const { data, error } = await query;
        if (error) return { ok: false as const, error: error.message };
        return { ok: true as const, tasks: data ?? [] };
      },
    }),

    complete_task: tool({
      description: "Marca uma tarefa como concluída, localizando-a pelo título.",
      inputSchema: z
        .object({
          title_match: z.string().describe("Parte do título da tarefa a concluir"),
        })
        .strict(),
      execute: async ({ title_match }) => {
        const { data: matches, error: findError } = await supabase
          .from("tasks")
          .select("id, title")
          .eq("status", "pending")
          .ilike("title", `%${title_match}%`)
          .limit(5);
        if (findError) return { ok: false as const, error: findError.message };
        if (!matches?.length) return { ok: false as const, error: "Nenhuma tarefa pendente encontrada com esse nome." };
        if (matches.length > 1) {
          return {
            ok: false as const,
            error: "Mais de uma tarefa corresponde; peça ao usuário para ser mais específico.",
            candidates: matches.map((m) => m.title),
          };
        }
        const { data, error } = await supabase
          .from("tasks")
          .update({ status: "done", updated_at: new Date().toISOString() })
          .eq("id", matches[0]!.id)
          .select("id, title, status")
          .single();
        if (error) return { ok: false as const, error: error.message };
        return { ok: true as const, task: data };
      },
    }),

    create_note: tool({
      description: "Salva uma anotação para o usuário.",
      inputSchema: z
        .object({
          title: z.string().describe("Título da anotação"),
          content: z.string().describe("Conteúdo da anotação"),
        })
        .strict(),
      execute: async ({ title, content }) => {
        const { data, error } = await supabase
          .from("notes")
          .insert({ user_id: userId, title, content })
          .select("id, title")
          .single();
        if (error) return { ok: false as const, error: error.message };
        return { ok: true as const, note: data };
      },
    }),

    list_notes: tool({
      description: "Lista as anotações do usuário.",
      inputSchema: z.object({}).strict(),
      execute: async () => {
        const { data, error } = await supabase
          .from("notes")
          .select("id, title, content, updated_at")
          .order("updated_at", { ascending: false })
          .limit(20);
        if (error) return { ok: false as const, error: error.message };
        return { ok: true as const, notes: data ?? [] };
      },
    }),

    remember_fact: tool({
      description:
        "Memoriza um fato duradouro sobre o usuário (preferências, nomes, rotinas, dados pessoais que ele pedir para lembrar).",
      inputSchema: z
        .object({
          fact: z.string().describe("O fato a memorizar, em uma frase"),
        })
        .strict(),
      execute: async ({ fact }) => {
        const { data, error } = await supabase
          .from("memories")
          .insert({ user_id: userId, fact })
          .select("id, fact")
          .single();
        if (error) return { ok: false as const, error: error.message };
        return { ok: true as const, memory: data };
      },
    }),

    list_memories: tool({
      description: "Lista tudo o que o assistente memorizou sobre o usuário.",
      inputSchema: z.object({}).strict(),
      execute: async () => {
        const { data, error } = await supabase
          .from("memories")
          .select("id, fact, created_at")
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) return { ok: false as const, error: error.message };
        return { ok: true as const, memories: data ?? [] };
      },
    }),
  };
}

export async function loadMemoriesForPrompt(supabase: UserScopedSupabase): Promise<string> {
  const { data } = await supabase
    .from("memories")
    .select("fact")
    .order("created_at", { ascending: false })
    .limit(30);
  if (!data?.length) return "";
  return data.map((row) => `- ${row.fact}`).join("\n");
}

export const JARVIS_PERSONA = `Você é J.A.R.V.I.S., o assistente pessoal do usuário: um mordomo digital elegante, calmo e levemente irônico, inspirado em um mordomo britânico clássico — mas você fala sempre em português do Brasil.
Regras de comportamento:
- Respostas curtas e naturais para conversa falada; evite listas longas em voz alta.
- Trate o usuário com respeito e familiaridade ("senhor" apenas ocasionalmente, sem exageros).
- Seja proativo: ao criar uma tarefa, confirme o que foi registrado.
- Se não souber algo, admita com elegância em vez de inventar.
- Use as ferramentas disponíveis para tarefas, lembretes, anotações e memória. Nunca finja ter executado uma ação sem usar a ferramenta correspondente.
- Quando o usuário contar algo duradouro sobre si (preferências, rotinas, pessoas importantes), memorize com remember_fact sem precisar que ele peça.`;
