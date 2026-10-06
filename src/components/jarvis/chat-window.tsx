import { useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";

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
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { supabase } from "@/integrations/supabase/client";

const transport = new DefaultChatTransport({
  api: "/api/chat",
  headers: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  },
});

export function ChatWindow({ threadId, initialMessages }: { threadId: string; initialMessages: UIMessage[] }) {
  const { messages, sendMessage, status } = useChat({
    id: threadId,
    transport,
    messages: initialMessages,
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  function handleSubmit(message: PromptInputMessage) {
    if (!message.text.trim()) return;
    void sendMessage({ text: message.text });
  }

  const streaming = status === "submitted" || status === "streaming";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6">
          {!messages.length && (
            <ConversationEmptyState
              title="Às suas ordens."
              description=""
              className="hud-greeting justify-start pt-3 pb-8"
            />
          )}
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent
                className={
                  message.role === "user"
                    ? "rounded-md border border-input bg-secondary px-4 py-3 text-foreground hud-message"
                    : "bg-transparent px-0 hud-message"
                }
              >
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return message.role === "assistant" ? (
                      <MessageResponse key={index}>{part.text}</MessageResponse>
                    ) : (
                      <p key={index} className="whitespace-pre-wrap text-sm">
                        {part.text}
                      </p>
                    );
                  }
                  if (part.type.startsWith("tool-")) {
                    const toolPart = part as Extract<typeof part, { type: `tool-${string}` }>;
                    return (
                      <Tool key={index} defaultOpen={false}>
                        <ToolHeader type={toolPart.type} state={toolPart.state} />
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
          {status === "submitted" && <Shimmer className="text-sm">J.A.R.V.I.S. está pensando…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="hud-composer mx-auto w-full max-w-2xl px-4 pt-3 pb-6">
        <PromptInput onSubmit={handleSubmit} className="hud-input-frame w-full rounded-sm border border-input bg-card/40">
          <PromptInputTextarea
            ref={textareaRef}
            placeholder="Escreva para o J.A.R.V.I.S…"
            className="min-h-24 text-base"
            disabled={streaming}
          />
          <PromptInputFooter className="justify-between">
            <span className="font-display text-[10px] text-muted-foreground">{streaming ? "PROCESSANDO" : "MENSAGEM"}</span>
            <PromptInputSubmit status={status} disabled={streaming} aria-label="Enviar mensagem" />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
