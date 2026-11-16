# Instructions for AI coding agents (Antigravity, Claude Code, Cursor, etc.)

You are the implementation engineer for **ZClip (Zyron Clip Studio)**. This file is binding. Read it fully, then read `README.md`, `supabase/migrations/`, and the ZClip Master Builder Specification v1.2 if the owner provides it.

## Before you change anything
1. Inspect the repo and report what exists, what is broken, and what is missing. Do not rebuild working parts without a stated reason.
2. Propose a short plan for ONE phase and wait for approval if it touches: database schema, billing/credits, storage vendor, auth, data retention, or the Guardian/abuse rules.
3. Work in small, reviewable commits. One phase at a time. Do not silently widen scope.

## Hard rules (do not break these)
- **No fake data.** Never hardcode sample stats, balances, project counts, storage figures, percentages, names or dates in the UI. Every number shown must come from real data (database or API) or be hidden. Empty states must say "nothing yet".
- **Prototype 1 scope only.** Do NOT add: templates or a template marketplace, a multi-track timeline/"full editor", a social feed, a creator marketplace, advanced effects, or unmetered/unlimited plans. Allowed corrections are: remove a clip, reorder clips, trim a clip, change music, adjust volume, edit/remove text, undo/redo.
- **Money and credits are server-side only.** The browser must never set a balance, price, plan or permission. Credits are reserved, settled and refunded through the existing database functions (`reserve_credit`, `settle_credit`, `start_render_job`). The ledger is append-only. Never write a second billing path.
- **Secrets stay server-side.** Never put `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, payment secrets or any service-role key in client code, `NEXT_PUBLIC_*` variables, logs, prompts or commits. `.env` stays git-ignored.
- **Private media.** Buckets are private. Use short-lived signed URLs. Never cache private media, auth responses, API responses or billing endpoints in the service worker. If you change the storage provider (for example to Backblaze B2 or Cloudflare R2), keep the same guarantees (private objects, scoped signed URLs, real deletion at expiry) and tell the owner first.
- **Row-level security on every user-owned table.** New tables need RLS, explicit grants, and a cross-user isolation test.
- **Database changes are migrations.** Add a new numbered file in `supabase/migrations/`. Never edit an applied migration or change the live database by hand without recording it.
- **Operational values are configurable** (`app_settings` table): caps, kill switches, concurrency, retention, credit weights, prices. Never hardcode them. Credit weights are placeholders, not approved pricing.
- **Do not train on customer media.** No model training or fine-tuning without separate explicit opt-in.
- **Never** let a model rewrite or deploy production code autonomously.

## Product rules
- Guided automatic editing first; manual editing is optional and simple.
- Technical quality (hard gate) is separate from creative preference. Inspect the real rendered file before delivering it.
- Long FFmpeg renders must not run in short-lived serverless request handlers; the current in-request render is a known prototype limit.
- Design direction is obsidian black and metallic gold (obsidian `#08080A`, gold `#D4AF37`, champagne `#F3E3B3`, raised surface `#111114`). Do not reintroduce blue, cyan or violet accents. Fonts: Space Grotesk for display, Inter for body, IBM Plex Mono for technical labels. Dark by default, visible focus, reduced motion respected, status never by colour alone.

## Definition of done (for every task)
- Run `npm test` and `npm run build`. Both must pass. Paste the real output; do not say "should work".
- Add or update tests for what you changed (authorization, usage accounting, idempotency, plan validation, render checks).
- Never report something as complete unless it is implemented AND tested. If you could not test it, say so plainly.
- End each task with: files changed, migrations added, env vars needed, tests run and results, known gaps.

## Known gaps (do not pretend these exist)
Background render worker, correction controls, payments/subscriptions, monthly allowance warnings, workspaces, promotional-grant and account-integrity logic, captions/music in the edit plan, approved brand icons (the ones in `public/icons` are placeholders).
