import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { Check, Clipboard, Mic2, Send, Terminal, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@/components/ai-elements/tool";

const LOCAL_CORE_URL = "http://127.0.0.1:3210/api/chat";
const LOCAL_CORE_HEALTH_URL = "http://127.0.0.1:3210/health";
const HISTORY_PREFIX = "jarvis-local-history:";

type LocalMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools?: ToolPart[];
};

function messageId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Date.now() + "-" + Math.random().toString(36).slice(2);
}

function readHistory(threadId: string): LocalMessage[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(HISTORY_PREFIX + threadId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is LocalMessage =>
        !!item &&
        typeof item === "object" &&
        ["user", "assistant"].includes((item as LocalMessage).role) &&
        typeof (item as LocalMessage).text === "string",
    );
  } catch {
    return [];
  }
}

function saveHistory(threadId: string, messages: LocalMessage[]) {
  try {
    window.localStorage.setItem(HISTORY_PREFIX + threadId, JSON.stringify(messages.slice(-80)));
  } catch {
    // Local history is best-effort.
  }
}

function asLocalMessages(initialMessages: UIMessage[], threadId: string): LocalMessage[] {
  const saved = readHistory(threadId);
  if (saved.length) return saved;

  return initialMessages.flatMap((message) => {
    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();

    const tools = message.parts.filter(
      (part): part is ToolPart => part.type === "dynamic-tool" || part.type.startsWith("tool-"),
    );
    return (text || tools.length) && (message.role === "user" || message.role === "assistant")
      ? [{ id: message.id, role: message.role, text, tools }]
      : [];
  });
}

