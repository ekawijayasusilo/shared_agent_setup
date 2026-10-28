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

## Repo-local skills

[`writing-for-agents`](https://github.com/mattpocock/skills/tree/main/skills/productivity/writing-for-agents) (MIT, Copyright (c) 2026 Matt Pocock) is vendored as copies in `.claude/skills/` (Claude Code) and `.agents/skills/` (Codex), tracked by `skills-lock.json`, for writing skills and `AGENTS.md` in this repo. Copies instead of symlinks so it works in every clone and worktree on Windows. To update it:

```bash
npx skills add mattpocock/skills --skill writing-for-agents --agent claude-code codex --copy -y
```
