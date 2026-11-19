-- Testing period: every account gets 10 credits, and new signups start with 10.
-- Credits are deducted later by the normal reserve/settle flow. The grant is idempotent.
insert into public.usage_ledger (owner_id, delta, reason, idempotency_key)
select user_id, 10, 'grant', 'testing-grant-2026-11:' || user_id::text
from public.profiles
on conflict (idempotency_key) do nothing;

update public.app_settings set value = '10'::jsonb where key = 'free_credits';
