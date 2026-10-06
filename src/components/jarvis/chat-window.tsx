import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Check, Clipboard, Mic2, Paperclip, Send, Sparkles, Volume2, VolumeX } from "lucide-react";
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
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuItem,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const LOCAL_CORE_URL = "http://localhost:3210/api/chat";
const LOCAL_CORE_HEALTH_URL = "http://localhost:3210/health";

const transport = new DefaultChatTransport({
  api: LOCAL_CORE_URL,
  headers: { "X-Jarvis-Client": "hud" },
});

const QUICK_COMMANDS = [
  { label: "Criar tarefa", prompt: "Crie uma tarefa para mim." },
  { label: "Ver tarefas", prompt: "Mostre minhas tarefas pendentes." },
  { label: "Salvar nota", prompt: "Quero salvar uma anotação." },
  { label: "Minha memória", prompt: "O que você lembra sobre mim?" },
  { label: "Seus recursos", prompt: "Mostre os principais recursos que você consegue executar por mim." },
];

export function ChatWindow({ threadId, initialMessages }: { threadId: string; initialMessages: UIMessage[] }) {
  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    transport,
    messages: initialMessages,
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [ttsSettings, setTtsSettings] = useState<{ browser_voice: string | null; voice_speed: number } | null>(null);
  const [localCoreOnline, setLocalCoreOnline] = useState<boolean | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    const checkCore = async () => {
      try {
        const response = await fetch(LOCAL_CORE_HEALTH_URL, { cache: "no-store" });
        const data = await response.json().catch(() => null) as { ollama_ready?: boolean } | null;
        if (active) setLocalCoreOnline(response.ok && data?.ollama_ready === true);
      } catch {
        if (active) setLocalCoreOnline(false);
      }
    };

    void checkCore();
    timer = window.setInterval(() => void checkCore(), 5000);

    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void supabase
      .from("assistant_settings")
      .select("browser_voice, voice_speed")
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setTtsSettings({ browser_voice: data.browser_voice, voice_speed: Number(data.voice_speed ?? 1) });
      });
    return () => {
      active = false;
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, [threadId]);

  const streaming = status === "submitted" || status === "streaming";

  const copyText = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Resposta copiada.");
      window.setTimeout(() => setCopiedId(null), 1400);
    } catch {
      toast.error("Não foi possível copiar a resposta.");
    }
  }, []);

  const speakText = useCallback((id: string, text: string) => {
    if (!("speechSynthesis" in window)) {
      toast.error("Seu navegador não oferece leitura de texto em voz alta.");
      return;
    }
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[#>*_]/g, ""));
    utterance.lang = "pt-BR";
    utterance.rate = ttsSettings?.voice_speed ?? 1.02;
    utterance.pitch = 0.96;
    if (ttsSettings?.browser_voice) {
      const selectedVoice = window.speechSynthesis.getVoices().find((voice) => voice.name === ttsSettings.browser_voice);
      if (selectedVoice) utterance.voice = selectedVoice;
    }
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utterance);
    setSpeakingId(id);
  }, [speakingId, ttsSettings]);

  function handleSubmit(message: PromptInputMessage) {
    const text = message.text.trim();
    if (!text && !message.files.length) return;
    void sendMessage({ text, files: message.files });
  }

  function runQuickCommand(prompt: string) {
    if (streaming) return;
    void sendMessage({ text: prompt });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-4xl gap-7 px-4 py-6 md:px-6">
          {!messages.length && (
            <div className="hud-welcome-panel">
              <ConversationEmptyState
                title="Às suas ordens."
                description="Converse por texto, use o modo de voz ou delegue tarefas ao seu assistente."
                className="hud-greeting justify-start py-2"
              />
              <div className="hud-quick-grid">
                {QUICK_COMMANDS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => runQuickCommand(item.prompt)}
                    className="hud-quick-command"
                    disabled={streaming}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent
                className={cn(
                  "hud-message max-w-[92%] border transition-all",
                  message.role === "user"
                    ? "ml-auto rounded-2xl border-primary/15 bg-primary/[0.07] px-4 py-3 text-foreground shadow-[0_0_24px_rgba(34,211,238,0.04)]"
                    : "rounded-2xl border-primary/10 bg-card/20 px-4 py-3",
                )}
              >
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    const partKey = message.id + "-" + index;
                    return message.role === "assistant" ? (
                      <div key={index} className="group relative">
                        <MessageResponse>{part.text}</MessageResponse>
                        {part.text.trim() && (
                          <div className="hud-message-actions">
                            <button
                              type="button"
                              onClick={() => void copyText(partKey, part.text)}
                              className="hud-icon-action"
                              title="Copiar"
                              aria-label="Copiar resposta"
                            >
                              {copiedId === partKey ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => speakText(partKey, part.text)}
                              className="hud-icon-action"
                              title={speakingId === partKey ? "Parar leitura" : "Ouvir resposta"}
                              aria-label={speakingId === partKey ? "Parar leitura" : "Ouvir resposta"}
                            >
                              {speakingId === partKey ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div key={index} className="flex items-start gap-3">
                        <span className="mt-1 font-display text-[9px] uppercase tracking-[0.18em] text-hud-amber">Você</span>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{part.text}</p>
                      </div>
                    );
                  }

                  if (part.type.startsWith("tool-")) {
                    const toolPart = part as Extract<typeof part, { type: string }>;
                    return (
                      <Tool key={index} defaultOpen={false}>
                        <ToolHeader type={toolPart.type as never} state={toolPart.state as never} />
                        <ToolContent>
                          <ToolInput input={toolPart.input} />
                          <ToolOutput output={toolPart.output} errorText={toolPart.errorText} />
                        </ToolContent>
                      </Tool>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" && (
            <div className="hud-processing">
              <span className="hud-processing-orb" />
              <Shimmer className="text-xs">J.A.R.V.I.S. processando comando…</Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="hud-composer mx-auto w-full max-w-4xl px-4 pt-3 pb-6 md:px-6">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-2 font-display text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className={cn("hud-status-dot", streaming && "hud-status-dot--active")} />
            <span>{streaming ? "Processando" : "Canal de texto ativo"}</span>
            <span className={cn(
              "font-display text-[9px] uppercase tracking-[0.16em]",
              localCoreOnline === true ? "text-primary" : localCoreOnline === false ? "text-destructive" : "text-muted-foreground"
            )}>
              {localCoreOnline === true ? "CORE LOCAL ONLINE" : localCoreOnline === false ? "CORE LOCAL OFFLINE" : "CORE LOCAL…"}
            </span>
          </div>
          <span className="hidden items-center gap-1 font-display text-[9px] text-muted-foreground/70 sm:flex">
            <Mic2 className="h-3 w-3" /> Voz disponível no núcleo
          </span>
        </div>

        <PromptInput
          onSubmit={handleSubmit}
          className="hud-input-frame w-full rounded-2xl border border-primary/15 bg-card/35 shadow-[0_15px_60px_rgba(0,0,0,0.2)]"
          accept="image/*,.txt,.md,.pdf"
          multiple
          maxFiles={4}
          maxFileSize={10 * 1024 * 1024}
          onError={(error) => toast.error(error.message)}
          globalDrop
        >
          <PromptInputFooter className="justify-between gap-3 px-2 py-1.5">
            <div className="flex min-w-0 items-center gap-1">
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger
                  tooltip={{ content: "Ferramentas", shortcut: "⌘K" }}
                  className="text-primary"
                  aria-label="Abrir ferramentas"
                >
                  <Paperclip className="h-4 w-4" />
                </PromptInputActionMenuTrigger>
                <PromptInputActionMenuContent className="w-64 border-primary/20 bg-background/95">
                  <PromptInputActionAddAttachments label="Anexar imagem ou arquivo" />
                  <PromptInputActionAddScreenshot label="Capturar tela" />
                  <PromptInputActionMenuItem disabled>
                    <Send className="mr-2 h-4 w-4" /> Enter envia • Shift+Enter quebra linha
                  </PromptInputActionMenuItem>
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>

              <span className="hidden truncate pl-1 font-display text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:inline">
                Digite um comando ou pergunte qualquer coisa
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden font-display text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:inline">
                {streaming ? "STREAM" : "READY"}
              </span>
              <PromptInputSubmit status={status} onStop={stop} disabled={false} aria-label="Enviar mensagem" />
            </div>
          </PromptInputFooter>
          <PromptInputTextarea
            ref={textareaRef}
            placeholder="Comando para J.A.R.V.I.S…"
            className="min-h-20 border-0 text-base md:min-h-24"
            disabled={false}
          />
        </PromptInput>
      </div>
    </div>
  );
}
