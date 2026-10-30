import { readFileSync } from "node:fs";
import { resolveDefaultMode } from "./config.js";

const MODE_LABELS = new Map([
  ["off", "off"], ["caveman", "on"], ["ultracave", "ultra"], ["megacave", "wenyan"],
]);

/** @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi */
export default function cavemanAutoload(pi) {
  let mode = "caveman";

  function readSkill(id) {
    const command = pi.getCommands().find((item) => item.source === "skill" && item.name === `skill:${id}`);
    if (!command?.sourceInfo?.path) return null;
    try {
      return readFileSync(command.sourceInfo.path, "utf8")
        .replace(/^\uFEFF/, "")
        .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "")
        .trim() || null;
    } catch {
      return null;
    }
  }

  function availability(selected = mode) {
    const base = readSkill("caveman");
    if (base === null) return { body: null, status: "caveman: not installed" };
    const body = selected === "off" ? null : selected === "caveman" ? base : readSkill(selected);
    const missing = selected !== "off" && body === null ? " (missing)" : "";
    return { body, status: `caveman: ${MODE_LABELS.get(selected)}${missing}` };
  }

  function updateStatus(ctx, status = availability().status) {
    if (ctx.hasUI) ctx.ui.setStatus?.("caveman", status);
  }

  function restore(_event, ctx) {
    mode = resolveDefaultMode(ctx.cwd);
    const branch = ctx.sessionManager.getBranch();
    for (let i = branch.length - 1; i >= 0; i -= 1) {
      const entry = branch[i];
      if (entry?.type === "custom" && entry.customType === "caveman-mode" && MODE_LABELS.has(entry.data?.mode)) {
        mode = entry.data.mode;
        break;
      }
    }
    updateStatus(ctx);
  }

  function notify(ctx, text, level = "info") {
    if (ctx.hasUI) ctx.ui.notify?.(text, level);
  }

  function setMode(next, ctx) {
    if (next !== mode) {
      pi.appendEntry("caveman-mode", { mode: next });
      mode = next;
    }
    updateStatus(ctx);
  }

  const words = ["on", "ultra", "wenyan", "off", "status"];
  const commandModes = new Map([
    ["on", "caveman"], ["caveman", "caveman"], ["ultra", "ultracave"],
    ["ultracave", "ultracave"], ["wenyan", "megacave"], ["megacave", "megacave"], ["off", "off"],
  ]);
  pi.registerCommand("caveman", {
    description: "Caveman mode: on, ultra, wenyan, off, status",
    getArgumentCompletions: (prefix) => {
      const items = words.filter((word) => word.startsWith(prefix)).map((word) => ({ value: word, label: word }));
      return items.length ? items : null;
    },
    handler: async (args, ctx) => {
      const word = args.trim().toLowerCase() || (mode === "off" ? "on" : "status");
      if (word === "status") {
        updateStatus(ctx);
        notify(ctx, `Caveman mode: ${mode} (default: ${resolveDefaultMode(ctx.cwd)})`);
        return;
      }
      const next = commandModes.get(word);
      if (!next) {
        notify(ctx, `Usage: /caveman ${words.join("|")}`, "warning");
        return;
      }
      if (next !== "off" && availability(next).body === null) {
        updateStatus(ctx);
        notify(ctx, `Caveman: ${next} skill unavailable; mode unchanged.`, "warning");
        return;
      }
      setMode(next, ctx);
      notify(ctx, `Caveman mode: ${mode}`);
    },
  });

  pi.on("input", (event, ctx) => {
    if (event.source !== "extension" && /^\s*(?:stop caveman|normal mode)[.!?\s]*$/i.test(event.text)) {
      setMode("off", ctx);
    }
  });

  pi.on("session_start", restore);
  pi.on("session_tree", restore);
  pi.on("before_agent_start", (event, ctx) => {
    const { body, status } = availability();
    if (body !== null) {
      event.systemPromptOptions.sections.caveman = `CAVEMAN MODE ACTIVE — mode: ${mode}\n\n${body}`;
    } else {
      delete event.systemPromptOptions.sections.caveman;
    }
    updateStatus(ctx, status);
  });
}
