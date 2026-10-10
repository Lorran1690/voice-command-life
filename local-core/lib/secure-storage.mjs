// SecureStorage: guarda segredos do Core (ex.: chave de criptografia dos dados).
// Windows: DPAPI (escopo do usuário atual). Outros sistemas: arquivo 0600 (proteção mais fraca).
// A camada desktop (Tauri) pode substituir este provider por Credential Manager/keychain
// sem alterar a lógica de negócio, pois todo acesso passa por getSecret/setSecret.
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { DATA_DIR } from "./config.mjs";

const execFileAsync = promisify(execFile);
const KEY_DIR = path.join(DATA_DIR, "keys");
fs.mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });

function safeName(name) {
  if (!/^[a-z0-9._-]{1,64}$/i.test(name)) throw new Error("Nome de segredo inválido.");
  return name;
}

async function powershell(script, env) {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    { env: { ...process.env, ...env }, timeout: 20_000, windowsHide: true },
  );
  return stdout.trim();
}

const dpapiProvider = {
  id: "windows-dpapi",
  strong: true,
  async get(name) {
    const file = path.join(KEY_DIR, safeName(name) + ".dpapi");
    if (!fs.existsSync(file)) return null;
    const blob = fs.readFileSync(file, "utf8").trim();
    const out = await powershell(
      "Add-Type -AssemblyName System.Security; " +
        "$b=[Convert]::FromBase64String($env:JARVIS_BLOB); " +
        "[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect($b,$null,'CurrentUser'))",
      { JARVIS_BLOB: blob },
    );
    return Buffer.from(out, "base64");
  },
  async set(name, value) {
    const out = await powershell(
      "Add-Type -AssemblyName System.Security; " +
        "$b=[Convert]::FromBase64String($env:JARVIS_PLAIN); " +
        "[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,'CurrentUser'))",
      { JARVIS_PLAIN: value.toString("base64") },
    );
    fs.writeFileSync(path.join(KEY_DIR, safeName(name) + ".dpapi"), out, { mode: 0o600 });
  },
};

const fileProvider = {
  id: "file-0600",
  strong: false,
  async get(name) {
    const file = path.join(KEY_DIR, safeName(name) + ".key");
    if (!fs.existsSync(file)) return null;
    return Buffer.from(fs.readFileSync(file, "utf8").trim(), "base64");
  },
  async set(name, value) {
    fs.writeFileSync(path.join(KEY_DIR, safeName(name) + ".key"), value.toString("base64"), { mode: 0o600 });
  },
};

let active = null;

/** Retorna o provider ativo. DPAPI no Windows; arquivo protegido por permissão nos demais. */
export async function getSecureStorage() {
  if (active) return active;
  if (process.platform === "win32") {
    try {
      await powershell("Add-Type -AssemblyName System.Security; 'ok'", {});
      active = dpapiProvider;
      return active;
    } catch {
      console.warn("[JARVIS] DPAPI indisponível; usando armazenamento em arquivo protegido.");
    }
  }
  active = fileProvider;
  return active;
}
