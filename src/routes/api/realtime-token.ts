import { createFileRoute } from "@tanstack/react-router";

import { buildAssistantInstructions } from "@/lib/assistant-settings.shared";
import { loadAssistantSettings } from "@/lib/assistant-settings.server";
import { JARVIS_PERSONA, loadMemoriesForPrompt } from "@/lib/jarvis-tools.server";
import { bearerToken, getUserScopedClient } from "@/lib/supabase-user.server";

const OPENAI_REALTIME_MODEL = process.env["OPENAI_REALTIME_MODEL"] || "gpt-realtime-2.1-mini";
const OPENAI_REALTIME_VOICE = process.env["OPENAI_REALTIME_VOICE"] || "marin";

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function safetyIdentifier(userId: string) {
  const bytes = new TextEncoder().encode(userId);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function handleRealtimeToken(request: Request): Promise<Response> {
  const token = bearerToken(request);
  if (!token) return jsonError(401, "Sessão não encontrada. Entre novamente.");

  const auth = await getUserScopedClient(token);
  if (!auth) return jsonError(401, "Sessão inválida ou expirada. Entre novamente.");

  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    return jsonError(
      503,
      "A voz independente ainda não está configurada. Adicione OPENAI_API_KEY aos Secrets do projeto.",
    );
  }

  const settings = await loadAssistantSettings(auth.supabase, auth.userId);
  const memories = await loadMemoriesForPrompt(auth.supabase);
  const language = settings.language || "pt-BR";
  const instructions = [
    JARVIS_PERSONA,
    buildAssistantInstructions(settings),
    `Data e hora atuais do usuário: ${new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "full",
      timeStyle: "short",
    })} (fuso America/Sao_Paulo).`,
    "Conduza a conversa por voz naturalmente em português do Brasil. Respostas faladas devem ser curtas, claras e sem markdown.",
    memories ? `Fatos memorizados sobre o usuário:\n${memories}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": await safetyIdentifier(auth.userId),
    },
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: 600 },
      session: {
        type: "realtime",
        model: OPENAI_REALTIME_MODEL,
        instructions: `${instructions}\nIdioma preferido: ${language}.`,
        audio: {
          input: {
            noise_reduction: { type: "near_field" },
            transcription: {
              model: "gpt-4o-mini-transcribe",
              language: "pt",
            },
            turn_detection: {
              type: "semantic_vad",
              eagerness: "medium",
              create_response: true,
              interrupt_response: true,
            },
          },
          output: {
            voice: OPENAI_REALTIME_VOICE,
            speed: Math.min(1.5, Math.max(0.25, Number(settings.voice_speed) || 1)),
          },
        },
      },
    }),
  });

  const payload = await response.text();
  return new Response(payload, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/realtime-token")({
  server: {
    handlers: {
      GET: ({ request }) => handleRealtimeToken(request),
    },
  },
});
