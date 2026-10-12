import assert from "node:assert/strict";
import test from "node:test";
import { transcribe } from "../src/whisper.mjs";

const config = {
  url: "https://whisper.example",
  maxAudioBytes: 10,
  timeoutMs: 1000,
  bearerToken: "token",
};

test("submits expected whisper.cpp inference fields", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return new Response(" transcript \n", { status: 200 });
  };
  assert.equal(await transcribe(Buffer.from("audio"), "voice.m4a", config, fetchImpl), "transcript");
  assert.equal(request.url, "https://whisper.example/inference");
  assert.equal(request.options.headers.authorization, "Bearer token");
  assert.equal(request.options.body.get("max_context"), "0");
  assert.equal(request.options.body.get("suppress_non_speech"), "true");
});

test("rejects oversized audio and HTTP failures", async () => {
  await assert.rejects(() => transcribe(Buffer.alloc(11), "voice.m4a", config), /MAX_AUDIO_BYTES/);
  await assert.rejects(
    () => transcribe(Buffer.from("a"), "voice.m4a", config, async () => new Response("bad", { status: 503 })),
    /whisper HTTP 503/,
  );
});
