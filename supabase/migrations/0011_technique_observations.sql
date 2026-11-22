-- What the AI measures in trending videos: one row per studied video. Server-only (no policies for customers).
create table if not exists public.technique_observations (
  id uuid primary key default gen_random_uuid(),
  video_id text not null,
  niche text not null,
  avg_shot_sec numeric,
  first_cut_sec numeric,
  transitions text[] not null default '{}',
  has_speed_ramp boolean,
  has_title_card boolean,
  has_end_card boolean,
  grade text,
  unknown_techniques text[] not null default '{}',
  created_at timestamptz not null default now()
);
create unique index if not exists technique_observations_video_idx on public.technique_observations (video_id);
alter table public.technique_observations enable row level security;
revoke all on public.technique_observations from anon, authenticated;
