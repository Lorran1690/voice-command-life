import { tool } from "ai";
import { z } from "zod";

import type { UserScopedSupabase } from "./supabase-user.server";
import { loadAssistantSettings } from "./assistant-settings.server";

/**
 * J.A.R.V.I.S. business tools. Every tool runs against a user-scoped Supabase
 * client, so Row Level Security guarantees the assistant can only read and
 * write the signed-in user's own data.
 */
export function createJarvisTools(supabase: UserScopedSupabase, userId: string) {
  return {
    update_assistant_settings: tool({
      description: "Atualiza preferências do próprio J.A.R.V.I.S., como personalidade, tom, detalhamento, humor, proatividade, memória, velocidade da fala e voz.",
      inputSchema: z.object({
        personality: z.enum(["jarvis", "friendly", "professional", "coach", "gamer"]).optional(),
        tone: z.enum(["calm", "warm", "direct", "technical", "playful"]).optional(),
        verbosity: z.enum(["concise", "normal", "detailed"]).optional(),
        humor: z.number().min(0).max(100).optional(),
        proactive: z.boolean().optional(),
        confirm_actions: z.boolean().optional(),
        auto_memory: z.boolean().optional(),
        voice: z.string().min(1).max(64).optional(),
        voice_speed: z.number().min(0.75).max(1.25).optional(),
        custom_instructions: z.string().max(2000).optional(),
        hud_accent: z.enum(["cyan", "blue", "violet", "amber", "green"]).optional(),
        motion_intensity: z.enum(["low", "medium", "high"]).optional(),
      }).strict(),
      execute: async (changes) => {
        const current = await loadAssistantSettings(supabase, userId);
        const { data, error } = await supabase
          .from("assistant_settings")
          .upsert({ ...current, ...changes, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
          .select("*")
          .single();
        if (error) return { ok: false as const, error: error.message };
        return {
          ok: true as const,
          settings: {
            personality: data.personality,
            tone: data.tone,
            verbosity: data.verbosity,
            humor: data.humor,
            proactive: data.proactive,
            auto_memory: data.auto_memory,
            voice: data.voice,
            voice_speed: data.voice_speed,
            hud_accent: data.hud_accent,
            motion_intensity: data.motion_intensity,
          },
        };
      },
    }),

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

    update_task: tool({
      description: "Edita uma tarefa existente. Localiza pelo título e permite alterar título, prazo ou observações.",
      inputSchema: z.object({
        title_match: z.string().describe("Parte do título atual da tarefa"),
        new_title: z.string().optional().describe("Novo título, se quiser alterar"),
        due_at: z.string().nullable().optional().describe("Novo prazo em ISO 8601; null remove o prazo"),
        notes: z.string().nullable().optional().describe("Novas observações; null limpa as observações"),
      }).strict(),
      execute: async ({ title_match, new_title, due_at, notes }) => {
        const { data: matches, error: findError } = await supabase
          .from("tasks")
          .select("id, title")
          .ilike("title", "%" + title_match + "%")
          .limit(5);
        if (findError) return { ok: false as const, error: findError.message };
        if (!matches?.length) return { ok: false as const, error: "Nenhuma tarefa encontrada com esse nome." };
        if (matches.length > 1) return {
          ok: false as const,
          error: "Mais de uma tarefa corresponde; seja mais específico.",
          candidates: matches.map((m) => m.title),
        };
        const patch: { title?: string; due_at?: string | null; notes?: string | null; updated_at: string } = {
          updated_at: new Date().toISOString(),
        };
        if (new_title !== undefined) patch.title = new_title;
        if (due_at !== undefined) patch.due_at = due_at;
        if (notes !== undefined) patch.notes = notes;
        const { data, error } = await supabase
          .from("tasks")
          .update(patch)
          .eq("id", matches[0]!.id)
          .select("id, title, due_at, status, notes")
          .single();
        if (error) return { ok: false as const, error: error.message };
        return { ok: true as const, task: data };
      },
    }),

    delete_task: tool({
      description: "Exclui uma tarefa do usuário, localizando-a pelo título. Peça confirmação somente quando houver ambiguidade.",
      inputSchema: z.object({
        title_match: z.string().describe("Parte do título da tarefa a excluir"),
      }).strict(),
      execute: async ({ title_match }) => {
        const { data: matches, error: findError } = await supabase
          .from("tasks")
          .select("id, title")
          .ilike("title", "%" + title_match + "%")
          .limit(5);
        if (findError) return { ok: false as const, error: findError.message };
        if (!matches?.length) return { ok: false as const, error: "Nenhuma tarefa encontrada com esse nome." };
        if (matches.length > 1) return {
          ok: false as const,
          error: "Mais de uma tarefa corresponde; seja mais específico.",
          candidates: matches.map((m) => m.title),
        };
        const { error } = await supabase.from("tasks").delete().eq("id", matches[0]!.id);
        if (error) return { ok: false as const, error: error.message };
        return { ok: true as const, deleted: matches[0] };
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

    update_note: tool({
      description: "Edita uma anotação existente pelo título.",
      inputSchema: z.object({
        title_match: z.string().describe("Parte do título atual da anotação"),
        new_title: z.string().optional().describe("Novo título"),
        content: z.string().optional().describe("Novo conteúdo"),
      }).strict().refine((value) => value.new_title !== undefined || value.content !== undefined, {
        message: "Informe pelo menos um campo para atualizar.",
      }),
      execute: async ({ title_match, new_title, content: newContent }) => {
        const { data: matches, error: findError } = await supabase
          .from("notes")
          .select("id, title")
          .ilike("title", "%" + title_match + "%")
          .limit(5);
        if (findError) return { ok: false as const, error: findError.message };
        if (!matches?.length) return { ok: false as const, error: "Nenhuma anotação encontrada com esse nome." };
        if (matches.length > 1) return {
          ok: false as const,
          error: "Mais de uma anotação corresponde; seja mais específico.",
          candidates: matches.map((m) => m.title),
        };
        const patch: { title?: string; content?: string; updated_at: string } = { updated_at: new Date().toISOString() };
        if (new_title !== undefined) patch.title = new_title;
        if (newContent !== undefined) patch.content = newContent;
        const { data, error } = await supabase
          .from("notes")
          .update(patch)
          .eq("id", matches[0]!.id)
          .select("id, title, content, updated_at")
          .single();
        if (error) return { ok: false as const, error: error.message };
        return { ok: true as const, note: data };
      },
    }),

    search_notes: tool({
      description: "Pesquisa anotações por título ou conteúdo.",
      inputSchema: z.object({
        query: z.string().describe("Palavra ou frase para procurar"),
      }).strict(),
      execute: async ({ query }) => {
        const { data, error } = await supabase
          .from("notes")
          .select("id, title, content, updated_at")
          .or("title.ilike.%" + query + "%,content.ilike.%" + query + "%")
          .order("updated_at", { ascending: false })
          .limit(20);
        if (error) return { ok: false as const, error: error.message };
        return { ok: true as const, notes: data ?? [] };
      },
    }),

    delete_note: tool({
      description: "Exclui uma anotação pelo título.",
      inputSchema: z.object({
        title_match: z.string().describe("Parte do título da anotação a excluir"),
      }).strict(),
      execute: async ({ title_match }) => {
        const { data: matches, error: findError } = await supabase
          .from("notes")
          .select("id, title")
          .ilike("title", "%" + title_match + "%")
          .limit(5);
        if (findError) return { ok: false as const, error: findError.message };
        if (!matches?.length) return { ok: false as const, error: "Nenhuma anotação encontrada com esse nome." };
        if (matches.length > 1) return {
          ok: false as const,
          error: "Mais de uma anotação corresponde; seja mais específico.",
          candidates: matches.map((m) => m.title),
        };
        const { error } = await supabase.from("notes").delete().eq("id", matches[0]!.id);
        if (error) return { ok: false as const, error: error.message };
        return { ok: true as const, deleted: matches[0] };
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

    forget_fact: tool({
      description: "Esquece um fato memorizado, procurando pela frase ou trecho informado.",
      inputSchema: z.object({
        fact_match: z.string().describe("Trecho do fato a esquecer"),
      }).strict(),
      execute: async ({ fact_match }) => {
        const { data: matches, error: findError } = await supabase
          .from("memories")
          .select("id, fact")
          .ilike("fact", "%" + fact_match + "%")
          .limit(5);
        if (findError) return { ok: false as const, error: findError.message };
        if (!matches?.length) return { ok: false as const, error: "Nenhuma memória encontrada com esse conteúdo." };
        if (matches.length > 1) return {
          ok: false as const,
          error: "Mais de uma memória corresponde; seja mais específico.",
          candidates: matches.map((m) => m.fact),
        };
        const { error } = await supabase.from("memories").delete().eq("id", matches[0]!.id);
        if (error) return { ok: false as const, error: error.message };
        return { ok: true as const, forgotten: matches[0] };
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
- Use as ferramentas disponíveis para criar, listar, editar e concluir/excluir tarefas; criar, listar, pesquisar, editar e excluir anotações; e memorizar, listar e esquecer fatos. Nunca finja ter executado uma ação sem usar a ferramenta correspondente.
- Quando o usuário contar algo duradouro sobre si (preferências, rotinas, pessoas importantes), memorize com remember_fact sem precisar que ele peça.`;
