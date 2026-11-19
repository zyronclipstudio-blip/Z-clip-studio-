-- The credit ledger is append-only (update/delete are blocked by trigger). The old foreign key used
-- ON DELETE SET NULL, which is an UPDATE, so deleting a project that had credit history failed.
-- Keep project_id as a plain historical reference instead.
alter table public.usage_ledger drop constraint if exists usage_ledger_project_id_fkey;
