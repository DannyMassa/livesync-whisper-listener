# LiveSync Whisper Listener

An always-on worker that finds audio attachments in an Obsidian Self-hosted
LiveSync vault, sends the decrypted audio to a whisper.cpp-compatible server,
and writes the transcript back through LiveSync.

The listener inserts a `Transcript` subsection immediately after a unique
Obsidian audio embed. When no note embeds the audio, it creates a sibling
`*.whisper.ai.md` note. A persistent state file and an HTML marker in the note
make processing idempotent across restarts or state loss.

This project is unofficial and is not affiliated with or endorsed by Obsidian,
Dynalist Inc., or the Self-hosted LiveSync maintainers.

## Security model

The listener is a highly trusted vault client. It receives credentials that can
read and write the LiveSync CouchDB database and the passphrase that decrypts
the vault. It reconstructs recordings as plaintext and sends them to the
configured Whisper endpoint.

- Run the listener and Whisper server only on trusted private networks.
- Prefer HTTPS and an authenticated proxy for Whisper across host boundaries.
- Do not expose an unauthenticated whisper.cpp server to the Internet.
- Use a dedicated CouchDB account when your LiveSync deployment supports one.
- Protect the persistent state volume and application logs as sensitive data.
- Back up the vault before adopting any automation that writes notes.

Listener-owned messages redact paths to basenames by default. The underlying
LiveSync library may still log document paths, so restrict access to runtime
logs. The listener intentionally has no Service or public HTTP endpoint.

## Prerequisites

- Node.js 22 or newer, or the published container image
- An existing Self-hosted LiveSync CouchDB database
- A whisper.cpp-compatible `/inference` HTTP endpoint
- LiveSync settings matching the listener's E2EE and chunk configuration

The tested compatibility baseline is `@vrtmrz/livesync-commonlib@0.1.31` with:

- E2EE algorithm `v2`
- chunk splitter `v3-rabin-karp`
- hash algorithm `xxhash64`
- dynamic iteration count disabled
- compression disabled
- case-insensitive paths

A mismatch can make documents unreadable or cause invalid writes. Compare these
values with the Self-hosted LiveSync client configuration before starting the
listener.

## Configuration

Required variables:

| Variable | Description |
| --- | --- |
| `COUCHDB_URL` | CouchDB base URL, including scheme and port |
| `COUCHDB_USERNAME` | CouchDB account used by the listener |
| `COUCHDB_PASSWORD` | CouchDB account password |
| `LIVESYNC_DATABASE` | LiveSync CouchDB database |
| `LIVESYNC_E2EE_PASSPHRASE` | Vault content encryption passphrase |
| `WHISPER_URL` | whisper.cpp-compatible server URL |

Common optional variables:

| Variable | Default | Description |
| --- | --- | --- |
| `LIVESYNC_OBFUSCATE_PASSPHRASE` | E2EE passphrase | Path-obfuscation passphrase |
| `WHISPER_MODEL_NAME` | `whisper` | Model recorded in fallback frontmatter |
| `WHISPER_BEARER_TOKEN` | unset | Bearer token sent to an authenticating proxy |
| `WHISPER_TIMEOUT_MS` | `900000` | Inference request timeout |
| `MAX_AUDIO_BYTES` | `104857600` | Maximum recording size in bytes |
| `INTERVAL_SECONDS` | `30` | Poll interval |
| `STATE_DIR` | `/state` | Persistent state directory |
| `REDACT_PATHS` | `true` | Hide full paths in listener-owned log messages |

Advanced LiveSync compatibility variables are documented in
[`docs/configuration.md`](docs/configuration.md).

## Run with Docker Compose

Create a secret environment file outside version control, then run:

```sh
docker compose --env-file listener.env up -d
```

See [`examples/compose.env.example`](examples/compose.env.example). The main
Compose file expects an independently operated Whisper endpoint. Optional CPU
and AMD/Vulkan Whisper examples are under [`examples/`](examples/).

## Run on Kubernetes

Create a Kubernetes Secret containing `couchdb-password`, `e2ee-passphrase`,
and optionally `whisper-bearer-token`, then install the chart:

```sh
helm install livesync-whisper-listener deploy/helm \
  --set config.couchdbUrl=http://couchdb.default.svc:5984 \
  --set config.couchdbUsername=listener \
  --set config.database=vault \
  --set config.whisperUrl=http://whisper.default.svc:8080 \
  --set secrets.existingSecret=livesync-whisper-listener
```

For released versions, use the OCI chart and pin the application image digest.
The chart never creates credential values and has no dependency on External
Secrets, a specific secret manager, storage class, ingress controller, or GitOps
operator.

## Processing behavior

- Audio formats: `.webm`, `.m4a`, `.mp3`, `.wav`, `.ogg`, `.flac`, `.caf`, `.aac`
- Only `![[...]]` embeds are matched; ordinary wiki links and fenced code are ignored.
- A path-qualified embed wins over a basename-only embed.
- If multiple notes embed the same audio, processing stops instead of guessing.
- Note writes are re-read and verified before state is marked complete.
- Empty transcripts are retried on a later poll.
- State is written atomically and can be rebuilt from transcript markers.

The LiveSync common library writes complete note content. The listener stores
against the exact revision it read and retries when another writer advances that
revision. Backups remain the final recovery boundary.

## Development

```sh
npm ci
npm run check
helm lint deploy/helm
helm template test deploy/helm --set image.repository=example/listener
```

See [`SECURITY.md`](SECURITY.md) for vulnerability reporting and
[`CONTRIBUTING.md`](CONTRIBUTING.md) for contribution requirements.

The test suite uses synthetic storage doubles for deterministic conflict and
failure coverage. Before each release, maintainers also run `--once` against a
disposable encrypted LiveSync database and mock Whisper endpoint; no real vault
data belongs in repository fixtures or CI artifacts.

## License

Copyright (C) 2026 Danny Massa. Licensed under GPL-3.0-only.
