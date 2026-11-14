-- Atomically claims a render slot: enforces global and per-user concurrency and
-- rejects duplicate idempotency keys, all under one lock so requests cannot race.
create or replace function public.start_render_job(
  p_owner uuid, p_project uuid, p_key text, p_max_global integer, p_max_user integer
) returns uuid language plpgsql set search_path = '' as $$
declare
  gcount integer;
  ucount integer;
  jid uuid;
begin
  perform pg_advisory_xact_lock(7771002);
  if exists (select 1 from public.render_jobs where idempotency_key = p_key) then
    raise exception 'duplicate_job';
  end if;
  -- Jobs "running" for more than 15 minutes are treated as stuck and do not hold a slot.
  select count(*), count(*) filter (where owner_id = p_owner)
    into gcount, ucount
  from public.render_jobs
  where status = 'running' and started_at > now() - interval '15 minutes';
  if gcount >= p_max_global then raise exception 'render_busy_global'; end if;
  if ucount >= p_max_user then raise exception 'render_busy_user'; end if;
  insert into public.render_jobs (project_id, owner_id, status, attempts, idempotency_key, started_at)
  values (p_project, p_owner, 'running', 1, p_key, now())
  returning id into jid;
  return jid;
end;
$$;
revoke all on function public.start_render_job(uuid, uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.start_render_job(uuid, uuid, text, integer, integer) to service_role;