export function ChatWindow({
  threadId,
  initialMessages,
  onConnectionChange,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  onConnectionChange?: (online: boolean | null) => void;
}) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [status, setStatus] = useState<"ready" | "submitted" | "error">("ready");
  const [localCoreOnline, setLocalCoreOnline] = useState<boolean | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const historyLoaded = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages(asLocalMessages(initialMessages, threadId));
    historyLoaded.current = true;
    textareaRef.current?.focus();
  }, [initialMessages, threadId]);

  useEffect(() => {
    if (historyLoaded.current && messages.length) saveHistory(threadId, messages);
  }, [threadId, messages]);

  useEffect(() => {
    onConnectionChange?.(localCoreOnline);
  }, [localCoreOnline, onConnectionChange]);

  useEffect(() => {
    let active = true;

    const checkCore = async () => {
      try {
        const response = await fetch(LOCAL_CORE_HEALTH_URL, { cache: "no-store" });
        const data = (await response.json().catch(() => null)) as { ollama_ready?: boolean } | null;
        if (active) setLocalCoreOnline(response.ok && data?.ollama_ready === true);
      } catch {
        if (active) setLocalCoreOnline(false);
      }
    };

    void checkCore();
    const timer = window.setInterval(() => void checkCore(), 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const sendToCore = useCallback(
    async (text: string) => {
      const userMessage: LocalMessage = { id: messageId(), role: "user", text };
      const nextMessages = [...messages, userMessage];

      setMessages(nextMessages);
      setStatus("submitted");

      try {
        const response = await fetch(LOCAL_CORE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextMessages.map((message) => ({
              role: message.role,
              content: message.text,
            })),
          }),
        });

        const data = (await response.json().catch(() => null)) as {
          text?: string;
          error?: string;
        } | null;

        if (!response.ok) {
          throw new Error(data?.error || "O núcleo local recusou o comando.");
        }

        const answer = data?.text?.trim();
        if (!answer) throw new Error("O núcleo local retornou uma resposta vazia.");

        setMessages((current) => [
          ...current,
          { id: messageId(), role: "assistant", text: answer },
        ]);
        setStatus("ready");
        setLocalCoreOnline(true);
      } catch (error) {
        setStatus("error");
        setLocalCoreOnline(false);
        const errorMessage =
          error instanceof Error ? error.message : "Falha ao falar com o JARVIS local.";
        setMessages((current) => [
          ...current,
          {
            id: messageId(),
            role: "assistant",
            text:
              "Não consegui processar seu comando. " +
              errorMessage +
              "\n\nVerifique se a janela do JARVIS Core continua aberta.",
          },
        ]);
        toast.error("Falha no núcleo local.");
      }
    },
    [messages],
  );

  const copyText = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1400);
    } catch {
      toast.error("Não foi possível copiar a resposta.");
    }
  }, []);

  const speakText = useCallback(
    (id: string, text: string) => {
      if (!("speechSynthesis" in window)) {
        toast.error("Seu navegador não oferece voz local.");
        return;
      }

      if (speakingId === id) {
        window.speechSynthesis.cancel();
        setSpeakingId(null);
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "pt-BR";
      utterance.rate = 0.98;
      utterance.pitch = 0.92;
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);
      window.speechSynthesis.speak(utterance);
      setSpeakingId(id);
    },
    [speakingId],
  );

  function handleSubmit(message: PromptInputMessage) {
    const text = message.text.trim();
    if (!text || status === "submitted") return;
    void sendToCore(text);
  }

  function runQuickCommand(prompt: string) {
    if (status === "submitted") return;
    void sendToCore(prompt);
  }

  const streaming = status === "submitted";

  return (
    <div className="command-chat flex min-h-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-4xl gap-5 px-4 py-5 md:px-8">
          {!messages.length && (
            <div className="hud-welcome-panel">
              <ConversationEmptyState
                title="Às suas ordens."
                description=""
                className="hud-greeting justify-start py-2"
              />
              <div className="hud-quick-grid">
                {[
                  ["Teste o sistema", "J.A.R.V.I.S., faça um teste de comunicação."],
                  ["Quem é você?", "Quem é você e onde está executando?"],
                  ["Como pode ajudar?", "Me diga o que você consegue fazer nesta versão local."],
                  ["Falar comigo", "Responda de forma natural e informal."],
                ].map(([label, prompt]) => (
                  <Button
                    key={label}
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (prompt) runQuickCommand(prompt);
                    }}
                    className="hud-quick-command"
                    disabled={streaming}
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent
                className={cn(
                  "hud-message max-w-[92%] border transition-all",
                  message.role === "user" ? "hud-message--user ml-auto" : "hud-message--assistant",
                )}
              >
                {message.role === "assistant" ? (
                  <div className="group relative">
                    <div className="assistant-message-label">
                      <Terminal className="size-3" />
                      J.A.R.V.I.S.<span> / RESPOSTA</span>
                    </div>
                    <MessageResponse>{message.text}</MessageResponse>
                    {message.tools?.map((part, index) => (
                      <Tool key={index} defaultOpen={false}>
                        {part.type === "dynamic-tool" ? (
                          <ToolHeader
                            type={part.type}
                            state={part.state}
                            toolName={part.toolName}
                          />
                        ) : (
                          <ToolHeader type={part.type} state={part.state} />
                        )}
                        <ToolContent>
                          <ToolInput input={part.input} />
                          <ToolOutput output={part.output} errorText={part.errorText} />
                        </ToolContent>
                      </Tool>
                    ))}
                    <div className="hud-message-actions">
                      <Button
                        type="button"
                        onClick={() => void copyText(message.id, message.text)}
                        className="hud-icon-action"
                        title="Copiar"
                        aria-label="Copiar resposta"
                      >
                        {copiedId === message.id ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Clipboard className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => speakText(message.id, message.text)}
                        className="hud-icon-action"
                        title={speakingId === message.id ? "Parar voz" : "Ouvir resposta"}
                        aria-label={speakingId === message.id ? "Parar voz" : "Ouvir resposta"}
                      >
                        {speakingId === message.id ? (
                          <VolumeX className="h-3.5 w-3.5" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <span className="mt-1 font-display text-[9px] uppercase tracking-[0.18em] text-hud-amber">
                      Você
                    </span>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
                  </div>
                )}
              </MessageContent>
            </Message>
          ))}

          {streaming && (
            <div className="hud-processing">
              <span className="processing-bars" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <Shimmer className="text-xs">J.A.R.V.I.S. está pensando…</Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="hud-composer mx-auto w-full max-w-4xl px-4 pt-3 pb-4 md:px-8">
        <div className="composer-readout">
          <div className="flex items-center gap-2 font-display text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className={cn("hud-status-dot", streaming && "hud-status-dot--active")} />
            <span>{streaming ? "Processando" : "Canal de texto ativo"}</span>
            <span
              className={cn(
                "font-display text-[9px] uppercase tracking-[0.16em]",
                localCoreOnline === true
                  ? "text-primary"
                  : localCoreOnline === false
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {localCoreOnline === true
                ? "CORE LOCAL ONLINE"
                : localCoreOnline === false
                  ? "CORE LOCAL OFFLINE"
                  : "CORE LOCAL…"}
            </span>
          </div>
          <span className="hidden items-center gap-1 font-display text-[9px] text-muted-foreground/70 sm:flex">
            <Mic2 className="h-3 w-3" /> CANAL LOCAL
          </span>
        </div>

        <PromptInput onSubmit={handleSubmit} className="hud-input-frame w-full">
          <PromptInputTextarea
            ref={textareaRef}
            placeholder="Comando para J.A.R.V.I.S…"
            className="min-h-16 border-0 text-sm"
            disabled={streaming}
          />
          <PromptInputFooter className="justify-end gap-3 px-2 py-1.5">
            <span className="mr-auto hidden items-center gap-1 font-display text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:flex">
              <Send className="h-3 w-3" /> COMANDO
            </span>
            <span className="hidden font-display text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:inline">
              {status === "error" ? "ERRO" : streaming ? "PROCESSANDO" : "READY"}
            </span>
            <PromptInputSubmit
              status={streaming ? "submitted" : "ready"}
              onStop={() => undefined}
              disabled={streaming}
              aria-label="Enviar mensagem"
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
