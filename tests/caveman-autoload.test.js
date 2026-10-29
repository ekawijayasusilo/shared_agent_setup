import assert from "node:assert/strict";
import { test } from "node:test";
import cavemanAutoload from "../extensions/caveman-autoload.js";

function setup(branch = [], commands = [{ name: "skill:caveman", source: "skill" }]) {
  const handlers = new Map();
  const warnings = [];
  const ctx = {
    sessionManager: { getBranch: () => branch },
    ui: { notify: (...args) => warnings.push(args) },
  };
  cavemanAutoload({
    on: (name, handler) => handlers.set(name, handler),
    getCommands: () => commands,
  });
  const emit = (name, event = {}) => handlers.get(name)(event, ctx);
  const input = (text, extra = {}) => emit("input", { text, source: "interactive", ...extra });
  emit("session_start");
  return { emit, input, branch, warnings };
}

function userMessage(text) {
  return { role: "user", content: [{ type: "text", text }] };
}

const loadedSkill = '<skill name="caveman" location="/skills/caveman/SKILL.md">\nRules\n</skill>';

test("loads Caveman alongside the first prompt and preserves images", () => {
  const { input } = setup();
  const images = [{ type: "image", data: "image-data", mimeType: "image/png" }];
  assert.deepEqual(input("Explain this repo", { images }), {
    action: "transform",
    text: "/skill:caveman Explain this repo",
    images,
  });
});

test("stops transforming once the expanded skill reaches the conversation", () => {
  const { emit, input } = setup();
  input("Explain this repo");
  emit("message_end", { message: userMessage(`${loadedSkill}\n\nExplain this repo`) });
  assert.deepEqual(input("Next question"), { action: "continue" });
  assert.deepEqual(input("stop caveman"), { action: "continue" });
  assert.deepEqual(input("Another question"), { action: "continue" });
});

test("retries activation if the prompt never reached the conversation", () => {
  const { input } = setup();
  input("Rejected before starting");
  assert.equal(input("Try again").text, "/skill:caveman Try again");
});

test("leaves slash commands untouched and waits for an ordinary prompt", () => {
  const { emit, input } = setup();
  for (const command of ["/help", " /settings", "/skill:caveman-stats", "/skill:another-skill"]) {
    assert.deepEqual(input(command), { action: "continue" });
  }
  emit("message_end", { message: userMessage('<skill name="another-skill" location="/skills/another/SKILL.md">Rules</skill>') });
  assert.equal(input("Question").text, "/skill:caveman Question");
});

test("does not duplicate a manually loaded Caveman skill", () => {
  const { emit, input } = setup();
  assert.deepEqual(input("/skill:caveman"), { action: "continue" });
  emit("message_end", { message: userMessage(loadedSkill) });
  assert.deepEqual(input("Question"), { action: "continue" });
});

test("recognizes a committed user message with string content", () => {
  const { emit, input } = setup();
  emit("message_end", { message: { role: "user", content: loadedSkill } });
  assert.deepEqual(input("Question"), { action: "continue" });
});

test("skips extension-generated input without consuming activation", () => {
  const { emit, input } = setup();
  assert.deepEqual(input("Extension request", { source: "extension" }), { action: "continue" });
  emit("message_end", { message: userMessage("Extension request") });
  assert.equal(input("Question").text, "/skill:caveman Question");
});

test("loads for RPC input too", () => {
  assert.equal(setup().input("Question", { source: "rpc" }).text, "/skill:caveman Question");
});

test("ignores empty text but supports an image-only prompt", () => {
  const { input } = setup();
  assert.deepEqual(input("  \n"), { action: "continue" });
  assert.equal(input("", { images: [{ type: "image" }] }).text, "/skill:caveman ");
});

test("does not activate existing sessions, including after compaction", () => {
  const { input } = setup([
    { type: "message", message: userMessage("normal mode") },
    { type: "compaction", summary: "Earlier conversation" },
  ]);
  assert.deepEqual(input("Question"), { action: "continue" });
});

test("reload does not reactivate a session that already has user messages", () => {
  const { emit, input, branch } = setup();
  branch.push({ type: "message", message: userMessage("normal mode") });
  emit("session_start");
  assert.deepEqual(input("Question"), { action: "continue" });
});

test("a new session rearms activation", () => {
  const { emit, input, branch } = setup([{ type: "message", message: userMessage("Earlier prompt") }]);
  branch.length = 0;
  emit("session_start");
  assert.equal(input("Question").text, "/skill:caveman Question");
});

test("tree navigation restores activation eligibility from the selected branch", () => {
  const { emit, input, branch } = setup();
  branch.push({ type: "message", message: userMessage("Earlier prompt") });
  emit("session_tree");
  assert.deepEqual(input("Question"), { action: "continue" });
  branch.length = 0;
  emit("session_tree");
  assert.equal(input("Question").text, "/skill:caveman Question");
});

test("a missing skill warns once and leaves prompts unchanged", () => {
  const { input, warnings } = setup([], []);
  assert.deepEqual(input("Question"), { action: "continue" });
  assert.deepEqual(input("Next question"), { action: "continue" });
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][1], "warning");
  assert.match(warnings[0][0], /caveman.*not found/i);
});

test("a similarly named extension command is not mistaken for the skill", () => {
  const { input, warnings } = setup([], [{ name: "skill:caveman", source: "extension" }]);
  assert.deepEqual(input("Question"), { action: "continue" });
  assert.equal(warnings.length, 1);
});

test("assistant and custom messages do not count as activation", () => {
  const { emit, input } = setup([{ type: "custom", customType: "metadata" }]);
  emit("message_end", { message: { role: "assistant", content: [{ type: "text", text: loadedSkill }] } });
  emit("message_end", { message: { role: "custom", customType: "notification", content: loadedSkill } });
  assert.equal(input("Question").text, "/skill:caveman Question");
});
