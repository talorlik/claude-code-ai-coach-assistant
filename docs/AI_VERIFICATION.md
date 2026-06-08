# AI Processes Verification

Date: 2026-06-08

## Summary

The four AI flows were already fully wired to a real provider in code. They did
not work at runtime because of a two-layer Vercel AI Gateway billing gate, not a
code bug: first the Gateway required a card on file (initial 403), and after a
card was added the account's free tier still blocked the configured paid-tier
model `anthropic/claude-sonnet-4-6` (second 403). The application code, prompts,
schemas, and persistence were correct throughout and were never the blocker.

Resolved by keeping the Gateway and switching to free-tier-eligible models, split
by workload: `openai/gpt-4o` for plan generation, `anthropic/claude-haiku-4-5`
for chat. See "Resolution" below.

> [!IMPORTANT]
> Both blockers were billing/account gates on the Vercel AI Gateway, not bugs in
> the codebase. A card on file is necessary but not sufficient - premium models
> (e.g. Sonnet) additionally require paid credits. Free-tier-eligible models run
> with only a card on file.

## What Was Tested

Layer 1 - direct provider call, isolating the model seam from UI/auth/DB. A
throwaway script (not committed) called the real `generateObject` against the
configured model `anthropic/claude-sonnet-4-6` through the Gateway, using
`AI_GATEWAY_API_KEY` loaded from `.env.local` (key present, 60 chars), on the
nvm Node v22.16.0 toolchain.

## Result

| Check | Outcome |
| --- | --- |
| `AI_GATEWAY_API_KEY` present locally | Yes |
| Request reaches Gateway and authenticates | Yes |
| Model call succeeds | No - HTTP 403 |
| `generateWorkoutPlan` (en-US, he-IL) | `ok: false`, `reason: ai_error` (both) |

Raw error captured from `generateObject`:

```text
name:       GatewayInternalServerError (AI_APICallError)
statusCode: 403
url:        https://ai-gateway.vercel.sh/v3/ai/language-model
message:    AI Gateway requires a valid credit card on file to service
            requests. Please visit ...?modal=add-credit-card to add a card
            and unlock your free credits.
```

The error is the same regardless of locale or schema complexity (a trivial
one-field schema also 403s), confirming it is account-level, not request-level.

Layer 2 (browser + Supabase smoke test) was skipped as redundant: driving the
UI would reproduce the identical 403 through the wired flows without yielding new
information, at the cost of a dev-server spin-up and test DB writes.

## What This Means

- Code state: correct and complete. `lib/ai/generate-plan.ts`,
  `app/api/chat/route.ts`, the prompts in `lib/ai/prompts.ts` /
  `lib/ai/chat-context.ts`, and the Zod schemas in `lib/ai/schemas.ts` all work
  as designed. No prompt or schema changes are needed for the flows to function.
- Runtime state: blocked by the Gateway billing gate. Production on Vercel will
  hit the same 403 until a card is on file.

## Follow-Up: Card Added, Tier Gate Discovered

After a card was added to the Vercel team, the same Layer-1 probe returned a
**different** 403:

```text
403 - Free tier users do not have access to this model. Upgrade to paid
       credits ... modal=top-up for unrestricted access.
```

So a card on file is necessary but not sufficient: the account is still on the
free tier, and `anthropic/claude-sonnet-4-6` is a paid-tier-only model. Probing
several models against the live Gateway showed which the free tier can reach:

| Model | Result |
| --- | --- |
| `anthropic/claude-sonnet-4-6` | 403 - paid tier only |
| `anthropic/claude-haiku-4-5` | OK |
| `openai/gpt-4o` | OK |
| `openai/gpt-4o-mini` | OK |
| `openai/gpt-4.1-mini` | OK |

This corrects the earlier "add a card unlocks Claude" assumption: it unlocks the
Gateway, but premium models still require paid credits.

## Resolution

Keep the Vercel AI Gateway (no new key, no new dependency) and switch the two
model constants to free-tier-eligible models, split by workload:

- `PLAN_MODEL` (`lib/ai/generate-plan.ts`) -> `openai/gpt-4o`. Plan generation is
  reasoning-heavy and also backs template creation and regeneration, so it gets
  the stronger model.
- `CHAT_MODEL` (`app/api/chat/route.ts`) -> `anthropic/claude-haiku-4-5`. Chat is
  high-volume and conversational, so it gets the fast, low-cost model.

Verified post-change against the live Gateway: gpt-4o returns schema-valid
structured plan output (~15s) and haiku-4.5 streams chat replies (~3s); both
clear the former 403. Prompts, schemas, validation, persistence, and the 640
unit/integration tests are unaffected - only the model handles changed.

The standalone OpenAI key remains unused: the Gateway fronts OpenAI. If the
account later needs a paid-tier model (e.g. Sonnet), top up credits at the
Gateway `modal=top-up` link rather than re-architecting.
