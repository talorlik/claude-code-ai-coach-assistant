---
description: Clear all open tech-debt items in one pass - worktree, fixes, gates, self-correction, squash-merge. Usage:/run-batch-tech-debt
argument-hint: (none)
---

You are executing the **tech-debt batch** of the Studio Itai AI Coach Assistant,
fully autonomously, in a fresh session. This clears every open item in the
tech-debt backlog in a single pass and behaves exactly like a numbered build
batch (`/run-batch NN`) in process and flow.

This command is the canonical hands-off entry point for tech-debt cleanup. It is
self-contained: do not assume any prior conversation context. Follow these steps
in order. Do not skip steps. Do not ask the user for confirmation unless a step
explicitly says to stop - this runs unattended.

When the user says "run batch tech-debt", "do the tech-debt batch", "clear tech
debt", or anything equivalent (including plain English with no slash), invoke
this command.

## Step 0 - Load context

1. Read the runbook for git workflow, gates, and conventions:
   `/Users/talo/.claude/plans/review-the-project-s-sleepy-castle.md`.
2. Read the backlog: `docs/planning/TECH_DEBT.md`. The unchecked items under
   **Open Items** are your work-list. This file is the canonical handoff - treat
   each Open Item's scope and acceptance check verbatim.
3. If there are NO unchecked Open Items, STOP and report "Tech-debt backlog is
   empty - nothing to do."

## Step 1 - Preconditions

1. Confirm you are in the primary checkout at
   `/Users/talo/www/claude-code-ai-coach-assistant` on branch `main` with a
   clean working tree (`git status --porcelain` empty). If not clean, STOP and
   report - do not stash or discard uncommitted work.
2. `git fetch` is not required; never push `main`.

## Step 2 - Create the worktree

Use the `chore/` prefix (tech-debt is non-behavioral maintenance):

```bash
git worktree add ../itai-tech-debt -b chore/tech-debt
```

Do all subsequent work inside that worktree. Invoke the
`superpowers:using-git-worktrees` skill to set this up correctly.

> Path-resolution gotcha (observed): native Write/Edit with absolute worktree
> paths can still resolve against the PRIMARY checkout. After any edit, verify
> `git status` in BOTH the worktree and the primary checkout; keep all changes
> in the worktree and `main` clean until the squash-merge.

## Step 3 - Execute the open items

1. Before editing, list the files each Open Item will touch.
2. Fix each unchecked Open Item exactly to its stated scope and acceptance
   check. Keep changes minimal and low-risk - tech-debt items are cleanups, not
   redesigns. If an item turns out to require behavior change or design
   judgment, do NOT force it: leave it unchecked, note why in the report, and
   move on (it belongs in a normal feature/fix batch).
3. Carry the build's non-negotiable constraints: TypeScript; App Router; root
   `proxy.ts` (NEVER create root `middleware.ts`); next-intl `/en`->en-US,
   `/he`->he-IL, Hebrew RTL; Supabase RLS on every app table; AI server-side
   only; TSDoc on exports; tests for every changed behavior (mock AI in tests);
   Markdown files UPPERCASE_WITH_UNDERSCORES.md.
4. As each item passes its acceptance check, tick its checkbox in
   `docs/planning/TECH_DEBT.md` (`- [ ]` -> `- [x]`) and move the completed
   entry from **Open Items** to **Done** with the completion date.

## Step 4 - Gates with self-correction

Run the gates. Because tech-debt items can touch tests and any layer, run the
FULL set:

```bash
npm run lint
npm run typecheck
npm run build
npm run test
```

Run `npm run test:e2e` only if an item changed e2e-observable behavior; tech-debt
items normally do not.

**Self-correction loop:** if any gate fails, invoke
`superpowers:systematic-debugging`, fix the cause, and re-run that gate. You have
full autonomy to make gates green. Log every deviation from an item's literal
scope in the final report.

**Retry cap: 3 attempts per gate.** If a gate still fails after 3 fix attempts,
go to Step 5b. Do not loop indefinitely. Do not force a merge of red work onto
main.

## Step 5a - Success path: commit, squash-merge, clean up

1. Commit in the worktree with message
   `chore(tech-debt): clear backlog (<N> items)` where `<N>` is the count of
   items cleared. List the items in the commit body.
2. Optionally push the `chore/tech-debt` branch to the remote (allowed by
   policy).
3. Squash-merge into local `main` in the primary checkout:
   `git merge --squash chore/tech-debt`, then commit with the same message.
   NEVER push `main`.
4. Remove the worktree and delete the branch. Invoke
   `superpowers:finishing-a-development-branch` to do this cleanly.
5. Go to Step 6.

## Step 5b - Partial / failure path: preserve and stop

If some items cannot pass within the retry cap, or you hit a genuine blocker:

1. If SOME items passed cleanly and others did not, you may still squash-merge
   the passing subset (each item is independent) - but only if `main` stays
   green. Tick only the items that actually landed; leave the rest unchecked in
   Open Items with a note.
2. If nothing can land cleanly, commit WIP on the branch with
   `WIP(tech-debt): <one-line reason>`, leave the worktree INTACT, do NOT
   squash-merge, and keep `main` clean.
3. Go to Step 6, then Step 7 with status STOPPED or PARTIAL.

## Step 6 - Capture decisions and insights

If anything non-obvious occurred (a cleanup revealed a deeper issue, an item was
deferred and why, a gotcha discovered), append a dated entry to
`docs/DECISIONS.md` per its header format. On the success path, include this
append in the squash-merge commit so it lands on `main` atomically. If a cleanup
changes how a future batch should behave, also update auto-memory (prefer
updating an existing fact file over creating duplicates). If genuinely nothing
non-obvious happened, state "no new decisions to capture" and skip.

The updated `docs/planning/TECH_DEBT.md` (ticked items moved to Done) must be
part of the same squash-merge commit so the backlog state travels with `main`.

## Step 7 - Report

1. Status: COMPLETED (all items cleared, merged to main), PARTIAL (subset
   cleared), or STOPPED (nothing landed, worktree preserved).
2. Items cleared (and any deferred, with reason).
3. Files changed.
4. Deviations from any item's literal scope, or "none".
5. Tests added or updated.
6. Commands run and observed results (gate output, evidence not assertion) -
   especially the final `npm run lint` showing `0 problems` if a lint item was
   in scope.
7. Remaining backlog: list any Open Items still unchecked.
8. What was captured to `docs/DECISIONS.md` and auto-memory (or "no new
   decisions to capture").

Keep the report concise. The user can now safely `/clear`.
