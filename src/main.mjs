#!/usr/bin/env node
import { DirectFileManipulator } from "@vrtmrz/livesync-commonlib";
import { loadConfig, directFileConfig } from "./config.mjs";
import { AUDIO_PATTERN } from "./notes.mjs";
import { Processor } from "./processor.mjs";
import { StateStore } from "./state.mjs";
import { transcribe } from "./whisper.mjs";
import { putIfRevision } from "./livesync.mjs";

const timestampedLog = Object.fromEntries(
  ["info", "warn", "error"].map((level) => [level, (...args) => console[level](`[${new Date().toISOString()}]`, ...args)]),
);

async function poll(dfm, processor) {
  for await (const meta of dfm.enumerateAllNormalDocs({ metaOnly: true })) {
    if (!AUDIO_PATTERN.test(String(meta.path))) continue;
    try {
      await processor.process(meta);
    } catch (error) {
      timestampedLog.error(`processing failed: ${error.message}`);
    }
  }
}

async function main() {
  const config = loadConfig();
  const state = new StateStore(config.stateDir);
  await state.load();
  const dfm = new DirectFileManipulator(directFileConfig(config));
  await dfm.ready.promise;
  dfm.putIfRevision = (...args) => putIfRevision(dfm, ...args);
  const processor = new Processor({
    dfm,
    state,
    config,
    log: timestampedLog,
    transcribe: (bytes, name) => transcribe(bytes, name, config.whisper),
  });
  let stopping = false;
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      stopping = true;
      timestampedLog.info(`received ${signal}; stopping after the current poll`);
    });
  }
  timestampedLog.info("listener started");
  do {
    await poll(dfm, processor);
    if (process.argv.includes("--once") || stopping) break;
    await new Promise((resolve) => setTimeout(resolve, config.intervalSeconds * 1000));
  } while (!stopping);
  await dfm.close();
}

main().catch((error) => {
  timestampedLog.error(`fatal: ${error.message}`);
  process.exitCode = 1;
});
