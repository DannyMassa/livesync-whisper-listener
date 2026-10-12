# Security Policy

## Reporting

Do not open a public issue for a vulnerability that could expose a vault,
credential, recording, or transcript. Use GitHub's private vulnerability
reporting feature for this repository.

Include the affected version, configuration, reproduction steps, and impact.
Use synthetic data and remove credentials, vault paths, recordings, and
transcripts from reports.

## Supported versions

Security fixes are provided for the latest released minor version. Users should
pin release tags and image digests, then upgrade after reviewing release notes.

## Trust boundary

Compromise of this worker can expose or modify the entire connected LiveSync
vault. The Whisper endpoint receives plaintext audio. Treat both services and
their network path as trusted infrastructure.

## Dependency advisories

`@vrtmrz/livesync-commonlib@0.1.31` is pinned for LiveSync protocol
compatibility. Its PouchDB dependency tree currently includes an unsupported
`uuid` release with a moderate buffer-bounds advisory. npm reports no available
compatible fix. The listener does not call UUID v3/v5/v6 with caller-provided
buffers, but users should treat this as an upstream risk and follow releases for
a compatible commonlib upgrade.
