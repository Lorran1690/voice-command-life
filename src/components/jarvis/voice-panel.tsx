import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";

import jarvisCore from "@/assets/jarvis-core.png";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Caption = { role: "user" | "assistant"; text: string };

export function VoicePanel() {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [liveUrl, setLiveUrl] = useState<string | undefined>(undefined);
  const userCaption = useRef("");
  const assistantCaption = useRef("");

  // The relay authenticates the call with the user's session token (?token=),
  // so every voice tool acts on this user's data only.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setLiveUrl(`/api/live?token=${encodeURIComponent(data.session.access_token)}`);
      }
    });
  }, []);

  const onEvent = useCallback((event: LiveEvent) => {
    if (event.type === "session.input_transcript.delta" && typeof event.delta === "string") {
      userCaption.current += event.delta;
      const text = userCaption.current;
      setCaptions((prev) => {
        const next = [...prev];
        if (next.length && next[next.length - 1].role === "user") next[next.length - 1] = { role: "user", text };
        else next.push({ role: "user", text });
        return next.slice(-6);
      });
    } else if (event.type === "session.output_transcript.delta" && typeof event.delta === "string") {
      assistantCaption.current += event.delta;
      const text = assistantCaption.current;
      setCaptions((prev) => {
        const next = [...prev];
        if (next.length && next[next.length - 1].role === "assistant")
          next[next.length - 1] = { role: "assistant", text };
        else next.push({ role: "assistant", text });
        return next.slice(-6);
      });
    } else if (event.type === "app.connected") {
      userCaption.current = "";
      assistantCaption.current = "";
      setCaptions([]);
    }
  }, []);

  const call = useLiveVoice({ url: liveUrl, onEvent });
  const active = call.status === "connected" || call.status === "connecting";

  return (
    <div className="flex flex-col items-center gap-4 border-b border-border bg-card/40 px-4 py-5">
      <audio ref={call.audioRef} controls className="hidden" />
      <div className="relative">
        <div
          className={cn(
            "absolute -inset-3 rounded-full border border-primary/30",
            active && "jarvis-ring border-dashed",
          )}
        />
        <img
          src={jarvisCore}
          alt="Núcleo do J.A.R.V.I.S."
          width={1024}
          height={1024}
          className={cn("h-24 w-24 rounded-full", active && "jarvis-core-active")}
        />
      </div>

      <div className="flex items-center gap-3">
        {!active ? (
          <button
            onClick={() => call.start()}
            disabled={!liveUrl}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Phone className="h-4 w-4" />
            Falar com J.A.R.V.I.S.
          </button>
        ) : (
          <>
            <button
              onClick={() => call.setMuted(!call.muted)}
              className="flex items-center gap-2 rounded-full border border-input bg-background px-4 py-2 text-sm text-foreground hover:bg-accent"
            >
              {call.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {call.muted ? "Reativar" : "Silenciar"}
            </button>
            <button
              onClick={() => call.stop()}
              className="flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-opacity hover:opacity-90"
            >
              <PhoneOff className="h-4 w-4" />
              Encerrar
            </button>
          </>
        )}
      </div>

      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {call.status === "connected"
          ? "Ouvindo…"
          : call.status === "connecting"
            ? "Estabelecendo conexão…"
            : call.status === "stopping"
              ? "Encerrando…"
              : "Pronto"}
      </p>

      {call.playbackBlocked && (
        <button
          onClick={() => call.resumePlayback()}
          className="rounded-md border border-primary px-3 py-1 text-xs text-primary"
        >
          Ativar som
        </button>
      )}
      {call.error && <p className="max-w-md text-center text-xs text-destructive">{call.error}</p>}

      {captions.length > 0 && (
        <div className="w-full max-w-lg space-y-1 rounded-lg border border-border bg-background/60 p-3">
          {captions.map((caption, index) => (
            <p key={index} className="text-xs leading-relaxed">
              <span
                className={cn(
                  "mr-2 font-semibold uppercase tracking-wider",
                  caption.role === "user" ? "text-muted-foreground" : "text-primary",
                )}
              >
                {caption.role === "user" ? "Você" : "Jarvis"}
              </span>
              <span className="text-foreground/90">{caption.text}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
