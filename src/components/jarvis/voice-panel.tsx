import { useCallback, useEffect, useState } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { OrbitalCore } from "@/components/jarvis/orbital-core";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getPreferredVoice,
  getVoicePreferences,
  listLocalVoices,
  speakWithFallback,
  type LocalVoice,
} from "@/lib/local-voice";

type Recognition = {
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
};

type RecognitionConstructor = new () => Recognition;

export function VoicePanel() {
  const [active, setActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [lastText, setLastText] = useState("");
  const [voices, setVoices] = useState<LocalVoice[]>([]);

  useEffect(() => {
    let mounted = true;

    listLocalVoices()
      .then((items) => {
        if (mounted) setVoices(items);
      })
      .catch(() => {
        // O fallback do navegador continua disponível mesmo sem o Core de voz.
      });

    return () => {
      mounted = false;
    };
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const preferences = getVoicePreferences();
      const selected = getPreferredVoice(voices);

      try {
        await speakWithFallback(text, {
          voiceName: selected?.name || preferences.voiceName || undefined,
          speed: preferences.speed,
          volume: 1,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha no modo de voz.");
      }
    },
    [voices],
  );

  const runLocalVoice = useCallback(() => {
    const SpeechRecognition =
      (
        window as unknown as {
          SpeechRecognition?: RecognitionConstructor;
          webkitSpeechRecognition?: RecognitionConstructor;
        }
      ).SpeechRecognition ??
      (
        window as unknown as {
          webkitSpeechRecognition?: RecognitionConstructor;
        }
      ).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("O navegador não oferece reconhecimento de voz.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = async (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (!transcript) return;

      setLastText(transcript);
      setListening(false);

      try {
        const response = await fetch("http://127.0.0.1:3210/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", content: transcript }] }),
        });
        const data = (await response.json()) as { text?: string; error?: string };

        if (!response.ok) throw new Error(data.error ?? "Falha no núcleo local.");

        const answer = data.text?.trim();
        if (!answer) throw new Error("O JARVIS retornou uma resposta vazia.");

        await speak(answer);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha no modo de voz local.");
      }
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      toast.error("Não foi possível capturar a fala.");
    };

    setListening(true);
    recognition.start();
  }, [speak]);

  function toggle() {
    if (listening) return;
    setActive((value) => !value);
    runLocalVoice();
  }

  return (
    <section className="voice-stage hud-enter flex shrink-0 flex-col items-center gap-3 px-4 pt-5 pb-3" aria-label="Voz local">
      <div className="voice-command-readout">
        <span className={cn("voice-signal", active && "voice-signal--active")} />
        <span>CANAL DE VOZ // LOCAL</span>
        <span className="text-primary">OLLAMA</span>
      </div>

      <OrbitalCore active={active || listening} muted={!listening} />

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" onClick={toggle} className="rounded-full border-primary/30 bg-primary/5 px-7 font-display text-xs text-primary">
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {listening ? "Ouvindo..." : "Falar com JARVIS"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            const text = lastText ? "Entendi: " + lastText : "J.A.R.V.I.S. local online e pronto.";
            void speak(text);
          }}
          className="rounded-full"
        >
          <Volume2 className="h-4 w-4" /> Testar voz
        </Button>
      </div>

      <div className="voice-frequency" aria-hidden="true">
        {Array.from({ length: 31 }, (_, i) => (
          <span key={i} style={{ "--voice-index": i } as React.CSSProperties} />
        ))}
      </div>

      <div className="flex items-center gap-2 font-display text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        <span className="voice-state-pulse" />
        <span>{listening ? "Microfone ativo" : "Voz local pronta"}</span>
      </div>
    </section>
  );
}
