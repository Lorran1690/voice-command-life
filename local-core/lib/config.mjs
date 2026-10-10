// Configuração do JARVIS Core local. Nada aqui depende de serviços remotos.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const APP_VERSION = "2.0.0-local";
export const DEFAULT_MODEL = "qwen3:4b";

/** O Core escuta SOMENTE em loopback. Qualquer outro valor é ignorado. */
export const HOST = "127.0.0.1";
export const PORT = (() => {
  const value = Number(process.env.JARVIS_PORT || 3210);
  return Number.isInteger(value) && value > 1024 && value < 65536 ? value : 3210;
})();

if (process.env.JARVIS_HOST && process.env.JARVIS_HOST !== HOST) {
  console.warn("[JARVIS] JARVIS_HOST ignorado: o Core só escuta em 127.0.0.1.");
}

function isLoopbackUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

/** O Ollama também precisa ser local; URLs remotas são recusadas para manter o modo offline. */
export const OLLAMA_URL = (() => {
  const value = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
  if (!isLoopbackUrl(value)) {
    console.warn("[JARVIS] OLLAMA_URL remota recusada; usando http://127.0.0.1:11434.");
    return "http://127.0.0.1:11434";
  }
  return value.replace(/\/$/, "");
})();

export const DATA_DIR = (() => {
  const custom = process.env.JARVIS_DATA_DIR;
  if (custom) return path.resolve(custom);
  if (process.platform === "win32" && process.env.APPDATA) return path.join(process.env.APPDATA, "JARVIS");
  return path.join(os.homedir(), ".jarvis");
})();

fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });

export const DB_PATH = path.join(DATA_DIR, "jarvis.db");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

/** Configuração local do Core (arquivo config.json na pasta de dados). */
export function readLocalConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Modelo padrão: config.json > JARVIS_MODEL > qwen3:4b. Nunca troca para outro modelo silenciosamente. */
export function defaultModel() {
  const fromFile = readLocalConfig().model;
  if (typeof fromFile === "string" && /^[\w.:/-]{1,80}$/.test(fromFile)) return fromFile;
  const fromEnv = process.env.JARVIS_MODEL;
  if (fromEnv && /^[\w.:/-]{1,80}$/.test(fromEnv)) return fromEnv;
  return DEFAULT_MODEL;
}

const DEFAULT_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
];

/** Origens permitidas (CORS). Nunca wildcard. */
export const ALLOWED_ORIGINS = new Set(
  (process.env.JARVIS_ALLOWED_ORIGINS
    ? process.env.JARVIS_ALLOWED_ORIGINS.split(",").map((item) => item.trim()).filter(Boolean)
    : DEFAULT_ORIGINS
  ).filter((origin) => origin !== "*" && origin !== "null"),
);

export const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);

export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;
export const MAX_SESSIONS_PER_USER = 10;
