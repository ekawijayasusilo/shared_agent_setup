import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import cavemanExtension from "../index.js";

function harness(t, { defaultMode = "caveman", hasUI = true, skills = ["caveman", "ultracave", "megacave"] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "pi-caveman-extension-"));
  const previous = process.env.CAVEMAN_DEFAULT_MODE;
  process.env.CAVEMAN_DEFAULT_MODE = defaultMode;
  t.after(() => {
    if (previous === undefined) delete process.env.CAVEMAN_DEFAULT_MODE;
    else process.env.CAVEMAN_DEFAULT_MODE = previous;
    rmSync(root, { recursive: true, force: true });
  });
  const commands = new Map();
  const events = new Map();
  const appended = [];
  const statuses = [];
  const notifications = [];
  const skillCommands = skills.map((id) => {
    const path = join(root, `${id}.md`);
    writeFileSync(path, `---\r\nname: ${id}\r\ndescription: fixture\r\n---\r\n\r\n# ${id}\n${id} instructions\n`);
    return { name: `skill:${id}`, source: "skill", sourceInfo: { path, scope: "project" } };
  });
  let branch = [];
  const ctx = {
    cwd: root,
    hasUI,
    sessionManager: {
      getBranch: () => branch,
      getEntries: () => { throw new Error("must read the branch, not all entries"); },
    },
    ui: {
      setStatus: (key, text) => { assert.ok(hasUI); statuses.push({ key, text }); },
      notify: (text, level) => { assert.ok(hasUI); notifications.push({ text, level }); },
      get theme() { throw new Error("footer must not use a theme"); },
    },
  };
  const pi = {
    on: (name, handler) => events.set(name, handler),
    registerCommand: (name, command) => commands.set(name, command),
    getCommands: () => skillCommands,
    appendEntry: (customType, data) => {
      appended.push({ customType, data });
      branch.push({ type: "custom", customType, data });
    },
    sendMessage: () => assert.fail("must not send messages"),
    sendUserMessage: () => assert.fail("must not start a model turn"),
  };
  cavemanExtension(pi);
  return {
    pi, ctx, events, commands, appended, statuses, notifications, skillCommands, root,
    setBranch: (entries) => { branch = entries; },
    emit: async (name, event = {}) => events.get(name)?.(event, ctx),
    prompt: async (sections = {}) => {
      const event = { systemPrompt: "BASE", systemPromptOptions: { sections } };
      assert.equal(await events.get("before_agent_start")(event, ctx), undefined);
      assert.equal(event.systemPrompt, "BASE");
      return sections;
    },
    command: async (args = "") => commands.get("caveman").handler(args, ctx),
  };
}

const entry = (mode) => ({ type: "custom", customType: "caveman-mode", data: { mode } });

test("registers /caveman with complete command-word completions", (t) => {
  const h = harness(t);
  assert.deepEqual([...h.commands.keys()], ["caveman"]);
  const complete = h.commands.get("caveman").getArgumentCompletions;
  assert.deepEqual(complete("").map((item) => item.value), ["on", "ultra", "wenyan", "off", "status"]);
  assert.deepEqual(complete("u").map((item) => item.value), ["ultra"]);
  assert.equal(complete("invalid"), null);
});

test("commands select every canonical mode and alias without model turns", async (t) => {
  const h = harness(t);
  await h.emit("session_start");
  for (const [word, mode, label] of [["off", "off", "off"], ["on", "caveman", "on"],
    ["ultra", "ultracave", "ultra"], ["wenyan", "megacave", "wenyan"],
    ["caveman", "caveman", "on"], ["ultracave", "ultracave", "ultra"], ["megacave", "megacave", "wenyan"]]) {
    await h.command(word);
    assert.deepEqual(h.appended.at(-1), { customType: "caveman-mode", data: { mode } });
    assert.equal(h.statuses.at(-1).text, `caveman: ${label}`);
    const sections = await h.prompt({ caveman: "stale" });
    if (mode === "off") assert.equal(sections.caveman, undefined);
    else assert.match(sections.caveman, new RegExp(`${mode} instructions`));
  }
  assert.equal(h.appended.length, 7);
});

test("status, bare command while active, and unknown arguments do not change state", async (t) => {
  const h = harness(t, { defaultMode: "ultra" });
  await h.emit("session_start");
  for (const word of ["status", "", "nonsense", "on extra", "default off", "constructor"]) await h.command(word);
  assert.deepEqual(h.appended, []);
  assert.match(h.notifications[0].text, /ultracave/);
  assert.match(h.notifications[0].text, /default: ultracave/);
  assert.match(h.notifications[1].text, /ultracave/);
  assert.equal(h.notifications.at(-1).level, "warning");
  assert.match(h.notifications.at(-1).text, /on.*ultra.*wenyan.*off.*status/);
  assert.match((await h.prompt()).caveman, /mode: ultracave/);
});

