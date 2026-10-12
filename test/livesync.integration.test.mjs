import assert from "node:assert/strict";
import test from "node:test";
import { DirectFileManipulator } from "@vrtmrz/livesync-commonlib";
import { directFileConfig, loadConfig } from "../src/config.mjs";
import { putIfRevision } from "../src/livesync.mjs";

const integration = process.env.LIVESYNC_INTEGRATION === "true" ? test : test.skip;

integration("encrypted LiveSync writes round-trip and reject stale revisions", async (t) => {
  const config = loadConfig(process.env);
  const dfm = new DirectFileManipulator(directFileConfig(config));
  await dfm.ready.promise;
  t.after(async () => {
    await dfm.close();
  });

  const path = `integration/${crypto.randomUUID()}.md`;
  const initial = "# Integration\n\nInitial\n";
  assert.equal(await dfm.put(path, initial, {
    ctime: Date.now(),
    mtime: Date.now(),
    size: Buffer.byteLength(initial),
  }, "plain"), true);

  const first = await dfm.get(path, false);
  assert.ok(first && first._rev);
  assert.equal(first.data.join(""), initial);

  const updated = `${initial}\nUpdated\n`;
  const metadata = {
    ctime: first.ctime,
    mtime: Date.now(),
    size: Buffer.byteLength(updated),
  };
  assert.equal(await putIfRevision(dfm, path, updated, metadata, first._rev), true);
  assert.equal((await dfm.get(path, false)).data.join(""), updated);
  assert.equal(await putIfRevision(dfm, path, "stale overwrite", metadata, first._rev), false);
  assert.equal((await dfm.get(path, false)).data.join(""), updated);
});
