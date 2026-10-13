import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { StateStore } from "../src/state.mjs";

test("persists state atomically and reloads it", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "listener-state-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const state = new StateStore(directory);
  await state.load();
  await state.markDone("audio|1-a");
  assert.equal(JSON.parse(await readFile(join(directory, "state.json"), "utf8")).done["audio|1-a"], true);
  const reloaded = new StateStore(directory);
  await reloaded.load();
  assert.equal(reloaded.has("audio|1-a"), true);
});

test("rejects corrupt or unsupported state", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "listener-state-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, "state.json"), "{}\n");
  await assert.rejects(() => new StateStore(directory).load(), /unsupported state schema/);
});

test("loads legacy unversioned state", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "listener-state-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, "state.json"), '{"done":{"audio|1-a":true}}\n');
  const state = new StateStore(directory);
  await state.load();
  assert.equal(state.has("audio|1-a"), true);
  await state.save();
  assert.equal(JSON.parse(await readFile(join(directory, "state.json"), "utf8")).version, 1);
});
