-- The AI's practice edits on free stock clips: one row per practice video. Server-only.
create table if not exists public.practice_runs (
  id uuid primary key default gen_random_uuid(),
  style text not null,
  score numeric,
  hook numeric,
  issues text[] not null default '{}',
  pieces int,
  blends int,
  effects text[] not null default '{}',
  pacing text,
  duration_sec numeric,
  render_ms int,
  qa_passed boolean,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists practice_runs_style_idx on public.practice_runs (style, created_at desc);
alter table public.practice_runs enable row level security;
revoke all on public.practice_runs from anon, authenticated;
insert into public.app_settings (key, value) values ('practice_enabled', 'true'::jsonb), ('practice_interval_hours', '12'::jsonb), ('practice_clips_per_set', '5'::jsonb)
on conflict (key) do nothing;
