// Default resolution ported from Caveman 4.0.1 src/hooks/caveman-config.js (MIT).
import { lstatSync, readFileSync } from "node:fs";
import os from "node:os";
import { dirname, join, resolve } from "node:path";

export function normalizeDefaultMode(raw) {
  if (typeof raw !== "string") return null;
  switch (raw.toLowerCase()) {
    case "caveman": case "lite": case "full": case "commit": case "review": case "compress":
      return "caveman";
    case "ultracave": case "ultra":
      return "ultracave";
    case "megacave": case "wenyan": case "wenyan-lite": case "wenyan-full": case "wenyan-ultra":
      return "megacave";
    case "off": case "manual":
      return "off";
    default:
      return null;
  }
}

function readMode(path) {
  try {
    const buffer = readFileSync(path);
    const text = (buffer[0] === 0xff && buffer[1] === 0xfe
      ? buffer.toString("utf16le", 2) : buffer.toString("utf8")).replace(/^\uFEFF/, "");
    let config;
    try {
      config = JSON.parse(text);
    } catch {
      // Match strings first so URLs, escaped quotes and comma/braces stay intact.
      config = JSON.parse(text
        .replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (match, string) => string || "")
        .replace(/("(?:[^"\\]|\\.)*")|,(\s*[}\]])/g, (match, string, close) => string || close));
    }
    return config?.defaultMode ? normalizeDefaultMode(String(config.defaultMode)) : null;
  } catch {
    return null;
  }
}

export function resolveDefaultMode(cwd) {
  const envMode = normalizeDefaultMode(process.env.CAVEMAN_DEFAULT_MODE);
  if (envMode) return envMode;

  let dir = resolve(cwd || process.cwd());
  for (let depth = 0; depth < 64; depth += 1) {
    for (const relative of [".caveman/config.json", ".caveman.json"]) {
      const path = join(dir, relative);
      try {
        const stat = lstatSync(path);
        if (stat.isSymbolicLink() || !stat.isFile()) continue;
        const mode = readMode(path);
        if (mode) return mode;
      } catch {
        // Missing or unreadable repo files do not hide another source.
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const home = os.homedir();
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return readMode(join(xdg, "caveman", "config.json")) || "caveman";
  if (process.platform === "win32") {
    const appdata = process.env.APPDATA || join(home, "AppData", "Roaming");
    const mode = readMode(join(appdata, "caveman", "config.json"));
    if (mode) return mode;
  }
  return readMode(join(home, ".config", "caveman", "config.json")) || "caveman";
}
