-- Credit estimates, authorised ceilings, partial settlement and receipts.
-- Credit weights below are PLACEHOLDERS (not approved policy); they live in app_settings.

insert into public.app_settings (key, value) values
  ('credit_seconds_per_credit', '300'::jsonb),
  ('credit_min_per_job', '1'::jsonb),
  ('credit_ceiling_multiplier', '1.25'::jsonb),
  ('credit_schedule_version', '1'::jsonb)
on conflict (key) do nothing;

alter table public.usage_ledger add column meta jsonb not null default '{}'::jsonb;

-- Replaces the earlier one-credit versions created by 0002 (none existed in 0002 of this repo,
-- so these drops are no-ops on a fresh database).
drop function if exists public.reserve_credit(uuid, uuid, text);
drop function if exists public.settle_credit(uuid, text);

create function public.reserve_credit(
  p_owner uuid, p_project uuid, p_key text, p_amount integer, p_meta jsonb default '{}'::jsonb
) returns uuid language plpgsql set search_path = '' as $$
declare
  existing uuid;
  new_id uuid := gen_random_uuid();
begin
  if p_amount is null or p_amount < 1 then
    raise exception 'invalid_amount';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_owner::text));
  select id into existing from public.usage_ledger where idempotency_key = p_key;
  if existing is not null then
    return existing;
  end if;
  if public.credit_balance(p_owner) < p_amount then
    raise exception 'insufficient_credits';
  end if;
  insert into public.usage_ledger (id, owner_id, project_id, delta, reason, idempotency_key, reservation_id, meta)
  values (new_id, p_owner, p_project, -p_amount, 'reserve', p_key, new_id, p_meta);
  return new_id;
end;
$$;

-- Settle once: charge the actual amount (never above the reserved ceiling) and release the rest.
-- p_actual = 0 refunds everything (failed or withheld job).
create function public.settle_credit(p_reservation uuid, p_actual integer, p_meta jsonb default '{}'::jsonb)
returns void language plpgsql set search_path = '' as $$
declare
  r public.usage_ledger%rowtype;
  reserved integer;
  actual integer;
begin
  select * into r from public.usage_ledger where id = p_reservation and reason = 'reserve';
  if not found then
    raise exception 'reservation not found';
  end if;
  perform pg_advisory_xact_lock(hashtext(r.owner_id::text));
  if exists (select 1 from public.usage_ledger
             where reservation_id = p_reservation and reason in ('consume','release')) then
    return; -- already settled
  end if;
  reserved := -r.delta;
  actual := least(greatest(coalesce(p_actual, 0), 0), reserved);

  if actual > 0 then
    insert into public.usage_ledger (owner_id, project_id, delta, reason, idempotency_key, reservation_id, meta)
    values (r.owner_id, r.project_id, 0, 'consume', 'settle:' || p_reservation::text, p_reservation,
            p_meta || jsonb_build_object('reserved', reserved, 'actual', actual));
  end if;
  if reserved - actual > 0 then
    insert into public.usage_ledger (owner_id, project_id, delta, reason, idempotency_key, reservation_id, meta)
    values (r.owner_id, r.project_id, reserved - actual, 'release', 'settle-release:' || p_reservation::text, p_reservation,
            p_meta || jsonb_build_object('reserved', reserved, 'actual', actual));
  end if;
end;
$$;

revoke all on function public.reserve_credit(uuid, uuid, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.settle_credit(uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.reserve_credit(uuid, uuid, text, integer, jsonb) to service_role;
grant execute on function public.settle_credit(uuid, integer, jsonb) to service_role;

create function public.my_receipts(p_limit integer default 20)
returns table (
  reservation_id uuid, project_id uuid, reserved integer, consumed integer,
  released integer, status text, created_at timestamptz
) language sql stable security invoker set search_path = '' as $$
  select r.id, r.project_id,
         (-r.delta)::integer,
         (-r.delta - coalesce(sum(s.delta) filter (where s.reason in ('release','reverse')), 0))::integer,
         coalesce(sum(s.delta) filter (where s.reason in ('release','reverse')), 0)::integer,
         case when bool_or(s.reason = 'consume') then 'settled'
              when bool_or(s.reason = 'release') then 'refunded'
              else 'reserved' end,
         r.created_at
  from public.usage_ledger r
  left join public.usage_ledger s on s.reservation_id = r.id and s.id <> r.id
  where r.reason = 'reserve' and r.owner_id = (select auth.uid())
  group by r.id
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;
revoke all on function public.my_receipts(integer) from public, anon;
grant execute on function public.my_receipts(integer) to authenticated;
