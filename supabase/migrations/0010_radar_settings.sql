-- Settings for the AI's daily homework. All adjustable without a deploy.
insert into public.app_settings (key, value) values
  ('radar_enabled', 'true'::jsonb),
  ('radar_interval_hours', '24'::jsonb),
  ('radar_per_niche', '2'::jsonb),
  ('radar_auto_approve_min_score', '60'::jsonb),
  ('rules_min_distinct_users', '5'::jsonb),
  ('radar_last_run', '"1970-01-01T00:00:00.000Z"'::jsonb)
on conflict (key) do nothing;
