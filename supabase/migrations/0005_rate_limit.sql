-- Database-backed rate limit so limits survive redeploys and work across several server instances.
create table if not exists public.rate_hits (
  key text not null,
  at timestamptz not null default now()
);
create index if not exists rate_hits_key_at_idx on public.rate_hits (key, at desc);
alter table public.rate_hits enable row level security; -- no policies: only the service role touches it

create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql set search_path = '' as $$
declare
  n integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_key));
  delete from public.rate_hits where key = p_key and at < now() - make_interval(secs => greatest(p_window_seconds, 86400));
  select count(*) into n from public.rate_hits
   where key = p_key and at > now() - make_interval(secs => p_window_seconds);
  if n >= p_max then
    return false;
  end if;
  insert into public.rate_hits (key) values (p_key);
  return true;
end;
$$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
