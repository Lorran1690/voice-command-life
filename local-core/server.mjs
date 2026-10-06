import http from "node:http";
import { convertToModelMessages, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const HOST = process.env.JARVIS_HOST || "127.0.0.1";
const PORT = Number(process.env.JARVIS_PORT || 3210);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1";
const MODEL = process.env.JARVIS_MODEL || "qwen3:4b";

const ollama = createOpenAI({ baseURL: OLLAMA_BASE_URL, apiKey: "ollama-local" });
const SYSTEM_PROMPT = [
  "Você é J.A.R.V.I.S., o assistente pessoal local do usuário.",
  "Fale sempre em português do Brasil.",
  "Seja natural, inteligente, calmo e útil.",
  "Seja conciso por padrão, mas explique quando necessário.",
  "Você está rodando LOCALMENTE no computador do usuário.",
  "Não invente acesso a internet, arquivos ou programas.",
].join("\n");

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
  };
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...cors() });
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
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleChat(req, res) {
  let body;
  try { body = await readBody(req); }
  catch { return json(res, 400, { error: "Pedido JSON inválido." }); }

  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    return json(res, 400, { error: "Mensagens ausentes." });
  }

  try {
    const messages = await convertToModelMessages(body.messages);
    const result = streamText({
      model: ollama.chat(MODEL),
      system: SYSTEM_PROMPT,
      messages,
      maxRetries: 0,
      maxOutputTokens: 1200,
    });
    const response = result.toUIMessageStreamResponse({ originalMessages: body.messages, sendReasoning: false });
    res.writeHead(response.status, {
      "Content-Type": response.headers.get("content-type") || "text/event-stream",
      ...cors(),
    });
    if (response.body) {
      for await (const chunk of response.body) res.write(Buffer.from(chunk));
    }
    res.end();
  } catch (error) {
    console.error(error);
    json(res, 502, { error: error instanceof Error ? error.message : "Falha no JARVIS local." });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, cors()); return res.end(); }
  const url = new URL(req.url || "/", "http://" + HOST + ":" + PORT);
  if (req.method === "GET" && url.pathname === "/health") {
    let ollamaReady = false;
    try {
      const response = await fetch(OLLAMA_BASE_URL.replace(/\/v1\/?$/, "") + "/api/tags");
      ollamaReady = response.ok;
    } catch {}
    return json(res, 200, { ok: true, provider: "ollama", model: MODEL, ollama_ready: ollamaReady });
  }
  if (req.method === "POST" && url.pathname === "/api/chat") return handleChat(req, res);
  return json(res, 404, { error: "Rota não encontrada." });
});

server.listen(PORT, HOST, () => {
  console.log("JARVIS Core local: http://" + HOST + ":" + PORT);
  console.log("Modelo: " + MODEL);
});