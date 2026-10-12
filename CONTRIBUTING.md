# Contributing

1. Open an issue before substantial behavior or compatibility changes.
2. Use synthetic fixtures only. Never commit vault data, credentials, real
   recordings, transcripts, hostnames, database names, or state files.
3. Run `npm run check` and `helm lint deploy/helm` before submitting a pull
   request.
4. Add tests for parsing, retry, state, or compatibility changes.
5. Document any change to the LiveSync E2EE or chunk settings prominently.

Contributions are accepted under GPL-3.0-only.
