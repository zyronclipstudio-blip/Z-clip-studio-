# ZClip roadmap

One phase at a time. Anything touching schema, credits, auth, storage or retention is agreed first.

1. **Foundation (now):** correct Railway setup, health check, docs.
2. **Render worker:** move rendering out of the web request into a separate worker using `render_jobs`.
3. **Corrections:** remove, reorder and trim clips, change music, adjust volume, edit captions, undo and redo. Auto and Manual share one edit plan.
4. **Music and captions in the edit plan.**
5. **Billing:** plans, allowance warnings, payment webhooks. Prices only after real cost per job is measured.
6. **Guardian expansion:** budget limits, free-credit abuse checks, inactive-account workflow.
7. **Manual editing, second layer:** split, speed, a simple draggable timeline. Only if real users ask.
