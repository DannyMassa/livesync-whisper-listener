import assert from "node:assert/strict";
import test from "node:test";
import { directFileConfig, loadConfig } from "../src/config.mjs";

const base = {
  COUCHDB_URL: "http://couchdb:5984/",
  COUCHDB_USERNAME: "listener",
  COUCHDB_PASSWORD: "secret",
  LIVESYNC_DATABASE: "vault",
  LIVESYNC_E2EE_PASSPHRASE: "phrase",
  WHISPER_URL: "https://whisper.example/",
};

test("loads required configuration and safe defaults", () => {
  const config = loadConfig(base);
  assert.equal(config.couchdb.url, "http://couchdb:5984");
  assert.equal(config.whisper.url, "https://whisper.example");
  assert.equal(config.whisper.maxAudioBytes, 104857600);
  assert.equal(config.redactPaths, true);
  assert.equal(directFileConfig(config).obfuscatePassphrase, "phrase");
});

test("rejects missing and invalid configuration", () => {
  assert.throws(() => loadConfig({ ...base, COUCHDB_PASSWORD: "" }), /COUCHDB_PASSWORD is required/);
  assert.throws(() => loadConfig({ ...base, WHISPER_URL: "file:\/\/tmp" }), /HTTP or HTTPS/);
  assert.throws(() => loadConfig({ ...base, INTERVAL_SECONDS: "0" }), /positive integer/);
  assert.throws(() => loadConfig({ ...base, REDACT_PATHS: "yes" }), /true or false/);
});
