import assert from "node:assert/strict";
import test from "node:test";
import { Processor } from "../src/processor.mjs";

class FakeDfm {
  constructor(entries) {
    this.entries = new Map(Object.entries(entries));
    this.failWrites = false;
  }
  async *enumerateAllNormalDocs() {
    for (const [path, entry] of this.entries) yield { path, mtime: entry.mtime || 0 };
  }
  async get(path) {
    const entry = this.entries.get(path);
    return entry ? structuredClone(entry) : false;
  }
  async put(path, content, metadata) {
    if (this.failWrites) return false;
    this.entries.set(path, { ...metadata, data: [content] });
    return true;
  }
  async putIfRevision(path, content, metadata, revision) {
    const current = this.entries.get(path);
    if (current?._rev !== revision) return false;
    return this.put(path, content, { ...metadata, _rev: `${Number(revision.split("-")[0]) + 1}-next` });
  }
}

class FakeState {
  constructor() { this.done = new Set(); }
  has(key) { return this.done.has(key); }
  async markDone(key) { this.done.add(key); }
}

const config = { redactPaths: true, whisper: { modelName: "test-model" } };
const log = { info() {}, warn() {}, error() {} };
const audio = { path: "Audio/voice.m4a", _id: "audio", _rev: "1-a", data: [Buffer.from("audio").toString("base64")] };

test("inserts transcript in the unique embedding note", async () => {
  const dfm = new FakeDfm({ "Notes/day.md": { _rev: "1-note", mtime: 1, ctime: 1, data: ["# Day\n![[Audio/voice.m4a]]\n"] } });
  const state = new FakeState();
  const processor = new Processor({ dfm, state, config, log, transcribe: async () => "hello" });
  assert.equal(await processor.process(audio), true);
  assert.match(dfm.entries.get("Notes/day.md").data[0], /## Transcript\n\nhello/);
  assert.equal(state.has("audio|1-a"), true);
});

test("re-reads and reapplies after a concurrent note edit", async () => {
  const dfm = new FakeDfm({ "Notes/day.md": { _rev: "1-note", mtime: 1, data: ["# Day\n![[Audio/voice.m4a]]\n"] } });
  const originalPut = dfm.putIfRevision.bind(dfm);
  let raced = false;
  dfm.putIfRevision = async (path, content, metadata, revision) => {
    if (!raced) {
      raced = true;
      dfm.entries.set(path, { _rev: "2-user", mtime: 2, data: ["# Day\nUser edit\n![[Audio/voice.m4a]]\n"] });
    }
    return originalPut(path, content, metadata, revision);
  };
  const processor = new Processor({ dfm, state: new FakeState(), config, log, transcribe: async () => "hello" });
  assert.equal(await processor.process(audio), true);
  assert.match(dfm.entries.get("Notes/day.md").data[0], /User edit/);
  assert.match(dfm.entries.get("Notes/day.md").data[0], /## Transcript\n\nhello/);
});

test("does not mark failed fallback writes complete", async () => {
  const dfm = new FakeDfm({});
  dfm.failWrites = true;
  const state = new FakeState();
  const processor = new Processor({ dfm, state, config, log, transcribe: async () => "hello" });
  await assert.rejects(() => processor.process(audio), /fallback write failed/);
  assert.equal(state.has("audio|1-a"), false);
});

test("does not overwrite an existing similarly named fallback note", async () => {
  const existingPath = (await import("../src/notes.mjs")).fallbackPath(audio.path, "existing");
  const dfm = new FakeDfm({ [existingPath]: { data: ["user content"] } });
  const state = new FakeState();
  const processor = new Processor({ dfm, state, config, log, transcribe: async () => "hello" });
  assert.equal(await processor.process(audio), true);
  assert.equal(dfm.entries.get(existingPath).data[0], "user content");
  assert.equal(state.has("audio|1-a"), true);
});

test("rebuilds state from a fallback marker before transcription", async () => {
  const actualPath = (await import("../src/notes.mjs")).fallbackPath(audio.path, "existing");
  const dfm = new FakeDfm({ [actualPath]: { data: ["<!-- livesync-whisper-listener:audio|1-a -->"] } });
  const state = new FakeState();
  const processor = new Processor({ dfm, state, config, log, transcribe: async () => assert.fail("should not transcribe") });
  assert.equal(await processor.process(audio), false);
  assert.equal(state.has("audio|1-a"), true);
});

test("rejects oversized audio before concatenation or transcription", async () => {
  const smallLimit = { ...config, whisper: { ...config.whisper, maxAudioBytes: 4 } };
  const processor = new Processor({ dfm: new FakeDfm({}), state: new FakeState(), config: smallLimit, log, transcribe: async () => assert.fail("should not transcribe") });
  await assert.rejects(() => processor.process(audio), /MAX_AUDIO_BYTES/);
});

test("rejects ambiguous embedding notes before sending audio", async () => {
  const dfm = new FakeDfm({
    "one.md": { mtime: 2, data: ["![[Audio/voice.m4a]]"] },
    "two.md": { mtime: 1, data: ["![[Audio/voice.m4a]]"] },
  });
  let transcribed = false;
  const processor = new Processor({ dfm, state: new FakeState(), config, log, transcribe: async () => { transcribed = true; } });
  await assert.rejects(() => processor.process(audio), /multiple notes/);
  assert.equal(transcribed, false);
});

test("rebuilds state from an existing note marker", async () => {
  const dfm = new FakeDfm({ "day.md": { data: ["![[Audio/voice.m4a]]\n<!-- livesync-whisper-listener:audio|1-a -->"] } });
  const state = new FakeState();
  const processor = new Processor({ dfm, state, config, log, transcribe: async () => assert.fail("should not transcribe") });
  assert.equal(await processor.process(audio), false);
  assert.equal(state.has("audio|1-a"), true);
});
