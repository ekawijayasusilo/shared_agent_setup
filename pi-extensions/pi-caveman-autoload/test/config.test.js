import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { normalizeDefaultMode, resolveDefaultMode } from "../config.js";

function fixture(t) {
  const root = mkdtempSync(join(os.tmpdir(), "pi-caveman-config-"));
  const keys = ["HOME", "USERPROFILE", "APPDATA", "XDG_CONFIG_HOME", "CAVEMAN_DEFAULT_MODE"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  process.env.HOME = process.env.USERPROFILE = join(root, "home");
  process.env.APPDATA = join(root, "appdata");
  process.env.XDG_CONFIG_HOME = join(root, "xdg");
  t.mock.method(os, "homedir", () => join(root, "home"));
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    rmSync(root, { recursive: true, force: true });
  });
  const cwd = join(root, "repo", "nested");
  mkdirSync(cwd, { recursive: true });
  const write = (path, content) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, typeof content === "object" && !Buffer.isBuffer(content) ? JSON.stringify(content) : content);
  };
  return { root, cwd, write, user: join(root, "xdg", "caveman", "config.json") };
}

test("normalizes all configured modes and rejects unknown values", () => {
  const groups = {
    caveman: ["caveman", "lite", "full", "commit", "review", "compress"],
    ultracave: ["ultracave", "ultra"],
    megacave: ["megacave", "wenyan", "wenyan-lite", "wenyan-full", "wenyan-ultra"],
    off: ["off", "manual"],
  };
  for (const [mode, aliases] of Object.entries(groups)) {
    for (const alias of aliases) {
      assert.equal(normalizeDefaultMode(alias), mode);
      assert.equal(normalizeDefaultMode(alias.toUpperCase()), mode);
    }
  }
  for (const value of [undefined, null, {}, 1, "on", "bogus", " caveman ", "constructor", "__proto__"]) {
    assert.equal(normalizeDefaultMode(value), null);
  }
});

test("environment > repo > user > fallback", (t) => {
  const { cwd, user, write } = fixture(t);
  assert.equal(resolveDefaultMode(cwd), "caveman");
  write(user, { defaultMode: "off" });
  assert.equal(resolveDefaultMode(cwd), "off");
  write(join(cwd, ".caveman.json"), { defaultMode: "wenyan" });
  assert.equal(resolveDefaultMode(cwd), "megacave");
  process.env.CAVEMAN_DEFAULT_MODE = "ultra";
  assert.equal(resolveDefaultMode(cwd), "ultracave");
  process.env.CAVEMAN_DEFAULT_MODE = "invalid";
  assert.equal(resolveDefaultMode(cwd), "megacave");
});

test("searches upward and prefers .caveman/config.json in each folder", (t) => {
  const { cwd, write } = fixture(t);
  write(join(dirname(cwd), ".caveman.json"), { defaultMode: "off" });
  assert.equal(resolveDefaultMode(cwd), "off");
  write(join(cwd, ".caveman.json"), { defaultMode: "ultra" });
  write(join(cwd, ".caveman", "config.json"), { defaultMode: "wenyan" });
  assert.equal(resolveDefaultMode(cwd), "megacave");
});

test("skips repo configs without a valid default, and malformed or unreadable files", (t) => {
  const { cwd, user, write } = fixture(t);
  write(user, { defaultMode: "ultra" });
  const first = join(cwd, ".caveman", "config.json");
  const second = join(cwd, ".caveman.json");
  write(second, { defaultMode: "off" });
  for (const content of [{ settings: true }, { defaultMode: "invalid" }, "{bad", "null"]) {
    write(first, content);
    assert.equal(resolveDefaultMode(cwd), "off");
  }
  write(second, { defaultMode: "invalid" });
  assert.equal(resolveDefaultMode(cwd), "ultracave");
  rmSync(first);
  mkdirSync(first);
  assert.equal(resolveDefaultMode(cwd), "ultracave");
  write(user, "invalid");
  assert.equal(resolveDefaultMode(cwd), "caveman");
});

test("accepts BOMs, UTF-16LE, JSON comments and trailing commas without damaging strings", (t) => {
  const { cwd, user, write } = fixture(t);
  const jsonc = '{ // mode\n "url": "https://example.com/a,}", /* comment */ "escaped": "\\\"//", "list": [1,], "defaultMode": "ultra", }';
  for (const content of [jsonc, `\uFEFF${jsonc}`, Buffer.from(`\uFEFF${jsonc}`, "utf16le")]) {
    write(user, content);
    assert.equal(resolveDefaultMode(cwd), "ultracave");
  }
});

test("XDG config is the only user source when set", (t) => {
  const { root, cwd, user, write } = fixture(t);
  write(join(root, "appdata", "caveman", "config.json"), { defaultMode: "off" });
  write(join(root, "home", ".config", "caveman", "config.json"), { defaultMode: "off" });
  assert.equal(resolveDefaultMode(cwd), "caveman");
  write(user, { defaultMode: "wenyan" });
  assert.equal(resolveDefaultMode(cwd), "megacave");
});

for (const platform of ["win32", "linux"]) {
  test(`${platform} user fallback paths`, (t) => {
    const { root, cwd, write } = fixture(t);
    const original = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", { value: platform });
    t.after(() => Object.defineProperty(process, "platform", original));
    delete process.env.XDG_CONFIG_HOME;
    const homeConfig = join(root, "home", ".config", "caveman", "config.json");
    const appConfig = join(root, "appdata", "caveman", "config.json");
    write(homeConfig, { defaultMode: "ultra" });
    write(appConfig, { defaultMode: "off" });
    assert.equal(resolveDefaultMode(cwd), platform === "win32" ? "off" : "ultracave");
    write(appConfig, "invalid");
    assert.equal(resolveDefaultMode(cwd), "ultracave");
    delete process.env.APPDATA;
    write(join(root, "home", "AppData", "Roaming", "caveman", "config.json"), { defaultMode: "wenyan" });
    assert.equal(resolveDefaultMode(cwd), platform === "win32" ? "megacave" : "ultracave");
  });
}

test("skips symlinked repo config files", (t) => {
  const { root, cwd, user, write } = fixture(t);
  const target = join(root, "target.json");
  write(target, { defaultMode: "off" });
  write(user, { defaultMode: "ultra" });
  try {
    symlinkSync(target, join(cwd, ".caveman.json"));
  } catch (error) {
    if (error.code !== "EPERM") throw error;
    t.skip("File symlink creation requires Windows Developer Mode or elevation");
    return;
  }
  assert.equal(resolveDefaultMode(cwd), "ultracave");
});

test("bounds the upward search to 64 directories", (t) => {
  const { cwd, user, write } = fixture(t);
  write(join(cwd, ".caveman.json"), { defaultMode: "off" });
  write(user, { defaultMode: "ultra" });
  const at = (count) => join(cwd, ...Array(count).fill("d"));
  assert.equal(resolveDefaultMode(at(63)), "off");
  assert.equal(resolveDefaultMode(at(64)), "ultracave");
});
