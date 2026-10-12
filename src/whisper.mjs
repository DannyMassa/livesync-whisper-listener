export async function transcribe(bytes, name, config, fetchImpl = fetch) {
  if (bytes.byteLength > config.maxAudioBytes) {
    throw new Error(`audio exceeds MAX_AUDIO_BYTES (${bytes.byteLength} > ${config.maxAudioBytes})`);
  }
  const body = new FormData();
  body.append("file", new Blob([bytes]), name);
  body.append("response_format", "text");
  body.append("vad", "false");
  body.append("max_context", "0");
  body.append("suppress_non_speech", "true");
  const headers = config.bearerToken ? { authorization: `Bearer ${config.bearerToken}` } : undefined;
  const response = await fetchImpl(`${config.url}/inference`, {
    method: "POST",
    body,
    headers,
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!response.ok) throw new Error(`whisper HTTP ${response.status}`);
  return (await response.text()).trim();
}
