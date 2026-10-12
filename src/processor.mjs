import { basename } from "node:path";
import { fallbackContent, fallbackPath, findEmbedLines, insertTranscript, markerFor } from "./notes.mjs";

const entryText = (entry) => Array.isArray(entry?.data) ? entry.data.join("") : undefined;

export class Processor {
  constructor({ dfm, state, transcribe, config, log = console }) {
    this.dfm = dfm;
    this.state = state;
    this.transcribe = transcribe;
    this.config = config;
    this.log = log;
  }

  displayPath(path) {
    return this.config.redactPaths ? basename(path) : path;
  }

  async embeddingCandidates(audioPath) {
    const notes = [];
    for await (const meta of this.dfm.enumerateAllNormalDocs({ metaOnly: true })) {
      const path = String(meta.path);
      if (!/\.md$/i.test(path) || path.endsWith(".whisper.ai.md")) continue;
      notes.push({ path, mtime: meta.mtime || 0 });
    }
    notes.sort((a, b) => b.mtime - a.mtime);
    const matches = [];
    for (const note of notes) {
      let entry;
      try {
        entry = await this.dfm.get(note.path, false);
      } catch {
        continue;
      }
      const content = entryText(entry);
      if (content === undefined) continue;
      const lines = findEmbedLines(content, audioPath);
      if (lines.length) matches.push({ ...note, entry, lineIndex: lines[0] });
    }
    return matches;
  }

  async markerExists(marker) {
    for await (const meta of this.dfm.enumerateAllNormalDocs({ metaOnly: true })) {
      const path = String(meta.path);
      if (!/\.md$/i.test(path)) continue;
      try {
        const content = entryText(await this.dfm.get(path, false));
        if (content?.includes(marker)) return true;
      } catch {
        // A transiently unreadable note should not stop the rest of the scan.
      }
    }
    return false;
  }

  async putVerified(path, content, previous) {
    const metadata = {
      ctime: previous?.ctime || Date.now(),
      mtime: Date.now(),
      size: Buffer.byteLength(content),
    };
    const stored = previous?._rev
      ? await this.dfm.putIfRevision(path, content, metadata, previous._rev)
      : await this.dfm.put(path, content, metadata, "plain");
    if (!stored) return false;
    const written = await this.dfm.get(path, false);
    return entryText(written) === content;
  }

  async process(doc) {
    const audioPath = String(doc.path);
    const key = `${doc._id || audioPath}|${doc._rev || ""}`;
    if (this.state.has(key)) return false;
    const marker = markerFor(key);
    if (await this.markerExists(marker)) {
      await this.state.markDone(key);
      this.log.info(`state rebuilt from note marker: ${this.displayPath(audioPath)}`);
      return false;
    }
    const candidates = await this.embeddingCandidates(audioPath);
    if (candidates.length > 1) {
      throw new Error(`audio is embedded in multiple notes: ${this.displayPath(audioPath)}`);
    }

    const fallback = candidates.length ? undefined : fallbackPath(audioPath);

    const entry = Array.isArray(doc.data)
      ? doc
      : Number(doc.size ?? 0) > this.config.whisper.maxAudioBytes
        ? undefined
        : await this.dfm.get(audioPath, false);
    if (entry === undefined) throw new Error(`audio exceeds MAX_AUDIO_BYTES: ${this.displayPath(audioPath)}`);
    if (!Array.isArray(entry?.data)) throw new Error(`audio is unreadable: ${this.displayPath(audioPath)}`);
    if (Number(entry.size ?? 0) > this.config.whisper.maxAudioBytes) {
      throw new Error(`audio exceeds MAX_AUDIO_BYTES: ${this.displayPath(audioPath)}`);
    }
    const chunks = [];
    let byteLength = 0;
    for (const chunk of entry.data) {
      const decoded = Buffer.from(String(chunk), "base64");
      byteLength += decoded.byteLength;
      if (byteLength > this.config.whisper.maxAudioBytes) {
        throw new Error(`audio exceeds MAX_AUDIO_BYTES: ${this.displayPath(audioPath)}`);
      }
      chunks.push(decoded);
    }
    const bytes = Buffer.concat(chunks, byteLength);
    const transcript = await this.transcribe(bytes, basename(audioPath));
    if (!transcript) {
      this.log.warn(`empty transcript: ${this.displayPath(audioPath)}`);
      return false;
    }

    if (fallback) {
      const content = fallbackContent(audioPath, transcript, marker, this.config.whisper.modelName);
      if (!await this.putVerified(fallback, content)) throw new Error(`fallback write failed: ${this.displayPath(fallback)}`);
      await this.state.markDone(key);
      this.log.info(`transcribed ${this.displayPath(audioPath)} to fallback note`);
      return true;
    }

    const candidate = candidates[0];
    for (let attempt = 0; attempt < 3; attempt++) {
      const latest = attempt === 0 ? candidate.entry : await this.dfm.get(candidate.path, false);
      const content = entryText(latest);
      if (content === undefined) throw new Error(`note is unreadable: ${this.displayPath(candidate.path)}`);
      if (content.includes(marker)) {
        await this.state.markDone(key);
        return false;
      }
      const matches = findEmbedLines(content, audioPath);
      if (matches.length !== 1) throw new Error(`embed changed or is ambiguous: ${this.displayPath(candidate.path)}`);
      const updated = insertTranscript(content, matches[0], transcript, marker);
      if (await this.putVerified(candidate.path, updated, latest)) {
        await this.state.markDone(key);
        this.log.info(`transcribed ${this.displayPath(audioPath)} into an embedding note`);
        return true;
      }
    }
    throw new Error(`note write conflicted repeatedly: ${this.displayPath(candidate.path)}`);
  }
}
