# ZClip roadmap

Order matters: each step unlocks the next.

1. **Storage key + first full test.** Real Backblaze keyID (starts with `005`) and applicationKey in Railway. One run: upload, setup, approve, edit, review, manual fix, download.
2. **Gemini key.** Check automatic edit quality. Keep the AI layer swappable; compare 2-3 models on the same 10 clips by edit quality and cost per finished video.
3. **Compression.** 480-720p working copy for the editor and AI; export from originals; optional "Smaller file" export; optional data-saver compress-before-upload; resumable uploads.
4. **Auto-delete.** Backblaze lifecycle: exports removed ~48h after render, originals ~7 days; bucket set to really delete (not "keep all versions"); delete ~1h after download; "Delete now" button; delete all on account deletion.
5. **Background render worker** on Railway.
6. **Differentiators.** Fix one part instead of redoing everything; free manual fixes; price shown before approval; auto-refund failed renders; style presets; before/after compare.
7. **Free-tier protection.** Small free allowance (short clips, 720p, watermark), email + phone verification, throwaway-email block, per-device/IP limits, Guardian pattern checks, daily free-spend cap, expiring credits.
8. **Paystack billing** in Naira (credit packs + optional monthly plan), priced at about 3x measured cost per video. Then invite 5-10 creators.

Later: brand kit, batch mode, beat-sync, captions in Pidgin/Yoruba, long-video clip finder, WhatsApp share, one Zyron account across apps.
