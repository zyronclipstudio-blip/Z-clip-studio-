-- Learned styles and learned rules. Written only by the server (service role).
-- Signed-in users may read what is approved. No customer media or personal data is stored here.
create table public.style_recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  audience text not null default '',
  rules jsonb not null,
  source_url text,
  source_views bigint,
  score numeric not null default 0,
  status text not null default 'draft' check (status in ('draft','approved','rejected')),
  created_at timestamptz not null default now()
);
create index style_recipes_status_idx on public.style_recipes (status, score desc);

create table public.learned_rules (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'all',
  rule text not null check (char_length(rule) <= 240),
  evidence_count integer not null default 1,
  status text not null default 'draft' check (status in ('draft','approved','rejected')),
  created_at timestamptz not null default now(),
  unique (scope, rule)
);
create index learned_rules_status_idx on public.learned_rules (status);

alter table public.style_recipes enable row level security;
alter table public.learned_rules enable row level security;
revoke all on public.style_recipes, public.learned_rules from anon, authenticated;
grant select on public.style_recipes, public.learned_rules to authenticated;
grant all on public.style_recipes, public.learned_rules to service_role;
create policy style_recipes_read_approved on public.style_recipes for select to authenticated using (status = 'approved');
create policy learned_rules_read_approved on public.learned_rules for select to authenticated using (status = 'approved');
