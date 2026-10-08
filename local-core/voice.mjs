import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

let cachedVoices = [];
let cachedAt = 0;

const VOICE_CACHE_MS = 30_000;

function asList(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

async function runPowerShell(script, env = {}, timeout = 20_000) {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    {
      env: { ...process.env, ...env },
      timeout,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    },
  );

  return stdout.trim();
}

function normalizeVoice(item) {
  return {
    name: String(item?.name ?? "").trim(),
    culture: String(item?.culture ?? "").trim(),
    gender: String(item?.gender ?? "").trim().toLowerCase(),
  };
}

export async function listWindowsVoices() {
  if (process.platform !== "win32") return [];
  if (Date.now() - cachedAt < VOICE_CACHE_MS && cachedVoices.length) return cachedVoices;

  const script = [
    "Add-Type -AssemblyName System.Speech",
    "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "$voices = @($synth.GetInstalledVoices() | ForEach-Object {",
    "  $info = $_.VoiceInfo",
    "  [pscustomobject]@{",
    "    name = $info.Name",
    "    culture = $info.Culture.Name",
    "    gender = $info.Gender.ToString()",
    "  }",
    "})",
    "$voices | ConvertTo-Json -Compress",
    "$synth.Dispose()",
  ].join("; ");

  const raw = await runPowerShell(script);
  const parsed = raw ? JSON.parse(raw) : [];

  cachedVoices = asList(parsed)
    .map(normalizeVoice)
    .filter((voice) => voice.name)
    .sort((a, b) => {
      const aFemale = a.gender === "female" ? 0 : 1;
      const bFemale = b.gender === "female" ? 0 : 1;
      if (aFemale !== bFemale) return aFemale - bFemale;

      const aPt = /^pt[-_]/i.test(a.culture) ? 0 : 1;
      const bPt = /^pt[-_]/i.test(b.culture) ? 0 : 1;
      if (aPt !== bPt) return aPt - bPt;

      return a.name.localeCompare(b.name);
    });

  cachedAt = Date.now();
  return cachedVoices;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function speedToSapiRate(speed) {
  const normalized = Number.isFinite(speed) ? speed : 1;
  return Math.round(clamp((normalized - 1) * 10, -10, 10));
}

export async function synthesizeWindows({ text, voice, speed = 1, volume = 1 }) {
  if (process.platform !== "win32") {
    throw new Error("O sintetizador Windows só está disponível no Windows.");
  }

  const cleanText = String(text ?? "").trim();
  if (!cleanText) throw new Error("Texto vazio.");
  if (cleanText.length > 4000) throw new Error("Texto de voz muito longo.");

  const voices = await listWindowsVoices();
  const selected = voice ? voices.find((item) => item.name === voice) : null;
  const chosen = selected ?? voices.find((item) => item.gender === "female" && /^pt[-_]/i.test(item.culture)) ?? voices.find((item) => item.gender === "female") ?? voices[0];

  if (!chosen) {
    throw new Error("Nenhuma voz SAPI instalada foi encontrada.");
  }

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jarvis-tts-"));
  const outputFile = path.join(dir, "speech.wav");
  const textBase64 = Buffer.from(cleanText, "utf8").toString("base64");

  const script = [
    "Add-Type -AssemblyName System.Speech",
    "$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:JARVIS_TTS_TEXT))",
    "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "$synth.SelectVoice($env:JARVIS_TTS_VOICE)",
    "$synth.Rate = [int]$env:JARVIS_TTS_RATE",
    "$synth.Volume = [int]$env:JARVIS_TTS_VOLUME",
    "$synth.SetOutputToWaveFile($env:JARVIS_TTS_OUTPUT)",
    "$synth.Speak($text)",
    "$synth.Dispose()",
  ].join("; ");

  try {
    await runPowerShell(
      script,
      {
        JARVIS_TTS_TEXT: textBase64,
        JARVIS_TTS_VOICE: chosen.name,
        JARVIS_TTS_RATE: String(speedToSapiRate(speed)),
        JARVIS_TTS_VOLUME: String(Math.round(clamp(Number(volume) * 100, 0, 100))),
        JARVIS_TTS_OUTPUT: outputFile,
      },
      45_000,
    );

    const buffer = await fs.readFile(outputFile);
    return { buffer, voice: chosen };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
