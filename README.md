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
/plugin install prompt-engineering@shared-agent-setup
```

### Codex

```bash
codex plugin marketplace add ekawijayasusilo/shared_agent_setup
codex plugin add prompt-engineering@shared-agent-setup
```

### Any agent, via skills.sh

```bash
npx skills add ekawijayasusilo/shared_agent_setup --skill prompt-engineering
```
