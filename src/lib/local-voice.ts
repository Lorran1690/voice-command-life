export type LocalVoice = {
  name: string;
  culture: string;
  gender: string;
};

const SETTINGS_KEY = "jarvis-local-settings";
const LOCAL_CORE = "http://127.0.0.1:3210";

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

  try {
    await audio.play();
  } finally {
    audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
    audio.addEventListener("error", () => URL.revokeObjectURL(url), { once: true });
  }
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

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
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
