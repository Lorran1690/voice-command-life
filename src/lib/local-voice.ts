export type LocalVoice = {
  name: string;
  culture: string;
  gender: string;
};

const SETTINGS_KEY = "jarvis-local-settings";
const LOCAL_CORE = "http://127.0.0.1:3210";

let activePlaybackStop: (() => void) | null = null;

function emitVoiceLevel(level: number, measured: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("jarvis:voice-level", {
    detail: { level: Math.max(0, Math.min(1, level)), measured },
  }));
}

export function stopVoicePlayback() {
  activePlaybackStop?.();
  activePlaybackStop = null;
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  emitVoiceLevel(0, false);
}

type VoiceSettings = {
  voice_name?: string;
  voice_speed?: number;
};

function readSettings(): VoiceSettings {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as VoiceSettings) : {};
  } catch {
    return {};
  }
}

export function getVoicePreferences() {
  const settings = readSettings();

  return {
    voiceName: typeof settings.voice_name === "string" ? settings.voice_name : "",
    speed:
      typeof settings.voice_speed === "number" && Number.isFinite(settings.voice_speed)
        ? settings.voice_speed
        : 0.98,
  };
}

export async function listLocalVoices(): Promise<LocalVoice[]> {
  const response = await fetch(LOCAL_CORE + "/api/voices", {
    method: "GET",
    cache: "no-store",
  });

  const data = (await response.json()) as {
    voices?: LocalVoice[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Não foi possível listar as vozes locais.");
  }

  return Array.isArray(data.voices) ? data.voices : [];
}

export async function speakLocalText(
  text: string,
  options: { voiceName?: string; speed?: number; volume?: number } = {},
): Promise<void> {
  const cleanText = text.trim();
  if (!cleanText) return;
  activePlaybackStop?.();

  const response = await fetch(LOCAL_CORE + "/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: cleanText,
      voice: options.voiceName ?? getVoicePreferences().voiceName,
      rate: options.speed ?? getVoicePreferences().speed,
      volume: options.volume ?? 1,
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Falha no sintetizador de voz local.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let animationFrame = 0;
    let samples: Uint8Array | null = null;

    const cleanup = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      if (activePlaybackStop === stop) activePlaybackStop = null;
      emitVoiceLevel(0, true);
      if (audioContext && audioContext.state !== "closed") void audioContext.close().catch(() => undefined);
      URL.revokeObjectURL(url);
    };

    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };

    const stop = () => {
      audio.pause();
      finish();
    };

    const onEnded = () => finish();
    const onError = () => finish(new Error("Falha durante a reprodução da voz local."));

    try {
      if ("AudioContext" in window) {
        audioContext = new AudioContext();
        const source = audioContext.createMediaElementSource(audio);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.72;
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        samples = new Uint8Array(analyser.fftSize);
      }
    } catch {
      // A voz continua funcionando se o navegador não oferecer análise de áudio.
      if (audioContext && audioContext.state !== "closed") void audioContext.close().catch(() => undefined);
      audioContext = null;
      analyser = null;
      samples = null;
    }

    const readAudioLevel = () => {
      if (settled || !analyser || !samples) return;
      analyser.getByteTimeDomainData(samples);
      let energy = 0;
      for (let i = 0; i < samples.length; i++) {
        const sample = (samples[i]! - 128) / 128;
        energy += sample * sample;
      }
      const rms = Math.sqrt(energy / samples.length);
      emitVoiceLevel(Math.min(1, Math.max(0, rms - 0.012) * 7.5), true);
      animationFrame = window.requestAnimationFrame(readAudioLevel);
    };

    activePlaybackStop = stop;
    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });

    void (async () => {
      try {
        if (audioContext?.state === "suspended") await audioContext.resume();
        await audio.play();
        if (analyser) readAudioLevel();
      } catch (error) {
        finish(error);
      }
    })();
  });
}

export async function speakWithFallback(
  text: string,
  options: { voiceName?: string; speed?: number; volume?: number } = {},
): Promise<"local-core" | "browser"> {
  try {
    await speakLocalText(text, options);
    return "local-core";
  } catch {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      throw new Error("Nenhum sintetizador de voz disponível.");
    }

    const voices = window.speechSynthesis.getVoices();
    const preferred = options.voiceName
      ? voices.find((voice) => voice.name === options.voiceName)
      : voices.find((voice) => /pt[-_]BR/i.test(voice.lang) && /female|maria|francisca|luciana|fernanda/i.test(voice.name))
        ?? voices.find((voice) => /pt[-_]BR/i.test(voice.lang));

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = preferred ?? null;
    utterance.lang = preferred?.lang ?? "pt-BR";
    utterance.rate = options.speed ?? getVoicePreferences().speed;
    utterance.volume = options.volume ?? 1;
    utterance.pitch = 0.92;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        utterance.onboundary = null;
        utterance.onend = null;
        utterance.onerror = null;
        if (activePlaybackStop === stop) activePlaybackStop = null;
        emitVoiceLevel(0, false);
        if (error) reject(error);
        else resolve();
      };
      const stop = () => finish();

      utterance.onboundary = (event) => {
        const char = text[event.charIndex] ?? "";
        const level = /[.!?,;:]/.test(char) ? 0.06 : /\s/.test(char) ? 0.18 : 0.35 + ((event.charIndex % 5) * 0.09);
        emitVoiceLevel(level, false);
      };
      utterance.onend = () => finish();
      utterance.onerror = (event) => {
        if (event.error === "canceled" || event.error === "interrupted") finish();
        else finish(new Error("Falha na voz do navegador: " + event.error));
      };

      activePlaybackStop = stop;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });

    return "browser";
  }
}

export function getPreferredVoice(voices: LocalVoice[]): LocalVoice | null {
  if (!voices.length) return null;

  const preference = getVoicePreferences().voiceName;
  if (preference) {
    const selected = voices.find((voice) => voice.name === preference);
    if (selected) return selected;
  }

  return (
    voices.find((voice) => voice.gender === "female" && /^pt[-_]/i.test(voice.culture)) ??
    voices.find((voice) => voice.gender === "female") ??
    voices.find((voice) => /^pt[-_]/i.test(voice.culture)) ??
    voices[0]
  );
}