test("bare command enables from off, reselect appends nothing, and saved off persists on reopening", async (t) => {
  const h = harness(t, { defaultMode: "off" });
  await h.emit("session_start");
  await h.command();
  await h.command("on");
  assert.equal(h.appended.length, 1);
  await h.command("off");
  process.env.CAVEMAN_DEFAULT_MODE = "wenyan";
  await h.emit("session_start", { reason: "resume" });
  await h.command("status");
  assert.match(h.notifications.at(-1).text, /off.*default: megacave/);
  assert.equal((await h.prompt()).caveman, undefined);
  assert.equal(h.appended.length, 2);
});

test("missing or unreadable skills warn and preserve the selected mode; off always works", async (t) => {
  const h = harness(t, { skills: ["caveman"] });
  await h.emit("session_start");
  for (const word of ["ultra", "wenyan"]) {
    await h.command(word);
    assert.equal(h.notifications.at(-1).level, "warning");
    assert.deepEqual(h.appended, []);
    assert.match((await h.prompt()).caveman, /mode: caveman/);
  }
  rmSync(h.skillCommands[0].sourceInfo.path);
  await h.command("off");
  await h.command("on");
  await h.command();
  assert.deepEqual(h.appended, [{ customType: "caveman-mode", data: { mode: "off" } }]);
  assert.equal((await h.prompt()).caveman, undefined);
  assert.equal(h.notifications.at(-1).level, "warning");
});

test("stop phrases turn off and persist once, letting original input continue", async (t) => {
  const h = harness(t);
  for (const text of ["stop caveman", "Stop caveman!", " normal mode. ", "NORMAL MODE?!  "]) {
    h.setBranch([]);
    await h.emit("session_start");
    const count = h.appended.length;
    const event = { text, source: "interactive", images: [{ type: "image" }] };
    const original = structuredClone(event);
    assert.equal(await h.emit("input", event), undefined);
    assert.deepEqual(event, original);
    assert.equal(h.appended.length, count + 1);
    assert.deepEqual(h.appended.at(-1).data, { mode: "off" });
    assert.equal(h.statuses.at(-1).text, "caveman: off");
    assert.equal((await h.prompt()).caveman, undefined);
    await h.emit("input", event);
    assert.equal(h.appended.length, count + 1);
  }
});

test("mentions, quoted stop phrases, slash commands and extension input stay unchanged", async (t) => {
  const h = harness(t);
  await h.emit("session_start");
  for (const text of ['"stop caveman"', "add a normal mode toggle", "Why did you use caveman ultra?",
    "/skill:caveman", "stop caveman now", "normal modes", ""]) {
    const event = { text, source: "interactive" };
    assert.equal(await h.emit("input", event), undefined);
    assert.equal(event.text, text);
  }
  await h.emit("input", { text: "stop caveman", source: "extension" });
  assert.deepEqual(h.appended, []);
  assert.match((await h.prompt()).caveman, /mode: caveman/);
  await h.emit("input", { text: "normal mode", source: "rpc" });
  assert.deepEqual(h.appended.at(-1).data, { mode: "off" });
});

test("headless commands and stop phrases work without UI calls", async (t) => {
  const h = harness(t, { hasUI: false });
  await h.emit("session_start");
  await h.command("ultra");
  await h.command("status");
  await h.command("invalid");
  await h.emit("input", { text: "normal mode", source: "rpc" });
  assert.equal((await h.prompt()).caveman, undefined);
  assert.equal(h.appended.length, 2);
  assert.deepEqual(h.notifications, []);
  assert.deepEqual(h.statuses, []);
});

test("new session injects a structured section with banner and no frontmatter", async (t) => {
  const h = harness(t);
  await h.emit("session_start");
  assert.deepEqual(h.statuses.at(-1), { key: "caveman", text: "caveman: on" });
  const sections = await h.prompt({ other: "preserved" });
  assert.equal(sections.caveman, "CAVEMAN MODE ACTIVE — mode: caveman\n\n# caveman\ncaveman instructions");
  assert.equal(sections.other, "preserved");
  assert.deepEqual(h.appended, []);
  assert.deepEqual(h.notifications, []);
  assert.equal(h.events.has("message_end"), false);
  assert.equal(h.events.has("agent_start"), false);
  assert.equal(h.events.has("agent_end"), false);
});

