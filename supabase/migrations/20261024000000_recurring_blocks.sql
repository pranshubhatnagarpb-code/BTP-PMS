-- Time blocked off every day, indefinitely (lunch, breaks...). Shown on the
-- appointments calendar and warned about when a booking overlaps. Editable from
-- the calendar's "Daily blocks". Times are minutes from midnight, IST.
create table if not exists public.recurring_blocks (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(trim(label)) between 1 and 80),
  start_minute integer not null check (start_minute between 0 and 1439),
  end_minute integer not null check (end_minute between 1 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_blocks_order_check check (end_minute > start_minute)
);

alter table public.recurring_blocks enable row level security;

-- Staff only; client-portal logins can't see or change them.
drop policy if exists "staff all recurring_blocks" on public.recurring_blocks;
create policy "staff all recurring_blocks" on public.recurring_blocks
  for all to authenticated
  using (public.portal_client_id() is null)
  with check (public.portal_client_id() is null);

drop trigger if exists trg_recurring_blocks_upd on public.recurring_blocks;
create trigger trg_recurring_blocks_upd before update on public.recurring_blocks
  for each row execute function public.update_updated_at_column();

-- The blocks that were fixed in the code until now.
insert into public.recurring_blocks (label, start_minute, end_minute)
select * from (values
  ('Lunch + BTP work', 810, 870),
  ('Blocked', 990, 1050),
  ('Blocked', 1260, 1290)
) as v(label, start_minute, end_minute)
where not exists (select 1 from public.recurring_blocks);
