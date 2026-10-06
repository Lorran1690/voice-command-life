import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clipboard, Eye, EyeOff, Mic, MicOff, Phone, PhoneOff, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { OrbitalCore } from "@/components/jarvis/orbital-core";
import { Button } from "@/components/ui/button";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Caption = { role: "user" | "assistant"; text: string };

export function VoicePanel() {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [liveUrl, setLiveUrl] = useState<string | undefined>(undefined);
  const [showCaptions, setShowCaptions] = useState(true);
  const [copied, setCopied] = useState(false);
  const userCaption = useRef("");
  const assistantCaption = useRef("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setLiveUrl("/api/live?token=" + encodeURIComponent(data.session.access_token));
      }
    });
  }, []);

  const onEvent = useCallback((event: LiveEvent) => {
    const delta = event["delta"];
    if ((event.type === "session.input_transcript.delta" || event.type === "session.output_transcript.delta") && typeof delta === "string") {
      const role = event.type.includes("input") ? "user" : "assistant";
      const ref = role === "user" ? userCaption : assistantCaption;
      ref.current += delta;
      const text = ref.current;
      setCaptions((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === role) next[next.length - 1] = { role, text };
        else next.push({ role, text });
        return next.slice(-8);
      });
    } else if (event.type === "app.connected") {
      userCaption.current = "";
      assistantCaption.current = "";
      setCaptions([]);
      setCopied(false);
    }
  }, []);

  const call = useLiveVoice({ ...(liveUrl ? { url: liveUrl } : {}), onEvent });
  const active = call.status === "connected" || call.status === "connecting";
  const transcriptText = captions.map((item) => (item.role === "user" ? "Você: " : "J.A.R.V.I.S.: ") + item.text).join("\n");

  const copyTranscript = useCallback(async () => {
    if (!transcriptText) return;
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopied(true);
      toast.success("Transcrição copiada.");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar a transcrição.");
    }
  }, [transcriptText]);

  return (
    <section
      className="voice-stage hud-enter flex shrink-0 flex-col items-center gap-4 px-4 pt-6 pb-4"
      aria-label="Chamada de voz"
      data-status={call.status}
    >
      <div className="voice-command-readout" aria-live="polite">
        <span className={cn("voice-signal", active && "voice-signal--active")} />
        <span>
          CANAL DE VOZ // {call.status === "connected" ? "ONLINE" : call.status === "connecting" ? "SINCRONIZANDO" : "STANDBY"}
        </span>
        {call.status === "connected" && <span className="text-hud-amber">{call.muted ? "MIC MUTE" : "MIC LIVE"}</span>}
      </div>

      <audio ref={call.audioRef} controls className="hidden" />
      <OrbitalCore active={active} muted={call.muted} />

      <div className="flex flex-wrap items-center justify-center gap-2">
        {!active ? (
          <Button
            variant="outline"
            onClick={() => call.start()}
            disabled={!liveUrl || call.status === "stopping"}
            className="voice-start rounded-full border-primary/30 bg-primary/5 px-7 font-display text-xs text-primary"
          >
            <Phone className="h-4 w-4" />
            Iniciar canal de voz
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => call.setMuted(!call.muted)} className="rounded-full border-primary/20 bg-background/60">
              {call.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {call.muted ? "Reativar microfone" : "Silenciar"}
            </Button>
            <Button variant="destructive" onClick={() => call.stop()} className="rounded-full">
              <PhoneOff className="h-4 w-4" />
              Encerrar
            </Button>
          </>
        )}
      </div>

      <div className={cn("voice-frequency", active && !call.muted && "voice-frequency--active")} aria-hidden="true">
        {Array.from({ length: 31 }, (_, i) => <span key={i} style={{ "--voice-index": i } as React.CSSProperties} />)}
      </div>

      <div className="flex items-center gap-2 font-display text-[9px] uppercase tracking-[0.16em] text-muted-foreground" role="status">
        <span className="voice-state-pulse" />
        <span>
          {call.status === "connected"
            ? call.muted
              ? "Microfone em silêncio"
              : "Ouvindo e pronto para responder"
            : call.status === "connecting"
              ? "Estabelecendo conexão segura…"
              : call.status === "stopping"
                ? "Encerrando sessão…"
                : "Aguardando comando"}
        </span>
      </div>

      {call.playbackBlocked && (
        <Button variant="outline" size="sm" onClick={() => call.resumePlayback()} className="rounded-md border-primary px-3 text-xs text-primary">
          Ativar áudio
        </Button>
      )}

      {call.error && <p className="max-w-md text-center text-xs text-destructive">{call.error}</p>}

      <div className="voice-transcript-shell w-full max-w-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-primary/10 px-3 py-2">
          <div className="flex items-center gap-2 font-display text-[9px] uppercase tracking-[0.18em] text-primary">
            <span className="voice-transcript-live" /> Transcrição ao vivo
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCaptions((value) => !value)}
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              title={showCaptions ? "Ocultar transcrição" : "Mostrar transcrição"}
              aria-label={showCaptions ? "Ocultar transcrição" : "Mostrar transcrição"}
            >
              {showCaptions ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void copyTranscript()}
              disabled={!transcriptText}
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              title="Copiar transcrição"
              aria-label="Copiar transcrição"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                userCaption.current = "";
                assistantCaption.current = "";
                setCaptions([]);
              }}
              disabled={!captions.length}
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              title="Limpar transcrição"
              aria-label="Limpar transcrição"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {showCaptions && (
          <div className="voice-transcript max-h-36 overflow-y-auto p-3">
            {captions.length ? (
              captions.map((caption, index) => (
                <div key={index} className={cn("voice-caption", caption.role === "assistant" && "voice-caption--assistant")}>
                  <span>{caption.role === "user" ? "VOCÊ" : "JARVIS"}</span>
                  <p>{caption.text}</p>
                </div>
              ))
            ) : (
              <p className="py-3 text-center font-display text-[9px] uppercase tracking-[0.16em] text-muted-foreground/60">
                Aguardando fala…
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
