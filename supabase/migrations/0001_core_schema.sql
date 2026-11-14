-- ZClip core schema. Server-managed tables (ledger, usage, guardian, audit) are
-- written only by the service role; users get read-only or narrowly scoped access.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------- helper functions (non-exposed schema) ----------
create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

-- ---------- tables ----------
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_status text not null default 'active' check (account_status in ('active','restricted','suspended')),
  training_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in
    ('draft','uploading','analysing','planning','rendering','qa_failed','ready','failed','expired')),
  purpose text not null default 'auto',
  mood text not null default 'auto',
  platform text not null default 'auto',
  aspect_ratio text check (aspect_ratio in ('9:16','16:9','1:1')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_id_idx on public.projects (owner_id);
create index projects_expires_at_idx on public.projects (expires_at) where expires_at is not null;
create trigger projects_set_updated_at before update on public.projects
  for each row execute function private.set_updated_at();

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  object_key text not null,
  original_name text not null,
  duration_sec numeric,
  width integer,
  height integer,
  fps numeric,
  codec text,
  has_audio boolean,
  size_bytes bigint,
  retention_expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index media_assets_project_id_idx on public.media_assets (project_id);
create index media_assets_owner_id_idx on public.media_assets (owner_id);
create index media_assets_retention_idx on public.media_assets (retention_expires_at) where retention_expires_at is not null;

create table public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.media_assets(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  segments jsonb not null default '[]'::jsonb,
  provider text,
  model text,
  confidence numeric,
  created_at timestamptz not null default now()
);
create index analysis_results_asset_id_idx on public.analysis_results (asset_id);
create index analysis_results_owner_id_idx on public.analysis_results (owner_id);

create table public.edit_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  source text not null check (source in ('gemini','deterministic')),
  plan jsonb not null,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);
create index edit_plans_owner_id_idx on public.edit_plans (owner_id);

create table public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.edit_plans(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  worker text,
  runtime_ms integer,
  output_object_key text,
  failure_code text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index render_jobs_queue_idx on public.render_jobs (status, created_at) where status in ('queued','running');
create index render_jobs_project_id_idx on public.render_jobs (project_id);
create index render_jobs_owner_id_idx on public.render_jobs (owner_id);
create index render_jobs_plan_id_idx on public.render_jobs (plan_id) where plan_id is not null;

create table public.quality_reports (
  id uuid primary key default gen_random_uuid(),
  render_job_id uuid not null references public.render_jobs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  technical jsonb not null default '{}'::jsonb,
  semantic jsonb not null default '{}'::jsonb,
  defects jsonb not null default '[]'::jsonb,
  corrections jsonb not null default '[]'::jsonb,
  passed boolean not null,
  created_at timestamptz not null default now()
);
create index quality_reports_render_job_id_idx on public.quality_reports (render_job_id);
create index quality_reports_project_id_idx on public.quality_reports (project_id);
create index quality_reports_owner_id_idx on public.quality_reports (owner_id);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  kind text not null,
  provider text,
  model text,
  request_id text,
  tokens_in integer,
  tokens_out integer,
  estimated_cost_usd numeric(12,6),
  created_at timestamptz not null default now()
);
create index usage_events_owner_created_idx on public.usage_events (owner_id, created_at desc);
create index usage_events_project_id_idx on public.usage_events (project_id) where project_id is not null;

create table public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  delta integer not null,
  reason text not null,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);
create index usage_ledger_owner_created_idx on public.usage_ledger (owner_id, created_at desc);
create index usage_ledger_project_id_idx on public.usage_ledger (project_id) where project_id is not null;

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  source text not null default 'explicit' check (source in ('explicit','feedback')),
  updated_at timestamptz not null default now(),
  unique (owner_id, key)
);
create trigger user_preferences_set_updated_at before update on public.user_preferences
  for each row execute function private.set_updated_at();

create table public.feedback_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  signal text not null,
  detail jsonb not null default '{}'::jsonb,
  consent_basis text not null default 'product_improvement_own_account',
  created_at timestamptz not null default now()
);
create index feedback_events_owner_id_idx on public.feedback_events (owner_id);
create index feedback_events_project_id_idx on public.feedback_events (project_id) where project_id is not null;

create table public.guardian_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  severity text not null check (severity in ('info','warn','block')),
  evidence jsonb not null default '{}'::jsonb,
  risk_score numeric,
  action text,
  outcome text,
  review_state text not null default 'none' check (review_state in ('none','pending','upheld','reversed')),
  created_at timestamptz not null default now()
);
create index guardian_events_owner_id_idx on public.guardian_events (owner_id) where owner_id is not null;
create index guardian_events_created_idx on public.guardian_events (created_at desc);

create table public.account_relationships (
  id uuid primary key default gen_random_uuid(),
  subject_ref text not null,   -- pseudonymous reference, never raw identifiers
  related_ref text not null,
  signal_type text not null,
  confidence numeric not null check (confidence between 0 and 1),
  evidence jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index account_relationships_subject_idx on public.account_relationships (subject_ref);
create index account_relationships_related_idx on public.account_relationships (related_ref);
create index account_relationships_expires_idx on public.account_relationships (expires_at);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  target text,
  reason text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- ---------- privileges ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','projects','media_assets','analysis_results','edit_plans','render_jobs',
    'quality_reports','usage_events','usage_ledger','user_preferences','feedback_events','guardian_events',
    'account_relationships','audit_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Read-only for owners (written by the server / workers)
grant select on public.profiles, public.media_assets, public.analysis_results, public.edit_plans,
  public.render_jobs, public.quality_reports, public.usage_events, public.usage_ledger to authenticated;
-- Narrow user writes
grant update (training_opt_in) on public.profiles to authenticated;
grant select, delete on public.projects to authenticated;
grant insert (owner_id, purpose, mood, platform, aspect_ratio) on public.projects to authenticated;
grant update (purpose, mood, platform, aspect_ratio) on public.projects to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert on public.feedback_events to authenticated;
-- guardian_events, account_relationships, audit_logs: no user access at all.

-- ---------- RLS policies ----------
create policy profiles_select_own on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy projects_select_own on public.projects for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy projects_insert_own on public.projects for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy projects_update_own on public.projects for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy projects_delete_own on public.projects for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy media_assets_select_own on public.media_assets for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy analysis_results_select_own on public.analysis_results for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy edit_plans_select_own on public.edit_plans for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy render_jobs_select_own on public.render_jobs for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy quality_reports_select_own on public.quality_reports for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy usage_events_select_own on public.usage_events for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy usage_ledger_select_own on public.usage_ledger for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy user_preferences_select_own on public.user_preferences for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy user_preferences_insert_own on public.user_preferences for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy user_preferences_update_own on public.user_preferences for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy user_preferences_delete_own on public.user_preferences for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy feedback_events_select_own on public.feedback_events for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy feedback_events_insert_own on public.feedback_events for insert to authenticated
  with check ((select auth.uid()) = owner_id);

-- ---------- private storage buckets ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('clips', 'clips', false, 524288000, array['video/mp4','video/quicktime','video/webm','video/x-msvideo']),
  ('exports', 'exports', false, 524288000, array['video/mp4'])
on conflict (id) do nothing;

-- Files live under "<user id>/..." so a user can only touch their own folder.
create policy clips_select_own on storage.objects for select to authenticated
  using (bucket_id = 'clips' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy clips_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'clips' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy clips_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'clips' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Exports are written by the worker (service role); users may only read their own.
create policy exports_select_own on storage.objects for select to authenticated
  using (bucket_id = 'exports' and (storage.foldername(name))[1] = (select auth.uid())::text);
