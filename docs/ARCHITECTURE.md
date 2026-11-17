# ZClip architecture

ZClip turns raw footage into a finished video. Automatic first, with manual control when you want it.

## Pieces

| Piece | What it does | Where it lives |
|---|---|---|
| Web app | Screens, sign-in, upload, progress, My Edits | `app/`, `components/` (Next.js) |
| API routes | Projects, upload signing, estimates, edit processing, account | `app/api/` |
| Database and auth | Users, projects, edit plans, render jobs, credits, audit | Supabase (`supabase/migrations/`) |
| Media storage | Private clips and exports, short-lived signed links | Backblaze B2 (`lib/storage.ts`) |
| AI planner | Suggests the edit; falls back to a rule-based editor | `lib/ai-adapter.ts` (Gemini, replaceable) |
| Renderer | Cuts, joins and encodes with FFmpeg, then checks the real output | `lib/renderer.ts` |
| Credits | Reserve, charge and refund, always on the server | `lib/credits.ts` and SQL functions |
| Guardian | Rate limits, kill switches, event log | `lib/guardian.ts`, `guardian_events` |

## The journey

1. Sign in (Supabase Auth, `middleware.ts`).
2. Create a project, upload clips straight to private storage.
3. Finalize: each file is proven to be a real video with ffprobe.
4. Approve the credit ceiling, then process: plan, render, inspect, store, charge.
5. Review, correct, download. Files are deleted after the retention period.

## Rules that do not change

- Secrets stay on the server. Buckets are private. Row-level security on every user table.
- The browser never sets a balance, price or permission.
- Operational values (limits, retention, credit weights) live in `app_settings`, not in code.
- No fake numbers on screen. Empty states say "nothing yet".
- Black and gold design. See `AGENTS.md`.

## Known gaps

Rendering still runs inside the web request. A separate worker is the next structural step. See `ROADMAP.md`.
