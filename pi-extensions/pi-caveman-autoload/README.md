# pi-caveman-autoload

Keeps Caveman active in Pi by putting your installed Caveman skill into a
system-prompt section. Shows the selected mode in the bottom bar, survives
compaction, and restores the mode when you reopen a session.

Tested with Pi 1.4.0.

## Prerequisites

Install the `caveman` skill separately and make it discoverable by Pi. Install
`ultracave` for ultra mode and `megacave` for wenyan mode.

This extension only automates activation. It does not bundle or update Caveman;
you are responsible for installing and updating the skills. Without the base
`caveman` skill, the footer shows `caveman: not installed` and no mode is injected.

## Install and remove

```bash
pi install npm:pi-caveman-autoload
```

To remove:

```bash
pi remove npm:pi-caveman-autoload
```

If you used the old git install, remove it before installing this package:

```bash
pi remove git:github.com/ekawijayasusilo/shared_agent_setup
```

Never load both installations at once.

## Commands and footer

```text
/caveman [on|ultra|wenyan|off|status]
```

| Command | Effect |
|---|---|
| `/caveman on` | Activate `caveman`. Alias: `/caveman caveman`. |
| `/caveman ultra` | Activate `ultracave`. Alias: `/caveman ultracave`. |
| `/caveman wenyan` | Activate `megacave`. Alias: `/caveman megacave`. |
| `/caveman off` | Disable injection. |
| `/caveman status` | Report the selected mode and configured default without changing either. |
| `/caveman` | Enable base Caveman when off; otherwise report status. |

Commands start no model turn. Mode changes apply to the next prompt. Selecting
an unavailable skill warns and leaves the previous mode unchanged.

The standalone phrases `stop caveman` and `normal mode` turn injection off.
Matching is case-insensitive and allows surrounding whitespace and trailing
`.`, `!` or `?`. Quoted phrases and mentions inside longer requests do not change
the mode. The original input still goes to the model unchanged.

| Footer | Meaning |
|---|---|
| `caveman: on` | Base Caveman selected. |
| `caveman: ultra` | Ultracave selected. |
| `caveman: wenyan` | Megacave selected. |
| `caveman: off` | Injection disabled. |
| `caveman: not installed` | Base Caveman missing or unreadable, regardless of selected mode. |
| `caveman: ultra (missing)` / `caveman: wenyan (missing)` | Selected variant missing or unreadable; no fallback to the base skill. |

## Default mode

Without a saved branch selection, the first valid default wins:

1. `CAVEMAN_DEFAULT_MODE`.
2. Repository config, walking upward from the session directory: `.caveman/config.json`
   before `.caveman.json` in each directory.
3. User `caveman/config.json`: under `$XDG_CONFIG_HOME` when set (the only user
   source); otherwise `%APPDATA%` on Windows, then `~/.config`. Without
   `%APPDATA%`, Windows uses `~/AppData/Roaming` before `~/.config`.
4. `caveman`.

Config files use the `defaultMode` key, for example:

```json
{ "defaultMode": "ultracave" }
```

The same Caveman config drives Claude Code and Codex. This extension maps values
case-insensitively as follows:

| Config value | Selected mode |
|---|---|
| `caveman`, `lite`, `full` | `caveman` |
| `ultracave`, `ultra` | `ultracave` |
| `megacave`, `wenyan`, `wenyan-lite`, `wenyan-full`, `wenyan-ultra` | `megacave` |
| `off`, `manual` | `off` |
| `commit`, `review`, `compress` | `caveman` (one-shot skills are not persistent modes here) |

## Session behavior

Mode changes are saved per session branch. Reopen, reload, fork and tree
navigation restore the selected branch's mode. An explicit off stays off even if
the configured default later changes. A branch without a saved selection uses
the current default.

## Limitations

- The footer shows what the extension sends to the model, not whether the model
  follows it.
- Typing `/skill:caveman` by hand or switching modes in plain language is not
  tracked. Use `/caveman`.
- An extension that replaces the whole system prompt with `systemPrompt` or
  `forceSystemPrompt` can hide the section for that run.
- `normal mode` also turns off other extensions that honor it, such as Ponytail.
- Never install alongside another extension that registers `/caveman` or uses
  the `caveman` system-prompt section.

## Development

From the repository root:

```bash
cd pi-extensions/pi-caveman-autoload && npm test
```

From the package directory, try it without changing installed packages:

```bash
pi -e ./index.js
```
