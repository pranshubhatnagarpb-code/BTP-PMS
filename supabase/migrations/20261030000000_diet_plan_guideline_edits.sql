-- Per-plan edits to appended diet guidelines, keyed by guideline id:
-- { "<id>": { "title": "...", "html": "..." } }. The library copy stays unchanged.
alter table public.diet_plans
  add column if not exists guideline_edits jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
