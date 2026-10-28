# Goal-mode recommendation

Loaded when the goal-mode gate in [SKILL.md](SKILL.md) passes. Produce a recommendation plus a copy-ready `/goal` command; never activate goal mode yourself.

## How /goal works (shapes everything below)

- Setting a goal starts a turn immediately with the condition text as the directive — there is no separate task message. The goal must carry the task itself or name the artifact that defines it.
- After each turn, a small fast model (the evaluator) judges the condition against the conversation only. It runs no commands and reads no files: every condition must be provable by output Claude runs and prints (e.g. "`npm test` exits 0").
- The condition is limited to 4,000 characters.
- The goal stays active until the evaluator confirms the condition or the user runs `/goal clear`.

## Confirm the decision

The gate already screened for long-horizon shape. Confirm before writing — recommend only on strong evidence of BOTH:

- a multi-turn execution horizon — many interdependent steps or checkpoints, broad changes, a migration, substantial refactor, plan/design-doc execution, repeated experiment, deploy-retry loop, or bounded backlog — that the agent can progress on its own; and
- a binary stopping condition, existing or constructible, demonstrable in the transcript.

Any one of these defeats the recommendation, regardless of prompt length or difficulty:

- the refined prompt's first move is discussion or planning
- the response is one-shot (explanation, assessment, brainstorm)
- the task completes reliably in one normal turn
- the backlog is unbounded or unrelated
- meaningful progress needs unresolved product decisions or per-step user steering

Borderline means no. When the decision flips to no here, return the refined prompt with no goal-related text.

## Write the goal

1. Extract from the refined prompt: the scope anchor (plan file, spec, issue, file set), the done-state, and the verification checks available in the prompt or repo context. Complete when each is identified or marked absent.
2. Draft the `/goal`: task directive plus the smallest useful combination of the elements below. Embed a short refined prompt directly; past ~3,500 characters, anchor to the artifact instead ("Execute the plan in `<path>` …"). Complete when the draft has a directive and a definition of done in ≤4,000 characters.
3. Ground-check: every command, path, and tool in the goal traces to the refined prompt or known repo context. Replace ungrounded checks with "identify and run the project's test command" or drop them. Complete when nothing is invented.
4. Condition-check: every completion condition is binary and outcome-oriented ("tests pass", not "run the tests"), provable by output Claude will print. Complete when no condition requires the evaluator to inspect external state.
5. Emit the output shape below. Complete when the recommendation names the triggering characteristics and the `/goal` block is copy-ready.

**Elements** — smallest useful combination; omit what the task doesn't need:

1. Objective / scope anchor
2. Definition of done
3. Verification — binary, transcript-provable checks
4. Scope constraint — bound to the requested task
5. Deviation policy — deviate when necessary; report meaningful deviations and tradeoffs
6. Integrity guardrail — verification never skipped, deleted, or weakened to pass
7. Final report — summary of changes, verification results, unresolved failures, remaining risks
8. Optional turn/time bound — e.g. "or stop after 20 turns" — when runaway risk matters

**Rules:** complete — every condition legitimate completion requires; bounded — no unrelated repo-wide cleanup; concise — consolidate overlapping criteria, no evaluator noise.

## Output shape

Append after the refined prompt and rationale:

```text
---
**Recommend running this with goal mode.** This task is long-horizon: <1–2 lines naming the triggering characteristics>.

Copy-ready:

/goal Execute <scope anchor> to completion.
Definition of done:
- <required outcomes>
- Changes stay scoped to <scope>; necessary deviations and tradeoffs reported in the final summary.
- <verification commands> run and pass; verification is not skipped, deleted, or weakened.
- Finish with a concise summary of changes, verification results, unresolved failures, and remaining risks.
```

## Decision examples

- **Yes** — "Execute the migration plan in `plans/db-v2.md`: move all ~40 call sites from the v1 client to v2; `npm test` and `tsc --noEmit` must pass." Multi-turn, broad, plan-anchored, binary loop.
- **No** — "Fix the off-by-one in `parseRange` and add a regression test." Verifiable, but completes reliably in one turn.
- **Borderline, so no** — "Add input validation to the signup endpoint with tests for the invalid cases." Binary loop exists, but the horizon is one careful turn; verifiability alone doesn't meet the threshold.
