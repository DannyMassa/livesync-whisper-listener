const required = (env, name) => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const positiveInteger = (env, name, fallback) => {
  const value = Number(env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};

const boolean = (env, name, fallback) => {
  const value = env[name];
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
};

const url = (value, name) => {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTP(S) URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${name} must use HTTP or HTTPS`);
  }
  return value.replace(/\/$/, '');
};

export function loadConfig(env = process.env) {
  const passphrase = required(env, "LIVESYNC_E2EE_PASSPHRASE");
  return {
    couchdb: {
      url: url(required(env, "COUCHDB_URL"), "COUCHDB_URL"),
      username: required(env, "COUCHDB_USERNAME"),
      password: required(env, "COUCHDB_PASSWORD"),
      database: required(env, "LIVESYNC_DATABASE"),
    },
    livesync: {
      passphrase,
      obfuscatePassphrase: env.LIVESYNC_OBFUSCATE_PASSPHRASE?.trim() || passphrase,
      useDynamicIterationCount: boolean(env, "LIVESYNC_DYNAMIC_ITERATIONS", false),
      customChunkSize: positiveInteger(env, "LIVESYNC_CUSTOM_CHUNK_SIZE", 60),
      minimumChunkSize: positiveInteger(env, "LIVESYNC_MINIMUM_CHUNK_SIZE", 20),
      hashAlg: env.LIVESYNC_HASH_ALGORITHM?.trim() || "xxhash64",
      chunkSplitterVersion: env.LIVESYNC_CHUNK_SPLITTER_VERSION?.trim() || "v3-rabin-karp",
      enableCompression: boolean(env, "LIVESYNC_COMPRESSION", false),
      handleFilenameCaseSensitive: boolean(env, "LIVESYNC_CASE_SENSITIVE", false),
      doNotUseFixedRevisionForChunks: boolean(env, "LIVESYNC_NO_FIXED_CHUNK_REVISION", true),
      E2EEAlgorithm: env.LIVESYNC_E2EE_ALGORITHM?.trim() || "v2",
    },
    whisper: {
      url: url(required(env, "WHISPER_URL"), "WHISPER_URL"),
      modelName: env.WHISPER_MODEL_NAME?.trim() || "whisper",
      timeoutMs: positiveInteger(env, "WHISPER_TIMEOUT_MS", 900000),
      maxAudioBytes: positiveInteger(env, "MAX_AUDIO_BYTES", 104857600),
      bearerToken: env.WHISPER_BEARER_TOKEN?.trim() || undefined,
    },
    intervalSeconds: positiveInteger(env, "INTERVAL_SECONDS", 30),
    stateDir: env.STATE_DIR?.trim() || "/state",
    redactPaths: boolean(env, "REDACT_PATHS", true),
  };
}

export function directFileConfig(config) {
  return {
    url: config.couchdb.url,
    username: config.couchdb.username,
    password: config.couchdb.password,
    database: config.couchdb.database,
    passphrase: config.livesync.passphrase,
    obfuscatePassphrase: config.livesync.obfuscatePassphrase,
    useDynamicIterationCount: config.livesync.useDynamicIterationCount,
    customChunkSize: config.livesync.customChunkSize,
    minimumChunkSize: config.livesync.minimumChunkSize,
    hashAlg: config.livesync.hashAlg,
    useEden: false,
    enableChunkSplitterV2: false,
    chunkSplitterVersion: config.livesync.chunkSplitterVersion,
    enableCompression: config.livesync.enableCompression,
    handleFilenameCaseSensitive: config.livesync.handleFilenameCaseSensitive,
    doNotUseFixedRevisionForChunks: config.livesync.doNotUseFixedRevisionForChunks,
    E2EEAlgorithm: config.livesync.E2EEAlgorithm,
  };
}
