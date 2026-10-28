# prompt-engineering

A plugin for Claude Code and Codex that ships one user-invoked skill. The skill refines a draft prompt into a clear, structured prompt that keeps its meaning, or diagnoses why a prompt underperforms.

## Skill

- **prompt-engineering**: user-invoked only, so the agent never fires it on its own.
  - Claude Code: `/prompt-engineering:prompt-engineering <draft prompt>`
  - Codex: `$prompt-engineering`
- Asks at most 3 questions, and only about the prompt's frame: goal, format, contradictions, scope, and done. Details are left for the follow-up conversation.
- Shapes the result as a discussion brief, a delivery brief, or a general prompt.
- When the refined prompt commissions long-horizon autonomous execution, it also recommends goal mode with a copy-ready `/goal` command.

## Installation

See the [repository README](../../README.md).

## Attribution

Original skill content adapted from NeoLabHQ/context-engineering-kit. The frame-check design draws on ideas from [nidhinjs/prompt-master](https://github.com/nidhinjs/prompt-master) (MIT).
