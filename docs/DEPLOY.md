# Deploying ZClip

Web app on Railway, database on Supabase, media on Backblaze B2.

## Railway variables (service > Variables)

| Name | Secret? | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | no | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | no | Publishable key |
| `SUPABASE_SECRET_KEY` | **yes** | Server only. Never paste into chat, commits or logs |
| `B2_ENDPOINT`, `B2_REGION` | no | Match your bucket |
| `B2_KEY_ID`, `B2_APPLICATION_KEY` | **yes** | Backblaze application key |
| `B2_BUCKET_CLIPS`, `B2_BUCKET_EXPORTS` | no | Private bucket name(s) |
| `GEMINI_API_KEY` | **yes, optional** | Without it the rule-based editor is used |
| `RAILPACK_DEPLOY_APT_PACKAGES` | no | Set to `ffmpeg` so rendering works |
| `NODE_VERSION` | no | `22` |

## Supabase

Authentication > URL Configuration: set the Site URL to your Railway address and add `<address>/auth/callback` to the Redirect URLs.

## Check it

Open `/api/health`. It lists which settings and tools are present (yes or no, never values). `ok: true` means the required ones are set and FFmpeg is installed.

## Branches

Only `main` deploys. Build on `main`.
