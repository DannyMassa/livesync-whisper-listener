# Configuration Reference

The following options must match the Self-hosted LiveSync client. Defaults match
the configuration used during initial development but are not universal.

| Variable | Default |
| --- | --- |
| `LIVESYNC_E2EE_ALGORITHM` | `v2` |
| `LIVESYNC_DYNAMIC_ITERATIONS` | `false` |
| `LIVESYNC_CUSTOM_CHUNK_SIZE` | `60` |
| `LIVESYNC_MINIMUM_CHUNK_SIZE` | `20` |
| `LIVESYNC_HASH_ALGORITHM` | `xxhash64` |
| `LIVESYNC_CHUNK_SPLITTER_VERSION` | `v3-rabin-karp` |
| `LIVESYNC_COMPRESSION` | `false` |
| `LIVESYNC_CASE_SENSITIVE` | `false` |
| `LIVESYNC_NO_FIXED_CHUNK_REVISION` | `true` |

Boolean values accept only `true` or `false`. Numeric values must be positive
integers. Required credentials and URLs are validated before CouchDB is opened.

The listener uses the E2EE passphrase as the path-obfuscation passphrase unless
`LIVESYNC_OBFUSCATE_PASSPHRASE` is set separately.

## Recovery

The state file is `/state/state.json` by default. Back it up with the persistent
volume, but do not rely on it as the sole deduplication mechanism. Every completed
transcript contains a marker that allows state to be rebuilt.

If state is corrupt, stop the listener, preserve the file for diagnosis, remove
it, and restart. The listener searches all Markdown notes for markers before it
sends a recording to Whisper again. Standalone fallback names include both a
source-path digest and a random suffix, so concurrent listeners cannot replace
one another's notes.
