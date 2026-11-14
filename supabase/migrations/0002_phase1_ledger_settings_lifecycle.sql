-- Phase 1 additions: configurable settings, subscriptions, cost ledger, lifecycle,
-- append-only usage ledger with reservations, and an atomic signup cap.

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (key, value) values
  ('signup_cap', '30000'::jsonb),
  ('free_credits', '3'::jsonb),
  ('kill_switch_signups', 'false'::jsonb),
  ('kill_switch_ai', 'false'::jsonb),
  ('kill_switch_render', 'false'::jsonb),
  ('max_concurrent_renders_global', '1'::jsonb),
  ('max_concurrent_renders_per_user', '1'::jsonb),
  ('daily_budget_usd', 'null'::jsonb),
  ('monthly_budget_usd', 'null'::jsonb),
  ('retention_hours', '24'::jsonb),
  ('inactivity_days', 'null'::jsonb),
  ('inactivity_grace_days', 'null'::jsonb);
create trigger app_settings_set_updated_at before update on public.app_settings
  for each row execute function private.set_updated_at();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','standard','pro')),
  status text not null default 'active' check (status in ('active','past_due','canceled','paused')),
  provider text,
  provider_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function private.set_updated_at();

create table public.cost_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  render_job_id uuid references public.render_jobs(id) on delete set null,
  category text not null check (category in ('ai','compute','storage','bandwidth','other')),
  provider text,
  estimated_usd numeric(12,6),
  actual_usd numeric(12,6),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index cost_ledger_created_idx on public.cost_ledger (created_at desc);
create index cost_ledger_owner_id_idx on public.cost_ledger (owner_id) where owner_id is not null;
create index cost_ledger_project_id_idx on public.cost_ledger (project_id) where project_id is not null;
create index cost_ledger_render_job_id_idx on public.cost_ledger (render_job_id) where render_job_id is not null;

create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('user_requested','inactivity')),
  status text not null default 'warned' check (status in ('warned','grace','recovered','completed','blocked')),
  warned_at timestamptz,
  grace_ends_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index deletion_requests_owner_id_idx on public.deletion_requests (owner_id);
create index deletion_requests_status_idx on public.deletion_requests (status, grace_ends_at);

alter table public.usage_ledger
  add column reservation_id uuid,
  add constraint usage_ledger_reason_check
    check (reason in ('grant','reserve','consume','release','reverse'));
create index usage_ledger_reservation_idx on public.usage_ledger (reservation_id) where reservation_id is not null;

create or replace function private.usage_ledger_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Updates are never allowed. Direct deletes are blocked; deletes that cascade from
  -- removing the whole account (trigger depth > 1) are permitted for lifecycle deletion.
  if tg_op = 'UPDATE' then
    raise exception 'usage_ledger is append-only';
  elsif tg_op = 'DELETE' and pg_trigger_depth() <= 1 then
    raise exception 'usage_ledger rows cannot be deleted directly';
  end if;
  return coalesce(old, new);
end;
$$;
create trigger usage_ledger_no_update before update on public.usage_ledger
  for each row execute function private.usage_ledger_append_only();
create trigger usage_ledger_no_delete before delete on public.usage_ledger
  for each row execute function private.usage_ledger_append_only();

-- Balance = sum of deltas. grant:+n, reserve:-n, consume:0, release:+n, reverse:+n.
create or replace function public.credit_balance(p_owner uuid)
returns integer language sql stable set search_path = '' as $$
  select coalesce(sum(delta), 0)::integer from public.usage_ledger where owner_id = p_owner;
$$;

create or replace function public.my_credit_balance()
returns integer language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(delta), 0)::integer from public.usage_ledger where owner_id = (select auth.uid());
$$;

revoke all on function public.credit_balance(uuid) from public, anon, authenticated;
grant execute on function public.credit_balance(uuid) to service_role;
revoke all on function public.my_credit_balance() from public, anon;
grant execute on function public.my_credit_balance() to authenticated;

-- Signup: atomic cap, kill switch, free credits, free subscription.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cap integer;
  closed boolean;
  credits integer;
begin
  perform pg_advisory_xact_lock(7771001); -- serialise signups so the cap cannot be raced
  select (value #>> '{}')::boolean into closed from public.app_settings where key = 'kill_switch_signups';
  if coalesce(closed, false) then
    raise exception 'signups_closed';
  end if;
  select (value #>> '{}')::integer into cap from public.app_settings where key = 'signup_cap';
  if cap is not null and (select count(*) from public.profiles) >= cap then
    raise exception 'signup_cap_reached';
  end if;

  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  insert into public.subscriptions (owner_id) values (new.id) on conflict do nothing;

  select (value #>> '{}')::integer into credits from public.app_settings where key = 'free_credits';
  if coalesce(credits, 0) > 0 then
    insert into public.usage_ledger (owner_id, delta, reason, idempotency_key)
    values (new.id, credits, 'grant', 'signup-grant:' || new.id::text)
    on conflict (idempotency_key) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['app_settings','subscriptions','cost_ledger','deletion_requests']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

grant select on public.subscriptions, public.deletion_requests to authenticated;
create policy subscriptions_select_own on public.subscriptions for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy deletion_requests_select_own on public.deletion_requests for select to authenticated
  using ((select auth.uid()) = owner_id);
-- app_settings and cost_ledger: no user access at all.

insert into public.subscriptions (owner_id) select user_id from public.profiles on conflict do nothing;
