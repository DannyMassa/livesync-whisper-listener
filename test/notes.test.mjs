import assert from "node:assert/strict";
import test from "node:test";
import { fallbackContent, fallbackPath, findEmbedLines, headingLevelAbove, insertTranscript } from "../src/notes.mjs";

test("matches path-qualified embeds before basename-only embeds", () => {
  const content = [
    "![[other/recording.m4a]]",
    "![[voice/recording.m4a|Voice note]]",
    "[[voice/recording.m4a]]",
  ].join("\n");
  assert.deepEqual(findEmbedLines(content, "voice/recording.m4a"), [1]);
});

test("ignores ordinary links and fenced code", () => {
  const content = [
    "[[recording.m4a]]",
    "```md",
    "![[recording.m4a]]",
    "```",
    "text recording.m4a",
  ].join("\n");
  assert.deepEqual(findEmbedLines(content, "recording.m4a"), []);
});

test("inserts a transcript one heading level below the embed section", () => {
  const content = "# Day\n\n## Notes\n![[voice.m4a]]\nNext";
  const updated = insertTranscript(content, 3, "hello\nworld", "<!-- marker -->");
  assert.equal(headingLevelAbove(content.split("\n"), 3), 2);
  assert.equal(updated, "# Day\n\n## Notes\n![[voice.m4a]]\n\n### Transcript\n\nhello\nworld\n\n<!-- marker -->\nNext");
});

test("ignores headings inside fenced code", () => {
  const lines = ["# Real", "```", "###### Fake", "```", "![[voice.m4a]]"];
  assert.equal(headingLevelAbove(lines, 4), 1);
});

test("fallback paths are stable, local, and collision resistant", () => {
  const one = fallbackPath("one/Récording 1.m4a", "aaaaaaaa");
  const two = fallbackPath("two/Récording 1.m4a", "bbbbbbbb");
  assert.match(one, /^one\/recording-1-[a-f0-9]{8}-aaaaaaaa\.whisper\.ai\.md$/);
  assert.notEqual(one.split("/").pop(), two.split("/").pop());
});

test("fallback frontmatter quotes untrusted values", () => {
  const content = fallbackContent("voice: one.m4a", "text", "<!-- marker -->", "model: test", new Date("2026-01-01T00:00:00Z"));
  assert.match(content, /source: "voice: one\.m4a"/);
  assert.match(content, /model: "model: test"/);
});
