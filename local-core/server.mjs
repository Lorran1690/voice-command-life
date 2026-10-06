import http from "node:http";

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

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...cors(),
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) throw new Error("Pedido muito grande.");
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
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

async function handleChat(req, res) {
  let body;

  try {
    body = await readBody(req);
  } catch (error) {
    return json(res, 400, {
      error: error instanceof Error ? error.message : "Pedido JSON inválido.",
    });
  }

  const messages = normalizeMessages(body?.messages);

  if (!messages.length) {
    return json(res, 400, { error: "Nenhuma mensagem válida foi enviada." });
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

    return json(res, 200, {
      text: answer,
      model: MODEL,
      provider: "ollama",
    });
  } catch (error) {
    console.error("[JARVIS] Falha no Ollama:", error);
    return json(res, 502, {
      error: error instanceof Error ? error.message : "Falha no Ollama.",
    });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors());
    return res.end();
  }

  const url = new URL(req.url || "/", "http://" + HOST + ":" + PORT);

  if (req.method === "GET" && url.pathname === "/health") {
    try {
      const response = await fetch(OLLAMA_URL + "/api/tags");
      return json(res, 200, {
        ok: true,
        provider: "ollama",
        model: MODEL,
        ollama_ready: response.ok,
      });
    } catch {
      return json(res, 200, {
        ok: true,
        provider: "ollama",
        model: MODEL,
        ollama_ready: false,
      });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    return handleChat(req, res);
  }

  return json(res, 404, { error: "Rota não encontrada." });
});

server.listen(PORT, HOST, () => {
  console.log("JARVIS Core local: http://" + HOST + ":" + PORT);
  console.log("Ollama: " + OLLAMA_URL);
  console.log("Modelo: " + MODEL);
});
