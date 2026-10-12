import { createHash, randomUUID } from "node:crypto";

export const AUDIO_PATTERN = /\.(webm|m4a|mp3|wav|ogg|flac|caf|aac)$/i;

export const markerFor = (key) => `<!-- livesync-whisper-listener:${key} -->`;

export function headingLevelAbove(lines, index) {
  let fenced = false;
  let level = 0;
  for (let i = 0; i <= index; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const match = /^(#{1,6})\s/.exec(lines[i]);
    if (match) level = match[1].length;
  }
  return level;
}

function basename(path) {
  return path.split("/").pop();
}

function embedsOnLine(line) {
  const embeds = [];
  const pattern = /!\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  for (const match of line.matchAll(pattern)) embeds.push(match[1].trim());
  return embeds;
}

export function findEmbedLines(content, audioPath) {
  const wantedPath = audioPath.replace(/^\//, "");
  const wantedBase = basename(wantedPath);
  const lines = content.split("\n");
  let fenced = false;
  const exact = [];
  const byBase = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    for (const target of embedsOnLine(lines[i])) {
      const normalized = target.replace(/^\//, "");
      if (normalized === wantedPath) exact.push(i);
      else if (basename(normalized) === wantedBase) byBase.push(i);
    }
  }
  return exact.length ? exact : byBase;
}

export function insertTranscript(content, lineIndex, transcript, marker) {
  const lines = content.split("\n");
  const level = headingLevelAbove(lines, lineIndex);
  const heading = "#".repeat(level === 0 ? 2 : Math.min(level + 1, 6));
  lines.splice(lineIndex + 1, 0, "", `${heading} Transcript`, "", ...transcript.split("\n"), "", marker);
  return lines.join("\n");
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\p{ASCII}]/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function fallbackPath(audioPath, uniqueSuffix = randomUUID().slice(0, 8)) {
  const name = basename(audioPath);
  const stem = name.replace(/\.[^.]+$/, "");
  const slug = slugify(stem) || "recording";
  const digest = createHash("sha256").update(audioPath).digest("hex").slice(0, 8);
  const directory = audioPath.includes("/") ? audioPath.slice(0, audioPath.lastIndexOf("/") + 1) : "";
  return `${directory}${slug}-${digest}-${uniqueSuffix}.whisper.ai.md`;
}

const yamlString = (value) => JSON.stringify(String(value));

export function fallbackContent(audioPath, transcript, marker, modelName, createdAt = new Date()) {
  return [
    "---",
    `source: ${yamlString(basename(audioPath))}`,
    `created: ${yamlString(createdAt.toISOString())}`,
    `model: ${yamlString(modelName)}`,
    "---",
    "",
    transcript,
    "",
    marker,
    "",
  ].join("\n");
}
