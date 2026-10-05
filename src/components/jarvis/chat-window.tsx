import { useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";

import jarvisCore from "@/assets/jarvis-core.png";
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
              icon={<img src={jarvisCore} alt="J.A.R.V.I.S." width={1024} height={1024} className="h-16 w-16" />}
              title="Às suas ordens."
              description="Pergunte qualquer coisa, peça lembretes, anote ideias — ou use o botão de voz acima."
            />
          )}
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent
                className={
                  message.role === "user"
                    ? "rounded-xl bg-primary px-4 py-2.5 text-primary-foreground"
                    : "bg-transparent px-0"
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

      <div className="border-t border-border bg-card/40 p-4">
        <PromptInput onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl">
          <PromptInputTextarea
            ref={textareaRef}
            placeholder="Escreva para o J.A.R.V.I.S…"
            disabled={streaming}
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={streaming} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
