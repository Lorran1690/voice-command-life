import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import {
  isNeuralVoiceAvailable,
  neuralVoiceRecord,
  synthesizeNeural,
  NEURAL_VOICE_NAME,
} from "./neural-voice.mjs";

test("Kokoro opcional: descoberta e síntese via servidor local", async (t) => {
  let requestPayload = null;
  const audio = Buffer.from("RIFF-elysia-wav-test");
  const server = createServer(async (req, res) => {
    if (req.url === "/health/ready") {
      res.writeHead(200).end("ok");
      return;
    }
    if (req.url === "/v1/audio/speech" && req.method === "POST") {
      const parts = [];
      for await (const part of req) parts.push(part);
      requestPayload = JSON.parse(Buffer.concat(parts).toString("utf8"));
      res.writeHead(200, { "Content-Type": "audio/wav" });
      res.end(audio);
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previous = process.env.ELYSIA_KOKORO_URL;
  process.env.ELYSIA_KOKORO_URL = "http://127.0.0.1:" + server.address().port;
  t.after(async () => {
    if (previous === undefined) delete process.env.ELYSIA_KOKORO_URL;
    else process.env.ELYSIA_KOKORO_URL = previous;
    await new Promise((resolve) => server.close(resolve));
  });

  assert.equal(await isNeuralVoiceAvailable(), true);
  assert.equal(neuralVoiceRecord().name, NEURAL_VOICE_NAME);
  const result = await synthesizeNeural({ text: "Olá, Elysia!", speed: 0.95 });
  assert.deepEqual(result.buffer, audio);
  assert.equal(result.voice.culture, "pt-BR");
  assert.equal(requestPayload.model, "kokoro");
  assert.equal(requestPayload.voice, "pf_dora");
  assert.equal(requestPayload.input, "Olá, Elysia!");
  assert.equal(requestPayload.response_format, "wav");
  assert.equal(requestPayload.speed, 0.95);
});

test("Kokoro opcional: impede URLs de rede externas", async (t) => {
  const previous = process.env.ELYSIA_KOKORO_URL;
  process.env.ELYSIA_KOKORO_URL = "https://example.org";
  t.after(() => {
    if (previous === undefined) delete process.env.ELYSIA_KOKORO_URL;
    else process.env.ELYSIA_KOKORO_URL = previous;
  });
  assert.equal(await isNeuralVoiceAvailable(), false);
  await assert.rejects(
    () => synthesizeNeural({ text: "Olá" }),
    /servidor de voz deve usar HTTP em localhost/i,
  );
});
