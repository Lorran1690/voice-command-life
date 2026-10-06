import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";

import { OrbitalCore } from "@/components/jarvis/orbital-core";
import { Button } from "@/components/ui/button";
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
    if (event.type === "session.input_transcript.delta" && typeof event["delta"] === "string") {
      userCaption.current += event["delta"];
      const text = userCaption.current;
      setCaptions((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "user") next[next.length - 1] = { role: "user", text };
        else next.push({ role: "user", text });
        return next.slice(-6);
      });
    } else if (event.type === "session.output_transcript.delta" && typeof event["delta"] === "string") {
      assistantCaption.current += event["delta"];
      const text = assistantCaption.current;
      setCaptions((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") next[next.length - 1] = { role: "assistant", text };
        else next.push({ role: "assistant", text });
        return next.slice(-6);
      });
    } else if (event.type === "app.connected") {
      userCaption.current = "";
      assistantCaption.current = "";
      setCaptions([]);
    }
  }, []);

  const call = useLiveVoice({ ...(liveUrl ? { url: liveUrl } : {}), onEvent });
  const active = call.status === "connected" || call.status === "connecting";

  return (
    <section className="voice-stage hud-enter flex shrink-0 flex-col items-center gap-4 px-4 pt-8 pb-4" aria-label="Chamada de voz" data-status={call.status}>
      <audio ref={call.audioRef} controls className="hidden" />
      <OrbitalCore active={active} muted={call.muted} />

      <div className="flex items-center gap-3">
        {!active ? (
          <Button variant="outline"
            onClick={() => call.start()}
            disabled={!liveUrl || call.status === "stopping"}
            className="voice-start rounded-full border-primary/30 bg-primary/5 px-6 font-display text-xs text-primary"
          >
            <Phone className="h-4 w-4" />
            Falar com J.A.R.V.I.S.
          </Button>
        ) : (
          <>
            <Button variant="outline"
              onClick={() => call.setMuted(!call.muted)}
              className="rounded-full"
            >
              {call.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {call.muted ? "Reativar" : "Silenciar"}
            </Button>
            <Button variant="destructive"
              onClick={() => call.stop()}
              className="rounded-full"
            >
              <PhoneOff className="h-4 w-4" />
              Encerrar
            </Button>
          </>
        )}
      </div>

      <div className={cn("voice-frequency", active && !call.muted && "voice-frequency--active")} aria-hidden="true">
        {Array.from({ length: 25 }, (_, i) => <span key={i} />)}
      </div>
      <p className="font-display text-[10px] uppercase text-hud-amber" role="status">
        {call.status === "connected"
          ? "Ouvindo…"
          : call.status === "connecting"
            ? "Estabelecendo conexão…"
            : call.status === "stopping"
              ? "Encerrando…"
              : "Pronto"}
      </p>

      {call.playbackBlocked && (
        <Button variant="outline" size="sm"
          onClick={() => call.resumePlayback()}
          className="rounded-md border border-primary px-3 py-1 text-xs text-primary"
        >
          Ativar som
        </Button>
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
    </section>
  );
}