test("restores newest valid canonical mode from the branch, including off on resume", async (t) => {
  const h = harness(t);
  for (const mode of ["caveman", "ultracave", "megacave", "off"]) {
    h.setBranch([entry("ultracave"), entry(mode), null, entry("bogus"), entry("ultra"),
      { ...entry("megacave"), customType: "other" }, { ...entry("megacave"), type: "message" },
      { type: "custom", customType: "caveman-mode" }]);
    await h.emit("session_start", { reason: "resume" });
    const sections = await h.prompt({ caveman: "stale" });
    if (mode === "off") assert.equal(sections.caveman, undefined);
    else assert.match(sections.caveman, new RegExp(`mode: ${mode}\\n`));
  }
  assert.deepEqual(h.appended, []);
});

test("tree navigation restores branch state without entries or notifications, and re-resolves default", async (t) => {
  const h = harness(t);
  for (const [branch, expected] of [[[entry("off")], "off"], [[entry("megacave")], "wenyan"], [[], "ultra"]]) {
    process.env.CAVEMAN_DEFAULT_MODE = "ultra";
    h.setBranch(branch);
    await h.emit("session_tree");
    assert.equal(h.statuses.at(-1).text, `caveman: ${expected}`);
  }
  assert.deepEqual(h.appended, []);
  assert.deepEqual(h.notifications, []);
});

test("uses config resolver with ctx.cwd, not the process working directory", async (t) => {
  const h = harness(t, { defaultMode: "invalid" });
  writeFileSync(join(h.root, ".caveman.json"), '{"defaultMode":"wenyan"}');
  await h.emit("session_start");
  assert.match((await h.prompt()).caveman, /mode: megacave/);
});

test("plain footer covers all modes and availability overrides", async (t) => {
  const h = harness(t);
  for (const [mode, label] of [["caveman", "on"], ["ultracave", "ultra"], ["megacave", "wenyan"], ["off", "off"]]) {
    h.setBranch([entry(mode)]);
    await h.emit("session_start");
    assert.deepEqual(h.statuses.at(-1), { key: "caveman", text: `caveman: ${label}` });
  }
  h.skillCommands.splice(0);
  await h.emit("session_start");
  assert.equal(h.statuses.at(-1).text, "caveman: not installed", "missing base overrides off too");
});

test("missing base never injects, even when a variant is present", async (t) => {
  const h = harness(t, { skills: ["ultracave"], defaultMode: "ultra" });
  await h.emit("session_start");
  assert.equal((await h.prompt({ caveman: "stale" })).caveman, undefined);
  assert.equal(h.statuses.at(-1).text, "caveman: not installed");
});

test("missing variants never fall back to the base skill", async (t) => {
  const h = harness(t, { skills: ["caveman"] });
  for (const [mode, label] of [["ultracave", "ultra"], ["megacave", "wenyan"]]) {
    h.setBranch([entry(mode)]);
    await h.emit("session_start");
    assert.equal((await h.prompt({ caveman: "stale" })).caveman, undefined);
    assert.equal(h.statuses.at(-1).text, `caveman: ${label} (missing)`);
  }
});

test("reads Pi's resolved skill path afresh on each run and treats read failures as missing", async (t) => {
  const h = harness(t);
  const base = h.skillCommands[0];
  h.skillCommands.unshift({ name: "skill:caveman", source: "extension", sourceInfo: { path: "ignored" } });
  await h.emit("session_start");
  writeFileSync(base.sourceInfo.path, "# updated\nnew body");
  assert.match((await h.prompt()).caveman, /# updated\nnew body/);
  rmSync(base.sourceInfo.path);
  assert.equal((await h.prompt({ caveman: "stale" })).caveman, undefined);
  assert.equal(h.statuses.at(-1).text, "caveman: not installed");
  writeFileSync(base.sourceInfo.path, "\uFEFF---\nname: caveman\n---\nrestored");
  assert.match((await h.prompt()).caveman, /\n\nrestored$/);
  assert.equal(h.statuses.at(-1).text, "caveman: on");
  delete base.sourceInfo;
  assert.equal((await h.prompt()).caveman, undefined);
});

test("headless modes and missing UI methods still inject instructions", async (t) => {
  const h = harness(t, { hasUI: false });
  await h.emit("session_start");
  assert.match((await h.prompt()).caveman, /mode: caveman/);
  assert.deepEqual(h.statuses, []);
  assert.deepEqual(h.notifications, []);
  h.ctx.hasUI = true;
  h.ctx.ui = {};
  await h.emit("session_tree");
  assert.match((await h.prompt()).caveman, /mode: caveman/);
});
