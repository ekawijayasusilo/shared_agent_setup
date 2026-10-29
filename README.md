# shared_agent_setup
A repository for personal AI Agent setup, like custom skills, plugins and AGENTS.md

## Plugins

| Plugin | What it does |
|---|---|
| [prompt-engineering](plugins/prompt-engineering) | Refine a draft prompt into a clear, structured prompt, or diagnose why a prompt underperforms |

## Installation

### Claude Code

```text
/plugin marketplace add ekawijayasusilo/shared_agent_setup
/plugin install prompt-engineering@swe-skills
```

### Codex

```bash
codex plugin marketplace add ekawijayasusilo/shared_agent_setup
codex plugin add prompt-engineering@swe-skills
```

### Any agent, via skills.sh

```bash
npx skills add ekawijayasusilo/shared_agent_setup --skill prompt-engineering
```

## Pi extensions

### Caveman autoload

[`extensions/caveman-autoload.js`](extensions/caveman-autoload.js) loads your existing
`caveman` skill on the first ordinary prompt of a fresh session. It transforms
`Explain this repo` into `/skill:caveman Explain this repo`, so Pi expands the actual
skill in the same run. No copied rules, extra model turn, or runtime dependencies.

**Prerequisite:** install the Caveman skill separately and make it discoverable by
Pi (for example, at `~/.agents/skills/caveman/SKILL.md`). This extension neither bundles
nor updates it. `/skill:caveman` should work before installing the extension. If the
skill is missing, autoload is skipped and a Pi UI warning is emitted once.
Tested against Pi 1.4.0.

Install this repository as a Pi package:

```bash
pi install git:github.com/ekawijayasusilo/shared_agent_setup
```

Or load a local checkout (use its absolute path when outside this directory):

```bash
pi install .
```

To try it without changing settings:

```bash
pi -e ./extensions/caveman-autoload.js
```

Start a new session after installing; existing sessions are left unchanged.
Slash commands and extension-generated prompts pass through untouched. A manual
`/skill:caveman` activation prevents a second automatic load. Failed prompt
preflight does not consume activation, and attached images are preserved.
Resume, reload, fork, and tree navigation use the selected branch's user history
to avoid reactivating an existing conversation, including one where you stopped
Caveman. An empty branch is eligible for activation.

After loading, the skill owns its behavior and natural-language deactivation
(`stop caveman` or `normal mode`). This is a one-shot loader: it does not reinforce
instructions after compaction or track a separate on/off mode. Continued adherence
depends on the model and retained conversation context. Detection of a completed
activation uses Pi's native `<skill name="caveman" ...>` user-message wrapper.

Run the dependency-free tests with Node.js 18 or newer:

```bash
npm test
```

Remove the package with:

```bash
pi remove git:github.com/ekawijayasusilo/shared_agent_setup
```

For a local-path install, pass the same local path to `pi remove` instead.

## Repo-local skills

[`writing-for-agents`](https://github.com/mattpocock/skills/tree/main/skills/productivity/writing-for-agents) (MIT, Copyright (c) 2026 Matt Pocock) is vendored as copies in `.claude/skills/` (Claude Code) and `.agents/skills/` (Codex), tracked by `skills-lock.json`, for writing skills and `AGENTS.md` in this repo. Copies instead of symlinks so it works in every clone and worktree on Windows. To update it:

```bash
npx skills add mattpocock/skills --skill writing-for-agents --agent claude-code codex --copy -y
```
