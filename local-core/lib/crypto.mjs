// HASH de senha (Argon2id, irreversível) e CRIPTOGRAFIA de dados (AES-256-GCM, reversível).
// São operações diferentes de propósito: senhas nunca são criptografadas, apenas hasheadas.
import crypto from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";

import { getSecureStorage } from "./secure-storage.mjs";

// Parâmetros recomendados pela OWASP para Argon2id (m=64 MiB, t=3, p=1).
const ARGON = { parallelism: 1, iterations: 3, memorySize: 65536, hashLength: 32 };

export async function hashPassword(password) {
  return argon2id({
    password,
    salt: crypto.randomBytes(16),
    ...ARGON,
    outputType: "encoded",
  });
}

export async function verifyPassword(password, encoded) {
  try {
    return await argon2Verify({ password, hash: encoded });
  } catch {
    return false;
  }
}

let dummyHash = null;
/** Usado quando o usuário não existe, para que o tempo de resposta não revele isso. */
export async function burnPasswordCheck(password) {
  dummyHash ??= await hashPassword(crypto.randomBytes(18).toString("base64"));
  await verifyPassword(password, dummyHash);
  return false;
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function newId() {
  return crypto.randomUUID();
}

let dataKey = null;
export let dataKeyProvider = "pendente";

/** Chave de dados AES-256: gerada uma vez e guardada no SecureStorage; nunca no código. */
export async function initDataKey() {
  const storage = await getSecureStorage();
  dataKeyProvider = storage.id;
  let key = await storage.get("jarvis.datakey");
  if (!key || key.length !== 32) {
    key = crypto.randomBytes(32);
    await storage.set("jarvis.datakey", key);
  }
  dataKey = key;
}

export function encryptText(plain, aad) {
  if (!dataKey) throw new Error("Chave de dados não inicializada.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dataKey, iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return "v1:" + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptText(payload, aad) {
  if (!dataKey) throw new Error("Chave de dados não inicializada.");
  if (typeof payload !== "string" || !payload.startsWith("v1:")) return "";
  try {
    const raw = Buffer.from(payload.slice(3), "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", dataKey, raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return "[conteúdo ilegível: falha de integridade]";
  }
}

/** Comparação em tempo constante. */
export function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
