-- One-off changes to the daily blocks for a single date (e.g. lunch moved on
-- 24 Oct only). A row replaces that date's blocks entirely; an empty list means
-- no blocks that day. Deleting the row puts the usual daily blocks back.
create table if not exists public.block_day_overrides (
  block_date date primary key,
  -- [{ "label": "Lunch", "start": 840, "end": 900 }], minutes from midnight IST
  blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.block_day_overrides enable row level security;

drop policy if exists "staff all block_day_overrides" on public.block_day_overrides;
create policy "staff all block_day_overrides" on public.block_day_overrides
  for all to authenticated
  using (public.portal_client_id() is null)
  with check (public.portal_client_id() is null);

drop trigger if exists trg_block_day_overrides_upd on public.block_day_overrides;
create trigger trg_block_day_overrides_upd before update on public.block_day_overrides
  for each row execute function public.update_updated_at_column();
