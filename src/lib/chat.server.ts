import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./ai-gateway-run-id.server";
import { createJarvisTools, loadMemoriesForPrompt, JARVIS_PERSONA } from "./jarvis-tools.server";
import { bearerToken, getUserScopedClient } from "./supabase-user.server";

const GATEWAY_BASE_URL = "https://ai.gateway.lovable.dev/v1";
const CHAT_MODEL = "openai/gpt-6-astra";

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleChat(request: Request): Promise<Response> {
  const token = bearerToken(request);
  if (!token) return jsonError(401, "Sessão não encontrada. Entre novamente.");
  const auth = await getUserScopedClient(token);
  if (!auth) return jsonError(401, "Sessão inválida ou expirada. Entre novamente.");

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return jsonError(500, "Configuração de IA ausente no servidor.");

  let body: { messages?: UIMessage[]; threadId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Pedido inválido.");
  }
  const messages = body.messages;
  const threadId = body.threadId;
  if (!Array.isArray(messages) || !messages.length) return jsonError(400, "Mensagens ausentes.");
  if (!threadId) return jsonError(400, "Conversa não identificada.");

  // The thread must belong to this user before we read or write anything.
  const { data: thread, error: threadError } = await auth.supabase
    .from("threads")
    .select("id")
    .eq("id", threadId)
    .single();
  if (threadError || !thread) return jsonError(404, "Conversa não encontrada.");

  // Persist the latest user message (idempotent-ish: skip if already stored).
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (lastUser) {
    const { error: insertError } = await auth.supabase.from("messages").insert({
      thread_id: threadId,
      user_id: auth.userId,
      role: "user",
      parts: lastUser.parts,
    });
    if (insertError) console.error("Failed to persist user message", insertError);
  }

  const memories = await loadMemoriesForPrompt(auth.supabase);
  const modelMessages = await convertToModelMessages(messages);

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY_BASE_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(CHAT_MODEL),
    abortSignal: request.signal,
    maxRetries: 0,
    stopWhen: stepCountIs(50),
    system:
      JARVIS_PERSONA +
      "\nResponda em português do Brasil. Você pode usar markdown nas respostas de texto. " +
      "Use as ferramentas para criar/listar/concluir tarefas, salvar/listar anotações e memorizar/consultar fatos; confirme ações com os dados reais retornados." +
      (memories ? `\nFatos memorizados sobre o usuário:\n${memories}` : ""),
    messages: modelMessages,
    tools: createJarvisTools(auth.supabase, auth.userId),
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
    onFinish: async ({ responseMessage }) => {
      const { error } = await auth.supabase.from("messages").insert({
        thread_id: threadId,
        user_id: auth.userId,
        role: "assistant",
        parts: responseMessage.parts as unknown as import("@/integrations/supabase/types").Json,
      });
      if (error) console.error("Failed to persist assistant message", error);
      // Name the thread after the first user message.
      const firstUser = messages.find((message) => message.role === "user");
      const firstText = firstUser?.parts.find((part) => part.type === "text")?.text;
      if (firstText) {
        await auth.supabase
          .from("threads")
          .update({ title: firstText.slice(0, 60) })
          .eq("id", threadId)
          .eq("title", "Nova conversa");
      }
      await auth.supabase
        .from("threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", threadId);
    },
  });

  return withLovableAiGatewayRunIdHeader(response, runIdFetch);
}
