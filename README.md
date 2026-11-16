# ZClip Studio (Zyron Clip Studio)

Sign in, upload clips, answer three optional questions, get an edited MP4.

## Run it

1. Install **FFmpeg** (includes `ffprobe`) and check `ffmpeg -version` works in a terminal.
2. `cp .env.example .env`, then set `SUPABASE_SECRET_KEY` (Supabase dashboard > Project Settings > API Keys > secret key). It is server-only: never commit it. Optionally add `GEMINI_API_KEY`.
3. In Supabase > Authentication > URL Configuration: set **Site URL** to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to **Redirect URLs**. (Email confirmation is on by default; it sends a link to the callback.)
4. `npm install`, then `npm run dev`, then open http://localhost:3000.

## How it fits together

- **Login:** Supabase Auth (`middleware.ts`, `app/login`, `app/auth/callback`). Every signed-in call acts as the user, so row-level security applies.
- **Upload:** `POST /api/projects` creates a project, `/sign` returns server-approved private upload paths, the browser uploads straight to the private `clips` bucket, `/finalize` downloads each file, proves it is a real video with ffprobe, and records it.
- **Edit:** `POST /api/process` claims a render slot (`start_render_job`), reserves the customer-approved credit ceiling (`reserve_credit`), plans the edit (Gemini or the basic editor), renders with FFmpeg, inspects the real output, stores it in the private `exports` bucket, and charges the actual credits (video delivered) and releases the unused rest, or refunds everything (failed or withheld).
- **Settings:** caps, kill switches, concurrency and retention live in the `app_settings` table, not in code.
- **Cleanup:** expired clips and exports are deleted from storage (not just the database) by `lib/cleanup.ts`.

## Known gaps

- Rendering still runs inside the API request; move it to a worker before deploying to a host with short timeouts.
- Not built yet: correction controls, billing/subscription checkout, cost-budget enforcement, inactive-account workflow, captions/music in the plan.
- Cleanup runs when projects are created; schedule it as well.
- Automated Node tests live in `tests/` and run with `npm test`; install FFmpeg and FFprobe first because the render tests exercise real MP4 output. The GitHub verification workflow runs the tests and production build on pushes to `main` and pull requests.
- The sign-up rate limit and request rate limit are per server instance.

## PWA and design system (v0.4)

- Installable: `app/manifest.ts` (standalone display, gold SVG app icon for normal and maskable use), `public/sw.js` (versioned service worker), `public/offline.html`, `components/PwaShell.tsx` (registration, install button, offline banner). The old blue raster placeholder icons have been removed. The in-app animated intro is separate from the operating system's static PWA install/splash artwork.
- The service worker caches only the offline page and immutable static assets. It never caches API calls, auth, pages, videos, signed URLs or anything cross-origin.
- The service worker registers only in production: test with `npm run build && npm start`, not `npm run dev`.
- iOS Safari has no install prompt: use Share, then Add to Home Screen.
- Design tokens (colours, Space Grotesk / Inter / IBM Plex Mono via `next/font`) are in `tailwind.config.ts` and `app/layout.tsx`.
- Android/Chromium installation uses `public/icons/zclip-gold.svg`; use a separately approved PNG for the iOS Apple touch icon when that platform is prepared.
- Not yet tested on real devices (Android Chrome install, desktop Chromium install, offline behaviour).

## Credit estimates, ceilings and receipts (v0.5)

- Before processing, the app shows expected credits, a maximum the customer authorises, and balances before and after (`/api/projects/[id]/estimate`, `lib/credits.ts`).
- The server reserves the maximum atomically, and the final charge can never exceed it. If the server's figure rises above what the customer approved, the edit stops and asks them to approve again.
- On completion, `settle_credit` charges the actual amount and releases the remainder; a receipt is shown and `my_receipts()` lists a user's own job receipts.
- **The credit weights in `app_settings` (`credit_seconds_per_credit`, `credit_min_per_job`, `credit_ceiling_multiplier`) are placeholders, not approved pricing.** Set them only after measuring real cost per job.
- Metering is currently based on source footage duration. Not built yet: monthly allowance thresholds (70/85/100%), plan prices, payment webhooks.
