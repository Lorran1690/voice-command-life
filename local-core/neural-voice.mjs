/**
 * Integração opcional com um servidor KokoroTTS local.
 * Nenhum texto é enviado à nuvem; o serviço precisa estar em loopback.
 * API: https://github.com/hangry-labs/kokoroTTS
 */
export const NEURAL_VOICE_NAME = "E.L.Y.S.I.A Neural · Dora";
export const NEURAL_VOICE_ID = "pf_dora";

function localKokoroUrl() {
  const candidate = process.env.ELYSIA_KOKORO_URL || "http://127.0.0.1:7860";
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("ELYSIA_KOKORO_URL não é uma URL válida.");
  }
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("O servidor de voz deve usar HTTP em localhost/127.0.0.1, sem credenciais ou caminho.");
  }
  return url.origin;
}

export async function isNeuralVoiceAvailable() {
  try {
    const response = await fetch(localKokoroUrl() + "/health/ready", {
      signal: AbortSignal.timeout(1_800),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function neuralVoiceRecord() {
  return {
    name: NEURAL_VOICE_NAME,
    label: "E.L.Y.S.I.A Neural · Dora (português brasileiro)",
    culture: "pt-BR",
    gender: "female",
    provider: "kokoro",
  };
}

export async function synthesizeNeural({ text, speed = 1 }) {
  const cleanText = String(text ?? "").trim();
  if (!cleanText) throw new Error("Texto vazio.");
  if (cleanText.length > 4000) throw new Error("Texto de voz muito longo.");

  let response;
  try {
    response = await fetch(localKokoroUrl() + "/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "kokoro",
        input: cleanText,
        voice: NEURAL_VOICE_ID,
        response_format: "wav",
        speed: Math.max(0.75, Math.min(1.25, Number.isFinite(Number(speed)) ? Number(speed) : 1)),
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new Error("A voz neural local está indisponível. Inicie o servidor KokoroTTS na porta 7860.");
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error("KokoroTTS HTTP " + response.status + ": " + detail.slice(0, 250));
  }
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("audio/") && !contentType.includes("application/octet-stream")) {
    throw new Error("O servidor KokoroTTS não retornou um arquivo de áudio.");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > 16 * 1024 * 1024) {
    throw new Error("O áudio neural está vazio ou excedeu o tamanho permitido.");
  }
  return { buffer, voice: neuralVoiceRecord() };
}
