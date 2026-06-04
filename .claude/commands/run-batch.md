---
description: Execute one AI Coach build batch (00-19) end to end - worktree, prompt, gates, self-correction, squash-merge. Usage:/run-batch <NN>
argument-hint: <batch number 00-19>
---

You are executing ONE batch of the Studio Itai AI Coach Assistant build, fully
autonomously, in a fresh session. The batch number is: **$ARGUMENTS**

This command is the canonical hands-off entry point. It is self-contained: do
not assume any prior conversation context. Follow these steps in order. Do not
skip steps. Do not ask the user for confirmation unless a step explicitly says
to stop - this runs unattended (often from a phone).

## Step 0 - Load context

1. Normalize the batch number to two digits (e.g. `7` -> `07`). Call it `NN`.
   If `$ARGUMENTS` is empty or not in 00-19, STOP and report the valid range.
2. Read the runbook: `/Users/talo/.claude/plans/review-the-project-s-sleepy-castle.md`.
   It is the authority on git workflow, gates, and batch order.
3. Read the batch's prompt file: `docs/prompts/NN_*.md`. This is the canonical
   handoff for the feature work - follow its Tasks verbatim.
4. Read `docs/planning/TASK_BREAKDOWN.md` section for this batch to confirm the
   exact commit message and primary tests.

## Step 1 - Preconditions

1. Confirm you are in the primary checkout at
   `/Users/talo/www/claude-code-ai-coach-assistant` on branch `main` with a
   clean working tree (`git status --porcelain` empty). If not clean, STOP and
   report - do not stash or discard the user's uncommitted work.
2. Confirm the previous batch is done: there should be one squash commit on
   `main` per completed batch. If batch `NN-1` is not yet merged (and `NN` > 00),
   STOP and report the gap - batches are strictly sequential.
3. `git fetch` is not required; never push `main`.

## Step 2 - Create the per-batch worktree

Pick the branch prefix by batch nature: `chore/` for 00, 01, 19; `test/` for 18;
`docs/` for doc-only; otherwise `feature/`. Derive a short slug from the prompt
title.

```bash
git worktree add ../itai-NN-<slug> -b <prefix>/NN-<slug>
```

Do all subsequent work inside that worktree. Invoke the
`superpowers:using-git-worktrees` skill to set this up correctly.

## Step 3 - Execute the prompt

1. Before editing, inspect the current code and state which files you will
   touch (the prompt mandates this).
2. Implement the batch's Tasks verbatim. Reuse existing utilities rather than
   reinventing: `lib/auth/roles.ts`, `lib/auth/require-admin.ts`,
   `lib/supabase/server.ts`, `lib/utils.ts`, `lib/types/action-result.ts`,
   and existing `components/ui/*`.
3. Carry the build's non-negotiable constraints (also in every prompt's
   constraints block): TypeScript; App Router; root `proxy.ts` (NEVER create
   root `middleware.ts`); next-intl `/en`->en-US, `/he`->he-IL, Hebrew RTL;
   Supabase RLS on every app table; AI server-side only via Vercel AI Gateway
   with keys never exposed to the browser; TSDoc on exports; tests for every
   changed behavior; Markdown files UPPERCASE_WITH_UNDERSCORES.md.
4. **Batch 02 specific, highest risk:** the root `proxy.ts` ALREADY runs
   Supabase `updateSession`. COMPOSE next-intl locale routing INTO that existing
   proxy (chain both). Do NOT replace it and do NOT add a `middleware.ts`.
5. Add or update tests for every behavior you change; mock all AI calls in tests.

## Step 4 - Gates with self-correction

Run the batch's gates. For most batches:

```bash
npm run lint
npm run typecheck
npm run build
```

For test/behavior batches also:

```bash
npm run test
npm run test:e2e
```

(Confirm the exact gate set against the runbook row for this batch.)

**Self-correction loop (full autonomy to pass gates):** if any gate fails,
invoke `superpowers:systematic-debugging`, fix the cause, and re-run that gate.
You have full autonomy to make gates green, including reasonable scope
adjustments. BUT: log every deviation from the prompt's literal Tasks in the
final report (Step 6) so the user has an audit trail. Do not silently drift.

**Retry cap: 3 attempts per gate.** If a gate still fails after 3 fix attempts,
go to Step 5b (failure path). Do not loop indefinitely. Do not force a merge of
red work onto main.

## Step 5a - Success path: commit, squash-merge, clean up

1. Commit in the worktree with the EXACT commit message from the task breakdown
   table for this batch (e.g. `Add locale routing foundation`).
2. Optionally push the feature branch to the remote (allowed by policy).
3. Squash-merge into local `main` in the primary checkout:
   `git merge --squash <branch>` then commit with the same prescribed message.
   NEVER push `main`.
4. Remove the worktree and delete the merged branch. Invoke
   `superpowers:finishing-a-development-branch` to do this cleanly.
5. Go to Step 6.

## Step 5b - Failure path: preserve and stop

If gates cannot pass within the retry cap, or you hit a genuine blocker (missing
API key, ambiguous requirement the prompt does not resolve):

1. Commit work-in-progress on the feature branch with message
   `WIP(NN): <one-line reason for stop>`.
2. Leave the worktree INTACT. Do NOT squash-merge. `main` must stay clean.
3. Go to Step 6 and clearly mark status as STOPPED, with the failing gate output
   and what a human needs to decide or fix.

## Step 6 - Report

Produce the prompt's required output:

1. Status: COMPLETED (merged to main) or STOPPED (worktree preserved).
2. Files changed.
3. Key implementation decisions.
4. **Deviations from the prompt's literal Tasks** (the audit trail), or "none".
5. Tests added or updated.
6. Commands run and their observed results (gate output, evidence not assertion).
7. Remaining risk or follow-up; for STOPPED, exactly what the human must do next.

Keep the report concise. If COMPLETED, end by stating the next batch to run
(`/run-batch <NN+1>`).
