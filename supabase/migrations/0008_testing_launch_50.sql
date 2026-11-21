-- Testing launch: 50 credits for every account, and only 50 tester slots.
-- Grant is idempotent and goes through the append-only ledger.
insert into public.usage_ledger (owner_id, delta, reason, idempotency_key)
select user_id, 50, 'grant', 'testing-grant-50-2026-11:' || user_id::text
from public.profiles
on conflict (idempotency_key) do nothing;

update public.app_settings set value = '50'::jsonb where key = 'free_credits';
update public.app_settings set value = '50'::jsonb where key = 'signup_cap';
