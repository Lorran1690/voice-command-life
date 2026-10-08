import http from "node:http";
import { listWindowsVoices, synthesizeWindows } from "./voice.mjs";

const HOST = process.env.JARVIS_HOST || "127.0.0.1";
const PORT = Number(process.env.JARVIS_PORT || 3210);
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const MODEL = process.env.JARVIS_MODEL || "qwen3:4b";

const SYSTEM_PROMPT = [
  "Você é J.A.R.V.I.S., o assistente pessoal local do usuário.",
  "Responda sempre em português do Brasil, salvo pedido contrário.",
  "Seja natural, inteligente, calmo, direto e útil.",
  "Não invente acesso à internet, arquivos, programas ou dispositivos.",
  "Você está rodando localmente no computador do usuário através do Ollama.",
  "Quando não souber algo, diga claramente que não sabe.",
].join("\n");

function allowedOrigin(origin) {
  if (!origin) return null;

  try {
    const parsed = new URL(origin);
    if (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    ) {
      return origin;
    }
  } catch {
    return null;
  }

  return null;
}

function cors(req) {
  const origin = allowedOrigin(req.headers.origin);

  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

function json(req, res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...cors(req),
  });
  res.end(JSON.stringify(body));
}

async function readBody(req, maxBytes = 256 * 1024) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("Pedido muito grande.");
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) throw new Error("Corpo vazio.");
  return JSON.parse(raw);
}

function normalizeMessages(input) {
  if (!Array.isArray(input)) return [];

  return input
    .map((message) => {
      if (!message || !["user", "assistant", "system"].includes(message.role)) return null;

      if (typeof message.content === "string") {
        return { role: message.role, content: message.content };
      }

      if (Array.isArray(message.parts)) {
        const text = message.parts
          .filter((part) => part?.type === "text" && typeof part.text === "string")
          .map((part) => part.text)
          .join("\n")
          .trim();

        return text ? { role: message.role, content: text } : null;
      }

      return null;
    })
    .filter(Boolean);
}

function cleanModelText(text) {
  return String(text ?? "")
    .replace(/<think>[\\s\\S]*?<\\/think>/gi, "")
    .trim();
}

async function handleChat(req, res) {
  let body;

  try {
    body = await readBody(req, 8 * 1024 * 1024);
  } catch (error) {
    return json(req, res, 400, {
      error: error instanceof Error ? error.message : "Pedido JSON inválido.",
    });
  }

  const messages = normalizeMessages(body?.messages);

  if (!messages.length) {
    return json(req, res, 400, { error: "Nenhuma mensagem válida foi enviada." });
  }

  try {
    const response = await fetch(OLLAMA_URL + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.filter((message) => message.role !== "system"),
        ],
        stream: false,
        think: false,
        options: {
          temperature: 0.7,
          top_p: 0.8,
          top_k: 20,
          presence_penalty: 1.5,
        },
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = payload?.error || "Ollama recusou o pedido.";
      throw new Error("Ollama HTTP " + response.status + ": " + String(detail));
    }

    const answer = cleanModelText(payload?.message?.content);

    if (!answer) {
      throw new Error("Ollama retornou uma resposta vazia.");
    }

    return json(req, res, 200, {
      text: answer,
      model: MODEL,
      provider: "ollama",
    });
  } catch (error) {
    console.error("[JARVIS] Falha no Ollama:", error instanceof Error ? error.message : "erro");
    return json(req, res, 502, {
      error: error instanceof Error ? error.message : "Falha no Ollama.",
    });
  }
}

async function handleVoices(req, res) {
  try {
    const voices = await listWindowsVoices();
    return json(req, res, 200, {
      provider: "windows-sapi",
      local: process.platform === "win32",
      voices,
    });
  } catch {
    return json(req, res, 200, {
      provider: "windows-sapi",
      local: false,
      voices: [],
    });
  }
}

async function handleSpeak(req, res) {
  let body;

  try {
    body = await readBody(req, 64 * 1024);
  } catch (error) {
    return json(req, res, 400, {
      error: error instanceof Error ? error.message : "Pedido JSON inválido.",
    });
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const voice = typeof body?.voice === "string" ? body.voice.trim() : "";
  const rate = Number.isFinite(Number(body?.rate)) ? Number(body.rate) : 0.98;
  const volume = Number.isFinite(Number(body?.volume)) ? Number(body.volume) : 1;

  if (!text) return json(req, res, 400, { error: "Texto vazio." });
  if (text.length > 4000) return json(req, res, 413, { error: "Texto de voz muito longo." });

  try {
    const audio = await synthesizeWindows({
      text,
      voice,
      speed: rate,
      volume,
    });

    res.writeHead(200, {
      "Content-Type": "audio/wav",
      "Content-Length": audio.buffer.length,
      ...cors(req),
      "Cache-Control": "no-store",
    });
    return res.end(audio.buffer);
  } catch (error) {
    console.error("[JARVIS] Falha no TTS local:", error instanceof Error ? error.message : "erro");
    return json(req, res, 502, {
      error: error instanceof Error ? error.message : "Falha no sintetizador local.",
    });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors(req));
    return res.end();
  }

  const url = new URL(req.url || "/", "http://" + HOST + ":" + PORT);

  if (req.method === "GET" && url.pathname === "/health") {
    try {
      const response = await fetch(OLLAMA_URL + "/api/tags");
      return json(req, res, 200, {
        ok: true,
        provider: "ollama",
        model: MODEL,
        ollama_ready: response.ok,
        voice_provider: process.platform === "win32" ? "windows-sapi" : "browser-fallback",
      });
    } catch {
      return json(req, res, 200, {
        ok: true,
        provider: "ollama",
        model: MODEL,
        ollama_ready: false,
        voice_provider: process.platform === "win32" ? "windows-sapi" : "browser-fallback",
      });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/voices") {
    return handleVoices(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    return handleChat(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/speak") {
    return handleSpeak(req, res);
  }

  return json(req, res, 404, { error: "Rota não encontrada." });
});

server.listen(PORT, HOST, () => {
  console.log("JARVIS Core local: http://" + HOST + ":" + PORT);
  console.log("Ollama: " + OLLAMA_URL);
  console.log("Modelo: " + MODEL);
  console.log("Voz: " + (process.platform === "win32" ? "Windows SAPI local" : "fallback do navegador"));
});
