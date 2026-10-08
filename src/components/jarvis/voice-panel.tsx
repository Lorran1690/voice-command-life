import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Square, Volume2, AudioLines } from "lucide-react";
import { toast } from "sonner";
import { OrbitalCore } from "@/components/jarvis/orbital-core";
import { voiceLabels, type VoicePhase } from "@/components/jarvis/hud-state";
import { Button } from "@/components/ui/button";

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
export function VoicePanel({ onPhaseChange }: { onPhaseChange?: (phase: VoicePhase) => void }) {
  const [phase, setPhase] = useState<VoicePhase>("ready");
  const [lastText, setLastText] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef<Recognition | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);
  useEffect(
    () => () => {
      generation.current += 1;
      recognitionRef.current?.stop();
      abortRef.current?.abort();
      window.speechSynthesis?.cancel();
    },
    [],
  );
  function speak(text: string, run: number) {
    if (!("speechSynthesis" in window)) {
      setError("Seu navegador não oferece reprodução de voz.");
      setPhase("error");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.98;
    utterance.pitch = 0.92;
    utterance.onstart = () => {
      if (run === generation.current) setPhase("speaking");
    };
    utterance.onend = () => {
      if (run === generation.current) setPhase("ready");
    };
    utterance.onerror = () => {
      if (run === generation.current) {
        setError("Não foi possível reproduzir a voz.");
        setPhase("error");
      }
    };
    window.speechSynthesis.speak(utterance);
  }
  const runLocalVoice = useCallback(() => {
    const browser = window as unknown as {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const SpeechRecognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("O navegador não oferece reconhecimento de voz.");
      setPhase("error");
      toast.error("O navegador não oferece reconhecimento de voz.");
      return;
    }
    const run = ++generation.current;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    let captured = false;
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = async (event) => {
      if (run !== generation.current) return;
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (!transcript) return;
      captured = true;
      setLastText(transcript);
      setPhase("processing");
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch("http://127.0.0.1:3210/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", content: transcript }] }),
          signal: controller.signal,
        });
        const data = (await response.json()) as { text?: string; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Falha no núcleo local.");
        const answer = data.text?.trim();
        if (!answer) throw new Error("O JARVIS retornou uma resposta vazia.");
        if (run === generation.current) speak(answer, run);
      } catch (failure) {
        if (run !== generation.current) return;
        const message = failure instanceof Error ? failure.message : "Falha no modo de voz local.";
        setError(message);
        setPhase("error");
        toast.error(message);
      }
    };
    recognition.onend = () => {
      if (run === generation.current && !captured)
        setPhase((previous) => (previous === "error" ? previous : "ready"));
    };
    recognition.onerror = () => {
      if (run === generation.current) {
        setError("Não foi possível capturar a fala. Verifique a permissão do microfone.");
        setPhase("error");
      }
    };
    setError("");
    setPhase("connecting");
    try {
      recognition.start();
      // SpeechRecognition start is asynchronous; onstart is the actual listening signal.
      (recognition as Recognition & { onstart: (() => void) | null }).onstart = () => {
        if (run === generation.current) setPhase("listening");
      };
    } catch {
      setError("Não foi possível ativar o microfone.");
      setPhase("error");
    }
  }, []);
  function stop() {
    generation.current += 1;
    recognitionRef.current?.stop();
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    setPhase("ready");
  }
  const active = !["ready", "error"].includes(phase);
  return (
    <section className="command-voice" aria-label="Canal de voz" data-phase={phase}>
      <div className="voice-section-heading">
        <span className="hud-eyebrow">
          <AudioLines className="size-3.5" />
          JARVIS CORE
        </span>
        <span className="hud-eyebrow text-muted-foreground">CANAL LOCAL</span>
      </div>
      <div className="core-stage">
        <span className="core-caption core-caption--left">
          VOICE
          <br />
          <span>INTERFACE</span>
        </span>
        <OrbitalCore phase={phase} active={active} muted={phase !== "listening"} />
        <span className="core-caption core-caption--right">
          {phase === "ready" ? "STANDBY" : phase === "error" ? "INTERRUPTED" : "ACTIVE"}
          <br />
          <span>J.A.R.V.I.S.</span>
        </span>
      </div>
      <div className="voice-activity" data-phase={phase} aria-hidden="true">
        {Array.from({ length: 35 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      <p className="voice-phase" role="status">
        <span className="hud-status-dot" />
        {voiceLabels[phase]}
      </p>
      <div className="voice-controls">
        <Button variant="outline" onClick={active ? stop : runLocalVoice} className="voice-primary">
          {active ? <Square /> : <Mic />}
          {active ? "Encerrar" : "Falar com J.A.R.V.I.S."}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (active) stop();
            else runLocalVoice();
          }}
          aria-label={active ? "Parar microfone" : "Ativar microfone"}
          title={active ? "Parar microfone" : "Ativar microfone"}
        >
          {active ? <MicOff /> : <Mic />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={active}
          onClick={() => {
            setError("");
            speak(
              lastText ? "Entendi: " + lastText : "J.A.R.V.I.S. local pronto.",
              ++generation.current,
            );
          }}
          aria-label="Testar voz"
          title="Testar voz"
        >
          <Volume2 />
        </Button>
      </div>
      {error && (
        <p className="voice-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
